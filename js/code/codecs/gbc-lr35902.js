(function(global){
  "use strict";
  const R=["b","c","d","e","h","l","[hl]","a"];
  const RP=["bc","de","hl","sp"],RP2=["bc","de","hl","af"];
  const CC=["nz","z","nc","c"];
  const ALU=["add a, ","adc a, ","sub ","sbc a, ","and ","xor ","or ","cp "];
  const ROT=["rlc","rrc","rl","rr","sla","sra","swap","srl"];
  const MISC=["rlca","rrca","rla","rra","daa","cpl","scf","ccf"];
  const hex=(value,width)=>`$${(value>>>0).toString(16).toUpperCase().padStart(width,"0")}`;
  const signed=value=>value&0x80?value-0x100:value;
  const cpuAddress=offset=>offset<0x4000?offset:0x4000+(offset%0x4000);

  function instruction(memory,offset){
    const opcode=memory.u8(offset),x=opcode>>6,y=opcode>>3&7,z=opcode&7,p=y>>1,q=y&1;
    const u8=()=>memory.u8(offset+1),u16=()=>memory.u16(offset+1);
    const relative=()=>hex((cpuAddress(offset)+2+signed(u8()))&0xffff,4);
    let size=1,text;
    if(x===0){
      if(z===0){
        if(y===0)text="nop";
        else if(y===1){size=3;text=`ld [${hex(u16(),4)}], sp`;}
        else if(y===2){size=2;text=`stop ${hex(u8(),2)}`;}
        else if(y===3){size=2;text=`jr ${relative()}`;}
        else{size=2;text=`jr ${CC[y-4]}, ${relative()}`;}
      }else if(z===1){
        if(!q){size=3;text=`ld ${RP[p]}, ${hex(u16(),4)}`;}
        else text=`add hl, ${RP[p]}`;
      }else if(z===2){
        const target=["[bc]","[de]","[hli]","[hld]"][p];
        text=q?`ld a, ${target}`:`ld ${target}, a`;
      }else if(z===3)text=`${q?"dec":"inc"} ${RP[p]}`;
      else if(z===4)text=`inc ${R[y]}`;
      else if(z===5)text=`dec ${R[y]}`;
      else if(z===6){size=2;text=`ld ${R[y]}, ${hex(u8(),2)}`;}
      else text=MISC[y];
    }else if(x===1)text=opcode===0x76?"halt":`ld ${R[y]}, ${R[z]}`;
    else if(x===2)text=ALU[y]+R[z];
    else if(z===0){
      if(y<4)text=`ret ${CC[y]}`;
      else if(y===4){size=2;text=`ldh [${hex(u8(),2)}], a`;}
      else if(y===5){size=2;text=`add sp, ${signed(u8())}`;}
      else if(y===6){size=2;text=`ldh a, [${hex(u8(),2)}]`;}
      else{size=2;text=`ld hl, sp ${signed(u8())<0?"-":"+"} ${Math.abs(signed(u8()))}`;}
    }else if(z===1){
      if(!q)text=`pop ${RP2[p]}`;
      else text=["ret","reti","jp hl","ld sp, hl"][p];
    }else if(z===2){
      if(y<4){size=3;text=`jp ${CC[y]}, ${hex(u16(),4)}`;}
      else if(y===4)text="ldh [c], a";
      else if(y===5){size=3;text=`ld [${hex(u16(),4)}], a`;}
      else if(y===6)text="ldh a, [c]";
      else{size=3;text=`ld a, [${hex(u16(),4)}]`;}
    }else if(z===3){
      if(y===0){size=3;text=`jp ${hex(u16(),4)}`;}
      else if(y===1){
        size=2;const cb=u8(),cx=cb>>6,cy=cb>>3&7,cz=cb&7;
        text=cx===0?`${ROT[cy]} ${R[cz]}`:cx===1?`bit ${cy}, ${R[cz]}`:cx===2?`res ${cy}, ${R[cz]}`:`set ${cy}, ${R[cz]}`;
      }else if(y===6)text="di";
      else if(y===7)text="ei";
    }else if(z===4){
      if(y<4){size=3;text=`call ${CC[y]}, ${hex(u16(),4)}`;}
    }else if(z===5){
      if(!q)text=`push ${RP2[p]}`;
      else if(p===0){size=3;text=`call ${hex(u16(),4)}`;}
    }else if(z===6){size=2;text=ALU[y]+hex(u8(),2);}
    else text=`rst ${hex(y*8,2)}`;
    if(!text)return{size:1,mnemonic:"db",operands:hex(opcode,2),unknown:true};
    const split=text.indexOf(" ");
    return split<0?{size,mnemonic:text,operands:""}:{size,mnemonic:text.slice(0,split),operands:text.slice(split+1)};
  }

  const GbcCodeCodec=Object.freeze({
    id:"gbc-lr35902",label:"LR35902 / RGBDS",modes:[{id:"lr35902",label:"LR35902"}],alignment:1,
    decode:instruction,
    source(memory,start,end){
      const lines=[`; RGBDS source decompiled from ROM`,`Code_${start.toString(16).toUpperCase().padStart(6,"0")}:`];
      for(let offset=start;offset<end;){
        const decoded=instruction(memory,offset),size=Math.min(decoded.size,end-offset);
        const bytes=Array.from(memory.slice(offset,size),byte=>hex(byte,2)).join(", ");
        lines.push(`\tdb ${bytes} ; ${decoded.mnemonic}${decoded.operands?` ${decoded.operands}`:""}`);
        offset+=size;
      }
      return lines.join("\n");
    }
  });
  global.GbcCodeCodec=GbcCodeCodec;
  ((global.PokemonViewer||={}).code||={}).GbcCodeCodec=GbcCodeCodec;
})(globalThis);
