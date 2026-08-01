(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.sound;
  const COMMANDS=Object.freeze({
    0xd8:["note_type",2],0xd9:["transpose",1],0xda:["tempo",2],0xdb:["duty_cycle",1],0xdc:["volume_envelope",1],0xdd:["pitch_sweep",1],0xde:["duty_cycle_pattern",1],0xdf:["toggle_sfx",0],
    0xe0:["pitch_slide",2],0xe1:["vibrato",2],0xe2:["unknown_e2",1],0xe4:["force_stereo_panning",1],0xe5:["volume",1],0xe6:["pitch_offset",2],0xe7:["unknown_e7",1],0xe8:["unknown_e8",1],0xe9:["tempo_relative",1],0xea:["restart_channel",2],0xeb:["new_song",2],0xec:["sfx_priority_on",0],0xed:["sfx_priority_off",0],0xee:["unknown_ee",2],0xef:["stereo_panning",1],
    0xf1:["music_f1",0],0xf2:["music_f2",0],0xf3:["music_f3",0],0xf4:["music_f4",0],0xf5:["music_f5",0],0xf6:["music_f6",0],0xf7:["music_f7",0],0xf8:["music_f8",0],0xf9:["unknown_f9",0],0xfa:["set_condition",1],0xfb:["sound_jump_if",3],0xfc:["sound_jump",2],0xfd:["sound_loop",3],0xfe:["sound_call",2],0xff:["sound_ret",0]
  });
  const CHANNELS=Object.freeze(["Pulse 1","Pulse 2","Wave","Noise"]);

  class Gen2AudioDecoder{
    constructor(memory){this.memory=memory;}
    bankOf(offset){return Math.floor(Number(offset)/0x4000);}
    address(bank,offset){return this.memory.banked(bank,this.memory.u16(offset));}
    header(offset){
      if(!this.memory.contains(offset,3))throw new RangeError("Crystal audio header is outside the ROM.");
      const count=(this.memory.u8(offset)>>6)+1,bank=this.bankOf(offset),tracks=[];
      for(let index=0;index<count;index++){
        const record=offset+index*3;if(!this.memory.contains(record,3))throw new RangeError("Crystal audio channel header is truncated.");
        const channel=(this.memory.u8(record)&0x0f)+1,pointer=this.address(bank,record+1);
        if(channel<1||channel>8||!this.memory.contains(pointer,1))throw new RangeError(`Crystal audio channel ${channel} has an invalid pointer.`);
        tracks.push({index:channel,offset:pointer,channel:CHANNELS[(channel-1)%4]});
      }
      return tracks;
    }
    bytes(offset,count){if(!this.memory.contains(offset,count))return null;return Array.from(this.memory.slice(offset,count));}
    decode(start,{channel=1,limit=1024}={}){
      const commands=[];let offset=start,tick=0,noteUnit=1,noise=false;
      for(let count=0;count<limit&&this.memory.contains(offset,1);count++){
        const at=offset,commandTick=tick,opcode=this.memory.u8(offset++);let name="data",args=[],width=0,terminal=false,accuracy="verified";
        if(opcode<0xd0){const pitch=opcode>>4,length=(opcode&0x0f)+1;name=pitch?"note":"rest";args=pitch?[pitch,length]:[length];tick+=length*noteUnit;}
        else if(opcode<=0xd7){name="octave";args=[8-(opcode-0xd0)];}
        else if(opcode===0xe3||opcode===0xf0){name=opcode===0xe3?"toggle_noise":"sfx_toggle_noise";noise=!noise;width=noise?1:0;}
        else if(COMMANDS[opcode]){[name,width]=COMMANDS[opcode];terminal=opcode===0xff;}
        else{name=`unknown_${opcode.toString(16)}`;accuracy="partial";terminal=true;}
        if(width){const values=this.bytes(offset,width);if(!values){accuracy="partial";terminal=true;}else{args=values;offset+=width;}}
        if(opcode===0xd8&&args.length)noteUnit=Math.max(1,args[0]);
        commands.push(new ns.SoundCommand({offset:at,opcode,name,arguments:args,tick:commandTick,accuracy}));
        if(terminal||[0xea,0xeb,0xfb,0xfc,0xfd,0xfe].includes(opcode))break;
      }
      return commands;
    }
    program(header){return this.header(header).map(track=>new ns.SoundTrack({...track,commands:this.decode(track.offset,{channel:track.index})}));}
  }

  class Gen2SoundDriver extends ns.GenericSoundDriver{
    constructor(context){super({...context,family:"gen2"});this.data=this.reader.gen2SpeciesData||=new root.gen2.Gen2SpeciesData(this.reader);this.decoder=new Gen2AudioDecoder(this.reader.memory);}
    musicOffset(songId){const table=this.reader.memoryProfile?.offset("Music");if(!Number.isInteger(table)||!this.reader.memory.contains(table+songId*3,3))return null;try{return this.reader.memory.banked(this.reader.memory.u8(table+songId*3+2),this.reader.memory.u16(table+songId*3));}catch{return null;}}
    list(){
      const cries=this.data.catalog.list().map(species=>{const cry=this.data.cry(species.id);return new ns.SoundDocument({id:species.id,name:`${species.name} cry`,kind:"cry",family:"gen2",source:"pret/pokecrystal PokemonCries",accuracy:"verified",offset:cry.offset,editable:true,metadata:{group:"cry",speciesId:species.id,speciesName:species.name,dexNumber:species.id,cryTable:"PokemonCries",resourceId:`gen2:cry:${species.id}`,speciesResourceId:`gen2:species:${species.id}`,baseCry:cry.baseCry,pitch:cry.pitch,length:cry.length},references:[{type:"species",id:species.id,resourceId:`gen2:species:${species.id}`,label:`${species.name} (#${species.id})`,offset:species.nameOffset},{type:"pokedex",id:species.id,label:`Pokédex #${species.id}`},{type:"table",label:"PokemonCries · 6-byte species record",offset:cry.offset}]});});
      const songs=(ns.sourceCatalog?.gen2?.songs||[]).map(song=>new ns.SoundDocument({id:`music:${song.id}`,name:song.name,kind:"song",family:"gen2",source:"pret/pokecrystal Music",accuracy:"verified",offset:this.musicOffset(song.id),metadata:{group:"music",songId:song.id,symbol:song.symbol},references:[{type:"table",label:`Music[${song.id}] · ${song.symbol}`,offset:(()=>{const table=this.reader.memoryProfile?.offset("Music");return Number.isInteger(table)?table+song.id*3:null;})()}]}));
      const sfx=(ns.sourceCatalog?.gen2?.sfx||[]).map(sound=>new ns.SoundDocument({id:`sfx:${sound.id}`,name:sound.name,kind:"sfx",family:"gen2",source:"pret/pokecrystal sfx_constants.asm",accuracy:"verified",metadata:{group:"sfx",sfxId:sound.id,symbol:sound.symbol},references:[{type:"table",label:`SFX index ${MemoryUtils.hex(sound.id)} · ${sound.symbol}`}]}));
      return[...this.mapMusic(),...songs,...sfx,...cries];
    }
    describe(document){
      if(document.kind==="cry"){const {baseCry,pitch,length,speciesName}=document.metadata;return{summary:`Verified Crystal PokemonCries record for ${speciesName}: base cry ${MemoryUtils.hex(baseCry,4)}, pitch ${MemoryUtils.hex(pitch,4)}, length ${MemoryUtils.hex(length,4)}.`,coverage:new ns.SoundCoverage({catalog:"verified",program:"unavailable",audio:"unavailable",writing:"verified"}),tracks:[],voices:[],commands:[new ns.SoundCommand({offset:document.offset,opcode:baseCry,name:"mon_cry",arguments:[`base=${MemoryUtils.hex(baseCry)}`,`pitch=${MemoryUtils.hex(pitch,4)}`,`length=${MemoryUtils.hex(length,4)}`],tick:0,accuracy:"verified"})]};}
      if(!Number.isInteger(document.offset))return super.describe(document);
      try{const tracks=this.decoder.program(document.offset),commands=tracks.flatMap(track=>track.commands),verified=commands.length>0&&commands.every(command=>command.accuracy==="verified");return{summary:`Crystal channel header and ${tracks.length} native APU stream${tracks.length===1?"":"s"} decoded from this ROM. Hardware synthesis and structural writing remain separate unavailable capabilities.`,coverage:new ns.SoundCoverage({catalog:"verified",program:verified?"verified":"partial",audio:"unavailable",writing:"unavailable"}),tracks,commands,voices:[]};}catch(error){return{summary:error.message,coverage:new ns.SoundCoverage({catalog:"verified",program:"partial",audio:"unavailable",writing:"unavailable"}),tracks:[],commands:[],voices:[]};}
    }
    editFields(document){return document.kind==="cry"?[{name:"baseCry",label:"Base cry",type:"number",value:document.metadata.baseCry,min:0,max:65535},{name:"pitch",label:"Pitch",type:"number",value:document.metadata.pitch,min:0,max:65535},{name:"length",label:"Length",type:"number",value:document.metadata.length,min:0,max:65535}]:[];}
    edit(document,values,stack){if(document.kind!=="cry"||!document.editable)return false;const plan=this.data.cryEditPlan(Number(document.metadata.speciesId),values);if(plan.before.every((value,index)=>value===plan.after[index]))return false;const write=(expected,next)=>MemoryUtils.replace(this.reader.memory,plan.offset,expected,next,{message:"Crystal PokemonCries changed after this command"});stack.execute({label:`Edit ${document.metadata.speciesName} cry`,description:`Pokédex #${document.metadata.speciesId}`,do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)});this.reader.resourceGraph=this.data.resourceGraph();return true;}
  }

  ns.Gen2AudioDecoder=Gen2AudioDecoder;
  ns.registry.register("gen2",context=>new Gen2SoundDriver(context));
})(globalThis);
