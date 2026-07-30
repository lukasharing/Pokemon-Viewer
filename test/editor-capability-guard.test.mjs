import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

const context=async()=>{
  const sandbox=vm.createContext({globalThis:null});
  sandbox.globalThis=sandbox;
  for(const file of [
    "js/core/source-manifest-registry.js",
    "js/core/capability-manifest.js",
    "js/core/editor-capability-guard.js"
  ])vm.runInContext(await read(file),sandbox);
  return sandbox;
};

const reader=capabilities=>({capabilities});

test("EditorCapabilityGuard blocks Crystal read-only workspaces and unknown ROM semantics",async()=>{
  const sandbox=await context();
  const crystal=sandbox.CapabilityManifest.resolve({
    family:"gbc",editorProfile:"gen2-crystal-intl",base:"crystal",lang:"en",version:0,
    fingerprint:"f4cd194bdee0d04ca4eac29e09b8e4e9d818c133"
  });
  assert.equal(sandbox.EditorCapabilityGuard.canWrite(reader(crystal),"code_workspace"),false);
  assert.throws(
    ()=>sandbox.EditorCapabilityGuard.requireWritable(reader(crystal),"code_workspace","Applying source"),
    error=>error.code==="EDITOR_CAPABILITY_READ_ONLY"
      &&/Applying source.+code_workspace.+read-only/.test(error.message)
      &&/command and relocation coverage/.test(error.message)
  );

  const unknown=sandbox.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-ruby-en",base:"ruby",lang:"en",version:0
  });
  assert.equal(sandbox.EditorCapabilityGuard.canWrite(reader(unknown),"move_editor"),false);
  assert.throws(
    ()=>sandbox.EditorCapabilityGuard.requireWritable(reader(unknown),"move_editor","Editing moves"),
    /Editing moves.+move_editor.+read-only/
  );
});

test("EditorCapabilityGuard permits exact writable profiles and configures controls",async()=>{
  const sandbox=await context();
  const emerald=sandbox.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-emerald-en",base:"emerald",lang:"en",version:0,
    fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7"
  });
  const blue=sandbox.CapabilityManifest.resolve({
    family:"gbc",editorProfile:"gen1-rgb-intl",base:"blue",lang:"en",version:0,
    fingerprint:"d7037c83e1ae5b39bde3c30787637ba1d4c48ce2"
  });
  assert.equal(sandbox.EditorCapabilityGuard.canWrite(reader(emerald),"code_workspace"),true);
  assert.equal(sandbox.EditorCapabilityGuard.requireWritable(reader(blue),"move_editor").writable,true);

  const control={
    disabled:true,dataset:{},attributes:{},
    setAttribute(name,value){this.attributes[name]=value;}
  };
  const access=sandbox.EditorCapabilityGuard.configureControl(control,reader(emerald),"code_workspace");
  assert.equal(access.writable,true);
  assert.equal(control.disabled,false);
  assert.equal(control.dataset.capabilityWritable,"true");
  assert.equal(control.attributes["aria-disabled"],"false");
});

test("EditorCapabilityGuard fails closed when the manifest or workspace is missing",async()=>{
  const sandbox=await context();
  const control={
    disabled:false,dataset:{},attributes:{},
    setAttribute(name,value){this.attributes[name]=value;}
  };
  const access=sandbox.EditorCapabilityGuard.configureControl(control,{},"code_workspace",{operation:"Applying source"});
  assert.equal(access.writable,false);
  assert.equal(control.disabled,true);
  assert.match(control.title,/Applying source is unavailable/);
  assert.throws(
    ()=>sandbox.EditorCapabilityGuard.requireWritable({},"code_workspace","Applying source"),
    /No writable capability is registered/
  );
});

test("EditorCapabilityGuard protects execute, undo and redo before command code can run",async()=>{
  const sandbox=await context(),events=[];
  const stack={
    done:[],undone:[],
    execute(command){command.do();events.push("execute");return command;},
    undo(){events.push("undo");return true;},
    redo(){events.push("redo");return true;},
    destroy(){events.push("destroy");}
  };
  const denied=sandbox.EditorCapabilityGuard.protectCommands(
    reader({get:()=>({writable:false,reason:"ROM profile is not exact."})}),
    "sprite_editor",stack,{operation:"Editing sprites"}
  );
  assert.throws(()=>denied.execute({do:()=>events.push("write"),undo(){}}),/Editing sprites \(execute\).+read-only/);
  assert.throws(()=>denied.undo(),/Editing sprites \(undo\).+read-only/);
  assert.throws(()=>denied.redo(),/Editing sprites \(redo\).+read-only/);
  assert.deepEqual(events,[]);
  denied.destroy();
  assert.deepEqual(events,["destroy"]);

  const allowed=sandbox.EditorCapabilityGuard.protectCommands(
    reader({get:()=>({writable:true,reason:"Exact profile."})}),
    "sprite_editor",stack,{operation:"Editing sprites"}
  );
  allowed.execute({do:()=>events.push("write"),undo(){}});
  allowed.undo();allowed.redo();
  assert.deepEqual(events,["destroy","write","execute","undo","redo"]);
});

test("Code and Move editors enforce the guard at both control and write boundaries",async()=>{
  const code=await read("js/code/editor.js"),moves=await read("js/moves/editor.js");
  assert.match(code,/configureControl\(this\.elements\.apply,reader,"code_workspace"/);
  assert.match(code,/requireWritable\(this\.reader,"code_workspace","Applying source"\)/);
  assert.match(code,/this\.elements\.apply\.disabled=!dirty\|\|!this\.writeAccess\.writable/);
  assert.match(moves,/configureControl\(this\.elements\.edit,reader,"move_editor"/);
  assert.match(moves,/requireWritable\(this\.reader,"move_editor","Editing moves"\)/);
  assert.match(moves,/this\.driver\.editable===false\|\|!this\.writeAccess\.writable/);
});

const writeEditorIntegrations=[
  {workspace:"hex_editor",file:"js/hex/editor-hex.js"},
  {workspace:"code_workspace",file:"js/code/editor.js",handler:/requireWritable\(this\.reader,"code_workspace","Applying source"\)/},
  {workspace:"map_editor",file:"js/map/editor.js",handlerFile:"js/map/workspace.js",handler:/requireWritable\(this\.reader,"map_editor",operation\)/},
  {workspace:"sprite_editor",file:"js/sprite/editor.js",handler:/requireWritable\(this\.reader,"sprite_editor","Painting sprite pixels"\)/},
  {workspace:"battle_editor",file:"js/battle/editor.js",handler:/requireWritable\(this\.reader,"battle_editor","Editing an opponent party"\)/},
  {workspace:"pokedex_editor",file:"js/pokedex/editor.js",handler:/requireWritable\(this\.reader,"pokedex_editor",operation\)/},
  {workspace:"move_editor",file:"js/moves/editor.js",handler:/requireWritable\(this\.reader,"move_editor","Editing moves"\)/},
  {workspace:"sound_editor",file:"js/sound/editor.js",handler:/requireWritable\(this\.reader,"sound_editor","Editing sound data"\)/},
  {workspace:"animation_editor",file:"js/animation/editor.js",handler:/requireWritable\(this\.reader,"animation_editor","Editing an animation"\)/},
  {workspace:"encounter_editor",file:"js/encounters/editor.js",handler:/requireWritable\(this\.reader,"encounter_editor","Editing an encounter slot"\)/},
  {workspace:"item_editor",file:"js/items/editor.js",handler:/requireWritable\(this\.reader,"item_editor","Editing an item"\)/}
];

for(const integration of writeEditorIntegrations)test(`${integration.workspace} routes ordinary writes through EditorCapabilityGuard`,async()=>{
  const source=await read(integration.file);
  assert.match(source,new RegExp(`protectCommands\\(reader,"${integration.workspace}"`));
  if(integration.handler){
    const handlerSource=integration.handlerFile?await read(integration.handlerFile):source;
    assert.match(handlerSource,integration.handler);
  }
});

test("Map keeps map and embedded encounter capabilities independent",async()=>{
  const map=await read("js/map/editor.js"),panel=await read("js/encounters/map-panel.js");
  assert.match(map,/protectCommands\(reader,"map_editor",commands/);
  assert.match(map,/protectCommands\(reader,"encounter_editor",commands/);
  assert.match(map,/commands:this\.encounterCommands/);
  assert.match(panel,/requireWritable\(this\.reader,"encounter_editor","Editing an encounter slot"\)/);
});

test("Sprite pixel writes enforce capability at the final memory boundary",async()=>{
  const source=await read("js/sprite/editor.js");
  const boundary=source.indexOf("writeGraphicBytes(offset,bytes)");
  const guard=source.indexOf('requireWritable(this.reader,"sprite_editor","Writing sprite pixels")',boundary);
  const memoryWrite=source.indexOf("MemoryUtils.writeBytes",boundary);
  assert.ok(boundary>=0&&guard>boundary&&memoryWrite>guard,
    "preview painting must not reach ROM memory before the final capability guard");
});
