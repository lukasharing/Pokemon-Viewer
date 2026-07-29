(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});
  const METHODS=Object.freeze({1:"level",2:"item",3:"trade"});
  const STONES=Object.freeze({0x0a:"Moon Stone",0x20:"Fire Stone",0x21:"Thunder Stone",0x22:"Water Stone",0x2f:"Leaf Stone"});
  const TYPES=Object.freeze({
    0x00:"Normal",0x01:"Fighting",0x02:"Flying",0x03:"Poison",0x04:"Ground",0x05:"Rock",
    0x07:"Bug",0x08:"Ghost",0x14:"Fire",0x15:"Water",0x16:"Grass",0x17:"Electric",
    0x18:"Psychic",0x19:"Ice",0x1a:"Dragon"
  });
  const EFFECT_NAMES=Object.freeze([
    "NO_ADDITIONAL_EFFECT","EFFECT_01_UNUSED","POISON_SIDE_EFFECT1","DRAIN_HP_EFFECT","BURN_SIDE_EFFECT1",
    "FREEZE_SIDE_EFFECT1","PARALYZE_SIDE_EFFECT1","EXPLODE_EFFECT","DREAM_EATER_EFFECT","MIRROR_MOVE_EFFECT",
    "ATTACK_UP1_EFFECT","DEFENSE_UP1_EFFECT","SPEED_UP1_EFFECT","SPECIAL_UP1_EFFECT","ACCURACY_UP1_EFFECT",
    "EVASION_UP1_EFFECT","PAY_DAY_EFFECT","SWIFT_EFFECT","ATTACK_DOWN1_EFFECT","DEFENSE_DOWN1_EFFECT",
    "SPEED_DOWN1_EFFECT","SPECIAL_DOWN1_EFFECT","ACCURACY_DOWN1_EFFECT","EVASION_DOWN1_EFFECT","CONVERSION_EFFECT",
    "HAZE_EFFECT","BIDE_EFFECT","THRASH_PETAL_DANCE_EFFECT","SWITCH_AND_TELEPORT_EFFECT","TWO_TO_FIVE_ATTACKS_EFFECT",
    "EFFECT_1E_UNUSED","FLINCH_SIDE_EFFECT1","SLEEP_EFFECT","POISON_SIDE_EFFECT2","BURN_SIDE_EFFECT2",
    "FREEZE_SIDE_EFFECT2_UNUSED","PARALYZE_SIDE_EFFECT2","FLINCH_SIDE_EFFECT2","OHKO_EFFECT","CHARGE_EFFECT",
    "SUPER_FANG_EFFECT","SPECIAL_DAMAGE_EFFECT","TRAPPING_EFFECT","FLY_EFFECT","ATTACK_TWICE_EFFECT",
    "JUMP_KICK_EFFECT","MIST_EFFECT","FOCUS_ENERGY_EFFECT","RECOIL_EFFECT","CONFUSION_EFFECT",
    "ATTACK_UP2_EFFECT","DEFENSE_UP2_EFFECT","SPEED_UP2_EFFECT","SPECIAL_UP2_EFFECT","ACCURACY_UP2_EFFECT",
    "EVASION_UP2_EFFECT","HEAL_EFFECT","TRANSFORM_EFFECT","ATTACK_DOWN2_EFFECT","DEFENSE_DOWN2_EFFECT",
    "SPEED_DOWN2_EFFECT","SPECIAL_DOWN2_EFFECT","ACCURACY_DOWN2_EFFECT","EVASION_DOWN2_EFFECT","LIGHT_SCREEN_EFFECT",
    "REFLECT_EFFECT","POISON_EFFECT","PARALYZE_EFFECT","ATTACK_DOWN_SIDE_EFFECT","DEFENSE_DOWN_SIDE_EFFECT",
    "SPEED_DOWN_SIDE_EFFECT","SPECIAL_DOWN_SIDE_EFFECT","UNUSED_EFFECT_48","UNUSED_EFFECT_49","UNUSED_EFFECT_4A",
    "UNUSED_EFFECT_4B","CONFUSION_SIDE_EFFECT","TWINEEDLE_EFFECT","UNUSED_EFFECT_4E","SUBSTITUTE_EFFECT",
    "HYPER_BEAM_EFFECT","RAGE_EFFECT","MIMIC_EFFECT","METRONOME_EFFECT","LEECH_SEED_EFFECT","SPLASH_EFFECT",
    "DISABLE_EFFECT"
  ]);
  const title=value=>String(value).replace(/\d$/,"").replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());

  class Gen1MoveData{
    static COUNT=165;
    static RECORD_SIZE=6;
    static NAME_SIZE=14;

    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["Moves","MoveNames","TechnicalMachines","MoveEffectPointerTable","MoveSoundTable","AttackAnimationPointers"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Gen I source manifest is missing ${name}.`);
      }
      this._moves=null;this._machines=null;this._nameOffsets=[this.symbols.MoveNames.offset];
      global.ProjectValidator?.registerDomain(reader,"gen1-moves",()=>this.validate());
    }

    nameOffset(id){
      this.assertId(id);
      while(this._nameOffsets.length<id){
        const offset=this._nameOffsets.at(-1);let length=0;
        while(length<this.constructor.NAME_SIZE&&this.memory.u8(offset+length)!==0x50)length++;
        if(length===this.constructor.NAME_SIZE)throw new Error(`Gen I move ${this._nameOffsets.length} name is not terminated.`);
        this._nameOffsets.push(offset+length+1);
      }
      return this._nameOffsets[id-1];
    }

    name(id){
      const offset=this.nameOffset(id);
      this.memory.assertRange(offset,this.constructor.NAME_SIZE);
      let length=0;
      while(length<this.constructor.NAME_SIZE&&this.memory.u8(offset+length)!==0x50)length++;
      if(length===this.constructor.NAME_SIZE)throw new Error(`Gen I move ${id} name is not terminated.`);
      return this.reader.getTextByOffset(
        this.reader.getDictionary(this.reader.textDictionary),offset,length
      ).replace(/@.*$/,"").trim()||`Move #${id}`;
    }

    assertId(id){
      if(!Number.isInteger(id)||id<1||id>this.constructor.COUNT)throw new RangeError(`Gen I move ID must be 1–${this.constructor.COUNT}.`);
    }

    get(id){
      this.assertId(id);
      const offset=this.symbols.Moves.offset+(id-1)*this.constructor.RECORD_SIZE;
      const nameOffset=this.nameOffset(id);
      this.memory.assertRange(offset,this.constructor.RECORD_SIZE);
      const accuracy=this.memory.u8(offset+4);
      const effect=this.memory.u8(offset+1),animation=this.memory.u8(offset);
      return Object.freeze({
        id,name:this.name(id),offset,nameOffset,
        animation,effect,
        power:this.memory.u8(offset+2),type:this.memory.u8(offset+3),
        accuracy,accuracyPercent:Math.round(accuracy*100/255),
        pp:this.memory.u8(offset+5),
        effectDocument:this.effect(effect),animationDocument:this.animation(animation),sound:this.sound(id),
        machines:this.machinesForMove(id)
      });
    }

    list(){
      if(!this._moves)this._moves=Object.freeze(Array.from({length:this.constructor.COUNT},(_,index)=>this.get(index+1)));
      return this._moves;
    }
    validate(){
      this.invalidate();
      for(const move of this.list()){
        if(!Object.hasOwn(TYPES,move.type))throw new Error(`${move.name} has invalid type ${move.type}.`);
        if(move.pp<1||move.pp>40)throw new Error(`${move.name} has invalid PP ${move.pp}.`);
      }
      for(const machine of this.machines())if(machine.moveId<1||machine.moveId>this.constructor.COUNT)throw new Error(`${machine.label} has invalid move ${machine.moveId}.`);
      return[];
    }

    typeName(id){return TYPES[id]||`Type ${MemoryUtils.hex(id)}`;}
    effectName(id){return EFFECT_NAMES[id]?title(EFFECT_NAMES[id]):`Effect ${MemoryUtils.hex(id)}`;}

    effect(id){
      if(!Number.isInteger(id)||id<0||id>=EFFECT_NAMES.length)throw new RangeError(`Gen I effect ID must be 0–${EFFECT_NAMES.length-1}.`);
      if(id===0)return Object.freeze({id,name:EFFECT_NAMES[id],label:this.effectName(id),pointerOffset:null,address:null,offset:null});
      const pointerOffset=this.symbols.MoveEffectPointerTable.offset+(id-1)*2,address=this.memory.u16(pointerOffset);
      return Object.freeze({id,name:EFFECT_NAMES[id],label:this.effectName(id),pointerOffset,address,offset:this.memory.banked(this.symbols.MoveEffectPointerTable.bank,address)});
    }

    animation(id){
      this.assertId(id);
      const pointerOffset=this.symbols.AttackAnimationPointers.offset+(id-1)*2,address=this.memory.u16(pointerOffset);
      return Object.freeze({id,pointerOffset,address,offset:this.memory.banked(this.symbols.AttackAnimationPointers.bank,address)});
    }

    sound(id){
      this.assertId(id);
      const offset=this.symbols.MoveSoundTable.offset+(id-1)*3;
      this.memory.assertRange(offset,3);
      return Object.freeze({offset,sfxId:this.memory.u8(offset),pitch:this.memory.u8(offset+1),tempo:this.memory.u8(offset+2)});
    }

    machines(){
      if(this._machines)return this._machines;
      const offset=this.symbols.TechnicalMachines.offset;
      this.memory.assertRange(offset,55);
      this._machines=Object.freeze(Array.from({length:55},(_,index)=>Object.freeze({
        index:index+1,kind:index<50?"TM":"HM",number:index<50?index+1:index-49,
        label:`${index<50?"TM":"HM"}${String(index<50?index+1:index-49).padStart(2,"0")}`,
        offset:offset+index,moveId:this.memory.u8(offset+index)
      })));
      return this._machines;
    }

    machinesForMove(id){this.assertId(id);return Object.freeze(this.machines().filter(machine=>machine.moveId===id));}

    invalidate(){this._moves=null;this._machines=null;return this;}

    encode(move,values={}){
      const integer=(name,fallback,min=0,max=255)=>{
        const value=values[name]===undefined?fallback:Number(values[name]);
        if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`${name} must be an integer from ${min} to ${max}.`);
        return value;
      };
      return Uint8Array.of(
        integer("animation",move.animation),
        integer("effect",move.effect),
        integer("power",move.power),
        integer("type",move.type),
        integer("accuracy",move.accuracy),
        integer("pp",move.pp,1,40)
      );
    }
  }

  class Gen1ProgressionData{
    static INTERNAL_COUNT=190;
    static MAX_RECORD_BYTES=512;

    constructor(reader,{speciesData=null,moveData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gen1SpeciesData||new root.gen1.Gen1SpeciesData(reader);
      this.species=this.speciesData.catalog;
      this.moves=moveData||reader.gen1MoveData||new Gen1MoveData(reader);
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["EvosMovesPointerTable","HealEffect_"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Gen I source manifest is missing ${name}.`);
      }
      this.bank=this.symbols.EvosMovesPointerTable.bank;
      if(!Number.isInteger(this.bank))throw new Error("EvosMovesPointerTable must carry its RGBDS bank.");
      this._documents=new Map();this.patcher=new RelocatablePatch(this.memory);
      global.ProjectValidator?.registerDomain(reader,"gen1-progression",()=>this.validate());
    }

    pointer(internalId){
      if(!Number.isInteger(internalId)||internalId<1||internalId>this.constructor.INTERNAL_COUNT)throw new RangeError("Gen I internal species ID must be 1–190.");
      const pointerOffset=this.symbols.EvosMovesPointerTable.offset+(internalId-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const address=this.memory.u16(pointerOffset),offset=this.memory.banked(this.bank,address);
      return Object.freeze({pointerOffset,address,offset});
    }

    end(internalId){
      const start=this.pointer(internalId).offset,candidates=[this.symbols.HealEffect_.offset,(this.bank+1)*GbcMemory.BANK_SIZE].filter(offset=>offset>start);
      for(let id=1;id<=this.constructor.INTERNAL_COUNT;id++){
        const offset=this.pointer(id).offset;if(offset>start)candidates.push(offset);
      }
      return Math.min(...candidates);
    }

    document(internalId){
      if(this._documents.has(internalId))return this._documents.get(internalId);
      const species=this.species.get(internalId);
      if(!species)throw new RangeError("Gen I internal species ID must be 1–190.");
      const pointer=this.pointer(internalId),extentEnd=this.end(internalId);
      if(extentEnd<=pointer.offset)throw new Error(`${species.name} has a non-positive evolution/learnset extent.`);
      const end=Math.min(extentEnd,pointer.offset+this.constructor.MAX_RECORD_BYTES);
      let cursor=pointer.offset;const evolutions=[],learnset=[];
      while(cursor<end){
        const method=this.memory.u8(cursor);
        if(method===0){cursor++;break;}
        const name=METHODS[method];
        if(!name)throw new Error(`${species.name} has unknown evolution method ${method}.`);
        if(method===2){
          this.memory.assertRange(cursor,4);
          const item=this.memory.u8(cursor+1),minimumLevel=this.memory.u8(cursor+2),targetId=this.memory.u8(cursor+3),target=this.species.get(targetId);
          if(!target)throw new Error(`${species.name} has invalid evolution target ${targetId}.`);
          evolutions.push(Object.freeze({index:evolutions.length,offset:cursor,length:4,method,name,item,itemName:STONES[item]||`Item #${item}`,minimumLevel,targetId,target}));
          cursor+=4;
        }else{
          this.memory.assertRange(cursor,3);
          const minimumLevel=this.memory.u8(cursor+1),targetId=this.memory.u8(cursor+2),target=this.species.get(targetId);
          if(!target)throw new Error(`${species.name} has invalid evolution target ${targetId}.`);
          evolutions.push(Object.freeze({index:evolutions.length,offset:cursor,length:3,method,name,minimumLevel,targetId,target}));
          cursor+=3;
        }
      }
      while(cursor<end){
        const level=this.memory.u8(cursor);
        if(level===0){cursor++;break;}
        this.memory.assertRange(cursor,2);
        const moveId=this.memory.u8(cursor+1),move=this.moves.get(moveId);
        if(level>100)throw new Error(`${species.name} learns ${move.name} at invalid level ${level}.`);
        learnset.push(Object.freeze({index:learnset.length,offset:cursor,length:2,level,moveId,move}));
        cursor+=2;
      }
      let writableEnd=cursor;
      while(writableEnd<end&&writableEnd-pointer.offset<this.constructor.MAX_RECORD_BYTES&&this.memory.u8(writableEnd)===0xff)writableEnd++;
      const value=Object.freeze({
        internalId,species,pointerOffset:pointer.pointerOffset,offset:pointer.offset,end:cursor,extentEnd,
        length:cursor-pointer.offset,writableLength:writableEnd-pointer.offset,
        evolutions:Object.freeze(evolutions),learnset:Object.freeze(learnset)
      });
      this._documents.set(internalId,value);return value;
    }

    canonicalDocuments(){
      return Object.freeze(this.speciesData.catalog.list().filter(species=>species.dexNumber).map(species=>this.document(species.internalId)));
    }
    validate(){this.invalidate();this.canonicalDocuments();return[];}

    invalidate(){this._documents.clear();this.moves.invalidate();return this;}

    byte(value,label,{min=0,max=255}={}){
      const number=Number(value);
      if(!Number.isInteger(number)||number<min||number>max)throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
      return number;
    }

    encodeEvolution(value={}){
      const method=typeof value.method==="string"
        ?Object.entries(METHODS).find(([,name])=>name===value.method.toLowerCase())?.[0]
        :value.method;
      const id=this.byte(Number(method),"Evolution method",{min:1,max:3});
      const targetId=this.byte(value.targetId??value.target,"Evolution target",{min:1,max:this.constructor.INTERNAL_COUNT});
      if(!this.species.get(targetId))throw new RangeError(`Evolution target ${targetId} is not a valid internal Species ID.`);
      if(id===2)return Uint8Array.of(
        id,this.byte(value.item,"Evolution item",{min:1}),
        this.byte(value.minimumLevel??value.level??1,"Item evolution minimum level",{min:1,max:100}),targetId
      );
      return Uint8Array.of(id,this.byte(value.minimumLevel??value.level??1,id===1?"Evolution level":"Trade minimum level",{min:1,max:100}),targetId);
    }

    encodeProgression({evolutions=[],learnset=[]}={}){
      if(!Array.isArray(evolutions)||!Array.isArray(learnset))throw new TypeError("Gen I evolutions and learnset must be arrays.");
      const evolutionBytes=evolutions.map(value=>this.encodeEvolution(value));
      const learnBytes=learnset.map(value=>Uint8Array.of(
        this.byte(value.level,"Learnset level",{min:1,max:100}),
        this.byte(value.moveId??value.move,"Learnset move",{min:1,max:Gen1MoveData.COUNT})
      ));
      const length=evolutionBytes.reduce((sum,value)=>sum+value.length,0)+1+learnBytes.length*2+1;
      if(length>this.constructor.MAX_RECORD_BYTES)throw new RangeError("Gen I progression record exceeds its 512-byte safety limit.");
      const result=new Uint8Array(length);let cursor=0;
      for(const bytes of evolutionBytes){result.set(bytes,cursor);cursor+=bytes.length;}
      result[cursor++]=0;
      for(const bytes of learnBytes){result.set(bytes,cursor);cursor+=bytes.length;}
      result[cursor]=0;return result;
    }

    owners(offset){
      const result=[];
      for(let id=1;id<=this.constructor.INTERNAL_COUNT;id++)if(this.pointer(id).offset===offset)result.push(id);
      return Object.freeze(result);
    }

    progressionPlan(internalId,values){
      const current=this.document(internalId),nextBytes=this.encodeProgression(values),owners=this.owners(current.offset);
      let patch;
      try{
        patch=this.patcher.plan({
          offset:current.offset,previousLength:owners.length>1?0:current.writableLength,nextBytes,
          reference:{kind:"gbc16",pointerOffset:current.pointerOffset,bank:this.bank}
        });
      }catch(error){
        if(error instanceof RangeError&&/free-space region/.test(error.message)){
          throw new RangeError(`Red/Blue's progression bank has no verified ${nextBytes.length}-byte free region. Keep the compiled record within its ${current.writableLength}-byte budget or use a future linker/rebuild workflow.`);
        }
        throw error;
      }
      return Object.freeze({kind:"progression",internalId,current,nextBytes,owners,shared:owners.length>1,patch});
    }

    apply(plan){const target=this.patcher.apply(plan.patch);this.invalidate();return target;}
    restore(plan){const target=this.patcher.restore(plan.patch);this.invalidate();return target;}

    resourceGraph(baseGraph=this.speciesData.resourceGraph()){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder().addGraph(baseGraph);
      const source={repository:this.reader.capabilities?.provenance?.repository||"pret/pokered",manifest:this.reader.capabilities?.provenance?.id||null};
      const id=(type,key)=>resources.ResourceId.create("gen1",type,key);
      for(const move of this.moves.list()){
        builder.addNode({
          id:id("move",String(move.id)),label:move.name,accuracy:"verified",provenance:source,
          ranges:[{offset:move.offset,length:Gen1MoveData.RECORD_SIZE},{offset:move.nameOffset,length:Gen1MoveData.NAME_SIZE}],
          data:{moveId:move.id,power:move.power,type:move.type,accuracy:move.accuracy,pp:move.pp,effect:move.effect,animation:move.animation}
        });
      }
      for(let effectId=0;effectId<EFFECT_NAMES.length;effectId++){
        const effect=this.moves.effect(effectId);
        builder.addNode({id:id("move-effect",String(effectId)),label:effect.label,accuracy:"verified",provenance:source,
          ranges:effect.pointerOffset==null?[]:[{offset:effect.pointerOffset,length:2}],data:{effectId,name:effect.name,handlerOffset:effect.offset}});
      }
      for(let moveId=1;moveId<=Gen1MoveData.COUNT;moveId++){
        const move=this.moves.get(moveId),moveIdResource=id("move",String(moveId));
        const animation=move.animationDocument,sound=move.sound;
        builder.addNode({id:id("move-animation",String(move.animation)),label:`${move.name} animation`,accuracy:"verified",provenance:source,
          ranges:[{offset:animation.pointerOffset,length:2}],data:{animationId:move.animation,scriptOffset:animation.offset}});
        builder.addNode({id:id("move-sound",String(moveId)),label:`${move.name} sound`,accuracy:"verified",provenance:source,
          ranges:[{offset:sound.offset,length:3}],data:{moveId,sfxId:sound.sfxId,pitch:sound.pitch,tempo:sound.tempo}});
        builder.addEdge({id:`${moveIdResource}/effect`,source:moveIdResource,target:id("move-effect",String(move.effect)),field:"effect",
          range:{offset:move.offset+1,length:1},kind:"id",confidence:"verified",provenance:source,rewritePolicy:"rewrite-id"});
        builder.addEdge({id:`${moveIdResource}/animation`,source:moveIdResource,target:id("move-animation",String(move.animation)),field:"animation",
          range:{offset:move.offset,length:1},kind:"id",confidence:"verified",provenance:source,rewritePolicy:"rewrite-id"});
        builder.addEdge({id:`${moveIdResource}/sound`,source:moveIdResource,target:id("move-sound",String(moveId)),field:"sound",
          kind:"derived",confidence:"verified",provenance:source,rewritePolicy:"immutable"});
      }
      for(const machine of this.moves.machines()){
        const machineId=id("machine",machine.label.toLowerCase());
        builder.addNode({id:machineId,label:machine.label,accuracy:"verified",provenance:source,ranges:[{offset:machine.offset,length:1}],
          data:{kind:machine.kind,number:machine.number,moveId:machine.moveId}});
        builder.addEdge({id:`${machineId}/move`,source:machineId,target:id("move",String(machine.moveId)),field:"move",
          range:{offset:machine.offset,length:1},kind:"id",confidence:"verified",provenance:source,rewritePolicy:"rewrite-id"});
      }
      for(const document of this.canonicalDocuments()){
        const dex=String(document.species.dexNumber),speciesId=id("species",dex),base=this.speciesData.baseStats(document.species);
        for(const machineIndex of this.speciesData.machineIndexes(base)){
          const machine=this.moves.machines()[machineIndex-1],bit=machineIndex-1;
          builder.addEdge({
            id:`${speciesId}/machine-${machine.label.toLowerCase()}`,source:speciesId,target:id("machine",machine.label.toLowerCase()),
            field:`tmHm[${machineIndex-1}]`,range:{offset:base.offset+20+(bit>>3),length:1},kind:"id",
            confidence:"verified",provenance:source,rewritePolicy:"rewrite-id",data:{bit:bit&7,machineIndex}
          });
        }
      }
      for(const document of this.canonicalDocuments()){
        const dex=String(document.species.dexNumber),speciesId=id("species",dex);
        const evolutionId=id("evolution-set",dex),learnsetId=id("learnset",dex);
        builder.addNode({id:evolutionId,label:`${document.species.name} evolutions`,accuracy:"verified",provenance:source,ranges:[{offset:document.pointerOffset,length:2},{offset:document.offset,length:document.length}],data:{internalId:document.internalId,count:document.evolutions.length}});
        builder.addNode({id:learnsetId,label:`${document.species.name} level-up learnset`,accuracy:"verified",provenance:source,ranges:[{offset:document.pointerOffset,length:2},{offset:document.offset,length:document.length}],data:{internalId:document.internalId,count:document.learnset.length}});
        builder.addEdge({id:`${speciesId}/evolutions`,source:speciesId,target:evolutionId,field:"evolutions",kind:"contains",confidence:"verified",provenance:source,rewritePolicy:"repoint"});
        builder.addEdge({id:`${speciesId}/learnset`,source:speciesId,target:learnsetId,field:"learnset",kind:"contains",confidence:"verified",provenance:source,rewritePolicy:"repoint"});
        document.evolutions.forEach((evolution,index)=>{
          const target=evolution.target.dexNumber?id("species",String(evolution.target.dexNumber)):null;
          builder.addEdge({
            id:`${evolutionId}/target-${index+1}`,source:evolutionId,target,field:`evolutions[${index}].target`,
            range:{offset:evolution.offset+evolution.length-1,length:1},kind:"id",confidence:"verified",provenance:source,rewritePolicy:"rewrite-id",
            unresolved:target?null:`Evolution target ${evolution.targetId} is a MissingNo. slot`,
            data:{method:evolution.name,minimumLevel:evolution.minimumLevel,item:evolution.item??null}
          });
        });
        document.learnset.forEach((entry,index)=>builder.addEdge({
          id:`${learnsetId}/move-${index+1}`,source:learnsetId,target:id("move",String(entry.moveId)),field:`learnset[${index}].move`,
          range:{offset:entry.offset+1,length:1},kind:"id",confidence:"verified",provenance:source,rewritePolicy:"rewrite-id",
          data:{level:entry.level}
        }));
      }
      return builder.build();
    }
  }

  root.gen1=Object.freeze({...root.gen1,Gen1MoveData,Gen1ProgressionData,METHODS,STONES,TYPES,EFFECT_NAMES});
})(globalThis);
