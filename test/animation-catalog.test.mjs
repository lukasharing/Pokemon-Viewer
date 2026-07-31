import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function context(){
  const sandbox=vm.createContext({globalThis:null,DriverRegistry:class{register(){}},console});
  sandbox.globalThis=sandbox;
  sandbox.PokemonViewer={animation:{registry:{register(){}}}};
  for(const file of ["../js/animation/library.js","../js/animation/source-catalog.js","../js/animation/gbc/driver.js","../js/animation/gen2/driver.js"]){
    vm.runInContext(await readFile(new URL(file,import.meta.url),"utf8"),sandbox,{filename:file});
  }
  return sandbox;
}

test("animation entry providers isolate malformed resources without hiding the catalog",async()=>{
  const sandbox=await context(),{AnimationCatalog,AnimationEntryProvider,DOMAINS}=sandbox.PokemonViewer.animation;
  const provider=new AnimationEntryProvider({
    id:"fixture",entries:()=>[{id:1},{id:2},{id:3}],
    document:entry=>{if(entry.id===2)throw new Error("broken fixture");return{id:entry.id};}
  }),catalog=new AnimationCatalog().add(provider);
  assert.deepEqual(Array.from(catalog.list(),item=>item.id),[1,3]);
  assert.equal(catalog.diagnostics.length,1);
  assert.equal(catalog.diagnostics[0].id,2);
  assert.equal(DOMAINS.effect.label,"Visual effects");
});

test("family catalogs expose reusable native animation components",async()=>{
  const sandbox=await context(),animation=sandbox.PokemonViewer.animation;
  const gen1=animation.Gen1AttackAnimationDriver.prototype.components.call({});
  const gen2=animation.Gen2AttackAnimationDriver.prototype.components.call({});
  assert.equal(gen1.length,86);
  assert.equal(gen1[72].symbol,"SUBANIM_2_TRADE_BALL_DROP");
  assert.equal(gen1[84].symbol,"SUBANIM_0_SAFARI_BAIT");
  assert.equal(gen2.length,188);
  assert.equal(gen2[21].symbol,"BATTLE_ANIM_OBJ_POKE_BALL");
  assert.equal(gen2[187].symbol,"BATTLE_ANIM_OBJ_PLAYERHEAD_2ROW");
});
