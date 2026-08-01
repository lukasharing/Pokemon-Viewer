(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.sound;
  const CONTROL=Object.freeze({
    0xe8:["toggle_perfect_pitch",0],0xea:["vibrato",2],0xeb:["pitch_slide",2],0xec:["duty_cycle",1],0xed:["tempo",2],0xee:["stereo_panning",1],0xef:["unknown_music_ef",1],0xf0:["volume",1],0xf8:["execute_music",0],0xfc:["duty_cycle_pattern",1],0xfd:["sound_call",2],0xfe:["sound_loop",3],0xff:["sound_ret",0]
  });
  const CHANNELS=Object.freeze(["Pulse 1","Pulse 2","Wave","Noise"]);

  // Red/Blue's stream grammar is intentionally isolated from Crystal's. Both
  // use the Game Boy APU, but their command IDs and record layouts differ.
  class Gen1AudioDecoder{
    constructor(memory){this.memory=memory;}
    bankOf(offset){return Math.floor(Number(offset)/0x4000);}
    header(offset){
      if(!this.memory.contains(offset,3))throw new RangeError("Red/Blue audio header is outside the ROM.");
      const count=(this.memory.u8(offset)>>6)+1,bank=this.bankOf(offset),tracks=[];
      for(let index=0;index<count;index++){
        const record=offset+index*3;
        if(!this.memory.contains(record,3))throw new RangeError("Red/Blue audio channel header is truncated.");
        const channel=(this.memory.u8(record)&0x0f)+1;
        const pointer=this.memory.banked(bank,this.memory.u16(record+1));
        if(channel<1||channel>8||!this.memory.contains(pointer,1))throw new RangeError(`Red/Blue audio channel ${channel} has an invalid pointer.`);
        tracks.push({index:channel,offset:pointer,channel:CHANNELS[(channel-1)%4]});
      }
      return tracks;
    }
    bytes(offset,count){return this.memory.contains(offset,count)?Array.from(this.memory.slice(offset,count)):null;}
    decode(start,{channel=1,limit=2048}={}){
      const commands=[];let offset=Number(start),tick=0,noteUnit=1;
      for(let count=0;count<limit&&this.memory.contains(offset,1);count++){
        const at=offset,commandTick=tick,opcode=this.memory.u8(offset++);let name="data",args=[],width=0,terminal=false,accuracy="verified";
        if(opcode<0xb0){const pitch=opcode>>4,length=(opcode&0x0f)+1;name=pitch?"note":"rest";args=pitch?[pitch,length]:[length];tick+=length*noteUnit;}
        else if(opcode<0xc0){name="drum_note";width=1;args=[opcode-0xaf];tick+=(opcode&0x0f)+1;}
        else if(opcode<0xd0){name="rest";args=[(opcode&0x0f)+1];tick+=((opcode&0x0f)+1)*noteUnit;}
        else if(opcode<0xe0){name=channel===4?"drum_speed":"note_type";noteUnit=opcode&0x0f;width=channel===4?0:1;args=[noteUnit];}
        else if(opcode<0xe8){name="octave";args=[8-(opcode-0xe0)];}
        else if(CONTROL[opcode]){[name,width]=CONTROL[opcode];terminal=opcode===0xff;}
        else{accuracy="partial";name=`unknown_${opcode.toString(16)}`;terminal=true;}
        if(width){const values=this.bytes(offset,width);if(!values){accuracy="partial";terminal=true;}else{args.push(...values);offset+=width;}}
        commands.push(new ns.SoundCommand({offset:at,opcode,name,arguments:args,tick:commandTick,accuracy}));
        if(terminal||opcode===0xfd||opcode===0xfe)break;
      }
      return commands;
    }
    program(header){return this.header(header).map(track=>new ns.SoundTrack({...track,commands:this.decode(track.offset,{channel:track.index})}));}
  }

  class Gen1SoundDriver extends ns.GenericSoundDriver{
    constructor(context){super({...context,family:"gbc"});this.data=this.reader.gen1SpeciesData||=new root.gen1.Gen1SpeciesData(this.reader);this.decoder=new Gen1AudioDecoder(this.reader.memory);}
    list(){
      const cries=this.species.list().map(species=>{const cry=this.data.cry(species),resourceId=root.resources.ResourceId.create("gen1","cry",String(species.internalId)),speciesResourceId=species.dexNumber?root.resources.ResourceId.create("gen1","species",String(species.dexNumber)):null;return new ns.SoundDocument({id:species.id,name:`${species.name} cry`,kind:"cry",family:"gbc",source:"pret/pokered CryData",accuracy:"verified",offset:cry.offset,editable:true,metadata:{speciesId:species.id,speciesName:species.name,dexNumber:species.dexNumber,isGlitch:species.isGlitch,group:"cry",cryTable:"CryData",resourceId,speciesResourceId,baseCry:cry.baseCry,pitch:cry.pitch,length:cry.length},references:[{type:"species",id:species.id,resourceId:speciesResourceId,label:`${species.name} (internal #${species.id})`,offset:species.nameOffset},...(species.dexNumber?[{type:"pokedex",id:species.dexNumber,label:`Pokédex #${species.dexNumber}`}]:[]),{type:"table",label:"CryData · 3-byte internal-species record",offset:cry.offset}]});});
      const songs=(ns.sourceCatalog?.gen1?.songs||[]).map(song=>{const symbol=this.reader.memoryProfile?.symbol(song.header),kind=song.kind==="sfx"?"sfx":"song";return new ns.SoundDocument({id:`${kind}:${song.symbol}`,name:song.name,kind,family:"gbc",source:"pret/pokered music_constants.asm",accuracy:"verified",offset:symbol?.offset??null,metadata:{group:song.kind||"music",symbol:song.symbol,header:song.header,audioBank:song.bank},references:[{type:"table",label:`${song.symbol} → ${song.header}${song.bank?` · AUDIO_${song.bank}`:""}`,offset:symbol?.offset??null}]});});
      return[...this.mapMusic(),...songs,...cries];
    }
    describe(document){
      if(document.kind==="cry"){const {baseCry,pitch,length,speciesName}=document.metadata;return{summary:`Verified Gen I CryData record for ${speciesName}: base cry ${MemoryUtils.hex(baseCry)}, pitch ${MemoryUtils.hex(pitch)}, length ${MemoryUtils.hex(length)}.`,coverage:new ns.SoundCoverage({catalog:"verified",program:"unavailable",audio:"unavailable",writing:"verified"}),tracks:[],commands:[new ns.SoundCommand({offset:document.offset,opcode:baseCry,name:"mon_cry",arguments:[`base=${MemoryUtils.hex(baseCry)}`,`pitch=${MemoryUtils.hex(pitch)}`,`length=${MemoryUtils.hex(length)}`],tick:0,accuracy:"verified"})],voices:[]};}
      if(!Number.isInteger(document.offset))return super.describe(document);
      try{const tracks=this.decoder.program(document.offset),commands=tracks.flatMap(track=>track.commands),verified=commands.length>0&&commands.every(command=>command.accuracy==="verified");return{summary:`Red/Blue channel header and ${tracks.length} native APU stream${tracks.length===1?"":"s"} decoded from this ROM. Hardware synthesis and structural writing remain separate unavailable capabilities.`,coverage:new ns.SoundCoverage({catalog:"verified",program:verified?"verified":"partial",audio:"unavailable",writing:"unavailable"}),tracks,commands,voices:[]};}catch(error){return{summary:error.message,coverage:new ns.SoundCoverage({catalog:"verified",program:"partial",audio:"unavailable",writing:"unavailable"}),tracks:[],commands:[],voices:[]};}
    }
    editFields(document){return document.kind==="cry"?[{name:"baseCry",label:"Base cry",type:"number",value:document.metadata.baseCry,min:0,max:255},{name:"pitch",label:"Pitch",type:"number",value:document.metadata.pitch,min:0,max:255},{name:"length",label:"Length",type:"number",value:document.metadata.length,min:0,max:255}]:[];}
    edit(document,values,stack){
      if(document.kind!=="cry"||!document.editable)return false;
      const species=this.data.catalog.get(Number(document.metadata.speciesId));if(!species)throw new RangeError("The selected Gen I cry has no canonical internal species identity.");
      const plan=this.data.cryEditPlan(species,values);if(plan.before.every((value,index)=>value===plan.after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.reader.memory,plan.offset,expected,next,{message:"CryData changed after this command"});
      stack.execute({label:`Edit ${document.metadata.speciesName} cry`,description:`base ${MemoryUtils.hex(plan.after[0])} · pitch ${MemoryUtils.hex(plan.after[1])} · length ${MemoryUtils.hex(plan.after[2])}`,do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)});
      let graph=this.data.resourceGraph();const progression=this.reader.gen1ProgressionData;if(progression)graph=progression.resourceGraph(graph);const trainers=this.reader.gen1TrainerData;if(trainers)graph=trainers.resourceGraph(graph);this.reader.resourceGraph=graph;return true;
    }
  }

  ns.Gen1AudioDecoder=Gen1AudioDecoder;
  ns.registry.register("gbc",context=>new Gen1SoundDriver(context));
})(globalThis);
