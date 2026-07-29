globalThis.GbcTextCodec = class GbcTextCodec {
  static TOKENS = new Map([
    [0x49,"\n\n"],[0x4e,"\n"],[0x4f,"\n"],[0x51,"\n\n"],[0x52,"<PLAYER>"],[0x53,"<RIVAL>"],
    [0x54,"POKé"],[0x55,"\n"],[0x56,"…"],[0x57,""],[0x58,""],
    [0x7f," "],[0x9a,"("],[0x9b,")"],[0x9c,":"],[0x9d,";"],
    [0x9e,"["],[0x9f,"]"],[0xba,"é"],[0xbb,"'d"],[0xbc,"'l"],
    [0xbd,"'s"],[0xbe,"'t"],[0xbf,"'v"],[0xe0,"'"],[0xe1,"PK"],
    [0xe2,"MN"],[0xe3,"-"],[0xe4,"'r"],[0xe5,"'m"],[0xe6,"?"],
    [0xe7,"!"],[0xe8,"."],[0xf1,"×"],[0xf3,"/"],[0xf4,","],
    [0xf5,"♀"],[0xef,"♂"]
  ]);

  constructor(memory,dictionary=[]) { this.memory=memory;this.textTable=dictionary?.length?new TextTableCodec(dictionary):null; }

  character(byte) {
    if(byte>=0x80&&byte<=0x99)return String.fromCharCode(65+byte-0x80);
    if(byte>=0xa0&&byte<=0xb9)return String.fromCharCode(97+byte-0xa0);
    if(byte>=0xf6&&byte<=0xff)return String(byte-0xf6);
    return GbcTextCodec.TOKENS.get(byte)??this.textTable?.decodeByte(byte)??"";
  }

  resolve(offset, depth=0) {
    if(depth>4||!this.memory.contains(offset))throw new RangeError("Invalid or recursive Gen I text pointer.");
    // pokered's text_far command stores dw address, db bank immediately after $17.
    if(this.memory.u8(offset)===0x17&&this.memory.contains(offset,4))
      return this.resolve(this.memory.banked(this.memory.u8(offset+3),this.memory.u16(offset+1)),depth+1);
    return offset;
  }

  analyze(offset) {
    this.memory.assertRange(offset);
    const command=this.memory.u8(offset);
    if(command===0x17&&this.memory.contains(offset,4)){
      const textOffset=this.resolve(offset);
      return Object.freeze({kind:"text",command:"text_far",offset,textOffset,preview:this.decode(textOffset)});
    }
    if(command===0x08)
      return Object.freeze({kind:"assembly",command:"text_asm",offset,scriptOffset:offset+1,view:"original"});
    if(command===0x00||command>=0x4f)
      return Object.freeze({kind:"text",command:command===0x00?"text":"inline",offset,textOffset:offset,preview:this.decode(offset)});
    return Object.freeze({kind:"text-script",command:`text_command_${command.toString(16).padStart(2,"0")}`,offset,scriptOffset:offset,view:"script"});
  }

  decode(offset,{limit=512}={}) {
    let cursor=this.resolve(offset),result="";
    for(let read=0;read<limit&&this.memory.contains(cursor);read++,cursor++){
      const byte=this.memory.u8(cursor);
      // Gen I has several terminal text commands. In particular, Pokédex
      // descriptions end with <DEXEND> ($5f), not the usual '@' ($50).
      if(byte===0x50||byte===0x57||byte===0x58||byte===0x5f)break;
      if(byte===0x00)continue; // `text` command before inline characters.
      if(byte===0x17&&this.memory.contains(cursor,4)){
        result+=this.decode(cursor,{limit:limit-read});
        break;
      }
      const character=this.character(byte);
      result+=character||`[${byte.toString(16).padStart(2,"0")}]`;
    }
    return result.replace(/[ \t]+\n/g,"\n").trim();
  }
};
