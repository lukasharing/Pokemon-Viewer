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
      u8:offset=>bytes[offset],
      u16:offset=>bytes[offset]|bytes[offset+1]<<8,
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
