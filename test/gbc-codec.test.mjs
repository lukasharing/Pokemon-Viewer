import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function codec(){
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/code/codecs/gbc-lr35902.js",import.meta.url),"utf8"),context);
  return context.GbcCodeCodec;
}

const memory=bytes=>({
  u8(offset){return bytes[offset]??0;},
  u16(offset){return this.u8(offset)|(this.u8(offset+1)<<8);},
  slice(offset,length){return Uint8Array.from(bytes.slice(offset,offset+length));}
});

test("LR35902 decompiler covers every base and CB opcode without fabricated commands",async()=>{
  const decoder=await codec();
  for(let opcode=0;opcode<256;opcode++){
    const decoded=decoder.decode(memory([opcode,0x7c,0x12]),0);
    assert.ok(decoded.size>=1&&decoded.size<=3,`opcode ${opcode.toString(16)}`);
    assert.ok(decoded.mnemonic);
  }
  for(let opcode=0;opcode<256;opcode++){
    const decoded=decoder.decode(memory([0xcb,opcode]),0);
    assert.equal(decoded.size,2);
    assert.match(`${decoded.mnemonic} ${decoded.operands}`,/^(rlc|rrc|rl|rr|sla|sra|swap|srl|bit|res|set) /);
  }
});

test("LR35902 decompiler emits byte-exact RGBDS source with readable instructions",async()=>{
  const decoder=await codec(),bytes=[0x3e,0x2a,0xcb,0x7c,0x20,0xfa,0xc9],rom=memory(bytes);
  assert.deepEqual({...decoder.decode(rom,0)},{size:2,mnemonic:"ld",operands:"a, $2A"});
  assert.deepEqual({...decoder.decode(rom,2)},{size:2,mnemonic:"bit",operands:"7, h"});
  assert.deepEqual({...decoder.decode(rom,4)},{size:2,mnemonic:"jr",operands:"nz, $0000"});
  const source=decoder.source(rom,0,bytes.length);
  assert.match(source,/; RGBDS source decompiled from ROM/);
  assert.match(source,/db \$3E, \$2A ; ld a, \$2A/);
  assert.match(source,/db \$CB, \$7C ; bit 7, h/);
});
