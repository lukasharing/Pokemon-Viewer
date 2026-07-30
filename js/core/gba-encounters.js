(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const LABELS=Object.freeze({emerald:"Emerald",fire_red:"FireRed"});
  const requireField=(structure,name,type)=>{
    const field=structure?.fields?.[name];
    if(!field||!Number.isInteger(field.byte)||field.byte<0||field.type!==type||field.byte>=structure.size){
      throw new Error(`Generation III encounter structure '${name}' is not a valid ${type} field.`);
    }
    return field;
  };
  class GbaEncounterContract{
    static resolve(reader){
      const profile=reader?.memoryProfile;
      const header=profile?.structure?.("WildPokemonHeader");
      const info=profile?.structure?.("WildPokemonInfo");
      const slot=profile?.structure?.("WildPokemon");
      const methodSet=profile?.structure?.("WildEncounterMethods");
      if(!header||!info||!slot||!methodSet)return null;
      for(const structure of [header,info,slot]){
        if(!Number.isInteger(structure.size)||structure.size<1)throw new Error("Generation III encounter structure size is invalid.");
      }
      const headerFields=Object.freeze({
        group:requireField(header,"mapGroup","u8"),map:requireField(header,"mapNum","u8")
      });
      const infoFields=Object.freeze({
        rate:requireField(info,"encounterRate","u8"),slots:requireField(info,"wildPokemon","gba32")
      });
      const slotFields=Object.freeze({
        min:requireField(slot,"minLevel","u8"),max:requireField(slot,"maxLevel","u8"),
        species:requireField(slot,"species","u16")
      });
      if(!Number.isInteger(methodSet.maximumHeaders)||methodSet.maximumHeaders<1||methodSet.maximumHeaders>0x10000){
        throw new Error("Generation III encounter header limit is invalid.");
      }
      const methods=Object.freeze(methodSet.methods.map(method=>{
        const pointer=requireField(header,method.field,"gba32").byte;
        if(!Number.isInteger(method.count)||method.count<1||!Array.isArray(method.weights)||method.weights.length!==method.count){
          throw new Error(`Generation III encounter method '${method.id}' has invalid native weights.`);
        }
        return Object.freeze({...method,pointer,weights:Object.freeze([...method.weights])});
      }));
      return Object.freeze({
        id:`${profile.knowledgeId||"gen3"}-wild-encounters`,
        label:LABELS[reader?.type]||profile.knowledgeId||"Generation III",
        source:profile.knowledge?.evidence||"reviewed Generation III engine knowledge",
        headerSize:header.size,infoSize:info.size,slotSize:slot.size,
        headerFields,infoFields,slotFields,
        padding:Object.freeze([...(header.padding||[])]),
        terminator:Object.freeze({...header.terminator}),
        maximumHeaders:methodSet.maximumHeaders,methods
      });
    }
  }
  class GbaEncounterData{
    constructor(reader,{speciesData}={}){
      this.reader=reader;this.memory=reader.memory;
      this.species=speciesData||reader.gbaSpeciesData;
      if(!this.species)this.species=reader.gbaSpeciesData=new root.gba.GbaSpeciesData(reader);
      this.profile=this.species.profile;
      this.contract=GbaEncounterContract.resolve(reader);
      if(!this.contract)throw new Error("No exact Generation III encounter contract is available for this ROM revision.");
      if(!Number.isInteger(this.profile.wildMonHeaders))throw new Error(`${this.contract.label} has no verified gWildMonHeaders root.`);
    }
    list(){
      if(this.documents)return this.documents;
      const documents=[],base=this.profile.wildMonHeaders;
      const {headerFields,infoFields,slotFields}=this.contract;
      for(let header=0;header<this.contract.maximumHeaders;header++){
        const offset=base+header*this.contract.headerSize;
        const group=this.memory.u8(offset+headerFields.group.byte),map=this.memory.u8(offset+headerFields.map.byte);
        if(group===this.contract.terminator.mapGroup&&map===this.contract.terminator.mapNum)break;
        for(const padding of this.contract.padding){
          for(let index=0;index<padding.length;index++)if(this.memory.u8(offset+padding.byte+index)!==padding.value){
            throw new Error(`Invalid gWildMonHeaders alignment at ${MemoryUtils.hex(offset,6)}.`);
          }
        }
        for(const method of this.contract.methods){
          const infoOffset=this.memory.pointer(offset+method.pointer);if(infoOffset===null)continue;
          const rate=this.memory.u8(infoOffset+infoFields.rate.byte),slotsOffset=this.memory.pointer(infoOffset+infoFields.slots.byte);
          if(slotsOffset===null)throw new Error(`Invalid ${method.label} slot pointer at ${MemoryUtils.hex(infoOffset+infoFields.slots.byte,6)}.`);
          const slots=method.weights.map((weight,index)=>{
            const slotOffset=slotsOffset+index*this.contract.slotSize;
            const minLevel=this.memory.u8(slotOffset+slotFields.min.byte),maxLevel=this.memory.u8(slotOffset+slotFields.max.byte),species=this.memory.u16(slotOffset+slotFields.species.byte);
            this.species.assertId(species);
            if(minLevel<1||maxLevel<minLevel||maxLevel>100)throw new Error(`Invalid ${this.contract.label} encounter level at ${MemoryUtils.hex(slotOffset,6)}.`);
            return Object.freeze({slot:index,time:"all",offset:slotOffset,species,speciesName:this.species.name(species),level:minLevel,maxLevel,probability:weight,probabilityWeight:weight});
          });
          documents.push(Object.freeze({
            id:`gba:${group}:${map}:${method.id}`,label:`${group}:${map} · ${method.label}`,group,map,method:method.id,methodLabel:method.label,
            offset:infoOffset,headerOffset:offset,slotsOffset,
            rates:Object.freeze([{time:"all",native:rate,offset:infoOffset+infoFields.rate.byte}]),slots:Object.freeze(slots)
          }));
        }
      }
      if(!documents.length)throw new Error("gWildMonHeaders contains no valid encounter documents.");
      return this.documents=Object.freeze(documents);
    }
    find(reference){
      const id=typeof reference==="string"?reference:reference?.id;
      return this.list().find(document=>document.id===id)||null;
    }
    invalidate(){this.documents=null;}
    editPlan(document,values){
      const slot=document.slots.find(item=>item.slot===Number(values.slot));if(!slot)throw new RangeError(`Unknown ${this.contract.label} encounter slot.`);
      const species=Number(values.species),level=Number(values.level),maxLevel=Number(values.maxLevel??level),rate=Number(values.rate);
      this.species.assertId(species);
      if(!Number.isInteger(level)||!Number.isInteger(maxLevel)||level<1||maxLevel<level||maxLevel>100)throw new RangeError("Encounter levels must be within 1–100.");
      if(!Number.isInteger(rate)||rate<1||rate>255)throw new RangeError("Encounter rate must be within 1–255.");
      const after=MemoryUtils.bytes(this.memory,slot.offset,this.contract.slotSize);
      after[this.contract.slotFields.min.byte]=level;
      after[this.contract.slotFields.max.byte]=maxLevel;
      after[this.contract.slotFields.species.byte]=species&255;
      after[this.contract.slotFields.species.byte+1]=species>>>8;
      return Object.freeze({writes:Object.freeze([
        Object.freeze({offset:slot.offset,before:MemoryUtils.bytes(this.memory,slot.offset,this.contract.slotSize),after}),
        Object.freeze({offset:document.rates[0].offset,before:MemoryUtils.bytes(this.memory,document.rates[0].offset,1),after:Uint8Array.of(rate)})
      ])});
    }
  }
  // GBA domain modules publish an immutable namespace. Rebuild it instead of
  // assigning into the frozen object left by gba-species.js.
  root.gba=Object.freeze({...root.gba,GbaEncounterContract,GbaEncounterData});
})(globalThis);
