import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const loadCatalog=async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/species-catalog.js",import.meta.url),"utf8"),context);
  return context.PokemonViewer.species;
};

test("Gen I species catalog preserves internal IDs, MissingNo slots, and Pokédex mapping",async()=>{
  const species=await loadCatalog(),names=0x100,order=0x1000,bytes=new Uint8Array(0x2000);
  bytes[order]=112;
  bytes[order+30]=0;
  const reader={
    memory:{contains:(offset,length=1)=>offset>=0&&offset+length<=bytes.length,u8:offset=>bytes[offset]},
    capabilities:{provenance:{symbols:{MonsterNames:{offset:names},PokedexOrder:{offset:order}}}},
    textDictionary:"gen1",getDictionary:()=>({}),
    isROMOffset:offset=>offset>=0&&offset<bytes.length,
    getTextByOffset:(_dictionary,offset)=>offset===names?"RHYDON":offset===names+300?"MISSINGNO.":`MON${offset}`
  };
  const catalog=species.forReader(reader,"gbc");
  assert.equal(catalog.count,190);
  assert.equal(catalog.get(1).name,"RHYDON");
  assert.equal(catalog.get(1).nameOffset,names);
  assert.equal(catalog.get(1).dexNumber,112);
  assert.equal(catalog.get(1).isGlitch,false);
  assert.equal(catalog.get(31).name,"MISSINGNO.");
  assert.equal(catalog.get(31).dexNumber,null);
  assert.equal(catalog.get(31).isGlitch,true);
});

test("GBA species catalog retains the species-zero-prefixed name table convention",async()=>{
  const species=await loadCatalog(),reader={
    memory:{contains:()=>true},
    capabilities:{provenance:{symbols:{}}},
    getDictionary:()=>({}),isROMOffset:()=>true,getTextByOffset:()=>"",
    type:"emerald"
  };
  const contextProfile={monsterNames:0x3000,monsterNameSize:11};
  reader.capabilities.provenance.symbols.gSpeciesNames={offset:contextProfile.monsterNames};
  // The profile adapter normally provides this object after gba-rom-assets is loaded.
  const catalog=new species.SpeciesCatalog(reader,{family:"gba",count:386,nameTable:contextProfile.monsterNames,nameWidth:11});
  assert.equal(catalog.nameOffset(1),0x3000+11);
  assert.equal(catalog.get(1).dexNumber,1);
});
