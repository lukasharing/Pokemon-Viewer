(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});

  class Gen1EncounterData{
    static MAP_COUNT=0xf8;
    static SLOT_COUNT=10;
    static SLOT_WEIGHTS=Object.freeze([51,51,39,25,25,25,13,13,11,3]);

    constructor(reader,{speciesData=null}={}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=speciesData||reader.gen1SpeciesData||new root.gen1.Gen1SpeciesData(reader);
      this.species=this.speciesData.catalog;
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      this.pointers=this.symbol("WildDataPointers");
      this.chances=this.symbol("WildMonEncounterSlotChances");
      for(const name of ["ItemUseOldRod","GoodRodMons","SuperRodData","Route12DefaultScript","Route16DefaultScript"])this.symbol(name);
      if(!Number.isInteger(this.pointers.bank))throw new Error("WildDataPointers must carry its RGBDS bank.");
      this.verifyProbabilities();this.cache=null;
      global.ProjectValidator?.registerDomain(reader,"gen1-encounters",()=>this.validate());
    }

    symbol(name){
      const symbol=this.symbols[name];
      if(!symbol||!Number.isInteger(symbol.offset))throw new Error(`Gen I encounter symbol ${name} is unavailable.`);
      return symbol;
    }

    verifyProbabilities(){
      let previous=-1,total=0;
      for(let slot=0;slot<Gen1EncounterData.SLOT_COUNT;slot++){
        const threshold=this.memory.u8(this.chances.offset+slot*2),byteOffset=this.memory.u8(this.chances.offset+slot*2+1);
        const weight=threshold-previous;previous=threshold;total+=weight;
        if(weight!==Gen1EncounterData.SLOT_WEIGHTS[slot]||byteOffset!==slot*2)throw new Error("WildMonEncounterSlotChances does not match the verified Gen I layout.");
      }
      if(previous!==255||total!==256)throw new Error("Gen I encounter slot weights do not total 256.");
    }

    record(mapId){
      if(!Number.isInteger(mapId)||mapId<0||mapId>=Gen1EncounterData.MAP_COUNT)throw new RangeError("Gen I map id must be $00–$F7.");
      const pointerOffset=this.pointers.offset+mapId*2,address=this.memory.u16(pointerOffset);
      return Object.freeze({mapId,pointerOffset,address,offset:this.memory.banked(this.pointers.bank,address)});
    }

    list(){
      if(this.cache)return this.cache;
      const documents=[];
      for(let mapId=0;mapId<Gen1EncounterData.MAP_COUNT;mapId++){
        const record=this.record(mapId);let cursor=record.offset;
        const grassRate=this.memory.u8(cursor++),grassOffset=cursor-1;
        if(grassRate)documents.push(this.readDocument(record,"grass",grassOffset,grassRate,cursor));
        if(grassRate)cursor+=Gen1EncounterData.SLOT_COUNT*2;
        const waterRate=this.memory.u8(cursor++),waterOffset=cursor-1;
        if(waterRate)documents.push(this.readDocument(record,"water",waterOffset,waterRate,cursor));
        if(waterRate)cursor+=Gen1EncounterData.SLOT_COUNT*2;
        if(cursor-record.offset>42)throw new Error(`Gen I wild record for map $${mapId.toString(16)} exceeds its native maximum.`);
      }
      documents.push(...this.readFishing(),...this.readStatics());
      this.cache=Object.freeze(documents);return this.cache;
    }

    slot({slot,levelOffset,speciesOffset,probabilityWeight=null,probability=null}){
      const level=this.memory.u8(levelOffset),species=this.memory.u8(speciesOffset),identity=this.species.get(species);
      if(!identity||level<1||level>100)throw new Error(`Gen I encounter slot at 0x${Math.min(levelOffset,speciesOffset).toString(16)} is invalid.`);
      return Object.freeze({
        time:"all",slot,offset:Math.min(levelOffset,speciesOffset),levelOffset,speciesOffset,level,species,
        speciesName:identity.name,probability,probabilityWeight,
        ranges:Object.freeze([{offset:levelOffset,length:1},{offset:speciesOffset,length:1}])
      });
    }

    readFishing(){
      const documents=[],old=this.symbol("ItemUseOldRod"),oldCommand=old.offset+6;
      if(this.memory.u8(oldCommand)!==0x01)throw new Error("ItemUseOldRod does not match the verified ld bc payload.");
      documents.push(Object.freeze({
        id:"fishing-old",table:"ItemUseOldRod",method:"fishing",rod:"old",rodLabel:"Old Rod",
        offset:oldCommand,size:3,rates:Object.freeze([{time:"all",native:null,editable:false,label:"Guaranteed bite on a valid fishing tile"}]),
        slots:Object.freeze([this.slot({slot:0,speciesOffset:oldCommand+1,levelOffset:oldCommand+2,probability:100})]),
        label:"Fishing · Old Rod · Global"
      }));
      const good=this.symbol("GoodRodMons"),goodSlots=Array.from({length:2},(_,slot)=>this.slot({
        slot,levelOffset:good.offset+slot*2,speciesOffset:good.offset+slot*2+1,probability:50
      }));
      documents.push(Object.freeze({
        id:"fishing-good",table:"GoodRodMons",method:"fishing",rod:"good",rodLabel:"Good Rod",
        offset:good.offset,size:4,rates:Object.freeze([{time:"all",native:null,editable:false,label:"50% bite; two equally likely species conditional on a bite"}]),
        slots:Object.freeze(goodSlots),label:"Fishing · Good Rod · Global"
      }));
      const superRoot=this.symbol("SuperRodData");let cursor=superRoot.offset,index=0;
      while(this.memory.u8(cursor)!==0xff){
        const entryOffset=cursor,mapId=this.memory.u8(cursor++),address=this.memory.u16(cursor),groupOffset=this.memory.banked(superRoot.bank,address);cursor+=2;
        const count=this.memory.u8(groupOffset);
        if(count<1||count>4)throw new Error(`SuperRodData map $${mapId.toString(16)} has invalid group size ${count}.`);
        const slots=Array.from({length:count},(_,slot)=>this.slot({
          slot,levelOffset:groupOffset+1+slot*2,speciesOffset:groupOffset+2+slot*2,probability:100/count
        }));
        documents.push(Object.freeze({
          id:`fishing-super-${mapId}`,table:"SuperRodData",method:"fishing",rod:"super",rodLabel:"Super Rod",mapId,
          tableIndex:index++,headerOffset:entryOffset,groupOffset,offset:groupOffset,size:1+count*2,
          rates:Object.freeze([{time:"all",native:null,editable:false,label:`50% bite; ${count} equally likely species conditional on a bite`}]),
          slots:Object.freeze(slots),label:`Map $${mapId.toString(16).toUpperCase().padStart(2,"0")} · Super Rod`
        }));
      }
      if(index!==33)throw new Error(`SuperRodData contains ${index} map entries instead of 33.`);
      return documents;
    }

    mapHeader(mapId){
      const pointers=this.symbol("MapHeaderPointers"),banks=this.symbol("MapHeaderBanks"),bank=this.memory.u8(banks.offset+mapId);
      const address=this.memory.u16(pointers.offset+mapId*2);
      if(bank<1||address<0x4000||address>0x7fff)return null;
      try{return GbcMapHeader.read(this.memory,this.memory.banked(bank,address),bank);}catch{return null;}
    }

    readStatics(){
      const documents=[];
      for(let mapId=0;mapId<Gen1EncounterData.MAP_COUNT;mapId++){
        const header=this.mapHeader(mapId);if(!header)continue;
        let events;try{events=GbcMapObjectBlock.read(this.memory,header.objects);}catch{continue;}
        events.objects.forEach((event,eventIndex)=>{
          if(event.eventType!=="Trainer"||!this.species.get(event.trainerClass)||event.trainerNumber<1||event.trainerNumber>100)return;
          const slot=this.slot({slot:0,speciesOffset:event.offset+6,levelOffset:event.offset+7,probability:100});
          documents.push(Object.freeze({
            id:`static-map-${mapId}-${eventIndex}`,table:"map object_event",method:"static",mapId,eventIndex,
            offset:event.offset,size:event.size,scriptOffset:header.script,context:"Typed wild object event",
            rates:Object.freeze([{time:"all",native:null,editable:false,label:"Triggered by map object/script flow"}]),
            slots:Object.freeze([slot]),label:`Map $${mapId.toString(16).toUpperCase().padStart(2,"0")} · Static ${slot.speciesName} Lv${slot.level}`
          }));
        });
      }
      for(const definition of [
        {id:"route-12-snorlax",symbol:"Route12DefaultScript",mapId:23,context:"Poké Flute event"},
        {id:"route-16-snorlax",symbol:"Route16DefaultScript",mapId:27,context:"Poké Flute event"}
      ]){
        const script=this.symbol(definition.symbol),command=script.offset+22;
        if(this.memory.u8(command)!==0x3e||this.memory.u8(command+2)!==0xea||this.memory.u8(command+5)!==0x3e||this.memory.u8(command+7)!==0xea)throw new Error(`${definition.symbol} does not match the verified static-battle payload.`);
        const slot=this.slot({slot:0,speciesOffset:command+1,levelOffset:command+6,probability:100});
        documents.push(Object.freeze({
          id:`static-${definition.id}`,table:definition.symbol,method:"static",mapId:definition.mapId,
          offset:command,size:9,scriptOffset:script.offset,context:definition.context,
          rates:Object.freeze([{time:"all",native:null,editable:false,label:"Triggered by map script flow"}]),
          slots:Object.freeze([slot]),label:`Map $${definition.mapId.toString(16).toUpperCase().padStart(2,"0")} · Static ${slot.speciesName} Lv${slot.level}`
        }));
      }
      return documents;
    }

    readDocument(record,method,offset,rate,slotsOffset){
      const slots=Array.from({length:Gen1EncounterData.SLOT_COUNT},(_,slot)=>{
        const levelOffset=slotsOffset+slot*2,speciesOffset=levelOffset+1,level=this.memory.u8(levelOffset),species=this.memory.u8(speciesOffset);
        const identity=this.species.get(species);
        if(!identity||level<1||level>100)throw new Error(`Gen I ${method} slot ${slot} for map $${record.mapId.toString(16)} is invalid.`);
        return Object.freeze({
          time:"all",slot,offset:levelOffset,levelOffset,speciesOffset,level,species,
          speciesName:identity.name,probability:Gen1EncounterData.SLOT_WEIGHTS[slot]/256*100,
          probabilityWeight:Gen1EncounterData.SLOT_WEIGHTS[slot]
        });
      });
      return Object.freeze({
        id:`map-${record.mapId}-${method}`,table:"WildDataPointers",method,mapId:record.mapId,
        pointerOffset:record.pointerOffset,recordOffset:record.offset,offset,size:21,
        rates:Object.freeze([{time:"all",native:rate,offset}]),slots:Object.freeze(slots),
        label:`Map $${record.mapId.toString(16).toUpperCase().padStart(2,"0")} · ${method==="grass"?"Grass":"Water"}`
      });
    }

    find(reference){
      if(!reference)return null;
      if(typeof reference==="string")return this.list().find(document=>document.id===reference)||null;
      if(reference.id)return this.find(reference.id);
      const mapId=Number(reference.mapId??reference.map),method=reference.method;
      return this.list().find(document=>document.mapId===mapId&&(!method||document.method===method))||null;
    }

    owners(document){
      if(document.method==="static")return Object.freeze([{mapId:document.mapId,id:`$${document.mapId.toString(16).toUpperCase().padStart(2,"0")}`}]);
      if(document.method==="fishing"){
        if(document.rod!=="super")return Object.freeze([]);
        return Object.freeze(this.list().filter(item=>item.method==="fishing"&&item.rod==="super"&&item.groupOffset===document.groupOffset)
          .map(item=>Object.freeze({mapId:item.mapId,id:`$${item.mapId.toString(16).toUpperCase().padStart(2,"0")}`})));
      }
      return Object.freeze(Array.from({length:Gen1EncounterData.MAP_COUNT},(_,mapId)=>this.record(mapId))
        .filter(record=>record.offset===document.recordOffset)
        .map(record=>Object.freeze({mapId:record.mapId,id:`$${record.mapId.toString(16).toUpperCase().padStart(2,"0")}`})));
    }

    editPlan(reference,{slot=0,level,species,rate}={}){
      const document=this.find(reference);
      if(!document)throw new Error("Gen I encounter document was not found.");
      const selected=document.slots[Number(slot)],nextLevel=Number(level),nextSpecies=Number(species),nextRate=Number(rate);
      if(!selected)throw new RangeError("Gen I encounter slot is out of range.");
      if(!Number.isInteger(nextLevel)||nextLevel<1||nextLevel>100)throw new RangeError("Encounter level must be 1–100.");
      if(!this.species.get(nextSpecies))throw new RangeError("Encounter species must be a valid Gen I internal species id.");
      const writes=[];
      if(document.rates[0].editable!==false){
        if(!Number.isInteger(nextRate)||nextRate<1||nextRate>255)throw new RangeError("Encounter rate must be 1–255.");
        writes.push(Object.freeze({offset:document.offset,before:Uint8Array.of(document.rates[0].native),after:Uint8Array.of(nextRate)}));
      }
      writes.push(
        Object.freeze({offset:selected.levelOffset,before:Uint8Array.of(selected.level),after:Uint8Array.of(nextLevel)}),
        Object.freeze({offset:selected.speciesOffset,before:Uint8Array.of(selected.species),after:Uint8Array.of(nextSpecies)})
      );
      return Object.freeze({document,writes:Object.freeze(writes)});
    }

    validate(){this.invalidate();this.list();return[];}
    invalidate(){this.cache=null;}

    resourceGraph(baseGraph=this.speciesData.resourceGraph()){
      const builder=new root.resources.ResourceGraphBuilder().addGraph(baseGraph),maps=new Set();
      for(const document of this.list()){
        const documentId=`gen1:encounter-table:${document.id}`;
        const ranges=[{offset:document.offset,length:document.size}];
        if(Number.isInteger(document.pointerOffset))ranges.push({offset:document.pointerOffset,length:2});
        if(Number.isInteger(document.headerOffset))ranges.push({offset:document.headerOffset,length:3});
        builder.addNode({id:documentId,type:"encounter-table",label:document.label,accuracy:"verified",ranges});
        for(const owner of this.owners(document)){
          const mapId=`gen1:map:${owner.mapId}`;
          if(!maps.has(mapId)){maps.add(mapId);builder.addNode({id:mapId,type:"map",label:`Map ${owner.id}`,accuracy:"verified"});}
          const range=document.method==="grass"||document.method==="water"?{offset:this.pointers.offset+owner.mapId*2,length:2}:Number.isInteger(document.headerOffset)?{offset:document.headerOffset,length:3}:null;
          builder.addEdge({id:`${documentId}/map-${owner.mapId}`,source:documentId,target:mapId,kind:range?"pointer":"id",confidence:"verified",rewritePolicy:"immutable",range});
        }
        document.slots.forEach(slot=>{
          const slotId=`gen1:encounter-slot:${document.id}-${slot.slot}`;
          const identity=this.species.get(slot.species),target=identity?.dexNumber?`gen1:species:${identity.dexNumber}`:null;
          const chance=Number.isInteger(slot.probabilityWeight)?`${slot.probabilityWeight}/256`:`${slot.probability}%`;
          builder.addNode({id:slotId,type:"encounter-slot",label:`${chance} · ${slot.speciesName} Lv${slot.level}`,accuracy:"verified",ranges:slot.ranges||[{offset:slot.offset,length:2}]});
          builder.addEdge({id:`${documentId}/slot-${slot.slot}`,source:documentId,target:slotId,kind:"contains",confidence:"verified",rewritePolicy:"in-place"});
          builder.addEdge({id:`${slotId}/species`,source:slotId,target,kind:"id",confidence:"verified",rewritePolicy:"rewrite-id",range:{offset:slot.speciesOffset,length:1},unresolved:target?null:`Internal species ${slot.species} is a MissingNo. slot`});
        });
      }
      return builder.build();
    }
  }

  root.gen1=Object.freeze({...root.gen1,Gen1EncounterData});
})(globalThis);
