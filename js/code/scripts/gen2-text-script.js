(function(global){
  "use strict";
  const hex=(value,width=2)=>`$${value.toString(16).toUpperCase().padStart(width,"0")}`;
  const definitions=[
    ["text",0x00,[],true],["text_ram",0x01,[2]],["text_bcd",0x02,[2,1]],["text_move",0x03,[2]],["text_box",0x04,[2,1,1]],
    ["text_low",0x05,[]],["text_promptbutton",0x06,[]],["text_scroll",0x07,[]],["text_asm",0x08,[],false,true],
    ["text_decimal",0x09,[2,1]],["text_pause",0x0a,[]],["sound_dex_fanfare_50_79",0x0b,[]],["text_dots",0x0c,[1]],
    ["text_waitbutton",0x0d,[]],["sound_dex_fanfare_20_49",0x0e,[]],["sound_item",0x0f,[]],["sound_caught_mon",0x10,[]],
    ["sound_dex_fanfare_80_109",0x11,[]],["sound_fanfare",0x12,[]],["sound_slot_machine_start",0x13,[]],
    ["text_buffer",0x14,[1]],["text_today",0x15,[]],["text_far",0x16,[2,1]],["text_end",0x50,[],false,true]
  ];
  const commands=new Map(definitions.map(([name,opcode,args,text=false,end=false])=>[opcode,{name,opcode,args,text,end}]));
  const names=new Map([...commands.values()].map(definition=>[definition.name,definition]));
  const controls=new Map([[0x4c,"page"],[0x4e,"next"],[0x4f,"line"],[0x51,"para"],[0x55,"cont"],[0x57,"done"],[0x58,"prompt"]]);
  const controlBytes=new Map([...controls].map(([byte,name])=>[name,byte]));

  class Gen2TextScriptCodec{
    constructor(reader){
      this.reader=reader;
      const dictionary=reader.getDictionary?.(reader.textDictionary);
      this.table=new TextTableCodec(dictionary||[]);
    }
    decompile(offset,{limit=256}={}){
      const lines=["; pret/pokecrystal RGBDS text macros",`Text_${offset.toString(16).toUpperCase().padStart(6,"0")}:`],records=[];
      let cursor=offset;
      const text=()=>{const start=cursor;while(cursor<this.reader.size&&cursor-offset<limit&&!commands.has(this.reader.memory.u8(cursor))&&!controls.has(this.reader.memory.u8(cursor)))cursor++;return this.table.decode(this.reader.memory.slice(start,cursor-start));};
      while(cursor<this.reader.size&&cursor-offset<limit){
        const start=cursor,opcode=this.reader.memory.u8(cursor++),control=controls.get(opcode),definition=commands.get(opcode);
        if(control){
          const value=control==="done"||control==="prompt"?"":text();
          lines.push(`${control}${value?` "${this.escape(value)}"`:""}`);records.push({offset:start,size:cursor-start,name:control,text:value});
          if(control==="done"||control==="prompt")break;continue;
        }
        if(!definition){cursor=start;const value=text();if(!value){cursor++;lines.push(`db ${hex(opcode)} ; unknown`);records.push({offset:start,size:1,name:"db"});}else{lines.push(`raw_text "${this.escape(value)}"`);records.push({offset:start,size:cursor-start,name:"raw_text",text:value});}continue;}
        if(definition.text){const value=text();lines.push(`text "${this.escape(value)}"`);records.push({offset:start,size:cursor-start,name:"text",text:value});continue;}
        const values=definition.args.map(width=>{const value=width===2?this.reader.memory.u16(cursor):this.reader.memory.u8(cursor);cursor+=width;return value;});
        lines.push(`${definition.name}${values.length?` ${values.map((value,index)=>hex(value,definition.args[index]*2)).join(", ")}`:""}`);
        records.push({offset:start,size:cursor-start,name:definition.name,args:values});if(definition.end)break;
      }
      return{language:"RGBDS / pret/pokecrystal text macros",source:lines.join("\n"),records,bytes:cursor-offset};
    }
    compile(source){
      const bytes=[];
      for(const [lineIndex,raw] of source.split(/\r?\n/).entries()){
        const line=this.stripComment(raw).trim();if(!line||line.endsWith(":"))continue;
        const quoted=line.match(/^(text|raw_text|next|line|para|cont|page)\s+"((?:\\.|[^"])*)"$/i);
        if(quoted){const name=quoted[1].toLowerCase();if(name!=="raw_text")bytes.push(name==="text"?0:controlBytes.get(name));bytes.push(...this.encode(this.unescape(quoted[2],lineIndex),lineIndex));continue;}
        const [word,...tail]=line.split(/\s+/),name=word.toLowerCase();
        if(controlBytes.has(name)){bytes.push(controlBytes.get(name));continue;}
        if(name==="db"){for(const token of tail.join(" ").split(","))bytes.push(this.number(token,lineIndex,1));continue;}
        const definition=names.get(name);if(!definition)throw new SyntaxError(`Line ${lineIndex+1}: unknown Gen II text macro '${word}'.`);
        const args=tail.join(" ").split(",").map(value=>value.trim()).filter(Boolean);
        if(args.length!==definition.args.length)throw new SyntaxError(`Line ${lineIndex+1}: ${word} expects ${definition.args.length} argument(s).`);
        bytes.push(definition.opcode);
        args.forEach((token,index)=>{const width=definition.args[index],value=this.number(token,lineIndex,width);for(let byte=0;byte<width;byte++)bytes.push(value>>byte*8&0xff);});
      }
      return Uint8Array.from(bytes);
    }
    number(token,line,width){return BinaryCodecUtils.number(token,{line:line+1,width});}
    encode(value,line){try{return this.table.encode(value);}catch(error){throw new SyntaxError(`Line ${line+1}: ${error.message}`);}}
    stripComment(value){let quoted=false;for(let index=0;index<value.length;index++){if(value[index]==='"'&&value[index-1]!=="\\")quoted=!quoted;if(value[index]===";"&&!quoted)return value.slice(0,index);}return value;}
    escape(value){return value.replace(/\\/g,"\\\\").replace(/"/g,'\\"');}
    unescape(value,line){try{return JSON.parse(`"${value}"`);}catch{throw new SyntaxError(`Line ${line+1}: invalid quoted text.`);}}
  }
  global.Gen2TextScriptCodec=Gen2TextScriptCodec;
  ((global.PokemonViewer||={}).code||={}).Gen2TextScriptCodec=Gen2TextScriptCodec;
})(globalThis);
