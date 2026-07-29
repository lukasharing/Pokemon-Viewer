(function(global){
  "use strict";
  const hex=(value,width=2)=>`0x${(value>>>0).toString(16).toUpperCase().padStart(width,"0")}`;
  const COMMANDS=new Map([
    [0x00,{name:"text",args:[],text:true}],[0x01,{name:"text_ram",args:["word"]}],[0x02,{name:"text_bcd",args:["word","byte"]}],
    [0x03,{name:"text_move",args:["word"]}],[0x04,{name:"text_box",args:["word","byte","byte"]}],[0x05,{name:"text_low",args:[]}],
    [0x06,{name:"text_promptbutton",args:[]}],[0x07,{name:"text_scroll",args:[]}],[0x08,{name:"text_asm",args:[],end:true}],
    [0x09,{name:"text_decimal",args:["word","byte"]}],[0x0a,{name:"text_pause",args:[]}],[0x0b,{name:"sound_get_item_1",args:[]}],
    [0x0c,{name:"text_dots",args:["byte"]}],[0x0d,{name:"text_waitbutton",args:[]}],[0x0e,{name:"sound_pokedex_rating",args:[]}],
    [0x0f,{name:"sound_get_item_1_duplicate",args:[]}],[0x10,{name:"sound_get_item_2",args:[]}],[0x11,{name:"sound_get_key_item",args:[]}],
    [0x12,{name:"sound_caught_mon",args:[]}],[0x13,{name:"sound_dex_page_added",args:[]}],[0x14,{name:"sound_cry_nidorina",args:[]}],
    [0x15,{name:"sound_cry_pidgeot",args:[]}],[0x16,{name:"sound_cry_dewgong",args:[]}],[0x17,{name:"text_far",args:["word","byte"]}],
    [0x50,{name:"text_end",args:[],end:true}]
  ]);
  // These are top-level dispatcher IDs, not text characters. Their bytes
  // overlap the Gen I charmap digits, so readText must never treat this map as
  // a text terminator.
  const SPECIAL_COMMANDS=new Map([
    [0xff,{name:"script_pokecenter_nurse",args:[],end:true}],
    [0xfe,{name:"script_mart",variable:"items",end:true}],
    [0xfd,{name:"script_bills_pc",args:[],end:true}],
    [0xfc,{name:"script_players_pc",args:[],end:true}],
    [0xf9,{name:"script_pokecenter_pc",args:[],end:true}],
    [0xf7,{name:"script_prize_vendor",args:[],end:true}],
    [0xf6,{name:"script_cable_club_receptionist",args:[],end:true}],
    [0xf5,{name:"script_vending_machine",args:[],end:true}]
  ]);
  const BY_NAME=new Map([...COMMANDS,...SPECIAL_COMMANDS].map(([opcode,definition])=>[definition.name,{opcode,...definition}]));
  const CONTROLS=new Map([[0x4c,"page"],[0x4e,"next"],[0x4f,"line"],[0x51,"para"],[0x55,"cont"],[0x57,"done"],[0x58,"prompt"]]);
  const CHARS=new Map([
    [0x52,"<PLAYER>"],[0x53,"<RIVAL>"],[0x54,"#"],[0x56,"…"],[0x7f," "],
    [0x9a,"("],[0x9b,")"],[0x9c,":"],[0x9d,";"],[0x9e,"["],[0x9f,"]"],
    [0xba,"é"],[0xe0,"'"],[0xe3,"-"],[0xe6,"?"],[0xe7,"!"],[0xe8,"."],
    [0xef,"♂"],[0xf1,"×"],[0xf3,"/"],[0xf4,","],[0xf5,"♀"]
  ]);
  for(let byte=0x80;byte<=0x99;byte++)CHARS.set(byte,String.fromCharCode(65+byte-0x80));
  for(let byte=0xa0;byte<=0xb9;byte++)CHARS.set(byte,String.fromCharCode(97+byte-0xa0));
  for(let byte=0xf6;byte<=0xff;byte++)CHARS.set(byte,String(byte-0xf6));
  const ENCODE=[...CHARS].sort((a,b)=>b[1].length-a[1].length);

  class GbcTextScriptCodec{
    constructor(reader){this.reader=reader;const dictionary=reader.getDictionary?.(reader.textDictionary);this.textTable=dictionary?.length?new TextTableCodec(dictionary):null;}
    decompile(offset,{limit=256}={}){
      const lines=[`; RGBDS text macros`,`Text_${hex(offset,6).slice(2)}:`],records=[],links=[];let cursor=offset;
      const readText=()=>{let value="";while(cursor<this.reader.size&&cursor-offset<limit){const byte=this.reader.memory.u8(cursor),character=this.character(byte);if(!character||COMMANDS.has(byte)||CONTROLS.has(byte))break;value+=character;cursor++;}return value;};
      while(cursor<this.reader.size&&cursor-offset<limit){
        const start=cursor,byte=this.reader.memory.u8(cursor++),control=CONTROLS.get(byte),definition=COMMANDS.get(byte)||SPECIAL_COMMANDS.get(byte);
        if(control){
          const text=control==="done"||control==="prompt"?"":readText(),quoted=text?` "${this.escape(text)}"`:"";
          lines.push(`${control}${quoted}`);records.push({offset:start,size:cursor-start,name:control,text});if(control==="done"||control==="prompt")break;continue;
        }
        if(definition){
          if(definition.text){const text=readText();lines.push(`text "${this.escape(text)}"`);records.push({offset:start,size:cursor-start,name:"text",text});continue;}
          if(definition.variable==="items"){
            const count=this.reader.memory.u8(cursor++),values=[];
            for(let index=0;index<count&&cursor<this.reader.size&&cursor-offset<limit;index++)values.push(this.reader.memory.u8(cursor++));
            if(cursor<this.reader.size&&this.reader.memory.u8(cursor)===0xff)cursor++;
            lines.push(`${definition.name}${values.length?" "+values.map(value=>`$${value.toString(16).padStart(2,"0")}`).join(", "):""}`);
            records.push({offset:start,size:cursor-start,name:definition.name,args:values});break;
          }
          const decoded=BinaryCodecUtils.read(this.reader.memory,cursor,definition.args);cursor=decoded.cursor;
          const values=decoded.values;
          lines.push(`${definition.name}${values.length?" "+BinaryCodecUtils.format(values,definition.args):""}`);
          const record={offset:start,size:cursor-start,name:definition.name,args:values,argOffsets:decoded.offsets};records.push(record);
          if(definition.name==="text_far"){
            const link=MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gen2Far(this.reader.memory,record.argOffsets[1],record.argOffsets[0],{kind:"text",label:"Open far text"}));
            if(link)links.push(link);
          }
          if(definition.end)break;continue;
        }
        const character=this.character(byte);
        if(character){const text=character+readText();lines.push(`raw_text "${this.escape(text)}"`);records.push({offset:start,size:cursor-start,name:"raw_text",text});}
        else{lines.push(`db $${byte.toString(16).padStart(2,"0")} ; unknown`);records.push({offset:start,size:1,name:"db"});}
      }
      return{language:"RGBDS / pret text macros",source:lines.join("\n"),records,links,bytes:cursor-offset};
    }
    compile(source){
      const bytes=[];
      for(const [index,raw] of source.split(/\r?\n/).entries()){
        const line=this.stripComment(raw).trim();if(!line||/:$/.test(line))continue;
        const string=line.match(/^(text|raw_text|next|line|para|cont|page)\s+"((?:\\.|[^"])*)"$/i);
        if(string){const name=string[1].toLowerCase(),prefix={text:0x00,next:0x4e,line:0x4f,para:0x51,cont:0x55,page:0x4c}[name];if(prefix!==undefined)bytes.push(prefix);bytes.push(...this.encodeString(this.unescape(string[2],index),index));continue;}
        const [name,...rest]=line.split(/\s+/),normalized=name.toLowerCase();
        if(normalized==="done"||normalized==="prompt"){bytes.push(normalized==="done"?0x57:0x58);continue;}
        if(normalized==="db"){for(const token of rest.join(" ").split(",")){const value=this.number(token.trim(),index);if(value<0||value>0xff)throw new RangeError(`Line ${index+1}: ${token.trim()} does not fit byte.`);bytes.push(value);}continue;}
        const definition=BY_NAME.get(normalized);if(!definition)throw new SyntaxError(`Line ${index+1}: unknown Gen I text macro '${name}'.`);
        const args=rest.join(" ").split(",").map(value=>value.trim()).filter(Boolean);
        if(definition.variable==="items"){
          if(args.length>0xfe)throw new RangeError(`Line ${index+1}: ${name} accepts at most 254 items.`);
          const values=args.map(value=>this.number(value,index));bytes.push(definition.opcode,args.length);
          BinaryCodecUtils.append(bytes,Array(args.length).fill("byte"),values,{line:index+1});bytes.push(0xff);continue;
        }
        if(args.length!==definition.args.length)throw new SyntaxError(`Line ${index+1}: ${name} expects ${definition.args.length} argument(s).`);
        const values=args.map(value=>this.number(value,index));bytes.push(definition.opcode);BinaryCodecUtils.append(bytes,definition.args,values,{line:index+1});
      }
      return Uint8Array.from(bytes);
    }
    number(token,index){return BinaryCodecUtils.number(token,{line:index+1});}
    encodeString(text,index){
      try{
        if(this.textTable)return this.textTable.encode(text);
        const bytes=[];for(let cursor=0;cursor<text.length;){const entry=ENCODE.find(([,token])=>text.startsWith(token,cursor));if(!entry)throw new Error(text[cursor]);bytes.push(entry[0]);cursor+=entry[1].length;}return Uint8Array.from(bytes);
      }catch(error){
        const detail=String(error?.message||"character");
        const reason=/not available/i.test(detail)?detail:`'${detail}' is not available in the Gen I English charmap.`;
        throw new SyntaxError(`Line ${index+1}: ${reason}`);
      }
    }
    stripComment(value){let quoted=false,escaped=false;for(let index=0;index<value.length;index++){const character=value[index];if(escaped){escaped=false;continue;}if(character==="\\"){escaped=true;continue;}if(character==='"'){quoted=!quoted;continue;}if(character===";"&&!quoted)return value.slice(0,index);}return value;}
    escape(value){return value.replace(/\\/g,"\\\\").replace(/"/g,'\\"');}
    unescape(value,index){try{return JSON.parse(`"${value}"`);}catch{throw new SyntaxError(`Line ${index+1}: invalid quoted text.`);}}
    character(byte){return this.textTable?.decodeByte(byte)||CHARS.get(byte)||"";}
  }
  global.GbcTextScriptCodec=GbcTextScriptCodec;
  ((global.PokemonViewer ||= {}).code ||= {}).GbcTextScriptCodec=GbcTextScriptCodec;
})(globalThis);
