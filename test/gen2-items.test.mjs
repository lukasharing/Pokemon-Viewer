import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gen2/memory.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen2-items.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x8000),attributes=0x1000,names=0x2000,pointers=0x4000,descriptions=0x5000;
  for(let id=1;id<=255;id++){
    const record=attributes+(id-1)*7,price=id*10;
    bytes.set([price&0xff,price>>>8,id&0xff,id===1?0xff:5,0x2a,id%4+1,0x65],record);
    bytes.set([id,0x50],names+(id-1)*2);
    const address=0x4000+(descriptions+id*2-0x4000);
    bytes[pointers+(id-1)*2]=address&0xff;bytes[pointers+(id-1)*2+1]=address>>>8;
    bytes.set([id,0x50],descriptions+id*2);
  }
  bytes.set([0,0x50],names+255*2);
  const symbols={
    ItemAttributes:{offset:attributes,bank:0},ItemNames:{offset:names,bank:0,extent:512},
    ItemDescriptions:{offset:pointers,bank:1}
  };
  const reader={
    memory:new Gen2Memory(bytes),textDictionary:"gen2",
    capabilities:{provenance:{symbols,repository:"pret/pokecrystal",id:"fixture"}},
    getDictionary:()=>[],
    getTextByOffset:(_dictionary,offset)=>offset>=descriptions?`Description ${bytes[offset]}`:`ITEM${Math.floor((offset-names)/2)+1}`
  };
  return{reader,data:new PokemonViewer.gen2.Gen2ItemData(reader)};
};

test("Crystal items decode native names, seven-byte attributes and banked descriptions",()=>{
  const {data}=fixture(),item=data.get(1);
  assert.equal(data.list().length,255);
  assert.deepEqual(
    [item.name,item.price,item.heldEffect,item.parameter,item.permissions,item.pocket,item.fieldMenu,item.battleMenu],
    ["ITEM1",10,1,-1,0x2a,2,5,6]
  );
  assert.equal(item.description.text,"Description 1");
  assert.equal(item.description.pointerOffset,0x4000);
  assert.equal(item.description.offset,0x5002);
  assert.equal(data.category(item),"Key items");
  assert.throws(()=>data.get(0),/1–255/);
  assert.throws(()=>data.get(256),/1–255/);
});

test("Crystal item writer preserves unknown permission bits and packs native menu nibbles",()=>{
  const {data}=fixture(),item=data.get(1);
  const next=data.encode(item,{price:1200,pocket:4,canSelect:false,canToss:false,fieldMenu:4,battleMenu:0,heldEffect:9,parameter:-7});
  assert.deepEqual(Array.from(next),[0xb0,0x04,9,0xf9,0xea,4,0x04]);
  assert.equal(next[4]&0x3f,item.permissions&0x3f);
  assert.throws(()=>data.encode(item,{pocket:0}),/pocket must be 1–4/);
  assert.throws(()=>data.encode(item,{price:65536}),/price must be 0–65535/);
});

test("Crystal item graph counts only verified fixed attribute records as writable",()=>{
  const {data}=fixture(),graph=data.resourceGraph(),coverage=graph.coverage(0x8000);
  assert.equal(graph.size,255);
  assert.equal(graph.node("gen2:item:1").label,"ITEM1");
  assert.deepEqual(graph.node("gen2:item:1").writeRanges,[{offset:0x1000,length:7}]);
  assert.equal(coverage.writableBytes,255*7);
  assert.equal(coverage.writableNodes,255);
});
