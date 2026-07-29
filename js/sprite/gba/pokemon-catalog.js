(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  class GbaPokemonSpriteCatalog{
    constructor(reader){
      this.native=new PokemonViewer.battle.GbaMonsterSpriteCatalog(reader);
      this.count=this.native.profile.speciesCount;
    }
    available(){return this.count>0;}
    list(){
      return Array.from({length:this.count},(_,index)=>{
        const id=index+1;
        return Object.freeze({id,label:`${String(id).padStart(3,"0")} · ${this.native.data.name(id)}`});
      });
    }
    source(id){
      if(!Number.isInteger(id)||id<1||id>this.count)throw new RangeError(`GBA Pokémon sprite must be 1–${this.count}.`);
      const name=this.native.data.name(id),front=this.native.resource(id,"front"),back=this.native.resource(id,"back");
      if(!front||!back)throw new Error(`${name} has no complete verified front/back sprite pair.`);
      const animated=this.native.data.front(id),views=[
        Object.freeze({...front,label:"Front",title:`${name} · front sprite`})
      ];
      if(animated.bytes.length>=0x1000)views.push(Object.freeze({
        ...front,offset:animated.offset,bytes:animated.bytes.slice(0x800,0x1000),
        label:"Front · frame 2",title:`${name} · animated front frame 2`,editable:false
      }));
      views.push(Object.freeze({...back,label:"Back",title:`${name} · back sprite`}));
      return Object.freeze({
        title:`${name} · Pokémon sprites`,activeView:0,
        views:Object.freeze(views)
      });
    }
  }
  sprites.GbaPokemonSpriteCatalog=GbaPokemonSpriteCatalog;
})(globalThis);
