import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

test("editor render pipeline cancels stale related work and records current phases",async()=>{
  const sandbox=vm.createContext({globalThis:null,console,performance:{now:()=>Date.now(),mark(){}},DOMException,AbortController,
    PokemonViewer:{},ProjectScheduler:{afterPaint:()=>Promise.resolve(),idle:()=>Promise.resolve()}});
  sandbox.globalThis=sandbox;
  vm.runInContext(await readFile(new URL("../js/core/editor-render-pipeline.js",import.meta.url),"utf8"),sandbox);
  const pipeline=new sandbox.EditorRenderPipeline({name:"fixture"}),first=pipeline.begin("first"),second=pipeline.begin("second");
  let stale=false,current=false;
  assert.equal(await pipeline.run(first,()=>{stale=true;}),false);
  assert.equal(await pipeline.run(second,()=>{current=true;},{schedule:"idle",phase:"references"}),true);
  assert.equal(stale,false);assert.equal(current,true);assert.equal(pipeline.report()[0].phase,"references");
  pipeline.destroy();
});

test("shared editor loading material exposes an accessible reusable spinner",async()=>{
  const create=(tag,options={},children=[])=>({tag,...options,children});
  const sandbox=vm.createContext({globalThis:null,PokemonViewer:{},Dom:{create}});
  sandbox.globalThis=sandbox;
  vm.runInContext(await readFile(new URL("../js/core/ui-loading.js",import.meta.url),"utf8"),sandbox);
  const loading=sandbox.UiLoading.create("Loading references…",{compact:true});
  assert.match(loading.className,/ui-loading--compact/);
  assert.equal(loading.attributes.role,"status");
  assert.equal(loading.children[0].className,"ui-loading__spinner");
  assert.equal(loading.children[1].text,"Loading references…");
});
