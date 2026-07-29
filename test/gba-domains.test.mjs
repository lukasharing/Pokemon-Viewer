import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/structures/gba/memory.js");
await import("../js/core/utils.js");
await import("../js/core/memory-utils.js");
await import("../js/core/project-validator.js");
await import("../js/core/gba-rom-assets.js");
await import("../js/core/species-catalog.js");
await import("../js/core/gba-species.js");
await import("../js/core/gba-trainers.js");

const pointer=(bytes,offset,target)=>{
  const value=GbaMemory.ROM_BASE+target;
  bytes[offset]=value&0xff;bytes[offset+1]=value>>>8&0xff;bytes[offset+2]=value>>>16&0xff;bytes[offset+3]=value>>>24;
};
const word=(bytes,offset,value)=>{bytes[offset]=value&0xff;bytes[offset+1]=value>>>8;};
const literalLz=source=>{
  const result=[0x10,source.length&0xff,source.length>>>8&0xff,source.length>>>16&0xff];
  for(let offset=0;offset<source.length;offset+=8){result.push(0);result.push(...source.slice(offset,offset+8));}
  return Uint8Array.from(result);
};

test("GBA LZ77 validation rejects escaped back-references and returns exact output",()=>{
  const source=Uint8Array.from({length:32},(_,index)=>index),encoded=literalLz(source),memory=new GbaMemory(encoded);
  assert.deepEqual(PokemonViewer.gba.GbaLz77.decode(memory,0).bytes,source);
  const invalid=new GbaMemory(Uint8Array.of(0x10,3,0,0,0x80,0,0));
  assert.throws(()=>PokemonViewer.gba.GbaLz77.decode(invalid,0),/back-reference escapes output/);
});

test("Emerald Species cry routing follows the zero-based pret tables through Chimecho",()=>{
  const profile=PokemonViewer.gba.assets.profiles.emerald;
  const bytes=new Uint8Array(profile.speciesIdToCryId+(411-277+1)*2);
  word(bytes,profile.speciesIdToCryId,273);
  word(bytes,profile.speciesIdToCryId+(411-277)*2,387);
  const memory=new GbaMemory(bytes),reader={
    type:"emerald",memory,capabilities:{provenance:{symbols:{}}},
    getDictionary:()=>({}),getTextByOffset:()=>"",isROMOffset:offset=>memory.contains(offset)
  };
  const data=new PokemonViewer.gba.GbaSpeciesData(reader);
  assert.deepEqual(
    [data.cryId(1),data.cryId(251),data.cryId(252),data.cryId(276),data.cryId(277),data.cryId(411)],
    [0,250,200,200,273,387]
  );
});

test("audited Emerald Species validation re-decodes Pokédex, names, front sprites, and palettes",()=>{
  const bytes=new Uint8Array(0x590000),profile=PokemonViewer.gba.assets.profiles.emerald;
  const frontOffset=0x580000,paletteOffset=0x581000,descriptionOffset=0x582000;
  bytes.set(literalLz(new Uint8Array(0x800)),frontOffset);
  bytes.set(literalLz(new Uint8Array(32)),paletteOffset);
  bytes[descriptionOffset]=0xff;
  for(let id=1;id<=profile.speciesCount;id++){
    const name=profile.monsterNames+id*profile.monsterNameSize;
    bytes[name]=0xbb;bytes[name+1]=0xff;
    const graphic=profile.monsterPics+id*8;pointer(bytes,graphic,frontOffset);word(bytes,graphic+4,0x800);word(bytes,graphic+6,id);
    const palette=profile.monsterPalettes+id*8;pointer(bytes,palette,paletteOffset);word(bytes,palette+4,32);word(bytes,palette+6,id);
  }
  for(let dex=1;dex<=profile.pokedexCount;dex++){
    const entry=profile.pokedexEntries+dex*profile.pokedexEntrySize;
    bytes[entry]=0xbb;bytes[entry+1]=0xff;word(bytes,entry+12,dex);word(bytes,entry+14,dex*10);pointer(bytes,entry+16,descriptionOffset);
  }
  const memory=new GbaMemory(bytes),reader={
    type:"emerald",memory,validation:new ValidationRegistry(),capabilities:{provenance:{symbols:{}}},
    getDictionary:()=>({}),getTextByOffset:(_dictionary,offset)=>offset===descriptionOffset?"First[b]Second":"",isROMOffset:offset=>memory.contains(offset)
  };
  const data=new PokemonViewer.gba.GbaSpeciesData(reader),provider=reader.validation.entries().find(([id])=>id==="gba-species")[1];
  assert.deepEqual(provider(),[]);
  assert.equal(data.entry(1).offset,profile.pokedexEntries+profile.pokedexEntrySize);
  assert.deepEqual([data.entry(1).height,data.entry(1).weight,data.entry(277).dexNumber],[1,10,252]);
  assert.equal(data.entry(1).description,"First\nSecond");
  assert.equal(data.pokedexSpecies().length,386);
  assert.equal(data.list().length,411);
  assert.equal(data.document(252).dexNumber,null);
  assert.match(data.document(252).description,/internal species slot/i);
  bytes[profile.pokedexEntries+profile.pokedexEntrySize+1]=0;
  bytes[profile.pokedexEntries+profile.pokedexEntrySize]=0;
  assert.throws(()=>provider(),/Pokédex category is not terminated/);
  assert.equal(data.front(25).bytes.length,0x800);
});

test("audited Emerald Trainer validation uses agbcc-aligned records and all four party flags",()=>{
  const bytes=new Uint8Array(0x400),table=0x100,party=0x200,profile={trainers:table,trainerCount:2,speciesCount:386};
  bytes[table+1]=2;bytes[table+2]=7;bytes[table+3]=53;bytes[table+32]=2;pointer(bytes,table+36,party+0x40);
  word(bytes,party+0x40,20);bytes[party+0x42]=15;bytes[party+0x43]=0xee;word(bytes,party+0x44,1);
  word(bytes,party+0x48,30);bytes[party+0x4a]=16;bytes[party+0x4b]=0xdd;word(bytes,party+0x4c,2);
  bytes[table+40]=3;bytes[table+40+32]=1;pointer(bytes,table+40+36,party);
  word(bytes,party,31);word(bytes,party+2,42);word(bytes,party+4,25);word(bytes,party+6,7);
  [1,2,3,4].forEach((move,index)=>word(bytes,party+8+index*2,move));
  const memory=new GbaMemory(bytes),reader={type:"emerald",memory,validation:new ValidationRegistry()};
  const speciesData={profile,catalog:{get:id=>({id,name:`Species ${id}`})}},data=new PokemonViewer.gba.GbaTrainerData(reader,{speciesData});
  assert.deepEqual(data.read(0).party.map(mon=>[mon.level,mon.species,mon.stride]),[[15,1,8],[16,2,8]]);
  assert.deepEqual([data.read(0).trainerClass,data.read(0).trainerClassName,data.read(0).encounterMusicGender,data.read(0).trainerPic],[2,"HIKER",7,53]);
  const trainer=data.read(1);
  assert.deepEqual([trainer.party[0].level,trainer.party[0].species,trainer.party[0].item,...trainer.party[0].moves],[42,25,7,1,2,3,4]);
  const plan=data.editPlan(trainer,0,{species:3,level:50,item:9,move1:5,move2:6,move3:7,move4:8});
  assert.deepEqual([...plan.after],[31,0,50,0,3,0,9,0,5,0,6,0,7,0,8,0]);
  assert.deepEqual(data.resolve({trainerId:1}),trainer);
  word(bytes,party+2,101);
  const provider=reader.validation.entries().find(([id])=>id==="gba-trainers")[1];
  assert.throws(()=>provider(),/invalid level 101/);
});
