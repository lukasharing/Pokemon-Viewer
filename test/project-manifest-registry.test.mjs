import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const fingerprint="0123456789abcdef0123456789abcdef01234567";
const manifest=Object.freeze({
  schemaVersion:1,
  profile:"my-emerald-hack",
  engineProfile:"gen3-emerald-en",
  fingerprint,
  platform:"gba",
  source:{
    repository:"example/my-emerald-hack",
    commit:"abcdef0123456789abcdef0123456789abcdef01",
    build:"my-emerald.gba"
  },
  symbols:{
    gMapGroups:{offset:0x120,address:0x08000120,format:"gnu"},
    gWildMonHeaders:{offset:0x240,address:0x08000240,format:"gnu"}
  },
  resources:{
    maps:{coverage:"table-root",symbols:["gMapGroups"]},
    encounters:{coverage:"wild-header-root",symbols:["gWildMonHeaders"],notes:"Built from this hack."}
  }
});

const storage=()=>{
  const values=new Map();
  return{
    getItem:key=>values.get(key)||null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
};

test("project manifests validate exact ROM identity, engine, bounds and resource ownership",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:storage()});
  context.globalThis=context;
  vm.runInContext(await read("js/core/project-manifest-registry.js"),context);
  const registry=new context.ProjectManifestRegistryClass({storage:context.localStorage});
  const imported=registry.register(manifest,{
    fingerprint,
    profile:"gen3-emerald-en",
    platform:"gba",
    romSize:0x1000
  });
  assert.equal(imported.engineProfile,"gen3-emerald-en");
  assert.equal(imported.symbols.gMapGroups.offset,0x120);
  assert.equal(imported.resources.encounters.notes,"Built from this hack.");
  assert.ok(Object.isFrozen(imported.symbols.gMapGroups));
  assert.throws(()=>registry.register({...manifest,fingerprint:"f".repeat(40)},{fingerprint}),/does not match/);
  assert.throws(()=>registry.register({...manifest,engineProfile:"gen3-fire_red-en"},{profile:"gen3-emerald-en"}),/not the selected/);
  assert.throws(()=>registry.register({...manifest,symbols:{gMapGroups:{offset:0x1000}}},{romSize:0x1000}),/offset/);
  assert.throws(()=>registry.register({...manifest,resources:{maps:{coverage:"root",symbols:["Missing"]}}}),/unselected symbols/);
});

test("project manifests persist as validated immutable dictionaries",async()=>{
  const local=storage(),first=vm.createContext({globalThis:null,localStorage:local});
  first.globalThis=first;
  vm.runInContext(await read("js/core/project-manifest-registry.js"),first);
  first.ProjectManifestRegistry.register(manifest);
  const second=vm.createContext({globalThis:null,localStorage:local});
  second.globalThis=second;
  vm.runInContext(await read("js/core/project-manifest-registry.js"),second);
  const restored=second.ProjectManifestRegistry.get(fingerprint);
  assert.equal(restored.source.repository,"example/my-emerald-hack");
  assert.deepEqual(JSON.parse(JSON.stringify(restored.resources.maps.symbols)),["gMapGroups"]);
  assert.ok(Object.isFrozen(restored));
  assert.equal(second.ProjectManifestRegistry.resolve(fingerprint,{
    profile:"gen3-emerald-en",platform:"gba",romSize:0x1000
  }).fingerprint,fingerprint);
  assert.equal(second.ProjectManifestRegistry.resolve(fingerprint,{romSize:0x100}),null);
});

test("manual symbols stay fingerprint-bound and do not complete partial resource groups",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:storage()});
  context.globalThis=context;
  vm.runInContext(await read("js/core/project-manifest-registry.js"),context);
  const registry=new context.ProjectManifestRegistryClass({storage:context.localStorage});
  const template={
    resources:{
      maps:{coverage:"table-roots",symbols:["gMapGroups","gMapLayouts"]},
      encounters:{coverage:"header-root",symbols:["gWildMonHeaders"]}
    }
  };
  const options={fingerprint,profile:"gen3-emerald-en",platform:"gba",romSize:0x1000};
  let result=registry.upsertManualSymbol({
    fingerprint,engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gMapGroups",entry:{offset:0x120,kind:"table",extent:16},template
  },options);
  assert.equal(result.source.method,"manual");
  assert.equal(result.source.commit,null);
  assert.equal(result.symbols.gMapGroups.origin,"manual");
  assert.equal(result.symbols.gMapGroups.extent,16);
  assert.equal(result.resources.maps,undefined);
  result=registry.upsertManualSymbol({
    fingerprint,engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gMapLayouts",entry:{offset:0x240,kind:"pointer"},template
  },options);
  assert.deepEqual(JSON.parse(JSON.stringify(result.resources.maps.symbols)),["gMapGroups","gMapLayouts"]);
  assert.match(result.resources.maps.notes,/operation audit pending/);
  assert.throws(()=>registry.upsertManualSymbol({
    fingerprint,engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gWildMonHeaders",entry:{offset:0xff8,extent:16},template
  },options),/extent exceeds/);
  assert.throws(()=>registry.upsertManualSymbol({
    fingerprint:"f".repeat(40),engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gWildMonHeaders",entry:{offset:0x80},template
  },options),/does not match/);
});

test("manual additions to a source build retain the build commit and become mixed provenance",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:storage()});
  context.globalThis=context;
  vm.runInContext(await read("js/core/project-manifest-registry.js"),context);
  const registry=new context.ProjectManifestRegistryClass({storage:context.localStorage});
  registry.register(manifest);
  const result=registry.upsertManualSymbol({
    fingerprint,engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gSpeciesInfo",entry:{offset:0x300,kind:"table"},
    template:{resources:{species:{coverage:"root",symbols:["gSpeciesInfo"]}}}
  });
  assert.equal(result.source.method,"mixed");
  assert.equal(result.source.commit,manifest.source.commit);
  assert.equal(result.symbols.gMapGroups.origin,"source-build");
  assert.equal(result.symbols.gSpeciesInfo.origin,"manual");
});

test("an imported hack manifest exposes exact symbols but never grants stock operation audits",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:storage()});
  context.globalThis=context;
  for(const path of [
    "js/core/project-manifest-registry.js",
    "js/core/source-manifest-registry.js",
    "js/core/capability-manifest.js",
    "js/core/memory-profile.js"
  ])vm.runInContext(await read(path),context);
  context.ProjectManifestRegistry.register(manifest);
  const info={
    family:"gba",editorProfile:"gen3-emerald-en",base:"emerald",lang:"en",version:0,
    fingerprint,selection:"user-base",romSize:0x1000
  };
  const capabilities=context.CapabilityManifest.resolve(info);
  assert.equal(capabilities.provenance.origin,"project");
  assert.equal(capabilities.provenance.symbols.gMapGroups.offset,0x120);
  assert.equal(capabilities.get("map_editor").state,"research");
  assert.equal(capabilities.get("map_editor").ordinary,false);
  assert.equal(capabilities.get("map_editor").writable,false);
  assert.match(capabilities.get("map_editor").reason,/exact ROM profile has not passed/);
  const memoryProfile=new context.MemoryProfile(info,capabilities);
  assert.equal(memoryProfile.exact,true);
  assert.equal(memoryProfile.verified,false);
  assert.equal(memoryProfile.manifestOrigin,"project");
  assert.equal(memoryProfile.offset("gMapGroups"),0x120);
});

test("bundled source manifests cannot be shadowed by a project import",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:storage()});
  context.globalThis=context;
  for(const path of [
    "js/core/project-manifest-registry.js",
    "js/core/source-manifest-registry.js",
    "js/core/capability-manifest.js"
  ])vm.runInContext(await read(path),context);
  context.ProjectManifestRegistry.register({
    ...manifest,
    fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7"
  });
  const capabilities=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-emerald-en",base:"emerald",lang:"en",version:0,
    fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7"
  });
  assert.equal(capabilities.provenance.origin,"bundled");
  assert.equal(capabilities.provenance.repository,"pret/pokeemerald");
  assert.equal(capabilities.get("map_editor").state,"verified");
});

test("the application exposes manifest import and reloads capabilities from the same ROM file",async()=>{
  const [html,init,reader]=await Promise.all([read("index.html"),read("js/init.js"),read("js/rom_reader.js")]);
  assert.match(html,/project-manifest-registry\.js/);
  assert.match(init,/Import ROM source manifest/);
  assert.match(init,/ProjectManifestRegistry\.importFile/);
  assert.match(init,/Set manual ROM symbol/);
  assert.match(init,/ProjectManifestRegistry\.upsertManualSymbol/);
  assert.match(init,/await romEditor\.reloadROM\(\)/);
  assert.match(reader,/this\.sourceFile = file/);
  assert.match(reader,/romSize:this\.ReadOnlyMemory\.length/);
  assert.match(reader,/async reloadROM\(\)/);
});
