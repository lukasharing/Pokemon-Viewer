(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const Registry=global.DriverRegistry||class{
    constructor(){this.factories=new Map();}
    register(id,factory){this.factories.set(id,factory);return this;}
    create(id,context){const factory=this.factories.get(id);if(!factory)throw new Error(`Move driver '${id}' is not registered.`);return factory(context);}
  };
  root.moves||={};
  root.moves.registry=root.moves.registry||new Registry("Moves");
})(globalThis);
