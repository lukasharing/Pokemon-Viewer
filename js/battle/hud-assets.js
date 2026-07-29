(function(global){
  "use strict";
  const battle=((global.PokemonViewer||={}).battle||={}),factories=new Map();

  class BattleHudRegistry{
    register(family,factory){
      if(typeof family!=="string"||!family)throw new TypeError("Battle HUD family must be a non-empty string.");
      if(typeof factory!=="function")throw new TypeError(`Battle HUD '${family}' requires a factory.`);
      factories.set(family,factory);return this;
    }
    create(reader,family){
      const factory=factories.get(family);
      if(!factory)throw new Error(`No battle HUD decoder is registered for '${family}'.`);
      return factory(reader);
    }
    has(family){return factories.has(family);}
  }

  battle.HudAssets=new BattleHudRegistry();
})(globalThis);
