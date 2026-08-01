import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

class Memory{
  constructor(bytes){this.bytes=Uint8Array.from(bytes);}
  contains(offset,length=1){return Number.isInteger(offset)&&offset>=0&&offset+length<=this.bytes.length;}
  u8(offset){if(!this.contains(offset))throw new RangeError();return this.bytes[offset];}
  slice(offset,length){if(!this.contains(offset,length))throw new RangeError();return this.bytes.slice(offset,offset+length);}
  pointer(offset){
    if(!this.contains(offset,4))throw new RangeError();
    const raw=this.bytes[offset]|this.bytes[offset+1]<<8|this.bytes[offset+2]<<16|this.bytes[offset+3]<<24;
    if((raw>>>24)!==8)throw new RangeError();return(raw>>>0)-0x08000000;
  }
}

const load=async()=>{
  class GenericSoundDriver{}
  class SoundCommand{constructor(values){Object.assign(this,values);}}
  const registry={register(){}};
  const context=vm.createContext({globalThis:null,Map,Object,Set,Array,Number,String,Uint8Array,PokemonViewer:{sound:{GenericSoundDriver,SoundCommand,hex:value=>`0x${value.toString(16).toUpperCase().padStart(6,"0")}`,registry},gba:{assets:{profile(){return null;}}}}});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/sound/gba/driver.js",import.meta.url),"utf8"),context);
  return context.PokemonViewer.sound.GbaM4aDecoder;
};

test("Emerald M4A decoder uses exact MPlayDef command widths and stops at GOTO",async()=>{
  const Decoder=await load();
  const memory=new Memory([0xBC,0x00,0xBB,150,0xD5,60,100,0x86,0xB2,0x10,0x00,0x00,0x08,0xB6,0,0,0]);
  const commands=new Decoder(memory).decode(0);
  assert.deepEqual(Array.from(commands,command=>command.name),["KEYSH","TEMPO","N06","W06","GOTO"]);
  assert.deepEqual(Array.from(commands,command=>command.offset),[0,2,4,7,8]);
  assert.deepEqual(Array.from(commands,command=>command.tick),[0,0,0,0,6]);
  assert.deepEqual(Array.from(commands[2].arguments),[6,60,100]);
  assert.equal(commands[4].arguments[0],"0x000010");
});

test("Emerald M4A decoder keeps unsupported bytes explicit",async()=>{
  const Decoder=await load(),commands=new Decoder(new Memory([0xB6,0xB1])).decode(0);
  assert.equal(commands[0].name,"DATA");assert.equal(commands[0].accuracy,"partial");
  assert.equal(commands[1].name,"FINE");assert.equal(commands[1].accuracy,"verified");
});

test("Emerald M4A interpreter expands patterns and running status with bounded control flow",async()=>{
  const Decoder=await load();
  const bytes=new Uint8Array(40);
  bytes.set([0xBB,75,0xB3,0x14,0,0,8,0xD5,60,100,0x86,0xB1],0);
  bytes.set([0xBE,100,90,0x85,0xB4],20);
  const execution=new Decoder(new Memory(bytes)).execute(0);
  assert.deepEqual(Array.from(execution.commands,command=>command.name),["TEMPO","PATT","VOL","VOL","W05","PEND","N06","W06","FINE"]);
  assert.deepEqual(Array.from(execution.commands.slice(2,4),command=>Array.from(command.arguments)),[[100],[90]]);
  assert.equal(execution.complete,true);
  assert.equal(execution.reason,"fine");
});
