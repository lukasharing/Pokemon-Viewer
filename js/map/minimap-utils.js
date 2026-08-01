(function(global){
  "use strict";
  class MinimapUtils{
    static imageKey(image){return Array.from(image.data).join(",");}
    static uniqueTiles(source,tileSize=8){
      const context=source.getContext("2d"),seen=new Set(),tiles=[];
      for(let y=0;y<source.height;y+=tileSize)for(let x=0;x<source.width;x+=tileSize){
        const image=context.getImageData(x,y,tileSize,tileSize),key=this.imageKey(image);
        if(!seen.has(key)){seen.add(key);tiles.push(image);}
      }
      return tiles;
    }
    static documentFromCanvas(source,{tileSize=8,editable=false}={}){
      const width=Math.floor(source.width/tileSize),height=Math.floor(source.height/tileSize),context=source.getContext("2d"),ids=new Map(),palette=[],cells=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const image=context.getImageData(x*tileSize,y*tileSize,tileSize,tileSize),key=this.imageKey(image);
        if(!ids.has(key)){const id=palette.length;ids.set(key,id);palette.push({id,image});}
        cells.push(ids.get(key));
      }
      return{width,height,tileSize,cells:Object.freeze(cells),palette:Object.freeze(palette),editable:Boolean(editable)};
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
    static renderTilePalette(document,canvas,{selected=null,scale=3,maximumColumns=8}={}){
      const palette=document?.palette||[],tileSize=document?.tileSize||8,layout=this.packing(palette.length,{maximumColumns});
      canvas.width=layout.columns*tileSize;canvas.height=layout.rows*tileSize;
      const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;context.clearRect(0,0,canvas.width,canvas.height);
      palette.forEach((tile,index)=>{
        const x=index%layout.columns*tileSize,y=Math.floor(index/layout.columns)*tileSize;
        if(tile.image instanceof ImageData)context.putImageData(tile.image,x,y);else if(tile.canvas)context.drawImage(tile.canvas,x,y,tileSize,tileSize);
        if(tile.id===selected){context.save();context.strokeStyle="#287fc5";context.lineWidth=2;context.strokeRect(x+1,y+1,tileSize-2,tileSize-2);context.restore();}
      });
      canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;canvas.dataset.columns=String(layout.columns);canvas.dataset.tileCount=String(palette.length);return layout;
    }
    static paletteTileAt(canvas,event,document){
      const columns=Number(canvas.dataset.columns)||1,tileSize=document?.tileSize||8,bounds=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-bounds.left)*canvas.width/bounds.width/tileSize),y=Math.floor((event.clientY-bounds.top)*canvas.height/bounds.height/tileSize),index=y*columns+x;
      return document?.palette?.[index]||null;
    }
    static cellAt(canvas,event,document){
      const bounds=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-bounds.left)*canvas.width/bounds.width/(document?.tileSize||8)),y=Math.floor((event.clientY-bounds.top)*canvas.height/bounds.height/(document?.tileSize||8));
      if(x<0||y<0||x>=document.width||y>=document.height)return null;
      const index=y*document.width+x;return{x,y,index,tile:document.cells[index]};
    }
    static drawCellSelection(canvas,cell,{color="#287fc5"}={}){
      if(!cell)return canvas;const context=canvas.getContext("2d"),size=cell.tileSize||8;
      context.save();context.strokeStyle="#fff";context.lineWidth=3;context.strokeRect(cell.x*size+1.5,cell.y*size+1.5,size-3,size-3);context.strokeStyle=color;context.lineWidth=1;context.strokeRect(cell.x*size+.5,cell.y*size+.5,size-1,size-1);context.restore();return canvas;
    }
  }
  global.MinimapUtils=MinimapUtils;((global.PokemonViewer||={}).maps||={}).MinimapUtils=MinimapUtils;
})(globalThis);
