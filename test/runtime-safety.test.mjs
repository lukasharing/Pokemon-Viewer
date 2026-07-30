import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("FileHandler rejects failed fetches and remains retryable",async()=>{
  const source=await read("js/util/file.js");
  let attempt=0;
  const context=vm.createContext({
    fetch:async path=>{
      attempt++;
      if(attempt===1)return{ok:false,status:503,text:async()=>""};
      return{ok:true,status:200,text:async()=>`loaded:${path}`};
    }
  });
  vm.runInContext(`${source}\nglobalThis.__FileHandler=FileHandler;`,context);
  await assert.rejects(context.__FileHandler.load(["fragment.html"]),/fragment\.html \(503\)/);
  let callbackResult=null;
  const result=await context.__FileHandler.load(["fragment.html"],value=>callbackResult=value);
  assert.equal(result[0].result,"loaded:fragment.html");
  assert.equal(callbackResult[0].path,"fragment.html");
  assert.equal(attempt,2);
});

test("AssetLoader evicts failed scripts, reuses exact URLs, and honors new module versions",async()=>{
  const source=await read("js/core/asset-loader.js");
  let attempts=0;
  const appended=[];
  const document={
    createElement(){
      const listeners=new Map();
      return{
        src:"",async:true,removed:false,
        addEventListener(type,callback){listeners.set(type,callback);},
        remove(){this.removed=true;},
        emit(type){listeners.get(type)?.();}
      };
    },
    head:{append(script){
      appended.push(script);
      attempts++;
      queueMicrotask(()=>script.emit(attempts===1?"error":"load"));
    }}
  };
  const context=vm.createContext({document,Error,Map,Promise,queueMicrotask});
  vm.runInContext(source,context);
  await assert.rejects(context.AssetLoader.loadScript("editor.js?v=1"),/editor\.js\?v=1/);
  assert.equal(context.AssetLoader.hasScript("editor.js?v=2"),false);
  assert.equal(appended[0].removed,true);
  await context.AssetLoader.loadScript("editor.js?v=2");
  await context.AssetLoader.loadScript("editor.js?v=3");
  await context.AssetLoader.loadScript("editor.js?v=3");
  assert.equal(appended.length,3,"a new version must replace stale evaluated editor code");
  assert.equal(appended[1].src,"editor.js?v=2");
  assert.equal(appended[2].src,"editor.js?v=3");
});

test("romloaded is emitted only after base initialization resolves",async()=>{
  const source=await read("js/rom_reader.js");
  const init=source.indexOf("await this.init()");
  const ready=source.indexOf('dispatchEvent(new CustomEvent("romloaded"');
  assert.ok(init>=0&&ready>init);
});

test("capability manifests fail closed and never expose research as an ordinary editor",async()=>{
  const context=vm.createContext({});
  vm.runInContext(await read("js/core/source-manifest-registry.js"),context);
  vm.runInContext(await read("js/core/capability-manifest.js"),context);
  const manifest=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-emerald-en",base:"emerald",lang:"en",version:0,
    fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7"
  });
  assert.equal(manifest.get("map_editor").state,"verified");
  assert.equal(manifest.get("battle_editor").state,"partial");
  assert.equal(manifest.get("animation_editor").state,"partial");
  assert.equal(manifest.enabledWorkspaces.includes("animation_editor"),true);
  assert.equal(manifest.enabledWorkspaces.includes("map_editor"),true);

  const unaudited=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-ruby-en",base:"ruby",lang:"en",version:0
  });
  assert.deepEqual(Array.from(unaudited.enabledWorkspaces),["hex_editor","emulator_editor"]);
  assert.equal(unaudited.get("map_editor").ordinary,false);
  assert.equal(unaudited.provenance.repository.includes("pret/"),true);
  assert.equal(unaudited.provenance.commit,null,"unknown pinned commit must remain explicit");
});

test("ROM fingerprints use the complete byte view",async()=>{
  const source=await read("js/core/rom-fingerprint.js");
  let received=null;
  const context=vm.createContext({
    Uint8Array,
    crypto:{subtle:{digest:async(algorithm,bytes)=>{
      received={algorithm,bytes:Array.from(bytes)};
      return Uint8Array.of(0x01,0xab,0xff).buffer;
    }}}
  });
  vm.runInContext(source,context);
  const result=await context.RomFingerprint.sha1(Uint8Array.of(4,5,6));
  assert.equal(result,"01abff");
  assert.deepEqual(received,{algorithm:"SHA-1",bytes:[4,5,6]});
});
