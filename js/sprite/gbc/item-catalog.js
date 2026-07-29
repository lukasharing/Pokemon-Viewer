(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  class GbcItemSpriteCatalog{
    constructor(reader){this.data=reader.gen1ItemData||=new PokemonViewer.gen1.Gen1ItemData(reader);this.overworld=reader.structureRegistry.createOverworldSpriteCatalog(reader.memory);}
    available(){return this.overworld.available();}
    list(){return this.data.list().map(item=>Object.freeze({id:item.id,label:`${String(item.id).padStart(2,"0")} · ${item.name} · shared object`}));}
    source(id){const item=this.data.get(id),source=this.overworld.source(0x3d);return Object.freeze({...source,title:`${item.name} · shared Gen I Poké Ball object`});}
  }
  class GbcObjectSpriteCatalog{
    constructor(reader){this.overworld=reader.structureRegistry.createOverworldSpriteCatalog(reader.memory);}
    available(){return this.overworld.available();}
    list(){return this.overworld.list().filter(item=>item.kind==="object");}
    source(id){return this.overworld.source(id);}
  }
  Object.assign(sprites,{GbcItemSpriteCatalog,GbcObjectSpriteCatalog});
})(globalThis);
