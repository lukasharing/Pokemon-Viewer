import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/core/utils.js");
await import("../js/core/memory-utils.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/text.js");
await import("../js/core/species-catalog.js");
await import("../js/core/resource-graph.js");
await import("../js/core/gen1-species.js");

const write16=(bytes,offset,value)=>{bytes[offset]=value&0xff;bytes[offset+1]=value>>8&0xff;};

test("Gen I picture codec matches the reference pkmncompress zero-tile vector",()=>{
  const memory=new GbcMemory(Uint8Array.from([0x11,0xbc,0x13,0xc1]));
  const picture=PokemonViewer.gen1.Gen1PicCodec.decode(memory,0);
  assert.equal(picture.width,1);
  assert.equal(picture.height,1);
  assert.equal(picture.consumed,4);
  assert.deepEqual(Array.from(picture.bytes),Array(16).fill(0));
  assert.throws(
    ()=>PokemonViewer.gen1.Gen1PicCodec.decode(new GbcMemory(Uint8Array.from([0x12,0xff])),0),
    /must be square/
  );
});

test("Gen I Pokédex measurements preserve native feet, inches, and little-endian tenths of a pound",()=>{
  const bytes=PokemonViewer.gen1.Gen1SpeciesData.encodeMeasurements({feet:5,inches:11,weight:0x1234});
  assert.deepEqual(Array.from(bytes),[5,11,0x34,0x12]);
  assert.throws(()=>PokemonViewer.gen1.Gen1SpeciesData.encodeMeasurements({feet:1,inches:12,weight:100}),/inches/);
  assert.throws(()=>PokemonViewer.gen1.Gen1SpeciesData.encodeMeasurements({feet:1,inches:2,weight:65536}),/Weight/);
});

test("Gen I Base Stats writer changes only verified semantic fields",()=>{
  const before=Uint8Array.from([
    1,45,49,49,45,65,0x16,0x03,45,64,0x55,0x00,0x43,0x00,0x44,
    33,45,0,0,3,0xaa,0xbb,0xcc,0xdd,0xee,0xff,0x80,0x5a
  ]);
  const after=PokemonViewer.gen1.Gen1SpeciesData.encodeBase(before,{
    hp:46,attack:50,defense:51,speed:52,special:53,
    type1:0x15,type2:0x18,catchRate:44,baseExperience:65,
    move1:1,move2:2,move3:3,move4:0,growthRate:5
  });
  assert.deepEqual(Array.from(after.slice(1,10)),[46,50,51,52,53,0x15,0x18,44,65]);
  assert.deepEqual(Array.from(after.slice(15,20)),[1,2,3,0,5]);
  assert.deepEqual(Array.from(after.slice(10,15)),Array.from(before.slice(10,15)));
  assert.deepEqual(Array.from(after.slice(20)),Array.from(before.slice(20)));
  assert.throws(()=>PokemonViewer.gen1.Gen1SpeciesData.encodeBase(before,{hp:1,attack:1,defense:1,speed:1,special:1,type1:6,type2:0,catchRate:1,baseExperience:1,move1:0,move2:0,move3:0,move4:0,growthRate:0}),/valid Red.Blue type/);
  assert.throws(()=>PokemonViewer.gen1.Gen1SpeciesData.encodeBase(before,{hp:1,attack:1,defense:1,speed:1,special:1,type1:0,type2:0,catchRate:1,baseExperience:1,move1:166,move2:0,move3:0,move4:0,growthRate:0}),/1–165/);
});

test("Gen I species data joins internal identity, base stats, dex entry, cry and compressed front/back pictures",()=>{
  const bytes=new Uint8Array(0x30000);
  const symbols={
    MonsterNames:{offset:0x1000},PokedexOrder:{offset:0x2000},
    BaseStats:{offset:0x8000},MewBaseStats:{offset:0x9000},
    PokedexEntryPointers:{offset:0x4000,bank:1},CryData:{offset:0xa000}
  };
  bytes[0x2000]=1;
  const base=0x8000;
  bytes.set([
    1,45,49,49,45,65,0x16,0x03,45,64,0x11,
    0x00,0x43,0x00,0x44,33,45,0,0,3
  ],base);
  bytes.set([0x01,0,0,0,0,0,0x80],base+20);
  write16(bytes,0x4000,0x4100);
  bytes.set([0x01,0x50,2,4,150,0,0x17,0x00,0x42,1,0x50],0x4100);
  bytes.set([
    0x80,0x7f,0xb2,0xb3,0xb1,0xa0,0xad,0xa6,0xa4,0x7f,0xb2,0xa4,0xa4,0xa3,0x7f,
    0xb6,0xa0,0xb2,0x7f,0xaf,0xab,0xa0,0xad,0xb3,0xa4,0xa3,0x7f,0xae,0xad,0x7f,
    0xa8,0xb3,0xb2,0x7f,0xa1,0xa0,0xa2,0xaa,0x7f,0xa0,0xb3,0x7f,0xa1,0xa8,0xb1,
    0xb3,0xa7,0xe8,0x5f
  ],0x4200);
  bytes.set([0x11,0xbc,0x13,0xc1],0x24300);
  bytes.set([0x44,0x3f,0xc0,0x13,0xfc,0x01],0x24400);
  bytes.set([0x0f,0x20,0x80],0xa000);

  const reader={
    memory:new GbcMemory(bytes),
    capabilities:{provenance:{symbols}},
    textDictionary:"gen1",
    getDictionary:()=>({}),
    isROMOffset:offset=>offset>=0&&offset<bytes.length,
    getTextByOffset:(_dictionary,offset)=>{
      if(offset===0x1000)return "BULBASAUR";
      if(offset===0x4100)return "SEED";
      if(offset===0x4200)return "A strange seed was planted on its back at birth.";
      return "";
    }
  };
  const data=new PokemonViewer.gen1.Gen1SpeciesData(reader),document=data.document(1);
  assert.equal(document.name,"BULBASAUR");
  assert.equal(document.internalId,1);
  assert.equal(document.category,"SEED");
  assert.equal(document.feet,2);
  assert.equal(document.inches,4);
  assert.equal(document.weight,150);
  assert.equal(document.descriptionOffset,0x4200);
  assert.equal(document.base.hp,45);
  assert.equal(document.base.type1,0x16);
  assert.equal(data.typeName(document.base.type1),"Grass");
  assert.deepEqual(data.machineIndexes(document.base),[1]);
  assert.equal(data.machineCompatible(document.base,1),true);
  assert.equal(data.machineCompatible(document.base,2),false);
  assert.deepEqual(Array.from(data.encodeMachines(document.base,[2,55])),[2,0,0,0,0,0,0xc0]);
  assert.throws(()=>data.encodeMachines(document.base,[56]),/1–55/);
  assert.equal(document.cry.baseCry,0x0f);
  const cryPlan=data.cryEditPlan(document.species,{baseCry:0x11,pitch:0x22,length:0x33});
  assert.equal(cryPlan.offset,symbols.CryData.offset);
  assert.deepEqual(Array.from(cryPlan.before),[0x0f,0x20,0x80]);
  assert.deepEqual(Array.from(cryPlan.after),[0x11,0x22,0x33]);
  const basePlan=data.baseEditPlan(document.species,{
    hp:46,attack:49,defense:49,speed:45,special:65,type1:0x16,type2:0x03,
    catchRate:45,baseExperience:64,move1:33,move2:45,move3:0,move4:0,growthRate:3
  });
  assert.equal(basePlan.offset,base);
  assert.equal(basePlan.after[1],46);
  assert.deepEqual(Array.from(basePlan.after.slice(10)),Array.from(basePlan.before.slice(10)));
  const picture=data.frontSprite(document.species,document.base);
  assert.equal(picture.offset,0x24300);
  assert.deepEqual(Array.from(picture.bytes),Array(16).fill(0));
  const backPicture=data.backSprite(document.species,document.base);
  assert.equal(backPicture.offset,0x24400);
  assert.deepEqual([backPicture.width,backPicture.height,backPicture.nativeScale],[4,4,2]);
  assert.equal(backPicture.bytes.length,256);
  const graph=data.resourceGraph({dexNumbers:[1]});
  assert.equal(graph.node("gen1:species:1").label,"BULBASAUR");
  assert.equal(graph.node("gen1:base-stats:1").ranges[0].offset,base);
  assert.equal(graph.node("gen1:front-sprite:1").ranges[0].length,4);
  assert.equal(graph.node("gen1:back-sprite:1").ranges[0].length,6);
  assert.equal(graph.outbound("gen1:species:1").length,5);
  assert.equal(graph.inbound("gen1:species:1").length,4);
  assert.equal(graph.edge("gen1:pokedex-entry:1/description").kind,"banked-pointer");
  assert.equal(graph.validate().valid,true);
});

test("Gen I cry writer accepts only exact unsigned-byte parameters",()=>{
  assert.deepEqual(Array.from(PokemonViewer.gen1.Gen1SpeciesData.encodeCry({baseCry:0x11,pitch:0x22,length:0x33})),[0x11,0x22,0x33]);
  assert.throws(()=>PokemonViewer.gen1.Gen1SpeciesData.encodeCry({baseCry:256,pitch:0,length:0}),/unsigned byte/);
  assert.throws(()=>PokemonViewer.gen1.Gen1SpeciesData.encodeCry({baseCry:0,pitch:-1,length:0}),/unsigned byte/);
});

test("Gen I Mew base data stays on its source-manifest special record",()=>{
  const bytes=new Uint8Array(0x24000),symbols={
    MonsterNames:{offset:0x1000},PokedexOrder:{offset:0x2000},
    BaseStats:{offset:0x8000},MewBaseStats:{offset:0x9000},
    PokedexEntryPointers:{offset:0x4000,bank:1},CryData:{offset:0xa000}
  };
  bytes[0x2000+0x15-1]=151;bytes[0x9000]=151;bytes[0x9001]=100;
  const reader={
    memory:new GbcMemory(bytes),capabilities:{provenance:{symbols}},textDictionary:"gen1",
    getDictionary:()=>({}),isROMOffset:()=>true,getTextByOffset:(_dictionary,offset)=>offset===0x1000+(0x15-1)*10?"MEW":""
  };
  const data=new PokemonViewer.gen1.Gen1SpeciesData(reader),species=data.speciesByDex(151);
  assert.equal(species.internalId,0x15);
  assert.equal(data.baseStats(species).offset,0x9000);
  assert.equal(data.baseStats(species).hp,100);
});
