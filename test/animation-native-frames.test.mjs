import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("native animation visibility remains semantic until the renderer resolves battle sides",async()=>{
  const context=vm.createContext({
    PokemonViewer:{animation:{}},
    DriverRegistry:class{},
    globalThis:null
  });
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const frames=context.PokemonViewer.animation.NativeAnimationProgram.frames([
    {label:"Hide attacker",event:{kind:"visibility",value:{target:"user",visible:false}}},
    {label:"Wait",track:"wait",duration:1,event:{}}
  ]);
  assert.equal(frames.length,1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(frames[0].state.visibility)),
    {user:false,target:true}
  );
});

test("Crystal rival coordinates follow the engine FIX_COORDS flag instead of mirroring every object",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gen2/visuals.js"),context);
  const Visuals=context.PokemonViewer.animation.Gen2BattleAnimationVisuals;
  assert.deepEqual(
    JSON.parse(JSON.stringify(Visuals.rivalCoordinates({flags:0,yFix:0xff},12,18))),
    {x:12,y:18,transformed:false}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(Visuals.rivalCoordinates({flags:1,yFix:0xff},12,18))),
    {x:168,y:58,transformed:true}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(Visuals.rivalCoordinates({flags:1,yFix:72},12,18))),
    {x:168,y:54,transformed:true}
  );
});

test("Emerald direction-sensitive hit splats invert Y only for a rival attacker",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/callbacks.js"),context);
  const Registry=context.PokemonViewer.animation.GbaAnimationCallbackRegistry,
    registry=new Registry({capabilities:{provenance:{symbols:{
      gHandleInvertHitSplatSpriteTemplate:{offset:0x20,kind:"data"}
    }}}}),
    player=registry.resolve({offset:0x20},{values:[0,7,1,0,0]},{attackerSide:"player"}),
    rival=registry.resolve({offset:0x20},{values:[0,7,1,0,0]},{attackerSide:"rival"});
  assert.equal(player.y,7);
  assert.equal(rival.y,-7);
  assert.equal(player.verifiedCallback,true);
  assert.equal(rival.verifiedCallback,true);
});

test("family timing modules expose native LCD cadence instead of an exact 60 Hz fallback",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  for(const path of[
    "js/animation/gba/timing.js",
    "js/animation/gbc/timing.js",
    "js/animation/gen2/timing.js"
  ])vm.runInContext(await read(path),context);
  const animation=context.PokemonViewer.animation,
    expected=59.72750056960583;
  assert.ok(Math.abs(animation.GBA_ANIMATION_TIMING.refreshHz-expected)<1e-12);
  assert.ok(Math.abs(animation.GBC_ANIMATION_TIMING.refreshHz-expected)<1e-12);
  assert.ok(Math.abs(animation.GEN2_ANIMATION_TIMING.refreshHz-expected)<1e-12);
  assert.notEqual(animation.GBA_ANIMATION_TIMING.refreshHz,60);
  assert.match(animation.GBC_ANIMATION_TIMING.source,/LCD scanline timing/);
  const timeline=await read("js/animation/timeline.js");
  assert.doesNotMatch(timeline,/\?\.fps\s*\|\|\s*60/);
  assert.match(timeline,/Number\.isFinite\(value\)&&value>0\?value:null/);
});

test("animation scenes request the lightweight family battle compositor",async()=>{
  let received=null;
  const native={
    verified:true,
    enemy:{x:96,y:0,width:56,height:56},
    player:{x:8,y:40,width:56,height:56}
  },context=vm.createContext({
    PokemonViewer:{
      animation:{},
      battle:{registry:{
        supports:id=>id==="gbc",
        create(_id,options){received=options;return{screen:{width:160,height:144},scene:()=>native};}
      }}
    },
    BattlePreview:function(){},
    globalThis:null
  });
  context.globalThis=context;
  vm.runInContext(await read("js/animation/scene.js"),context);
  const mounted=context.PokemonViewer.animation.AnimationSceneFactory.mountedBattle({family:"gbc"});
  assert.equal(received.sceneOnly,true);
  assert.equal(mounted.nativeScene,native);
  assert.deepEqual(JSON.parse(JSON.stringify(mounted.anchors.user)),{x:36,y:68});
  assert.deepEqual(JSON.parse(JSON.stringify(mounted.anchors.target)),{x:124,y:28});
});

const memoryFixture=()=>{
  const bytes=new Uint8Array(512);
  const u16=(offset,value)=>{bytes[offset]=value&0xff;bytes[offset+1]=value>>>8&0xff;};
  const u32=(offset,value)=>{u16(offset,value&0xffff);u16(offset+2,value>>>16);};
  return{
    bytes,u16,u32,
    memory:{
      size:bytes.length,
      contains:(offset,length=1)=>Number.isInteger(offset)&&offset>=0&&offset+length<=bytes.length,
      assertRange(offset,length=1){
        if(!this.contains(offset,length))throw new RangeError(`Fixture range ${offset}+${length} is invalid.`);
      },
      u8:offset=>bytes[offset],
      u16:offset=>bytes[offset]|bytes[offset+1]<<8,
      slice:(offset,length)=>bytes.slice(offset,offset+length),
      pointer(offset){
        const value=bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16|bytes[offset+3]<<24;
        const normalized=value>>>0;
        return normalized>=0x08000000?normalized-0x08000000:normalized;
      }
    }
  };
};

test("GBA move backgrounds discover and compose the native 27-record table",async()=>{
  const bytes=new Uint8Array(4096),u32=(offset,value)=>{
      bytes[offset]=value&255;bytes[offset+1]=value>>>8&255;
      bytes[offset+2]=value>>>16&255;bytes[offset+3]=value>>>24&255;
    },header=(offset,length)=>{
      bytes[offset]=0x10;bytes[offset+1]=length&255;
      bytes[offset+2]=length>>>8&255;bytes[offset+3]=length>>>16&255;
    },
    imageOffset=0x200,paletteOffset=0x240,tilemapOffset=0x280,
    tiles=new Uint8Array(32),paletteBytes=new Uint8Array(32),
    tilemap=new Uint8Array(32*20*2);
  paletteBytes[2]=0x1f;
  for(let index=0;index<tilemap.length;index+=2)tilemap[index+1]=0x20;
  header(imageOffset,tiles.length);header(paletteOffset,paletteBytes.length);header(tilemapOffset,tilemap.length);
  for(let id=0;id<27;id++){
    const record=id*12;
    u32(record,0x08000000+imageOffset);
    u32(record+4,0x08000000+paletteOffset);
    u32(record+8,0x08000000+tilemapOffset);
  }
  const memory={
      size:bytes.length,
      contains:(offset,length=1)=>Number.isInteger(offset)&&offset>=0&&offset+length<=bytes.length,
      u8:offset=>bytes[offset],
      pointer(offset){
        const value=(bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16|bytes[offset+3]<<24)>>>0;
        return value-0x08000000;
      }
    },
    decoded=new Map([[imageOffset,tiles],[paletteOffset,paletteBytes],[tilemapOffset,tilemap]]),
    context2d={
      imageSmoothingEnabled:false,
      createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
      putImageData(){}
    },
    context=vm.createContext({
      PokemonViewer:{animation:{},gba:{GbaLz77:{decode:(_memory,offset)=>({bytes:decoded.get(offset)})}}},
      CoreUtils:{bgr555ToRgb:value=>[
        (value&31)<<3,(value>>5&31)<<3,(value>>10&31)<<3
      ]},
      Uint8Array,
      document:{createElement:()=>({width:0,height:0,getContext:()=>context2d})},
      globalThis:null
    });
  context.globalThis=context;
  vm.runInContext(await read("js/core/gba-tilemap.js"),context);
  vm.runInContext(await read("js/animation/gba/backgrounds.js"),context);
  const Backgrounds=context.PokemonViewer.animation.GbaAnimationBackgrounds,
    contract={
      count:27,recordSize:12,paletteBytes:32,duplicateRecords:[0,1],
      fields:{
        image:{byte:0,maximumBytes:0x10000,multipleOf:32},
        palette:{byte:4,exactBytes:32},
        tilemap:{byte:8,minimumBytes:32*20*2,maximumBytes:0x1000,multipleOf:2}
      },
      names:Array.from({length:27},(_,id)=>id===3?"Psychic":`Background ${id}`)
    },
    backgrounds=new Backgrounds({
      memory,memoryProfile:{structure:name=>name==="GbaBattleAnimationBackgrounds"?contract:null},
      capabilities:{provenance:{symbols:{gBattleAnimBackgroundTable:{offset:0}}}}
    }),psychic=backgrounds.source(3);
  assert.equal(backgrounds.locate(),0);
  assert.equal(psychic.label,"Psychic");
  assert.equal(psychic.canvas.width,240);
  assert.equal(psychic.canvas.height,160);
  assert.equal(psychic.paletteCycles.length,11);
  assert.equal(psychic.scrollCanvas,null);
});

test("GBA animation palettes resolve by native tag and affine commands produce native ticks",async()=>{
  const canvas=()=>({width:0,height:0,getContext:()=>({
    createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
    putImageData(){}
  })});
  const context=vm.createContext({
    PokemonViewer:{animation:{}},GbaSpriteCodec:{decodeImage:(_bytes,{width,height})=>new Uint8Array(width*height)},
    document:{createElement:canvas},globalThis:null
  });
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/visuals.js"),context);
  const Visuals=context.PokemonViewer.animation.GbaBattleAnimationVisuals,fixture=memoryFixture();
  const instance=Object.create(Visuals.prototype);instance.memory=fixture.memory;instance.paletteTable=0;

  fixture.u32(0,0x08000120);fixture.u16(4,10000);
  fixture.u32(8,0x08000140);fixture.u16(12,10135);
  assert.equal(instance.paletteRecord(10135).paletteOffset,0x140);
  assert.equal(instance.paletteRecord(10001),null);
  instance.pictureTable=16;
  fixture.u32(16,0x08000160);fixture.u16(20,0x20);fixture.u16(22,10000);
  assert.equal(instance.record(10000,10135).paletteTag,10135);
  fixture.u16(400,10000);fixture.u16(402,10000);fixture.u32(404,0x080001b8);
  fixture.u32(408,0);fixture.u32(412,0);fixture.u32(416,0);fixture.u32(420,0);
  fixture.u16(440,0x0400);fixture.u16(442,0);
  assert.equal(instance.template(400).objectMode,1);

  fixture.u32(108,200);
  fixture.u16(200,0x00b0);fixture.u16(202,0x00b0);
  fixture.u16(208,0);fixture.u16(210,0);fixture.bytes[212]=0;fixture.bytes[213]=8;
  fixture.u16(216,0x7fff);
  const frames=instance.affineFrames({affine:true,affineAnims:100},2);
  assert.equal(frames.length,8);
  assert.equal(frames[0].scaleX,0x100/0xb0);
  assert.equal(frames.at(-1).scaleY,0x100/0xb0);

  fixture.u32(300,320);
  fixture.u16(320,0);fixture.u16(322,2);
  fixture.u16(324,1);fixture.u16(326,0x40|3);
  fixture.u16(328,0xffff);
  const spriteFrames=instance.spriteFrames(
    {anims:300},
    {bytes:new Uint8Array(64),palette:["#000000"],width:8,height:8},
    0
  );
  assert.deepEqual(Array.from(spriteFrames,frame=>[frame.imageValue,frame.duration,frame.hFlip]),[[0,2,false],[1,3,true]]);

  // SpriteTemplate.images changes imageValue from a sheet tile offset into a
  // SpriteFrameImage array index.
  fixture.u32(300,320);
  fixture.u16(320,1);fixture.u16(322,1);
  fixture.u16(324,0xffff);
  fixture.u32(368,0x08000190);fixture.u16(372,32);
  const imageFrames=instance.spriteFrames(
    {anims:300,images:360},
    {bytes:new Uint8Array(32),palette:["#000000"],width:8,height:8},
    0
  );
  assert.equal(imageFrames.length,1);
  assert.equal(imageFrames[0].imageValue,1);

  fixture.u32(300,336);
  fixture.u16(336,0);fixture.u16(338,1);
  fixture.u16(340,0xfffd);fixture.u16(342,0);
  fixture.u16(344,1);fixture.u16(346,1);
  fixture.u16(348,0xfffd);fixture.u16(350,2);
  fixture.u16(352,0xffff);
  const loopFrames=instance.spriteFrames(
    {anims:300},
    {bytes:new Uint8Array(64),palette:["#000000"],width:8,height:8},
    0
  );
  assert.deepEqual(Array.from(loopFrames,frame=>frame.imageValue),[0,1,1,1]);

  fixture.u32(300,360);
  fixture.u16(360,0);fixture.u16(362,2);
  fixture.u16(364,1);fixture.u16(366,3);
  fixture.u16(368,0xfffe);fixture.u16(370,0);
  const jumpingFrames=instance.spriteFrames(
    {anims:300},
    {bytes:new Uint8Array(64),palette:["#000000"],width:8,height:8},
    0
  );
  assert.deepEqual(Array.from(jumpingFrames,frame=>frame.imageValue),[0,1]);
  assert.equal(jumpingFrames.loopStart,0);
  assert.equal(jumpingFrames.terminal,"loop");
  instance.spriteFrames=()=>jumpingFrames;
  instance.affineFrames=()=>Object.freeze([]);
  const verifiedLifetime=instance.visualFrames(
    {},
    {canvas:{width:8,height:8}},
    {lifetime:12,transforms:Array.from({length:12},()=>({}))}
  );
  assert.deepEqual(
    Array.from(verifiedLifetime,frame=>frame.imageValue),
    [0,0,1,1,1,0,0,1,1,1,0,0]
  );
});

test("Generation I subanimation timing applies the command delay to every native frame",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gbc/visuals.js"),context);
  const Visuals=context.PokemonViewer.animation.Gen1BattleAnimationVisuals,
    instance=Object.create(Visuals.prototype),
    canvas={width:160,height:112};
  instance.subanimation=()=>Object.freeze({
    name:"Hit",frames:Object.freeze([
      Object.freeze({canvas}),Object.freeze({canvas})
    ])
  });
  const [command]=instance.decorate([{
    opcode:0x08,args:[4,0,0,1],duration:4,track:"sprite",
    event:{kind:"sprite",value:{id:"hit"}}
  }]);
  assert.equal(command.duration,8);
  assert.deepEqual(Array.from(command.event.value.asset.frames,frame=>frame.duration),[4,4]);
});

test("Generation II frameset controls preserve waits, restart loops, and terminal deletion",async()=>{
  const canvas=()=>({width:0,height:0,getContext:()=>({})});
  const context=vm.createContext({
    PokemonViewer:{animation:{}},document:{createElement:canvas},globalThis:null
  });
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gen2/visuals.js"),context);
  const Visuals=context.PokemonViewer.animation.Gen2BattleAnimationVisuals,
    instance=Object.create(Visuals.prototype),
    fixture=memoryFixture(),gfx={};
  instance.memory=fixture.memory;
  instance.frames={offset:20,bank:0};
  instance.pointer=()=>100;
  instance.renderOam=(oamSet,_gfx,_palette,flags)=>({canvas:{width:64,height:64},oamSet,flags});
  fixture.bytes.set([2,3,0xfd,5,0xfe],100);
  const loop=instance.decodeFrameset(0,gfx,2);
  assert.equal(loop.length,2);
  assert.equal(loop[0].duration,3);
  assert.equal(loop[1].transparent,true);
  assert.equal(loop[1].duration,5);
  assert.equal(loop.loopStart,0);
  assert.equal(loop.terminal,"loop");
  fixture.bytes.set([4,2,0xfc],100);
  const deleted=instance.decodeFrameset(0,gfx,2);
  assert.equal(deleted.length,1);
  assert.equal(deleted.terminal,"delete");
});

test("native transient animation objects leave the scene after their verified frame sequence",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const {AnimationDocument}=context.PokemonViewer.animation;
  const canvas={width:32,height:32},document=new AnimationDocument({
    id:"native",name:"Native",commands:[
      {label:"Create",event:{kind:"sprite",transient:true,value:{id:"effect",asset:{canvas,frames:[
        {canvas,duration:1,scaleX:1},{canvas,duration:1,scaleX:2}
      ]}}}},
      {label:"Wait",event:{kind:"flow",value:"wait"}}
    ]
  });
  assert.equal(document.frames.length,3);
  assert.equal(document.frames[0].state.sprites.length,1);
  assert.equal(document.frames[1].state.sprites[0].asset.nativeFrame.scaleX,2);
  assert.equal(document.frames[2].state.sprites.length,0);
});

test("native animation scheduling advances overlapping objects on one shared clock",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const {NativeAnimationProgram}=context.PokemonViewer.animation,canvas={width:8,height:8};
  const effect=id=>({id,asset:{canvas,frames:[
    {canvas,duration:2,x:0},{canvas,duration:2,x:1}
  ]}});
  const frames=NativeAnimationProgram.frames([
    {label:"A",opcode:2,event:{kind:"sprite",transient:true,value:effect("a")}},
    {label:"Delay",track:"wait",duration:1,event:{kind:"flow"}},
    {label:"B",opcode:2,event:{kind:"sprite",transient:true,value:effect("b")}},
    {label:"Delay",track:"wait",duration:2,event:{kind:"flow"}},
    {label:"Wait",event:{kind:"wait-visuals"}}
  ]);
  assert.deepEqual(Array.from(frames,frame=>frame.state.sprites.length),[1,2,2,2,1]);
  assert.equal(frames[2].state.sprites[0].asset.nativeFrame.x,1);
  assert.equal(frames[2].state.sprites[1].asset.nativeFrame.x,0);
});

test("native visual tasks transform battlers on the same verified clock",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const {NativeAnimationProgram}=context.PokemonViewer.animation;
  const frames=NativeAnimationProgram.frames([
    {label:"Shake",opcode:3,event:{kind:"task",transient:true,value:{
      id:"shake",label:"Shake target",target:"target",
      frames:[{x:3,y:0,duration:2},{x:0,y:0,duration:1}]
    }}},
    {label:"Wait",event:{kind:"wait-visuals"}}
  ]);
  assert.deepEqual(Array.from(frames,frame=>frame.state.sceneTracks[0]?.x??null),[3,3,0]);
  assert.equal(frames.at(-1).state.tasks.length,1);
});

test("native palette tasks retain their final absolute blend after task destruction",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const {NativeAnimationProgram}=context.PokemonViewer.animation,
    blend=coefficient=>({paletteBlend:{coefficient,color:0,targets:{background:true}},duration:1});
  const frames=NativeAnimationProgram.frames([
    {label:"Blend",opcode:3,event:{kind:"task",transient:true,value:{
      id:"blend",label:"Blend background",target:"scene",channel:"palette:1",persistFinal:true,
      frames:[blend(0),blend(8)]
    }}},
    {label:"Wait",event:{kind:"wait-visuals"}},
    {label:"Next",track:"wait",duration:1,event:{kind:"flow"}}
  ]);
  assert.deepEqual(Array.from(frames,frame=>frame.state.sceneTracks[0]?.paletteBlend.coefficient),[0,8,8]);
});

test("native palette restore replaces a persistent battler effect on the same channel",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const {NativeAnimationProgram}=context.PokemonViewer.animation,
    effect=operation=>({paletteEffect:{operation,targets:{user:true}},duration:1}),
    task=(id,operation)=>({label:id,opcode:3,event:{kind:"task",transient:true,value:{
      id,label:id,target:"scene",channel:"palette:grayscale:user",persistFinal:true,
      frames:[effect(operation)]
    }}});
  const frames=NativeAnimationProgram.frames([
    task("Gray","grayscale"),
    {label:"Wait gray",event:{kind:"wait-visuals"}},
    task("Restore","identity"),
    {label:"Wait restore",event:{kind:"wait-visuals"}},
    {label:"Next",track:"wait",duration:1,event:{kind:"flow"}}
  ]);
  assert.deepEqual(
    Array.from(frames,frame=>frame.state.sceneTracks[0]?.paletteEffect.operation),
    ["grayscale","identity","identity"]
  );
  assert.equal(frames.every(frame=>frame.state.sceneTracks.length===1),true);
});

test("independent GBA background tasks loop until their native setarg signal",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const {NativeAnimationProgram}=context.PokemonViewer.animation,
    frames=NativeAnimationProgram.frames([
      {label:"Psychic",opcode:3,event:{kind:"task",transient:true,value:{
        id:"psychic",label:"Psychic background",target:"background",
        channel:"palette:background:psychic",independent:true,loop:true,
        stopSignal:{arg:7,value:0xffff},
        frames:[
          {backgroundPaletteRotation:0,duration:1},
          {backgroundPaletteRotation:1,duration:1}
        ]
      }}},
      {label:"Delay",track:"wait",duration:5,event:{kind:"flow"}},
      {label:"Wait",event:{kind:"wait-visuals"}},
      {label:"Stop",opcode:0x10,args:[7,0xff,0xff],event:{kind:"flow"}},
      {label:"After",track:"wait",duration:1,event:{kind:"flow"}}
    ]);
  assert.deepEqual(
    Array.from(frames,frame=>frame.state.sceneTracks[0]?.backgroundPaletteRotation??null),
    [0,1,0,1,0,null]
  );
  assert.equal(frames.at(-1).state.tasks.length,0);
});

test("GBA visual tasks are learned without ROM offsets and follow native task steps",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/tasks.js"),context);
  const Registry=context.PokemonViewer.animation.GbaAnimationTaskRegistry;
  assert.deepEqual(
    [0,64,128,192,256].map(context.PokemonViewer.animation.GBA_SINE_Q8),
    [0,256,0,-256,0]
  );
  const registry=new Registry({memoryProfile:{structure:name=>name==="GbaBattleAnimationTasks"?{
    locators:[
      {symbol:"AnimTask_ShakeMon",domain:"move",id:1,opcode:3,values:[1,3,0,6,1]},
      {symbol:"AnimTask_ShakeMonInPlace",domain:"move",id:34,opcode:3,values:[1,4,0,12,1]},
      {symbol:"AnimTask_ShakeMon2",domain:"move",id:48,opcode:3,values:[0,2,0,8,1]},
      {symbol:"AnimTask_BlendBattleAnimPal",domain:"move",id:126,opcode:3,values:[1,3,0,8,0]},
      {symbol:"AnimTask_ScaleMonAndRestore",domain:"move",id:93,opcode:3,values:[65532,65532,15,1,1]},
      {symbol:"AnimTask_TranslateMonEllipticalRespectSide",domain:"move",id:14,opcode:3,values:[0,16,6,1,4]},
      {symbol:"AnimTask_SwayMon",domain:"move",id:103,opcode:3,values:[0,6,2048,2,1]},
      {symbol:"AnimTask_BlendBattleAnimPalExclude",domain:"move",id:347,opcode:3,values:[0,0,0,16,0]},
      {symbol:"AnimTask_TranslateMonElliptical",domain:"move",id:17,opcode:3,values:[0,12,4,1,4]},
      {symbol:"AnimTask_BlendMonInAndOut",domain:"move",id:172,opcode:3,values:[1,31,12,1,1]},
      {symbol:"AnimTask_HorizontalShake",domain:"move",id:90,opcode:3,values:[1,10,50]},
      {symbol:"AnimTask_BlendColorCycle",domain:"move",id:51,opcode:3,values:[20,2,2,0,12,31774]},
      {symbol:"AnimTask_InvertScreenColor",domain:"move",id:9,opcode:3,values:[257,257,257]},
      {symbol:"AnimTask_SetGrayscaleOrOriginalPal",domain:"move",id:111,opcode:3,values:[0,0]},
      {symbol:"AnimTask_ShakeTargetBasedOnMovePowerOrDmg",domain:"move",id:229,opcode:3,values:[0,1,10,1,0]},
      {symbol:"AnimTask_ShakeBattlePlatforms",domain:"move",id:317,opcode:3,values:[0,2,3,1]}
      ,{symbol:"AnimTask_PainSplitMovement",domain:"move",id:220,opcode:3,values:[0,0]}
      ,{symbol:"AnimTask_RotateMonSpriteToSide",domain:"move",id:31,opcode:3,values:[4,256,0,2]}
      ,{symbol:"AnimTask_SetGrayscaleOrOriginalPal",domain:"move",id:195,opcode:3,values:[4,0]}
      ,{symbol:"AnimTask_ShakeTargetInPattern",domain:"move",id:87,opcode:3,values:[30,3,1,0]}
    ]
  }:null}});
  const anchor={offset:0x100,opcode:3,native:{pointer:0x401,values:[1,3,0,6,1]}};
  registry.learn([anchor],{domain:"move",id:1});
  const resolved=registry.resolve({offset:0x200,opcode:3,native:{pointer:0x401,values:[1,3,0,6,1]}});
  assert.equal(resolved.label,"AnimTask_ShakeMon");
  assert.equal(resolved.target,"target");
  assert.equal(resolved.accuracy,"verified");
  assert.deepEqual(Array.from(resolved.frames,frame=>frame.x),[3,0,0,3,3,0,0,3,3,0,0]);
  const inPlace={offset:0x220,opcode:3,native:{pointer:0x501,values:[1,4,0,12,1]}},
    signed={offset:0x240,opcode:3,native:{pointer:0x601,values:[0,2,0,8,1]}};
  registry.learn([inPlace],{domain:"move",id:34}).learn([signed],{domain:"move",id:48});
  assert.deepEqual(Array.from(registry.resolve(inPlace).frames,frame=>frame.x),[-4,-4,4,4,-4,-4,4,4,-4,-4,4,4,-4,-4,4,4,-4,-4,4,4,-4,-4]);
  assert.deepEqual(Array.from(registry.resolve(signed).frames,frame=>frame.x),[2,-2,-2,2,2,-2,-2,2,2,-2,-2,2,2,-2,-2]);
  const forcedAttacker={offset:0x248,opcode:3,native:{pointer:0x601,values:[8,2,0,8,1]}},
    fixedOpponent={offset:0x250,opcode:3,native:{pointer:0x601,values:[6,2,0,8,1]}};
  assert.equal(registry.resolve(forcedAttacker).target,"user");
  assert.equal(registry.resolve(fixedOpponent).target,"target");
  const absentPartner=registry.resolve({offset:0x258,opcode:3,native:{pointer:0x601,values:[3,2,0,8,1]}});
  assert.equal(absentPartner.target,"absent");
  assert.equal(absentPartner.frames.length,0);
  assert.equal(absentPartner.accuracy,"verified");
  const palette={offset:0x260,opcode:3,native:{pointer:0x701,values:[1,3,0,8,0]}};
  registry.learn([palette],{domain:"move",id:126});
  const paletteTask=registry.resolve(palette);
  assert.equal(paletteTask.target,"scene");
  assert.equal(paletteTask.channel,"palette:1");
  assert.equal(paletteTask.persistFinal,true);
  assert.equal(paletteTask.frames.length,36);
  assert.deepEqual(Array.from(paletteTask.frames.slice(0,8),frame=>frame.paletteBlend.coefficient),[0,0,0,0,0,0,0,1]);
  assert.equal(paletteTask.frames.at(-1).paletteBlend.coefficient,8);
  assert.equal(paletteTask.frames.at(-1).paletteBlend.targets.background,true);
  const scale={offset:0x280,opcode:3,native:{pointer:0x801,values:[65532,65532,15,1,1]}};
  registry.learn([scale],{domain:"move",id:93});
  const scaleTask=registry.resolve(scale);
  assert.equal(scaleTask.target,"target");
  assert.equal(scaleTask.channel,"transform:target:scale");
  assert.equal(scaleTask.frames.length,30);
  assert.equal(scaleTask.frames[0].scaleX,1);
  assert.equal(scaleTask.frames[1].scaleX,0x100/0xfc);
  assert.equal(scaleTask.frames[15].scaleX,0x100/0xc4);
  assert.equal(scaleTask.frames.at(-1).scaleX,0x100/0xfc);
  assert.equal(registry.resolve({offset:0x290,opcode:3,native:{pointer:0x801,values:[65532,65532,15,2,1]}}),null);
  const ellipse={offset:0x2a0,opcode:3,native:{pointer:0x901,values:[0,16,6,1,4]}};
  registry.learn([ellipse],{domain:"move",id:14});
  const ellipseTask=registry.resolve(ellipse);
  assert.equal(ellipseTask.target,"user");
  assert.equal(ellipseTask.channel,"transform:user:ellipse");
  assert.equal(ellipseTask.frames.length,15);
  assert.deepEqual(
    Array.from(ellipseTask.frames.slice(0,5),frame=>[frame.x,frame.y]),
    [[0,0],[6,1],[11,2],[14,4],[16,6]]
  );
  assert.deepEqual(
    [ellipseTask.frames.at(-1).x,ellipseTask.frames.at(-1).y],
    [-12,2]
  );
  assert.equal(registry.resolve({offset:0x2b0,opcode:3,native:{pointer:0x901,values:[0,16,6,1,6]}}).frames.length,7);
  const sway={offset:0x2c0,opcode:3,native:{pointer:0xa01,values:[0,6,2048,2,1]}};
  registry.learn([sway],{domain:"move",id:103});
  const swayTask=registry.resolve(sway);
  assert.equal(swayTask.target,"target");
  assert.equal(swayTask.channel,"transform:target:sway");
  assert.equal(swayTask.frames.length,32);
  assert.deepEqual(
    Array.from(swayTask.frames.slice(0,6),frame=>[frame.x,frame.y]),
    [[0,0],[1,0],[2,0],[3,0],[4,0],[4,0]]
  );
  assert.deepEqual(
    [swayTask.frames[16].x,swayTask.frames.at(-1).x],
    [0,-2]
  );
  const vertical={offset:0x2d0,opcode:3,native:{pointer:0xa01,values:[1,8,1536,2,1]}},
    verticalFrames=registry.resolve(vertical).frames;
  assert.ok(verticalFrames.every(frame=>frame.y<=0));
  assert.ok(verticalFrames.some(frame=>frame.y<0));
  const exclude={offset:0x2e0,opcode:3,native:{pointer:0xb01,values:[0,0,0,16,0]}};
  registry.learn([exclude],{domain:"move",id:347});
  const excludeTask=registry.resolve(exclude);
  assert.equal(excludeTask.target,"scene");
  assert.equal(excludeTask.channel,"palette:exclude:0");
  assert.equal(excludeTask.persistFinal,true);
  assert.equal(excludeTask.frames.length,17);
  assert.deepEqual(
    JSON.parse(JSON.stringify(excludeTask.frames.at(-1).paletteBlend.targets)),
    {background:true,user:false,target:true,effects:false}
  );
  assert.equal(
    registry.resolve({offset:0x2f0,opcode:3,native:{pointer:0xb01,values:[6,1,0,12,0x7fff]}}),
    null
  );
  const directEllipse={offset:0x2f8,opcode:3,native:{pointer:0xc01,values:[0,12,4,1,4]}};
  registry.learn([directEllipse],{domain:"move",id:17});
  assert.deepEqual(
    Array.from(registry.resolve(directEllipse).frames.slice(0,3),frame=>[frame.x,frame.y]),
    [[0,0],[4,1],[8,2]]
  );
  const monBlend={offset:0x300,opcode:3,native:{pointer:0xd01,values:[1,31,12,1,1]}};
  registry.learn([monBlend],{domain:"move",id:172});
  const monBlendTask=registry.resolve(monBlend);
  assert.equal(monBlendTask.target,"target");
  assert.equal(monBlendTask.channel,"palette:mon:target");
  assert.equal(monBlendTask.persistFinal,false);
  assert.equal(monBlendTask.frames.length,25);
  assert.deepEqual(
    Array.from(monBlendTask.frames,frame=>frame.paletteBlend.coefficient),
    [0,1,2,3,4,5,6,7,8,9,10,11,12,11,10,9,8,7,6,5,4,3,2,1,0]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(monBlendTask.frames[1].paletteBlend.targets)),
    {background:false,user:false,target:true,effects:false}
  );
  assert.equal(
    registry.resolve({offset:0x308,opcode:3,native:{pointer:0xd01,values:[2,31,12,1,1]}}),
    null
  );
  const horizontalAnchor={offset:0x310,opcode:3,native:{pointer:0xe01,values:[1,10,50]}},
    horizontal={offset:0x314,opcode:3,native:{pointer:0xe01,values:[0,2,16]}};
  registry.learn([horizontalAnchor],{domain:"move",id:90});
  const horizontalTask=registry.resolve(horizontal);
  assert.equal(horizontalTask.target,"user");
  assert.equal(horizontalTask.channel,"transform:user:horizontal-shake");
  assert.equal(horizontalTask.frames.length,65);
  assert.deepEqual(
    Array.from(horizontalTask.frames.slice(0,8),frame=>frame.x),
    [0,0,3,3,-2,-2,3,3]
  );
  assert.deepEqual(
    Array.from(horizontalTask.frames.slice(-8),frame=>frame.x),
    [-1,1,1,0,0,1,1,0]
  );
  const allBattlers=registry.resolve({offset:0x318,opcode:3,native:{pointer:0xe01,values:[4,2,16]}}),
    platforms=registry.resolve({offset:0x31a,opcode:3,native:{pointer:0xe01,values:[5,2,16]}}),
    powerDriven=registry.resolve({offset:0x320,opcode:3,native:{pointer:0xe01,values:[0,0,16]}},{movePower:90});
  assert.equal(allBattlers.target,"both");
  assert.equal(platforms.target,"background");
  assert.deepEqual(Array.from(allBattlers.frames.slice(0,4),frame=>frame.x),[0,0,3,3]);
  assert.deepEqual(Array.from(platforms.frames.slice(0,4),frame=>frame.x),[0,0,3,3]);
  assert.deepEqual(Array.from(powerDriven.frames.slice(0,4),frame=>frame.x),[0,0,6,6]);
  assert.equal(registry.resolve({offset:0x322,opcode:3,native:{pointer:0xe01,values:[0,0,16]}}),null);
  const cycleAnchor={offset:0x324,opcode:3,native:{pointer:0xf01,values:[20,2,2,0,12,31774]}};
  registry.learn([cycleAnchor],{domain:"move",id:51});
  const cycleTask=registry.resolve(cycleAnchor);
  assert.equal(cycleTask.target,"scene");
  assert.equal(cycleTask.channel,"palette:cycle:20");
  assert.equal(cycleTask.frames.length,56);
  assert.deepEqual(
    Array.from(cycleTask.frames.slice(0,7),frame=>[
      frame.paletteBlend.coefficients.background,
      frame.paletteBlend.coefficients.target
    ]),
    [[0,0],[0,0],[0,0],[0,2],[0,2],[0,2],[0,2]]
  );
  assert.deepEqual(
    Array.from(cycleTask.frames.slice(7,12),frame=>[
      frame.paletteBlend.coefficients.background,
      frame.paletteBlend.coefficients.target
    ]),
    [[0,4],[0,4],[0,4],[0,4],[0,6]]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(cycleTask.frames[0].paletteBlend.targets)),
    {background:false,user:false,target:true,effects:false}
  );
  assert.equal(cycleTask.frames.at(-1).paletteBlend.coefficients.target,0);
  const fastCycle=registry.resolve({
    offset:0x325,opcode:3,native:{pointer:0xf01,values:[3,65505,1,5,5,23551]}
  });
  assert.equal(fastCycle.frames.length,8);
  assert.equal(fastCycle.frames[2].paletteBlend.coefficients.background,5);
  assert.equal(fastCycle.frames[2].paletteBlend.coefficients.user,0);
  assert.equal(fastCycle.frames[3].paletteBlend.coefficients.user,5);
  assert.equal(
    registry.resolve({offset:0x326,opcode:3,native:{pointer:0xf01,values:[32,2,2,0,12,31774]}}),
    null
  );
  const invertAnchor={offset:0x330,opcode:3,native:{pointer:0x1001,values:[257,257,257]}};
  registry.learn([
    invertAnchor,
    {offset:0x332,opcode:3,native:{pointer:0x1001,values:[257,257,257]}}
  ],{domain:"move",id:9});
  const invertTask=registry.resolve(invertAnchor);
  assert.equal(invertTask.target,"scene");
  assert.equal(invertTask.channel,"palette:invert:816");
  assert.equal(invertTask.persistFinal,true);
  assert.equal(invertTask.frames.length,1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(invertTask.frames[0].paletteEffect)),
    {
      operation:"invert",
      targets:{background:true,user:true,target:true,effects:false}
    }
  );
  const targetOnly=registry.resolve({
    offset:0x334,opcode:3,native:{pointer:0x1001,values:[0,0,256]}
  });
  assert.equal(targetOnly.channel,"palette:invert:820");
  assert.deepEqual(
    JSON.parse(JSON.stringify(targetOnly.frames[0].paletteEffect.targets)),
    {background:false,user:false,target:true,effects:false}
  );
  assert.equal(
    registry.resolve({offset:0x338,opcode:3,native:{pointer:0x1001,values:[1,1,1]}}),
    null
  );
  const grayscaleAnchor={offset:0x33c,opcode:3,native:{pointer:0x1101,values:[0,0]}};
  registry.learn([grayscaleAnchor],{domain:"move",id:111});
  const grayscale=registry.resolve(grayscaleAnchor),
    restore=registry.resolve({offset:0x340,opcode:3,native:{pointer:0x1101,values:[0,1]}}),
    targetGray=registry.resolve({offset:0x344,opcode:3,native:{pointer:0x1101,values:[1,0]}});
  assert.equal(grayscale.target,"user");
  assert.equal(grayscale.channel,"palette:grayscale:user");
  assert.equal(grayscale.persistFinal,true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(grayscale.frames[0].paletteEffect)),
    {
      operation:"grayscale",
      targets:{background:false,user:true,target:false,effects:false}
    }
  );
  assert.equal(restore.channel,"palette:grayscale:user");
  assert.equal(restore.frames[0].paletteEffect.operation,"identity");
  assert.equal(targetGray.channel,"palette:grayscale:target");
  assert.equal(targetGray.frames[0].paletteEffect.targets.target,true);
  const fixedGrayAnchor={offset:0x348,opcode:3,native:{pointer:0x1102,values:[4,0]}};
  registry.learn([fixedGrayAnchor],{domain:"move",id:195});
  const fixedGray=registry.resolve(fixedGrayAnchor),
    absentGray=registry.resolve({offset:0x349,opcode:3,native:{pointer:0x1102,values:[5,0]}}),
    fixedTargetGray=registry.resolve({offset:0x34a,opcode:3,native:{pointer:0x1102,values:[6,0]}});
  assert.equal(fixedGray.target,"user");
  assert.equal(fixedGray.channel,"palette:grayscale:user");
  assert.equal(absentGray.target,"absent");
  assert.equal(absentGray.frames.length,0);
  assert.equal(fixedTargetGray.target,"target");
  assert.equal(fixedTargetGray.frames[0].paletteEffect.targets.target,true);
  assert.equal(
    registry.resolve({offset:0x34c,opcode:3,native:{pointer:0x1101,values:[0,2]}}),
    null
  );
  const rotateAnchor={offset:0x34d,opcode:3,native:{pointer:0x1151,values:[4,256,0,2]}};
  registry.learn([rotateAnchor],{domain:"move",id:31});
  const rotate=registry.resolve(rotateAnchor);
  assert.equal(rotate.target,"user");
  assert.equal(rotate.channel,"transform:user:rotate-side");
  assert.equal(rotate.persistFinal,true);
  assert.equal(rotate.frames.length,8);
  assert.deepEqual(
    Array.from(rotate.frames,frame=>Math.round(frame.rotation*0x8000/Math.PI)),
    [-256,-512,-768,-1024,-768,-512,-256,0]
  );
  assert.ok(rotate.frames.slice(0,-1).every(frame=>frame.y>=0));
  assert.ok(rotate.frames.slice(0,-1).some(frame=>frame.y>0));
  assert.equal(rotate.frames.at(-1).y,0);
  const rotateTarget=registry.resolve({
    offset:0x34e,opcode:3,native:{pointer:0x1151,values:[6,384,1,2]}
  });
  assert.deepEqual(
    Array.from(rotateTarget.frames,frame=>Math.round(frame.rotation*0x8000/Math.PI)),
    [384,768,1152,1536,1920,2304,1920,1536,1152,768,384,0]
  );
  assert.ok(rotateTarget.frames.every(frame=>frame.y===0));
  const absentRotate=registry.resolve({
    offset:0x34e,opcode:3,native:{pointer:0x1151,values:[4,256,5,2]}
  });
  assert.equal(absentRotate.target,"absent");
  assert.equal(absentRotate.frames.length,0);
  assert.equal(registry.resolve({
    offset:0x34e,opcode:3,native:{pointer:0x1151,values:[4,256,0,9]}
  }),null);
  const patternAnchor={offset:0x34f,opcode:3,native:{pointer:0x1171,values:[30,3,1,0]}};
  registry.learn([patternAnchor],{domain:"move",id:87});
  const patternShake=registry.resolve(patternAnchor);
  assert.equal(patternShake.target,"target");
  assert.equal(patternShake.channel,"transform:target:pattern-shake");
  assert.equal(patternShake.frames.length,30);
  assert.deepEqual(
    Array.from(patternShake.frames.slice(0,10),frame=>[frame.x,frame.y]),
    [[0,3],[0,0],[0,3],[0,3],[0,0],[0,0],[0,3],[0,3],[0,3],[0,3]]
  );
  assert.deepEqual(
    [patternShake.frames.at(-1).x,patternShake.frames.at(-1).y],
    [0,0]
  );
  const horizontalPattern=registry.resolve({
    offset:0x350,opcode:3,native:{pointer:0x1171,values:[6,2,0,1]}
  });
  assert.deepEqual(
    Array.from(horizontalPattern.frames,frame=>[frame.x,frame.y]),
    [[0,0],[2,0],[0,0],[-2,0],[2,0],[0,0]]
  );
  const powerShakeAnchor={offset:0x351,opcode:3,native:{pointer:0x1201,values:[0,1,10,1,0]}};
  registry.learn([powerShakeAnchor],{domain:"move",id:229});
  assert.equal(registry.resolve(powerShakeAnchor),null);
  const powerShake=registry.resolve(powerShakeAnchor,{movePower:20});
  assert.equal(powerShake.target,"target");
  assert.equal(powerShake.channel,"transform:target:power-shake");
  assert.equal(powerShake.frames.length,20);
  assert.deepEqual(
    Array.from(powerShake.frames.slice(0,8),frame=>[frame.x,frame.y]),
    [[0,0],[0,0],[1,0],[1,0],[0,0],[0,0],[1,0],[1,0]]
  );
  const strongShake=registry.resolve(powerShakeAnchor,{movePower:120});
  assert.deepEqual(
    Array.from(strongShake.frames.slice(0,6),frame=>frame.x),
    [0,0,5,5,-5,-5]
  );
  const damageShake=registry.resolve({
    offset:0x354,opcode:3,native:{pointer:0x1201,values:[1,0,3,0,1]}
  },{moveDamage:48});
  assert.deepEqual(
    Array.from(damageShake.frames,frame=>[frame.x,frame.y]),
    [[0,0],[0,4],[0,0]]
  );
  assert.equal(
    registry.resolve({offset:0x358,opcode:3,native:{pointer:0x1201,values:[1,0,3,0,1]}},{movePower:48}),
    null
  );
  const backgroundShakeAnchor={offset:0x360,opcode:3,native:{pointer:0x1301,values:[0,2,3,1]}};
  registry.learn([backgroundShakeAnchor],{domain:"move",id:317});
  const backgroundShake=registry.resolve(backgroundShakeAnchor);
  assert.equal(backgroundShake.target,"background");
  assert.equal(backgroundShake.channel,"camera:background:bg3");
  assert.deepEqual(
    Array.from(backgroundShake.frames,frame=>[frame.x,frame.y]),
    [[0,2],[0,-2],[0,-2],[0,0],[0,0]]
  );
  const horizontalBackgroundShake=registry.resolve({
    offset:0x364,opcode:3,native:{pointer:0x1301,values:[2,0,3,0]}
  });
  assert.deepEqual(
    Array.from(horizontalBackgroundShake.frames,frame=>[frame.x,frame.y]),
    [[-2,0],[2,0]]
  );
  assert.equal(registry.resolve({
    offset:0x368,opcode:3,native:{pointer:0x1301,values:[0,2,0,1]}
  }),null);
  const painSplitAnchor={offset:0x36c,opcode:3,native:{pointer:0x1401,values:[0,0]}};
  registry.learn([painSplitAnchor],{domain:"move",id:220});
  const painSplit=registry.resolve(painSplitAnchor);
  assert.equal(painSplit.target,"user");
  assert.equal(painSplit.channel,"transform:user:pain-split");
  assert.equal(painSplit.frames.length,13);
  assert.deepEqual(Array.from(painSplit.frames,frame=>frame.x),[2,2,2,-2,-2,-2,2,2,2,-2,-2,-2,0]);
  assert.deepEqual(Array.from(painSplit.frames,frame=>frame.y),[6,6,6,6,6,6,6,6,6,6,6,6,0]);
  assert.equal(painSplit.frames[0].scaleX,0x100/0xe0);
  assert.equal(painSplit.frames[0].scaleY,0x100/0x140);
  assert.deepEqual(
    JSON.parse(JSON.stringify(painSplit.frames.at(-1))),
    {x:0,y:0,scaleX:1,scaleY:1,rotation:0,duration:1}
  );
  const angled=registry.resolve({offset:0x370,opcode:3,native:{pointer:0x1401,values:[1,2]}});
  assert.equal(angled.target,"target");
  assert.ok(angled.frames[0].rotation<0);
  assert.equal(angled.frames[0].y,5);
  assert.equal(registry.resolve({offset:0x374,opcode:3,native:{pointer:0x1401,values:[1,3]}}),null);
  const sliding=context.PokemonViewer.animation.GBA_ANIMATION_TASK_ADAPTERS.AnimTask_StartSlidingBg,
    slidingFrames=sliding.simulate([0xff00,0x0080,0,0xffff]);
  assert.equal(slidingFrames.length,256);
  assert.deepEqual(
    Array.from(slidingFrames.slice(0,4),frame=>[frame.x,frame.y]),
    [[-1,0],[-2,1],[-3,1],[-4,2]]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(sliding.stopSignal([0xff00,0x0080,0,0xffff]))),
    {arg:7,value:0xffff}
  );
  const ambiguous=new Registry({memoryProfile:{structure:()=>({
    locators:[{symbol:"AnimTask_InvertScreenColor",domain:"move",id:9,opcode:3,values:[257,257,257]}]
  })}});
  ambiguous.learn([
    invertAnchor,
    {offset:0x33a,opcode:3,native:{pointer:0x1002,values:[257,257,257]}}
  ],{domain:"move",id:9});
  assert.equal(ambiguous.resolve(invertAnchor),null);
  assert.equal(registry.resolve({offset:0x328,opcode:3,native:{pointer:0x999,values:[1,3,0,6,1]}}),null);
});

test("GBA callback adapters interpret only verified native callback contracts",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/callbacks.js"),context);
  const Registry=context.PokemonViewer.animation.GbaAnimationCallbackRegistry;
  const registry=new Registry({capabilities:{provenance:{symbols:{
    AnimHitSplatBasic:{offset:0x120,kind:"code"},
    gBasicHitSplatSpriteTemplate:{offset:0x200}
  }}}});
  const verified=registry.resolve(
    {offset:0x200,callback:0x121},
    {animBattler:"attacker",values:[0xfff8,4,1,2]}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(verified)),
    {
      anchor:"target",x:-8,y:4,affineAnimationIndex:2,lifetime:null,
      transient:true,accuracy:"verified",
      callbackSymbol:"AnimHitSplatBasic",templateSymbol:"gBasicHitSplatSpriteTemplate",
      verifiedCallback:true
    }
  );

  const unresolved=registry.resolve(
    {offset:0x240,callback:0x180},
    {animBattler:"target",values:[0x7fff,0x7fff]}
  );
  assert.equal(unresolved.anchor,"target");
  assert.equal(unresolved.x,0);
  assert.equal(unresolved.y,0);
  assert.equal(unresolved.affineAnimationIndex,null);
  assert.equal(unresolved.verifiedCallback,false);

  const templateRegistry=new Registry({capabilities:{provenance:{symbols:{
    gBasicHitSplatSpriteTemplate:{offset:0x200}
  }}}});
  const fromExportedTemplate=templateRegistry.resolve(
    {offset:0x200,callback:0x120},
    {animBattler:"attacker",values:[8,0,0,1]}
  );
  assert.equal(fromExportedTemplate.templateSymbol,"gBasicHitSplatSpriteTemplate");
  assert.equal(fromExportedTemplate.anchor,"user");
  assert.equal(fromExportedTemplate.x,8);
  assert.equal(fromExportedTemplate.verifiedCallback,true);
});

test("GBA plant callback adapters reproduce their native per-tick trajectories",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/callbacks.js"),context);
  const Registry=context.PokemonViewer.animation.GbaAnimationCallbackRegistry;
  const registry=new Registry({capabilities:{provenance:{symbols:{
    gPetalDanceBigFlowerSpriteTemplate:{offset:0x200},
    gRazorLeafParticleSpriteTemplate:{offset:0x240}
  }}}});
  const petals=registry.resolve({offset:0x200,callback:0},{values:[16,0xffe8,8,100]});
  assert.equal(petals.anchor,"userBase");
  assert.equal(petals.x,16);
  assert.equal(petals.y,-24);
  assert.equal(petals.transforms.length,100);
  assert.equal(petals.transforms.at(-1).toAnchor,"userPic");
  assert.equal(petals.transforms.at(-1).targetY,8);
  assert.equal(petals.transforms.at(-1).progress,1);
  assert.equal(petals.accuracy,"partial");
  assert.equal(petals.verifiedCallback,true);

  const leaf=registry.resolve({offset:0x240,callback:0},{values:[0xfffd,0xfffe,10]});
  assert.equal(leaf.anchor,"userPic");
  assert.equal(leaf.transforms.length,91);
  assert.deepEqual(
    [leaf.transforms[0].x,leaf.transforms[0].y],
    [-3,-2]
  );
  assert.equal(leaf.verifiedCallback,true);
});

test("GBA Bullet Seed reproduces the shared native Random2 rebound",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/callbacks.js"),context);
  const Registry=context.PokemonViewer.animation.GbaAnimationCallbackRegistry;
  const registry=new Registry({capabilities:{provenance:{symbols:{
    gBulletSeedSpriteTemplate:{offset:0x280}
  }}}});
  const seed=registry.resolve({offset:0x280,callback:0},{values:[20,0]});
  assert.equal(seed.anchor,"userPic");
  assert.equal(seed.x,20);
  assert.equal(seed.y,0);
  assert.equal(seed.transforms.length,36);
  assert.equal(seed.transforms[0].progress,1/20);
  assert.equal(seed.transforms[0].toAnchor,"targetPic");
  assert.equal(seed.transforms[20].progress,1);
  assert.equal(seed.transforms[20].x,0);
  assert.equal(seed.transforms.at(-1).x,15);
  assert.equal(seed.lifetime,36);
  assert.equal(seed.transient,true);
  assert.equal(seed.accuracy,"verified");
  assert.match(seed.diagnostic,/Random2 rebound/);
  assert.equal(seed.verifiedCallback,true);
  const next=registry.resolve({offset:0x280,callback:0},{values:[20,0]});
  assert.notEqual(next.transforms[24].y,seed.transforms[24].y);
});

test("Gen I animation transforms use native side rules and OAM origins",async()=>{
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gbc/visuals.js"),context);
  const transform=context.PokemonViewer.animation.Gen1BattleAnimationTransform;
  assert.equal(transform.resolve(transform.HFLIP,"player"),transform.NORMAL);
  assert.equal(transform.resolve(transform.REVERSE,"player"),transform.NORMAL);
  assert.equal(transform.resolve(transform.ENEMY,"player"),transform.HFLIP);
  assert.equal(transform.resolve(transform.ENEMY,"opponent"),transform.NORMAL);
  assert.equal(transform.resolve(transform.REVERSE,"opponent"),transform.REVERSE);
  assert.deepEqual(
    JSON.parse(JSON.stringify(transform.position(transform.NORMAL,{baseX:104,baseY:16,dx:0,dy:0}))),
    {x:96,y:0,flip:0}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(transform.position(transform.HVFLIP,{baseX:104,baseY:16,dx:0,dy:0}))),
    {x:56,y:104,flip:96}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(transform.position(transform.HFLIP,{baseX:104,baseY:16,dx:0,dy:0}))),
    {x:56,y:40,flip:32}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(transform.position(transform.COORDFLIP,{baseX:104,baseY:16,dx:0,dy:0}))),
    {x:56,y:104,flip:0}
  );
});

test("waitforvisualfinish clears completed visual objects and tasks",async()=>{
  class DriverRegistry{register(){}}
  const context=vm.createContext({PokemonViewer:{},DriverRegistry,globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/library.js"),context);
  const frames=context.PokemonViewer.animation.AnimationProgram.frames([
    {label:"Create",event:{kind:"sprite",value:{id:"effect"}}},
    {label:"Task",event:{kind:"task",value:"shake"}},
    {label:"Wait",event:{kind:"wait-visuals",value:"waitforvisualfinish"}}
  ]);
  assert.equal(frames[1].state.sprites.length,1);
  assert.equal(frames[1].state.tasks.length,1);
  assert.equal(frames[2].state.sprites.length,0);
  assert.equal(frames[2].state.tasks.length,0);
});

test("scene asset adapter reuses family catalogs without owning ROM addresses",async()=>{
  class RomMemory{
    constructor(bytes){this.bytes=bytes;}
    u8(offset){return this.bytes[offset];}
  }
  class AnimationDocument{constructor(values){Object.assign(this,values);}}
  const imageContexts=[],
    context=vm.createContext({
      PokemonViewer:{animation:{AnimationDocument}},
      RomMemory,
      MemoryUtils:{hex:value=>`0x${Number(value).toString(16).toUpperCase()}`},
      document:{createElement(){
        const canvas={width:0,height:0};
        canvas.getContext=()=>({
          createImageData(width,height){
            const image={width,height,data:new Uint8ClampedArray(width*height*4)};
            imageContexts.push(image);return image;
          },
          putImageData(){}
        });
        return canvas;
      }},
      console,
      globalThis:null
    });
  context.globalThis=context;
  vm.runInContext(await read("js/animation/asset-catalog.js"),context);
  const source=Object.freeze({
      offset:4,count:2,columns:2,title:"Native intro sheet",
      palette:Object.freeze(["#ffffff","#aaaaaa","#555555","#000000"])
    }),
    catalog={
      list:()=>[{id:"intro",label:"Intro"}],
      source:()=>source
    },
    codec={bytesPerTile:16,decodeTile:(_memory,offset)=>Array.from({length:64},()=>offset===4?1:2)},
    reader={family:"gen1",memory:new RomMemory(new Uint8Array(64))},
    Adapter=context.PokemonViewer.animation.AnimationAssetCatalog,
    documents=new Adapter(reader,{catalog,codec,prefix:"redblue",group:"Intro",fps:59.7}).list();
  assert.equal(documents.length,1);
  assert.equal(documents[0].id,"scene:redblue:intro");
  assert.equal(documents[0].frames.length,1);
  assert.equal(documents[0].frames[0].image.width,16);
  assert.equal(documents[0].frames[0].image.height,8);
  assert.equal(documents[0].accuracy,"partial");
  assert.match(documents[0].properties[2].value,/scene timing, tilemap and control program are not decoded/);
  assert.equal(imageContexts[0].data.some(value=>value!==0),true);
  const adapterSource=await read("js/animation/asset-catalog.js");
  assert.doesNotMatch(adapterSource,/0x[0-9a-f]{4,}/i);
  assert.doesNotMatch(adapterSource,/pokered|pokecrystal|pokeemerald/i);
});

test("animation layer picking isolates the topmost semantic scene resource",async()=>{
  const canvas={
    width:240,height:160,
    getContext:()=>({}),
    getBoundingClientRect:()=>({left:10,top:20,width:480,height:320})
  };
  const context=vm.createContext({globalThis:null});context.globalThis=context;
  vm.runInContext(await read("js/animation/renderer.js"),context);
  const renderer=new context.AnimationRenderer(canvas);
  renderer.hitRegions=[
    {id:"background",x:0,y:0,width:240,height:160},
    {id:"sprite-1",x:80,y:40,width:48,height:48}
  ];
  assert.equal(renderer.pickLayer(10+(100/240)*480,20+(60/160)*320),"sprite-1");
  assert.equal(renderer.pickLayer(12,22),"background");
  renderer.setIsolation("sprite-1");assert.equal(renderer.isolation,"sprite-1");
  renderer.setIsolation(null);assert.equal(renderer.isolation,null);
});
