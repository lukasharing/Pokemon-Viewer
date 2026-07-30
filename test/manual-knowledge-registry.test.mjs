import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {buildProjectManifestFromSymbols} from "../js/core/source-symbol-parser.mjs";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const fingerprint="0123456789abcdef0123456789abcdef01234567";

test("manual engine knowledge is offset-free, family-isolated, and reusable by engine profile",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/core/manual-knowledge-registry.js"),context);
  const registry=context.ManualKnowledgeRegistry;
  assert.equal(registry.all.length,4);
  assert.equal(registry.get("gen1-rgb-intl").id,"gen1-rgb-intl");
  assert.equal(registry.get("gen1-red-en"),registry.get("gen1-rgb-intl"));
  assert.equal(registry.get("gen3-emerald-en").family,"gba");
  assert.equal(registry.schema("gen3-emerald-en","gBattleMoves").stride,12);
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.resource("gen2-crystal-intl","battleAnimations").symbols)),
    ["BattleAnimations","BattleAnimObjects","BattleAnimFrameData","BattleAnimOAMData","AnimObjGFX"]
  );
  const serialized=JSON.stringify(registry.all);
  assert.doesNotMatch(serialized,/"offset"\s*:/);
  assert.doesNotMatch(serialized,/"fingerprint"\s*:/);
});

test("manual knowledge loads before exact manifests and capability resolution",async()=>{
  const html=await read("index.html");
  const knowledge=html.indexOf("js/core/manual-knowledge-registry.js");
  const source=html.indexOf("js/core/source-manifest-registry.js");
  const capabilities=html.indexOf("js/core/capability-manifest.js");
  assert.ok(knowledge>=0,"manual knowledge registry must be loaded");
  assert.ok(source>knowledge,"exact manifests load after the offset-free contract");
  assert.ok(capabilities>source,"capabilities resolve only after both evidence layers");
});

test("MemoryProfile exposes reviewed schemas without converting them into addresses",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const path of ["js/core/manual-knowledge-registry.js","js/core/memory-profile.js"]){
    vm.runInContext(await read(path),context);
  }
  const profile=new context.MemoryProfile(
    {editorProfile:"gen3-emerald-en",selection:"user-base"},
    {
      id:"hack",family:"gba",game:"emerald",fingerprint,
      provenance:{origin:"project",engineProfile:"gen3-emerald-en",symbols:{},resources:{}}
    }
  );
  assert.equal(profile.knowledgeId,"gen3-emerald-en");
  assert.equal(profile.schema("gBattleMoves").count,355);
  assert.equal(profile.resourceContract("moves").coverage,"fixed-records-names-animation-root");
  assert.equal(profile.offset("gBattleMoves"),null);
  assert.equal(profile.exact,false);
});

test("hack symbol imports combine exact addresses with reviewed manual schemas",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/core/manual-knowledge-registry.js"),context);
  const template=context.ManualKnowledgeRegistry.get("gen3-emerald-en");
  const result=buildProjectManifestFromSymbols({
    symbolText:"08001000 000010A4 gBattleMoves\n08003000 00001207 gMoveNames\n08005000 0000058C gBattleAnims_Moves",
    platform:"gba",romSize:0x10000,fingerprint,
    engineProfile:"gen3-emerald-en",profile:"my-emerald-hack",
    source:{repository:"example/hack",commit:"a".repeat(40),build:"hack.gba"},
    template
  });
  assert.equal(result.manifest.knowledge.id,"gen3-emerald-en");
  assert.equal(result.manifest.symbols.gBattleMoves.offset,0x1000);
  assert.equal(result.manifest.symbols.gBattleMoves.count,355);
  assert.equal(result.manifest.symbols.gBattleMoves.stride,12);
  assert.equal(result.manifest.symbols.gBattleMoves.kind,"table");
  assert.equal(result.manifest.resources.moves.coverage,"fixed-records-names-animation-root");
  assert.equal(result.manifest.resources.maps,undefined);
});

test("one manually located hack symbol inherits only its engine schema, never a stock offset",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:null});
  context.globalThis=context;
  for(const path of ["js/core/manual-knowledge-registry.js","js/core/project-manifest-registry.js"]){
    vm.runInContext(await read(path),context);
  }
  const template=context.ManualKnowledgeRegistry.get("gen3-emerald-en");
  const registry=new context.ProjectManifestRegistryClass({storage:null});
  const manifest=registry.upsertManualSymbol({
    fingerprint,profile:"my-emerald-hack",engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gBattleMoves",entry:{offset:0x7000},template
  },{fingerprint,profile:"gen3-emerald-en",platform:"gba",romSize:0x10000});
  assert.equal(manifest.knowledge.id,"gen3-emerald-en");
  assert.equal(manifest.symbols.gBattleMoves.offset,0x7000);
  assert.equal(manifest.symbols.gBattleMoves.extent,4260);
  assert.equal(manifest.symbols.gBattleMoves.count,355);
  assert.equal(manifest.symbols.gBattleMoves.stride,12);
  assert.equal(manifest.symbols.gBattleMoves.origin,"manual");
  assert.equal(manifest.resources.moves,undefined);
});
