import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gen2/memory.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen2-trainers.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x9000),groups=0x4100,names=0x1000,pictures=0x2000;
  const species=Array.from({length:251},(_,index)=>Object.freeze({id:index+1,name:`MON${index+1}`}));
  const catalog={get:id=>species[id-1]||null,list:()=>species};
  let cursor=0x5000;
  for(let id=1;id<=67;id++){
    const address=0x4000+(cursor-0x4000);
    bytes[groups+(id-1)*2]=address&0xff;bytes[groups+(id-1)*2+1]=address>>>8;
    bytes[pictures+(id-1)*3]=1;bytes[pictures+(id-1)*3+1]=0;bytes[pictures+(id-1)*3+2]=0x40;
    const type=id<=4?id-1:0,record=[0x80,0x50,type,10+id,id];
    if(type===2||type===3)record.push(7);
    if(type===1||type===3)record.push(1,2,3,4);
    record.push(0xff);bytes.set(record,cursor);cursor+=record.length;
  }
  const symbols={TrainerGroups:{offset:groups,bank:1},TrainerClassNames:{offset:names},TrainerPicPointers:{offset:pictures}};
  const reader={memory:new Gen2Memory(bytes),textDictionary:"gen2",capabilities:{provenance:{symbols,repository:"pret/pokecrystal",id:"fixture"}}};
  const builder=new PokemonViewer.resources.ResourceGraphBuilder();
  for(const item of species)builder.addNode({id:`gen2:species:${item.id}`,label:item.name,accuracy:"verified"});
  for(let id=1;id<=251;id++)builder.addNode({id:`gen2:move:${id}`,label:`MOVE${id}`,accuracy:"verified"});
  const speciesData={catalog,decode:offset=>offset>=names&&offset<names+67*13?`CLASS${Math.floor((offset-names)/13)+1}`:`TRAINER${offset}`,resourceGraph:()=>builder.build()};
  const moveData={get:id=>Object.freeze({id,name:`MOVE${id}`})};
  return{reader,data:new PokemonViewer.gen2.Gen2TrainerData(reader,{speciesData,moveData}),baseGraph:builder.build()};
};

test("Crystal trainers decode all four native party formats",()=>{
  const {data}=fixture(),trainers=data.trainers();
  assert.equal(data.classes().length,67);
  assert.equal(trainers.length,66);
  assert.deepEqual(trainers.slice(0,4).map(trainer=>trainer.format),["normal","moves","item","item-moves"]);
  assert.deepEqual(trainers[3].party[0].moveIds,[1,2,3,4]);
  assert.deepEqual(trainers[3].party[0].moves,["MOVE1","MOVE2","MOVE3","MOVE4"]);
  assert.equal(trainers[3].party[0].item,7);
  assert.equal(data.resolve({trainerClass:4,trainerNumber:1}).id,"4:1");
});

test("Crystal trainer edits preserve the existing format width",()=>{
  const {reader,data}=fixture(),plan=data.editPlan({classId:4,number:1},0,{species:25,level:42,item:9,move1:5,move2:6,move3:7,move4:8});
  assert.deepEqual(Array.from(plan.after),[42,25,9,5,6,7,8]);
  assert.equal(plan.after.length,plan.before.length);
  MemoryUtils.replace(reader.memory,plan.offset,plan.before,plan.after);
  data.invalidate();
  assert.deepEqual(data.resolve({classId:4,number:1}).party[0].moveIds,[5,6,7,8]);
  MemoryUtils.replace(reader.memory,plan.offset,plan.after,plan.before);
  data.invalidate();
  assert.deepEqual(data.resolve({classId:4,number:1}).party[0].moveIds,[1,2,3,4]);
});

test("Crystal trainer graph links classes, parties, Species and explicit moves",()=>{
  const {data,baseGraph}=fixture(),graph=data.resourceGraph(baseGraph);
  assert.equal(graph.size,701);
  assert.equal(graph.edgeCount,206);
  assert.equal(graph.edge("gen2:party-member:4-1-1/species").target,"gen2:species:4");
  assert.equal(graph.edge("gen2:party-member:4-1-1/move-4").target,"gen2:move:4");
  assert.equal(graph.validate().valid,true);
});
