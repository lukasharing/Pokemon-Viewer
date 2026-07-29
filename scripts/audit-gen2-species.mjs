import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";

if(process.argv.length!==4){
  console.error("Usage: node scripts/audit-gen2-species.mjs <crystal.gbc> <generated-manifest.json>");
  process.exit(1);
}

await import("../js/structures/memory.js");
await import("../js/core/memory-utils.js");
await import("../js/core/gsc-lz.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gen2/memory.js");
await import("../js/structures/gen2/connection-utils.js");
await import("../js/structures/gen2/map.js");
await import("../js/core/species-catalog.js");
await import("../js/core/resource-graph.js");
await import("../js/core/rom-allocator.js");
await import("../js/core/relocatable-patch.js");
await import("../js/core/gen2-species.js");
await import("../js/core/gen2-progression.js");
await import("../js/core/gen2-trainers.js");
await import("../js/core/gen2-encounters.js");

const [romPath,manifestPath]=process.argv.slice(2).map(value=>resolve(value));
const [buffer,manifestText,dictionaryText]=await Promise.all([
  readFile(romPath),readFile(manifestPath,"utf8"),readFile(resolve("decrypt/text_table_gen2_en.json"),"utf8")
]);
const manifest=JSON.parse(manifestText),fingerprint=createHash("sha1").update(buffer).digest("hex");
if(fingerprint!==manifest.fingerprint)throw new Error(`ROM SHA-1 ${fingerprint} does not match manifest ${manifest.fingerprint}.`);
if(manifest.profile!=="gen2-crystal-en")throw new Error(`Manifest '${manifest.profile}' is not the exact Crystal profile.`);

const dictionary=[];for(const [key,value] of Object.entries(JSON.parse(dictionaryText)))dictionary[Number.parseInt(key,16)]=value;
const bytes=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
const reader={
  memory:new Gen2Memory(bytes),size:bytes.length,textDictionary:"gen2",
  capabilities:{provenance:{symbols:manifest.symbols,repository:manifest.source.repository,id:manifest.profile}},
  getDictionary:()=>dictionary,isROMOffset:offset=>Number.isInteger(offset)&&offset>=0&&offset<bytes.length,
  getTextByOffset:(_dictionary,offset,length=256)=>{
    let text="";for(let index=0;index<length&&offset+index<bytes.length;index++)text+=dictionary[bytes[offset+index]]??"";
    return text;
  }
};
const data=new PokemonViewer.gen2.Gen2SpeciesData(reader),progression=new PokemonViewer.gen2.Gen2ProgressionData(reader,{speciesData:data}),documents=[];
let decodedPictureBytes=0,compressedPictureBytes=0,evolutionCount=0,learnsetCount=0,eggMoveCount=0,compatibilityCount=0;
for(let id=1;id<=251;id++){
  const document=data.document(id);
  if(!document.name||!document.category||!document.description)throw new Error(`Crystal Pokédex #${id} is incomplete.`);
  if(document.base.dexNumber!==id)throw new Error(`Crystal BaseData #${id} carries dex number ${document.base.dexNumber}.`);
  const picture=data.frontSprite(id),palette=data.palette(id);
  const growth=progression.document(id);
  evolutionCount+=growth.evolutions.length;learnsetCount+=growth.learnset.length;eggMoveCount+=growth.eggMoves.length;
  compatibilityCount+=data.machineIndexes(document.base).length;
  if(palette.colors.length!==4)throw new Error(`Crystal species #${id} has no complete normal palette.`);
  decodedPictureBytes+=picture.bytes.length;compressedPictureBytes+=picture.consumed;
  documents.push(document);
}
const first=documents[0],measurementBefore=MemoryUtils.bytes(reader.memory,first.measurementOffset,4);
const measurementAfter=PokemonViewer.gen2.Gen2SpeciesData.encodeMeasurements({height:first.height^1,weight:first.weight});
MemoryUtils.replace(reader.memory,first.measurementOffset,measurementBefore,measurementAfter);
MemoryUtils.replace(reader.memory,first.measurementOffset,measurementAfter,measurementBefore);
if(!MemoryUtils.equals(reader.memory,first.measurementOffset,measurementBefore))throw new Error("Crystal Pokédex measurement audit did not restore exact bytes.");
const basePlan=data.baseEditPlan(1,{hp:first.base.hp===255?254:first.base.hp+1});
MemoryUtils.replace(reader.memory,basePlan.offset,basePlan.before,basePlan.after);
MemoryUtils.replace(reader.memory,basePlan.offset,basePlan.after,basePlan.before);
if(!MemoryUtils.equals(reader.memory,basePlan.offset,basePlan.before))throw new Error("Crystal BaseData audit did not restore exact bytes.");
const machines=progression.moves.machines();
if(machines.length!==60||machines[49].label!=="TM50"||machines[50].label!=="HM01"||machines[57].moveId!==53||machines[58].moveId!==85||machines[59].moveId!==58)throw new Error("Crystal TM/HM/tutor order does not match TMHMMoves.");
const machineOffset=first.base.offset+24,machineBefore=MemoryUtils.bytes(reader.memory,machineOffset,8),selected=data.machineIndexes(first.base);
const machineAfter=data.encodeMachines(first.base,selected.includes(1)?selected.filter(index=>index!==1):[...selected,1]);
if((machineAfter[7]&0xf0)!==(machineBefore[7]&0xf0))throw new Error("Crystal compatibility writer changed unused BaseData bits.");
MemoryUtils.replace(reader.memory,machineOffset,machineBefore,machineAfter);
MemoryUtils.replace(reader.memory,machineOffset,machineAfter,machineBefore);
if(!MemoryUtils.equals(reader.memory,machineOffset,machineBefore))throw new Error("Crystal compatibility audit did not restore exact bytes.");
const cryPlan=data.cryEditPlan(1,{baseCry:first.cry.baseCry^1,pitch:first.cry.pitch,length:first.cry.length});
MemoryUtils.replace(reader.memory,cryPlan.offset,cryPlan.before,cryPlan.after);
MemoryUtils.replace(reader.memory,cryPlan.offset,cryPlan.after,cryPlan.before);
if(!MemoryUtils.equals(reader.memory,cryPlan.offset,cryPlan.before))throw new Error("Crystal PokemonCries audit did not restore exact bytes.");
const bulbasaur=progression.document(1),progressionPointerBefore=reader.memory.slice(bulbasaur.pointerOffset,2),progressionBytesBefore=reader.memory.slice(bulbasaur.offset,bulbasaur.length);
const progressionPlan=progression.progressionPlan(1,{evolutions:bulbasaur.evolutions,learnset:[...bulbasaur.learnset,{level:100,moveId:1}]});
progression.apply(progressionPlan);progression.restore(progressionPlan);
if(!MemoryUtils.equals(reader.memory,bulbasaur.pointerOffset,progressionPointerBefore)||!MemoryUtils.equals(reader.memory,bulbasaur.offset,progressionBytesBefore))throw new Error("Crystal progression relocation audit did not restore pointer and bytes.");
const sharedEgg=progression.document(2),eggPointerBefore=reader.memory.slice(sharedEgg.eggPointerOffset,2),eggBytesBefore=reader.memory.slice(sharedEgg.eggOffset,sharedEgg.eggMoves.length+1);
const eggPlan=progression.eggMovePlan(2,[1]);
if(!eggPlan.shared)throw new Error("Crystal shared NoEggMoves ownership was not detected.");
progression.apply(eggPlan);progression.restore(eggPlan);
if(!MemoryUtils.equals(reader.memory,sharedEgg.eggPointerOffset,eggPointerBefore)||!MemoryUtils.equals(reader.memory,sharedEgg.eggOffset,eggBytesBefore))throw new Error("Crystal shared egg-move relocation audit did not restore pointer and bytes.");
const move=progression.moves.get(1),moveBefore=reader.memory.slice(move.offset,PokemonViewer.gen2.Gen2MoveData.RECORD_SIZE);
const moveAfter=progression.moves.encode(move,{power:move.power===255?254:move.power+1});
MemoryUtils.replace(reader.memory,move.offset,moveBefore,moveAfter);
MemoryUtils.replace(reader.memory,move.offset,moveAfter,moveBefore);
if(!MemoryUtils.equals(reader.memory,move.offset,moveBefore))throw new Error("Crystal Move record audit did not restore exact bytes.");
const trainers=new PokemonViewer.gen2.Gen2TrainerData(reader,{speciesData:data,moveData:progression.moves}),trainerDocuments=trainers.trainers();
const trainerMembers=trainerDocuments.reduce((sum,trainer)=>sum+trainer.party.length,0);
const trainerMoves=trainerDocuments.reduce((sum,trainer)=>sum+trainer.party.reduce((partySum,member)=>partySum+member.moveIds.filter(Boolean).length,0),0);
const editableTrainer=trainerDocuments.find(trainer=>trainer.party.length),editableMember=editableTrainer.party[0];
const trainerPlan=trainers.editPlan(editableTrainer,0,{species:editableMember.species,level:editableMember.level===100?99:editableMember.level+1});
MemoryUtils.replace(reader.memory,trainerPlan.offset,trainerPlan.before,trainerPlan.after);
MemoryUtils.replace(reader.memory,trainerPlan.offset,trainerPlan.after,trainerPlan.before);
if(!MemoryUtils.equals(reader.memory,trainerPlan.offset,trainerPlan.before))throw new Error("Crystal trainer party audit did not restore exact bytes.");
const trainerGraph=trainers.resourceGraph(progression.resourceGraph());
const mapRoot=manifest.symbols.MapGroupPointers,mapDirectory=new Gen2MapDirectory(reader.memory,{tableOffset:mapRoot.offset,tableBank:mapRoot.bank});
const encounters=new PokemonViewer.gen2.Gen2EncounterData(reader,{speciesData:data,mapDirectory}),encounterDocuments=encounters.list();
const encounterSlots=encounterDocuments.reduce((sum,document)=>sum+document.slots.length,0);
const editableEncounter=encounterDocuments[0],editableSlot=editableEncounter.slots[0];
const encounterPlan=encounters.editPlan(editableEncounter,{time:editableSlot.time,slot:editableSlot.slot,rate:editableEncounter.rates[0].native,level:editableSlot.level===100?99:editableSlot.level+1,species:editableSlot.species});
for(const write of encounterPlan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
for(const write of [...encounterPlan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
for(const write of encounterPlan.writes)if(!MemoryUtils.equals(reader.memory,write.offset,write.before))throw new Error("Crystal encounter audit did not restore exact bytes.");
for(const specialId of ["headbutt-1-common","rock-smash-7","bug-catching-contest"]){
  const special=encounters.find(specialId),slot=special.slots[0],plan=encounters.editPlan(special,{slot:0,level:slot.level,maxLevel:slot.maxLevel,species:slot.species});
  for(const write of plan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  for(const write of [...plan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
  for(const write of plan.writes)if(!MemoryUtils.equals(reader.memory,write.offset,write.before))throw new Error(`Crystal ${specialId} audit did not restore exact bytes.`);
  if(!encounters.mapOwners(special).length)throw new Error(`Crystal ${specialId} has no exact map owner.`);
}
const roamers=encounters.find("roamers"),roamerSlot=roamers.slots[0];
const roamerPlan=encounters.editPlan(roamers,{slot:0,level:roamerSlot.level,species:roamerSlot.species,mapGroup:roamerSlot.mapGroup,mapNumber:roamerSlot.mapNumber});
for(const write of roamerPlan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
for(const write of [...roamerPlan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
for(const write of roamerPlan.writes)if(!MemoryUtils.equals(reader.memory,write.offset,write.before))throw new Error("Crystal roamer audit did not restore exact bytes.");
if(roamers.routes.length!==16||encounters.mapOwners(roamers).length!==16)throw new Error("Crystal roamer route network is incomplete.");
const staticEncounters=encounterDocuments.filter(document=>document.method==="static");
if(staticEncounters.length!==17)throw new Error(`Crystal direct loadwildmon inventory has ${staticEncounters.length} records instead of 17.`);
for(const encounter of staticEncounters){
  if(reader.memory.u8(encounter.offset)!==0x5d)throw new Error(`Crystal ${encounter.id} no longer points at a loadwildmon opcode.`);
  if(encounters.mapOwners(encounter).length!==1)throw new Error(`Crystal ${encounter.id} has no unique exact map owner.`);
  const slot=encounter.slots[0],plan=encounters.editPlan(encounter,{
    slot:0,
    level:slot.level===100?99:slot.level+1,
    species:slot.species===251?250:slot.species+1
  });
  for(const write of plan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  for(const write of [...plan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
  for(const write of plan.writes)if(!MemoryUtils.equals(reader.memory,write.offset,write.before))throw new Error(`Crystal ${encounter.id} audit did not restore exact bytes.`);
}
const graph=encounters.resourceGraph(trainerGraph),validation=graph.validate();
if(!validation.valid)throw new Error(`Invalid Crystal progression graph: ${JSON.stringify(validation.errors)}`);
if(evolutionCount!==122||learnsetCount!==2215||eggMoveCount!==480||compatibilityCount!==6592||trainerDocuments.length!==541||trainerMembers!==1254||trainerMoves!==1385||encounterDocuments.length!==224||encounterSlots!==2486||graph.size!==7780||graph.edgeCount!==23018){
  throw new Error(`Unexpected Crystal coverage: ${evolutionCount} evolutions / ${learnsetCount} learnset entries / ${eggMoveCount} egg moves / ${compatibilityCount} compatibility links / ${trainerDocuments.length} trainers / ${trainerMembers} party members / ${trainerMoves} explicit moves / ${encounterDocuments.length} encounters / ${encounterSlots} slots / ${graph.size} nodes / ${graph.edgeCount} edges.`);
}

console.log(`PASS ${manifest.profile} · 251 named Species · 251 BaseData records · 251 four-bank Pokédex entries/descriptions · 251 PokemonCries records · 251 LZ3 front pictures/palettes (${decodedPictureBytes} decoded / ${compressedPictureBytes} compressed bytes) · 251 moves · 60 TM/HM/tutor assignments · ${evolutionCount} evolutions · ${learnsetCount} level-up entries · ${eggMoveCount} egg-move entries · ${compatibilityCount} compatibility links · ${trainerDocuments.length} trainers / ${trainerMembers} party members / ${trainerMoves} explicit moves · ${encounterDocuments.length} grass/water/fishing/headbutt/rock/contest/roamer/static documents / ${encounterSlots} displayed slots · ${graph.size} graph nodes / ${graph.edgeCount} resolved edges`);
