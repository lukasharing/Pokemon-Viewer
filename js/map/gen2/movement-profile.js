(function(global){
  "use strict";
  const maps=(global.PokemonViewer ||= {}).maps ||= {},profiles=maps.movementProfiles ||= {};
  const initial=Object.freeze({4:"north",5:"west",6:"south",7:"north",8:"west",9:"east"}),walking=new Set([2,4,5,0x24]),turning=new Set([3,0x0a,0x1e,0x1f]);
  profiles.gen2=Object.freeze({
    direction:({movement})=>initial[movement]||"south",
    behavior:({movement})=>({walking:walking.has(movement),turning:turning.has(movement)}),
    frame:(facing)=>({index:({south:0,north:1,west:2,east:2})[facing]??0,flipX:facing==="east",duration:4})
  });
})(globalThis);
