(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});

  class Gen1TrainerData{
    static CLASS_COUNT=47;
    static OPPONENT_ID_OFFSET=200;
    static NAME_SIZE=13;
    static PICTURE_BANK=0x13;

    constructor(reader,{speciesData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gen1SpeciesData||new root.gen1.Gen1SpeciesData(reader);
      this.species=this.speciesData.catalog;
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["TrainerDataPointers","TrainerNames","TrainerPicAndMoneyPointers","TrainerAI","TrainerAIPointers"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Gen I source manifest is missing ${name}.`);
      }
      this.bank=this.symbols.TrainerDataPointers.bank;
      if(!Number.isInteger(this.bank))throw new Error("TrainerDataPointers must carry its RGBDS bank.");
      this._classes=null;this._trainers=null;
      global.ProjectValidator?.registerDomain(reader,"gen1-trainers",()=>this.validate());
    }

    className(classId){
      this.assertClassId(classId);
      let offset=this.symbols.TrainerNames.offset;
      for(let id=1;id<classId;id++){
        let length=0;
        while(length<this.constructor.NAME_SIZE&&this.memory.u8(offset+length)!==0x50)length++;
        if(length===this.constructor.NAME_SIZE)throw new Error(`Gen I trainer class ${id} name is not terminated.`);
        offset+=length+1;
      }
      this.memory.assertRange(offset,this.constructor.NAME_SIZE);
      let length=0;
      while(length<this.constructor.NAME_SIZE&&this.memory.u8(offset+length)!==0x50)length++;
      if(length===this.constructor.NAME_SIZE)throw new Error(`Gen I trainer class ${classId} name is not terminated.`);
      return this.reader.getTextByOffset(
        this.reader.getDictionary(this.reader.textDictionary),offset,length
      ).replace(/@.*$/,"").trim()||`Trainer class ${classId}`;
    }

    assertClassId(classId){
      if(!Number.isInteger(classId)||classId<1||classId>this.constructor.CLASS_COUNT){
        throw new RangeError(`Gen I trainer class must be 1–${this.constructor.CLASS_COUNT}.`);
      }
    }

    normalizeClassId(value){
      const id=Number(value);
      if(Number.isInteger(id)&&id>this.constructor.OPPONENT_ID_OFFSET){
        const normalized=id-this.constructor.OPPONENT_ID_OFFSET;
        this.assertClassId(normalized);return normalized;
      }
      this.assertClassId(id);return id;
    }

    classPointer(classId){
      this.assertClassId(classId);
      const pointerOffset=this.symbols.TrainerDataPointers.offset+(classId-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const address=this.memory.u16(pointerOffset),offset=this.memory.banked(this.bank,address);
      return Object.freeze({pointerOffset,address,offset});
    }

    classEnd(classId){
      const start=this.classPointer(classId).offset,candidates=[this.symbols.TrainerAI.offset];
      for(let id=1;id<=this.constructor.CLASS_COUNT;id++){
        const offset=this.classPointer(id).offset;
        if(offset>start)candidates.push(offset);
      }
      return Math.min(...candidates);
    }

    classDocument(classId){
      this.assertClassId(classId);
      const pointer=this.classPointer(classId),end=this.classEnd(classId);
      if(end<=pointer.offset)throw new Error(`Trainer class ${classId} has a non-positive data extent.`);
      const metadataOffset=this.symbols.TrainerPicAndMoneyPointers.offset+(classId-1)*5;
      this.memory.assertRange(metadataOffset,5);
      const pictureAddress=this.memory.u16(metadataOffset);
      const prizeDigits=Array.from(this.memory.slice(metadataOffset+2,3)).map(byte=>[
        byte>>4,byte&0xf
      ]).flat();
      if(prizeDigits.some(digit=>digit>9))throw new Error(`Trainer class ${classId} has invalid BCD prize data.`);
      const basePrize=Number(prizeDigits.join(""));
      const aiOffset=this.symbols.TrainerAIPointers.offset+(classId-1)*3;
      this.memory.assertRange(aiOffset,3);
      const aliasClassIds=Object.freeze(Array.from({length:this.constructor.CLASS_COUNT},(_,index)=>index+1)
        .filter(id=>this.classPointer(id).offset===pointer.offset));
      return Object.freeze({
        id:classId,opponentId:this.constructor.OPPONENT_ID_OFFSET+classId,
        name:this.className(classId),pointerOffset:pointer.pointerOffset,
        offset:pointer.offset,end,length:end-pointer.offset,
        metadataOffset,pictureAddress,pictureOffset:this.memory.banked(this.constructor.PICTURE_BANK,pictureAddress),
        basePrize,aiOffset,aiUses:this.memory.u8(aiOffset),aiAddress:this.memory.u16(aiOffset+1),
        aliasClassIds
      });
    }

    classes(){
      if(!this._classes)this._classes=Object.freeze(Array.from(
        {length:this.constructor.CLASS_COUNT},(_,index)=>this.classDocument(index+1)
      ));
      return this._classes;
    }

    readParty(trainerClass,number,offset,end){
      this.memory.assertRange(offset);let cursor=offset;
      const first=this.memory.u8(cursor++),variableLevels=first===0xff,party=[];
      if(!variableLevels&&(first<1||first>100))throw new Error(`${trainerClass.name} trainer ${number} has invalid shared level ${first}.`);
      while(cursor<end){
        const value=this.memory.u8(cursor);
        if(value===0){cursor++;break;}
        if(party.length>=6)throw new Error(`${trainerClass.name} trainer ${number} exceeds the six-Pokémon party limit.`);
        let level,speciesId,memberOffset=cursor,stride;
        if(variableLevels){
          if(cursor+1>=end)throw new Error(`${trainerClass.name} trainer ${number} has a truncated level/species pair.`);
          level=value;speciesId=this.memory.u8(cursor+1);stride=2;cursor+=2;
        }else{
          level=first;speciesId=value;stride=1;cursor++;
        }
        if(level<1||level>100)throw new Error(`${trainerClass.name} trainer ${number} has invalid level ${level}.`);
        const species=this.species.get(speciesId);
        if(!species)throw new Error(`${trainerClass.name} trainer ${number} has invalid internal species ${speciesId}.`);
        party.push(Object.freeze({
          index:party.length,offset:memberOffset,stride,level,species:speciesId,
          speciesName:species.name,speciesReference:species
        }));
      }
      if(cursor> end||this.memory.u8(cursor-1)!==0)throw new Error(`${trainerClass.name} trainer ${number} is not terminated inside its class extent.`);
      if(!party.length)throw new Error(`${trainerClass.name} trainer ${number} has an empty party.`);
      return Object.freeze({
        id:`${trainerClass.id}:${number}`,number,classId:trainerClass.id,
        opponentId:trainerClass.opponentId,name:`${trainerClass.name} ${number}`,
        offset,end:cursor,length:cursor-offset,format:variableLevels?"variable-levels":"shared-level",
        sharedLevel:variableLevels?null:first,party:Object.freeze(party),
        source:"pret/pokered TrainerDataPointers",editable:true,classAliases:trainerClass.aliasClassIds
      });
    }

    trainers(){
      if(this._trainers)return this._trainers;
      const trainers=[];
      for(const trainerClass of this.classes()){
        let cursor=trainerClass.offset,number=1;
        while(cursor<trainerClass.end){
          const trainer=this.readParty(trainerClass,number,cursor,trainerClass.end);
          trainers.push(trainer);cursor=trainer.end;number++;
        }
        if(cursor!==trainerClass.end)throw new Error(`${trainerClass.name} parties do not fill their verified class extent.`);
      }
      this._trainers=Object.freeze(trainers);return this._trainers;
    }

    validate(){this.invalidate();this.trainers();return[];}
    invalidate(){this._classes=null;this._trainers=null;}

    resolve(reference={}){
      const classId=this.normalizeClassId(Number(reference.trainerClass??reference.classId));
      const number=Number(reference.trainerNumber??reference.number);
      if(!Number.isInteger(number)||number<1)throw new RangeError("Gen I trainer number must be positive.");
      return this.trainers().find(trainer=>trainer.classId===classId&&trainer.number===number)||null;
    }

    editPatches(reference,index,{species,level}={}){
      const trainer=this.resolve(reference);
      if(!trainer)throw new Error("Gen I trainer does not exist.");
      if(!Number.isInteger(index)||index<0||index>=trainer.party.length)throw new RangeError("Trainer party slot is out of range.");
      const member=trainer.party[index],speciesReference=this.species.get(Number(species)),nextLevel=Number(level);
      if(!speciesReference)throw new RangeError("Gen I internal species ID must be 1–190.");
      if(!Number.isInteger(nextLevel)||nextLevel<1||nextLevel>100)throw new RangeError("Level must be 1–100.");
      const patches=[];
      if(member.stride===2){
        patches.push({offset:member.offset,expected:Uint8Array.of(member.level,member.species),next:Uint8Array.of(nextLevel,speciesReference.id)});
      }else{
        patches.push({offset:trainer.offset,expected:Uint8Array.of(trainer.sharedLevel),next:Uint8Array.of(nextLevel)});
        patches.push({offset:member.offset,expected:Uint8Array.of(member.species),next:Uint8Array.of(speciesReference.id)});
      }
      return Object.freeze({trainer,member,species:speciesReference,level:nextLevel,patches:Object.freeze(patches)});
    }

    resourceGraph(baseGraph=this.speciesData.resourceGraph()){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder()
        .addGraph(baseGraph)
        .fillGraph(this.speciesData.resourceGraph());
      const source={repository:this.reader.capabilities?.provenance?.repository||"pret/pokered",manifest:this.reader.capabilities?.provenance?.id||null};
      const id=(type,key)=>resources.ResourceId.create("gen1",type,key);
      for(const trainerClass of this.classes()){
        const classId=id("trainer-class",String(trainerClass.id));
        builder.addNode({
          id:classId,label:trainerClass.name,accuracy:"verified",provenance:source,
          ranges:[
            {offset:trainerClass.pointerOffset,length:2},{offset:trainerClass.metadataOffset,length:5},
            {offset:trainerClass.aiOffset,length:3}
          ],
          data:{classId:trainerClass.id,opponentId:trainerClass.opponentId,basePrize:trainerClass.basePrize,aliasClassIds:trainerClass.aliasClassIds}
        });
        const canonicalAlias=Math.min(...trainerClass.aliasClassIds);
        if(canonicalAlias!==trainerClass.id)builder.addEdge({
          id:`${classId}/shared-party-data`,source:classId,target:id("trainer-class",String(canonicalAlias)),
          field:"partyData",kind:"derived",confidence:"verified",provenance:source,rewritePolicy:"manual",
          data:{reason:"Both class pointers target the same party byte range"}
        });
      }
      for(const trainer of this.trainers()){
        const key=`${trainer.classId}-${trainer.number}`,trainerId=id("trainer",key);
        const classId=id("trainer-class",String(trainer.classId));
        builder.addNode({id:trainerId,label:trainer.name,accuracy:"verified",provenance:source,ranges:[{offset:trainer.offset,length:trainer.length}],data:{classId:trainer.classId,number:trainer.number,format:trainer.format}});
        builder.addEdge({id:`${classId}/trainer-${trainer.number}`,source:classId,target:trainerId,field:`trainers[${trainer.number-1}]`,kind:"contains",confidence:"verified",provenance:source,rewritePolicy:"repoint"});
        trainer.party.forEach((member,index)=>{
          const memberId=id("party-member",`${key}-${index+1}`);
          builder.addNode({id:memberId,label:`${trainer.name} · slot ${index+1}`,accuracy:"verified",provenance:source,ranges:[{offset:member.offset,length:member.stride}],data:{level:member.level,internalSpeciesId:member.species}});
          builder.addEdge({id:`${trainerId}/party-${index+1}`,source:trainerId,target:memberId,field:`party[${index}]`,kind:"contains",confidence:"verified",provenance:source,rewritePolicy:"repoint"});
          const species=member.speciesReference;
          const target=species.dexNumber?id("species",String(species.dexNumber)):null;
          builder.addEdge({
            id:`${memberId}/species`,source:memberId,target,field:"species",
            range:{offset:member.offset+(member.stride===2?1:0),length:1},kind:"id",
            confidence:"verified",provenance:source,rewritePolicy:"rewrite-id",
            unresolved:target?null:`Internal species ${member.species} is a MissingNo. slot`
          });
        });
      }
      return builder.build();
    }
  }

  root.gen1=Object.freeze({...root.gen1,Gen1TrainerData});
})(globalThis);
