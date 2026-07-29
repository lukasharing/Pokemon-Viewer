(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  root.encounters||={};
  root.encounters.registry=root.encounters.registry||new DriverRegistry("Encounters");
})(globalThis);
