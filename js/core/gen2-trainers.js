(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});
  const FORMATS=Object.freeze([
    Object.freeze({id:0,name:"normal",stride:2,item:false,moves:false}),
    Object.freeze({id:1,name:"moves",stride:6,item:false,moves:true}),
    Object.freeze({id:2,name:"item",stride:3,item:true,moves:false}),
    Object.freeze({id:3,name:"item-moves",stride:7,item:true,moves:true})
  ]);

  class Gen2TrainerData{
    static CLASS_COUNT=67;
    static CLASS_NAME_SIZE=13;
    static NAME_END=0x50;
    static PARTY_END=0xff;
    static PARTY_LIMIT=6;
    static EMPTY_CLASS_IDS=Object.freeze([10]);

    constructor(reader,{speciesData=null,moveData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gen2SpeciesData||new root.gen2.Gen2SpeciesData(reader);
      this.species=this.speciesData.catalog;
      this.moves=moveData||reader.gen2MoveData||new root.gen2.Gen2MoveData(reader);
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["TrainerGroups","TrainerClassNames","TrainerPicPointers"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Crystal source manifest is missing ${name}.`);
      }
      if(!Number.isInteger(this.symbols.TrainerGroups.bank))throw new Error("Crystal TrainerGroups must carry its RGBDS bank.");
      this._classes=null;this._trainers=null;
      global.ProjectValidator?.registerDomain(reader,"gen2-trainers",()=>this.validate());
    }

    assertClassId(id){
      if(!Number.isInteger(id)||id<1||id>this.constructor.CLASS_COUNT)throw new RangeError(`Crystal trainer class must be 1–${this.constructor.CLASS_COUNT}.`);
    }

    className(id){
      this.assertClassId(id);
      const offset=this.symbols.TrainerClassNames.offset+(id-1)*this.constructor.CLASS_NAME_SIZE;
      this.memory.assertRange(offset,this.constructor.CLASS_NAME_SIZE);
      return this.speciesData.decode(offset,this.constructor.CLASS_NAME_SIZE)||`Trainer class ${id}`;
    }

    classPointer(id){
      this.assertClassId(id);
      const pointerOffset=this.symbols.TrainerGroups.offset+(id-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const address=this.memory.u16(pointerOffset),offset=this.memory.banked(this.symbols.TrainerGroups.bank,address);
      return Object.freeze({pointerOffset,address,offset});
    }

    classEnd(id){
      const start=this.classPointer(id).offset,candidates=[(this.symbols.TrainerGroups.bank+1)*Gen2Memory.BANK_SIZE];
      for(let other=1;other<=this.constructor.CLASS_COUNT;other++){
        const offset=this.classPointer(other).offset;if(offset>start)candidates.push(offset);
      }
      return Math.min(...candidates);
    }

    classDocument(id){
      const pointer=this.classPointer(id),end=this.classEnd(id),picturePointerOffset=this.symbols.TrainerPicPointers.offset+(id-1)*3;
      this.memory.assertRange(picturePointerOffset,3);
      const pictureBank=this.memory.u8(picturePointerOffset),pictureAddress=this.memory.u16(picturePointerOffset+1);
      return Object.freeze({
        id,name:this.className(id),pointerOffset:pointer.pointerOffset,offset:pointer.offset,
        end:this.constructor.EMPTY_CLASS_IDS.includes(id)?pointer.offset:end,
        length:this.constructor.EMPTY_CLASS_IDS.includes(id)?0:end-pointer.offset,
        picturePointerOffset,pictureBank,pictureAddress,pictureOffset:this.memory.banked(pictureBank,pictureAddress)
      });
    }

    classes(){
      if(!this._classes)this._classes=Object.freeze(Array.from({length:this.constructor.CLASS_COUNT},(_,index)=>this.classDocument(index+1)));
      return this._classes;
    }

    decodeName(offset,end,className,number){
      let cursor=offset;
      while(cursor<end&&this.memory.u8(cursor)!==this.constructor.NAME_END)cursor++;
      if(cursor>=end)throw new Error(`${className} trainer ${number} has no terminated name.`);
      const name=this.speciesData.decode(offset,cursor-offset)||"?";
      return Object.freeze({name,end:cursor+1});
    }

    readTrainer(trainerClass,number,offset){
      const named=this.decodeName(offset,trainerClass.end,trainerClass.name,number),typeOffset=named.end;
      this.memory.assertRange(typeOffset);
      const type=this.memory.u8(typeOffset),format=FORMATS[type];
      if(!format)throw new Error(`${trainerClass.name} ${named.name} has unknown party type ${type}.`);
      let cursor=typeOffset+1;const party=[];
      while(cursor<trainerClass.end){
        if(this.memory.u8(cursor)===this.constructor.PARTY_END){cursor++;break;}
        if(party.length>=this.constructor.PARTY_LIMIT)throw new Error(`${trainerClass.name} ${named.name} exceeds six Pokémon.`);
        this.memory.assertRange(cursor,format.stride);
        const level=this.memory.u8(cursor),speciesId=this.memory.u8(cursor+1),species=this.species.get(speciesId);
        if(level<1||level>100)throw new Error(`${trainerClass.name} ${named.name} has invalid level ${level}.`);
        if(!species)throw new Error(`${trainerClass.name} ${named.name} has invalid species ${speciesId}.`);
        let at=cursor+2,item=null,moveIds=[];
        if(format.item)item=this.memory.u8(at++);
        if(format.moves){moveIds=Array.from(this.memory.slice(at,4));at+=4;}
        party.push(Object.freeze({
          index:party.length,offset:cursor,stride:format.stride,level,species:speciesId,speciesName:species.name,
          speciesReference:species,item,moveIds:Object.freeze(moveIds),
          moves:Object.freeze(moveIds.filter(Boolean).map(id=>this.moves.get(id).name))
        }));
        cursor=at;
      }
      if(cursor>trainerClass.end||this.memory.u8(cursor-1)!==this.constructor.PARTY_END)throw new Error(`${trainerClass.name} ${named.name} is not terminated inside its class extent.`);
      if(!party.length)throw new Error(`${trainerClass.name} ${named.name} has an empty party.`);
      return Object.freeze({
        id:`${trainerClass.id}:${number}`,classId:trainerClass.id,number,
        name:`${trainerClass.name} ${named.name}`,trainerName:named.name,
        offset,end:cursor,length:cursor-offset,nameOffset:offset,typeOffset,type,format:format.name,
        hasItems:format.item,hasMoves:format.moves,party:Object.freeze(party),
        source:"pret/pokecrystal TrainerGroups",editable:true
      });
    }

    trainers(){
      if(this._trainers)return this._trainers;
      const result=[];
      for(const trainerClass of this.classes()){
        let cursor=trainerClass.offset,number=1;
        while(cursor<trainerClass.end&&!(trainerClass.id===this.constructor.CLASS_COUNT&&number>1)){
          const trainer=this.readTrainer(trainerClass,number,cursor);
          result.push(trainer);cursor=trainer.end;number++;
        }
        if(trainerClass.id!==this.constructor.CLASS_COUNT&&cursor!==trainerClass.end)throw new Error(`${trainerClass.name} class ${trainerClass.id} trainer records do not fill their verified extent (${cursor} != ${trainerClass.end}).`);
      }
      this._trainers=Object.freeze(result);return this._trainers;
    }

    resolve(reference={}){
      const classId=Number(reference.trainerClass??reference.classId),number=Number(reference.trainerNumber??reference.number);
      this.assertClassId(classId);
      if(!Number.isInteger(number)||number<1)throw new RangeError("Crystal trainer number must be positive.");
      return this.trainers().find(trainer=>trainer.classId===classId&&trainer.number===number)||null;
    }

    editPlan(reference,index,values={}){
      const trainer=this.resolve(reference);
      if(!trainer)throw new Error("Crystal trainer does not exist.");
      if(!Number.isInteger(index)||index<0||index>=trainer.party.length)throw new RangeError("Crystal trainer party slot is out of range.");
      const member=trainer.party[index],species=this.species.get(Number(values.species)),level=Number(values.level);
      if(!species)throw new RangeError("Crystal species ID must be 1–251.");
      if(!Number.isInteger(level)||level<1||level>100)throw new RangeError("Crystal trainer level must be 1–100.");
      const next=[level,species.id];
      if(trainer.hasItems){
        const item=values.item===undefined?member.item:Number(values.item);
        if(!Number.isInteger(item)||item<0||item>255)throw new RangeError("Crystal held item must be 0–255.");
        next.push(item);
      }
      if(trainer.hasMoves){
        for(let slot=0;slot<4;slot++){
          const move=values[`move${slot+1}`]===undefined?member.moveIds[slot]:Number(values[`move${slot+1}`]);
          if(!Number.isInteger(move)||move<0||move>251)throw new RangeError("Crystal trainer move must be 0–251.");
          next.push(move);
        }
      }
      const before=this.memory.slice(member.offset,member.stride),after=Uint8Array.from(next);
      return Object.freeze({trainer,member,offset:member.offset,before,after,species,level});
    }

    validate(){this.invalidate();this.trainers();return[];}
    invalidate(){this._classes=null;this._trainers=null;return this;}

    resourceGraph(baseGraph=this.speciesData.resourceGraph()){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder()
        .addGraph(baseGraph)
        .fillGraph(this.speciesData.resourceGraph());
      if(typeof this.moves.resourceGraph==="function")builder.fillGraph(this.moves.resourceGraph());
      const provenance={repository:this.reader.capabilities?.provenance?.repository||"pret/pokecrystal",manifest:this.reader.capabilities?.provenance?.id||null};
      const rid=(type,key)=>resources.ResourceId.create("gen2",type,String(key));
      const ensureMove=moveId=>{
        const id=rid("move",moveId);
        if(builder.nodes.has(id))return id;
        const move=this.moves.get(moveId);
        builder.addNode({
          id,label:move.name||`Move ${moveId}`,accuracy:"verified",provenance,
          ranges:Number.isInteger(move.offset)&&Number.isInteger(this.moves.recordSize)
            ?[{offset:move.offset,length:this.moves.recordSize}]
            :[],
          data:{moveId}
        });
        return id;
      };
      for(const trainerClass of this.classes()){
        const classId=rid("trainer-class",trainerClass.id);
        builder.addNode({id:classId,label:trainerClass.name,accuracy:"verified",provenance,
          ranges:[{offset:trainerClass.pointerOffset,length:2},{offset:trainerClass.picturePointerOffset,length:3}],
          data:{classId:trainerClass.id,pictureOffset:trainerClass.pictureOffset}});
      }
      for(const trainer of this.trainers()){
        const key=`${trainer.classId}-${trainer.number}`,trainerId=rid("trainer",key),classId=rid("trainer-class",trainer.classId);
        builder.addNode({id:trainerId,label:trainer.name,accuracy:"verified",provenance,ranges:[{offset:trainer.offset,length:trainer.length}],
          data:{classId:trainer.classId,number:trainer.number,type:trainer.type,format:trainer.format}});
        builder.addEdge({id:`${classId}/trainer-${trainer.number}`,source:classId,target:trainerId,field:`trainers[${trainer.number-1}]`,kind:"contains",confidence:"verified",provenance,rewritePolicy:"repoint"});
        trainer.party.forEach((member,index)=>{
          const memberId=rid("party-member",`${key}-${index+1}`);
          builder.addNode({id:memberId,label:`${trainer.name} · slot ${index+1}`,accuracy:"verified",provenance,ranges:[{offset:member.offset,length:member.stride}],
            data:{classId:trainer.classId,trainerNumber:trainer.number,slot:index+1,level:member.level,speciesId:member.species,item:member.item,moveIds:member.moveIds}});
          builder.addEdge({id:`${trainerId}/party-${index+1}`,source:trainerId,target:memberId,field:`party[${index}]`,kind:"contains",confidence:"verified",provenance,rewritePolicy:"repoint"});
          builder.addEdge({id:`${memberId}/species`,source:memberId,target:rid("species",member.species),field:"species",
            range:{offset:member.offset+1,length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id"});
          member.moveIds.forEach((moveId,moveIndex)=>{
            if(!moveId)return;
            const moveOffset=member.offset+2+(trainer.hasItems?1:0)+moveIndex;
            builder.addEdge({id:`${memberId}/move-${moveIndex+1}`,source:memberId,target:ensureMove(moveId),field:`moves[${moveIndex}]`,
              range:{offset:moveOffset,length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id"});
          });
        });
      }
      return builder.build();
    }
  }

  root.gen2=Object.freeze({...root.gen2,Gen2TrainerData,TRAINER_FORMATS:FORMATS});
})(globalThis);
