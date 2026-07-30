import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("Profile workspace is a shared, read-only capability for every loaded family",async()=>{
  const sandbox=vm.createContext({globalThis:null});
  sandbox.globalThis=sandbox;
  for(const file of ["js/core/source-manifest-registry.js","js/core/capability-manifest.js"]){
    vm.runInContext(await read(file),sandbox);
  }
  for(const info of [
    {family:"gbc",editorProfile:"gen1-rgb-intl",base:"blue",lang:"en",version:0,fingerprint:"unknown"},
    {family:"gbc",editorProfile:"gen2-crystal-intl",base:"crystal",lang:"en",version:0,fingerprint:"unknown"},
    {family:"gba",editorProfile:"gen3-emerald-en",base:"emerald",lang:"en",version:0,fingerprint:"unknown"}
  ]){
    const manifest=sandbox.CapabilityManifest.resolve(info),capability=manifest.get("profile_workspace");
    assert.equal(capability.state,"verified");
    assert.equal(capability.ordinary,true);
    assert.equal(capability.writable,false);
    assert.equal(capability.resourceRequirements.complete,true);
    assert.ok(manifest.enabledWorkspaces.includes("profile_workspace"));
  }
});

test("Profile workspace is registered, lazy-loaded before family runtimes, and fully described by its fragment",async()=>{
  const [init,reader,fragment,editor]=await Promise.all([
    read("js/init.js"),read("js/rom_reader.js"),read("profile.html"),read("js/profile/editor.js")
  ]);
  assert.match(init,/file:"profile\.html",id:"profile_workspace",instance:"profile_editor"/);
  assert.match(init,/help:\{file:"PROFILE_WORKSPACE\.md"\}/);
  assert.match(init,/ManualKnowledgeRegistry\.get\(romEditor\?\.editorProfile\)/);
  assert.match(reader,/workspaceId!=="profile_workspace"/);
  assert.match(reader,/AssetLoader\.loadScripts\(\["js\/profile\/editor\.js\?v=2"\]\)/);
  assert.match(reader,/this\.profile_editor=new ProfileWorkspace\(this\)/);
  assert.match(reader,/ProjectEvents\.resources\(this\._resourceGraph\)/);
  for(const id of [
    "profile_workspace","profile_capabilities","profile_resources","profile_symbols",
    "profile_identity","profile_provenance","profile_export_manifest","profile_remove_manifest"
  ])assert.match(fragment,new RegExp(`id="${id}"`));
  assert.match(editor,/new UiTable/);
  assert.match(editor,/ROM safely editable/);
  assert.match(editor,/graphCoverage\.writablePercent/);
  assert.match(editor,/graphCoverage\.modeledPercent/);
  assert.match(editor,/Raw Hex editing is intentionally excluded/);
  assert.match(editor,/"Manual engine contract":profile\?\.knowledgeId/);
  assert.match(editor,/"Knowledge evidence":profile\?\.knowledge\?\.evidence/);
  assert.match(editor,/percent\(row\.coverage,row\.required\.length\)/);
  assert.match(editor,/resourcegraphchange/);
  assert.match(editor,/ProjectManifestRegistry\.export\(this\.reader\.fingerprint\)/);
  assert.match(editor,/ProjectManifestRegistry\.remove\(this\.reader\.fingerprint\)/);
  assert.match(editor,/RomExport\.confirmDiscard/);
});

test("Profile workspace consumes only shared manifests and does not embed family memory rules",async()=>{
  const editor=await read("js/profile/editor.js");
  for(const forbidden of [
    /\bGbaMemory\b/,/\bGbcMemory\b/,/\bGen1\b/,/\bGen2\b/,
    /gMapGroups/,/MapGroupPointers/,/0x[0-9a-f]{5,}/i
  ])assert.doesNotMatch(editor,forbidden);
  assert.match(editor,/this\.reader\.memoryProfile/);
  assert.match(editor,/this\.reader\.capabilities/);
  assert.match(editor,/CapabilityManifest\.WORKSPACES/);
});
