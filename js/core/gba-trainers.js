(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const WIDTHS=Object.freeze({u8:1,u16:2,u32:4,gba32:4});
  const requireField=(structure,name,type)=>{
    const field=structure?.fields?.[name],width=WIDTHS[type],size=structure?.size??structure?.stride;
    if(!field||field.type!==type||!Number.isInteger(size)||!Number.isInteger(field.byte)||field.byte<0||field.byte+width>size){
      throw new Error(`Generation III trainer structure '${name}' is not a valid ${type} field.`);
    }
    return Object.freeze({...field});
  };
  const requireArrayField=(structure,name,type,count)=>{
    const field=requireField(structure,name,type),actual=Number(field.count),size=structure?.size??structure?.stride;
    if(actual!==count||field.byte+WIDTHS[type]*actual>size){
      throw new Error(`Generation III trainer structure '${name}' is not a valid ${type}[${count}] field.`);
    }
    return field;
  };
  const read=(memory,offset,field)=>{
    if(field.type==="u8")return memory.u8(offset+field.byte);
    if(field.type==="u16")return memory.u16(offset+field.byte);
    if(field.type==="u32")return memory.u32(offset+field.byte);
    if(field.type==="gba32")return memory.pointer(offset+field.byte);
    throw new TypeError(`Unsupported Generation III trainer field type '${field.type}'.`);
  };
  const write=(bytes,field,value)=>{
    bytes[field.byte]=value&0xff;
    if(WIDTHS[field.type]>=2)bytes[field.byte+1]=value>>>8&0xff;
    if(WIDTHS[field.type]>=4){
      bytes[field.byte+2]=value>>>16&0xff;
      bytes[field.byte+3]=value>>>24&0xff;
    }
  };

  class GbaTrainerContract{
    static resolve(reader){
      const profile=reader?.memoryProfile,definition=profile?.structure?.("GbaTrainer");
      if(!definition)return null;
      if(!Number.isInteger(definition.size)||definition.size<1)throw new Error("Generation III Trainer size is invalid.");
      if(!profile.symbol?.("gTrainers"))return null;
      const symbol=profile.require("gTrainers"),schema=profile.schema("gTrainers");
      if(!Number.isInteger(symbol.offset))throw new Error("gTrainers has no verified ROM offset.");
      if(Number.isInteger(schema?.stride)&&schema.stride!==definition.size){
        throw new Error(`gTrainers stride ${schema.stride} conflicts with the reviewed Trainer size ${definition.size}.`);
      }
      const count=Number(symbol.count??schema?.count);
      if(!Number.isInteger(count)||count<1)throw new Error("gTrainers has no reviewed record count.");
      const fields=Object.freeze({
        flags:requireField(definition,"partyFlags","u8"),
        trainerClass:requireField(definition,"trainerClass","u8"),
        encounterMusicGender:requireField(definition,"encounterMusicGender","u8"),
        trainerPic:requireField(definition,"trainerPic","u8"),
        trainerName:requireArrayField(definition,"trainerName","u8",12),
        items:requireArrayField(definition,"items","u16",4),
        doubleBattle:requireField(definition,"doubleBattle","u8"),
        aiFlags:requireField(definition,"aiFlags","u32"),
        partySize:requireField(definition,"partySize","u8"),
        party:requireField(definition,"party","gba32")
      });
      const mask=definition.partyFlagsMask,maximumPartySize=definition.maximumPartySize;
      if(!Number.isInteger(mask)||mask<0||mask>0xff)throw new Error("Generation III trainer party flag mask is invalid.");
      if(!Number.isInteger(maximumPartySize)||maximumPartySize<1)throw new Error("Generation III trainer party limit is invalid.");
      const formats=Object.freeze(Object.fromEntries(Array.from({length:mask+1},(_,flags)=>{
        const format=definition.partyFormats?.[flags];
        if(!format||!Number.isInteger(format.stride)||format.stride<1){
          throw new Error(`Generation III trainer party format ${flags} is missing.`);
        }
        const required=Object.freeze({
          iv:requireField(format,"iv","u16"),
          level:requireField(format,"level","u8"),
          species:requireField(format,"species","u16")
        });
        const item=format.heldItem?requireField(format,"heldItem","u16"):null;
        const moves=format.customMoves?requireField(format,"moves","u16"):null;
        if(moves&&moves.count!==4)throw new Error(`Generation III trainer party format ${flags} must contain four moves.`);
        return[flags,Object.freeze({
          flags,stride:format.stride,item:Boolean(format.heldItem),moves:Boolean(format.customMoves),
          fields:Object.freeze({...required,item,moves})
        })];
      })));
      return Object.freeze({
        id:`${profile.knowledgeId}-trainers`,source:profile.knowledge?.evidence,
        offset:symbol.offset,count,size:definition.size,fields,formats,mask,maximumPartySize,
        trainerClassNames:Object.freeze([...(definition.trainerClassNames||[])])
      });
    }
  }

  class GbaTrainerData{
    constructor(reader,{speciesData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gbaSpeciesData||new root.gba.GbaSpeciesData(reader);
      this.profile=this.speciesData.profile;
      this.contract=GbaTrainerContract.resolve(reader);
      if(!this.contract)throw new Error("No reviewed Generation III Trainer contract is available for this ROM profile.");
      const moveSymbol=reader.memoryProfile.symbol("gBattleMoves"),moveSchema=reader.memoryProfile.schema("gBattleMoves");
      this.maximumMoveId=Number(moveSymbol?.count??moveSchema?.count)-1;
      this._resourceGraph=null;
      global.ProjectValidator?.registerDomain(reader,"gba-trainers",()=>this.validate());
    }
    read(id){
      const contract=this.contract;
      if(!Number.isInteger(id)||id<0||id>=contract.count)throw new RangeError(`GBA trainer must be 0–${contract.count-1}.`);
      const offset=contract.offset+id*contract.size;
      this.memory.assertRange(offset,contract.size);
      const flags=read(this.memory,offset,contract.fields.flags)&contract.mask,format=contract.formats[flags],
        trainerClass=read(this.memory,offset,contract.fields.trainerClass),
        encounterMusicGender=read(this.memory,offset,contract.fields.encounterMusicGender),
        trainerPic=read(this.memory,offset,contract.fields.trainerPic),
        items=Object.freeze(Array.from({length:contract.fields.items.count},(_,index)=>
          this.memory.u16(offset+contract.fields.items.byte+index*2)
        )),
        doubleBattle=read(this.memory,offset,contract.fields.doubleBattle),
        aiFlags=read(this.memory,offset,contract.fields.aiFlags),
        partySize=read(this.memory,offset,contract.fields.partySize),
        partyOffset=read(this.memory,offset,contract.fields.party);
      if(partySize>contract.maximumPartySize)throw new Error(`Trainer ${id} exceeds the ${contract.maximumPartySize}-Pokémon party limit.`);
      const metadata={
        id,offset,flags,format,trainerClass,
        trainerClassName:contract.trainerClassNames[trainerClass]||`Trainer class ${trainerClass}`,
        encounterMusicGender,trainerPic,
        nameOffset:offset+contract.fields.trainerName.byte,
        nameLength:contract.fields.trainerName.count,
        items,doubleBattle,aiFlags,partySize
      };
      if(!partySize)return Object.freeze({...metadata,partyOffset:null,party:Object.freeze([])});
      if(partyOffset===null)throw new Error(`Trainer ${id} has ${partySize} members but no valid party pointer.`);
      const party=Object.freeze(Array.from({length:partySize},(_,index)=>{
        const source=partyOffset+index*format.stride;this.memory.assertRange(source,format.stride);
        const iv=read(this.memory,source,format.fields.iv),level=read(this.memory,source,format.fields.level),
          species=read(this.memory,source,format.fields.species);
        if(level<1||level>100)throw new Error(`Trainer ${id} party member ${index+1} has invalid level ${level}.`);
        if(species<1||species>this.profile.speciesCount)throw new Error(`Trainer ${id} party member ${index+1} has invalid species ${species}.`);
        const item=format.item?read(this.memory,source,format.fields.item):null;
        let moves=[];
        if(format.moves){
          if(!Number.isInteger(this.maximumMoveId)||this.maximumMoveId<1)throw new Error("gBattleMoves count is required to validate custom trainer moves.");
          moves=Object.freeze(Array.from({length:4},(_,slot)=>{
            const move=this.memory.u16(source+format.fields.moves.byte+slot*2);
            if(move>this.maximumMoveId)throw new Error(`Trainer ${id} party member ${index+1} has invalid move ${move}.`);
            return move;
          }));
        }
        return Object.freeze({index,offset:source,stride:format.stride,iv,level,species,item,moves});
      }));
      return Object.freeze({...metadata,partyOffset,party});
    }
    list(){return Object.freeze(Array.from({length:this.contract.count},(_,id)=>this.read(id)));}
    trainers(){return this.list();}
    resolve(reference){
      const id=Number(reference?.trainerId??reference?.id);
      return Number.isInteger(id)&&id>=0&&id<this.contract.count?this.read(id):null;
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
      const moves=record.format.moves?Array.from({length:4},(_,slot)=>integer(values[`move${slot+1}`]??member.moves[slot],`Move ${slot+1}`,0,this.maximumMoveId)):[];
      const before=MemoryUtils.bytes(this.memory,member.offset,member.stride),after=Uint8Array.from(before);
      write(after,record.format.fields.level,level);write(after,record.format.fields.species,species);
      if(record.format.item)write(after,record.format.fields.item,item);
      if(record.format.moves)for(const [slot,move] of moves.entries())write(after,{...record.format.fields.moves,byte:record.format.fields.moves.byte+slot*2},move);
      return Object.freeze({offset:member.offset,before,after,species:this.speciesData.catalog?.get?.(species)||Object.freeze({id:species,name:`Species ${species}`}),level,item,moves:Object.freeze(moves)});
    }
    validate(){this.list();return[];}
    resourceGraph(baseGraph=null){
      const resources=root.resources;
      if(!resources?.ResourceGraphBuilder)throw new Error("Resource graph library is not loaded.");
      if(baseGraph?.has?.("gba:trainer:0"))return baseGraph;
      let graph=baseGraph;
      if(!graph?.has?.("gba:species:1"))graph=this.speciesData.resourceGraph(graph);
      if(!baseGraph&&this._resourceGraph)return this._resourceGraph;
      const builder=new resources.ResourceGraphBuilder().addGraph(graph);
      const provenance=this.reader.capabilities?.provenance||{};
      const rid=(type,key)=>resources.ResourceId.create("gba",type,String(key));
      for(const trainer of this.list()){
        const trainerId=rid("trainer",trainer.id);
        builder.addNode({
          id:trainerId,label:`${trainer.trainerClassName} ${trainer.id}`,
          accuracy:"verified",provenance,
          ranges:[{offset:trainer.offset,length:this.contract.size}],
          data:{
            trainerId:trainer.id,classId:trainer.trainerClass,pictureId:trainer.trainerPic,
            doubleBattle:trainer.doubleBattle,aiFlags:trainer.aiFlags,partyFlags:trainer.flags
          }
        });
        trainer.party.forEach((member,index)=>{
          const memberId=rid("party-member",`${trainer.id}-${index+1}`),fields=trainer.format.fields;
          const writable=[
            {offset:member.offset+fields.level.byte,length:WIDTHS[fields.level.type]},
            {offset:member.offset+fields.species.byte,length:WIDTHS[fields.species.type]}
          ];
          if(fields.item)writable.push({offset:member.offset+fields.item.byte,length:WIDTHS[fields.item.type]});
          if(fields.moves)writable.push({
            offset:member.offset+fields.moves.byte,
            length:WIDTHS[fields.moves.type]*fields.moves.count
          });
          builder.addNode({
            id:memberId,label:`Trainer ${trainer.id} · party ${index+1}`,
            accuracy:"verified",provenance,
            ranges:[{offset:member.offset,length:member.stride}],writeRanges:writable,
            data:{
              trainerId:trainer.id,slot:index+1,level:member.level,speciesId:member.species,
              itemId:member.item,moveIds:member.moves
            }
          });
          builder.addEdge({
            id:`${trainerId}/party-${index+1}`,source:trainerId,target:memberId,
            field:`party[${index}]`,kind:"contains",confidence:"verified",
            provenance,rewritePolicy:"immutable"
          });
          builder.addEdge({
            id:`${memberId}/species`,source:memberId,target:rid("species",member.species),
            field:"species",
            range:{offset:member.offset+fields.species.byte,length:WIDTHS[fields.species.type]},
            kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id"
          });
        });
      }
      const result=builder.build();
      if(!baseGraph)this._resourceGraph=result;
      return result;
    }
  }

  root.gba=Object.freeze({...root.gba,GbaTrainerContract,GbaTrainerData});
})(globalThis);
