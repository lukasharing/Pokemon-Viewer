(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  class GbaItemSpriteCatalog{
    constructor(reader,{berries=false}={}){this.data=reader.gbaItemData||=new PokemonViewer.gba.GbaItemData(reader);this.berries=berries;this.entries=Object.freeze(this.data.list().filter(item=>this.berries?/BERRY$/i.test(item.name):true));this.byId=new Map(this.entries.map(item=>[item.id,item]));}
    available(){return true;}
    list(){return this.entries.map(item=>Object.freeze({id:item.id,label:`${String(item.id).padStart(3,"0")} · ${item.name}`}));}
    source(id){
      const item=this.byId.get(id),source=this.data.iconSource(id);
      if(!item||!source)throw new Error(`${item?.name||`Item #${id}`} has no verified native bag icon.`);
      return Object.freeze({...source,title:`${item.name} · native 24×24 bag icon`});
    }
  }
  sprites.GbaItemSpriteCatalog=GbaItemSpriteCatalog;
})(globalThis);
