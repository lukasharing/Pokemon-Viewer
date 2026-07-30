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
  const context=vm.createContext({PokemonViewer:{animation:{}},globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/animation/gba/visuals.js"),context);
  const Visuals=context.PokemonViewer.animation.GbaBattleAnimationVisuals,fixture=memoryFixture();
  const instance=Object.create(Visuals.prototype);instance.memory=fixture.memory;instance.paletteTable=0;

  fixture.u32(0,0x08000120);fixture.u16(4,10000);
  fixture.u32(8,0x08000140);fixture.u16(12,10135);
  assert.equal(instance.paletteRecord(10135).paletteOffset,0x140);
  assert.equal(instance.paletteRecord(10001),null);

  fixture.u32(108,200);
  fixture.u16(200,0x00b0);fixture.u16(202,0x00b0);
  fixture.u16(208,0);fixture.u16(210,0);fixture.bytes[212]=0;fixture.bytes[213]=8;
  fixture.u16(216,0x7fff);
  const frames=instance.affineFrames({affine:true,affineAnims:100},2);
  assert.equal(frames.length,8);
  assert.equal(frames[0].scaleX,0x100/0xb0);
  assert.equal(frames.at(-1).scaleY,0x100/0xb0);
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
