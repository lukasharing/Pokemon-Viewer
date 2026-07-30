import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("battle move effects are composited before native HUD and text",async()=>{
  const calls=[];
  const context2d={
    imageSmoothingEnabled:false,
    clearRect(){},
    drawImage(image){calls.push(image.id);},
    fillRect(){},strokeRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},
    fillText(){},measureText(){return{width:0};}
  };
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const canvas={width:240,height:160,getContext:()=>context2d};
  const preview=new context.BattlePreview(canvas);
  preview.hud=()=>calls.push("hud");
  preview.textbox=()=>calls.push("text");
  preview.render({
    verified:true,
    backgroundCanvas:{id:"background"},
    enemy:{x:0,y:0,width:1,height:1,image:{id:"enemy"}},
    player:{x:0,y:0,width:1,height:1,image:{id:"player"}},
    overlays:[{image:{id:"overlay"}}],
    textboxCanvas:null,
    elements:[]
  },{battleEffects:[{image:{id:"effect"}}]});
  assert.deepEqual(calls,["background","enemy","player","effect","overlay","hud","text"]);
});
