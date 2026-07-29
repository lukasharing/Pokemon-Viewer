import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gen2/memory.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen2-encounters.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x9000),symbols={},species=Array.from({length:251},(_,index)=>Object.freeze({id:index+1,name:`MON${index+1}`}));
  let offset=0x4100,speciesId=1;
  const definitions=[
    ["JohtoGrassWildMons","grass",47],
    ["JohtoWaterWildMons","water",9],
    ["KantoGrassWildMons","grass",47],
    ["KantoWaterWildMons","water",9]
  ];
  for(const [name,method,stride] of definitions){
    symbols[name]={offset};bytes[offset]=name.startsWith("Johto")?1:2;bytes[offset+1]=method==="grass"?1:2;
    if(method==="grass"){
      bytes.set([5,10,15],offset+2);
      for(let index=0;index<21;index++){bytes[offset+5+index*2]=index%100+1;bytes[offset+6+index*2]=speciesId++;}
    }else{
      bytes[offset+2]=20;
      for(let index=0;index<3;index++){bytes[offset+3+index*2]=10+index;bytes[offset+4+index*2]=speciesId++;}
    }
    offset+=stride;bytes[offset++]=0xff;
  }
  const fishGroups=0x6000,timeFishGroups=0x7000;symbols.FishGroups={offset:fishGroups,bank:1};symbols.TimeFishGroups={offset:timeFishGroups,bank:1};
  for(let index=0;index<22;index++)bytes.set([1+index,20,2+index,25],timeFishGroups+index*4);
  let fishCursor=0x6100;
  for(let group=0;group<13;group++){
    const header=fishGroups+group*7;bytes[header]=128;
    for(let rod=0;rod<3;rod++){
      const count=rod===0?3:4;bytes[header+1+rod*2]=fishCursor&0xff;bytes[header+2+rod*2]=fishCursor>>>8;
      for(let slot=0;slot<count;slot++){
        bytes[fishCursor+slot*3]=(rod===0?[179,217,255]:rod===1?[89,178,230,255]:[102,178,230,255])[slot];
        if(rod===1&&slot===count-1)bytes.set([0,0],fishCursor+slot*3+1);
        else bytes.set([speciesId++,10+rod*10],fishCursor+slot*3+1);
      }
      fishCursor+=count*3;
    }
  }
  const treeMons=0x7400,treeMonMaps=0x7800,rockMonMaps=0x7810,contestMons=0x7900;
  Object.assign(symbols,{
    TreeMons:{offset:treeMons,bank:1},TreeMonMaps:{offset:treeMonMaps,bank:1},RockMonMaps:{offset:rockMonMaps,bank:1},
    ContestMons:{offset:contestMons,bank:1},NationalParkBugContest_MapAttributes:{offset:0x7a00,bank:1}
  });
  let treeCursor=0x7500;
  bytes[treeMons]=treeCursor&0xff;bytes[treeMons+1]=treeCursor>>>8;
  for(let set=1;set<=6;set++){
    bytes[treeMons+set*2]=treeCursor&0xff;bytes[treeMons+set*2+1]=treeCursor>>>8;
    for(let variant=0;variant<2;variant++){
      [50,15,15,10,5,5].forEach((probability,slot)=>{
        bytes.set([probability,(speciesId++-1)%251+1,10+set],treeCursor+slot*3);
      });
      treeCursor+=18;bytes[treeCursor++]=0xff;
    }
  }
  bytes[treeMons+14]=treeCursor&0xff;bytes[treeMons+15]=treeCursor>>>8;
  bytes.set([90,20,15,10,21,15,0xff],treeCursor);
  bytes.set([1,1,1,0xff],treeMonMaps);
  bytes.set([1,2,7,0xff],rockMonMaps);
  [20,20,10,10,5,5,10,10,5,0xff].forEach((probability,index)=>{
    bytes.set([probability,30+index,7+index,18+index],contestMons+index*4);
  });
  const initRoamMons=0x7b00,roamMaps=0x7c00;
  symbols.InitRoamMons={offset:initRoamMons,bank:1};symbols.RoamMaps={offset:roamMaps,bank:1};
  bytes.set([
    0x3e,243,0xea,0xcf,0xdf,0x3e,244,0xea,0xd6,0xdf,0x3e,40,0xea,0xd0,0xdf,0xea,0xd7,0xdf,
    0x3e,1,0xea,0xd1,0xdf,0x3e,1,0xea,0xd2,0xdf,0x3e,1,0xea,0xd8,0xdf,0x3e,2,0xea,0xd9,0xdf,
    0xaf,0xea,0xd3,0xdf,0xea,0xda,0xdf,0xc9
  ],initRoamMons);
  let roamCursor=roamMaps;
  for(let map=1;map<=16;map++){bytes.set([1,map,1,1,map===16?1:map+1,0],roamCursor);roamCursor+=6;}
  bytes[roamCursor]=0xff;
  PokemonViewer.gen2.Gen2EncounterData.STATIC_ENCOUNTERS.forEach((definition,index)=>{
    const scriptOffset=0x8000+index*0x80;
    symbols[definition.symbol]={offset:scriptOffset,bank:2};
    symbols[definition.mapSymbol]||={offset:0x8f00+index,bank:2};
    bytes.set([0x5d,index+1,index+10],scriptOffset+definition.relative);
  });
  const builder=new PokemonViewer.resources.ResourceGraphBuilder();
  for(const identity of species)builder.addNode({id:`gen2:species:${identity.id}`,label:identity.name,accuracy:"verified"});
  const speciesData={catalog:{get:id=>species[id-1]||null},resourceGraph:()=>builder.build()};
  const reader={memory:new Gen2Memory(bytes),capabilities:{provenance:{symbols}}};
  return{reader,data:new PokemonViewer.gen2.Gen2EncounterData(reader,{speciesData})};
};

test("Crystal encounters preserve grass time tables and water fixed slots",()=>{
  const {data}=fixture(),documents=data.list();
  assert.equal(documents.length,75);
  assert.deepEqual(documents.slice(0,4).map(item=>item.method),["grass","water","grass","water"]);
  assert.equal(documents[0].slots.length,21);
  assert.deepEqual(documents[0].rates.map(item=>item.native),[5,10,15]);
  assert.deepEqual(documents[0].slots.slice(0,7).map(item=>item.probability),[30,30,20,10,5,4,1]);
  assert.equal(documents[1].slots.length,3);
  assert.deepEqual(documents[1].slots.map(item=>item.probability),[60,30,10]);
  const fishing=documents[4];
  assert.equal(fishing.method,"fishing");
  assert.deepEqual(fishing.slots.filter(slot=>slot.time==="day").map(slot=>slot.probability),[70,15,15]);
  const timed=documents[5].slots.find(slot=>slot.time==="night"&&slot.timeGroup===0);
  assert.deepEqual({species:timed.species,level:timed.level,speciesOffset:timed.speciesOffset,levelOffset:timed.levelOffset},{species:2,level:25,speciesOffset:0x7002,levelOffset:0x7003});
  const headbutt=data.find("headbutt-1-rare"),contest=data.find("bug-catching-contest");
  assert.equal(headbutt.slots.length,6);
  assert.deepEqual(headbutt.slots.map(slot=>slot.probability),[50,15,15,10,5,5]);
  assert.deepEqual(contest.slots.at(-1),expectSlot(contest.slots.at(-1),{probability:5,maxLevel:27}));
  const roamers=data.find("roamers");
  assert.deepEqual(roamers.slots.map(slot=>[slot.species,slot.level,slot.mapGroup,slot.mapNumber]),[[243,40,1,1],[244,40,1,2]]);
  assert.equal(roamers.routes.length,16);
  const staticEncounter=data.find("static-red-gyarados");
  assert.deepEqual({method:staticEncounter.method,opcode:data.memory.u8(staticEncounter.offset),species:staticEncounter.slots[0].species,level:staticEncounter.slots[0].level},{method:"static",opcode:0x5d,species:1,level:10});
});

test("Crystal encounter edits change only one native rate and one fixed slot",()=>{
  const {reader,data}=fixture(),document=data.list()[0];
  const plan=data.editPlan(document,{time:"night",slot:6,rate:25,level:50,species:25});
  assert.equal(plan.writes.length,3);
  assert.deepEqual(Array.from(plan.writes[0].after),[25]);
  assert.deepEqual(plan.writes.slice(1).map(write=>Array.from(write.after)),[[50],[25]]);
  for(const write of plan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  data.invalidate();
  const edited=data.find(document.id);
  assert.equal(edited.rates[2].native,25);
  assert.deepEqual(edited.slots.at(-1),expectSlot(edited.slots.at(-1),{level:50,species:25,speciesName:"MON25"}));
  for(const write of [...plan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
  data.invalidate();assert.equal(data.find(document.id).slots.at(-1).level,21);

  const fishing=data.find("fishing-1-good"),fishSlot=fishing.slots.find(slot=>slot.time==="night"&&slot.timeGroup===0);
  const fishPlan=data.editPlan(fishing,{time:"night",slot:fishSlot.slot,rate:140,level:33,species:44});
  assert.deepEqual(fishPlan.writes.map(write=>write.offset),[fishing.headerOffset,0x7003,0x7002]);
  for(const write of fishPlan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  data.invalidate();
  assert.deepEqual(data.find(fishing.id).slots.find(slot=>slot.time==="night"&&slot.timeGroup===0),expectSlot(data.find(fishing.id).slots.find(slot=>slot.time==="night"&&slot.timeGroup===0),{level:33,species:44,speciesName:"MON44"}));
  for(const write of [...fishPlan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);

  const contest=data.find("bug-catching-contest"),contestPlan=data.editPlan(contest,{slot:9,level:20,maxLevel:30,species:50});
  assert.deepEqual(contestPlan.writes.map(write=>write.offset),[contest.slots[9].levelOffset,contest.slots[9].speciesOffset,contest.slots[9].maxLevelOffset]);
  for(const write of contestPlan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  data.invalidate();assert.deepEqual({level:data.find(contest.id).slots[9].level,maxLevel:data.find(contest.id).slots[9].maxLevel,species:data.find(contest.id).slots[9].species},{level:20,maxLevel:30,species:50});
  for(const write of [...contestPlan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);

  const staticEncounter=data.find("static-red-gyarados"),staticPlan=data.editPlan(staticEncounter,{slot:0,level:25,species:26});
  assert.deepEqual(staticPlan.writes.map(write=>write.offset),[staticEncounter.offset+2,staticEncounter.offset+1]);
  for(const write of staticPlan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  data.invalidate();assert.deepEqual({species:data.find(staticEncounter.id).slots[0].species,level:data.find(staticEncounter.id).slots[0].level},{species:26,level:25});
  for(const write of [...staticPlan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
});

test("Crystal encounter graph links map, slots and exact Species",()=>{
  const {data}=fixture(),graph=data.resourceGraph();
  assert.equal(graph.size,767);
  assert.equal(graph.edgeCount,878);
  assert.equal(graph.edge("gen2:encounter-slot:johto-grass-1-1-0/species").target,"gen2:species:1");
  assert.equal(graph.edge("gen2:encounter-slot:fishing-1-good-7/species").range.offset,0x7002);
  assert.equal(graph.validate().valid,true);
});

function expectSlot(actual,changes){return Object.freeze({...actual,...changes});}
