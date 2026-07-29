(function(global){
  "use strict";
  class GameFontRegistry{
    constructor(){this.factories=new Map();this.instances=new WeakMap();}
    register(family,factory){if(typeof factory!=="function")throw new TypeError("Game font factory must be a function.");this.factories.set(family,factory);}
    create(reader,family){const factory=this.factories.get(family);if(!factory)throw new Error(`No native font decoder is registered for ${family}.`);return factory(reader);}
    get(reader,family){
      if(!reader||typeof reader!=="object")throw new TypeError("A ROM reader is required for a native game font.");
      let families=this.instances.get(reader);if(!families){families=new Map();this.instances.set(reader,families);}
      if(!families.has(family))families.set(family,this.create(reader,family));
      return families.get(family);
    }
  }
  const fonts=((global.PokemonViewer||={}).fonts||={});
  fonts.registry=fonts.registry||new GameFontRegistry();
})(globalThis);
