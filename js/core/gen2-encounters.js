(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const ns=(root.gen2||={});

  class Gen2EncounterData{
    static GRASS_STRIDE=47;
    static WATER_STRIDE=9;
    static TIMES=Object.freeze(["morning","day","night"]);
    static GRASS_PROBABILITIES=Object.freeze([30,30,20,10,5,4,1]);
    static WATER_PROBABILITIES=Object.freeze([60,30,10]);
    static FISH_GROUPS=Object.freeze(["Shore","Ocean","Lake","Pond","Dratini","Qwilfish swarm","Remoraid swarm","Gyarados","Dratini 2","Whirl Islands","Qwilfish","Remoraid","Qwilfish no swarm"]);
    static TREE_SETS=Object.freeze(["None","Canyon","Town","Route","Kanto","Lake","Forest","Rock"]);
    static STATIC_ENCOUNTERS=Object.freeze([
      {id:"red-gyarados",symbol:"RedGyarados",relative:10,mapSymbol:"LakeOfRage_MapAttributes",context:"Forced shiny"},
      {id:"celebi",symbol:"IlexForestShrineScript.CelebiEvent",relative:45,mapSymbol:"IlexForest_MapAttributes",context:"GS Ball shrine event"},
      {id:"snorlax",symbol:"VermilionSnorlax",relative:25,mapSymbol:"VermilionCity_MapAttributes",context:"Forced held item"},
      {id:"trap-voltorb",symbol:"VoltorbExplodingTrap",relative:14,mapSymbol:"TeamRocketBaseB1F_MapAttributes",context:"Rocket trap"},
      {id:"trap-geodude",symbol:"GeodudeExplodingTrap",relative:14,mapSymbol:"TeamRocketBaseB1F_MapAttributes",context:"Rocket trap"},
      {id:"trap-koffing",symbol:"KoffingExplodingTrap",relative:14,mapSymbol:"TeamRocketBaseB1F_MapAttributes",context:"Rocket trap"},
      {id:"sudowoodo",symbol:"WateredWeirdTreeScript",relative:20,mapSymbol:"Route36_MapAttributes",context:"Squirtbottle event"},
      {id:"ho-oh",symbol:"TinTowerHoOh",relative:17,mapSymbol:"TinTowerRoof_MapAttributes",context:"Forced held item"},
      {id:"lapras",symbol:"UnionCaveLapras",relative:4,mapSymbol:"UnionCaveB2F_MapAttributes",context:"Weekly overworld event"},
      {id:"tutorial-1",symbol:"Route29Tutorial1",relative:34,mapSymbol:"Route29_MapAttributes",context:"Catch tutorial"},
      {id:"tutorial-2",symbol:"Route29Tutorial2",relative:34,mapSymbol:"Route29_MapAttributes",context:"Catch tutorial"},
      {id:"tutorial-repeat",symbol:"CatchingTutorialDudeScript",relative:28,mapSymbol:"Route29_MapAttributes",context:"Catch tutorial"},
      {id:"suicune",symbol:"TinTower1FSuicuneBattleScript",relative:90,mapSymbol:"TinTower1F_MapAttributes",context:"Suicune battle type"},
      {id:"electrode-1",symbol:"RocketElectrode1",relative:3,mapSymbol:"TeamRocketBaseB2F_MapAttributes",context:"Rocket generator"},
      {id:"electrode-2",symbol:"RocketElectrode2",relative:3,mapSymbol:"TeamRocketBaseB2F_MapAttributes",context:"Rocket generator"},
      {id:"electrode-3",symbol:"RocketElectrode3",relative:3,mapSymbol:"TeamRocketBaseB2F_MapAttributes",context:"Rocket generator"},
      {id:"lugia",symbol:"Lugia",relative:17,mapSymbol:"WhirlIslandLugiaChamber_MapAttributes",context:"Forced held item"}
    ].map(Object.freeze));
    static RODS=Object.freeze([
      Object.freeze({id:"old",label:"Old Rod",count:3,probabilities:Object.freeze([70,15,15])}),
      Object.freeze({id:"good",label:"Good Rod",count:4,probabilities:Object.freeze([35,35,20,10])}),
      Object.freeze({id:"super",label:"Super Rod",count:4,probabilities:Object.freeze([40,30,20,10])})
    ]);
    static TABLES=Object.freeze([
      Object.freeze({symbol:"JohtoGrassWildMons",region:"johto",method:"grass",stride:47}),
      Object.freeze({symbol:"JohtoWaterWildMons",region:"johto",method:"water",stride:9}),
      Object.freeze({symbol:"KantoGrassWildMons",region:"kanto",method:"grass",stride:47}),
      Object.freeze({symbol:"KantoWaterWildMons",region:"kanto",method:"water",stride:9})
    ]);

    constructor(reader,{speciesData,mapDirectory=null}={}){
      this.reader=reader;
      this.memory=reader.memory;
      this.speciesData=speciesData||reader.gen2SpeciesData;
      this.mapDirectory=mapDirectory;
      if(!this.speciesData)throw new Error("Crystal encounters require the exact Species model.");
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const table of Gen2EncounterData.TABLES)this.symbol(table.symbol);
      for(const name of ["FishGroups","TimeFishGroups","TreeMons","TreeMonMaps","RockMonMaps","ContestMons","NationalParkBugContest_MapAttributes","InitRoamMons","RoamMaps"])this.symbol(name);
      for(const entry of Gen2EncounterData.STATIC_ENCOUNTERS){this.symbol(entry.symbol);this.symbol(entry.mapSymbol);}
      this.cache=null;
      global.ProjectValidator?.registerDomain(reader,"gen2-encounters",()=>this.validate());
    }

    symbol(name){
      const symbol=this.symbols[name];
      if(!symbol||!Number.isInteger(symbol.offset))throw new Error(`Crystal encounter symbol ${name} is unavailable.`);
      return symbol;
    }

    list(){
      if(this.cache)return this.cache;
      const documents=[];
      for(const table of Gen2EncounterData.TABLES){
        let offset=this.symbol(table.symbol).offset,index=0;
        while(offset<this.memory.size&&this.memory.u8(offset)!==0xff){
          const group=this.memory.u8(offset),map=this.memory.u8(offset+1);
          if(!group||!map)throw new Error(`${table.symbol} contains an invalid map id at 0x${offset.toString(16)}.`);
          documents.push(this.readDocument(table,offset,index++));
          offset+=table.stride;
        }
        if(offset>=this.memory.size)throw new Error(`${table.symbol} has no 0xFF terminator.`);
      }
      documents.push(...this.readFishing());
      documents.push(...this.readTrees(),this.readContest(),this.readRoamers(),...this.readStaticEncounters());
      this.cache=Object.freeze(documents);
      return this.cache;
    }

    readFishing(){
      const groups=this.symbol("FishGroups"),timeGroups=this.symbol("TimeFishGroups"),documents=[];
      for(let group=1;group<=Gen2EncounterData.FISH_GROUPS.length;group++){
        const header=groups.offset+(group-1)*7,biteRate=this.memory.u8(header);
        for(let rodIndex=0;rodIndex<Gen2EncounterData.RODS.length;rodIndex++){
          const rod=Gen2EncounterData.RODS[rodIndex],address=this.memory.u16(header+1+rodIndex*2),listOffset=this.memory.banked(groups.bank,address);
          let previousThreshold=-1;
          for(let slot=0;slot<rod.count;slot++){
            const threshold=this.memory.u8(listOffset+slot*3);
            if(threshold<=previousThreshold)throw new Error(`FishGroups has non-increasing ${rod.label} thresholds at 0x${(listOffset+slot*3).toString(16)}.`);
            previousThreshold=threshold;
          }
          if(previousThreshold!==255)throw new Error(`FishGroups ${rod.label} thresholds do not terminate at 255.`);
          const slots=["day","night"].flatMap(time=>Array.from({length:rod.count},(_,slot)=>{
            const recordOffset=listOffset+slot*3,threshold=this.memory.u8(recordOffset),encodedSpecies=this.memory.u8(recordOffset+1),encodedLevel=this.memory.u8(recordOffset+2);
            let sourceOffset=recordOffset+1,speciesOffset=recordOffset+1,levelOffset=recordOffset+2,species=encodedSpecies,level=encodedLevel,timeGroup=null;
            if(encodedSpecies===0){
              timeGroup=encodedLevel;
              if(timeGroup>21)throw new Error(`FishGroups has an invalid time group ${timeGroup}.`);
              sourceOffset=timeGroups.offset+timeGroup*4+(time==="night"?2:0);
              speciesOffset=sourceOffset;levelOffset=sourceOffset+1;
              species=this.memory.u8(sourceOffset);level=this.memory.u8(sourceOffset+1);
            }
            const identity=this.speciesData.catalog.get(species);
            if(!identity||level<1||level>100)throw new Error(`FishGroups has an invalid ${rod.label} slot at 0x${recordOffset.toString(16)}.`);
            return Object.freeze({
              time,slot,offset:sourceOffset,recordOffset,levelOffset,speciesOffset,level,species,speciesName:identity.name,
              probability:rod.probabilities[slot],threshold,timeGroup,sharedAcrossTime:timeGroup===null
            });
          }));
          documents.push(Object.freeze({
            id:`fishing-${group}-${rod.id}`,table:"FishGroups",tableIndex:(group-1)*3+rodIndex,
            region:"all",method:"fishing",fishGroup:group,rod:rod.id,rodLabel:rod.label,
            offset:listOffset,size:rod.count*3,headerOffset:header,
            rates:Object.freeze(["day","night"].map(time=>Object.freeze({time,native:biteRate,offset:header}))),
            slots:Object.freeze(slots),
            label:`Fishing · ${Gen2EncounterData.FISH_GROUPS[group-1]} · ${rod.label}`
          }));
        }
      }
      return documents;
    }

    readWeightedSlots(offset,{count=null,contest=false}={}){
      const slots=[];let cursor=offset,total=0;
      while(count===null?this.memory.u8(cursor)!==0xff:slots.length<count){
        const rawProbability=this.memory.u8(cursor),probability=rawProbability===0xff?100-total:rawProbability;
        const speciesOffset=cursor+1,species=this.memory.u8(speciesOffset),identity=this.speciesData.catalog.get(species);
        const levelOffset=cursor+2,level=this.memory.u8(levelOffset),maxLevel=contest?this.memory.u8(cursor+3):level;
        if(!identity||level<1||level>100||maxLevel<level||maxLevel>100||probability<1||total+probability>100)throw new Error(`Special encounter table has an invalid slot at 0x${cursor.toString(16)}.`);
        slots.push(Object.freeze({
          time:"all",slot:slots.length,offset:speciesOffset,recordOffset:cursor,speciesOffset,levelOffset,
          maxLevelOffset:contest?cursor+3:null,species,speciesName:identity.name,level,maxLevel,probability,rawProbability
        }));
        total+=probability;cursor+=contest?4:3;
      }
      if(total!==100)throw new Error(`Special encounter probabilities at 0x${offset.toString(16)} total ${total}%, not 100%.`);
      if(count===null)cursor++;
      return Object.freeze({slots:Object.freeze(slots),size:cursor-offset});
    }

    readTrees(){
      const root=this.symbol("TreeMons"),documents=[];
      for(let treeSet=1;treeSet<=6;treeSet++){
        const pointerOffset=root.offset+treeSet*2,listOffset=this.memory.banked(root.bank,this.memory.u16(pointerOffset));
        const common=this.readWeightedSlots(listOffset),rare=this.readWeightedSlots(listOffset+common.size);
        for(const [variant,table] of [["common",common],["rare",rare]])documents.push(Object.freeze({
          id:`headbutt-${treeSet}-${variant}`,table:"TreeMons",method:"headbutt",treeSet,variant,
          offset:variant==="common"?listOffset:listOffset+common.size,size:table.size,
          rates:Object.freeze([{time:"all",native:null,editable:false,label:variant==="common"?"10%/50% by tree score":"80% on rare-score trees"}]),
          slots:table.slots,label:`Headbutt · ${Gen2EncounterData.TREE_SETS[treeSet]} · ${variant==="common"?"Common":"Rare"}`
        }));
      }
      const pointerOffset=root.offset+7*2,listOffset=this.memory.banked(root.bank,this.memory.u16(pointerOffset)),rock=this.readWeightedSlots(listOffset);
      documents.push(Object.freeze({
        id:"rock-smash-7",table:"TreeMons",method:"rock",treeSet:7,variant:"rock",
        offset:listOffset,size:rock.size,rates:Object.freeze([{time:"all",native:null,editable:false,label:"40% before weighted selection"}]),
        slots:rock.slots,label:"Rock encounter · Rock"
      }));
      return documents;
    }

    readContest(){
      const root=this.symbol("ContestMons"),table=this.readWeightedSlots(root.offset,{count:10,contest:true});
      return Object.freeze({
        id:"bug-catching-contest",table:"ContestMons",method:"contest",offset:root.offset,size:table.size,
        rates:Object.freeze([{time:"all",native:null,editable:false,label:"20% or 40% by grass tile before modifiers"}]),
        slots:table.slots,label:"Bug-Catching Contest · National Park"
      });
    }

    readRoamers(){
      const init=this.symbol("InitRoamMons"),routesRoot=this.symbol("RoamMaps");
      const signature={0:0x3e,2:0xea,5:0x3e,7:0xea,10:0x3e,12:0xea,15:0xea,18:0x3e,20:0xea,23:0x3e,25:0xea,28:0x3e,30:0xea,33:0x3e,35:0xea,38:0xaf,39:0xea,42:0xea,45:0xc9};
      for(const [relative,expected] of Object.entries(signature))if(this.memory.u8(init.offset+Number(relative))!==expected)throw new Error("InitRoamMons does not match the verified Crystal Rev 0 instruction layout.");
      const routes=[];let cursor=routesRoot.offset;
      for(let index=0;index<16;index++){
        const offset=cursor,group=this.memory.u8(cursor++),map=this.memory.u8(cursor++),count=this.memory.u8(cursor++);
        if(!group||!map||count<1||count>5)throw new Error(`RoamMaps has an invalid route at 0x${offset.toString(16)}.`);
        const destinations=Array.from({length:count},()=>Object.freeze({group:this.memory.u8(cursor++),map:this.memory.u8(cursor++)}));
        if(this.memory.u8(cursor++)!==0)throw new Error(`RoamMaps route at 0x${offset.toString(16)} has no terminator.`);
        routes.push(Object.freeze({index,offset,group,map,count,destinations:Object.freeze(destinations)}));
      }
      if(this.memory.u8(cursor)!==0xff)throw new Error("RoamMaps does not contain exactly 16 terminated routes.");
      const makeSlot=(slot,{speciesOffset,mapGroupOffset,mapNumberOffset})=>{
        const species=this.memory.u8(init.offset+speciesOffset),identity=this.speciesData.catalog.get(species),level=this.memory.u8(init.offset+11);
        const mapGroup=this.memory.u8(init.offset+mapGroupOffset),mapNumber=this.memory.u8(init.offset+mapNumberOffset);
        let validMap=true;
        if(this.mapDirectory){try{this.mapDirectory.entry(mapGroup,mapNumber);}catch{validMap=false;}}
        if(!identity||level<1||level>100||!validMap)throw new Error(`InitRoamMons slot ${slot+1} is invalid.`);
        return Object.freeze({
          time:"all",slot,offset:init.offset+speciesOffset,recordOffset:init.offset,
          speciesOffset:init.offset+speciesOffset,levelOffset:init.offset+11,mapGroupOffset:init.offset+mapGroupOffset,mapNumberOffset:init.offset+mapNumberOffset,
          species,speciesName:identity.name,level,maxLevel:level,mapGroup,mapNumber,probability:null,sharedLevel:true,
          ranges:Object.freeze([
            {offset:init.offset+speciesOffset,length:1},{offset:init.offset+11,length:1},
            {offset:init.offset+mapGroupOffset,length:1},{offset:init.offset+mapNumberOffset,length:1}
          ])
        });
      };
      return Object.freeze({
        id:"roamers",table:"InitRoamMons",method:"roamer",offset:init.offset,size:46,routesOffset:routesRoot.offset,routesSize:cursor+1-routesRoot.offset,
        rates:Object.freeze([{time:"all",native:null,editable:false,label:"Engine selection: up to 75/256 before active-slot and map checks"}]),
        slots:Object.freeze([
          makeSlot(0,{speciesOffset:1,mapGroupOffset:19,mapNumberOffset:24}),
          makeSlot(1,{speciesOffset:6,mapGroupOffset:29,mapNumberOffset:34})
        ]),
        routes:Object.freeze(routes),label:"Roaming Pokémon · Raikou / Entei"
      });
    }

    readStaticEncounters(){
      return Gen2EncounterData.STATIC_ENCOUNTERS.map(definition=>{
        const script=this.symbol(definition.symbol),commandOffset=script.offset+definition.relative;
        if(this.memory.u8(commandOffset)!==0x5d)throw new Error(`${definition.symbol} does not contain loadwildmon at the verified offset.`);
        const speciesOffset=commandOffset+1,levelOffset=commandOffset+2,species=this.memory.u8(speciesOffset),level=this.memory.u8(levelOffset),identity=this.speciesData.catalog.get(species);
        if(!identity||level<1||level>100)throw new Error(`${definition.symbol} has an invalid loadwildmon payload.`);
        return Object.freeze({
          id:`static-${definition.id}`,table:"loadwildmon",method:"static",offset:commandOffset,size:3,
          scriptOffset:script.offset,scriptSymbol:definition.symbol,mapAttributesOffset:this.symbol(definition.mapSymbol).offset,
          context:definition.context,rates:Object.freeze([{time:"all",native:null,editable:false,label:"Triggered by event-script flow"}]),
          slots:Object.freeze([Object.freeze({
            time:"all",slot:0,offset:speciesOffset,recordOffset:commandOffset,speciesOffset,levelOffset,
            species,speciesName:identity.name,level,maxLevel:level,probability:null
          })]),
          label:`Static · ${identity.name} Lv${level} · ${definition.context}`
        });
      });
    }

    readDocument(table,offset,index){
      const group=this.memory.u8(offset),map=this.memory.u8(offset+1);
      const rates=table.method==="grass"
        ?Object.freeze(Gen2EncounterData.TIMES.map((time,timeIndex)=>Object.freeze({time,native:this.memory.u8(offset+2+timeIndex)})))
        :Object.freeze([{time:"all",native:this.memory.u8(offset+2)}]);
      const periods=table.method==="grass"?Gen2EncounterData.TIMES:["all"];
      const count=table.method==="grass"?7:3;
      const probabilities=table.method==="grass"?Gen2EncounterData.GRASS_PROBABILITIES:Gen2EncounterData.WATER_PROBABILITIES;
      const base=offset+(table.method==="grass"?5:3);
      const slots=periods.flatMap((time,timeIndex)=>Array.from({length:count},(_,slot)=>{
        const slotOffset=base+(timeIndex*count+slot)*2;
        const level=this.memory.u8(slotOffset),species=this.memory.u8(slotOffset+1),identity=this.speciesData.catalog.get(species);
        if(level<1||level>100||!identity)throw new Error(`${table.symbol} has an invalid encounter slot at 0x${slotOffset.toString(16)}.`);
        return Object.freeze({time,slot,offset:slotOffset,levelOffset:slotOffset,speciesOffset:slotOffset+1,level,species,speciesName:identity.name,probability:probabilities[slot]});
      }));
      return Object.freeze({
        id:`${table.region}-${table.method}-${group}-${map}`,
        table:table.symbol,tableIndex:index,region:table.region,method:table.method,
        group,map,offset,size:table.stride,rates,slots:Object.freeze(slots),
        label:`${table.region==="johto"?"Johto":"Kanto"} · Group ${group} / Map ${map} · ${table.method==="grass"?"Grass":"Water"}`
      });
    }

    find(reference){
      if(!reference)return null;
      if(typeof reference==="string")return this.list().find(item=>item.id===reference)||null;
      if(reference.id)return this.list().find(item=>item.id===reference.id)||null;
      if(reference.fishGroup&&reference.rod)return this.list().find(item=>item.fishGroup===Number(reference.fishGroup)&&item.rod===reference.rod)||null;
      if(reference.treeSet&&reference.variant)return this.list().find(item=>item.treeSet===Number(reference.treeSet)&&item.variant===reference.variant)||null;
      const group=Number(reference.group??reference.mapGroup),map=Number(reference.map??reference.mapId),method=reference.method;
      return this.list().find(item=>item.group===group&&item.map===map&&(!method||item.method===method))||null;
    }

    editPlan(reference,{time="all",slot=0,level,maxLevel=level,species,rate,mapGroup,mapNumber}={}){
      const document=this.find(reference);
      if(!document)throw new Error("Crystal encounter document was not found.");
      const selected=document.slots.find(item=>item.time===time&&item.slot===Number(slot));
      if(!selected)throw new Error("That encounter time/slot does not exist.");
      const nextLevel=Number(level),nextSpecies=Number(species),nextMaxLevel=Number(maxLevel);
      if(!Number.isInteger(nextLevel)||nextLevel<1||nextLevel>100)throw new RangeError("Encounter level must be 1–100.");
      if(!Number.isInteger(nextMaxLevel)||nextMaxLevel<nextLevel||nextMaxLevel>100)throw new RangeError("Encounter maximum level must be between the minimum and 100.");
      if(!Number.isInteger(nextSpecies)||!this.speciesData.catalog.get(nextSpecies))throw new RangeError("Encounter species must be a valid Crystal Species ID.");
      if(document.method==="roamer"){
        const nextGroup=Number(mapGroup),nextMap=Number(mapNumber);
        try{if(!this.mapDirectory)throw new Error();this.mapDirectory.entry(nextGroup,nextMap);}catch{throw new RangeError("Roamer starting map must be a valid Crystal map.");}
        return Object.freeze({
          document,slot:selected,writes:Object.freeze([
            Object.freeze({offset:selected.speciesOffset,before:Uint8Array.of(selected.species),after:Uint8Array.of(nextSpecies)}),
            Object.freeze({offset:selected.levelOffset,before:Uint8Array.of(selected.level),after:Uint8Array.of(nextLevel)}),
            Object.freeze({offset:selected.mapGroupOffset,before:Uint8Array.of(selected.mapGroup),after:Uint8Array.of(nextGroup)}),
            Object.freeze({offset:selected.mapNumberOffset,before:Uint8Array.of(selected.mapNumber),after:Uint8Array.of(nextMap)})
          ])
        });
      }
      const rateRecord=document.rates.find(item=>item.time===time)||(time==="all"?document.rates[0]:null);
      if(!rateRecord)throw new Error("That encounter rate period does not exist.");
      const writes=[];
      if(rateRecord.editable!==false){
        const nextRate=Number(rate);
        if(!Number.isInteger(nextRate)||nextRate<0||nextRate>255)throw new RangeError("Native encounter rate must be 0–255.");
        writes.push(Object.freeze({offset:rateRecord.offset??document.offset+2+document.rates.indexOf(rateRecord),before:Uint8Array.of(rateRecord.native),after:Uint8Array.of(nextRate)}));
      }
      writes.push(
        Object.freeze({offset:selected.levelOffset,before:Uint8Array.of(selected.level),after:Uint8Array.of(nextLevel)}),
        Object.freeze({offset:selected.speciesOffset,before:Uint8Array.of(selected.species),after:Uint8Array.of(nextSpecies)})
      );
      if(Number.isInteger(selected.maxLevelOffset))writes.push(Object.freeze({offset:selected.maxLevelOffset,before:Uint8Array.of(selected.maxLevel),after:Uint8Array.of(nextMaxLevel)}));
      return Object.freeze({
        document,slot:selected,
        writes:Object.freeze(writes)
      });
    }

    validate(){this.invalidate();this.list();return[];}
    invalidate(){this.cache=null;}

    mapOwners(document){
      if(Number.isInteger(document.group)&&Number.isInteger(document.map))return Object.freeze([{group:document.group,map:document.map,id:`${document.group}:${document.map}`}]);
      if(!this.mapDirectory)return Object.freeze([]);
      if(document.method==="fishing")return Object.freeze(this.mapDirectory.list().filter(owner=>this.mapDirectory.entry(owner.group,owner.map).fishingGroup===document.fishGroup));
      if(document.method==="headbutt"||document.method==="rock"){
        const symbol=this.symbol(document.method==="rock"?"RockMonMaps":"TreeMonMaps"),owners=[];let offset=symbol.offset;
        while(this.memory.u8(offset)!==0xff){
          const group=this.memory.u8(offset),map=this.memory.u8(offset+1),treeSet=this.memory.u8(offset+2);
          if(treeSet===document.treeSet)owners.push({group,map,id:`${group}:${map}`});
          offset+=3;
        }
        return Object.freeze(owners);
      }
      if(document.method==="contest"){
        const attributesOffset=this.symbol("NationalParkBugContest_MapAttributes").offset;
        const owner=this.mapDirectory.list().find(item=>this.mapDirectory.entry(item.group,item.map).attributesOffset===attributesOffset);
        return Object.freeze(owner?[owner]:[]);
      }
      if(document.method==="roamer")return Object.freeze(document.routes.map(route=>({group:route.group,map:route.map,id:`${route.group}:${route.map}`})));
      if(document.method==="static"){
        const owner=this.mapDirectory.list().find(item=>this.mapDirectory.entry(item.group,item.map).attributesOffset===document.mapAttributesOffset);
        return Object.freeze(owner?[owner]:[]);
      }
      return Object.freeze([]);
    }

    resourceGraph(baseGraph=this.speciesData.resourceGraph()){
      const builder=new PokemonViewer.resources.ResourceGraphBuilder()
        .addGraph(baseGraph)
        .fillGraph(this.speciesData.resourceGraph());
      const maps=new Set();
      for(const document of this.list()){
        const encounterId=`gen2:encounter-table:${document.id}`;
        const documentRanges=[{offset:document.offset,length:document.size}];
        if(document.method==="roamer")documentRanges.push({offset:document.routesOffset,length:document.routesSize});
        builder.addNode({id:encounterId,type:"encounter-table",label:document.label,accuracy:"verified",ranges:documentRanges});
        for(const owner of this.mapOwners(document)){
          const mapId=`gen2:map:${owner.group}-${owner.map}`;
          if(!maps.has(mapId)){maps.add(mapId);builder.addNode({id:mapId,type:"map",label:`Map ${owner.group}:${owner.map}`,accuracy:"verified"});}
          builder.addEdge({id:`${encounterId}/map-${owner.group}-${owner.map}`,source:encounterId,target:mapId,kind:"id",confidence:"verified",rewritePolicy:"immutable"});
        }
        document.slots.forEach((slot,index)=>{
          const slotId=`gen2:encounter-slot:${document.id}-${index}`;
          builder.addNode({id:slotId,type:"encounter-slot",label:`${slot.time} ${slot.probability===null?"roamer":`${slot.probability}%`} · ${slot.speciesName} Lv${slot.level}${slot.maxLevel!==slot.level?`–${slot.maxLevel}`:""}`,accuracy:"verified",ranges:slot.ranges||[{offset:slot.offset,length:Number.isInteger(slot.maxLevelOffset)?3:2}]});
          builder.addEdge({id:`${encounterId}/slot-${index}`,source:encounterId,target:slotId,kind:"contains",confidence:"verified",rewritePolicy:"in-place"});
          builder.addEdge({id:`${slotId}/species`,source:slotId,target:`gen2:species:${slot.species}`,kind:"id",confidence:"verified",rewritePolicy:"rewrite-id",range:{offset:slot.speciesOffset,length:1}});
        });
      }
      return builder.build();
    }
  }

  root.gen2=Object.freeze({...ns,Gen2EncounterData});
})(globalThis);
