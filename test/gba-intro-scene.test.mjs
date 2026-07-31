import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url),romUrl=new URL("../roms/Pokemon - Emerald Version (USA, Europe).gba",import.meta.url);
const source=path=>readFile(new URL(path,root),"utf8");

test("Emerald intro scene resolves the complete native legend declaration block",async t=>{
  let rom;
  try{rom=new Uint8Array(await readFile(romUrl));}catch{t.skip("Exact Emerald ROM fixture is not present.");return;}
  const manifest=JSON.parse(await source("manifests/generated/gen3-emerald.json")),context=vm.createContext({
    console,Uint8Array,Uint8ClampedArray,DataView,Map,Set,Object,Array,Number,String,Math,Error,TypeError,RangeError,globalThis:null
  });
  context.globalThis=context;context.PokemonViewer={animation:{GBA_ANIMATION_TIMING:{refreshHz:59.7275}}};
  for(const path of ["js/structures/memory.js","js/core/memory-utils.js","js/core/gba-species.js","js/animation/gba/scenes.js"])
    vm.runInContext(await source(path),context,{filename:path});
  const reader={
    memory:new context.RomMemory(rom),
    memoryProfile:{require(name){const symbol=manifest.symbols[name];if(!symbol)throw new Error(`Missing ${name}`);return symbol;}}
  };
  const assets=new context.PokemonViewer.animation.GbaIntroAssetLocator(reader).locate();
  assert.equal(assets.groudonGfx.bytes.length,0x4000);
  assert.equal(assets.groudonMap.bytes.length,0x2000);
  assert.equal(assets.kyogreGfx.bytes.length,0x4000);
  assert.equal(assets.cloudsLeftMap.bytes.length,0x1000);
  assert.equal(assets.rayquazaMap.bytes.length,0x800);
  assert.equal(assets.rayquazaCloudMap.bytes.length,0x800);
  assert.equal(assets.palette.length,0x200);
});
