(function(global){
  "use strict";
  const maps=(global.PokemonViewer ||= {}).maps ||= {},profiles=maps.movementProfiles ||= {};
  const fixed=Object.freeze({0xd0:"south",0xd1:"north",0xd2:"west",0xd3:"east"});
  profiles.gbc=Object.freeze({
    direction:({movement,packed})=>movement===0xff?(fixed[packed]||"south"):"south",
    behavior:({movement})=>({walking:movement===0xfe,turning:false}),
    frame:(facing)=>({index:({south:0,north:1,west:2,east:2})[facing]??0,flipX:facing==="east",duration:4})
  });
})(globalThis);
