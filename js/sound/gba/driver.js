(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.sound;
  const DURATIONS=Object.freeze([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,28,30,32,36,40,42,44,48,52,54,56,60,64,66,68,72,76,78,80,84,88,90,92,96]);
  const ONE_BYTE=Object.freeze(new Map([[0xBA,"PRIO"],[0xBB,"TEMPO"],[0xBC,"KEYSH"],[0xBD,"VOICE"],[0xBE,"VOL"],[0xBF,"PAN"],[0xC0,"BEND"],[0xC1,"BENDR"],[0xC2,"LFOS"],[0xC3,"LFODL"],[0xC4,"MOD"],[0xC5,"MODT"],[0xC8,"TUNE"]]));

  // Read-only structural decoder for the byte language defined by
  // pokeemerald/sound/MPlayDef.s. It intentionally does not execute branches,
  // running status, voices or mixer state.
  class GbaM4aDecoder{
    constructor(memory){this.memory=memory;}
    takeData(offset,limit=3){const values=[];while(values.length<limit&&this.memory.contains(offset,1)&&this.memory.u8(offset)<0x80)values.push(this.memory.u8(offset++));return{values,offset};}
    pointer(offset){if(!this.memory.contains(offset,4))return null;try{return this.memory.pointer(offset);}catch{return null;}}
    decode(start,{limit=384}={}){
      const commands=[];let offset=Number(start),tick=0;
      for(let count=0;count<limit&&this.memory.contains(offset,1);count++){
        const at=offset,commandTick=tick,opcode=this.memory.u8(offset++);let name="DATA",args=[],accuracy="partial",terminal=false;
        if(opcode>=0x80&&opcode<=0xB0){const duration=DURATIONS[opcode-0x80];name=`W${String(duration).padStart(2,"0")}`;args=[duration];accuracy="verified";tick+=duration;}
        else if(opcode===0xB1){name="FINE";accuracy="verified";terminal=true;}
        else if(opcode===0xB2||opcode===0xB3){
          name=opcode===0xB2?"GOTO":"PATT";const target=this.pointer(offset);
          if(target!==null){args=[ns.hex(target)];offset+=4;accuracy="verified";terminal=opcode===0xB2;}
          else args=["invalid pointer"];
        }
        else if(opcode===0xB4){name="PEND";accuracy="verified";}
        else if(opcode===0xB5){
          name="REPT";
          if(this.memory.contains(offset,5)){const repeats=this.memory.u8(offset),target=this.pointer(offset+1);args=[repeats,target===null?"invalid pointer":ns.hex(target)];offset+=5;accuracy=target===null?"partial":"verified";}
        }
        else if(opcode===0xB9){name="MEMACC";if(this.memory.contains(offset,3)){args=Array.from(this.memory.slice(offset,3));offset+=3;accuracy="verified";}}
        else if(ONE_BYTE.has(opcode)){name=ONE_BYTE.get(opcode);if(this.memory.contains(offset,1)){args=[this.memory.u8(offset++)];accuracy="verified";}}
        else if(opcode===0xCD){name="XCMD";if(this.memory.contains(offset,2)){args=Array.from(this.memory.slice(offset,2));offset+=2;accuracy="verified";}}
        else if(opcode===0xCE){name="EOT";const data=this.takeData(offset,1);args=data.values;offset=data.offset;accuracy="verified";}
        else if(opcode>=0xCF){
          const duration=opcode===0xCF?null:DURATIONS[opcode-0xCF];name=opcode===0xCF?"TIE":`N${String(duration).padStart(2,"0")}`;
          const data=this.takeData(offset);args=[...(duration===null?[]:[duration]),...data.values];offset=data.offset;accuracy="verified";
        }
        else args=[opcode];
        commands.push(new ns.SoundCommand({offset:at,opcode,name,arguments:args,tick:commandTick,accuracy}));
        if(terminal)break;
      }
      return commands;
    }
  }

  class GbaSoundDriver extends ns.GenericSoundDriver{
    constructor(context){super({...context,family:"gba"});this.profile=root.gba.assets.profile(this.reader);this.decoder=new GbaM4aDecoder(this.reader.memory);}
    tableOffset(){const offset=this.profile?.songTable;return this.profile?.verifiedReference&&Number.isInteger(offset)&&this.reader.memory.contains(offset,8)?offset:null;}
    waveData(offset){
      const memory=this.reader.memory;if(!Number.isInteger(offset)||!memory.contains(offset,16))return null;
      const frequency=memory.u32(offset+4),loopStart=memory.u32(offset+8),size=memory.u32(offset+12);
      if(size<1||size>0x100000||loopStart>size||!memory.contains(offset+16,size))return null;
      const bytes=memory.slice(offset+16,size),samples=new Float32Array(size);for(let index=0;index<size;index++)samples[index]=((bytes[index]<<24)>>24)/128;
      return Object.freeze({native:true,samples,frequency,loopStart,size,offset:offset+16});
    }
    cryDocuments(){
      if(!this.profile?.verifiedReference||!Number.isInteger(this.profile.cryTable)||!Number.isInteger(this.profile.speciesIdToCryId))throw new Error("The verified Emerald CryData roots are unavailable.");
      const data=this.reader.gbaSpeciesData||=new root.gba.GbaSpeciesData(this.reader);
      return data.list().map(species=>{
        const cry=data.cry(species.id);
        return new ns.SoundDocument({
          id:species.id,name:`${species.name} cry`,kind:"cry",family:"gba",source:"pret/pokeemerald gSpeciesIdToCryId → gCryTable ToneData",accuracy:"verified",offset:cry.offset,editable:false,
          metadata:{group:"cry",speciesId:species.id,speciesName:species.name,dexNumber:data.nationalDex(species.id),cryTable:"gSpeciesIdToCryId → gCryTable · ToneData (12 bytes)",cryId:cry.cryId,type:cry.type,key:cry.key,length:cry.length,attack:cry.attack,decay:cry.decay,sustain:cry.sustain,release:cry.release,waveOffset:cry.waveOffset},
          references:[{type:"species",id:species.id,label:`${species.name} (#${species.id})`,offset:species.nameOffset},{type:"table",label:`gSpeciesIdToCryId → cry #${cry.cryId}`,offset:this.profile.speciesIdToCryId},{type:"table",label:"gCryTable · ToneData",offset:cry.offset},{type:"sample",label:"WaveData",offset:cry.waveOffset}]
        });
      });
    }
    list(){
      const generic=super.list().filter(document=>document.kind!=="cry"),cries=this.cryDocuments(),table=this.tableOffset();if(table===null)return [...generic,...cries];
      const songs=[],count=this.profile?.songCount||0;
      for(let id=0;id<count&&this.reader.memory.contains(table+id*8,8);id++){
        let pointer;try{pointer=this.reader.memory.pointer(table+id*8);}catch{continue;}
        if(!this.reader.memory.contains(pointer,8))continue;const trackCount=this.reader.memory.u8(pointer);
        if(trackCount<1||trackCount>16||!this.reader.memory.contains(pointer,8+trackCount*4))continue;
        songs.push(new ns.SoundDocument({id,name:`Song #${id}`,kind:"song",family:"gba",source:"gSongTable · M4A/Sappy",accuracy:"partial",offset:pointer,editable:false,metadata:{group:"music",songId:id},references:[{type:"table",label:`gSongTable[${id}]`,offset:table+id*8}]}));
      }
      return songs.length?[...songs,...generic,...cries]:[...generic,...cries];
    }
    describe(document){
      if(document.kind==="cry"){
        const cry=document.metadata;
        return{summary:`Verified Emerald ToneData for ${cry.speciesName}: cry #${cry.cryId}, waveform pointer ${ns.hex(cry.waveOffset)}, ADSR ${cry.attack}/${cry.decay}/${cry.sustain}/${cry.release}. The waveform is read from ROM when its WaveData header is valid; browser playback remains a parameter cue, not the native M4A mixer.`,waveform:this.waveData(cry.waveOffset),tracks:[],commands:[new ns.SoundCommand({offset:document.offset,opcode:cry.type,name:"ToneData",arguments:[`type=${ns.hex(cry.type,2)}`,`key=${cry.key}`,`length=${cry.length}`,`WaveData=${ns.hex(cry.waveOffset)}`,`ADSR=${cry.attack}/${cry.decay}/${cry.sustain}/${cry.release}`],tick:0,accuracy:"verified"})],voices:[{offset:cry.waveOffset,label:"WaveData pointer"}]};
      }
      if(document.kind!=="song"||!Number.isInteger(document.offset))return super.describe(document);
      const memory=this.reader.memory,header=document.offset,trackCount=memory.u8(header),tracks=[];let voice=null;
      try{voice=memory.pointer(header+4);}catch{}
      for(let index=0;index<trackCount;index++)try{const offset=memory.pointer(header+8+index*4);if(memory.contains(offset,1))tracks.push(new ns.SoundTrack({index:index+1,offset,commands:this.decoder.decode(offset)}));}catch{}
      return{summary:"Song header and track roots come from the pinned Emerald gSongTable. MPlayDef command widths are decoded exactly; branch execution, running status, voices and playback remain partial.",tracks,commands:tracks.flatMap(track=>track.commands),voices:Number.isInteger(voice)&&memory.contains(voice,1)?[{offset:voice,label:"Voicegroup pointer"}]:[]};
    }
  }

  ns.GbaM4aDecoder=GbaM4aDecoder;
  ns.registry.register("gba",context=>new GbaSoundDriver(context));
})(globalThis);
