(function(global){
  "use strict";
  const maps=(global.PokemonViewer ||= {}).maps ||= {},profiles=maps.movementProfiles ||= {};
  const initial=["south","south","south","north","south","west","east","north","south","west","east","south","south","south","west","north","north","south","south","south","south","north","south","south","south","north","south","west","east","north","east","south","west","north","west","south","east","west","north","east","south","east","north","west","south","north","south","west","east","north","south","west","east","north","south","west","east","south","south","north","west","east","south","south","north","west","east","south","north","west","east","south","north","west","east","south","south","north","west","east"];
  const walking=new Set([2,3,4,5,6,0x19,0x1a,0x1b,0x1c,0x35,0x36,0x37,0x38,0x40,0x41,0x42,0x43]),turning=new Set([1,0x17,0x18]);
  profiles.gba=Object.freeze({
    direction:({movement})=>initial[movement]||"south",
    behavior:({movement})=>({walking:walking.has(movement),turning:turning.has(movement)}),
    frame:(facing,walkingNow=false,tick=0)=>{
      const standing={south:0,north:1,west:2,east:2},walk={south:[3,0,4,0],north:[5,1,6,1],west:[7,2,8,2],east:[7,2,8,2]};
      if(!walkingNow)return{index:standing[facing]??0,flipX:facing==="east",duration:16};
      const duration=8,sequence=walk[facing]||walk.south;return{index:sequence[Math.floor(tick/duration)%sequence.length],flipX:facing==="east",duration};
    }
  });
})(globalThis);
