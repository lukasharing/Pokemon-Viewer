(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.sound;
  const DURATIONS=Object.freeze([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,28,30,32,36,40,42,44,48,52,54,56,60,64,66,68,72,76,78,80,84,88,90,92,96]);
  const ONE_BYTE=Object.freeze(new Map([[0xBA,"PRIO"],[0xBB,"TEMPO"],[0xBC,"KEYSH"],[0xBD,"VOICE"],[0xBE,"VOL"],[0xBF,"PAN"],[0xC0,"BEND"],[0xC1,"BENDR"],[0xC2,"LFOS"],[0xC3,"LFODL"],[0xC4,"MOD"],[0xC5,"MODT"],[0xC8,"TUNE"]]));

  // Lossless command decoder plus a bounded control-flow interpreter for the
  // Generation III M4A/Sappy byte language defined by MPlayDef.s. Audio mixing
  // is a separate capability: decoding a program never implies playable audio.
  class GbaM4aDecoder{
    constructor(memory){this.memory=memory;}
    takeData(offset,limit=3){const values=[];while(values.length<limit&&this.memory.contains(offset,1)&&this.memory.u8(offset)<0x80)values.push(this.memory.u8(offset++));return{values,offset};}
    pointer(offset){if(!this.memory.contains(offset,4))return null;try{return this.memory.pointer(offset);}catch{return null;}}
    command(offset,tick=0,running=null){
      const at=offset,commandTick=tick,raw=this.memory.u8(offset++),reused=raw<0x80&&Number.isInteger(running),opcode=reused?running:raw;
      let name="DATA",args=[],accuracy="partial",terminal=false,target=null,call=false,returning=false,repeating=false,nextRunning=running;
      if(!reused&&opcode>=0xBA)nextRunning=opcode;
      const firstData=reused?[raw]:[];
      if(opcode<0x80)return{command:new ns.SoundCommand({offset:at,opcode:raw,name,arguments:[raw],tick:commandTick,accuracy}),offset,running:null};
      if(opcode>=0x80&&opcode<=0xB0){const duration=DURATIONS[opcode-0x80];name=`W${String(duration).padStart(2,"0")}`;args=[duration];accuracy="verified";tick+=duration;nextRunning=null;}
      else if(opcode===0xB1){name="FINE";accuracy="verified";terminal=true;nextRunning=null;}
      else if(opcode===0xB2||opcode===0xB3){
        name=opcode===0xB2?"GOTO":"PATT";target=this.pointer(offset);
        if(target!==null){args=[ns.hex(target)];offset+=4;accuracy="verified";call=opcode===0xB3;}else args=["invalid pointer"];
        nextRunning=null;
      }
      else if(opcode===0xB4){name="PEND";accuracy="verified";returning=true;nextRunning=null;}
      else if(opcode===0xB5){
        name="REPT";repeating=true;
        if(this.memory.contains(offset,5)){const repeats=this.memory.u8(offset),pointer=this.pointer(offset+1);target=pointer;args=[repeats,pointer===null?"invalid pointer":ns.hex(pointer)];offset+=5;accuracy=pointer===null?"partial":"verified";}
        nextRunning=null;
      }
      else if(opcode===0xB9){name="MEMACC";if(this.memory.contains(offset,3)){args=Array.from(this.memory.slice(offset,3));offset+=3;accuracy="verified";}nextRunning=null;}
      else if(ONE_BYTE.has(opcode)){name=ONE_BYTE.get(opcode);const data=firstData.length?firstData:(this.memory.contains(offset,1)?[this.memory.u8(offset++)]:[]);if(data.length){args=data;accuracy="verified";}}
      else if(opcode===0xCD){name="XCMD";const data=[...firstData];while(data.length<2&&this.memory.contains(offset,1))data.push(this.memory.u8(offset++));if(data.length===2){args=data;accuracy="verified";}}
      else if(opcode===0xCE){name="EOT";const data=firstData.length?{values:firstData,offset}:this.takeData(offset,1);args=data.values;offset=data.offset;accuracy="verified";}
      else if(opcode>=0xCF){
        const duration=opcode===0xCF?null:DURATIONS[opcode-0xCF];name=opcode===0xCF?"TIE":`N${String(duration).padStart(2,"0")}`;
        const data=firstData.length?{values:[...firstData,...this.takeData(offset,2).values],offset:this.takeData(offset,2).offset}:this.takeData(offset);
        args=[...(duration===null?[]:[duration]),...data.values];offset=data.offset;accuracy="verified";
      }
      return{command:new ns.SoundCommand({offset:at,opcode,name,arguments:args,tick:commandTick,accuracy}),offset,tick,running:nextRunning,terminal,target,call,returning,repeating};
    }
    decode(start,{limit=384}={}){
      const commands=[];let offset=Number(start),tick=0,running=null;
      for(let count=0;count<limit&&this.memory.contains(offset,1);count++){
        const decoded=this.command(offset,tick,running);commands.push(decoded.command);offset=decoded.offset;tick=decoded.tick;running=decoded.running;
        if(decoded.terminal||decoded.target!==null)break;
      }
      return commands;
    }
    execute(start,{limit=4096,maxTicks=32768,maxDepth=3,maxVisits=16}={}){
      const commands=[],calls=[],repeats=new Map(),visits=new Map();let offset=Number(start),tick=0,running=null,reason="fine";
      for(let count=0;count<limit&&tick<=maxTicks&&this.memory.contains(offset,1);count++){
        const seen=(visits.get(offset)||0)+1;visits.set(offset,seen);if(seen>maxVisits){reason="loop-limit";break;}
        const decoded=this.command(offset,tick,running);commands.push(decoded.command);offset=decoded.offset;tick=decoded.tick;running=decoded.running;
        if(decoded.command.accuracy!=="verified"){reason="unknown-command";break;}
        if(decoded.terminal){reason="fine";break;}
        if(decoded.call){if(decoded.target===null||calls.length>=maxDepth){reason="invalid-call";break;}calls.push(offset);offset=decoded.target;running=null;continue;}
        if(decoded.returning){if(!calls.length){reason="pattern-end";break;}offset=calls.pop();running=null;continue;}
        if(decoded.repeating&&decoded.target!==null){const requested=Number(decoded.command.arguments[0]);if(requested===0){offset=decoded.target;running=null;continue;}const key=decoded.command.offset,used=(repeats.get(key)||0)+1;repeats.set(key,used);if(used<requested){offset=decoded.target;running=null;}continue;}
        if(decoded.target!==null){offset=decoded.target;running=null;}
      }
      if(commands.length>=limit)reason="command-limit";else if(tick>maxTicks)reason="tick-limit";
      const complete=!commands.some(command=>command.accuracy!=="verified")&&!reason.startsWith("invalid")&&reason!=="unknown-command";
      return Object.freeze({commands:Object.freeze(commands),ticks:tick,complete,reason});
    }
  }

  class GbaSoundDriver extends ns.GenericSoundDriver{
    constructor(context){super({...context,family:"gba"});this.profile=root.gba.assets.profile(this.reader);this.decoder=new GbaM4aDecoder(this.reader.memory);}
    sourceRepository(){return this.reader.capabilities?.provenance?.repository||"the pinned Generation III source profile";}
    sourceGame(){return this.reader.type==="fire_red"?"FireRed":"Emerald";}
    tableOffset(){const offset=this.profile?.songTable;return this.profile?.verifiedReference&&Number.isInteger(offset)&&this.reader.memory.contains(offset,8)?offset:null;}
    cryDocuments(){
      if(!this.profile?.verifiedReference||!Number.isInteger(this.profile.cryTable)||!Number.isInteger(this.profile.speciesIdToCryId))throw new Error(`The verified ${this.sourceGame()} CryData roots are unavailable.`);
      const data=this.reader.gbaSpeciesData||=new root.gba.GbaSpeciesData(this.reader);
      return data.list().map(species=>{
        const cry=data.cry(species.id);
        return new ns.SoundDocument({
          id:species.id,name:`${species.name} cry`,kind:"cry",family:"gba",source:`${this.sourceRepository()} Species-to-cry table → gCryTable ToneData`,accuracy:"verified",offset:cry.offset,editable:false,
          metadata:{group:"cry",speciesId:species.id,speciesName:species.name,dexNumber:data.nationalDex(species.id),cryTable:"gSpeciesIdToCryId → gCryTable · ToneData (12 bytes)",cryId:cry.cryId,type:cry.type,key:cry.key,length:cry.length,attack:cry.attack,decay:cry.decay,sustain:cry.sustain,release:cry.release,waveOffset:cry.waveOffset},
          references:[{type:"species",id:species.id,label:`${species.name} (#${species.id})`,offset:species.nameOffset},{type:"table",label:`gSpeciesIdToCryId → cry #${cry.cryId}`,offset:this.profile.speciesIdToCryId},{type:"table",label:"gCryTable · ToneData",offset:cry.offset},{type:"sample",label:"WaveData",offset:cry.waveOffset}]
        });
      });
    }
    list(){
      const generic=super.list().filter(document=>document.kind!=="cry"),cries=this.cryDocuments(),table=this.tableOffset();if(table===null)return [...generic,...cries];
      const songs=[],count=this.profile?.songCount||0,names=new Map((ns.sourceCatalog?.gba?.songs||[]).map(song=>[song.id,song]));
      for(let id=0;id<count&&this.reader.memory.contains(table+id*8,8);id++){
        let pointer;try{pointer=this.reader.memory.pointer(table+id*8);}catch{continue;}
        if(!this.reader.memory.contains(pointer,8))continue;const trackCount=this.reader.memory.u8(pointer);
        if(trackCount<1||trackCount>16||!this.reader.memory.contains(pointer,8+trackCount*4))continue;
        const sourceSong=names.get(id),group=sourceSong?.kind==="sfx"?"sfx":"music";
        songs.push(new ns.SoundDocument({id,name:sourceSong?.name||`Song #${id}`,kind:group==="sfx"?"sfx":"song",family:"gba",source:"gSongTable · M4A/Sappy",accuracy:"verified",offset:pointer,editable:false,metadata:{group,songId:id,symbol:sourceSong?.symbol||null},references:[{type:"table",label:`gSongTable[${id}]${sourceSong?.symbol?` · ${sourceSong.symbol}`:""}`,offset:table+id*8}]}));
      }
      return songs.length?[...songs,...generic,...cries]:[...generic,...cries];
    }
    describe(document){
      if(document.kind==="cry"){
        const cry=document.metadata;
        return{summary:`Verified ${this.sourceGame()} ToneData for ${cry.speciesName}: cry #${cry.cryId}, waveform pointer ${ns.hex(cry.waveOffset)}, ADSR ${cry.attack}/${cry.decay}/${cry.sustain}/${cry.release}. The signed WaveData waveform is decoded from this ROM; complete M4A mixing remains outside this preview.`,waveform:root.gba.GbaWaveData.decode(this.reader.memory,cry.waveOffset),tracks:[],commands:[new ns.SoundCommand({offset:document.offset,opcode:cry.type,name:"ToneData",arguments:[`type=${ns.hex(cry.type,2)}`,`key=${cry.key}`,`length=${cry.length}`,`WaveData=${ns.hex(cry.waveOffset)}`,`ADSR=${cry.attack}/${cry.decay}/${cry.sustain}/${cry.release}`],tick:0,accuracy:"verified"})],voices:[{offset:cry.waveOffset,label:"WaveData pointer"}]};
      }
      if(!["song","sfx"].includes(document.kind)||!Number.isInteger(document.offset))return super.describe(document);
      const memory=this.reader.memory,header=document.offset,trackCount=memory.u8(header),tracks=[];let voice=null;
      try{voice=memory.pointer(header+4);}catch{}
      const executions=[];
      for(let index=0;index<trackCount;index++)try{const offset=memory.pointer(header+8+index*4);if(memory.contains(offset,1)){const execution=this.decoder.execute(offset);executions.push(execution);tracks.push(new ns.SoundTrack({index:index+1,offset,commands:execution.commands}));}}catch{}
      const maps=Number(document.metadata?.mapCount)||0;
      const programVerified=executions.length===trackCount&&executions.every(execution=>execution.complete);
      return{summary:`${trackCount}-channel M4A program decoded from the pinned ${this.sourceGame()} gSongTable${maps?` · ${maps} map reference${maps===1?"":"s"}`:""}. Calls, returns, repeats, loops and running status are executed with deterministic safety limits. Native M4A voice mixing is a separate unavailable capability.`,coverage:new ns.SoundCoverage({catalog:"verified",program:programVerified?"verified":"partial",audio:"unavailable",writing:"unavailable"}),tracks,commands:tracks.flatMap(track=>track.commands),voices:Number.isInteger(voice)&&memory.contains(voice,1)?[{offset:voice,label:"Voicegroup pointer"}]:[]};
    }
  }

  ns.GbaM4aDecoder=GbaM4aDecoder;
  ns.registry.register("gba",context=>new GbaSoundDriver(context));
})(globalThis);
