(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  class Gen2PokemonSpriteCatalog{
    constructor(reader){
      this.data=reader.gen2SpeciesData||=new PokemonViewer.gen2.Gen2SpeciesData(reader);
      this.count=PokemonViewer.gen2.Gen2SpeciesData.COUNT;
    }
    available(){return true;}
    list(){
      return Array.from({length:this.count},(_,index)=>{
        const id=index+1;
        return Object.freeze({id,label:`${String(id).padStart(3,"0")} · ${this.data.catalog.get(id).name}`});
      });
    }
    source(id){
      this.data.assertId(id);
      const picture=this.data.frontSprite(id),frame=picture.bytes.slice(0,picture.frameBytes),normal=this.data.palette(id),shiny=this.data.palette(id,{shiny:true}),name=this.data.catalog.get(id).name;
      const base={offset:picture.offset,bytes:frame,count:picture.width*picture.height,columns:picture.width,editable:false};
      return Object.freeze({
        title:`${name} · Pokémon sprites`,activeView:0,
        views:Object.freeze([
          Object.freeze({...base,label:"Normal",title:`${name} · normal front sprite`,palette:normal.colors,paletteOffsets:[null,normal.offset,normal.offset+2,null]}),
          Object.freeze({...base,label:"Shiny",title:`${name} · shiny front sprite`,palette:shiny.colors,paletteOffsets:[null,shiny.offset,shiny.offset+2,null]})
        ])
      });
    }
  }
  sprites.Gen2PokemonSpriteCatalog=Gen2PokemonSpriteCatalog;
})(globalThis);
