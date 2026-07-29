import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const load=async()=>{
  const context=vm.createContext({globalThis:null,Set,Object,Number});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/battle/gba/environment.js",import.meta.url),"utf8"),context);
  return context.PokemonViewer.battle.gba.EnvironmentResolver;
};

test("Emerald battle environments follow verified map-state branches",async()=>{
  const Resolver=await load(),id=input=>Resolver.resolve(input).id;
  assert.equal(id({behavior:2,mapType:3}),0,"tall grass");
  assert.equal(id({behavior:3,mapType:3}),1,"long grass");
  assert.equal(id({behavior:6,mapType:3}),2,"deep sand");
  assert.equal(id({behavior:11,mapType:4}),8,"indoor encounter in underground map");
  assert.equal(id({behavior:19,mapType:4}),5,"surfable underground water");
  assert.equal(id({behavior:0,mapType:4}),7,"underground cave");
  assert.equal(id({behavior:0,mapType:8}),8,"indoor map");
  assert.equal(id({behavior:0,mapType:5}),3,"underwater map");
  assert.equal(id({behavior:21,mapType:6}),4,"ocean route water");
  assert.equal(id({behavior:0,mapType:6}),9,"ocean route land");
  assert.equal(id({behavior:17,mapType:3}),4,"deep water");
  assert.equal(id({behavior:80,mapType:3}),5,"surfable current");
  assert.equal(id({behavior:12,mapType:3}),6,"mountain");
  assert.equal(id({behavior:0,mapType:3,bank:0,map:28}),2,"Route 113 ash");
  assert.equal(id({behavior:0,mapType:3,weather:8}),2,"sandstorm");
  assert.equal(id({behavior:0,mapType:3}),9,"plain fallback");
});
