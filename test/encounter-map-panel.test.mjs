import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function loadPanel(){
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/encounters/map-panel.js",import.meta.url),"utf8"),context);
  return context.EncounterMapPanel;
}

test("encounter map panel matches Gen I map identifiers exactly",async()=>{
  const Panel=await loadPanel();
  assert.equal(Panel.matches({mapId:1},{mapId:1}),true);
  assert.equal(Panel.matches({mapId:1},{mapId:2}),false);
  assert.equal(Panel.matches({mapId:1},{bank:1,map:1}),false);
});

test("encounter map panel matches Gen II group and map pairs exactly",async()=>{
  const Panel=await loadPanel();
  assert.equal(Panel.matches({group:4,map:9},{group:4,map:9,mapId:"4:9"}),true);
  assert.equal(Panel.matches({group:4,map:9},{group:4,map:8,mapId:"4:8"}),false);
  assert.equal(Panel.matches({group:4,map:9},{group:9,map:4,mapId:"9:4"}),false);
});

test("encounter map panel matches GBA bank and map pairs exactly",async()=>{
  const Panel=await loadPanel();
  assert.equal(Panel.matches({bank:3,map:12},{bank:3,map:12}),true);
  assert.equal(Panel.matches({bank:3,map:12},{bank:3,map:11}),false);
  assert.equal(Panel.matches({bank:3,map:12},{bank:12,map:3}),false);
});
