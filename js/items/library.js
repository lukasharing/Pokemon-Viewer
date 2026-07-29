(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  root.items||={};
  root.items.registry=root.items.registry||new global.DriverRegistry("Items");
})(globalThis);
