(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});

  class SpriteResourceCatalog{
    constructor(entries=[]){
      this.entries=Object.freeze(entries.map((entry,index)=>Object.freeze({
        ...entry,
        id:entry.id??index
      })));
    }
    available(){return this.entries.length>0;}
    list(){return this.entries.map(({id,label})=>Object.freeze({id,label}));}
    source(id){
      const entry=this.entries.find(item=>String(item.id)===String(id));
      if(!entry)throw new RangeError("Choose a valid native graphic.");
      const source=typeof entry.source==="function"?entry.source():entry.source;
      if(!source)throw new Error(`${entry.label} has no decoded native source.`);
      return Object.freeze({...source,title:source.title||entry.label});
    }
  }

  sprites.SpriteResourceCatalog=SpriteResourceCatalog;
})(globalThis);
