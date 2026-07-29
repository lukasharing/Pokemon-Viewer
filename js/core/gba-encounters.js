(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const METHODS=Object.freeze([
    Object.freeze({id:"grass",label:"Grass",pointer:4,count:12,weights:[20,20,10,10,10,10,5,5,4,4,1,1]}),
    Object.freeze({id:"water",label:"Surfing",pointer:8,count:5,weights:[60,30,5,4,1]}),
    Object.freeze({id:"rock",label:"Rock Smash",pointer:12,count:5,weights:[60,30,5,4,1]}),
    Object.freeze({id:"fishing",label:"Fishing",pointer:16,count:10,weights:[70,30,60,20,20,40,40,15,4,1]})
  ]);
  class GbaEncounterData{
    constructor(reader,{speciesData}={}){
      this.reader=reader;this.memory=reader.memory;
      this.species=speciesData||reader.gbaSpeciesData;
      if(!this.species)this.species=reader.gbaSpeciesData=new root.gba.GbaSpeciesData(reader);
      this.profile=this.species.profile;
      if(reader.type!=="emerald"||!Number.isInteger(this.profile.wildMonHeaders))throw new Error("Exact GBA encounters are currently verified for Emerald only.");
    }
    list(){
      if(this.documents)return this.documents;
      const documents=[],base=this.profile.wildMonHeaders;
      for(let header=0;header<256;header++){
        const offset=base+header*20,group=this.memory.u8(offset),map=this.memory.u8(offset+1);
        if(group===0xff&&map===0xff)break;
        if(this.memory.u8(offset+2)!==0||this.memory.u8(offset+3)!==0)throw new Error(`Invalid gWildMonHeaders alignment at ${MemoryUtils.hex(offset,6)}.`);
        for(const method of METHODS){
          const infoOffset=this.memory.pointer(offset+method.pointer);if(infoOffset===null)continue;
          const rate=this.memory.u8(infoOffset),slotsOffset=this.memory.pointer(infoOffset+4);
          if(slotsOffset===null)throw new Error(`Invalid ${method.label} slot pointer at ${MemoryUtils.hex(infoOffset+4,6)}.`);
          const slots=method.weights.map((weight,index)=>{
            const slotOffset=slotsOffset+index*4,minLevel=this.memory.u8(slotOffset),maxLevel=this.memory.u8(slotOffset+1),species=this.memory.u16(slotOffset+2);
            this.species.assertId(species);
            if(minLevel<1||maxLevel<minLevel||maxLevel>100)throw new Error(`Invalid Emerald encounter level at ${MemoryUtils.hex(slotOffset,6)}.`);
            return Object.freeze({slot:index,time:"all",offset:slotOffset,species,speciesName:this.species.name(species),level:minLevel,maxLevel,probability:weight,probabilityWeight:weight});
          });
          documents.push(Object.freeze({
            id:`gba:${group}:${map}:${method.id}`,label:`${group}:${map} · ${method.label}`,group,map,method:method.id,methodLabel:method.label,
            offset:infoOffset,headerOffset:offset,slotsOffset,rates:Object.freeze([{time:"all",native:rate,offset:infoOffset}]),slots:Object.freeze(slots)
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
      const slot=document.slots.find(item=>item.slot===Number(values.slot));if(!slot)throw new RangeError("Unknown Emerald encounter slot.");
      const species=Number(values.species),level=Number(values.level),maxLevel=Number(values.maxLevel??level),rate=Number(values.rate);
      this.species.assertId(species);
      if(!Number.isInteger(level)||!Number.isInteger(maxLevel)||level<1||maxLevel<level||maxLevel>100)throw new RangeError("Encounter levels must be within 1–100.");
      if(!Number.isInteger(rate)||rate<1||rate>255)throw new RangeError("Encounter rate must be within 1–255.");
      return Object.freeze({writes:Object.freeze([
        Object.freeze({offset:slot.offset,before:MemoryUtils.bytes(this.memory,slot.offset,4),after:Uint8Array.of(level,maxLevel,species&255,species>>>8)}),
        Object.freeze({offset:document.offset,before:MemoryUtils.bytes(this.memory,document.offset,1),after:Uint8Array.of(rate)})
      ])});
    }
  }
  // GBA domain modules publish an immutable namespace. Rebuild it instead of
  // assigning into the frozen object left by gba-species.js.
  root.gba=Object.freeze({...root.gba,GbaEncounterData});
})(globalThis);
