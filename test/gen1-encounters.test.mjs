import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/structures/memory-reader.js");
await import("../js/core/memory-utils.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/map.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen1-encounters.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x10000),pointerOffset=0x1000,chancesOffset=0x2000;
  const nothingAddress=0x5000,grassAddress=0x5100,waterAddress=0x5200;
  for(let mapId=0;mapId<0xf8;mapId++)bytes.set([nothingAddress&0xff,nothingAddress>>>8],pointerOffset+mapId*2);
  bytes.set([grassAddress&0xff,grassAddress>>>8],pointerOffset+12*2);
  bytes.set([grassAddress&0xff,grassAddress>>>8],pointerOffset+13*2);
  bytes.set([waterAddress&0xff,waterAddress>>>8],pointerOffset+14*2);
  const memory=new GbcMemory(bytes),nothing=memory.banked(3,nothingAddress),grass=memory.banked(3,grassAddress),water=memory.banked(3,waterAddress);
  bytes.set([0,0],nothing);
  bytes[grass]=25;
  for(let slot=0;slot<10;slot++)bytes.set([slot+2,slot+1],grass+1+slot*2);
  bytes[grass+21]=0;
  bytes[water]=0;bytes[water+1]=5;
  for(let slot=0;slot<10;slot++)bytes.set([slot+12,slot+11],water+2+slot*2);
  let cumulative=0;
  PokemonViewer.gen1.Gen1EncounterData.SLOT_WEIGHTS.forEach((weight,slot)=>{
    cumulative+=weight;bytes.set([cumulative-1,slot*2],chancesOffset+slot*2);
  });
  const oldRod=0x3000,goodRod=0x3020,superRod=memory.banked(3,0x5300),route12=0x4000,route16=0x4100,mapPointers=0x500,mapBanks=0x800;
  bytes.set([0x01,20,5],oldRod+6);
  bytes.set([10,21,10,22],goodRod);
  const groups=Array.from({length:4},(_,group)=>{
    const address=0x5400+group*0x10,offset=memory.banked(3,address),count=group+1;bytes[offset]=count;
    for(let slot=0;slot<count;slot++)bytes.set([15+group,30+group*4+slot],offset+1+slot*2);
    return{address,offset};
  });
  for(let mapId=0;mapId<33;mapId++){
    const group=groups[mapId%groups.length],entry=superRod+mapId*3;
    bytes.set([mapId,group.address&0xff,group.address>>>8],entry);
  }
  bytes[superRod+33*3]=0xff;
  for(const script of [route12,route16])bytes.set([0x3e,40,0xea,0,0,0x3e,30,0xea,0],script+22);
  const species=Array.from({length:190},(_,index)=>Object.freeze({id:index+1,dexNumber:index+1,name:`MON${index+1}`}));
  const builder=new PokemonViewer.resources.ResourceGraphBuilder();
  species.forEach(identity=>builder.addNode({id:`gen1:species:${identity.dexNumber}`,label:identity.name,accuracy:"verified"}));
  const speciesData={catalog:{get:id=>species[id-1]||null},resourceGraph:()=>builder.build()};
  const reader={memory,capabilities:{provenance:{symbols:{
    WildDataPointers:{offset:pointerOffset,bank:3},WildMonEncounterSlotChances:{offset:chancesOffset,bank:4},
    ItemUseOldRod:{offset:oldRod,bank:3},GoodRodMons:{offset:goodRod,bank:3},SuperRodData:{offset:superRod,bank:3},
    Route12DefaultScript:{offset:route12,bank:22},Route16DefaultScript:{offset:route16,bank:22},
    MapHeaderPointers:{offset:mapPointers,bank:0},MapHeaderBanks:{offset:mapBanks,bank:3}
  }}}};
  return{reader,data:new PokemonViewer.gen1.Gen1EncounterData(reader,{speciesData})};
};

test("Gen I encounters decode exact grass/water records and 256-based weights",()=>{
  const {data}=fixture(),documents=data.list();
  assert.equal(documents.length,40);
  assert.deepEqual(documents.slice(0,3).map(document=>document.id),["map-12-grass","map-13-grass","map-14-water"]);
  assert.deepEqual(documents[0].slots.map(slot=>slot.probabilityWeight),[51,51,39,25,25,25,13,13,11,3]);
  assert.equal(documents[0].rates[0].native,25);
  assert.equal(documents[2].rates[0].native,5);
  assert.deepEqual(data.owners(documents[0]).map(owner=>owner.mapId),[12,13]);
  assert.deepEqual(data.find("fishing-old").slots.map(slot=>[slot.species,slot.level]),[[20,5]]);
  assert.equal(data.find("fishing-super-0").slots.length,1);
  assert.equal(data.find("fishing-super-3").slots.length,4);
  assert.equal(data.list().filter(document=>document.method==="static").length,2);
});

test("Gen I encounter edits preserve record width and restore exact bytes",()=>{
  const {reader,data}=fixture(),document=data.find("map-12-grass");
  const plan=data.editPlan(document,{slot:9,level:42,species:44,rate:33});
  assert.deepEqual(plan.writes.map(write=>write.offset),[document.offset,document.slots[9].levelOffset,document.slots[9].speciesOffset]);
  for(const write of plan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  data.invalidate();
  assert.deepEqual({rate:data.find(document.id).rates[0].native,level:data.find(document.id).slots[9].level,species:data.find(document.id).slots[9].species},{rate:33,level:42,species:44});
  assert.equal(data.find("map-13-grass").slots[9].species,44);
  for(const write of [...plan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
  data.invalidate();assert.equal(data.find(document.id).slots[9].species,10);

  const fishing=data.find("fishing-super-3"),fishPlan=data.editPlan(fishing,{slot:3,level:25,species:50});
  assert.equal(fishPlan.writes.length,2);
  const staticEncounter=data.find("static-route-12-snorlax"),staticPlan=data.editPlan(staticEncounter,{slot:0,level:35,species:41});
  assert.deepEqual(staticPlan.writes.map(write=>write.offset),[staticEncounter.slots[0].levelOffset,staticEncounter.slots[0].speciesOffset]);
});

test("Gen I encounter graph links shared map owners and canonical Species",()=>{
  const {data}=fixture(),graph=data.resourceGraph();
  assert.equal(graph.size,379);
  assert.equal(graph.edgeCount,512);
  assert.equal(graph.edge("gen1:encounter-slot:map-12-grass-0/species").target,"gen1:species:1");
  assert.equal(graph.edge("gen1:encounter-table:map-12-grass/map-13").target,"gen1:map:13");
  assert.equal(graph.validate().valid,true);
});
