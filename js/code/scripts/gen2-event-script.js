(function(global){
  "use strict";
  const source=`scall 2|farscall 3|memcall 2|sjump 2|farsjump 3|memjump 2|ifequal 1,2|ifnotequal 1,2|iffalse 2|iftrue 2|ifgreater 1,2|ifless 1,2|jumpstd 2|callstd 2|callasm 3|special 2|memcallasm 2|checkmapscene 2|setmapscene 2,1|checkscene|setscene 1|setval 1|addval 1|random 1|checkver|readmem 2|writemem 2|loadmem 2,1|readvar 1|writevar 1|loadvar 1,1|giveitem 1,1|takeitem 1,1|checkitem 1|givemoney 1,3|takemoney 1,3|checkmoney 1,3|givecoins 2|takecoins 2|checkcoins 2|addcellnum 1|delcellnum 1|checkcellnum 1|checktime 1|checkpoke 1|givepoke 1,1,1,1|giveegg 1,1|givepokemail 2|checkpokemail 2|checkevent 2|clearevent 2|setevent 2|checkflag 2|clearflag 2|setflag 2|wildon|wildoff|xycompare 2|warpmod 1,2|blackoutmod 2|warp 2,1,1|getmoney 1,1|getcoins 1|getnum 1|getmonname 1,1|getitemname 1,1|getcurlandmarkname 1|gettrainername 1,1,1|getstring 2,1|itemnotify|pocketisfull|opentext|reanchormap 1|closetext|writeunusedbyte 1|farwritetext 3|writetext 2|repeattext 1,1|yesorno|loadmenu 2|closewindow|jumptextfaceplayer 2|farjumptext 3|jumptext 2|waitbutton|promptbutton|pokepic 1|closepokepic|_2dmenu|verticalmenu|loadpikachudata|randomwildmon|loadtemptrainer|loadwildmon 1,1|loadtrainer 1,1|startbattle|reloadmapafterbattle|catchtutorial 1|trainertext 1|trainerflagaction 1|winlosstext 2,2|scripttalkafter|endifjustbattled|checkjustbattled|setlasttalked 1|applymovement 1,2|applymovementlasttalked 2|faceplayer|faceobject 1,1|variablesprite 1,1|disappear 1|appear 1|follow 1,1|stopfollow|moveobject 1,1,1|writeobjectxy 1|loademote 1|showemote 1,1,1|turnobject 1,1|follownotexact 1,1|earthquake 1|changemapblocks 3|changeblock 1,1,1|reloadmap|refreshmap|writecmdqueue 2|delcmdqueue 1|playmusic 2|encountermusic|musicfadeout 2,1|playmapmusic|dontrestartmapmusic|cry 2|playsound 2|waitsfx|warpsound|specialsound|autoinput 3|newloadmap 1|pause 1|deactivatefacing 1|sdefer 2|warpcheck|stopandsjump 2|endcallback|end|reloadend 1|endall|pokemart 1,2|elevator 2|trade 1|askforphonenumber 1|phonecall 2|hangup|describedecoration 1|fruittree 1|specialphonecall 2|checkphonecall|verbosegiveitem 1,1|verbosegiveitemvar 1,1|swarm 1,2|halloffame|credits|warpfacing 1,2,1,1|battletowertext 1|getlandmarkname 1,1|gettrainerclassname 1,1|getname 1,1,1|wait 1|checksave`;
  const definitions=Object.freeze(source.split("|").map((entry,opcode)=>{
    const [name,widths=""]=entry.split(" ");return Object.freeze({opcode,name,widths:widths?widths.split(",").map(Number):[]});
  }));
  const byName=new Map(definitions.map(definition=>[definition.name,definition]));
  const endings=new Set([0x03,0x04,0x05,0x51,0x52,0x53,0x8f,0x90,0x91,0x92,0x93]);
  const hex=(value,width)=>`$${value.toString(16).toUpperCase().padStart(width*2,"0")}`;
  const SCRIPT_ARGUMENTS=Object.freeze({
    scall:[0,"near"],farscall:[0,"far"],sjump:[0,"near"],farsjump:[0,"far"],
    ifequal:[1,"near"],ifnotequal:[1,"near"],iffalse:[0,"near"],iftrue:[0,"near"],
    ifgreater:[1,"near"],ifless:[1,"near"],sdefer:[0,"near"],stopandsjump:[0,"near"]
  });

  class Gen2EventScriptCodec{
    constructor(reader){this.reader=reader;if(definitions.length!==0xaa)throw new Error("Incomplete pokecrystal event-command table.");}
    decompile(offset,{limit=256}={}){
      const lines=["; pret/pokecrystal event macros",`Script_${offset.toString(16).toUpperCase().padStart(6,"0")}:`],records=[],links=[];let cursor=offset;
      while(cursor<this.reader.size&&cursor-offset<limit){
        const start=cursor,opcode=this.reader.memory.u8(cursor++),definition=definitions[opcode];
        if(!definition){lines.push(`db ${hex(opcode,1)} ; unknown opcode`);records.push({offset:start,size:1,name:"db"});break;}
        const widths=[...definition.widths],decoded=BinaryCodecUtils.read(this.reader.memory,cursor,widths),values=decoded.values,argOffsets=decoded.offsets;
        cursor=decoded.cursor;
        if(opcode===0x2d&&values[3]){
          const optional=BinaryCodecUtils.read(this.reader.memory,cursor,[2,2]);
          argOffsets.push(...optional.offsets);values.push(...optional.values);widths.push(2,2);cursor=optional.cursor;
        }
        lines.push(`${definition.name}${values.length?` ${values.map((value,index)=>hex(value,widths[index])).join(", ")}`:""}`);
        const record={offset:start,size:cursor-start,opcode,name:definition.name,args:values,argOffsets,definition};records.push(record);
        this.collectLinks(links,record);
        if(endings.has(opcode))break;
      }
      return{language:"RGBDS / pret/pokecrystal event macros",source:lines.join("\n"),records,links,bytes:cursor-offset};
    }
    collectLinks(links,record){this.collectTextLinks(links,record);this.collectScriptLinks(links,record);}
    collectTextLinks(links,{opcode,offset:start,definition}){
      const near=(pointerOffset,label)=>MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gen2Near(this.reader.memory,pointerOffset,Math.floor(start/0x4000),{kind:"text",label}));
      const far=(bankOffset,addressOffset,label)=>MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gen2Far(this.reader.memory,bankOffset,addressOffset,{kind:"text",label}));
      const add=link=>{if(link&&!links.some(item=>item.source===link.source&&item.kind===link.kind))links.push(link);};
      if(opcode===0x4b||opcode===0x52)add(far(start+1,start+2,`Text · ${definition.name}`));
      if(opcode===0x4c||opcode===0x51||opcode===0x53)add(near(start+1,`Text · ${definition.name}`));
      if(opcode===0x64){add(near(start+1,"Win text"));add(near(start+3,"Loss text"));}
    }
    collectScriptLinks(links,{offset:start,name,argOffsets}){
      const [index,format]=SCRIPT_ARGUMENTS[name]||[];if(index===undefined)return;
      const pointerOffset=argOffsets[index],label=`Script · ${name}`;
      const link=format==="far"
        ?MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gen2Far(this.reader.memory,pointerOffset,pointerOffset+1,{kind:"event",label}))
        :MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gen2Near(this.reader.memory,pointerOffset,Math.floor(start/0x4000),{kind:"event",label}));
      if(link&&!links.some(item=>item.source===link.source&&item.kind===link.kind))links.push(link);
    }
    compile(text){
      const bytes=[];
      for(const [lineIndex,raw] of text.split(/\r?\n/).entries()){
        const line=raw.replace(/;.*/,"").trim();if(!line||line.endsWith(":"))continue;
        const [word,...tail]=line.split(/\s+/),name=word.toLowerCase();
        if(name==="db"){for(const token of tail.join(" ").split(",").filter(Boolean))bytes.push(this.number(token,lineIndex,1));continue;}
        const definition=byName.get(name);if(!definition)throw new SyntaxError(`Line ${lineIndex+1}: unknown Crystal event macro '${word}'.`);
        const args=tail.join(" ").split(",").map(value=>value.trim()).filter(Boolean),widths=[...definition.widths];
        if(definition.opcode===0x2d){
          if(args.length<4)throw new SyntaxError(`Line ${lineIndex+1}: givepoke expects at least 4 arguments.`);
          const trainer=this.number(args[3],lineIndex,1),expected=trainer?6:4;
          if(args.length!==expected)throw new SyntaxError(`Line ${lineIndex+1}: givepoke expects ${expected} arguments for trainer flag ${trainer}.`);
          if(trainer)widths.push(2,2);
        }else if(args.length!==widths.length)throw new SyntaxError(`Line ${lineIndex+1}: ${word} expects ${widths.length} argument(s).`);
        bytes.push(definition.opcode);
        const values=args.map((token,index)=>this.number(token,lineIndex,widths[index]));
        BinaryCodecUtils.append(bytes,widths,values,{line:lineIndex+1});
      }
      return Uint8Array.from(bytes);
    }
    number(token,line,width){return BinaryCodecUtils.number(token,{line:line+1,width});}
  }

  class Gen2ScriptCodec{
    constructor(reader){this.event=new Gen2EventScriptCodec(reader);this.text=new Gen2TextScriptCodec(reader);}
    codec(kind){return kind==="text"?this.text:this.event;}
    decompile(offset,options={}){return this.codec(options.kind).decompile(offset,options);}
    compile(source,options={}){return this.codec(options.kind).compile(source,options);}
  }
  Object.assign(global,{Gen2EventScriptCodec,Gen2ScriptCodec});
  ((global.PokemonViewer||={}).code||={}).Gen2EventScriptCodec=Gen2EventScriptCodec;
})(globalThis);
