(function(global){
  "use strict";

  class MemoryProfile{
    constructor(info,capabilities){
      if(!info||!capabilities)throw new TypeError("A memory profile requires detected ROM information and capabilities.");
      this.id=capabilities.id;
      this.family=capabilities.family;
      this.game=capabilities.game;
      this.fingerprint=capabilities.fingerprint;
      this.reference=capabilities.provenance?.reference||null;
      this.selection=info.selection||"header";
      this.symbols=Object.freeze({...capabilities.provenance?.symbols});
      this.resources=Object.freeze({...capabilities.provenance?.resources});
      this.verified=Boolean(this.reference&&Object.keys(this.symbols).length);
      Object.freeze(this);
    }
    symbol(name){return this.symbols[name]||null;}
    offset(name){const value=this.symbol(name)?.offset;return Number.isInteger(value)?value:null;}
    require(name){
      const symbol=this.symbol(name);
      if(!symbol)throw new Error(`Memory symbol '${name}' is not verified for ${this.id}.`);
      return symbol;
    }
    resource(id){return this.resources[id]||null;}
    hasResource(id){return Boolean(this.resource(id));}
  }

  global.MemoryProfile=MemoryProfile;
  ((global.PokemonViewer||={}).core||={}).MemoryProfile=MemoryProfile;
})(globalThis);
