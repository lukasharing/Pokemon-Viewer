import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/text.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen1-trainers.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x80000),pointers=0x100,names=0x200,metadata=0x500,ai=0x700;
  let cursor=0x4000,nameCursor=names;
  const trainerNames=new Map();
  for(let classId=1;classId<=47;classId++){
    const address=cursor;
    bytes[pointers+(classId-1)*2]=address&0xff;bytes[pointers+(classId-1)*2+1]=address>>8;
    if(classId%2){
      bytes.set([12,1,2,0],cursor);cursor+=4;
    }else{
      bytes.set([0xff,10,1,20,2,0],cursor);cursor+=6;
    }
    const info=metadata+(classId-1)*5;
    bytes.set([0x00,0x40,0x00,0x15,0x00],info);
    bytes.set([3,0x00,0x40],ai+(classId-1)*3);
    const encodedLength=classId%3+2;
    trainerNames.set(nameCursor,`CLASS${classId}`);
    bytes.fill(0x80,nameCursor,nameCursor+encodedLength);
    nameCursor+=encodedLength;bytes[nameCursor++]=0x50;
  }
  const symbols={
    TrainerDataPointers:{offset:pointers,bank:1},TrainerNames:{offset:names},
    TrainerPicAndMoneyPointers:{offset:metadata},TrainerAI:{offset:cursor},
    TrainerAIPointers:{offset:ai}
  };
  const catalog={get:id=>id>=1&&id<=190?Object.freeze({id,name:`MON${id}`,dexNumber:id<=151?id:null}):null};
  const baseBuilder=new PokemonViewer.resources.ResourceGraphBuilder();
  baseBuilder.addNode({id:"gen1:species:1",label:"MON1"});
  baseBuilder.addNode({id:"gen1:species:2",label:"MON2"});
  const speciesData={catalog,resourceGraph:()=>baseBuilder.build()};
  const reader={
    memory:new GbcMemory(bytes),capabilities:{provenance:{symbols}},
    textDictionary:"test",getDictionary:()=>({}),
    getTextByOffset:(_dictionary,offset)=>trainerNames.get(offset)||""
  };
  return{data:new PokemonViewer.gen1.Gen1TrainerData(reader,{speciesData}),reader};
};

test("Gen I trainer documents decode shared-level and per-member-level party variants",()=>{
  const {data}=fixture(),trainers=data.trainers();
  assert.equal(data.classes().length,47);
  assert.equal(trainers.length,47);
  assert.deepEqual(
    [trainers[0].name,trainers[0].format,trainers[0].sharedLevel,trainers[0].party[1].speciesName],
    ["CLASS1 1","shared-level",12,"MON2"]
  );
  assert.deepEqual(
    [trainers[1].format,trainers[1].sharedLevel,trainers[1].party[0].level,trainers[1].party[1].level],
    ["variable-levels",null,10,20]
  );
  assert.equal(data.classes()[0].basePrize,1500);
  assert.equal(data.classes()[0].aiUses,3);
  assert.equal(data.resolve({trainerClass:201,trainerNumber:1}).classId,1);
  assert.equal(data.resolve({classId:2,number:1}).classId,2);
});

test("Gen I trainer resource graph links class, trainer, party members and canonical species",()=>{
  const {data}=fixture(),graph=data.resourceGraph();
  assert.equal(graph.node("gen1:trainer-class:1").label,"CLASS1");
  assert.equal(graph.node("gen1:trainer:1-1").data.format,"shared-level");
  assert.equal(graph.inbound("gen1:species:1").length,47);
  assert.equal(graph.edge("gen1:party-member:1-1-1/species").rewritePolicy,"rewrite-id");
  assert.equal(graph.validate().valid,true);
});

test("Gen I trainer graph completes canonical species when opened from a manifest graph",()=>{
  const {data}=fixture(),manifest=new PokemonViewer.resources.ResourceGraphBuilder();
  manifest.addNode({id:"gen1:manifest-symbol:TrainerDataPointers",label:"Trainer manifest symbol"});
  const graph=data.resourceGraph(manifest.build());
  assert.ok(graph.has("gen1:manifest-symbol:TrainerDataPointers"));
  assert.ok(graph.has("gen1:species:1"));
  assert.equal(graph.edge("gen1:party-member:1-1-1/species").target,"gen1:species:1");
  assert.equal(graph.validate().valid,true);
});

test("Gen I trainer edit plans preserve the native shared and variable level semantics",()=>{
  const {data}=fixture();
  const shared=data.editPatches({classId:1,number:1},1,{species:1,level:25});
  assert.equal(shared.patches.length,2);
  assert.deepEqual(Array.from(shared.patches[0].expected),[12]);
  assert.deepEqual(Array.from(shared.patches[0].next),[25]);
  assert.deepEqual(Array.from(shared.patches[1].next),[1]);
  const variable=data.editPatches({classId:2,number:1},1,{species:1,level:30});
  assert.equal(variable.patches.length,1);
  assert.deepEqual(Array.from(variable.patches[0].expected),[20,2]);
  assert.deepEqual(Array.from(variable.patches[0].next),[30,1]);
});

test("Gen I trainer parser rejects malformed levels, species and unterminated parties",()=>{
  const {data,reader}=fixture(),trainerClass=data.classDocument(1);
  reader.memory.bytes[trainerClass.offset]=0;
  assert.throws(()=>data.readParty(trainerClass,1,trainerClass.offset,trainerClass.end),/invalid shared level/);
  reader.memory.bytes[trainerClass.offset]=12;reader.memory.bytes[trainerClass.offset+1]=191;
  assert.throws(()=>data.readParty(trainerClass,1,trainerClass.offset,trainerClass.end),/invalid internal species/);
  reader.memory.bytes.fill(1,trainerClass.offset,trainerClass.end);
  assert.throws(()=>data.readParty(trainerClass,1,trainerClass.offset,trainerClass.end),/not terminated|six-Pokémon/);
});
