import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

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
      {symbol:"AnimTask_TranslateMonEllipticalRespectSide",domain:"move",id:14,opcode:3,values:[0,16,6,1,4]}
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
  assert.equal(registry.resolve({offset:0x300,opcode:3,native:{pointer:0x999,values:[1,3,0,6,1]}}),null);
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
