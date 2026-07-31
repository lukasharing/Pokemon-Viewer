import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function context(){
  const sandbox=vm.createContext({globalThis:null,DriverRegistry:class{register(){}},console});
  sandbox.globalThis=sandbox;
  sandbox.PokemonViewer={animation:{registry:{register(){}}}};
  for(const file of ["../js/animation/library.js","../js/animation/source-catalog.js","../js/animation/gbc/driver.js","../js/animation/gen2/driver.js","../js/animation/gba-driver.js"]){
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
  const engine=animation.Gen2AttackAnimationDriver.prototype.enginePrograms.call({});
  assert.equal(engine.length,23);
  assert.deepEqual(Array.from(engine,item=>item.id),[0xff,...Array.from({length:22},(_,index)=>0x100+index)]);
  assert.equal(engine[1].symbol,"BattleAnim_ThrowPokeBall");
  assert.equal(engine.at(-1).symbol,"BattleAnim_HitConfusion");
});

test("GBA learns relocatable components from verified createsprite invocations",async()=>{
  const sandbox=await context(),Driver=sandbox.PokemonViewer.animation.GbaAnimationDriver,
    driver={componentIndex:new Map()},command={opcode:0x02,offset:0x1234,native:{animBattler:"target",subpriorityOffset:2,values:[4,8]},event:{kind:"sprite"}},
    decorated={event:{value:{asset:{frames:[{}]},accuracy:"verified",template:{offset:0x4560},label:"Hit",callback:"AnimHit"}}};
  Driver.prototype.rememberComponents.call(driver,[command],[decorated],{usage:"move:1"});
  Driver.prototype.rememberComponents.call(driver,[command],[decorated],{usage:"move:2"});
  assert.equal(driver.componentIndex.size,1);
  assert.deepEqual(Array.from(driver.componentIndex.values().next().value.uses),["move:1","move:2"]);
  Driver.prototype.rememberComponents.call(driver,[command],[{event:{value:{asset:{},accuracy:"unresolved",template:{offset:0x9999}}}}],{usage:"move:3"});
  assert.equal(driver.componentIndex.size,1);
});

test("animation documents resolve by generic identity, domain and typed references",async()=>{
  const sandbox=await context(),Resolver=sandbox.PokemonViewer.animation.AnimationDocumentResolver,documents=[
    {id:"move:1",domain:"move",references:{moveId:1,animationId:7}},
    {id:"effect:gba:a",domain:"effect",references:{componentId:"a",moveIds:["move:1","move:2"]}},
    {id:"scene:intro",domain:"scene",references:{sceneId:"intro"}}
  ];
  assert.equal(Resolver.resolve(documents,{documentId:"scene:intro"}).id,"scene:intro");
  assert.equal(Resolver.resolve(documents,{references:{componentId:"a"}}).id,"effect:gba:a");
  assert.equal(Resolver.resolve(documents,{move:1}).id,"move:1");
  assert.equal(Resolver.resolve(documents,{domain:"effect"}).id,"effect:gba:a");
  assert.equal(Resolver.resolve(documents,{references:{moveIds:"move:2"}}).id,"effect:gba:a");
  assert.equal(Resolver.resolve(documents,{move:99}),null);
});
