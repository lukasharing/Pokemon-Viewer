import test from "node:test";
import assert from "node:assert/strict";

await import("../js/structures/memory.js");
await import("../js/structures/gba/memory.js");
await import("../js/structures/gbc/memory.js");
await import("../js/core/utils.js");
await import("../js/core/memory-utils.js");
await import("../js/core/gba-species.js");
await import("../js/core/gba-tilemap.js");
await import("../js/map/gba/region-map.js");
await import("../js/map/gbc/region-map.js");
await import("../js/map/gen2/region-map.js");

const exact=(left,right)=>assert.deepEqual([...left],[...right]);

test("GBA Minimap paint recompresses a native tile entry and restores exact allocation bytes",()=>{
  const Driver=PokemonViewer.maps.gba.RegionMap,source=Uint8Array.from({length:0x800},(_,index)=>index&15),encoded=PokemonViewer.gba.GbaLz77.encode(source),allocation=(encoded.length+3)&~3,bytes=new Uint8Array(allocation);bytes.set(encoded);
  const driver=Object.create(Driver.prototype);Object.assign(driver,{memory:new GbaMemory(bytes),profile:{mode:"affine8",tilemap:0},tilemap:source,tilemapAllocation:allocation,renderBackground:()=>({})});
  const before=MemoryUtils.bytes(driver.memory,0,allocation),plan=driver.planCellUpdate(0,7);plan.apply();
  assert.equal(PokemonViewer.gba.GbaLz77.decode(driver.memory,0).bytes[0],7);
  plan.revert();exact(MemoryUtils.bytes(driver.memory,0,allocation),before);
});

test("Gen I Minimap drag-cell plans recompress RLE and restore exact bytes",()=>{
  const Driver=PokemonViewer.maps.gbc.RegionMap,driver=Object.create(Driver.prototype),cells=Array.from({length:360},(_,index)=>index&1),encoded=driver.encodeTilemap(cells),memory=new GbcMemory(encoded);
  Object.assign(driver,{memory,offsets:{CompressedMap:0},tilemap:cells,compressedLength:encoded.length,renderTilemap:()=>({})});
  const before=MemoryUtils.bytes(memory,0,encoded.length),plan=driver.planCellUpdate(0,2);plan.apply();assert.equal(driver.tilemap[0],2);plan.revert();exact(MemoryUtils.bytes(memory,0,encoded.length),before);
});

test("Crystal Minimap paint targets the active region and is byte-exact on Undo",()=>{
  const Driver=PokemonViewer.maps.gen2.RegionMap,driver=Object.create(Driver.prototype),memory=new GbcMemory(new Uint8Array(720));
  Object.assign(driver,{memory,activeRegion:"kanto",symbols:{JohtoMap:{offset:0},KantoMap:{offset:360}},tilemaps:{johto:Array(360).fill(0),kanto:Array(360).fill(0)},maps:{},renderMap:()=>({})});
  const plan=driver.planCellUpdate(19,12);plan.apply();assert.equal(memory.u8(379),12);plan.revert();assert.equal(memory.u8(379),0);
});
