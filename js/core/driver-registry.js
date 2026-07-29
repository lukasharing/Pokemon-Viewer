(function(global){
  "use strict";
  class DriverRegistry{
    constructor(name="driver"){this.name=name;this.factories=new Map();}
    register(id,factory){if(typeof factory!=="function")throw new TypeError(`${this.name} driver factory must be a function.`);this.factories.set(id,factory);return this;}
    create(id,context){const factory=this.factories.get(id);if(!factory)throw new Error(`${this.name} driver '${id}' is not registered.`);return factory(context);}
    supports(id){return this.factories.has(id);}
  }
  global.DriverRegistry=DriverRegistry;((global.PokemonViewer||={}).core||={}).DriverRegistry=DriverRegistry;
})(globalThis);
