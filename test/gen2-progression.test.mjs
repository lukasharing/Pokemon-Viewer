import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gen2/memory.js");
await import("../js/core/resource-graph.js");
await import("../js/core/rom-allocator.js");
await import("../js/core/relocatable-patch.js");
await import("../js/core/gen2-progression.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x18000),moves=0x1000,names=0x2000,machines=0x3000,evosPointers=0x4100,evos=0x5000,eggPointers=0x8100,eggs=0x9000,baseData=0xc000;
  bytes.fill(0xff,0x7000,0x8000);bytes.fill(0xff,0xb000,0xc000);
  for(let id=1;id<=251;id++){
    bytes.set([id&0xff,id%32,40,22,0xff,15,0x40],moves+(id-1)*7);
    const record=evos+(id-1)*8,address=0x4000+(record-0x4000);
    bytes[evosPointers+(id-1)*2]=address&0xff;bytes[evosPointers+(id-1)*2+1]=address>>>8;
    const target=id===251?1:id+1;
    const evolution=id===1?[1,16,target]:id===2?[2,0x08,target]:id===3?[3,0xff,target]:id===4?[4,3,target]:id===5?[5,20,1,target]:[];
    bytes.set([...evolution,0,5,Math.min(id,251),0],record);
    const eggAddress=0x4000+(eggs-0x8000);
    bytes[eggPointers+(id-1)*2]=eggAddress&0xff;bytes[eggPointers+(id-1)*2+1]=eggAddress>>>8;
    const bit=(id-1)%60,base=baseData+(id-1)*32;
    bytes[base+24+(bit>>3)]|=1<<(bit&7);
  }
  for(let index=0;index<60;index++)bytes[machines+index]=index<57?index+1:[53,85,58][index-57];
  bytes[machines+60]=0;
  bytes.set([1,2,0xff],eggs);
  const species=Array.from({length:251},(_,index)=>Object.freeze({id:index+1,name:`MON${index+1}`}));
  const catalog={get:id=>species[id-1]||null,list:()=>species};
  const symbols={
    Moves:{offset:moves},MoveNames:{offset:names},TMHMMoves:{offset:machines},
    EvosAttacksPointers:{offset:evosPointers,bank:1},EggMovePointers:{offset:eggPointers,bank:2}
  };
  const reader={
    memory:new Gen2Memory(bytes),textDictionary:"gen2",
    capabilities:{provenance:{symbols,repository:"pret/pokecrystal",id:"fixture"}},
    memoryProfile:{structure:name=>name==="Gen2Move"?{
      count:251,size:7,nameBytes:13,accuracyScale:255,
      fields:{
        animation:{byte:0,type:"u8"},effect:{byte:1,type:"u8"},power:{byte:2,type:"u8"},
        type:{byte:3,type:"u8"},accuracy:{byte:4,type:"u8"},pp:{byte:5,type:"u8"},
        effectChance:{byte:6,type:"u8"}
      },
      related:{machineCount:60,machineTerminator:0,tmCount:50,hmCount:7}
    }:null},
    getDictionary:()=>[],getTextByOffset:(_dictionary,offset)=>`MOVE${Math.floor((offset-names)/13)+1}`
  };
  const builder=new PokemonViewer.resources.ResourceGraphBuilder();
  for(const item of species)builder.addNode({id:`gen2:species:${item.id}`,label:item.name,accuracy:"verified"});
  const speciesData={
    catalog,resourceGraph:()=>builder.build(),
    base(id){const offset=baseData+(id-1)*32;return{offset,tmHm:reader.memory.slice(offset+24,8)};},
    machineIndexes(base){return Object.freeze(Array.from({length:60},(_,index)=>index+1).filter(index=>{const bit=index-1;return Boolean(base.tmHm[bit>>3]&(1<<(bit&7)));}));}
  };
  return{reader,data:new PokemonViewer.gen2.Gen2ProgressionData(reader,{speciesData})};
};

test("Crystal move records decode the exact seven-byte native structure",()=>{
  const {data}=fixture(),move=data.moves.get(1);
  assert.deepEqual(
    [move.name,move.animation,move.effect,move.power,move.type,move.accuracy,move.pp,move.effectChance],
    ["MOVE1",1,1,40,22,255,15,64]
  );
  assert.equal(move.accuracyPercent,100);
  assert.equal(data.moves.list().length,251);
  assert.equal(data.moves.machines().length,60);
  assert.deepEqual(data.moves.machines().slice(49).map(machine=>[machine.label,machine.moveId]),[
    ["TM50",50],["HM01",51],["HM02",52],["HM03",53],["HM04",54],["HM05",55],["HM06",56],["HM07",57],
    ["Tutor 1",53],["Tutor 2",85],["Tutor 3",58]
  ]);
  assert.deepEqual(Array.from(data.moves.encode(move,{power:90,accuracy:200,pp:20,effectChance:77})),[1,1,90,22,200,20,77]);
  assert.throws(()=>data.moves.encode(move,{pp:41}),/pp must be 1–40/);
  assert.throws(()=>data.moves.get(252),/1–251/);
});

test("Crystal progression decodes all five evolution methods, learnsets and shared egg lists",()=>{
  const {data}=fixture();
  assert.deepEqual(data.document(1).evolutions.map(item=>[item.name,item.level,item.targetId]),[["level",16,2]]);
  assert.deepEqual(data.document(2).evolutions.map(item=>[item.name,item.item,item.targetId]),[["item",8,3]]);
  assert.deepEqual(data.document(3).evolutions.map(item=>[item.name,item.heldItem,item.targetId]),[["trade",255,4]]);
  assert.deepEqual(data.document(4).evolutions.map(item=>[item.name,item.triggerName,item.targetId]),[["happiness","Night",5]]);
  assert.deepEqual(data.document(5).evolutions.map(item=>[item.name,item.level,item.statName,item.targetId]),[["stat",20,"Attack > Defense",6]]);
  assert.deepEqual(data.document(1).learnset.map(item=>[item.level,item.move.name]),[[5,"MOVE1"]]);
  assert.deepEqual(data.document(251).eggMoves.map(item=>item.move.name),["MOVE1","MOVE2"]);
});

test("Crystal progression graph owns moves, evolution sets, learnsets and egg moves",()=>{
  const {data}=fixture(),graph=data.resourceGraph();
  assert.equal(graph.size,1315);
  assert.equal(graph.edgeCount,1822);
  assert.equal(graph.node("gen2:move:251").label,"MOVE251");
  assert.equal(graph.edge("gen2:evolution-set:5/target-1").target,"gen2:species:6");
  assert.equal(graph.edge("gen2:learnset:1/move-1").target,"gen2:move:1");
  assert.equal(graph.edge("gen2:egg-moves:1/move-2").target,"gen2:move:2");
  assert.equal(graph.edge("gen2:machine:tutor-1/move").target,"gen2:move:53");
  assert.equal(graph.edge("gen2:species:60/machine-60").target,"gen2:machine:tutor-3");
  assert.equal(graph.validate().valid,true);
});

test("Crystal variable progression relocates inside its pointer bank and restores exactly",()=>{
  const {reader,data}=fixture(),beforePointer=reader.memory.slice(0x4100,2),beforeRecord=reader.memory.slice(0x5000,8);
  const plan=data.progressionPlan(1,{
    evolutions:[{method:"level",level:16,targetId:2},{method:"item",item:8,targetId:3}],
    learnset:[{level:1,moveId:1},{level:5,moveId:2},{level:10,moveId:3}]
  });
  assert.equal(plan.patch.relocated,true);
  assert.equal(Math.floor(plan.patch.target/Gen2Memory.BANK_SIZE),1);
  data.apply(plan);
  assert.notDeepEqual(Array.from(reader.memory.slice(0x4100,2)),Array.from(beforePointer));
  assert.deepEqual(data.document(1).learnset.map(item=>item.moveId),[1,2,3]);
  data.restore(plan);
  assert.deepEqual(Array.from(reader.memory.slice(0x4100,2)),Array.from(beforePointer));
  assert.deepEqual(Array.from(reader.memory.slice(0x5000,8)),Array.from(beforeRecord));
  assert.ok(reader.memory.slice(plan.patch.target,plan.patch.nextBytes.length).every(value=>value===plan.patch.allocationFill));
});

test("Crystal shared egg lists detach one owner instead of mutating every species",()=>{
  const {reader,data}=fixture(),firstPointer=reader.memory.slice(0x8100,2),secondPointer=reader.memory.slice(0x8102,2),shared=reader.memory.slice(0x9000,3);
  const plan=data.eggMovePlan(1,[3,4,5]);
  assert.equal(plan.shared,true);
  assert.equal(plan.owners.length,251);
  assert.equal(plan.patch.relocated,true);
  assert.equal(Math.floor(plan.patch.target/Gen2Memory.BANK_SIZE),2);
  data.apply(plan);
  assert.deepEqual(data.document(1).eggMoves.map(item=>item.moveId),[3,4,5]);
  assert.deepEqual(data.document(2).eggMoves.map(item=>item.moveId),[1,2]);
  assert.deepEqual(Array.from(reader.memory.slice(0x8102,2)),Array.from(secondPointer));
  assert.deepEqual(Array.from(reader.memory.slice(0x9000,3)),Array.from(shared));
  data.restore(plan);
  assert.deepEqual(Array.from(reader.memory.slice(0x8100,2)),Array.from(firstPointer));
  assert.deepEqual(Array.from(reader.memory.slice(0x9000,3)),Array.from(shared));
});
