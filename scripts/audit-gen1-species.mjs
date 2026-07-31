import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";

if(process.argv.length!==4){
  console.error("Usage: node scripts/audit-gen1-species.mjs <red-or-blue.gb> <generated-manifest.json>");
  process.exit(1);
}

await import("../js/structures/memory.js");
await import("../js/structures/memory-reader.js");
await import("../js/core/utils.js");
await import("../js/core/memory-utils.js");
await import("../js/core/rom-allocator.js");
await import("../js/core/relocatable-patch.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/text.js");
await import("../js/structures/gbc/map.js");
await import("../js/core/species-catalog.js");
await import("../js/core/resource-graph.js");
await import("../js/core/manual-knowledge-registry.js");
await import("../js/core/gen1-species.js");
await import("../js/core/gen1-moves.js");
await import("../js/core/gen1-trainers.js");
await import("../js/core/gen1-encounters.js");

const [romPath,manifestPath]=process.argv.slice(2).map(value=>resolve(value));
const [buffer,manifestText]=await Promise.all([readFile(romPath),readFile(manifestPath,"utf8")]);
const manifest=JSON.parse(manifestText),fingerprint=createHash("sha1").update(buffer).digest("hex");
if(fingerprint!==manifest.fingerprint)throw new Error(`ROM SHA-1 ${fingerprint} does not match manifest ${manifest.fingerprint}.`);
if(!manifest.profile.startsWith("gen1-"))throw new Error(`Manifest '${manifest.profile}' is not a Gen I profile.`);

const bytes=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
const knowledge=ManualKnowledgeRegistry.get(manifest.knowledge.id);
if(!knowledge)throw new Error(`Manual knowledge '${manifest.knowledge.id}' is not bundled.`);
const reader={
  memory:new GbcMemory(bytes),
  capabilities:{provenance:{symbols:manifest.symbols}},
  memoryProfile:{structure:name=>knowledge.structures?.[name]||null},
  textDictionary:"gen1",
  getDictionary:()=>({}),
  isROMOffset:offset=>Number.isInteger(offset)&&offset>=0&&offset<bytes.length,
  // This audit validates structure/pointer/compression coverage without
  // emitting copyrighted strings. Browser text rendering has separate codecs.
  getTextByOffset:()=>""
};
const data=new PokemonViewer.gen1.Gen1SpeciesData(reader);
const baseSpecies=data.speciesByDex(1),baseRecord=data.baseStats(baseSpecies);
const basePlan=data.baseEditPlan(baseSpecies,{
  hp:baseRecord.hp===255?254:baseRecord.hp+1,
  attack:baseRecord.attack,defense:baseRecord.defense,speed:baseRecord.speed,special:baseRecord.special,
  type1:baseRecord.type1,type2:baseRecord.type2,catchRate:baseRecord.catchRate,baseExperience:baseRecord.baseExperience,
  move1:baseRecord.startingMoves[0],move2:baseRecord.startingMoves[1],move3:baseRecord.startingMoves[2],move4:baseRecord.startingMoves[3],
  growthRate:baseRecord.growthRate
});
for(const index of [0,10,11,12,13,14,20,21,22,23,24,25,26,27]){
  if(basePlan.after[index]!==basePlan.before[index])throw new Error(`Base Stats writer changed protected byte ${index}.`);
}
MemoryUtils.replace(reader.memory,basePlan.offset,basePlan.before,basePlan.after);
if(data.baseStats(baseSpecies).hp!==basePlan.after[1])throw new Error("Base Stats writer did not update HP.");
MemoryUtils.replace(reader.memory,basePlan.offset,basePlan.after,basePlan.before);
if(!MemoryUtils.equals(reader.memory,basePlan.offset,basePlan.before))throw new Error("Base Stats audit did not restore exact bytes.");
const crySpecies=data.speciesByDex(1),cryPlan=data.cryEditPlan(crySpecies,{
  baseCry:data.cry(crySpecies).baseCry^1,
  pitch:data.cry(crySpecies).pitch,
  length:data.cry(crySpecies).length
});
MemoryUtils.replace(reader.memory,cryPlan.offset,cryPlan.before,cryPlan.after);
if(data.cry(crySpecies).baseCry!==cryPlan.after[0])throw new Error("CryData writer did not update the selected byte.");
MemoryUtils.replace(reader.memory,cryPlan.offset,cryPlan.after,cryPlan.before);
if(!MemoryUtils.equals(reader.memory,cryPlan.offset,cryPlan.before))throw new Error("CryData audit did not restore exact bytes.");
const progression=new PokemonViewer.gen1.Gen1ProgressionData(reader,{speciesData:data});
const progressionSpecies=data.speciesByDex(1),progressionDocument=progression.document(progressionSpecies.internalId);
const progressionPointerBefore=MemoryUtils.bytes(reader.memory,progressionDocument.pointerOffset,2);
const progressionRecordBefore=MemoryUtils.bytes(reader.memory,progressionDocument.offset,progressionDocument.length);
const auditedLearnset=progressionDocument.learnset.map(item=>({level:item.level,moveId:item.moveId}));
if(!auditedLearnset.length)throw new Error("Gen I progression audit species has no learnset entry.");
auditedLearnset[0]={...auditedLearnset[0],moveId:auditedLearnset[0].moveId===1?2:1};
const progressionPlan=progression.progressionPlan(progressionDocument.internalId,{
  evolutions:progressionDocument.evolutions.map(item=>({
    method:item.name,minimumLevel:item.minimumLevel,item:item.item,targetId:item.targetId
  })),
  learnset:auditedLearnset
});
progression.apply(progressionPlan);
if(progression.document(progressionDocument.internalId).learnset[0]?.moveId!==auditedLearnset[0].moveId)throw new Error("Gen I progression writer did not expose the edited move.");
progression.restore(progressionPlan);
if(!MemoryUtils.equals(reader.memory,progressionDocument.pointerOffset,progressionPointerBefore)||!MemoryUtils.equals(reader.memory,progressionDocument.offset,progressionRecordBefore)){
  throw new Error("Gen I progression relocation audit did not restore pointer and record bytes.");
}
let progressionGrowthRejected=false;
try{
  progression.progressionPlan(progressionDocument.internalId,{
    evolutions:progressionDocument.evolutions.map(item=>({method:item.name,minimumLevel:item.minimumLevel,item:item.item,targetId:item.targetId})),
    learnset:[...progressionDocument.learnset.map(item=>({level:item.level,moveId:item.moveId})),{level:100,moveId:1}]
  });
}catch(error){
  if(error instanceof RangeError&&/future linker\/rebuild workflow/.test(error.message))progressionGrowthRejected=true;
  else throw error;
}
if(!progressionGrowthRejected)throw new Error("Stock Gen I progression growth unexpectedly found an unverified free-space allocation.");
const compatibilitySpecies=data.speciesByDex(1),compatibilityBase=data.baseStats(compatibilitySpecies);
const compatibilityOffset=compatibilityBase.offset+20,compatibilityBefore=MemoryUtils.bytes(reader.memory,compatibilityOffset,7);
const compatibilityIndexes=new Set(data.machineIndexes(compatibilityBase)),compatibilityWasSet=compatibilityIndexes.has(55);
if(compatibilityWasSet)compatibilityIndexes.delete(55);else compatibilityIndexes.add(55);
const compatibilityAfter=data.encodeMachines(compatibilityBase,compatibilityIndexes);
if((compatibilityAfter[6]&0x80)!==(compatibilityBefore[6]&0x80))throw new Error("TM/HM writer changed the unused bit 56.");
MemoryUtils.replace(reader.memory,compatibilityOffset,compatibilityBefore,compatibilityAfter);
if(data.machineCompatible(data.baseStats(compatibilitySpecies),55)===compatibilityWasSet)throw new Error("TM/HM writer did not change the selected compatibility bit.");
MemoryUtils.replace(reader.memory,compatibilityOffset,compatibilityAfter,compatibilityBefore);
if(!MemoryUtils.equals(reader.memory,compatibilityOffset,compatibilityBefore))throw new Error("TM/HM compatibility audit did not restore exact bytes.");
let decodedBytes=0,compressedBytes=0,backDecodedBytes=0,backCompressedBytes=0;
for(let dexNumber=1;dexNumber<=151;dexNumber++){
  const document=data.document(dexNumber);
  if(!document)throw new Error(`Pokédex #${dexNumber} has no canonical internal species.`);
  const picture=data.frontSprite(document.species,document.base);
  decodedBytes+=picture.bytes.length;compressedBytes+=picture.consumed;
  const backPicture=data.backSprite(document.species,document.base);
  if(backPicture.width!==4||backPicture.height!==4||backPicture.nativeScale!==2)throw new Error(`Pokédex #${dexNumber} has an invalid native back sprite.`);
  backDecodedBytes+=backPicture.bytes.length;backCompressedBytes+=backPicture.consumed;
}
const trainers=new PokemonViewer.gen1.Gen1TrainerData(reader,{speciesData:data});
const trainerDocuments=trainers.trainers(),partyMembers=trainerDocuments.reduce((sum,trainer)=>sum+trainer.party.length,0);
const progressionDocuments=progression.canonicalDocuments();
const moveDocuments=progression.moves.list(),machines=progression.moves.machines();
const usedEffects=new Set(moveDocuments.map(move=>move.effect));
const evolutionCount=progressionDocuments.reduce((sum,document)=>sum+document.evolutions.length,0);
const learnsetCount=progressionDocuments.reduce((sum,document)=>sum+document.learnset.length,0);
const encounters=new PokemonViewer.gen1.Gen1EncounterData(reader,{speciesData:data}),encounterDocuments=encounters.list();
const encounterSlots=encounterDocuments.reduce((sum,document)=>sum+document.slots.length,0);
const fishingDocuments=encounterDocuments.filter(document=>document.method==="fishing"),staticDocuments=encounterDocuments.filter(document=>document.method==="static");
for(const document of encounterDocuments){
  if(!(document.method==="fishing"&&document.rod!=="super")&&!encounters.owners(document).length)throw new Error(`Gen I ${document.id} has no exact map owner.`);
}
const editableEncounter=encounterDocuments[0],editableSlot=editableEncounter.slots[0],encounterPlan=encounters.editPlan(editableEncounter,{
  slot:0,level:editableSlot.level===100?99:editableSlot.level+1,species:editableSlot.species,rate:editableEncounter.rates[0].native===255?254:editableEncounter.rates[0].native+1
});
for(const write of encounterPlan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
for(const write of [...encounterPlan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
for(const write of encounterPlan.writes)if(!MemoryUtils.equals(reader.memory,write.offset,write.before))throw new Error("Gen I encounter audit did not restore exact bytes.");
for(const document of [fishingDocuments.find(item=>item.rod==="super"),staticDocuments[0]]){
  const slot=document.slots[0],plan=encounters.editPlan(document,{slot:0,level:slot.level===100?99:slot.level+1,species:slot.species});
  for(const write of plan.writes)MemoryUtils.replace(reader.memory,write.offset,write.before,write.after);
  for(const write of [...plan.writes].reverse())MemoryUtils.replace(reader.memory,write.offset,write.after,write.before);
  for(const write of plan.writes)if(!MemoryUtils.equals(reader.memory,write.offset,write.before))throw new Error(`Gen I ${document.id} audit did not restore exact bytes.`);
}
const graph=encounters.resourceGraph(trainers.resourceGraph(progression.resourceGraph(data.resourceGraph()))),validation=graph.validate();
const machineCompatibilityCount=graph.edges().filter(edge=>graph.node(edge.source)?.type==="species"&&graph.node(edge.target)?.type==="machine").length;
if(!validation.valid)throw new Error(`Gen I resource graph has ${validation.unresolved.length} unresolved references.`);
if(trainers.classes().length!==47||trainerDocuments.length!==415||partyMembers!==1061){
  throw new Error(`Unexpected Gen I trainer coverage: ${trainers.classes().length} classes / ${trainerDocuments.length} trainers / ${partyMembers} party members.`);
}
if(moveDocuments.length!==165||evolutionCount!==72||learnsetCount!==728){
  throw new Error(`Unexpected Gen I progression coverage: ${moveDocuments.length} moves / ${evolutionCount} evolutions / ${learnsetCount} learnset entries.`);
}
if(machines.length!==55||machines.some(machine=>machine.moveId<1||machine.moveId>165)){
  throw new Error("Gen I TM/HM table does not contain 55 valid move references.");
}
if(moveDocuments.some(move=>move.animation!==move.id||!Number.isInteger(move.animationDocument.offset)||!Number.isInteger(move.sound.offset))){
  throw new Error("Gen I move animation/sound records do not match the verified 165-entry tables.");
}
for(const effect of usedEffects)progression.moves.effect(effect);
if(machineCompatibilityCount!==3037)throw new Error(`Unexpected Gen I TM/HM compatibility coverage: ${machineCompatibilityCount} links.`);
if(encounterDocuments.length!==107||encounterSlots!==706||fishingDocuments.length!==35||staticDocuments.length!==14||graph.size!==4398||graph.edgeCount!==10359)throw new Error(`Unexpected Gen I encounter/graph coverage: ${encounterDocuments.length} documents / ${encounterSlots} slots / ${fishingDocuments.length} fishing / ${staticDocuments.length} static / ${graph.size} nodes / ${graph.edgeCount} edges.`);

console.log(`PASS ${manifest.profile} · 151 species / 151 front + 151 native-scale back sprites (${decodedBytes+backDecodedBytes} decoded / ${compressedBytes+backCompressedBytes} compressed bytes) / selective 28-byte Base Stats writers / reversible bounded progression writer · 165 moves / ${usedEffects.size} used effects / 55 TM/HM / ${machineCompatibilityCount} compatibility links / 165 animation pointers / 165 sound records · 72 evolutions / 728 learnset entries · 47 trainer classes / 415 trainers / 1061 party members · ${encounterDocuments.length} grass/water/fishing/static documents / ${encounterSlots} slots (${fishingDocuments.length} fishing / ${staticDocuments.length} static) · ${graph.size} graph nodes / ${graph.edgeCount} resolved edges`);
