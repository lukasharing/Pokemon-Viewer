import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

class Memory{
  constructor(bytes){this.bytes=Uint8Array.from(bytes);}
  contains(offset,length=1){return Number.isInteger(offset)&&offset>=0&&offset+length<=this.bytes.length;}
  u8(offset){return this.bytes[offset];}
  u16(offset){return this.bytes[offset]|this.bytes[offset+1]<<8;}
  slice(offset,length){return this.bytes.slice(offset,offset+length);}
  banked(bank,address){return bank*0x4000+(address&0x3fff);}
}

const load=async()=>{
  class GenericSoundDriver{}
  class SoundCommand{constructor(values){Object.assign(this,values);}}
  class SoundTrack{constructor(values){Object.assign(this,values);}}
  const context=vm.createContext({globalThis:null,Object,Array,Number,String,Uint8Array,PokemonViewer:{sound:{GenericSoundDriver,SoundCommand,SoundTrack,registry:{register(){}}},gen1:{}}});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/sound/gen1/driver.js",import.meta.url),"utf8"),context);
  return context.PokemonViewer.sound.Gen1AudioDecoder;
};

test("Red/Blue audio decoder reads native headers and its own command grammar",async()=>{
  const Decoder=await load(),bytes=new Uint8Array(0x80);
  bytes.set([0x40,0x20,0,0x01,0x30,0],0); // two channels, ids 1 and 2
  bytes.set([0xd6,0xa2,0xe3,0xed,0x01,0x00,0x21,0xff],0x20);
  bytes.set([0xd4,0x92,0x31,0xff],0x30);
  const tracks=new Decoder(new Memory(bytes)).program(0);
  assert.equal(tracks.length,2);
  assert.deepEqual(Array.from(tracks,track=>track.channel),["Pulse 1","Pulse 2"]);
  assert.deepEqual(Array.from(tracks[0].commands,command=>command.name),["note_type","octave","tempo","note","sound_ret"]);
  assert.deepEqual(Array.from(tracks[0].commands,command=>command.tick),[0,0,0,0,12]);
});
