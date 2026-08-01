import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function run(relative,extras={}){
  const context=vm.createContext({globalThis:null,...extras});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL(relative,import.meta.url),"utf8"),context);
  return context;
}

test("EncounterBrowserModel owns family-neutral filtering, grouping, and method order",async()=>{
  const context=await run("../js/encounters/view-model.js");
  const Model=context.PokemonViewer.encounters.EncounterBrowserModel;
  const model=new Model([
    {id:"water",label:"Route 1 · Surf",method:"water",group:1,map:1},
    {id:"grass",label:"Route 1 · Grass",method:"grass",group:1,map:1},
    {id:"fish",label:"Route 2 · Old Rod",method:"fishing",group:1,map:2}
  ]);
  assert.deepEqual(Array.from(model.methods(),item=>item.method),["grass","water","fishing"]);
  model.search("fishing");
  assert.deepEqual(Array.from(model.filtered,item=>item.id),["fish"]);
  assert.equal(model.label("headbutt"),"Headbutt");
  assert.equal(model.icon("water"),"fa-water");
});

test("BattleSourceState switches semantic source modes without renderer knowledge",async()=>{
  const option=(attributes,text)=>({value:attributes.value,text,remove(){select.options=select.options.filter(item=>item!==this);}});
  const select={
    options:[],value:"",
    querySelector(){return this.options.find(item=>item.value==="__encounter__")||null;},
    prepend(item){this.options.unshift(item);}
  };
  const classes=new Set(),root={classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
  const trainerScene={hidden:null,setAttribute(_name,value){this.hidden=value;}};
  const context=await run("../js/battle/source-state.js",{Dom:{create:(_tag,{attributes,text})=>option(attributes,text)}});
  const state=new context.PokemonViewer.battle.BattleSourceState({root,select,trainerScene});
  state.wild("WURMPLE");
  assert.equal(state.isWild,true);assert.equal(select.value,"__encounter__");assert.equal(select.options[0].text,"Wild · WURMPLE");assert.equal(trainerScene.hidden,"true");
  state.trainer();
  assert.equal(state.isWild,false);assert.equal(select.options.length,0);assert.equal(trainerScene.hidden,"false");assert.equal(classes.has("battle-editor--wild"),false);
});

test("EditorLinks centralizes validated cross-editor navigation",async()=>{
  const emitted=[];
  class TestEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
  const context=await run("../js/core/editor-links.js",{
    CustomEvent:TestEvent,
    document:{dispatchEvent:event=>{emitted.push(event);return true;}}
  });
  context.EditorLinks.species("25");
  context.EditorLinks.code(0x1234,{view:"script"});
  assert.deepEqual(emitted.map(event=>[event.type,event.detail.workspace]),[["editorlink","pokedex_editor"],["editorlink","code_workspace"]]);
  assert.equal(emitted[0].detail.species,25);
  assert.throws(()=>context.EditorLinks.open({}),/requires a workspace/);
});

test("ProjectEvents normalizes cross-editor resource and graphic invalidation",async()=>{
  const emitted=[];
  class TestEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
  const context=await run("../js/core/project-events.js",{
    CustomEvent:TestEvent,
    document:{dispatchEvent:event=>{emitted.push(event);return true;}}
  });
  const graph={size:3};
  context.ProjectEvents.resources(graph);
  context.ProjectEvents.graphics([12,12,-1,24.5,32],{palette:true});
  assert.deepEqual(emitted.map(event=>event.type),["resourcegraphchange","romgraphicschange"]);
  assert.equal(emitted[0].detail.graph,graph);
  assert.deepEqual(Array.from(emitted[1].detail.offsets),[12,32]);
  assert.equal(emitted[1].detail.palette,true);
  assert.throws(()=>context.ProjectEvents.emit("",{}),/requires a type/);
  assert.throws(()=>context.ProjectEvents.emit("change",null),/must be an object/);
});

test("PixelCanvas creates and copies pixel-perfect canvases consistently",async()=>{
  const calls=[];
  const makeCanvas=()=>({
    width:0,height:0,className:"",hidden:false,attributes:{},
    setAttribute(name,value){this.attributes[name]=value;},
    getContext(){return{imageSmoothingEnabled:true,clearRect:(...args)=>calls.push(["clear",...args]),drawImage:(...args)=>calls.push(["draw",...args])};}
  });
  const context=await run("../js/core/pixel-canvas.js",{document:{createElement:tag=>{assert.equal(tag,"canvas");return makeCanvas();}}});
  const source={width:16,height:24};
  const copy=context.PixelCanvas.copy(source,{className:"sprite",label:"Native sprite"});
  assert.equal(copy.width,16);assert.equal(copy.height,24);assert.equal(copy.className,"sprite");
  assert.equal(copy.attributes["aria-label"],"Native sprite");
  assert.deepEqual(calls.map(call=>call[0]),["clear","draw"]);
  assert.throws(()=>context.PixelCanvas.create(0,8),/positive integers/);
});

test("EmulatorPerformance uses one audio clock and resumes Web Audio",async()=>{
  const context=await run("../js/emulator/performance.js");
  const settings=context.EmulatorPerformance.settings();
  assert.equal(settings.videoSync,false);
  assert.equal(settings.audioSync,true);
  assert.equal(settings.timestepSync,false);
  assert.equal(settings.threadedVideo,false);
  assert.equal(settings.showFpsCounter,false);
  assert.equal(settings.rewindEnable,false);
  assert.equal(settings.restoreAutoSaveStateOnLoad,false);
  let resumedCore=0,resumedContext=0;
  await context.EmulatorPerformance.resumeAudio({
    resumeAudio(){resumedCore++;},
    SDL2:{audioContext:{state:"suspended",resume(){resumedContext++;return Promise.resolve();}}}
  });
  assert.equal(resumedCore,1);assert.equal(resumedContext,1);
});
