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

test("battle preview applies semantic visibility after direction resolves physical battlers",async()=>{
  const calls=[];
  const context2d={
    imageSmoothingEnabled:false,clearRect(){},drawImage(image){calls.push(image.id);},
    fillRect(){},strokeRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},
    fillText(){},measureText(){return{width:0};}
  };
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const preview=new context.BattlePreview({width:240,height:160,getContext:()=>context2d});
  preview.hud=()=>{};preview.textbox=()=>{};preview.selection=()=>{};
  preview.render({
    verified:true,
    enemy:{x:0,y:0,width:1,height:1,image:{id:"enemy"}},
    player:{x:0,y:0,width:1,height:1,image:{id:"player"}},
    elements:[]
  },{enemyVisible:false,playerVisible:true});
  assert.deepEqual(calls,["player"]);
});

test("GBA BG3 offsets wrap the complete 256px hardware surface",async()=>{
  const calls=[];
  const context2d={
    imageSmoothingEnabled:false,clearRect(){},save(){calls.push(["save"]);},
    restore(){calls.push(["restore"]);},beginPath(){},rect(x,y,width,height){calls.push(["clip",x,y,width,height]);},
    clip(){},drawImage(image,x,y,width,height){calls.push(["draw",image.id,x,y,width,height]);}
  };
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const preview=new context.BattlePreview({width:240,height:160,getContext:()=>context2d});
  preview.hud=()=>{};preview.textbox=()=>{};preview.selection=()=>{};
  preview.render({
    verified:true,
    backgroundCanvas:{id:"visible",width:240,height:160},
    backgroundScrollCanvas:{id:"surface",width:256,height:256},
    backgroundViewport:{width:240,height:160},
    elements:[]
  },{backgroundOffset:{x:-2,y:3}});
  assert.deepEqual(calls,[
    ["save"],["clip",0,0,240,160],
    ["draw","surface",-254,-3,256,256],
    ["draw","surface",2,-3,256,256],
    ["restore"]
  ]);
});

test("animation renderer forwards accumulated background tracks to the native preview",async()=>{
  const source=await read("js/animation/renderer.js");
  assert.match(source,/backgroundOffset:offset\("background"\)/);
  assert.match(source,/item\.target===target\|\|item\.target==="both"/);
  assert.match(source,/mountedBackground\.scrollCanvas/);
  assert.match(source,/mountedBackground\.paletteCycles/);
});

test("battle palette tracks use the native five-bit blend equation",async()=>{
  let result=null;
  const scratchContext={
    imageSmoothingEnabled:false,clearRect(){},drawImage(){},
    getImageData:()=>({data:new Uint8ClampedArray([248,0,0,255])}),
    putImageData:image=>{result=Array.from(image.data);}
  };
  const ownerDocument={createElement:()=>({width:0,height:0,getContext:()=>scratchContext})},
    mainContext={},
    context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const canvas={width:240,height:160,ownerDocument,getContext:()=>mainContext},
    preview=new context.BattlePreview(canvas),
    source={width:1,height:1};
  preview.blended(source,[{coefficient:8,color:31<<10}]);
  assert.deepEqual(result,[120,0,120,255]);
});

test("battle palette inversion uses native five-bit complement and composes as XOR",async()=>{
  let result=null;
  const scratchContext={
    imageSmoothingEnabled:false,clearRect(){},drawImage(){},
    getImageData:()=>({data:new Uint8ClampedArray([248,80,0,255])}),
    putImageData:image=>{result=Array.from(image.data);}
  };
  const ownerDocument={createElement:()=>({width:0,height:0,getContext:()=>scratchContext})},
    context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const preview=new context.BattlePreview({
    width:240,height:160,ownerDocument,getContext:()=>({})
  }),source={width:1,height:1},invert={operation:"invert"};
  preview.blended(source,[invert]);
  assert.deepEqual(result,[0,168,248,255]);
  preview.blended(source,[invert,invert]);
  assert.deepEqual(result,[248,80,0,255]);
});

test("battle grayscale uses the native five-bit average and restore is an identity",async()=>{
  let result=null;
  const scratchContext={
    imageSmoothingEnabled:false,clearRect(){},drawImage(){},
    getImageData:()=>({data:new Uint8ClampedArray([248,80,0,255])}),
    putImageData:image=>{result=Array.from(image.data);}
  };
  const ownerDocument={createElement:()=>({width:0,height:0,getContext:()=>scratchContext})},
    context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const preview=new context.BattlePreview({
    width:240,height:160,ownerDocument,getContext:()=>({})
  }),source={width:1,height:1};
  preview.blended(source,[{operation:"grayscale"}]);
  assert.deepEqual(result,[104,104,104,255]);
  result=null;
  assert.equal(preview.blended(source,[{operation:"identity"}]),source);
  assert.equal(result,null);
});

test("battle palette cycles preserve separate native BG and OBJ coefficients",async()=>{
  const coefficients=[],context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const preview=new context.BattlePreview({
    width:240,height:160,
    getContext:()=>({imageSmoothingEnabled:false,clearRect(){}})
  });
  preview.layer=(_image,_x,_y,_width,_height,blends)=>coefficients.push(["background",blends[0]?.coefficient]);
  preview.sprite=(sprite,_offset,blends)=>coefficients.push([sprite.id,blends[0]?.coefficient]);
  preview.hud=()=>{};preview.textbox=()=>{};preview.selection=()=>{};
  preview.render({
    verified:true,backgroundCanvas:{width:240,height:160},
    enemy:{id:"target"},player:{id:"user"},elements:[]
  },{
    paletteBlends:[{
      targets:{background:true,user:true,target:true},
      coefficient:6,coefficients:{background:2,user:4,target:6},color:0
    }]
  });
  assert.deepEqual(coefficients,[["background",2],["target",6],["user",4]]);
});

test("battle affine tracks scale and rotate a battler around its native center",async()=>{
  const calls=[],context2d={
    save(){calls.push(["save"]);},restore(){calls.push(["restore"]);},
    translate(x,y){calls.push(["translate",x,y]);},rotate(value){calls.push(["rotate",value]);},scale(x,y){calls.push(["scale",x,y]);},
    drawImage(image,x,y,width,height){calls.push(["draw",image.id,x,y,width,height]);}
  },context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/battle/preview.js"),context);
  const preview=new context.BattlePreview({width:240,height:160,getContext:()=>context2d});
  preview.sprite({x:120,y:40,width:64,height:64,image:{id:"target"}},{x:2,y:-1},[],{scaleX:1.25,scaleY:.75,rotation:.25});
  assert.deepEqual(calls,[
    ["save"],["translate",154,71],["rotate",.25],["scale",1.25,.75],
    ["draw","target",-32,-32,64,64],["restore"]
  ]);
});
