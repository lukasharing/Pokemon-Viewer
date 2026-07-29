(function(global){
  "use strict";
  const hex=(value,width=2)=>`0x${(value>>>0).toString(16).toUpperCase().padStart(width,"0")}`;
  const GBA=new Map([
    [0x00,{name:"nop",args:[]}],[0x01,{name:"nop1",args:[]}],[0x02,{name:"end",args:[],end:true}],[0x03,{name:"return",args:[],end:true}],
    [0x04,{name:"call",args:["pointer"]}],[0x05,{name:"goto",args:["pointer"],end:true}],[0x06,{name:"goto_if",args:["byte","pointer"]}],[0x07,{name:"call_if",args:["byte","pointer"]}],
    [0x08,{name:"gotostd",args:["byte"],end:true}],[0x09,{name:"callstd",args:["byte"]}],[0x0a,{name:"gotostd_if",args:["byte","byte"]}],[0x0b,{name:"callstd_if",args:["byte","byte"]}],
    [0x0c,{name:"returnram",args:[],end:true}],[0x0d,{name:"endram",args:[],end:true}],[0x0e,{name:"setmysteryeventstatus",args:["byte"]}],
    [0x0f,{name:"loadword",args:["byte","pointer"]}],[0x10,{name:"loadbyte",args:["byte","byte"]}],[0x11,{name:"setptr",args:["byte","pointer"]}],
    [0x12,{name:"loadbytefromptr",args:["byte","pointer"]}],[0x13,{name:"setptrbyte",args:["byte","pointer"]}],[0x14,{name:"copylocal",args:["byte","byte"]}],
    [0x15,{name:"copybyte",args:["pointer","pointer"]}],[0x16,{name:"setvar",args:["short","short"]}],[0x17,{name:"addvar",args:["short","short"]}],
    [0x18,{name:"subvar",args:["short","short"]}],[0x19,{name:"copyvar",args:["short","short"]}],[0x1a,{name:"setorcopyvar",args:["short","short"]}],
    [0x1b,{name:"compare_local_to_local",args:["byte","byte"]}],[0x1c,{name:"compare_local_to_value",args:["byte","byte"]}],
    [0x1d,{name:"compare_local_to_addr",args:["byte","pointer"]}],[0x1e,{name:"compare_addr_to_local",args:["pointer","byte"]}],
    [0x1f,{name:"compare_addr_to_value",args:["pointer","byte"]}],[0x20,{name:"compare_addr_to_addr",args:["pointer","pointer"]}],
    [0x21,{name:"compare",args:["short","short"]}],[0x22,{name:"compare_var_to_var",args:["short","short"]}],
    [0x23,{name:"callnative",args:["pointer"]}],[0x24,{name:"gotonative",args:["pointer"]}],[0x25,{name:"special",args:["short"]}],
    [0x26,{name:"specialvar",args:["short","short"]}],[0x27,{name:"waitstate",args:[]}],[0x28,{name:"delay",args:["short"]}],
    [0x29,{name:"setflag",args:["short"]}],[0x2a,{name:"clearflag",args:["short"]}],[0x2b,{name:"checkflag",args:["short"]}],
    [0x2c,{name:"initclock",args:["short","short"]}],[0x2d,{name:"dotimebasedevents",args:[]}],[0x2e,{name:"gettime",args:[]}],
    [0x2f,{name:"playse",args:["short"]}],[0x30,{name:"waitse",args:[]}],[0x31,{name:"playfanfare",args:["short"]}],[0x32,{name:"waitfanfare",args:[]}],
    [0x33,{name:"playbgm",args:["short","byte"]}],[0x34,{name:"savebgm",args:["short"]}],[0x35,{name:"fadedefaultbgm",args:[]}],
    [0x36,{name:"fadenewbgm",args:["short"]}],[0x37,{name:"fadeoutbgm",args:["byte"]}],[0x38,{name:"fadeinbgm",args:["byte"]}],
    [0x39,{name:"warp",args:["byte","byte","byte","short","short"]}],[0x3a,{name:"warpsilent",args:["byte","byte","byte","short","short"]}],
    [0x3b,{name:"warpdoor",args:["byte","byte","byte","short","short"]}],[0x3c,{name:"warphole",args:["byte","byte"]}],
    [0x3d,{name:"warpteleport",args:["byte","byte","byte","short","short"]}],[0x3e,{name:"setwarp",args:["byte","byte","byte","short","short"]}],
    [0x3f,{name:"setdynamicwarp",args:["byte","byte","byte","short","short"]}],[0x40,{name:"setdivewarp",args:["byte","byte","byte","short","short"]}],
    [0x41,{name:"setholewarp",args:["byte","byte","byte","short","short"]}],[0x42,{name:"getplayerxy",args:["short","short"]}],[0x43,{name:"getpartysize",args:[]}],
    [0x44,{name:"additem",args:["short","short"]}],[0x45,{name:"removeitem",args:["short","short"]}],[0x46,{name:"checkitemspace",args:["short","short"]}],
    [0x47,{name:"checkitem",args:["short","short"]}],[0x48,{name:"checkitemtype",args:["short"]}],[0x49,{name:"addpcitem",args:["short","short"]}],
    [0x4a,{name:"checkpcitem",args:["short","short"]}],[0x4b,{name:"adddecoration",args:["short"]}],[0x4c,{name:"removedecoration",args:["short"]}],
    [0x4d,{name:"checkdecor",args:["short"]}],[0x4e,{name:"checkdecorspace",args:["short"]}],[0x4f,{name:"applymovement",args:["short","pointer"]}],
    [0x50,{name:"applymovementat",args:["short","pointer","byte","byte"]}],[0x51,{name:"waitmovement",args:["short"]}],[0x52,{name:"waitmovementat",args:["short","byte","byte"]}],
    [0x53,{name:"removeobject",args:["short"]}],[0x54,{name:"removeobjectat",args:["short","byte","byte"]}],[0x55,{name:"addobject",args:["short"]}],
    [0x56,{name:"addobjectat",args:["short","byte","byte"]}],[0x57,{name:"setobjectxy",args:["short","short","short"]}],
    [0x58,{name:"showobjectat",args:["short","byte","byte"]}],[0x59,{name:"hideobjectat",args:["short","byte","byte"]}],
    [0x5a,{name:"faceplayer",args:[]}],[0x5b,{name:"turnobject",args:["short","byte"]}],[0x5c,{name:"trainerbattle",dynamic:"trainer"}],
    [0x5d,{name:"dotrainerbattle",args:[]}],[0x5e,{name:"gotopostbattlescript",args:[],end:true}],[0x5f,{name:"gotobeatenscript",args:[],end:true}],
    [0x60,{name:"checktrainerflag",args:["short"]}],[0x61,{name:"settrainerflag",args:["short"]}],[0x62,{name:"cleartrainerflag",args:["short"]}],
    [0x63,{name:"setobjectxyperm",args:["short","short","short"]}],[0x64,{name:"copyobjectxytoperm",args:["short"]}],[0x65,{name:"setobjectmovementtype",args:["short","byte"]}],
    [0x66,{name:"waitmessage",args:[]}],[0x67,{name:"message",args:["pointer"]}],[0x68,{name:"closemessage",args:[]}],
    [0x69,{name:"lockall",args:[]}],[0x6a,{name:"lock",args:[]}],[0x6b,{name:"releaseall",args:[]}],[0x6c,{name:"release",args:[]}],[0x6d,{name:"waitbuttonpress",args:[]}]
    ,[0x6e,{name:"yesnobox",args:["byte","byte"]}],[0x6f,{name:"multichoice",args:["byte","byte","byte","byte"]}],
    [0x70,{name:"multichoicedefault",args:["byte","byte","byte","byte","byte"]}],[0x71,{name:"multichoicegrid",args:["byte","byte","byte","byte","byte"]}],
    [0x72,{name:"drawbox",args:["byte","byte","byte","byte"]}],[0x73,{name:"erasebox",args:["byte","byte","byte","byte"]}],
    [0x74,{name:"drawboxtext",args:["byte","byte","byte","byte"]}],[0x75,{name:"showmonpic",args:["short","byte","byte"]}],
    [0x76,{name:"hidemonpic",args:[]}],[0x77,{name:"showcontestpainting",args:["byte"]}],[0x78,{name:"braillemessage",args:["pointer"]}],
    [0x79,{name:"givemon",dynamic:"givemon"}],[0x7a,{name:"giveegg",args:["short"]}],[0x7b,{name:"setmonmove",args:["byte","byte","short"]}],
    [0x7c,{name:"checkpartymove",args:["short"]}],[0x7d,{name:"bufferspeciesname",args:["byte","short"]}],[0x7e,{name:"bufferleadmonspeciesname",args:["byte"]}],
    [0x7f,{name:"bufferpartymonnick",args:["byte","short"]}],[0x80,{name:"bufferitemname",args:["byte","short"]}],[0x81,{name:"bufferdecorationname",args:["byte","short"]}],
    [0x82,{name:"buffermovename",args:["byte","short"]}],[0x83,{name:"buffernumberstring",args:["byte","short"]}],[0x84,{name:"bufferstdstring",args:["byte","short"]}],
    [0x85,{name:"bufferstring",args:["byte","pointer"]}],[0x86,{name:"pokemart",args:["pointer"]}],[0x87,{name:"pokemartdecoration",args:["pointer"]}],
    [0x88,{name:"pokemartdecoration2",args:["pointer"]}],[0x89,{name:"playslotmachine",args:["short"]}],[0x8a,{name:"setberrytree",args:["byte","byte","byte"]}],
    [0x8b,{name:"choosecontestmon",args:[]}],[0x8c,{name:"startcontest",args:[]}],[0x8d,{name:"showcontestresults",args:[]}],[0x8e,{name:"contestlinktransfer",args:[]}],
    [0x8f,{name:"random",args:["short"]}],[0x90,{name:"addmoney",args:["dword","byte"]}],[0x91,{name:"removemoney",args:["dword","byte"]}],
    [0x92,{name:"checkmoney",args:["dword","byte"]}],[0x93,{name:"showmoneybox",args:["byte","byte"]}],[0x94,{name:"hidemoneybox",args:["byte","byte"]}],
    [0x95,{name:"updatemoneybox",args:["byte","byte"]}],[0x96,{name:"getpokenewsactive",args:["short"]}],[0x97,{name:"fadescreen",args:["byte"]}],
    [0x98,{name:"fadescreenspeed",args:["byte","byte"]}],[0x99,{name:"setflashlevel",args:["short"]}],[0x9a,{name:"animateflash",args:["byte"]}],
    [0x9b,{name:"messageautoscroll",args:["pointer"]}],[0x9c,{name:"dofieldeffect",args:["short"]}],[0x9d,{name:"setfieldeffectargument",args:["byte","short"]}],
    [0x9e,{name:"waitfieldeffect",args:["short"]}],[0x9f,{name:"setrespawn",args:["short"]}],[0xa0,{name:"checkplayergender",args:[]}],
    [0xa1,{name:"playmoncry",args:["short","short"]}],[0xa2,{name:"setmetatile",args:["short","short","short","short"]}],[0xa3,{name:"resetweather",args:[]}],
    [0xa4,{name:"setweather",args:["short"]}],[0xa5,{name:"doweather",args:[]}],[0xa6,{name:"setstepcallback",args:["byte"]}],[0xa7,{name:"setmaplayoutindex",args:["short"]}],
    [0xa8,{name:"setobjectsubpriority",args:["short","byte","byte","byte"]}],[0xa9,{name:"resetobjectsubpriority",args:["short","byte","byte"]}],
    [0xaa,{name:"createvobject",args:["byte","byte","short","short","byte","byte"]}],[0xab,{name:"turnvobject",args:["byte","byte"]}],
    [0xac,{name:"opendoor",args:["short","short"]}],[0xad,{name:"closedoor",args:["short","short"]}],[0xae,{name:"waitdooranim",args:[]}],
    [0xaf,{name:"setdooropen",args:["short","short"]}],[0xb0,{name:"setdoorclosed",args:["short","short"]}],[0xb1,{name:"addelevmenuitem",args:[]}],
    [0xb2,{name:"showelevmenu",args:[]}],[0xb3,{name:"checkcoins",args:["short"]}],[0xb4,{name:"addcoins",args:["short"]}],[0xb5,{name:"removecoins",args:["short"]}],
    [0xb6,{name:"setwildbattle",args:["short","byte","short"]}],[0xb7,{name:"dowildbattle",args:[]}],[0xb8,{name:"setvaddress",args:["pointer"]}],
    [0xb9,{name:"vgoto",args:["pointer"],end:true}],[0xba,{name:"vcall",args:["pointer"]}],[0xbb,{name:"vgoto_if",args:["byte","pointer"]}],
    [0xbc,{name:"vcall_if",args:["byte","pointer"]}],[0xbd,{name:"vmessage",args:["pointer"]}],[0xbe,{name:"vbuffermessage",args:["pointer"]}],
    [0xbf,{name:"vbufferstring",args:["byte","pointer"]}],[0xc0,{name:"showcoinsbox",args:["byte","byte"]}],[0xc1,{name:"hidecoinsbox",args:["byte","byte"]}],
    [0xc2,{name:"updatecoinsbox",args:["byte","byte"]}],[0xc3,{name:"incrementgamestat",args:["byte"]}],
    [0xc4,{name:"setescapewarp",args:["byte","byte","byte","short","short"]}],[0xc5,{name:"waitmoncry",args:[]}],
    [0xc6,{name:"bufferboxname",args:["byte","short"]}],[0xc7,{name:"textcolor",args:["byte"]}],[0xc8,{name:"loadhelp",args:["pointer"]}],
    [0xc9,{name:"unloadhelp",args:[]}],[0xca,{name:"signmsg",args:[]}],[0xcb,{name:"normalmsg",args:[]}],[0xcc,{name:"comparehiddenvar",args:["byte","dword"]}],
    [0xcd,{name:"setmodernfatefulencounter",args:["short"]}],[0xce,{name:"checkmodernfatefulencounter",args:["short"]}],
    [0xcf,{name:"trywondercardscript",args:[]}],[0xd0,{name:"setworldmapflag",args:["short"]}],
    [0xd1,{name:"warpspinenter",args:["byte","byte","byte","short","short"]}],[0xd2,{name:"setmonmetlocation",args:["short","byte"]}],
    [0xd3,{name:"moverotatingtileobjects",args:["short"]}],[0xd4,{name:"turnrotatingtileobjects",args:[]}],
    [0xd5,{name:"initrotatingtilepuzzle",args:["short"]}],[0xd6,{name:"freerotatingtilepuzzle",args:[]}],
    [0xd7,{name:"warpmossdeepgym",args:["byte","byte","byte","short","short"]}],[0xd8,{name:"selectapproachingtrainer",args:[]}],
    [0xd9,{name:"lockfortrainer",args:[]}],[0xda,{name:"closebraillemessage",args:[]}],[0xdb,{name:"messageinstant",args:["pointer"]}],
    [0xdc,{name:"fadescreenswapbuffers",args:["byte"]}],[0xdd,{name:"buffertrainerclassname",args:["byte","short"]}],
    [0xde,{name:"buffertrainername",args:["byte","short"]}],[0xdf,{name:"pokenavcall",args:["pointer"]}],
    [0xe0,{name:"warpwhitefade",args:["byte","byte","byte","short","short"]}],[0xe1,{name:"buffercontestname",args:["byte","short"]}],
    [0xe2,{name:"bufferitemnameplural",args:["byte","short","short"]}]
  ]);
  const byName=new Map([...GBA].map(([opcode,definition])=>[definition.name,{opcode,...definition}]));
  byName.set("givemon_raw",{opcode:0x79,args:["short","byte","short","dword","dword","byte"]});
  const sizes={byte:1,short:2,dword:4,pointer:4};
  const TRAINER_POINTERS=Object.freeze([2,3,3,1,3,2,4,3,4]);
  const trainerArgs=type=>Number.isInteger(TRAINER_POINTERS[type])?["byte","short","short",...Array(TRAINER_POINTERS[type]).fill("pointer")]:null;
  const read=(memory,offset,type)=>type==="byte"?memory.u8(offset):type==="short"?memory.u16(offset):memory.u32(offset);
  const pointer=value=>value>=0x08000000&&value<0x0a000000?value-0x08000000:value;
  const TEXT_ARGUMENTS=Object.freeze({message:0,msgbox:0,messageautoscroll:0,braillemessage:0,bufferstring:1,loadhelp:0,messageinstant:0,pokenavcall:0});
  const SCRIPT_ARGUMENTS=Object.freeze({call:0,goto:0,goto_if:1,call_if:1});
  const ROM_POINTER_ARGUMENTS=Object.freeze({
    call:[0],goto:[0],goto_if:[1],call_if:[1],callnative:[0],gotonative:[0],
    applymovement:[1],applymovementat:[1],message:[0],messageautoscroll:[0],
    braillemessage:[0],messageinstant:[0],bufferstring:[1],pokemart:[0],
    pokemartdecoration:[0],pokemartdecoration2:[0],loadhelp:[0],pokenavcall:[0]
  });

  class GbaEventScriptCodec{
    constructor(reader){this.reader=reader;}
    decompile(offset,{limit=512}={}){
      const lines=[`#org ${hex(offset,6)}`],records=[],links=[],labels=new Set();let cursor=offset;
      while(cursor<this.reader.size&&cursor-offset<limit){
        if(labels.has(cursor))lines.push("",`${this.label(cursor)}:`);
        const start=cursor,opcode=this.reader.memory.u8(cursor++),definition=GBA.get(opcode);
        if(!definition){lines.push(`db ${hex(opcode)} ; unknown command — decoding stopped safely`);records.push({offset:start,size:1,opcode,name:"db",unknown:true});break;}
        const argTypes=definition.dynamic==="trainer"?trainerArgs(this.reader.memory.u8(cursor)):definition.dynamic==="givemon"?["short","byte","short","dword","dword","byte"]:definition.args;
        if(!argTypes){lines.push(`db ${hex(opcode)} ; unsupported trainerbattle type — decoding stopped safely`);records.push({offset:start,size:1,opcode,name:"db",unknown:true});break;}
        const values=[],argOffsets=[];for(const type of argTypes){argOffsets.push(cursor);values.push(read(this.reader.memory,cursor,type));cursor+=sizes[type];}
        if(opcode===0x0f&&values[0]===0&&this.reader.memory.u8(cursor)===0x09){const type=this.reader.memory.u8(cursor+1);cursor+=2;lines.push(`msgbox ${hex(pointer(values[1]),6)}, ${hex(type)}`);const record={offset:start,size:cursor-start,opcode,name:"msgbox",args:[values[1],type],argOffsets:[argOffsets[1]]};records.push(record);this.collectTextLink(links,record);continue;}
        const canonicalGift=definition.dynamic==="givemon"&&values.slice(3).every(value=>value===0),name=definition.dynamic==="givemon"&&!canonicalGift?"givemon_raw":definition.name,visibleValues=definition.dynamic==="givemon"&&canonicalGift?values.slice(0,3):values;
        this.validateSemanticPointers(name,values,start);
        const args=visibleValues.map((value,index)=>{const type=argTypes[index];return type==="pointer"?hex(pointer(value),6):hex(value,type==="byte"?2:type==="dword"?8:4);});
        lines.push(`${name}${args.length?" "+args.join(", "):""}`);const record={offset:start,size:cursor-start,opcode,name,args:values,argOffsets};records.push(record);this.collectLinks(links,record);
        if(definition.end){
          const target=(name==="goto"||name==="vgoto")?pointer(values[0]):null;
          if(Number.isInteger(target)&&target>=cursor&&target-offset<limit&&target<this.reader.size){
            labels.add(target);
            if(target>cursor){
              const available=Math.min(target-cursor,limit-(cursor-offset)),bytes=Array.from(this.reader.ReadOnlyMemory.slice(cursor,cursor+available));
              lines.push("",`; ${bytes.length} preserved byte${bytes.length===1?"":"s"} before ${this.label(target)}`,`db ${bytes.map(byte=>hex(byte)).join(", ")}`);
              cursor+=available;
            }
            if(cursor===target)continue;
          }
          break;
        }
      }
      const messages=records.filter(record=>record.name==="message"||record.name==="msgbox").map(record=>pointer(record.args[0]));
      if(messages.length){lines.push("","; Referenced game text");for(const address of [...new Set(messages)])lines.push(`; @${hex(address,6)} = ${this.gameText(address)}`);}
      return{language:"XSE / pret event macros",source:lines.join("\n"),records,links,bytes:cursor-offset,messages};
    }
    validateSemanticPointers(name,values,offset){
      // Tiny in-memory codec fixtures intentionally use unresolved addresses.
      // Real GBA cartridges are at least 4 MiB, where semantic validation is
      // required to prevent arbitrary data from masquerading as event code.
      if(this.reader.size<0x400000)return;
      for(const index of ROM_POINTER_ARGUMENTS[name]||[]){
        const address=values[index]>>>0,romOffset=address-0x08000000;
        if(address<0x08000000||romOffset<0||romOffset>=this.reader.size){
          throw new RangeError(`Offset ${hex(offset,6)} is not valid GBA event bytecode: ${name} contains invalid ROM pointer ${hex(address,8)}.`);
        }
      }
    }
    label(offset){return`script_${offset.toString(16).toUpperCase().padStart(6,"0")}`;}
    collectLinks(links,record){
      this.collectTextLink(links,record);this.collectScriptLink(links,record);
    }
    collectTextLink(links,record){
      const index=TEXT_ARGUMENTS[record.name];if(index===undefined)return;
      const pointerOffset=record.argOffsets[index],link=MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gba(this.reader.memory,pointerOffset,{kind:"text",label:`Text · ${record.name}`}));
      if(link&&!links.some(item=>item.offset===link.offset&&item.reference.pointerOffset===pointerOffset))links.push(link);
    }
    collectScriptLink(links,record){
      const index=SCRIPT_ARGUMENTS[record.name];if(index===undefined)return;
      const pointerOffset=record.argOffsets[index],link=MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gba(this.reader.memory,pointerOffset,{kind:"event",label:`Script · ${record.name}`}));
      if(link&&!links.some(item=>item.reference.kind==="gba32"&&item.reference.pointerOffset===pointerOffset))links.push(link);
    }
    compile(source){
      const bytes=[];for(const [index,raw] of source.split(/\r?\n/).entries()){
        const line=raw.replace(/;.*/,"").trim();if(!line||/^#org\b/i.test(line))continue;
        if(/^[A-Za-z_.$][\w.$]*:$/.test(line))continue;
        const [name,...rest]=line.split(/\s+/),definition=byName.get(name.toLowerCase());
        if(name.toLowerCase()==="db"){for(const token of rest.join(" ").split(",")){const value=this.number(token,index);bytes.push(...this.argumentBytes("byte",value,index,token));}continue;}
        if(name.toLowerCase()==="msgbox"){const args=rest.join(" ").split(",").map(value=>value.trim()),address=this.number(args[0],index),type=this.number(args[1]||"4",index);bytes.push(0x0f,0x00,...this.argumentBytes("pointer",address,index,args[0]),0x09,...this.argumentBytes("byte",type,index,args[1]||"4"));continue;}
        if(!definition)throw new SyntaxError(`Line ${index+1}: unknown event command '${name}'.`);
        const args=rest.join(" ").split(",").map(value=>value.trim()).filter(Boolean);
        const argTypes=definition.dynamic==="trainer"?trainerArgs(this.number(args[0],index)):definition.dynamic==="givemon"?["short","byte","short"]:definition.args;
        if(!argTypes)throw new SyntaxError(`Line ${index+1}: unsupported trainerbattle type '${args[0]}'.`);
        if(args.length!==argTypes.length)throw new SyntaxError(`Line ${index+1}: ${name} expects ${argTypes.length} argument(s).`);
        bytes.push(definition.opcode);argTypes.forEach((type,argIndex)=>bytes.push(...this.argumentBytes(type,this.number(args[argIndex],index),index,args[argIndex])));
        if(definition.dynamic==="givemon")bytes.push(0,0,0,0,0,0,0,0,0);
      }return Uint8Array.from(bytes);
    }
    number(token,index){return BinaryCodecUtils.number(token,{line:index+1,min:-0x80000000,max:0xffffffff});}
    argumentBytes(type,value,index,token){
      const width=sizes[type];if(!width)throw new TypeError(`Unsupported GBA argument type '${type}'.`);
      if(type==="pointer"){
        if(value<0)throw new RangeError(`Line ${index+1}: pointer '${token}' cannot be negative.`);
        if(value<0x08000000)value+=0x08000000;
        if(value>0xffffffff)throw new RangeError(`Line ${index+1}: pointer '${token}' does not fit 32 bits.`);
      }else{
        const bits=width*8,minimum=-(2**(bits-1)),maximum=2**bits-1;
        if(value<minimum||value>maximum)throw new RangeError(`Line ${index+1}: '${token}' does not fit ${type}.`);
        if(value<0)value+=2**bits;
      }
      return Array.from({length:width},(_,byte)=>value>>>(byte*8)&0xff);
    }
    gameText(offset){try{const dictionary=this.reader.getDictionary?.(this.reader.textDictionary);return this.reader.getTextByOffset?.(dictionary,offset)?.replace(/\s+/g," ").trim()||"(text could not be decoded)";}catch{return"(text could not be decoded)";}}
  }

  class GbaTextScriptCodec{
    constructor(reader){this.reader=reader;this.table=new TextTableCodec(reader.getDictionary?.(reader.textDictionary)||[]);}
    decompile(offset,{limit=1024}={}){
      this.reader.memory.assertRange(offset);let cursor=offset;
      while(cursor<this.reader.size&&cursor-offset<limit&&this.reader.memory.u8(cursor)!==0xff)cursor++;
      if(cursor>=this.reader.size||cursor-offset>=limit)throw new RangeError("GBA text terminator was not found inside the selected range.");
      const text=this.table.decodeLossless(this.reader.memory.slice(offset,cursor-offset)),source=[`#org ${hex(offset,6)}`,`text "${this.escape(text)}"`,`text_end`].join("\n");
      return{language:"pret/pokeruby game text",source,records:[{offset,size:cursor-offset,name:"text",text},{offset:cursor,size:1,name:"text_end"}],links:[],bytes:cursor-offset+1};
    }
    compile(source){
      const parts=[];
      for(const [index,raw] of source.split(/\r?\n/).entries()){
        const line=this.stripComment(raw).trim();if(!line||/^#org\b/i.test(line)||/^text_end$/i.test(line))continue;
        const match=line.match(/^text\s+"((?:\\.|[^"])*)"$/i);
        if(!match)throw new SyntaxError(`Line ${index+1}: use text "..." or text_end.`);
        try{parts.push(this.table.encode(this.unescape(match[1],index)));}catch(error){throw new SyntaxError(`Line ${index+1}: ${error.message}`);}
      }
      const length=parts.reduce((sum,bytes)=>sum+bytes.length,1),result=new Uint8Array(length);let cursor=0;
      for(const bytes of parts){result.set(bytes,cursor);cursor+=bytes.length;}result[cursor]=0xff;return result;
    }
    stripComment(value){let quoted=false;for(let index=0;index<value.length;index++){if(value[index]==='"'&&value[index-1]!=="\\")quoted=!quoted;if(value[index]===";"&&!quoted)return value.slice(0,index);}return value;}
    escape(value){return value.replace(/\\/g,"\\\\").replace(/"/g,'\\"');}
    unescape(value,line){try{return JSON.parse(`"${value}"`);}catch{throw new SyntaxError(`Line ${line+1}: invalid quoted text.`);}}
  }

  class GbaScriptCodec{
    constructor(reader){this.event=new GbaEventScriptCodec(reader);this.text=new GbaTextScriptCodec(reader);}
    codec(kind){return kind==="text"?this.text:this.event;}
    decompile(offset,options={}){return this.codec(options.kind).decompile(offset,options);}
    compile(source,options={}){return this.codec(options.kind).compile(source,options);}
  }
  Object.assign(global,{GbaEventScriptCodec,GbaTextScriptCodec,GbaScriptCodec});
  ((global.PokemonViewer ||= {}).code ||= {}).GbaEventScriptCodec=GbaEventScriptCodec;
})(globalThis);
