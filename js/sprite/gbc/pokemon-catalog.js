(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  const palette=Object.freeze(["#ffffff","#aaaaaa","#555555","#111111"]);
  class Gen1PokemonSpriteCatalog{
    constructor(reader){
      this.data=reader.gen1SpeciesData||=new PokemonViewer.gen1.Gen1SpeciesData(reader);
      this.count=151;
    }
    available(){return true;}
    list(){
      return Array.from({length:this.count},(_,index)=>{
        const id=index+1,species=this.data.speciesByDex(id);
        return Object.freeze({id,label:`${String(id).padStart(3,"0")} · ${species?.name||`Pokémon ${id}`}`});
      });
    }
    view(id,side){
      const species=this.data.speciesByDex(id);
      if(!species)throw new Error(`Pokédex #${id} has no canonical Gen I species.`);
      const base=this.data.baseStats(species),back=side==="back";
      const picture=back?this.data.backSprite(species,base):this.data.frontSprite(species,base);
      return Object.freeze({
        label:back?"Back":"Front",title:`${species.name} · ${back?"back":"front"} sprite`,
        offset:picture.offset,bytes:picture.bytes,count:picture.width*picture.height,columns:picture.width,
        editable:false,palette,side,nativeScale:back?2:1
      });
    }
    source(id){
      if(!Number.isInteger(id)||id<1||id>this.count)throw new RangeError("Gen I Pokémon sprite must be 1–151.");
      const name=this.data.speciesByDex(id)?.name||`Pokémon ${id}`;
      return Object.freeze({title:`${name} · Pokémon sprites`,activeView:0,views:Object.freeze([this.view(id,"front"),this.view(id,"back")])});
    }
  }
  sprites.Gen1PokemonSpriteCatalog=Gen1PokemonSpriteCatalog;
})(globalThis);
