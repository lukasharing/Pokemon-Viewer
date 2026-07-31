(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});
  const METHODS=Object.freeze({
    1:Object.freeze({name:"level",length:3}),
    2:Object.freeze({name:"item",length:3}),
    3:Object.freeze({name:"trade",length:3}),
    4:Object.freeze({name:"happiness",length:3}),
    5:Object.freeze({name:"stat",length:4})
  });
  const HAPPINESS=Object.freeze({1:"Any time",2:"Morning/Day",3:"Night"});
  const STATS=Object.freeze({1:"Attack > Defense",2:"Attack < Defense",3:"Attack = Defense"});

  class Gen2MoveData{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      this.structure=reader.memoryProfile?.structure?.("Gen2Move");
      if(!this.structure)throw new Error("The Gen II Move manual structure contract is unavailable.");
      this.count=this.requiredInteger("count");this.recordSize=this.requiredInteger("size");
      this.nameBytes=this.requiredInteger("nameBytes");this.accuracyScale=this.requiredInteger("accuracyScale");
      for(const name of ["Moves","MoveNames","TMHMMoves"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Crystal source manifest is missing ${name}.`);
      }
      this._moves=null;this._machines=null;
      global.ProjectValidator?.registerDomain(reader,"gen2-moves",()=>this.validate());
    }

    requiredInteger(name){
      const value=this.structure?.[name];
      if(!Number.isInteger(value)||value<=0)throw new Error(`The Gen II Move contract has invalid ${name}.`);
      return value;
    }
    field(name){
      const value=this.structure?.fields?.[name];
      if(!Number.isInteger(value?.byte)||value.type!=="u8")throw new Error(`The Gen II Move contract has invalid field '${name}'.`);
      return value.byte;
    }
    related(name,{allowZero=false}={}){
      const value=this.structure?.related?.[name];
      if(!Number.isInteger(value)||value<(allowZero?0:1))throw new Error(`The Gen II Move contract has invalid related value '${name}'.`);
      return value;
    }

    assertId(id){
      if(!Number.isInteger(id)||id<1||id>this.count)throw new RangeError(`Crystal move ID must be 1–${this.count}.`);
    }

    name(id){
      this.assertId(id);
      const offset=this.symbols.MoveNames.offset+(id-1)*this.nameBytes;
      this.memory.assertRange(offset,this.nameBytes);
      return this.reader.getTextByOffset(this.reader.getDictionary(this.reader.textDictionary),offset,this.nameBytes).trim()||`Move #${id}`;
    }

    get(id){
      this.assertId(id);
      const offset=this.symbols.Moves.offset+(id-1)*this.recordSize,nameOffset=this.symbols.MoveNames.offset+(id-1)*this.nameBytes;
      this.memory.assertRange(offset,this.recordSize);
      const accuracy=this.memory.u8(offset+this.field("accuracy")),effectChance=this.memory.u8(offset+this.field("effectChance"));
      return Object.freeze({
        id,name:this.name(id),offset,nameOffset,
        animation:this.memory.u8(offset+this.field("animation")),effect:this.memory.u8(offset+this.field("effect")),
        power:this.memory.u8(offset+this.field("power")),type:this.memory.u8(offset+this.field("type")),
        accuracy,accuracyPercent:Math.round(accuracy*100/this.accuracyScale),
        pp:this.memory.u8(offset+this.field("pp")),effectChance,effectChancePercent:Math.round(effectChance*100/this.accuracyScale)
      });
    }

    list(){
      if(!this._moves)this._moves=Object.freeze(Array.from({length:this.count},(_,index)=>this.get(index+1)));
      return this._moves;
    }
    validate(){
      this.invalidate();
      for(const move of this.list())if(move.pp<1||move.pp>40)throw new Error(`${move.name} has invalid PP ${move.pp}.`);
      for(const machine of this.machines())if(machine.moveId<1||machine.moveId>this.count)throw new Error(`${machine.label} has invalid move ${machine.moveId}.`);
      return[];
    }

    machines(){
      if(this._machines)return this._machines;
      const offset=this.symbols.TMHMMoves.offset,count=this.related("machineCount"),
        terminator=this.related("machineTerminator",{allowZero:true}),
        tmCount=this.related("tmCount"),hmCount=this.related("hmCount");
      this.memory.assertRange(offset,count+1);
      if(this.memory.u8(offset+count)!==terminator)throw new Error("Crystal TMHMMoves is missing its verified terminator.");
      this._machines=Object.freeze(Array.from({length:count},(_,index)=>{
        const kind=index<tmCount?"TM":index<tmCount+hmCount?"HM":"Tutor",
          number=index<tmCount?index+1:index<tmCount+hmCount?index-tmCount+1:index-tmCount-hmCount+1;
        return Object.freeze({
          index:index+1,kind,number,
          label:kind==="Tutor"?`Tutor ${number}`:`${kind}${String(number).padStart(2,"0")}`,
          offset:offset+index,moveId:this.memory.u8(offset+index)
        });
      }));
      return this._machines;
    }

    machinesForMove(id){this.assertId(id);return Object.freeze(this.machines().filter(machine=>machine.moveId===id));}

    encode(move,values={}){
      if(!move||!Number.isInteger(move.id))throw new TypeError("A decoded Crystal move is required.");
      const field=(name,fallback,{min=0,max=255}={})=>{
        const value=values[name]===undefined?fallback:Number(values[name]);
        if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`Crystal move ${name} must be ${min}–${max}.`);
        return value;
      };
      const result=MemoryUtils.bytes(this.memory,move.offset,this.recordSize);
      for(const [name,value] of[
        ["animation",field("animation",move.animation)],["effect",field("effect",move.effect)],
        ["power",field("power",move.power)],["type",field("type",move.type)],
        ["accuracy",field("accuracy",move.accuracy)],["pp",field("pp",move.pp,{min:1,max:40})],
        ["effectChance",field("effectChance",move.effectChance)]
      ])result[this.field(name)]=value;
      return result;
    }

    invalidate(){this._moves=null;this._machines=null;return this;}
  }

  class Gen2ProgressionData{
    static COUNT=251;
    static MAX_RECORD_BYTES=512;

    constructor(reader,{speciesData=null,moveData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gen2SpeciesData||new root.gen2.Gen2SpeciesData(reader);
      this.species=this.speciesData.catalog;
      this.moves=moveData||reader.gen2MoveData||new Gen2MoveData(reader);
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["EvosAttacksPointers","EggMovePointers"]){
        if(!Number.isInteger(this.symbols[name]?.offset)||!Number.isInteger(this.symbols[name]?.bank))throw new Error(`Crystal source manifest is missing banked ${name}.`);
      }
      this._documents=new Map();this.patcher=new RelocatablePatch(this.memory);
      global.ProjectValidator?.registerDomain(reader,"gen2-progression",()=>this.validate());
    }

    assertSpecies(id){
      if(!Number.isInteger(id)||id<1||id>this.constructor.COUNT)throw new RangeError(`Crystal species ID must be 1–${this.constructor.COUNT}.`);
    }

    pointer(symbolName,id){
      this.assertSpecies(id);
      const symbol=this.symbols[symbolName],pointerOffset=symbol.offset+(id-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const address=this.memory.u16(pointerOffset),offset=this.memory.banked(symbol.bank,address);
      return Object.freeze({pointerOffset,address,bank:symbol.bank,offset});
    }

    evolution(method,offset,index,speciesName){
      const definition=METHODS[method];
      if(!definition)throw new Error(`${speciesName} has unknown Crystal evolution method ${method}.`);
      this.memory.assertRange(offset,definition.length);
      const targetId=this.memory.u8(offset+definition.length-1),target=this.species.get(targetId);
      if(!target)throw new Error(`${speciesName} has invalid Crystal evolution target ${targetId}.`);
      const value={index,offset,length:definition.length,method,name:definition.name,targetId,target};
      if(method===1)value.level=this.memory.u8(offset+1);
      if(method===2)value.item=this.memory.u8(offset+1);
      if(method===3)value.heldItem=this.memory.u8(offset+1);
      if(method===4){value.trigger=this.memory.u8(offset+1);value.triggerName=HAPPINESS[value.trigger]||`Trigger #${value.trigger}`;}
      if(method===5){value.level=this.memory.u8(offset+1);value.stat=this.memory.u8(offset+2);value.statName=STATS[value.stat]||`Condition #${value.stat}`;}
      return Object.freeze(value);
    }

    document(id){
      this.assertSpecies(id);
      if(this._documents.has(id))return this._documents.get(id);
      const species=this.species.get(id),pointer=this.pointer("EvosAttacksPointers",id),limit=Math.min(this.memory.size,pointer.offset+this.constructor.MAX_RECORD_BYTES);
      let cursor=pointer.offset;const evolutions=[],learnset=[];
      while(cursor<limit){
        const method=this.memory.u8(cursor);
        if(method===0){cursor++;break;}
        const evolution=this.evolution(method,cursor,evolutions.length,species.name);
        evolutions.push(evolution);cursor+=evolution.length;
      }
      if(cursor>=limit)throw new Error(`${species.name} Crystal evolution list exceeds its bounded record.`);
      while(cursor<limit){
        const level=this.memory.u8(cursor);
        if(level===0){cursor++;break;}
        this.memory.assertRange(cursor,2);
        if(level>100)throw new Error(`${species.name} has invalid Crystal learnset level ${level}.`);
        const moveId=this.memory.u8(cursor+1),move=this.moves.get(moveId);
        learnset.push(Object.freeze({index:learnset.length,offset:cursor,length:2,level,moveId,move}));cursor+=2;
      }
      if(cursor>=limit)throw new Error(`${species.name} Crystal learnset exceeds its bounded record.`);
      const eggPointer=this.pointer("EggMovePointers",id),eggMoves=[];
      for(let eggCursor=eggPointer.offset;eggCursor<Math.min(this.memory.size,eggPointer.offset+256);eggCursor++){
        const moveId=this.memory.u8(eggCursor);
        if(moveId===0xff)break;
        eggMoves.push(Object.freeze({index:eggMoves.length,offset:eggCursor,length:1,moveId,move:this.moves.get(moveId)}));
        if(eggMoves.length===255)throw new Error(`${species.name} Crystal egg-move list is not terminated.`);
      }
      const result=Object.freeze({
        id,species,pointerOffset:pointer.pointerOffset,offset:pointer.offset,end:cursor,length:cursor-pointer.offset,
        eggPointerOffset:eggPointer.pointerOffset,eggOffset:eggPointer.offset,
        evolutions:Object.freeze(evolutions),learnset:Object.freeze(learnset),eggMoves:Object.freeze(eggMoves)
      });
      this._documents.set(id,result);return result;
    }

    list(){return Object.freeze(Array.from({length:this.constructor.COUNT},(_,index)=>this.document(index+1)));}
    validate(){this.invalidate();this.list();return[];}
    invalidate(){this._documents.clear();this.moves.invalidate();return this;}

    byte(value,label,{min=0,max=255}={}){
      const number=Number(value);
      if(!Number.isInteger(number)||number<min||number>max)throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
      return number;
    }

    encodeEvolution(value){
      if(!value||typeof value!=="object")throw new TypeError("A Crystal evolution entry must be an object.");
      const method=typeof value.method==="string"?Number(Object.entries(METHODS).find(([,definition])=>definition.name===value.method)?.[0]):Number(value.method);
      const definition=METHODS[method];
      if(!definition)throw new RangeError(`Unknown Crystal evolution method '${value.method}'.`);
      const targetId=this.byte(value.targetId??value.target,"Evolution target",{min:1,max:this.constructor.COUNT});
      if(method===1)return Uint8Array.of(method,this.byte(value.level,"Evolution level",{min:1,max:100}),targetId);
      if(method===2)return Uint8Array.of(method,this.byte(value.item,"Evolution item",{min:1}),targetId);
      if(method===3)return Uint8Array.of(method,value.heldItem===undefined||value.heldItem===null?0xff:this.byte(value.heldItem,"Trade held item"),targetId);
      if(method===4)return Uint8Array.of(method,this.byte(value.trigger,"Happiness trigger",{min:1,max:3}),targetId);
      return Uint8Array.of(method,this.byte(value.level,"Stat evolution level",{min:1,max:100}),this.byte(value.stat,"Stat condition",{min:1,max:3}),targetId);
    }

    encodeProgression({evolutions=[],learnset=[]}={}){
      if(!Array.isArray(evolutions)||!Array.isArray(learnset))throw new TypeError("Crystal evolutions and learnset must be arrays.");
      const evolutionBytes=evolutions.map(value=>this.encodeEvolution(value));
      const learnBytes=learnset.map(value=>Uint8Array.of(
        this.byte(value.level,"Learnset level",{min:1,max:100}),
        this.byte(value.moveId??value.move,"Learnset move",{min:1,max:this.moves.count})
      ));
      const length=evolutionBytes.reduce((sum,value)=>sum+value.length,0)+1+learnBytes.length*2+1;
      if(length>this.constructor.MAX_RECORD_BYTES)throw new RangeError("Crystal progression record exceeds its 512-byte safety limit.");
      const result=new Uint8Array(length);let cursor=0;
      for(const value of evolutionBytes){result.set(value,cursor);cursor+=value.length;}
      result[cursor++]=0;
      for(const value of learnBytes){result.set(value,cursor);cursor+=value.length;}
      result[cursor]=0;return result;
    }

    encodeEggMoves(values=[]){
      if(!Array.isArray(values))throw new TypeError("Crystal egg moves must be an array.");
      const ids=values.map(value=>this.byte(value?.moveId??value,"Egg move",{min:1,max:this.moves.count}));
      if(ids.length>254)throw new RangeError("Crystal egg-move list supports at most 254 entries.");
      return Uint8Array.of(...ids,0xff);
    }

    owners(symbolName,offset){
      const owners=[];
      for(let id=1;id<=this.constructor.COUNT;id++)if(this.pointer(symbolName,id).offset===offset)owners.push(id);
      return Object.freeze(owners);
    }

    freeTail(kind){
      const bank=kind==="progression"?this.symbols.EvosAttacksPointers.bank:this.symbols.EggMovePointers.bank;
      const ends=this.list().map(document=>kind==="progression"?document.end:document.eggOffset+document.eggMoves.length+1);
      const start=Math.max(...ends),end=Math.min(this.memory.size,(bank+1)*Gen2Memory.BANK_SIZE);
      if(start>=end)throw new RangeError(`Crystal ${kind} table has no verified bank tail.`);
      return Object.freeze({start,end,fill:this.memory.u8(start),minimumRun:1});
    }

    progressionPlan(id,values){
      const current=this.document(id),nextBytes=this.encodeProgression(values);
      const patch=this.patcher.plan({
        offset:current.offset,previousLength:current.length,nextBytes,
        reference:{kind:"gen2Near",pointerOffset:current.pointerOffset,bank:this.symbols.EvosAttacksPointers.bank},
        allocation:this.freeTail("progression")
      });
      return Object.freeze({kind:"progression",id,current,nextBytes,owners:Object.freeze([id]),patch});
    }

    eggMovePlan(id,values){
      const current=this.document(id),nextBytes=this.encodeEggMoves(values),owners=this.owners("EggMovePointers",current.eggOffset);
      const previousLength=current.eggMoves.length+1;
      const patch=this.patcher.plan({
        offset:current.eggOffset,previousLength:owners.length>1?0:previousLength,nextBytes,
        reference:{kind:"gen2Near",pointerOffset:current.eggPointerOffset,bank:this.symbols.EggMovePointers.bank},
        allocation:this.freeTail("eggMoves")
      });
      return Object.freeze({kind:"eggMoves",id,current,nextBytes,owners,shared:owners.length>1,patch});
    }

    apply(plan){const target=this.patcher.apply(plan.patch);this.invalidate();return target;}
    restore(plan){const target=this.patcher.restore(plan.patch);this.invalidate();return target;}

    resourceGraph(baseGraph=this.speciesData.resourceGraph()){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder().addGraph(baseGraph);
      const provenance={repository:this.reader.capabilities?.provenance?.repository||"pret/pokecrystal",manifest:this.reader.capabilities?.provenance?.id||null};
      const rid=(type,key)=>resources.ResourceId.create("gen2",type,String(key));
      for(const move of this.moves.list()){
        builder.addNode({id:rid("move",move.id),label:move.name,accuracy:"verified",provenance,
          ranges:[{offset:move.offset,length:this.moves.recordSize},{offset:move.nameOffset,length:this.moves.nameBytes}],
          data:{moveId:move.id,animation:move.animation,effect:move.effect,power:move.power,type:move.type,accuracy:move.accuracy,pp:move.pp,effectChance:move.effectChance}});
      }
      for(const machine of this.moves.machines()){
        const machineId=rid("machine",machine.label.toLowerCase().replace(" ","-"));
        builder.addNode({id:machineId,label:machine.label,accuracy:"verified",provenance,
          ranges:[{offset:machine.offset,length:1}],data:{kind:machine.kind,number:machine.number,moveId:machine.moveId}});
        builder.addEdge({id:`${machineId}/move`,source:machineId,target:rid("move",machine.moveId),field:"move",
          range:{offset:machine.offset,length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id"});
      }
      for(const document of this.list()){
        const speciesId=rid("species",document.id),evolutionId=rid("evolution-set",document.id),learnsetId=rid("learnset",document.id),eggId=rid("egg-moves",document.id);
        builder.addNode({id:evolutionId,label:`${document.species.name} evolutions`,accuracy:"verified",provenance,ranges:[{offset:document.pointerOffset,length:2},{offset:document.offset,length:document.length}],data:{speciesId:document.id,count:document.evolutions.length}});
        builder.addNode({id:learnsetId,label:`${document.species.name} level-up learnset`,accuracy:"verified",provenance,ranges:[{offset:document.pointerOffset,length:2},{offset:document.offset,length:document.length}],data:{speciesId:document.id,count:document.learnset.length}});
        builder.addNode({id:eggId,label:`${document.species.name} egg moves`,accuracy:"verified",provenance,ranges:[{offset:document.eggPointerOffset,length:2},...(document.eggMoves.length?[{offset:document.eggOffset,length:document.eggMoves.length+1}]:[])],data:{speciesId:document.id,count:document.eggMoves.length}});
        for(const [field,target] of [["evolutions",evolutionId],["learnset",learnsetId],["eggMoves",eggId]]){
          builder.addEdge({id:`${speciesId}/${field}`,source:speciesId,target,field,kind:"contains",confidence:"verified",provenance,rewritePolicy:"repoint"});
        }
        document.evolutions.forEach((entry,index)=>builder.addEdge({
          id:`${evolutionId}/target-${index+1}`,source:evolutionId,target:rid("species",entry.targetId),field:`evolutions[${index}].target`,
          range:{offset:entry.offset+entry.length-1,length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id",
          data:{method:entry.name,level:entry.level??null,item:entry.item??entry.heldItem??null,trigger:entry.trigger??null,stat:entry.stat??null}
        }));
        document.learnset.forEach((entry,index)=>builder.addEdge({
          id:`${learnsetId}/move-${index+1}`,source:learnsetId,target:rid("move",entry.moveId),field:`learnset[${index}].move`,
          range:{offset:entry.offset+1,length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id",data:{level:entry.level}
        }));
        document.eggMoves.forEach((entry,index)=>builder.addEdge({
          id:`${eggId}/move-${index+1}`,source:eggId,target:rid("move",entry.moveId),field:`eggMoves[${index}]`,
          range:{offset:entry.offset,length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id"
        }));
        const base=this.speciesData.base(document.id);
        for(const machineIndex of this.speciesData.machineIndexes(base)){
          const machine=this.moves.machines()[machineIndex-1],bit=machineIndex-1,machineId=rid("machine",machine.label.toLowerCase().replace(" ","-"));
          builder.addEdge({
            id:`${speciesId}/machine-${machineIndex}`,source:speciesId,target:machineId,field:`tmHm[${machineIndex-1}]`,
            range:{offset:base.offset+24+(bit>>3),length:1},kind:"id",confidence:"verified",provenance,rewritePolicy:"rewrite-id",
            data:{bit:bit&7,machineIndex}
          });
        }
      }
      return builder.build();
    }
  }

  root.gen2=Object.freeze({...root.gen2,Gen2MoveData,Gen2ProgressionData,METHODS,HAPPINESS,STATS});
})(globalThis);
