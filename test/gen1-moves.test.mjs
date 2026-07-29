import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/core/rom-allocator.js");
await import("../js/core/relocatable-patch.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/text.js");
await import("../js/core/resource-graph.js");
await import("../js/core/project-validator.js");
await import("../js/core/gen1-moves.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x10000),pointers=0x100,moves=0x1000,names=0x2000,machines=0x3000,effects=0x3100,sounds=0x3200,animations=0x3400;
  bytes.fill(0xff,0x4000,0x8000);
  let cursor=0x4000,nameCursor=names;
  const moveNames=new Map();
  for(let id=1;id<=190;id++){
    bytes[pointers+(id-1)*2]=cursor&0xff;bytes[pointers+(id-1)*2+1]=cursor>>8;
    const record=id===1
      ?[1,16,2,2,0x0a,1,3,3,1,4,0,7,1,10,2,0]
      :[0,0];
    bytes.set(record,cursor);cursor+=record.length;
  }
  for(let id=1;id<=165;id++){
    bytes.set([id,0,1,0x00,0xff,1],moves+(id-1)*6);
    bytes.set([id,0,0x80],sounds+(id-1)*3);
    bytes[animations+(id-1)*2]=0x00;bytes[animations+(id-1)*2+1]=0x50;
    const encodedLength=id%5+2;
    moveNames.set(nameCursor,`MOVE${id}`);
    bytes.fill(0x80,nameCursor,nameCursor+encodedLength);
    nameCursor+=encodedLength;bytes[nameCursor++]=0x50;
  }
  bytes.fill(1,machines,machines+55);
  for(let id=1;id<=86;id++){bytes[effects+(id-1)*2]=0x00;bytes[effects+(id-1)*2+1]=0x50;}
  bytes.set([1,2,40,0x00,0xff,35],moves);
  bytes.set([2,3,50,0x14,0x80,20],moves+6);
  const speciesList=Object.freeze(Array.from({length:190},(_,index)=>Object.freeze({
    id:index+1,internalId:index+1,dexNumber:index<151?index+1:null,name:`MON${index+1}`
  })));
  const catalog={get:id=>speciesList[id-1]||null,list:()=>speciesList};
  const baseBuilder=new PokemonViewer.resources.ResourceGraphBuilder();
  for(let id=1;id<=151;id++)baseBuilder.addNode({id:`gen1:species:${id}`,label:`MON${id}`});
  const speciesData={
    catalog,speciesByDex:id=>speciesList[id-1]||null,resourceGraph:()=>baseBuilder.build(),
    baseStats:species=>({offset:0x6000+(species.dexNumber-1)*28,tmHm:Object.freeze([species.dexNumber===1?1:0,0,0,0,0,0,0])}),
    machineIndexes:base=>base.tmHm[0]&1?[1]:[]
  };
  const symbols={
    Moves:{offset:moves},MoveNames:{offset:names},TechnicalMachines:{offset:machines},
    MoveEffectPointerTable:{offset:effects,bank:1},MoveSoundTable:{offset:sounds},
    AttackAnimationPointers:{offset:animations,bank:1},
    EvosMovesPointerTable:{offset:pointers,bank:1},HealEffect_:{offset:cursor}
  };
  const reader={
    memory:new GbcMemory(bytes),capabilities:{provenance:{symbols}},
    validation:new ValidationRegistry(),
    textDictionary:"test",getDictionary:()=>({}),
    getTextByOffset:(_dictionary,offset)=>moveNames.get(offset)||""
  };
  const moveData=new PokemonViewer.gen1.Gen1MoveData(reader);
  return{reader,speciesData,moveData,progression:new PokemonViewer.gen1.Gen1ProgressionData(reader,{speciesData,moveData})};
};

test("Gen I move records decode names, battle fields and native accuracy",()=>{
  const {moveData}=fixture(),move=moveData.get(1);
  assert.deepEqual(
    [move.name,move.animation,move.effect,move.power,move.type,move.accuracy,move.accuracyPercent,move.pp],
    ["MOVE1",1,2,40,0,255,100,35]
  );
  assert.equal(moveData.list().length,165);
  assert.equal(moveData.typeName(0x14),"Fire");
  assert.equal(move.effectDocument.label,"Poison Side Effect");
  assert.deepEqual([move.sound.sfxId,move.sound.pitch,move.sound.tempo],[1,0,0x80]);
  assert.equal(move.animationDocument.offset,0x5000);
  assert.equal(move.machines.length,55);
  assert.deepEqual(Array.from(moveData.encode(move,{power:90,accuracy:200,pp:15})),[1,2,90,0,200,15]);
  assert.throws(()=>moveData.encode(move,{pp:41}),/1 to 40/);
  assert.throws(()=>moveData.get(166),/1–165/);
});

test("Gen I progression decodes level, item and trade evolutions plus level-up moves",()=>{
  const {progression}=fixture(),document=progression.document(1);
  assert.deepEqual(document.evolutions.map(item=>item.name),["level","item","trade"]);
  assert.deepEqual(
    [document.evolutions[0].minimumLevel,document.evolutions[0].target.name,document.evolutions[1].itemName,document.evolutions[2].target.name],
    [16,"MON2","Moon Stone","MON4"]
  );
  assert.deepEqual(document.learnset.map(item=>[item.level,item.move.name]),[[7,"MOVE1"],[10,"MOVE2"]]);
});

test("Gen I progression graph links Species to evolution targets and named Move resources",()=>{
  const {progression}=fixture(),graph=progression.resourceGraph();
  assert.equal(graph.node("gen1:move:1").label,"MOVE1");
  assert.equal(graph.edge("gen1:evolution-set:1/target-1").target,"gen1:species:2");
  assert.equal(graph.edge("gen1:learnset:1/move-2").target,"gen1:move:2");
  assert.equal(graph.inbound("gen1:move:1").filter(edge=>graph.node(edge.source).type==="learnset").length,1);
  assert.equal(graph.inbound("gen1:move:1").filter(edge=>graph.node(edge.source).type==="machine").length,55);
  assert.equal(graph.edge("gen1:move:1/effect").target,"gen1:move-effect:2");
  assert.equal(graph.edge("gen1:move:1/animation").target,"gen1:move-animation:1");
  assert.equal(graph.node("gen1:move-sound:1").data.tempo,0x80);
  assert.equal(graph.edge("gen1:species:1/machine-tm01").target,"gen1:machine:tm01");
  assert.equal(graph.edge("gen1:species:1/machine-tm01").data.bit,0);
  assert.equal(graph.validate().valid,true);
});

test("Gen I progression rejects unknown methods and malformed learnset IDs",()=>{
  const {progression,reader}=fixture(),offset=progression.pointer(2).offset;
  reader.memory.bytes[offset]=4;
  assert.throws(()=>progression.document(2),/unknown evolution method/);
  reader.memory.bytes[offset]=0;reader.memory.bytes[offset+1]=7;reader.memory.bytes[offset+2]=166;
  assert.throws(()=>progression.document(2),/1–165/);
});

test("Gen I progression grows through a same-bank reversible relocation",()=>{
  const {progression,reader}=fixture(),current=progression.document(1);
  const beforePointer=reader.memory.slice(current.pointerOffset,2),beforeRecord=reader.memory.slice(current.offset,current.length);
  const plan=progression.progressionPlan(1,{
    evolutions:[
      {method:"level",minimumLevel:16,targetId:2},
      {method:"item",item:0x20,minimumLevel:1,targetId:3},
      {method:"trade",minimumLevel:1,targetId:4}
    ],
    learnset:Array.from({length:8},(_,index)=>({level:index+1,moveId:index+1}))
  });
  assert.equal(plan.patch.relocated,true);
  assert.equal(Math.floor(plan.patch.target/GbcMemory.BANK_SIZE),1);
  progression.apply(plan);
  assert.notDeepEqual(Array.from(reader.memory.slice(current.pointerOffset,2)),Array.from(beforePointer));
  assert.deepEqual(progression.document(1).learnset.map(item=>item.moveId),[1,2,3,4,5,6,7,8]);
  progression.restore(plan);
  assert.deepEqual(Array.from(reader.memory.slice(current.pointerOffset,2)),Array.from(beforePointer));
  assert.deepEqual(Array.from(reader.memory.slice(current.offset,current.length)),Array.from(beforeRecord));
  assert.ok(reader.memory.slice(plan.patch.target,plan.patch.nextBytes.length).every(value=>value===0xff));
});

test("Gen I shared progression detaches one internal owner before editing",()=>{
  const {progression,reader}=fixture(),first=progression.pointer(1),second=progression.pointer(2);
  reader.memory.bytes[second.pointerOffset]=first.address&0xff;
  reader.memory.bytes[second.pointerOffset+1]=first.address>>8;
  progression.invalidate();
  const sharedBefore=reader.memory.slice(first.offset,progression.document(1).length);
  const plan=progression.progressionPlan(1,{evolutions:[],learnset:[{level:5,moveId:5}]});
  assert.equal(plan.shared,true);assert.deepEqual(plan.owners,[1,2]);assert.equal(plan.patch.relocated,true);
  progression.apply(plan);
  assert.deepEqual(progression.document(1).learnset.map(item=>item.moveId),[5]);
  assert.deepEqual(progression.document(2).learnset.map(item=>item.moveId),[1,2]);
  assert.deepEqual(Array.from(reader.memory.slice(first.offset,sharedBefore.length)),Array.from(sharedBefore));
  progression.restore(plan);
  assert.equal(progression.pointer(1).offset,first.offset);
  assert.deepEqual(Array.from(reader.memory.slice(first.offset,sharedBefore.length)),Array.from(sharedBefore));
});

test("Gen I progression fails closed when the stock bank cannot grow",()=>{
  const {progression,reader}=fixture(),bankEnd=2*GbcMemory.BANK_SIZE;
  reader.memory.bytes.fill(0,reader.capabilities.provenance.symbols.HealEffect_.offset,bankEnd);
  assert.throws(()=>progression.progressionPlan(1,{
    evolutions:progression.document(1).evolutions.map(item=>({method:item.name,minimumLevel:item.minimumLevel,item:item.item,targetId:item.targetId})),
    learnset:[...progression.document(1).learnset.map(item=>({level:item.level,moveId:item.moveId})),{level:100,moveId:1}]
  }),/future linker.rebuild workflow/);
});

test("Gen I move and progression caches can be invalidated after an exact fixed-record edit",()=>{
  const {moveData,progression,reader}=fixture();
  const before=moveData.get(1);
  moveData.list();
  progression.document(1);
  reader.memory.bytes[before.offset+2]=99;
  assert.equal(moveData.get(1).power,99,"direct reads must reflect memory");
  assert.equal(moveData.list()[0].power,40,"the list is intentionally cached until an edit commits");
  progression.invalidate();
  assert.equal(moveData.list()[0].power,99);
  assert.equal(progression.document(1).learnset[0].move.power,99);
});

test("Gen I domain validation discards editor caches and rejects invalid live move bytes",()=>{
  const {moveData,reader}=fixture();
  const cached=moveData.list()[0];
  assert.equal(reader.validation.entries().some(([id])=>id==="gen1-moves"),true);
  reader.memory.bytes[cached.offset+5]=0;
  const provider=reader.validation.entries().find(([id])=>id==="gen1-moves")[1];
  assert.throws(()=>provider(),/invalid PP 0/);
});
