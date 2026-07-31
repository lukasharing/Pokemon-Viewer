import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

await import("../js/structures/memory.js");
await import("../js/structures/gba/memory.js");
await import("../js/core/utils.js");
await import("../js/core/memory-utils.js");
await import("../js/core/resource-graph.js");
await import("../js/core/project-validator.js");
await import("../js/core/manual-knowledge-registry.js");
await import("../js/core/gba-rom-assets.js");
await import("../js/core/gba-wave-data.js");
await import("../js/core/species-catalog.js");
await import("../js/core/gba-species.js");
await import("../js/core/gba-encounters.js");
await import("../js/core/gba-trainers.js");
await import("../js/battle/gba/sprites.js");

const pointer=(bytes,offset,target)=>{
  const value=GbaMemory.ROM_BASE+target;
  bytes[offset]=value&0xff;bytes[offset+1]=value>>>8&0xff;bytes[offset+2]=value>>>16&0xff;bytes[offset+3]=value>>>24;
};
const word=(bytes,offset,value)=>{bytes[offset]=value&0xff;bytes[offset+1]=value>>>8;};
const dword=(bytes,offset,value)=>{bytes[offset]=value&0xff;bytes[offset+1]=value>>>8&0xff;bytes[offset+2]=value>>>16&0xff;bytes[offset+3]=value>>>24;};
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

test("Emerald WaveData decodes bounded signed ROM samples for Pokédex cries",()=>{
  const bytes=new Uint8Array(0x40),offset=0x10;
  dword(bytes,offset+4,13379);dword(bytes,offset+8,1);dword(bytes,offset+12,4);
  bytes.set([0,127,128,255],offset+16);
  const wave=PokemonViewer.gba.GbaWaveData.decode(new GbaMemory(bytes),offset);
  assert.equal(wave.frequency,13379);assert.equal(wave.loopStart,1);assert.equal(wave.size,4);
  assert.deepEqual(Array.from(wave.samples),[0,127/128,-1,-1/128]);
  dword(bytes,offset+12,0x100001);
  assert.equal(PokemonViewer.gba.GbaWaveData.decode(new GbaMemory(bytes),offset),null);
});

test("GBA WaveData installs after another editor freezes the family namespace",async()=>{
  const context=vm.createContext({globalThis:null,PokemonViewer:{gba:Object.freeze({ExistingDomain:true})}});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/gba-wave-data.js",import.meta.url),"utf8"),context);
  assert.equal(context.PokemonViewer.gba.ExistingDomain,true);
  assert.equal(typeof context.PokemonViewer.gba.GbaWaveData.decode,"function");
  assert.equal(Object.isFrozen(context.PokemonViewer.gba),true);
});

test("Emerald Species cry routing follows the zero-based pret tables through Chimecho",()=>{
  const profile=PokemonViewer.gba.assets.profiles.emerald;
  const bytes=new Uint8Array(profile.speciesIdToCryId+(411-277+1)*2);
  word(bytes,profile.speciesIdToCryId,273);
  word(bytes,profile.speciesIdToCryId+(411-277)*2,387);
  const memory=new GbaMemory(bytes),reader={
    type:"emerald",memory,memoryProfile:{verified:true,offset:()=>null},
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
    type:"emerald",memory,validation:new ValidationRegistry(),memoryProfile:{verified:true,offset:()=>null},
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

test("GBA battle pictures reject incomplete decoded resources before frame slicing",()=>{
  const catalog=Object.create(PokemonViewer.battle.GbaMonsterSpriteCatalog.prototype);
  catalog.profile={speciesCount:411};
  catalog.coords=()=>({width:64,height:64,yOffset:0});
  catalog.data={
    front:()=>({offset:0x100}),
    back:()=>({offset:0x200,bytes:new Uint8Array(0x800)}),
    palette:()=>({offset:0x300,bytes:new Uint8Array(32)}),
    name:()=> "TEST"
  };
  assert.throws(()=>catalog.resource(41,"front"),/front picture for Species #41 did not decode/);
  catalog.data.front=()=>({offset:0x100,bytes:new Uint8Array(0x800)});
  catalog.data.palette=()=>({offset:0x300});
  assert.throws(()=>catalog.resource(41,"front"),/palette for Species #41 did not decode/);
});

test("Generation III encounter contracts decode FireRed and Emerald without shared absolute offsets",()=>{
  for(const [type,version,label] of [["emerald",0,"Emerald"],["fire_red",1,"FireRed"]]){
    const bytes=new Uint8Array(0x500),header=0x20,info=0x100,slots=0x200;
    bytes[header]=3;bytes[header+1]=7;pointer(bytes,header+4,info);
    bytes[header+20]=0xff;bytes[header+21]=0xff;
    bytes[info]=25;pointer(bytes,info+4,slots);
    for(let index=0;index<12;index++){
      bytes[slots+index*4]=index+2;bytes[slots+index*4+1]=index+3;word(bytes,slots+index*4+2,index+1);
    }
    const memory=new GbaMemory(bytes),speciesData={
      profile:{wildMonHeaders:header,speciesCount:411},
      assertId:id=>{if(id<1||id>411)throw new RangeError("species");},
      name:id=>`Species ${id}`
    };
    const knowledge=ManualKnowledgeRegistry.get(type==="emerald"?"gen3-emerald-en":"gen3-fire_red-en");
    const memoryProfile={
      knowledgeId:knowledge.id,knowledge,
      structure:name=>knowledge.structures[name]||null
    };
    const data=new PokemonViewer.gba.GbaEncounterData({type,version,memory,memoryProfile},{speciesData});
    assert.equal(data.contract.label,label);
    assert.equal(data.contract.headerSize,20);
    assert.equal(data.contract.infoSize,8);
    assert.equal(data.contract.slotSize,4);
    assert.match(data.contract.source,/pret\/poke/);
    const [document]=data.list();
    assert.deepEqual(
      [document.id,document.method,document.rates[0].native,document.slots.length,document.slots[11].probability],
      ["gba:3:7:grass","grass",25,12,1]
    );
    const plan=data.editPlan(document,{slot:0,species:25,level:5,maxLevel:6,rate:30});
    assert.deepEqual([...plan.writes[0].after],[5,6,25,0]);
    assert.deepEqual([...plan.writes[1].after],[30]);
  }
  assert.equal(PokemonViewer.gba.GbaEncounterContract.resolve({type:"fire_red",version:1}),null);
});

test("reviewed Generation III Trainer contracts drive aligned Emerald and FireRed records",()=>{
  const bytes=new Uint8Array(0x400),table=0x100,party=0x200,profile={speciesCount:386};
  bytes[table+1]=2;bytes[table+2]=7;bytes[table+3]=53;bytes[table+32]=2;pointer(bytes,table+36,party+0x40);
  word(bytes,party+0x40,20);bytes[party+0x42]=15;bytes[party+0x43]=0xee;word(bytes,party+0x44,1);
  word(bytes,party+0x48,30);bytes[party+0x4a]=16;bytes[party+0x4b]=0xdd;word(bytes,party+0x4c,2);
  bytes[table+40]=3;bytes[table+40+32]=1;pointer(bytes,table+40+36,party);
  word(bytes,party,31);word(bytes,party+2,42);word(bytes,party+4,25);word(bytes,party+6,7);
  [1,2,3,4].forEach((move,index)=>word(bytes,party+8+index*2,move));
  const memory=new GbaMemory(bytes),makeReader=knowledgeId=>{
    const knowledge=ManualKnowledgeRegistry.get(knowledgeId);
    const symbols={
      gTrainers:{offset:table,count:2,stride:40},
      gBattleMoves:{offset:0x300,count:355,stride:12}
    };
    return{
      type:knowledgeId.includes("fire_red")?"fire_red":"emerald",
      memory,validation:new ValidationRegistry(),
      memoryProfile:{
        knowledgeId,knowledge,
        structure:name=>knowledge.structures[name]||null,
        require:name=>{
          if(!symbols[name])throw new Error(`Missing ${name}.`);
          return symbols[name];
        },
        symbol:name=>symbols[name]||null,
        schema:name=>knowledge.symbolMetadata[name]||null
      }
    };
  };
  const speciesData={profile,catalog:{get:id=>({id,name:`Species ${id}`})}},
    reader=makeReader("gen3-emerald-en"),
    data=new PokemonViewer.gba.GbaTrainerData(reader,{speciesData});
  assert.deepEqual(data.read(0).party.map(mon=>[mon.level,mon.species,mon.stride]),[[15,1,8],[16,2,8]]);
  assert.deepEqual([data.read(0).trainerClass,data.read(0).trainerClassName,data.read(0).encounterMusicGender,data.read(0).trainerPic],[2,"HIKER",7,53]);
  const trainer=data.read(1);
  assert.deepEqual([trainer.party[0].level,trainer.party[0].species,trainer.party[0].item,...trainer.party[0].moves],[42,25,7,1,2,3,4]);
  const plan=data.editPlan(trainer,0,{species:3,level:50,item:9,move1:5,move2:6,move3:7,move4:8});
  assert.deepEqual([...plan.after],[31,0,50,0,3,0,9,0,5,0,6,0,7,0,8,0]);
  assert.deepEqual(data.resolve({trainerId:1}),trainer);
  const fireRed=new PokemonViewer.gba.GbaTrainerData(makeReader("gen3-fire_red-en"),{speciesData});
  assert.equal(fireRed.contract.id,"gen3-fire_red-en-trainers");
  assert.equal(fireRed.read(0).trainerClassName,"Trainer class 2");
  assert.equal(fireRed.read(1).party[0].moves[3],4);
  const builder=new PokemonViewer.resources.ResourceGraphBuilder();
  for(let id=1;id<=profile.speciesCount;id++)builder.addNode({
    id:`gba:species:${id}`,label:`Species ${id}`,accuracy:"verified"
  });
  const graph=data.resourceGraph(builder.build()),coverage=graph.coverage(bytes.length);
  assert.equal(graph.has("gba:trainer:1"),true);
  assert.equal(graph.has("gba:party-member:1-1"),true);
  assert.equal(graph.edge("gba:party-member:1-1/species").target,"gba:species:25");
  assert.equal(coverage.writableBytes,19,"level, species, item and four move fields are the only writable party bytes");
  word(bytes,party+2,101);
  const provider=reader.validation.entries().find(([id])=>id==="gba-trainers")[1];
  assert.throws(()=>provider(),/invalid level 101/);
  assert.equal(PokemonViewer.gba.GbaTrainerContract.resolve({type:"emerald"}),null);
  const knowledge=ManualKnowledgeRegistry.get("gen3-emerald-en");
  assert.equal(PokemonViewer.gba.GbaTrainerContract.resolve({
    memoryProfile:{
      structure:name=>knowledge.structures[name]||null,
      symbol:()=>null
    }
  }),null,"a relocated hack without gTrainers disables only the trainer subdomain");
  assert.throws(
    ()=>new PokemonViewer.gba.GbaTrainerData({type:"emerald",memory},{speciesData}),
    /No reviewed Generation III Trainer contract/
  );
});
