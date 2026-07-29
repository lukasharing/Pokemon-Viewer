(function(global){
  "use strict";
  class MinimapUtils{
    static uniqueTiles(source,tileSize=8){
      const context=source.getContext("2d"),seen=new Set(),tiles=[];
      for(let y=0;y<source.height;y+=tileSize)for(let x=0;x<source.width;x+=tileSize){
        const image=context.getImageData(x,y,tileSize,tileSize),key=Array.from(image.data).join(",");
        if(!seen.has(key)){seen.add(key);tiles.push(image);}
      }
      return tiles;
    }
    static packing(count,{maximumColumns=12}={}){
      if(count<1)return{columns:1,rows:1,empty:1};
      const candidates=Array.from({length:Math.min(count,maximumColumns)},(_,index)=>{
        const columns=index+1,rows=Math.ceil(count/columns),empty=columns*rows-count,shape=Math.abs(columns-rows);
        return{columns,rows,empty,score:empty*4+shape};
      });
      return candidates.sort((a,b)=>a.score-b.score||a.empty-b.empty||a.shape-b.shape)[0];
    }
    static renderUsedTiles(source,canvas,{tileSize=8,scale=3}={}){
      const tiles=this.uniqueTiles(source,tileSize),layout=this.packing(tiles.length);
      canvas.width=layout.columns*tileSize;canvas.height=layout.rows*tileSize;
      const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;context.clearRect(0,0,canvas.width,canvas.height);
      tiles.forEach((image,index)=>context.putImageData(image,index%layout.columns*tileSize,Math.floor(index/layout.columns)*tileSize));
      canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;
      canvas.dataset.tileCount=String(tiles.length);canvas.dataset.columns=String(layout.columns);
      return tiles.length;
    }
  }
  global.MinimapUtils=MinimapUtils;((global.PokemonViewer||={}).maps||={}).MinimapUtils=MinimapUtils;
})(globalThis);
