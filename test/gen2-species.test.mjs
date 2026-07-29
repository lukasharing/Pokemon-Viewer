import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/core/gsc-lz.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gen2/memory.js");
await import("../js/core/species-catalog.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen2-species.js");

const fixture=()=>{
  const bytes=new Uint8Array(0x19000),table=0x4100,bankTable=0x4050,entries=0x4400,picPointers=0x8000,palettes=0x9000,picBanks=0xa000,base=0x10000,names=0x13000,picture=0x14000,cries=0x15000;
  bytes.set([1,1,1,1],bankTable);
  bytes.set(Array.from({length:24},(_,index)=>5+index),picBanks);
  bytes.set([0xef,0x0f,0xff],picture);
  for(let id=1;id<=251;id++){
    const entry=entries+(id-1)*8,address=0x4000+(entry-0x4000);
    bytes[table+(id-1)*2]=address&0xff;bytes[table+(id-1)*2+1]=address>>>8;
    bytes.set([0x80,0x50,0x04,0x02,0x96,0,0x81,0x50],entry);
    const stats=base+(id-1)*32;
    bytes.set([id,45,49,49,45,65,65,22,3,45,64,0,0,31,100,20,5,0x77,0x34,0x12,0x78,0x56,3,0x12],stats);
    const cry=cries+(id-1)*6;
    bytes.set([id&0xff,0,0x34,0x12,0x78,0x56],cry);
    bytes.set([0xcf,0x00,0x40,0xcf,0x00,0x40],picPointers+(id-1)*6);
    bytes.set([0x1f,0x00,0xe0,0x03,0,0,0,0],palettes+id*8);
  }
  const symbols={
    BaseData:{offset:base},PokemonNames:{offset:names},
    PokedexDataPointerTable:{offset:table,bank:1},"GetDexEntryPointer.PokedexEntryBanks":{offset:bankTable},
    PokemonPalettes:{offset:palettes},PokemonPicPointers:{offset:picPointers},UnownPicPointers:{offset:picPointers},"FixPicBank.PicsBanks":{offset:picBanks},PokemonCries:{offset:cries}
  };
  const dictionary=[];dictionary[0x80]="SEED";dictionary[0x81]="DESCRIPTION";
  const reader={
    memory:new Gen2Memory(bytes),size:bytes.length,textDictionary:"gen2",
    capabilities:{provenance:{symbols,repository:"pret/pokecrystal",id:"fixture"}},
    getDictionary:()=>dictionary,isROMOffset:offset=>offset>=0&&offset<bytes.length,
    getTextByOffset:(_dictionary,offset)=>`MON${Math.floor((offset-names)/10)+1}`
  };
  return{reader,data:new PokemonViewer.gen2.Gen2SpeciesData(reader)};
};

test("Crystal Species joins exact names, BaseData, Pokédex pointers and PokemonCries",()=>{
  const {data}=fixture(),document=data.document(1);
  assert.equal(document.name,"MON1");
  assert.equal(document.category,"SEED");
  assert.equal(document.description,"DESCRIPTION");
  assert.equal(document.height,0x0204);
  assert.equal(document.weight,150);
  assert.deepEqual([document.base.hp,document.base.specialAttack,document.base.specialDefense],[45,65,65]);
  assert.deepEqual([document.base.dexNumber,document.base.unknown1,document.base.hatchCycles,document.base.unknown2,document.base.frontDimensions],[1,100,20,5,0x77]);
  assert.deepEqual(Array.from(document.base.unusedPicturePointers),[0x34,0x12,0x78,0x56]);
  assert.deepEqual([document.base.growthRate,document.base.eggGroups,document.base.tmHm.length],[3,0x12,8]);
  assert.equal(data.typeName(22),"Grass");
  assert.equal(data.growthName(3),"Medium Slow");
  assert.equal(data.eggGroupName(2),"Water 1");
  assert.deepEqual([document.cry.baseCry,document.cry.pitch,document.cry.length],[1,0x1234,0x5678]);
  assert.equal(data.document(251).name,"MON251");
  const sprite=data.frontSprite(1),palette=data.palette(1);
  assert.deepEqual([sprite.pointer.bank,sprite.width,sprite.height,sprite.frameBytes,sprite.consumed],[5,7,7,784,3]);
  assert.equal(sprite.bytes.length,784);
  assert.deepEqual(palette.colors,["#ffffff","#ff0000","#00ff00","#000000"]);
});

test("Crystal fixed Pokédex and cry writers preserve exact native widths",()=>{
  assert.deepEqual(Array.from(PokemonViewer.gen2.Gen2SpeciesData.encodeMeasurements({height:0x1234,weight:0x5678})),[0x34,0x12,0x78,0x56]);
  assert.deepEqual(Array.from(PokemonViewer.gen2.Gen2SpeciesData.encodeCry({baseCry:7,pitch:0x1234,length:0x5678})),[7,0,0x34,0x12,0x78,0x56]);
  assert.throws(()=>PokemonViewer.gen2.Gen2SpeciesData.encodeMeasurements({height:-1,weight:0}),/unsigned word/);
  assert.throws(()=>PokemonViewer.gen2.Gen2SpeciesData.encodeCry({baseCry:0,pitch:65536,length:0}),/unsigned words/);
  const {data}=fixture(),plan=data.cryEditPlan(1,{baseCry:2,pitch:3,length:4});
  assert.deepEqual(Array.from(plan.before),[1,0,0x34,0x12,0x78,0x56]);
  assert.deepEqual(Array.from(plan.after),[2,0,3,0,4,0]);
});

test("Crystal BaseData writer changes selected semantic bytes and preserves opaque/pointer/TM data",()=>{
  const {data}=fixture(),plan=data.baseEditPlan(1,{hp:99,specialAttack:88,hatchCycles:15,growthRate:4,eggGroup1:7,eggGroup2:8});
  assert.equal(plan.after.length,32);
  assert.deepEqual([plan.after[1],plan.after[5],plan.after[15],plan.after[22],plan.after[23]],[99,88,15,4,0x78]);
  assert.equal(plan.after[14],plan.before[14]);
  assert.deepEqual(Array.from(plan.after.slice(16,22)),Array.from(plan.before.slice(16,22)));
  assert.deepEqual(Array.from(plan.after.slice(24)),Array.from(plan.before.slice(24)));
  assert.throws(()=>data.baseEditPlan(1,{hp:256}),/unsigned byte/);
  assert.throws(()=>data.baseEditPlan(1,{eggGroup1:16,eggGroup2:0}),/0–15/);
});

test("Crystal machine compatibility edits exactly 60 flags and preserves the unused high nibble",()=>{
  const {data}=fixture(),base=data.base(1);
  base.tmHm[7]=0xa0;
  const encoded=data.encodeMachines(base,[1,8,57,58,59,60]);
  assert.deepEqual(data.machineIndexes({...base,tmHm:encoded}),[1,8,57,58,59,60]);
  assert.equal(encoded[7]&0xf0,0xa0);
  assert.throws(()=>data.encodeMachines(base,[61]),/1–60/);
});

test("Crystal resource graph gives every Species exact Pokédex, base, text and cry ownership",()=>{
  const {data}=fixture(),graph=data.resourceGraph();
  assert.equal(graph.size,1757);
  assert.equal(graph.edgeCount,2008);
  assert.equal(graph.node("gen2:species:1").label,"MON1");
  assert.equal(graph.node("gen2:cry:251").ranges[0].length,6);
  assert.equal(graph.edge("gen2:species:1/pokedexEntry").kind,"banked-pointer");
  assert.equal(graph.node("gen2:front-sprite:1").ranges[1].length,3);
  assert.equal(graph.node("gen2:palette:1").ranges[0].length,8);
  assert.equal(graph.validate().valid,true);
});
