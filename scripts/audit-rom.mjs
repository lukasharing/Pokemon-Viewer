import {readFile} from "node:fs/promises";
import {basename} from "node:path";

await import("../js/rom/gba-detector.js");
await import("../js/rom/gb-detector.js");
await import("../js/structures/memory.js");
await import("../js/structures/memory-reader.js");
await import("../js/core/utils.js");
await import("../js/core/rom-checksum.js");
await import("../js/core/memory-utils.js");
await import("../js/core/gba-rom-assets.js");
await import("../js/core/species-catalog.js");
await import("../js/core/gba-species.js");
await import("../js/core/gba-moves.js");
await import("../js/core/edit-utils.js");
await import("../js/core/command-stack.js");
await import("../js/core/project-identity.js");
await import("../js/core/rom-patch.js");
await import("../js/core/memory-reference-utils.js");
await import("../js/core/binary-codec-utils.js");
await import("../js/core/text-table.js");
await import("../js/structures/writer.js");
await import("../js/structures/gba/memory.js");
await import("../js/structures/gba/map.js");
await import("../js/structures/gba/sprite.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/map.js");
await import("../js/structures/gbc/map-discovery.js");
await import("../js/structures/gbc/sprite.js");
await import("../js/structures/gbc/text.js");
await import("../js/sprite/codecs/gba-4bpp.js");
await import("../js/battle/gba/sprites.js");
await import("../js/sprite/codecs/gbc-2bpp.js");
await import("../js/code/scripts/gba-event-script.js");
await import("../js/code/scripts/gbc-text-script.js");

const paths=process.argv.slice(2);
if(!paths.length){
  console.error("Usage: npm run audit:rom -- /path/to/game.gba [/path/to/game.gb]");
  process.exit(1);
}

const metadata=JSON.parse(await readFile(new URL("../json/games.json",import.meta.url),"utf8"));
const dictionary=async name=>{
  const source=JSON.parse(await readFile(new URL(`../decrypt/${name}.json`,import.meta.url),"utf8")),table=new Array(256);
  for(const [key,value] of Object.entries(source))table[Number.parseInt(key,16)]=value;
  return table;
};
const westernText=await dictionary("text_table_en"),gen1Text=await dictionary("text_table_gen1_en");
const equal=(left,right)=>left.length===right.length&&left.every((value,index)=>value===right[index]);
const auditExportChecksum=(source,family)=>{
  const exported=source.slice(),offset=exported.length-1;
  exported[offset]^=1;
  const result=RomChecksum.repair(exported,family);
  if(!result?.header.valid||result.global&&!result.global.valid)throw new Error("The exported cartridge checksum was not repaired.");
  if(exported[offset]===source[offset])throw new Error("The checksum audit did not retain its simulated edit.");
  const ranges=[];
  for(let cursor=0;cursor<source.length;){
    if(source[cursor]===exported[cursor]){cursor++;continue;}
    const start=cursor,previous=[],next=[];
    while(cursor<source.length&&source[cursor]!==exported[cursor]){previous.push(source[cursor]);next.push(exported[cursor]);cursor++;}
    const encode=bytes=>bytes.map(byte=>byte.toString(16).padStart(2,"0")).join(" ");
    ranges.push({offset:`0x${start.toString(16).toUpperCase()}`,length:cursor-start,previous:encode(previous),next:encode(next)});
  }
  const imported=source.slice(),memory=family==="gba"?new GbaMemory(imported):new GbcMemory(imported);
  const reader={ReadOnlyMemory:imported,memory,size:imported.length,family,project_commands:new CommandStack()};
  RomPatch.apply(reader,{format:"push-byte-patch",version:4,family,ranges});
  if(!equal(imported,exported))throw new Error("Import did not reproduce the exported ROM exactly.");
  if(!reader.project_commands.undo()||!equal(imported,source))throw new Error("Imported-report Undo did not restore the source ROM.");
  if(!reader.project_commands.redo()||!equal(imported,exported))throw new Error("Imported-report Redo did not reproduce the export.");
  return`${result.global?"header+global":"header"} checksum valid · export/import/undo exact`;
};
const reversibleEdit=(memory,record,{size,schema,field,min=0,max=0xffff,serialize}={})=>{
  if(!record||!Number.isInteger(record.offset))throw new Error("No editable event structure was found.");
  const before=MemoryUtils.bytes(memory,record.offset,size),current=record[field];
  const next=current>=max?current-1:Math.max(min,current+1);
  const writer=new StructureWriter(memory),stack=new CommandStack();
  const changed=writer.edit(stack,{
    base:record.offset,
    schema:{[field]:{...schema,min,max,serialize}},
    current:record,
    values:{[field]:next},
    label:"Audit event edit"
  });
  if(!changed)throw new Error("The event edit audit did not produce a change.");
  const stored=serialize?serialize(next):next;
  if(MemoryUtils.read(memory,record.offset+schema.offset,schema.type)!==stored)throw new Error("The event edit was not serialized.");
  if(!stack.undo())throw new Error("The event edit could not be undone.");
  if(!MemoryUtils.equals(memory,record.offset,before))throw new Error("Undo did not restore the event structure exactly.");
};
const bytesFromHex=value=>Uint8Array.from(value.match(/../g)||[],pair=>Number.parseInt(pair,16));
const findPatterns=(bytes,pattern)=>{
  const matches=[];
  outer:for(let offset=0;offset<=bytes.length-pattern.length;offset++){
    for(let index=0;index<pattern.length;index++)if(bytes[offset+index]!==pattern[index])continue outer;
    matches.push(offset);offset+=pattern.length-1;
  }
  return matches;
};
const firstView=source=>source?.views?.[0]||source;

const gbaOffsets=(bytes,memory)=>{
  const result={};
  for(const [name,definition] of Object.entries(metadata.gba_roms.global)){
    const pattern=bytesFromHex(definition.chain),match=findPatterns(bytes,pattern)[definition.index||0];
    if(!Number.isInteger(match))continue;
    const pointerOffset=match+pattern.length,resultOffset=memory.pointer(pointerOffset);
    if(resultOffset!==null)result[name]=resultOffset;
  }
  for(const required of ["map_header","sprite_header","sprite_palette"])if(!Number.isInteger(result[required]))throw new Error(`Required ${required} signature was not found.`);
  return result;
};

const auditGba=(bytes,info)=>{
  const memory=new GbaMemory(bytes),offsets=gbaOffsets(bytes,memory),group=memory.pointer(offsets.map_header),headerOffset=group===null?null:memory.pointer(group);
  if(headerOffset===null)throw new Error("The first GBA map header is invalid.");
  const map=GbaMapHeader.read(memory,headerOffset,{deep:true,frlg:["fire_red","leaf_green"].includes(info.base)}),layout=map.layoutData;
  if(!layout||layout.width<=0||layout.height<=0||layout.width>1024||layout.height>1024)throw new Error("The first GBA map layout is not plausible.");
  const reader={memory,memoryOffsets:offsets},sprites=new GbaOverworldSpriteCatalog(reader);
  if(!sprites.available())throw new Error("The GBA overworld sprite catalog is unavailable.");
  const source=firstView(sprites.source(sprites.list()[0].id));
  if(!source.count||!source.bytes?.length)throw new Error("The first GBA overworld sprite could not be decoded.");
  const events=map.eventData;
  const editable=events?.objects[0]&&{record:events.objects[0],size:GbaObjectEventTemplate.SIZE,schema:{offset:4,type:"s16"},field:"x",min:-32768,max:32767}
    ||events?.warpEntries[0]&&{record:events.warpEntries[0],size:GbaWarpEvent.SIZE,schema:{offset:0,type:"s16"},field:"x",min:-32768,max:32767}
    ||events?.coords[0]&&{record:events.coords[0],size:GbaCoordEvent.SIZE,schema:{offset:0,type:"s16"},field:"x",min:-32768,max:32767}
    ||events?.backgrounds[0]&&{record:events.backgrounds[0],size:GbaBgEvent.SIZE,schema:{offset:0,type:"u16"},field:"x",min:0,max:65535};
  reversibleEdit(memory,editable?.record,editable);
  const scriptOffset=events?.objects.find(event=>Number.isInteger(event.script))?.script??events?.coords.find(event=>Number.isInteger(event.script))?.script??events?.backgrounds.find(event=>Number.isInteger(event.script))?.script;
  if(!Number.isInteger(scriptOffset))throw new Error("No referenced GBA event script was found.");
  Object.assign(reader,{family:"gba",type:info.base,version:info.version,size:memory.size,ReadOnlyMemory:bytes,textDictionary:"text_table_en",getDictionary:name=>name==="text_table_en"?westernText:[],getTextByOffset:(dictionary,offset,length=256)=>{
    let value="";for(let index=0;index<length;index++){const byte=memory.u8(offset+index);if(byte===0xff)break;value+=dictionary[byte]??`[${byte.toString(16).padStart(2,"0")}]`;}return value;
  }});
  const codec=new GbaEventScriptCodec(reader),decoded=codec.decompile(scriptOffset),compiled=codec.compile(decoded.source);
  if(!equal(compiled,memory.slice(scriptOffset,decoded.bytes)))throw new Error("The referenced GBA event script did not round-trip.");
  const moves=new PokemonViewer.gba.GbaMoveData(reader);moves.validate();
  const pound=moves.get(1),moveBefore=MemoryUtils.bytes(memory,pound.offset,PokemonViewer.gba.GbaMoveData.RECORD_SIZE),moveAfter=moves.encode(pound,{power:pound.power===255?254:pound.power+1});
  MemoryUtils.replace(memory,pound.offset,moveBefore,moveAfter);MemoryUtils.replace(memory,pound.offset,moveAfter,moveBefore);
  if(!MemoryUtils.equals(memory,pound.offset,moveBefore))throw new Error("The Generation III move audit did not restore the fixed record.");
  const species=new PokemonViewer.gba.GbaSpeciesData(reader),front=species.front(1),palette=species.palette(1);
  if(front.bytes.length<0x800||palette.bytes.length<32||front.offset===0)throw new Error("The linked Generation III Species sprite is not a native first-frame GraphicSource.");
  return`map ${layout.width}×${layout.height} · events ${(events?.objects.length||0)+(events?.warpEntries.length||0)+(events?.coords.length||0)+(events?.backgrounds.length||0)} · edit+undo exact · script ${decoded.records.length} commands · sprites ${sprites.list().length} · linked Species palette 16 colors · moves ${moves.list().length}`;
};

const auditGen1=bytes=>{
  const memory=new GbcMemory(bytes),pointers=0x1ae,discovery=GbcMapDiscovery.findBankTable(memory,pointers),banks=discovery?.offset;
  if(!Number.isInteger(banks))throw new Error("The Gen I map bank table was not found.");
  let header=null,validMaps=0;
  for(let id=0;id<0xf8;id++){
    const bank=memory.u8(banks+id),address=memory.u16(pointers+id*2);
    if(!GbcMapDiscovery.plausibleHeader(memory,bank,address))continue;
    validMaps++;
    header||=GbcMapHeader.read(memory,memory.banked(bank,address),bank);
  }
  if(!header)throw new Error("No valid Gen I map header was found.");
  const events=GbcMapObjectBlock.read(memory,header.objects),sprites=new GbcOverworldSpriteCatalog(memory);
  const editable=events.warps[0]&&{record:events.warps[0],size:GbcWarpEvent.SIZE,schema:{offset:1,type:"u8"},field:"x",min:0,max:255}
    ||events.backgrounds[0]&&{record:events.backgrounds[0],size:GbcBgEvent.SIZE,schema:{offset:1,type:"u8"},field:"x",min:0,max:255}
    ||events.objects[0]&&{record:events.objects[0],size:events.objects[0].size,schema:{offset:2,type:"u8"},field:"x",min:0,max:251,serialize:value=>value+4};
  reversibleEdit(memory,editable?.record,editable);
  if(!sprites.available())throw new Error("The Gen I overworld sprite catalog is unavailable.");
  const source=firstView(sprites.source(sprites.list()[0].id));
  if(!source.count)throw new Error("The first Gen I overworld sprite could not be decoded.");
  const textEvent=events.objects.find(event=>event.textId>0)??events.backgrounds.find(event=>event.textId>0);
  if(!textEvent)throw new Error("No referenced Gen I text event was found.");
  const pointerOffset=header.textPointers+(textEvent.textId-1)*2,textOffset=memory.pointer16(pointerOffset,header.bank);
  const reader={family:"gb",size:memory.size,ReadOnlyMemory:bytes,memory,textDictionary:"text_table_gen1_en",getDictionary:name=>name==="text_table_gen1_en"?gen1Text:[]};
  const codec=new GbcTextScriptCodec(reader),decoded=codec.decompile(textOffset),compiled=codec.compile(decoded.source);
  if(!equal(compiled,memory.slice(textOffset,decoded.bytes)))throw new Error("The referenced Gen I text script did not round-trip.");
  return`maps ${validMaps} · first ${header.width}×${header.height} · events ${events.warpCount+events.bgCount+events.objectCount} · edit+undo exact · text ${decoded.records.length} commands · sprites ${sprites.list().length}`;
};

let failed=false;
for(const path of paths){
  try{
    const source=new Uint8Array(await readFile(path)),bytes=source.slice(),info=GbaRomDetector.detect(bytes)||GbRomDetector.detect(bytes);
    if(!info?.supported)throw new Error(info?.unsupportedReason||"Unsupported ROM.");
    const result=info.family==="gba"?auditGba(bytes,info):info.editorProfile==="gen1-rgb-intl"?auditGen1(bytes):"profile detection only";
    if(!equal(bytes,source))throw new Error("The reversible edit audit did not restore the complete in-memory ROM.");
    const checksum=auditExportChecksum(source,info.family);
    console.log(`PASS ${basename(path)} | ${info.name} | ${result} · ${checksum}`);
  }catch(error){
    failed=true;console.error(`FAIL ${basename(path)} | ${error.message||String(error)}`);
  }
}
process.exitCode=failed?1:0;
