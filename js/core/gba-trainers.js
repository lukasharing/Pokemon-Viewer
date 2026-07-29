(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const FORMATS=Object.freeze([
    // agbcc aligns these u16-based structs to four bytes. The apparent
    // six/fourteen-byte C payloads therefore occupy eight/sixteen bytes in ROM.
    Object.freeze({stride:8,item:false,moves:false}),
    Object.freeze({stride:16,item:false,moves:true}),
    Object.freeze({stride:8,item:true,moves:false}),
    Object.freeze({stride:16,item:true,moves:true})
  ]);
  const TRAINER_CLASSES=Object.freeze(["PKMN TRAINER","PKMN TRAINER","HIKER","TEAM AQUA","PKMN BREEDER","COOLTRAINER","BIRD KEEPER","COLLECTOR","SWIMMER♂","TEAM MAGMA","EXPERT","AQUA ADMIN","BLACK BELT","AQUA LEADER","HEX MANIAC","AROMA LADY","RUIN MANIAC","INTERVIEWER","TUBER","TUBER","LADY","BEAUTY","RICH BOY","POKéMANIAC","GUITARIST","KINDLER","CAMPER","PICNICKER","BUG MANIAC","PSYCHIC","GENTLEMAN","ELITE FOUR","LEADER","SCHOOL KID","SR. AND JR.","WINSTRATE","POKéFAN","YOUNGSTER","CHAMPION","FISHERMAN","TRIATHLETE","DRAGON TAMER","NINJA BOY","BATTLE GIRL","PARASOL LADY","SWIMMER♀","TWINS","SAILOR","COOLTRAINER","MAGMA ADMIN","PKMN TRAINER","BUG CATCHER","PKMN RANGER","MAGMA LEADER","LASS","YOUNG COUPLE","OLD COUPLE","SIS AND BRO","SALON MAIDEN","DOME ACE","PALACE MAVEN","ARENA TYCOON","FACTORY HEAD","PIKE QUEEN","PYRAMID KING","PKMN TRAINER"]);

  class GbaTrainerData{
    static RECORD_SIZE=40;
    constructor(reader,{speciesData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gbaSpeciesData||new root.gba.GbaSpeciesData(reader);
      this.profile=this.speciesData.profile;
      if(reader.type!=="emerald"||!Number.isInteger(this.profile.trainers))throw new Error("Exact GBA Trainer validation is currently available only for audited Emerald.");
      global.ProjectValidator?.registerDomain(reader,"gba-trainers",()=>this.validate());
    }
    read(id){
      if(!Number.isInteger(id)||id<0||id>=this.profile.trainerCount)throw new RangeError(`GBA trainer must be 0–${this.profile.trainerCount-1}.`);
      const offset=this.profile.trainers+id*this.constructor.RECORD_SIZE;
      this.memory.assertRange(offset,this.constructor.RECORD_SIZE);
      const flags=this.memory.u8(offset)&3,format=FORMATS[flags],trainerClass=this.memory.u8(offset+1),encounterMusicGender=this.memory.u8(offset+2),trainerPic=this.memory.u8(offset+3),partySize=this.memory.u8(offset+32),partyOffset=this.memory.pointer(offset+36);
      if(partySize>6)throw new Error(`Trainer ${id} exceeds the six-Pokémon party limit.`);
      const metadata={id,offset,flags,format,trainerClass,trainerClassName:TRAINER_CLASSES[trainerClass]||`Trainer class ${trainerClass}`,encounterMusicGender,trainerPic,partySize};
      if(!partySize)return Object.freeze({...metadata,partyOffset:null,party:Object.freeze([])});
      if(partyOffset===null)throw new Error(`Trainer ${id} has ${partySize} members but no valid party pointer.`);
      const party=Object.freeze(Array.from({length:partySize},(_,index)=>{
        const source=partyOffset+index*format.stride;this.memory.assertRange(source,format.stride);
        const iv=this.memory.u16(source),level=this.memory.u8(source+2),species=this.memory.u16(source+4);
        if(level<1||level>100)throw new Error(`Trainer ${id} party member ${index+1} has invalid level ${level}.`);
        if(species<1||species>this.profile.speciesCount)throw new Error(`Trainer ${id} party member ${index+1} has invalid species ${species}.`);
        let at=source+6,item=null,moves=[];
        if(format.item){item=this.memory.u16(at);at+=2;}
        if(format.moves){
          moves=Object.freeze(Array.from({length:4},(_,slot)=>{
            const move=this.memory.u16(at+slot*2);
            if(move>354)throw new Error(`Trainer ${id} party member ${index+1} has invalid move ${move}.`);
            return move;
          }));
        }
        return Object.freeze({index,offset:source,stride:format.stride,iv,level,species,item,moves});
      }));
      return Object.freeze({...metadata,partyOffset,party});
    }
    list(){return Object.freeze(Array.from({length:this.profile.trainerCount},(_,id)=>this.read(id)));}
    trainers(){return this.list();}
    resolve(reference){
      const id=Number(reference?.trainerId??reference?.id);
      return Number.isInteger(id)&&id>=0&&id<this.profile.trainerCount?this.read(id):null;
    }
    editPlan(trainer,index,values={}){
      const record=Number.isInteger(trainer?.id)?this.read(trainer.id):trainer,member=record?.party?.[index];
      if(!member)throw new RangeError("Trainer party member does not exist.");
      const integer=(value,label,min,max)=>{
        const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new RangeError(`${label} must be ${min}–${max}.`);return number;
      };
      const species=integer(values.species??member.species,"Species",1,this.profile.speciesCount);
      const level=integer(values.level??member.level,"Level",1,100);
      const item=record.format.item?integer(values.item??member.item,"Held item",0,0xffff):null;
      const moves=record.format.moves?Array.from({length:4},(_,slot)=>integer(values[`move${slot+1}`]??member.moves[slot],`Move ${slot+1}`,0,354)):[];
      const before=MemoryUtils.bytes(this.memory,member.offset,member.stride),after=Uint8Array.from(before);
      after[2]=level;after[4]=species&255;after[5]=species>>>8;
      let cursor=6;
      if(record.format.item){after[cursor]=item&255;after[cursor+1]=item>>>8;cursor+=2;}
      if(record.format.moves)for(const [slot,move] of moves.entries()){after[cursor+slot*2]=move&255;after[cursor+slot*2+1]=move>>>8;}
      return Object.freeze({offset:member.offset,before,after,species:this.speciesData.catalog?.get?.(species)||Object.freeze({id:species,name:`Species ${species}`}),level,item,moves:Object.freeze(moves)});
    }
    validate(){this.list();return[];}
  }

  root.gba=Object.freeze({...root.gba,GbaTrainerData});
})(globalThis);
