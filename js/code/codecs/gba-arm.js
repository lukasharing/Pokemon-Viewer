(function(global){
  "use strict";
  const CONDITIONS=["eq","ne","cs","cc","mi","pl","vs","vc","hi","ls","ge","lt","gt","le","","nv"];
  const hex=(value,width)=>`0x${(value>>>0).toString(16).toUpperCase().padStart(width,"0")}`;
  global.GbaCodeCodec=Object.freeze({
    id:"gba-arm",label:"ARM7TDMI",modes:[{id:"thumb",label:"Thumb (16-bit)"},{id:"arm",label:"ARM (32-bit)"}],alignment:2,
    decode(memory,offset,{mode="thumb"}={}){
      if(mode==="thumb"){
        const op=memory.u16(offset);
        if((op&0xf800)===0xe000){const displacement=(op&0x7ff)<<1<<20>>20;return{size:2,mnemonic:"b",operands:hex(offset+4+displacement,6)};}
        if((op&0xf800)===0x2000)return{size:2,mnemonic:"mov",operands:`r${(op>>8)&7}, #${op&0xff}`};
        if((op&0xf800)===0x3000)return{size:2,mnemonic:"add",operands:`r${(op>>8)&7}, #${op&0xff}`};
        if((op&0xf800)===0x4800)return{size:2,mnemonic:"ldr",operands:`r${(op>>8)&7}, [pc, #${(op&0xff)<<2}]`};
        if(op===0x4770)return{size:2,mnemonic:"bx",operands:"lr"};
        return{size:2,mnemonic:".hword",operands:hex(op,4)};
      }
      const op=memory.u32(offset),condition=CONDITIONS[op>>>28];
      if((op&0x0e000000)===0x0a000000){const displacement=(op&0xffffff)<<2<<6>>6;return{size:4,mnemonic:`b${op&0x01000000?"l":""}${condition}`,operands:hex(offset+8+displacement,8)};}
      if((op&0x0c000000)===0x04000000){const load=Boolean(op&0x00100000),rd=(op>>12)&15,rn=(op>>16)&15;return{size:4,mnemonic:`${load?"ldr":"str"}${condition}`,operands:`r${rd}, [r${rn}, #${op&0xfff}]`};}
      if(op===0xe12fff1e)return{size:4,mnemonic:"bx",operands:"lr"};
      return{size:4,mnemonic:".word",operands:hex(op,8)};
    }
  });
})(globalThis);
