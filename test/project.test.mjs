import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

await import("../js/rom/gba-detector.js");
await import("../js/rom/gb-detector.js");
await import("../js/structures/memory.js");
await import("../js/core/utils.js");
await import("../js/core/memory-utils.js");
await import("../js/core/resource-graph.js");
await import("../js/core/driver-registry.js");
await import("../js/animation/library.js");
await import("../js/animation/gba-driver.js");
await import("../js/animation/gen2/driver.js");
await import("../js/sound/library.js");
await import("../js/sound/source-catalog.js");
await import("../js/sound/map-music-catalog.js");
await import("../js/core/gba-rom-assets.js");
await import("../js/core/gba-species.js");
await import("../js/core/gba-moves.js");
await import("../js/core/memory-reference-utils.js");
await import("../js/core/binary-codec-utils.js");
await import("../js/core/text-table.js");
await import("../js/core/gsc-lz.js");
await import("../js/core/edit-utils.js");
await import("../js/core/rom-allocator.js");
await import("../js/core/relocatable-patch.js");
await import("../js/structures/writer.js");
await import("../js/core/map-layout-writer.js");
await import("../js/core/map-block-utils.js");
await import("../js/core/graphic-source.js");
await import("../js/structures/memory-reader.js");
await import("../js/structures/gba/memory.js");
await import("../js/structures/gba/item.js");
await import("../js/structures/gba/map.js");
await import("../js/structures/gba/metatile-attributes.js");
await import("../js/structures/gba/connection-writer.js");
await import("../js/structures/gba/event-writer.js");
await import("../js/structures/gba/sprite.js");
await import("../js/structures/gbc/memory.js");
await import("../js/structures/gbc/sprite.js");
await import("../js/structures/gbc/collision-writer.js");
await import("../js/structures/gen2/memory.js");
await import("../js/structures/gen2/connection-utils.js");
await import("../js/structures/gen2/map.js");
await import("../js/structures/gen2/connection-writer.js");
await import("../js/structures/gen2/event-writer.js");
await import("../js/structures/gen2/tileset.js");
await import("../js/structures/gen2/sprite.js");
await import("../js/structures/gen2/registry.js");
await import("../js/structures/gbc/text.js");
await import("../js/structures/gbc/item.js");
await import("../js/structures/gbc/map.js");
await import("../js/structures/gbc/map-discovery.js");
await import("../js/structures/gbc/connection-writer.js");
await import("../js/structures/gbc/event-writer.js");
await import("../js/structures/gba/registry.js");
await import("../js/structures/gbc/registry.js");
await import("../js/sprite/codecs/gba-4bpp.js");
await import("../js/sprite/codecs/gbc-2bpp.js");
await import("../js/map/selection.js");
await import("../js/map/library.js");
await import("../js/map/gen2/editor.js");
await import("../js/code/scripts/gba-event-script.js");
await import("../js/code/scripts/gbc-text-script.js");
await import("../js/code/scripts/gen2-text-script.js");
await import("../js/code/scripts/gen2-event-script.js");
await import("../js/core/rom-checksum.js");
await import("../js/core/draft-registry.js");
await import("../js/core/project-validator.js");
await import("../js/core/rom-export.js");
await import("../js/core/command-stack.js");
await import("../js/core/event-scope.js");
await import("../js/core/keyboard-utils.js");
await import("../js/core/project-identity.js");
await import("../js/core/rom-patch.js");
await import("../js/core/event-bookmark-utils.js");
await import("../js/hex/editor-hex.js");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const validGbBytes = () => {
  const bytes=new Uint8Array(0x200);
  RomChecksum.repair(bytes,"gb");
  return bytes;
};

test("GBA species evolution slots and TM/HM bits preserve native padding and unused flags",()=>{
  const bytes=new Uint8Array(0x200),data=Object.create(PokemonViewer.gba.GbaSpeciesData.prototype);
  data.memory=new RomMemory(bytes);
  data.profile={speciesCount:3,evolutions:0,tmHmLearnsets:0x100,tmHmCount:58};
  data.catalog={get:id=>({id,name:["None","Bulbasaur","Ivysaur","Venusaur"][id]})};
  data.name=id=>data.catalog.get(id).name;
  const evolutionOffset=5*8;
  bytes.set([4,0,16,0,2,0,0xaa,0xbb],evolutionOffset);
  bytes[0x100+8+7]=0xfc;
  const decoded=data.evolutions(1);
  assert.equal(decoded.length,1);assert.equal(decoded[0].methodName,"Level");assert.equal(decoded[0].param,16);assert.equal(decoded[0].target.name,"Ivysaur");
  const plan=data.evolutionEditBytes(1,[{method:7,param:83,targetId:3}]);
  assert.deepEqual([...plan.after.slice(0,8)],[7,0,83,0,3,0,0xaa,0xbb]);
  assert.ok(plan.after.slice(8).every(value=>value===0));
  const machines=data.encodeMachines(1,[0,57]);
  assert.equal(machines[0]&1,1);assert.equal(machines[7],0xfe);
});

test("Generation III move records decode and edit fixed fields without touching engine flags",()=>{
  const bytes=new Uint8Array(0x100),data=Object.create(PokemonViewer.gba.GbaMoveData.prototype);
  data.memory=new GbaMemory(bytes);data.profile={battleMoves:0x20,moveNames:0x80,moveCount:2};data._moves=null;
  data.structure={
    size:12,nameBytes:13,accuracyScale:100,
    fields:{
      effect:{byte:0,type:"u8"},power:{byte:1,type:"u8"},type:{byte:2,type:"u8"},
      accuracy:{byte:3,type:"u8"},pp:{byte:4,type:"u8"},effectChance:{byte:5,type:"u8"},
      target:{byte:6,type:"u8"},priority:{byte:7,type:"s8"},flags:{byte:8,type:"u32"}
    }
  };
  data.recordSize=12;data.nameBytes=13;data.accuracyScale=100;
  data.reader={getDictionary:()=>({}),getTextByOffset:(_dictionary,offset)=>offset===0x8d?"POUND":"KARATE CHOP"};
  bytes.set([0x00,40,0,100,35,0,0,0,0x33,0,0,0],0x2c);
  const move=data.get(1);assert.deepEqual([move.name,move.power,move.type,move.accuracy,move.pp,move.flags],["POUND",40,0,100,35,0x33]);
  const changed=data.encode(move,{power:55,type:10,accuracy:95,pp:20,effectChance:30,target:4,priority:-1});
  assert.deepEqual([...changed.slice(0,8)],[0,55,10,95,20,30,4,255]);
  assert.deepEqual([...changed.slice(8)],[0x33,0,0,0]);
  assert.throws(()=>data.encode(move,{type:18}),/type must be 0–17/);
  assert.throws(()=>data.encode(move,{pp:0}),/pp must be 1–40/);
  assert.equal(PokemonViewer.gba.GBA_MACHINES.length,58);
  assert.deepEqual(PokemonViewer.gba.GBA_MACHINES[0],{index:0,label:"TM01",name:"Focus Punch",moveId:264});
  assert.deepEqual(PokemonViewer.gba.GBA_MACHINES[57],{index:57,label:"HM08",name:"Dive",moveId:291});
  data.reader.capabilities={provenance:{repository:"pret/pokeemerald",id:"fixture"}};
  const speciesData={
    profile:{tmHmCount:0},
    catalog:{list:()=>[]},
    resourceGraph:()=>new PokemonViewer.resources.ResourceGraph()
  };
  const graph=data.resourceGraph(new PokemonViewer.resources.ResourceGraph(),{speciesData});
  assert.equal(graph.node("gba:move:1").label,"POUND");
  assert.deepEqual(graph.node("gba:move:1").writeRanges,[{offset:0x2c,length:8}]);
  assert.equal(graph.validate().valid,true);
});

test("GBA Pokédex lazy-loads its native TM/HM dependency before the driver",async()=>{
  const runtime=await read("js/rom/runtime/gba.js");
  const start=runtime.indexOf('if(workspaceId==="pokedex_editor")');
  const end=runtime.indexOf('if(workspaceId==="move_editor")',start);
  const pokedexBranch=runtime.slice(start,end);
  assert.ok(pokedexBranch.includes("js/core/gba-moves.js"),"Pokédex runtime must load the machine catalog");
  assert.ok(pokedexBranch.indexOf("js/core/gba-moves.js")<pokedexBranch.indexOf("js/pokedex/gba/driver.js"),"machine catalog must load before the Pokédex driver");
});

test("CoreUtils provides side-effect-free shared value and color helpers", async () => {
  assert.equal(CoreUtils.clamp(12,0,10),10);
  assert.deepEqual(CoreUtils.range(3,index=>index*2),[0,2,4]);
  assert.equal(CoreUtils.hex(42,4),"0x002A");
  assert.equal(CoreUtils.parseInteger("123"),123);
  assert.equal(CoreUtils.parseInteger("0x7b"),123);
  assert.equal(CoreUtils.parseInteger("$7B"),123);
  assert.equal(CoreUtils.parseOffset("0x0F",16),15);
  assert.throws(()=>CoreUtils.parseInteger("12oops"),/decimal.*hexadecimal/i);
  assert.throws(()=>CoreUtils.parseOffset("16",16),/0 to 15/);
  assert.deepEqual(CoreUtils.bgr555ToRgb(0x001f),[255,0,0]);
  assert.equal(CoreUtils.bgr555ToHex(0x7c00),0x0000ff);
  assert.throws(()=>CoreUtils.integer(1.5),/integer/);

  const reader=await read("js/rom_reader.js"),mapEditor=await read("js/map/editor-map.js");
  assert.match(reader,/js\/core\/utils\.js/);
  assert.doesNotMatch(reader,/js\/util\/utils\.js/);
  assert.doesNotMatch(mapEditor,/\b(?:Utils|Color)\./);

  for(const editor of ["js/code/editor.js","js/hex/editor-hex.js","js/sprite/editor.js"]){
    const source=await read(editor);
    assert.match(source,/CoreUtils\.parseOffset/);
  }
});

test("GB/GBC image decoding preserves native row and column-major tile layouts",()=>{
  const tiles=[0,1,2,3].map(value=>GbcSpriteCodec.encodeTile(new Uint8Array(64).fill(value)));
  const bytes=new Uint8Array(64);tiles.forEach((tile,index)=>bytes.set(tile,index*16));
  const memory=new RomMemory(bytes);
  const rows=GbcSpriteCodec.decodeImage(memory,0,{width:16,height:16,order:"rows"});
  const columns=GbcSpriteCodec.decodeImage(memory,0,{width:16,height:16,order:"columns"});
  const corners=pixels=>[pixels[0],pixels[8],pixels[8*16],pixels[8*16+8]];
  assert.deepEqual(corners(rows),[0,1,2,3]);
  assert.deepEqual(corners(columns),[0,2,1,3]);
  assert.throws(()=>GbcSpriteCodec.decodeImage(memory,0,{width:16,height:16,order:"diagonal"}),/rows or columns/);
});

test("the application shell references the generated stylesheet", async () => {
  const html = await read("index.html");
  assert.match(html, /href=["']css\/style\.css(?:\?v=\d+)?["']/);
  assert.match(html, /id=["']selectLightboxRom["']/);
});

test("all editor fragments expose the shared shell and one primary surface", async () => {
  for (const name of ["hex", "code", "map", "sprite", "battle", "pokedex", "moves", "sound", "animation", "encounters", "items", "profile"]) {
    const html = await read(`${name}.html`);
    assert.match(html, /class=["'][^"']*editor_area[^"']*editor-shell|class=["'][^"']*editor-shell[^"']*editor_area/);
    assert.match(html, /class=["'][^"']*editor-shell__main/);
  }
  for(const name of ["moves","pokedex","sound","encounters"]){
    const html=await read(`${name}.html`);
    assert.match(html,/class=["'][^"']*editor-shell__stage--document/);
  }
});

test("resource editors share one fixed single-line context header",async()=>{
  for(const name of ["items","moves","pokedex","sound","sprite","code"]){
    const html=await read(`${name}.html`);
    assert.match(html,/class="[^"]*editor-context-header[^"]*"/);
    assert.match(html,/class="[^"]*editor-context-header__content[^"]*"/);
  }
  const styles=await read("scss/components/_editor-workspace.scss");
  assert.match(styles,/--editor-context-header-height:68px/);
  assert.match(styles,/\.editor-context-header__content\{[\s\S]*?display:flex!important/);
  assert.match(styles,/\.editor-context-header__content\{[\s\S]*?overflow-x:auto/);
  assert.match(styles,/\.editor-context-header__content\{[\s\S]*?overflow-y:hidden/);
  const guide=await read("doc/UX_GUIDELINES.md");
  assert.match(guide,/editor-context-header/);
  assert.match(guide,/never wraps/);
});

test("navigation advertises only initialized editor workspaces", async () => {
  const init=await read("js/init.js"),registry=await read("js/core/editor-descriptor-registry.js"),architecture=await read("doc/ARCHITECTURE.md");
  for(const editor of ["hex_editor","code_workspace","map_editor","sprite_editor","battle_editor","pokedex_editor","move_editor","sound_editor","animation_editor"])assert.match(init,new RegExp(`id:\\s*["']${editor}["']`));
  assert.doesNotMatch(init,/id:\s*["']emulator_editor["']/);
  assert.match(registry,/renderNavigation\(container/);assert.match(init,/EDITORS\.renderNavigation/);
  assert.match(init,/loadResources\(\["emulator\.html"\]\)/);
  assert.match(architecture,/IodineGBA/);
});

test("game metadata includes the five Generation III GBA titles", async () => {
  const data = JSON.parse(await read("json/games.json"));
  const games = Object.keys(data.gba_roms);
  for (const name of ["ruby", "sapphire", "emerald", "fire_red", "leaf_green"]) {
    assert.ok(games.includes(name), `missing ${name}`);
  }
});

test("compiled CSS contains the material tokens and responsive shell", async () => {
  const css = await read("css/style.css");
  assert.match(css, /#287fc5/i);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.game_option/);
});

test("commercial ROMs and OS metadata are ignored", async () => {
  const ignore = await read(".gitignore");
  for (const pattern of ["roms/", "*.gba", "*.gbc", ".DS_Store"]) {
    assert.ok(ignore.includes(pattern), `missing ignore rule: ${pattern}`);
  }
});

test("semantic ROM audit proves reversible production edits without writing ROM files or printing bytes", async () => {
  const script=await read("scripts/audit-rom.mjs"),manifest=JSON.parse(await read("package.json"));
  assert.equal(manifest.scripts["audit:rom"],"node scripts/audit-rom.mjs");
  assert.match(script,/GbaMapHeader\.read/);assert.match(script,/GbcMapHeader\.read/);
  assert.match(script,/GbaOverworldSpriteCatalog/);assert.match(script,/GbcOverworldSpriteCatalog/);
  assert.match(script,/new GbaEventScriptCodec/);assert.match(script,/new GbcTextScriptCodec/);
  assert.match(script,/new StructureWriter/);assert.match(script,/new CommandStack/);
  assert.match(script,/source\.slice\(\)/);assert.match(script,/stack\.undo\(\)/);
  assert.match(script,/MemoryUtils\.equals/);assert.match(script,/equal\(bytes,source\)/);
  assert.match(script,/RomChecksum\.repair/);assert.match(script,/checksum.*valid/);
  assert.match(script,/RomPatch\.apply/);assert.match(script,/Import did not reproduce/);
  assert.match(script,/did not round-trip/);
  assert.match(script,/events [^`]*edit\+undo exact[^`]*sprites/);
  assert.doesNotMatch(script,/\bwriteFile\b/);
  assert.doesNotMatch(script,/console\.(?:log|error)\([^\\n]*(?:toString\\(16\\)|offsets|source\\.bytes)/);
});

test("GBA headers determine game, language, and revision without a selector", () => {
  const makeHeader = (code, title, revision) => {
    const rom = new Uint8Array(0xc0);
    rom.set(Buffer.from(title, "ascii"), 0xa0);
    rom.set(Buffer.from(code, "ascii"), 0xac);
    rom.set(Buffer.from("01", "ascii"), 0xb0);
    rom[0xbc] = revision;
    let sum=0;for(let offset=0xa0;offset<=0xbc;offset++)sum=(sum+rom[offset])&0xff;
    rom[0xbd]=(0x100-(sum+0x19))&0xff;
    return rom;
  };

  const emerald = GbaRomDetector.detect(makeHeader("BPEE", "POKEMON EMER", 0));
  assert.equal(emerald.family, "gba");
  assert.equal(emerald.base, "emerald");
  assert.equal(emerald.lang, "en");
  assert.equal(emerald.version, 0);
  assert.equal(emerald.checksumValid,true);
  assert.equal(emerald.editorProfile,"gen3-emerald-en");
  assert.equal(GbaRomDetector.detect(makeHeader("BPRS", "POKEMON FIRE", 1)).lang, "es");
  const modified=makeHeader("BPEE","POKEMON EMER",0);modified[0xa0]^=1;assert.equal(GbaRomDetector.detect(modified).checksumValid,false);
  assert.equal(GbaRomDetector.detect(makeHeader("XXXX", "NOT POKEMON", 0)), null);
});

test("GB and GBC headers use their own detector", () => {
  const makeHeader = (title, colorFlag = 0) => {
    const rom = new Uint8Array(0x8000);
    rom.set(Buffer.from(title, "ascii"), 0x134);
    rom[0x143] = colorFlag;
    rom[0x14a] = 1;
    rom[0x14c] = 0;
    let checksum = 0;
    for(let offset = 0x134; offset <= 0x14c; offset++) checksum = (checksum - rom[offset] - 1) & 0xff;
    rom[0x14d] = checksum;
    return rom;
  };

  const red = GbRomDetector.detect(makeHeader("POKEMON RED"));
  assert.equal(red.platform, "Game Boy");
  assert.equal(red.base, "red");
  assert.equal(red.checksumValid, true);
  assert.equal(red.editorProfile,"gen1-rgb-intl");
  assert.equal(red.supported,true);

  const crystal = GbRomDetector.detect(makeHeader("POKEMON CRYSTAL", 0xc0));
  assert.equal(crystal.platform, "Game Boy Color");
  assert.equal(crystal.base, "crystal");
  assert.equal(crystal.supported,true);
  assert.equal(crystal.editorProfile,"gen2-crystal-intl");
  assert.deepEqual(crystal.workspaces,["hex_editor","code_workspace","map_editor","sprite_editor","battle_editor","pokedex_editor","sound_editor","animation_editor"]);
  const unknownCrystal=makeHeader("POKEMON CRYSTAL",0xc0);unknownCrystal[0x14c]=2;
  assert.equal(GbRomDetector.detect(unknownCrystal).supported,false);
  assert.equal(GbRomDetector.detect(makeHeader("POKEMON YELLOW")).supported,false);
});

test("recognized incompatible classic games never reach the Gen I runtime", async () => {
  const detector=await read("js/rom/detector.js"),runtime=await read("js/rom/runtime/gbc.js"),reader=await read("js/rom_reader.js"),guide=await read("doc/COMPATIBILITY.md"),init=await read("js/init.js");
  assert.match(detector,/result\?\.supported===false/);assert.match(detector,/throw new Error\(result\.unsupportedReason\)/);
  assert.match(runtime,/info\.editorProfile!==["']gen1-rgb-intl["']/);assert.match(runtime,/does not have a compatible Gen I editor profile/);
  assert.match(reader,/this\.editorProfile = info\.editorProfile \|\| info\.family/);
  assert.match(guide,/International Red and Blue/);assert.match(guide,/International Crystal Rev 0 and Rev 1/);
  assert.match(init,/ROM compatibility[^]*COMPATIBILITY\.md/);
});

test("unrecognized ROM hacks require an explicit safe base profile",async()=>{
  const index=await read("index.html"),detector=await read("js/rom/detector.js"),selector=await read("js/rom/profile-selector.js");
  const profile=await read("js/core/memory-profile.js"),assets=await read("js/core/gba-rom-assets.js"),reader=await read("js/rom_reader.js");
  assert.match(index,/js\/core\/memory-profile\.js/);assert.match(index,/js\/rom\/profile-selector\.js/);
  assert.match(detector,/RomProfileSelector\.choose/);
  assert.match(selector,/Choose the ROM hack base/);assert.match(selector,/Table editors stay locked/);
  assert.match(profile,/class MemoryProfile/);assert.match(profile,/require\(name\)/);
  assert.match(reader,/this\.memoryProfile = new MemoryProfile/);
  assert.match(assets,/SYMBOL_BINDINGS/);assert.match(assets,/!dictionary\?\.verified/);
  assert.doesNotMatch(assets,/capabilities\?\.provenance\?\.symbols/);
});

test("Pokémon Crystal has an isolated Gen II runtime and accurate text commands", async () => {
  const raw=JSON.parse(await read("decrypt/text_table_gen2_en.json")),dictionary=[];
  for(const [byte,token] of Object.entries(raw))dictionary[parseInt(byte,16)]=token;
  const source='text "HELLO"\nline "WORLD"\ntext_buffer $02\ntext_far $4567, $12\ndone';
  const reader={memory:new Gen2Memory(new Uint8Array(0x8000)),size:0x8000,textDictionary:"text_table_gen2_en",getDictionary:()=>dictionary};
  const codec=new Gen2TextScriptCodec(reader),compiled=codec.compile(source);
  assert.equal(compiled[0],0x00);
  assert.ok(compiled.includes(0x14));
  assert.deepEqual(Array.from(compiled.slice(-5)),[0x16,0x67,0x45,0x12,0x57]);
  reader.memory.bytes.set(compiled,0x100);
  const decoded=codec.decompile(0x100,{limit:compiled.length});
  assert.match(decoded.source,/text_buffer \$02/);
  assert.match(decoded.source,/text_far \$4567, \$12/);
  assert.equal(codec.compile(decoded.source).toString(),compiled.toString());
  const pointers=new Gen2Memory(new Uint8Array(0x10000));pointers.bytes.set([0x34,0x52,0x03],0x20);
  assert.equal(pointers.farPointer(0x20),0xd234);
  const runtime=await read("js/rom/runtime/gen2.js"),readerSource=await read("js/rom_reader.js"),init=await read("js/init.js"),registry=await read("js/core/editor-descriptor-registry.js");
  assert.match(runtime,/PokemonViewer\.structures\.registries\.gen2/);
  assert.match(runtime,/gen2-text-script\.js[^]*Gen2ScriptCodec/);
  assert.doesNotMatch(runtime,/GbcStructureRegistry|GbcTextScriptCodec|map\/gbc/);
  assert.match(readerSource,/info\.editorProfile===["']gen2-crystal-intl["']/);
  assert.match(init,/EDITORS\.updateNavigation\(elements\.navigation,detail\)/);
  assert.match(registry,/workspaces\?\.includes\(descriptor\.id\)/);
});

test("Crystal event scripts round-trip the complete pokecrystal command language", () => {
  const bytes=new Uint8Array(0x400),memory=new Gen2Memory(bytes);
  bytes.set([
    0x1f,2,3,
    0x2d,25,5,0,1,0x34,0x12,0x78,0x56,
    0x4c,0x00,0x02,
    0x4b,0x00,0x20,0x02,
    0x91
  ],0x100);
  const reader={memory,size:memory.size,getDictionary:()=>[],textDictionary:"test"},codec=new Gen2EventScriptCodec(reader),result=codec.decompile(0x100);
  assert.match(result.source,/giveitem \$02, \$03/);
  assert.match(result.source,/givepoke \$19, \$05, \$00, \$01, \$1234, \$5678/);
  assert.match(result.source,/writetext \$0200/);
  assert.match(result.source,/farwritetext \$022000/);
  assert.deepEqual(result.links.map(link=>[link.offset,link.reference.kind]),[[0x200,"gen2Near"],[0x220,"gen2Far"]]);
  assert.deepEqual(codec.compile(result.source),bytes.slice(0x100,0x100+result.bytes));
  assert.equal(result.records.at(-1).name,"end");
  assert.throws(()=>codec.compile("givepoke $01, $05, $00, $01"),/expects 6/);
  const composite=new Gen2ScriptCodec(reader);
  bytes.set([0x00,0x80,0x50],0x200);
  assert.match(composite.decompile(0x200,{kind:"text"}).language,/text macros/);
});

test("Crystal event flow links distinguish same-bank and far script owners", () => {
  const bytes=new Uint8Array(0x10000),memory=new Gen2Memory(bytes);
  bytes.set([0x00,0x00,0x02,0x06,0x01,0x20,0x02,0x01,0x02,0x00,0x41,0x91],0x100);
  bytes[0x200]=0x91;bytes[0x220]=0x91;bytes[0x8100]=0x91;
  const reader={memory,size:memory.size,getDictionary:()=>[],textDictionary:"test"},result=new Gen2EventScriptCodec(reader).decompile(0x100);
  assert.deepEqual(result.links.map(link=>[link.kind,link.offset,link.reference]),[
    ["event",0x200,{kind:"gen2Near",pointerOffset:0x101,bank:0}],
    ["event",0x220,{kind:"gen2Near",pointerOffset:0x105,bank:0}],
    ["event",0x8100,{kind:"gen2Far",bankOffset:0x108,addressOffset:0x109}]
  ]);
});

test("MemoryReferenceUtils resolves editable banked links without leaking address arithmetic", () => {
  const bytes=new Uint8Array(0x10000),memory=new Gen2Memory(bytes);
  bytes.set([0x34,0x52],0x20);bytes.set([0x03,0x78,0x56],0x30);
  const near=MemoryReferenceUtils.gen2Near(memory,0x20,2,{kind:"text",label:"Near text"});
  const far=MemoryReferenceUtils.gen2Far(memory,0x30,0x31,{kind:"text",label:"Far text"});
  assert.equal(near.offset,0x9234);assert.deepEqual(near.reference,{kind:"gen2Near",pointerOffset:0x20,bank:2});
  assert.equal(far.offset,0xd678);assert.deepEqual(far.reference,{kind:"gen2Far",bankOffset:0x30,addressOffset:0x31});
  assert.equal(MemoryReferenceUtils.try(()=>MemoryReferenceUtils.gen2Near(memory,0xffff,0)),null);
});

test("Gen II map structures follow pokecrystal group, attribute, and event layouts", () => {
  const bytes=new Uint8Array(0x14000),memory=new Gen2Memory(bytes),view=new DataView(bytes.buffer),tableOffset=0x200;
  for(let group=1;group<=26;group++){
    const entryAddress=0x5000+(group-1)*9,entryOffset=entryAddress,attributesAddress=0x5000+(group-1)*0x20,attributesOffset=0x8000+attributesAddress-0x4000;
    view.setUint16(tableOffset+(group-1)*2,entryAddress,true);
    bytes.set([2,group,1,attributesAddress&255,attributesAddress>>8,group,7,0x10,1],entryOffset);
    bytes.set([0,9,10,2,0x00,0x60,2,0x10,0x60,(attributesAddress+12)&255,(attributesAddress+12)>>8,0],attributesOffset);
    bytes.set([0,0,0,0,0,0],attributesOffset+12);
  }
  const directory=new Gen2MapDirectory(memory,{tableOffset,tableBank:1}),map=directory.map(1,1);
  assert.equal(map.entry.tileset,1);
  assert.equal(map.attributes.width,10);
  assert.equal(map.attributes.height,9);
  assert.equal(map.events.size,6);

  const eventOffset=0x12000;
  bytes.set([
    0,0,
    1,5,6,2,24,3,
    1,4,7,8,0,0x34,0x12,0,0,
    1,9,10,2,0x78,0x56,
    1,11,16,15,3,0x21,0xff,0xff,0x42,5,0xbc,0x9a,0x34,0x12
  ],eventOffset);
  const events=Gen2MapEvents.read(memory,eventOffset);
  assert.deepEqual([events.warps[0].x,events.warps[0].y,events.warps[0].mapGroup],[6,5,24]);
  assert.equal(events.coordinates[0].scriptAddress,0x1234);
  assert.equal(events.backgrounds[0].scriptAddress,0x5678);
  assert.deepEqual([events.objects[0].x,events.objects[0].y,events.objects[0].palette,events.objects[0].kind],[11,12,4,2]);
  assert.equal(events.objects[0].eventFlag,0x1234);
  assert.deepEqual(Gen2StructureRegistry.list(),["mapGroupEntry","mapAttributes","mapConnection","mapEvents","warp","coordEvent","bgEvent","objectEvent","tileset","overworldSprites"]);
});

test("Gen II map connections and directory counts follow pokecrystal", () => {
  const bytes=new Uint8Array(0x18000),memory=new Gen2Memory(bytes),attributesOffset=0x100;
  bytes.set([0,4,5,1,0,0x40,1,0,0x50,0,0x60,10],attributesOffset);
  bytes.set([
    2,3,0,0x41,0,0,8,7,11,0xf6,0,0,
    4,5,0,0x42,0,0,9,8,0xf4,13,0,0
  ],attributesOffset+12);
  const attributes=Gen2MapAttributes.read(memory,attributesOffset),connections=Gen2MapConnection.readAll(memory,attributes);
  assert.deepEqual(connections.map(item=>[item.direction,item.id,item.perpendicularOffset]),[
    ["north","2:3",5],["west","4:5",6]
  ]);
  assert.equal(Gen2MapDirectory.GROUP_COUNTS.length,26);
  assert.equal(Gen2MapDirectory.GROUP_COUNTS.reduce((sum,count)=>sum+count,0),388);
  assert.equal(Gen2MapDirectory.GROUP_COUNTS[2],91);
  assert.throws(()=>Gen2MapConnection.read(memory,memory.size-2),/ROM range/);
});

test("Gen II connection utilities preserve official direction bits and geometry", () => {
  assert.deepEqual(Gen2ConnectionUtils.DIRECTIONS.map(({name,flag})=>[name,flag]),[
    ["north",8],["south",4],["west",2],["east",1]
  ]);
  assert.equal(Gen2ConnectionUtils.mask([{direction:"north"},{direction:"west"}]),10);
  const geometry=Gen2ConnectionUtils.geometry({width:10,height:8},{width:7,height:6},"north",2);
  assert.deepEqual(
    [geometry.blockDelta,geometry.mapDelta,geometry.windowDelta,geometry.length,geometry.width,geometry.y,geometry.x],
    [21,5,79,7,7,11,-4]
  );
  const encoded=Gen2ConnectionUtils.encode({mapGroup:2,mapNumber:3,blocksAddress:0x4123,mapAddress:0xc100,length:7,width:7,y:11,x:-4,windowAddress:0xc24f});
  assert.deepEqual([...encoded],[2,3,0x23,0x41,0,0xc1,7,7,11,0xfc,0x4f,0xc2]);
});

test("Gen II connection tails relocate canonically and restore their far pointer", () => {
  const bytes=new Uint8Array(0x10000);bytes.fill(0xff);
  const memory=new Gen2Memory(bytes),entryOffset=0x100,attributesOffset=0x8100;
  bytes.set([2,1,1,0x00,0x41,1,0,0,0],entryOffset);
  bytes.set([0,8,10,2,0,0x42,2,0,0x43,0,0x44,8],attributesOffset);
  const north={direction:"north",mapGroup:2,mapNumber:3,blocksAddress:0x4200,mapAddress:0xc010,length:7,width:7,y:11,x:-4,windowAddress:0xc04f};
  bytes.set(Gen2ConnectionUtils.encode(north),attributesOffset+Gen2MapAttributes.SIZE);
  const entry=Gen2MapGroupEntry.read(memory,entryOffset,{group:1,map:1});
  const attributes=Gen2MapAttributes.read(memory,attributesOffset);
  const map={entry,attributes,connections:Gen2MapConnection.readAll(memory,attributes)};
  const writer=new Gen2ConnectionWriter(memory),before=memory.slice(attributesOffset,24);
  const east={direction:"east",mapGroup:4,mapNumber:5,blocksAddress:0x4300,mapAddress:0xc020,length:6,width:8,y:2,x:0,windowAddress:0xc050};
  const plan=writer.insert(map,east);
  assert.equal(plan.relocated,true);
  writer.apply(plan);
  const relocated=Gen2MapAttributes.read(memory,Gen2MapGroupEntry.read(memory,entryOffset).attributesOffset);
  assert.equal(relocated.connections,9);
  assert.deepEqual(Gen2MapConnection.readAll(memory,relocated).map(item=>item.direction),["north","east"]);
  writer.restore(plan);
  assert.equal(memory.u8(entryOffset),2);
  assert.equal(memory.u16(entryOffset+3),0x4100);
  assert.deepEqual(memory.slice(attributesOffset,24),before);
});

test("Gen II event blocks relocate inside scriptsBank and restore exactly", () => {
  const bytes=new Uint8Array(0xc000);bytes.fill(0xff);
  const memory=new Gen2Memory(bytes),attributesOffset=0x100,eventOffset=0x8100;
  bytes.set([0,4,5,2,0,0x40,2,0,0x40,0,0x41,0],attributesOffset);
  bytes.set([
    0xaa,0xbb,
    1,2,3,1,4,5,
    0,
    0,
    1,1,8,9,0,0,0xff,0xff,0,0,0,0,0xff,0xff
  ],eventOffset);
  const attributes=Gen2MapAttributes.read(memory,attributesOffset),events=Gen2MapEvents.read(memory,eventOffset),writer=new Gen2EventBlockWriter(memory);
  const plan=writer.insert(attributes,events,"Coordinate",writer.entry("Coordinate",{x:6,y:7}));
  assert.equal(Math.floor(plan.allocation/0x4000),2);
  assert.equal(plan.pointerOffset,attributesOffset+9);
  writer.apply(plan);
  assert.equal(memory.u16(attributesOffset+9),plan.nextAddress);
  const relocated=Gen2MapEvents.read(memory,plan.allocation);
  assert.deepEqual(Array.from(memory.slice(plan.allocation,2)),[0xaa,0xbb]);
  assert.deepEqual([relocated.warps.length,relocated.coordinates.length,relocated.backgrounds.length,relocated.objects.length],[1,1,0,1]);
  assert.deepEqual([relocated.coordinates[0].x,relocated.coordinates[0].y],[6,7]);
  writer.restore(plan);
  assert.equal(memory.u16(attributesOffset+9),0x4100);
  assert.ok(memory.slice(plan.allocation,plan.nextBytes.length).every(value=>value===0xff));

  const remove=writer.remove(attributes,events,"Object",0),encoded=writer.encode(events,{remove:{kind:"Object",index:0}});
  assert.equal(Gen2MapEvents.read(new Gen2Memory(encoded),0).objects.length,0);
  assert.throws(()=>writer.remove(attributes,events,"Warp",4),/outside/);
});

test("GSC LZ3 and Crystal tilesets decode graphics, metatiles, palettes, and collision separately", () => {
  const commandBytes=Uint8Array.of(
    0x02,1,2,3,
    0x21,0xaa,
    0x42,0xbb,0xcc,
    0x61,
    0x83,0,0,
    0xa0,0x80,
    0xc2,0,2,
    0xff
  ),commandMemory=new RomMemory(commandBytes),result=GscLz.decompress(commandMemory,0);
  assert.deepEqual(Array.from(result.bytes),[1,2,3,0xaa,0xaa,0xbb,0xcc,0xbb,0,0,1,2,3,0xaa,0x55,3,2,1]);
  assert.equal(result.consumed,commandBytes.length);

  const bytes=new Uint8Array(0x100000),memory=new Gen2Memory(bytes),headerOffset=0x100;
  bytes.set([1,0,0x40,2,0,0x40,2,0,0x48,0,0,0,0,0,0x40],headerOffset);
  bytes.set([0xef,0xff,0xef,0xff,0xef,0xff,0xff],0x4000);
  bytes.set(Array.from({length:16},(_,index)=>index),0x8000);
  bytes.set([0x10,0x20,0x30,0x40],0x8800);
  bytes[0xfc000]=0x53;
  const header=Gen2TilesetHeader.read(memory,headerOffset,{id:1}),tileset=new Gen2TilesetCodec(memory,header);
  assert.equal(tileset.graphics.length,0xc00);
  assert.ok(tileset.tile(0).every(pixel=>pixel===0));
  assert.deepEqual(Array.from(tileset.metatile(0)),Array.from({length:16},(_,index)=>index));
  assert.deepEqual(Array.from(tileset.collision(0)),[0x10,0x20,0x30,0x40]);
  assert.deepEqual([tileset.paletteIndex(0),tileset.paletteIndex(1)],[3,5]);
  assert.equal(tileset.compressedSize,7);
  const palettes=Array.from({length:8},(_,palette)=>Array.from({length:4},(_,color)=>[palette,color,0,255]));
  const rendered=tileset.renderMetatile(0,palettes);
  assert.deepEqual([rendered.width,rendered.height,rendered.pixels.length],[32,32,4096]);
  assert.deepEqual(Array.from(rendered.pixels.slice(0,4)),[3,0,0,255]);
  assert.throws(()=>GscLz.decompress(new RomMemory(Uint8Array.of(0x80,0x80,0xff)),0),/unavailable output/);
});

test("Crystal map workspace uses its isolated fixed-structure Gen II editor", async () => {
  const runtime=await read("js/rom/runtime/gen2.js"),driver=await read("js/map/gen2/editor.js"),controls=await read("js/map/controls.js"),context=await read("js/map/context-menu.js");
  assert.match(runtime,/js\/map\/gen2\/editor\.js/);
  assert.match(runtime,/capabilities\.fixedEditing/);
  assert.match(runtime,/registerDriver\(["']gen2["']/);
  assert.doesNotMatch(runtime,/map\/gbc\/editor|map\/editor-map/);
  assert.match(driver,/class Gen2MapDriver/);
  assert.match(driver,/Gen2MapDirectory|Gen2TilesetHeader|Gen2MapConnection/);
  assert.match(driver,/Enter warp/);
  assert.match(driver,/Gen2EventBlockWriter/);
  assert.match(driver,/Delete event/);
  assert.match(driver,/renderMetatile/);
  assert.match(controls,/\["gba","gb","gen2"\]/);
  assert.match(context,/contextActionEnabled/);
});

test("Crystal block and fixed event edits write exact reversible Gen II bytes", () => {
  const bytes=new Uint8Array(0x1000),memory=new Gen2Memory(bytes),driver=Object.create(Gen2MapDriver.prototype),commands=new CommandStack();
  Object.assign(driver,{memory,structureWriter:new StructureWriter(memory),editor:{commands},blocks:Uint8Array.of(2,3,4,5),current:{data:{attributes:{width:2,height:2,blocksOffset:0x100}}},redraw(){}});
  bytes.set(driver.blocks,0x100);
  assert.equal(driver.setBlock(1,0,7),true);
  assert.equal(bytes[0x101],7);
  commands.undo();assert.equal(bytes[0x101],3);
  commands.redo();assert.equal(bytes[0x101],7);

  const event={eventType:"Object",offset:0x200,spriteId:1,x:3,y:4,movement:2,radius:0,hourStart:0,hourEnd:0,palette:2,kind:5,range:1,scriptAddress:0x4567,eventFlag:0x1234};
  bytes.set([1,8,7,2,0,0,0,0x25,1,0x67,0x45,0x34,0x12],event.offset);
  driver.reloadEvents=()=>{};
  assert.equal(driver.updateEventFields(event,{x:9,y:10,palette:6,kind:3}),true);
  assert.deepEqual(Array.from(bytes.slice(event.offset+1,event.offset+8)),[14,13,2,0,0,0,0x63]);
  commands.undo();
  assert.deepEqual(Array.from(bytes.slice(event.offset+1,event.offset+8)),[8,7,2,0,0,0,0x25]);
  assert.throws(()=>driver.updateEventFields(event,{palette:16}),/outside/);
});

test("startup HTML keeps ROM-family modules out of the critical path", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /js\/map\/editor-map\.js/);
  assert.doesNotMatch(html, /js\/rom\/(?:gba|gb)-detector\.js/);
  assert.match(html, /js\/core\/asset-loader\.js/);
  assert.match(html, /js\/core\/dom\.js/);
});

test("map tools are isolated behind reusable native control modules", async () => {
  const runtime = await read("js/rom/runtime/gba.js");
  const controls = await read("js/map/controls.js");
  const contextMenu = await read("js/map/context-menu.js");
  const markup = await read("map.html");
  assert.match(runtime, /js\/map\/controls\.js/);
  assert.match(runtime, /js\/map\/context-menu\.js/);
  assert.match(controls, /class MapControls/);
  assert.match(controls, /defaultMode=2/);
  assert.match(controls, /this\.selectDefault\(defaultMode\)/);
  assert.match(markup, /class="map_tool selected" data-type="2" data-current="2"/);
  assert.doesNotMatch(markup, /class="map_tool selected" data-type="0-1"/);
  assert.match(contextMenu, /class MapContextMenu/);
  assert.doesNotMatch(controls + contextMenu, /\$\s*\(/);
  assert.match(controls, /map_tool_status/);
});

test("GBA structures translate pointers and decode the pret item layout", () => {
  const bytes = new Uint8Array(128);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x08000040, true);
  view.setUint16(64 + 14, 25, true);
  view.setUint16(64 + 16, 1200, true);
  bytes[64 + 18] = 7;
  bytes[64 + 19] = 3;
  view.setUint32(64 + 20, 0x08000020, true);
  bytes[64 + 24] = 2;
  bytes[64 + 25] = 1;
  bytes[64 + 26] = 4;
  bytes[64 + 27] = 6;
  view.setUint32(64 + 28, 0x08000030, true);
  bytes[64 + 32] = 1;
  view.setUint32(64 + 36, 0x08000034, true);
  bytes[64 + 40] = 9;
  const memory = new GbaMemory(bytes);
  assert.equal(memory.pointer(0), 64);
  const item = GbaItem.read(memory, 64, () => "POTION");
  assert.deepEqual({name: item.name, itemId: item.itemId, price: item.price, description: item.description, pocket: item.pocket},
    {name: "POTION", itemId: 25, price: 1200, description: 32, pocket: 4});
  assert.equal(item.exitsBagOnUse, true);
  assert.equal(item.battleUseFunc, 52);
});

test("GB/GBC structures translate banked pointers and BCD item prices", () => {
  const bytes = new Uint8Array(0x10000);
  bytes.set([0x00, 0x42, 0x00], 0x5000);
  const memory = new GbcMemory(bytes);
  assert.equal(memory.banked(2, 0x4567), 0x8567);
  const items = new GbcItemCatalog(memory, {namesOffset: 0x4000, pricesOffset: 0x5000, count: 1, decodeText: () => "POKE BALL"});
  assert.equal(items.get(0).price, 4200);
});

test("GBA map-event structures expose typed warps and registry discovery", () => {
  const bytes = new Uint8Array(128);
  const view = new DataView(bytes.buffer);
  bytes.set([0, 1, 0, 0], 0);
  view.setUint32(8, 0x08000040, true);
  view.setInt16(64, 12, true);
  view.setInt16(66, -3, true);
  bytes.set([2, 4, 7, 1], 68);
  const memory = new GbaMemory(bytes);
  const events = GbaMapEvents.expand(memory, GbaMapEvents.read(memory, 0));
  assert.deepEqual({x:events.warpEntries[0].x,y:events.warpEntries[0].y,map:events.warpEntries[0].mapNum,group:events.warpEntries[0].mapGroup},{x:12,y:-3,map:7,group:1});
  assert.ok(GbaStructureRegistry.list().includes("overworldSprite"));
  assert.equal(GbaStructureRegistry.get("mapHeader"), GbaMapHeader);
});

test("GBA map layouts resolve typed primary and secondary tileset headers", () => {
  const bytes=new Uint8Array(0x500),memory=new GbaMemory(bytes),view=new DataView(bytes.buffer),pointer=offset=>GbaMemory.ROM_BASE+offset;
  view.setInt32(0,20,true);view.setInt32(4,12,true);
  for(const [field,target] of [[8,0x80],[12,0x90],[16,0x100],[20,0x180]])view.setUint32(field,pointer(target),true);
  const writeTileset=(offset,{compressed,secondary,base})=>{
    bytes[offset]=Number(compressed);bytes[offset+1]=Number(secondary);
    for(const [field,target] of [[4,base],[8,base+0x20],[12,base+0x40],[16,base+0x60],[20,base+0x80]])view.setUint32(offset+field,pointer(target),true);
  };
  writeTileset(0x100,{compressed:false,secondary:false,base:0x200});
  writeTileset(0x180,{compressed:true,secondary:true,base:0x280});
  const layout=GbaMapLayout.read(memory,0,{deep:true});
  assert.equal(GbaTilesetHeader,GbaTileset);
  assert.deepEqual([layout.width,layout.height,layout.primaryTileset,layout.secondaryTileset],[20,12,0x100,0x180]);
  assert.deepEqual(
    [layout.primaryTilesetData.isCompressed,layout.primaryTilesetData.isSecondary,layout.primaryTilesetData.tiles,layout.primaryTilesetData.palettes],
    [false,false,0x200,0x220]
  );
  assert.deepEqual(
    [layout.secondaryTilesetData.isCompressed,layout.secondaryTilesetData.isSecondary,layout.secondaryTilesetData.metatiles,layout.secondaryTilesetData.callback],
    [true,true,0x2c0,0x300]
  );
  const fireRed=GbaTileset.read(memory,0x100,{frlg:true});
  assert.deepEqual([fireRed.metatileAttributes,fireRed.callback],[0x280,0x260]);
  bytes[24]=3;bytes[25]=2;
  const fireRedLayout=GbaMapLayout.read(memory,0,{frlg:true});
  assert.deepEqual([layout.borderWidth,layout.borderHeight,fireRedLayout.borderWidth,fireRedLayout.borderHeight],[2,2,3,2]);
  assert.equal(GbaStructureRegistry.get("tilesetHeader"),GbaTilesetHeader);
});

test("GBA maps render the native repeating border behind connected layouts",async()=>{
  const editor=await read("js/map/editor-map.js"),model=await read("js/map/map.js"),structures=await read("js/structures/gba/map.js");
  assert.match(structures,/borderWidth:frlg\?m\.u8\(o\+24\):2/);
  assert.match(structures,/borderHeight:frlg\?m\.u8\(o\+25\):2/);
  assert.ok(model.includes("setBorderSize(width,height)"));
  assert.ok(editor.includes("createPatternWindow()"));
  assert.ok(editor.includes("renderRepeatingPattern(ctx)"));
  assert.ok(editor.includes('ctx.createPattern(tile,"repeat")'));
  assert.ok(editor.indexOf("this.renderRepeatingPattern(ctx)")<editor.indexOf("this.neighbourhood(ctx)"));
});

test("GBA metatile attributes preserve RSE and FRLG bit layouts exactly", () => {
  const bytes=new Uint8Array(16),memory=new GbaMemory(bytes),view=new DataView(bytes.buffer);
  view.setUint16(0,0xa5bc,true);
  const rse=GbaMetatileAttribute.read(memory,0);
  assert.deepEqual({raw:rse.raw,behavior:rse.behavior,layer:rse.layerType,stride:rse.stride},{raw:0xa5bc,behavior:0xbc,layer:0xa,stride:2});
  const rseRaw=GbaMetatileAttribute.encode(rse,{behavior:0x12,layerType:3});
  assert.equal(rseRaw,0x3512);
  GbaMetatileAttribute.write(memory,rse,rseRaw);assert.equal(memory.u16(0),0x3512);

  view.setUint32(4,0xffffffff,true);
  const frlg=GbaMetatileAttribute.read(memory,4,{frlg:true});
  assert.deepEqual(
    [frlg.behavior,frlg.terrain,frlg.attribute2,frlg.attribute3,frlg.encounterType,frlg.attribute5,frlg.layerType,frlg.attribute7,frlg.stride],
    [0x1ff,0x1f,0xf,0x3f,7,3,3,1,4]
  );
  assert.equal(GbaMetatileAttribute.encode(frlg,{behavior:0}),0xfffffe00);
  const blank={raw:0,frlg:true},all=GbaMetatileAttribute.encode(blank,{behavior:0x1ff,terrain:0x1f,attribute2:0xf,attribute3:0x3f,encounterType:7,attribute5:3,layerType:3,attribute7:1});
  assert.equal(all,0xffffffff);
  assert.throws(()=>GbaMetatileAttribute.encode(rse,{behavior:256}),/Behavior/);
  assert.equal(GbaStructureRegistry.get("metatileAttribute"),GbaMetatileAttribute);
});

test("GB/GBC object blocks join warps, signs, and variable object records", () => {
  const bytes = new Uint8Array(64);
  bytes.set([5,1,8,9,2,3,1,4,6,7,1,9,12,11,1,2,3],0);
  const block = GbcMapObjectBlock.read(new GbcMemory(bytes),0);
  assert.equal(block.border,5);
  assert.deepEqual(block.warps[0],Object.freeze({offset:2,y:8,x:9,destinationWarpId:2,destinationMap:3}));
  assert.equal(block.backgrounds[0].textId,7);
  assert.equal(block.objects[0].spriteId,9);
});

test("ROM families keep separate lazy structure registries", async () => {
  const reader = await read("js/rom_reader.js");
  assert.doesNotMatch(reader, /(?:gba|gbc)\/registry\.js/);
  assert.match(await read("js/rom/runtime/gba.js"), /gba\/registry\.js/);
  assert.match(await read("js/rom/runtime/gbc.js"), /gbc\/registry\.js/);
  assert.doesNotMatch(await read("js/structures/gba/registry.js"), /Gbc/);
  assert.doesNotMatch(await read("js/structures/gbc/registry.js"), /Gba/);
  assert.equal(PokemonViewer.structures.registries.gba,GbaStructureRegistry);
  assert.equal(PokemonViewer.structures.registries.gbc,GbcStructureRegistry);
  assert.equal(PokemonViewer.structures.registries.gen2,Gen2StructureRegistry);
  assert.equal(PokemonViewer.structures.gba.tilesetHeader,GbaTilesetHeader);
  assert.equal(PokemonViewer.structures.gbc.mapObjects,GbcMapObjectBlock);
  assert.equal(PokemonViewer.structures.gen2.mapAttributes,Gen2MapAttributes);
  assert.equal(PokemonViewer.structures.gba.mapAttributes,undefined);
  for(const registry of Object.values(PokemonViewer.structures.registries))assert.equal(typeof registry.createOverworldSpriteCatalog,"function");
  const gbaRuntime=await read("js/rom/runtime/gba.js"),gbcRuntime=await read("js/rom/runtime/gbc.js"),gen2Runtime=await read("js/rom/runtime/gen2.js");
  assert.match(gbaRuntime,/PokemonViewer\.structures\.registries\.gba/);
  assert.match(gbcRuntime,/PokemonViewer\.structures\.registries\.gbc/);
  assert.match(gen2Runtime,/PokemonViewer\.structures\.registries\.gen2/);
  assert.doesNotMatch(await read("js/map/gen2/editor.js"),/Gen2StructureRegistry\.create/);
  assert.match(await read("js/map/editor-map.js"),/self\.readStructure\("tilesetHeader",offset,\{frlg:self\.isFRLG\(\)\}\)/);
});

test("map selections normalize drag direction and enumerate every cell", () => {
  const selection=new MapSelection({x:4,y:5}).update({x:2,y:3});
  assert.deepEqual(selection.bounds,{left:2,top:3,right:4,bottom:5});
  assert.equal(selection.width,3);
  assert.equal(selection.height,3);
  assert.equal(selection.cells().length,9);
});

test("block picker exposes independent primary and secondary tabs", async () => {
  const html=await read("map.html");
  assert.match(html,/data-tileset="0"[^>]*>Primary/);
  assert.match(html,/data-tileset="1"[^>]*>Secondary/);
});

test("general UI windows provide controls and reusable content primitives", async () => {
  const source=await read("js/core/ui-window.js");
  for(const contract of ["toggleMinimize","toggleMaximize","setContent","setFooter","removeRedundantCloseActions","static properties","static tabs","static checkbox","static button"]){
    assert.ok(source.includes(contract),`missing UiWindow contract: ${contract}`);
  }
  assert.match(source,/uiwindowchange/);
  assert.match(source,/const retained=\[\.\.\.this\.element\.children\]/);
  assert.match(source,/this\.content\.append\(\.\.\.retained\)/);
  assert.match(source,/const headerExtras=oldHeader/);
  assert.match(source,/\.\.\.headerExtras/);
  assert.match(source,/const titleId=oldTitle\?\.id\|\|oldHeader\?\.id/);
  assert.match(source,/label==="close"\|\|label==="cerrar"/);
  assert.doesNotMatch(await read("js/map/event-inspector.js"),/UiWindow\.button\("Close"/);
  assert.match(await read("doc/UX_GUIDELINES.md"),/exactly one close action/);
  assert.match(await read("index.html"),/js\/core\/ui-window\.js/);
});

test("editor headers are configurable and map windows stay editor-specific", async () => {
  const source=await read("js/core/editor-header.js");
  for(const contract of ["setMenus","children","shortcut","checked","disabled","action"]){
    assert.ok(source.includes(contract),`missing EditorHeader contract: ${contract}`);
  }
  const init=await read("js/init.js"),registry=await read("js/core/editor-descriptor-registry.js");
  assert.match(init,/View[\s\S]*Windows/);
  assert.match(init,/refreshEvents:\["uiwindowchange"\]/);
  assert.match(registry,/for\(const event of descriptor\.refreshEvents\)element\.addEventListener/);
  assert.match(await read("js/map/window-manager.js"),/entry\.window\.show\(\)[\s\S]*entry\.window\.hide\(\)/);
  assert.match(init,/\["Blocks","Tools"\]/);
  assert.doesNotMatch(init,/\["Tileset","Tools","Events"\]/);
  assert.match(await read("js/map/workspace.js"),/class MapWorkspace/);
  assert.match(await read("map.html"),/class="[^"]*editor_area[^"]*editor-shell[^"]*" id="map_editor"/);
});

test("editor headers recalculate asynchronous history and pending-action state", async () => {
  const header=await read("js/core/editor-header.js"),init=await read("js/init.js"),commands=await read("js/core/command-stack.js");
  assert.match(header,/\["editorpreferencechange","editorhistorychange","editorpendingchange"\]/);
  assert.match(header,/addEventListener\(event,\(\)=>this\.render\(\)\)/);
  assert.match(commands,/new CustomEvent\("editorhistorychange"/);
  assert.match(init,/disabled:\(\)=>!romEditor\?\.project_commands\?\.done\.length/);
  assert.match(init,/disabled:\(\)=>!romEditor\?\.project_commands\?\.undone\.length/);
});

test("GB editors rerender hex after the hidden-workspace initialization race", async () => {
  const init=await read("js/init.js");
  assert.match(init,/requestAnimationFrame/);
  assert.match(init,/activate:project=>project\.hex_editor\?\.go\?\.\(project\.hex_editor\.current\)/);
  assert.match(init,/setGbGameBases\(metadata\.gbc_roms\)/);
  assert.match(await read("index.html"),/GB, GBC, or GBA game/);
});

test("GBA and GB/GBC runtime code is split and loaded by detected family", async () => {
  const reader=await read("js/rom_reader.js");
  assert.match(reader,/rom\/runtime\/\$\{runtimeName\}\.js/);
  assert.doesNotMatch(reader,/js\/map\/editor-map\.js/);
  const gba=await read("js/rom/runtime/gba.js");
  const gbc=await read("js/rom/runtime/gbc.js");
  assert.match(gba,/structures\/gba\/registry\.js/);
  assert.match(gba,/js\/map\/editor-map\.js/);
  assert.doesNotMatch(gba,/structures\/gbc/);
  assert.match(gbc,/structures\/gbc\/registry\.js/);
  assert.doesNotMatch(gbc,/structures\/gba|js\/map\/editor-map\.js/);
});

test("Battle Editor is a shared lazy viewer with isolated family drivers", async () => {
  const html=await read("battle.html"),shared=await read("js/battle/editor.js"),library=await read("js/battle/library.js"),gba=await read("js/rom/runtime/gba.js"),gbc=await read("js/rom/runtime/gbc.js"),gen2=await read("js/rom/runtime/gen2.js"),init=await read("js/init.js"),reader=await read("js/rom_reader.js");
  assert.match(html,/id="battle_canvas"/);
  assert.match(html,/id="battle_trainer_canvas"/);
  assert.match(html,/class="battle-scene battle-scene--trainer"/);
  assert.match(html,/class="battle-scene battle-scene--pokemon"/);
  assert.match(shared,/class BattleEditor/);
  assert.match(shared,/trainer:new BattlePreview/);
  assert.match(shared,/pokemon:new BattlePreview/);
  assert.match(shared,/this\.scene\("intro"\)/);
  assert.match(shared,/this\.scene\("battle"\)/);
  assert.match(shared,/root\.battle\|\|\(root\.battle=\{\}\)/);
  assert.match(library,/new DriverRegistry\("Battle"\)/);
  assert.match(gba,/battle\/gba\/driver\.js/);
  assert.match(gbc,/battle\/gbc\/driver\.js/);
  assert.match(gen2,/battle\/gen2\/driver\.js/);
  assert.match(init,/battle_editor[^\n]+families:\["gba","gb"\]/);
  assert.match(reader,/this\.battle_editor/);
  assert.doesNotMatch(shared,/GbaBattleDriver|GbcBattleDriver|Gen2BattleDriver/);
});

test("battle HUD binary decoders remain isolated behind the shared registry",async()=>{
  const [registry,gba,gbc,gbaRuntime,gbcRuntime]=await Promise.all([
    read("js/battle/hud-assets.js"),read("js/battle/gba/hud-assets.js"),read("js/battle/gbc/hud-assets.js"),
    read("js/rom/runtime/gba.js"),read("js/rom/runtime/gbc.js")
  ]);
  assert.match(registry,/class BattleHudRegistry/);
  assert.doesNotMatch(registry,/GbaLz77|GbaSpriteCodec|BattleHudTiles1|HpBarAndStatusGraphics/);
  assert.match(gba,/GbaLz77/);assert.match(gba,/GbaSpriteCodec/);
  assert.match(gba,/partyStatus\(count=0/);
  assert.match(gba,/element=slot<occupied\?66:67/);
  assert.doesNotMatch(gba,/BattleHudTiles1|HpBarAndStatusGraphics/);
  assert.match(gbc,/BattleHudTiles1/);assert.match(gbc,/HpBarAndStatusGraphics/);
  assert.match(gbc,/PokeballTileGraphics/);
  assert.match(gbc,/partyBallBase/);
  assert.match(gbc,/partyStatus\(count=0/);
  assert.doesNotMatch(gbc,/GbaLz77|GbaSpriteCodec/);
  assert.match(gbaRuntime,/battle\/gba\/hud-assets\.js\?v=6/);
  assert.doesNotMatch(gbaRuntime,/battle\/gbc\/hud-assets/);
  assert.match(gbcRuntime,/battle\/gbc\/hud-assets\.js\?v=5/);
  assert.doesNotMatch(gbcRuntime,/battle\/gba\/hud-assets/);
});

test("Gen I Battle renders verified ROM Pokémon pictures and resolved trainer teams",async()=>{
  const [driver,runtime,guide]=await Promise.all([
    read("js/battle/gbc/driver.js"),read("js/rom/runtime/gbc.js"),read("doc/BATTLE_EDITOR.md")
  ]);
  assert.match(runtime,/sprite\/codecs\/gbc-2bpp\.js\?v=3/);
  assert.match(runtime,/battle\/gbc\/driver\.js\?v=28/);
  assert.match(driver,/name:"Verified ROM battle scene"/);
  assert.match(driver,/this\.speciesData\.frontSprite\(species,base\)/);
  assert.match(driver,/this\.speciesData\.backSprite\(species,base\)/);
  assert.match(driver,/const scale=back\?2:1/);
  assert.match(driver,/Math\.ceil\(\(7-picture\.width\)\/2\)\*8/);
  assert.match(driver,/opponent:Object\.freeze\(\{x:96,y:0,width:56,height:56\}\)/);
  assert.match(driver,/bounds:GEN1_LAYOUT\.opponent/);
  assert.match(driver,/toBattleTrainer\(document,\{sprites:true\}\)/);
  assert.match(driver,/trainerData\.classDocument\(classId\)/);
  assert.match(driver,/Gen1PicCodec\.decode\(this\.memory,trainerClass\.pictureOffset\)/);
  assert.match(driver,/GbcSpriteCodec\.decodeTile\(source,tile\*16\)/);
  assert.match(driver,/this\.compactStatic=true/);
  assert.match(driver,/opponent\?\.species\|\|trainer\?\.party\?\.\[0\]\?\.species/);
  assert.match(driver,/playerId=enemyId/);
  assert.match(driver,/elements:\[/);assert.match(driver,/encounter\(/);
  assert.match(driver,/partyStatus\(trainer\.party\.length/);
  assert.match(driver,/trainer-party/);
  assert.match(await read("js/battle/party-view.js"),/battle-trainer-portrait/);
  assert.match(await read("js/battle/editor.js"),/selectOpponent\(index\)/);
  const gba=await read("js/battle/gba/driver.js"),preview=await read("js/battle/preview.js");
  assert.match(gba,/opponent\?\.species\|\|trainer\?\.party\?\.\[0\]\?\.species/);
  assert.match(gba,/playerSpecies=enemySpecies/);
  assert.match(gba,/layout:"gen3"/);assert.match(driver,/layout:"gen1"/);
  assert.match(preview,/hud\(scene\)/);assert.match(preview,/scene\.hud\.enemy/);
  const gbaSprites=await read("js/battle/gba/sprites.js"),gbaAssets=await read("js/core/gba-rom-assets.js");
  assert.match(gbaAssets,/monsterFrontCoords:0x300d38/);assert.match(gbaAssets,/monsterBackCoords:0x3021d8/);
  assert.match(gbaAssets,/enemyMonElevation:0x305dcc/);
  assert.match(gbaSprites,/const size=this\.memory\.u8\(offset\),yOffset=this\.memory\.u8\(offset\+1\)/);
  assert.match(gbaSprites,/width=\(size>>4\)\*8,height=\(size&15\)\*8/);
  assert.match(gba,/opponentCenter:Object\.freeze\(\{x:176,y:40\}\)/);
  assert.match(gba,/playerCenter:Object\.freeze\(\{x:72,y:80\}\)/);
  assert.match(gba,/y:center\.y\+coords\.yOffset-elevation-32/);
  assert.match(gba,/enemy:\{x:144,y:8,width:64,height:64,image:portrait\.canvas\}/);
  assert.match(driver,/opponent:Object\.freeze\(\{x:96,y:0,width:56,height:56\}\)/);
  assert.match(driver,/player:Object\.freeze\(\{x:8,y:40,width:56,height:56\}\)/);
  assert.match(gba,/partyStatus\(trainer\.party\.length/);
  assert.match(gbaAssets,/ballStatusBar:0xd8fbf0/);
  assert.match(gbaAssets,/ballDisplayPalette:0xc11bbc/);
  assert.match(driver,/canvasSize=back\?64:56/);assert.match(driver,/Math\.ceil\(\(7-picture\.width\)\/2\)\*8/);
  assert.match(driver,/count:picture\.width\*picture\.height,columns:picture\.width/);
  assert.match(driver,/return this\.speciesSprite\(internalId,side\)/);
  assert.match(driver,/sourceEncoding:"Gen I picture compression → native 2bpp tiles"/);
  assert.doesNotMatch(driver,/compressed battle sprite and palette tables have not yet been decoded/);
  assert.match(guide,/exact compressed front and back/);
});

test("Emerald Battle resolves trainer graphics lazily and isolates malformed native resources",async()=>{
  const [driver,sprites,trainers,runtime,reader,index]=await Promise.all([
    read("js/battle/gba/driver.js"),read("js/battle/gba/sprites.js"),read("js/battle/gba/trainer-sprites.js"),
    read("js/rom/runtime/gba.js"),read("js/rom_reader.js"),read("index.html")
  ]);
  assert.match(driver,/listTrainers\(\)[^]*toBattleTrainer\(record,\{sprites:false\}\)/);
  assert.match(driver,/if\(!sprites\)return\{\}/);
  assert.match(driver,/this\.trainerSprites\.source\(record\.trainerPic\)/);
  assert.match(driver,/Trainer picture \$\{trainer\.trainerPic\} could not be decoded/);
  assert.match(sprites,/decodedBytes\(record,label,minimum\)/);
  assert.match(sprites,/did not decode to the required/);
  assert.match(trainers,/source\(id\)/);
  assert.match(runtime,/battle\/gba\/sprites\.js\?v=13/);
  assert.match(runtime,/battle\/gba\/trainer-sprites\.js\?v=2/);
  assert.match(runtime,/battle\/gba\/driver\.js\?v=38/);
  assert.match(driver,/GbaTrainerContract\.resolve\(reader\)/);
  assert.doesNotMatch(driver,/reader\.type==="emerald"/);
  assert.match(driver,/this\.trainerData\.contract\.id/);
  assert.match(reader,/runtimeName\}\.js\?v=53/);
  assert.match(index,/rom_reader\.js\?v=61/);
});

test("native game fonts are reusable resources with isolated GBA and GB/GBC decoders",async()=>{
  const [library,gba,gbc,gbaRuntime,gbcRuntime,preview]=await Promise.all([
    read("js/fonts/library.js"),read("js/fonts/gba/decoder.js"),read("js/fonts/gbc/decoder.js"),
    read("js/rom/runtime/gba.js"),read("js/rom/runtime/gbc.js"),read("js/battle/preview.js")
  ]);
  assert.match(library,/class GameFontRegistry/);
  assert.doesNotMatch(library,/0x64c2e4|0x11a80|family==="gba"/);
  assert.match(gba,/class GbaGameFont/);assert.match(gba,/512\*64/);assert.match(gba,/fontNormalWidths/);
  assert.match(gba,/register\("gba-small"/);assert.match(gba,/fontSmallWidths/);
  assert.doesNotMatch(gba,/0x11a80|GbcGameFont/);
  assert.match(gbc,/class GbcGameFont/);assert.match(gbc,/this\.profile\.require\("FontGraphics"\)/);
  assert.doesNotMatch(gbc,/0x11a80/);
  assert.doesNotMatch(gbc,/fontNormalLatin|GbaGameFont/);
  assert.match(gbaRuntime,/js\/fonts\/gba\/decoder\.js\?v=5/);
  assert.doesNotMatch(gbaRuntime,/js\/fonts\/gbc\/decoder/);
  assert.match(gbcRuntime,/js\/fonts\/gbc\/decoder\.js\?v=5/);
  assert.doesNotMatch(gbcRuntime,/js\/fonts\/gba\/decoder/);
  assert.match(preview,/scene\.hudFont\|\|scene\.font/);assert.match(preview,/font\.draw\(this\.ctx/);assert.match(preview,/Verified \$\{scene\.layout\} battle scene has no native ROM font/);
});

test("verified FireRed Rev 1 native font tables remain in the GBA profile",async()=>{
  const assets=await read("js/core/gba-rom-assets.js");
  assert.match(assets,/fire_red:\{[^}]*fontNormalLatin:0x1f3100[^}]*fontNormalWidths:0x1fb100/);
  assert.match(assets,/\["monsterPics","monsterBackPics","monsterPalettes","fontNormalLatin","fontNormalWidths"/);
});

test("Sprite speech-box composition reuses the active ROM font instead of a browser font",async()=>{
  const [registry,compositor,editor,gba,gbc]=await Promise.all([
    read("js/fonts/library.js"),read("js/sprite/compositor.js"),read("js/sprite/editor.js"),
    read("js/sprite/gba/compositor.js"),read("js/sprite/gbc/compositor.js")
  ]);
  assert.match(registry,/get\(reader,family\)/);
  assert.match(editor,/Compositors\.create\(this\.reader\.spriteCompositorId/);
  assert.match(gba,/registry\.get\(reader,"gba"\)/);assert.match(gbc,/registry\.get\(reader,"gbc"\)/);
  assert.match(compositor,/font\.draw/);
  assert.doesNotMatch(compositor,/family\s*===|family\s*==/);
  assert.doesNotMatch(compositor,/ctx\.font|fillText\(/);
});

test("Sprite Editor validates and scopes its complete markup contract before using classList",async()=>{
  const [editor,gba,gbc,gen2]=await Promise.all([
    read("js/sprite/editor.js"),read("js/rom/runtime/gba.js"),
    read("js/rom/runtime/gbc.js"),read("js/rom/runtime/gen2.js")
  ]);
  assert.match(editor,/this\.root\.querySelector\(`#\$\{id\}`\)/);
  assert.match(editor,/catalogElement\?\.closest\("label"\)/);
  assert.match(editor,/variantElement\?\.closest\("label"\)/);
  assert.match(editor,/Sprite Editor markup is missing required controls/);
  assert.match(await read("sprite.html"),/id="sprite_view_dock"[^]*id="sprite_views"[^]*id="sprite_flip_x"/);
  for(const runtime of [gba,gbc,gen2])assert.match(runtime,/sprite\/editor\.js\?v=\d+/);
  assert.match(gba,/sprite\/gba\/compositor\.js\?v=1/);
  assert.match(gbc,/sprite\/gbc\/compositor\.js\?v=1/);
  assert.match(gen2,/sprite\/gen2\/compositor\.js\?v=1/);
});

test("Sprite Editor Pokémon group owns family-specific native catalogs",async()=>{
  const [editor,gba,gbc,gen2,gbaRuntime,gbcRuntime,gen2Runtime]=await Promise.all([
    read("js/sprite/editor.js"),
    read("js/sprite/gba/pokemon-catalog.js"),read("js/sprite/gbc/pokemon-catalog.js"),read("js/sprite/gen2/pokemon-catalog.js"),
    read("js/rom/runtime/gba.js"),read("js/rom/runtime/gbc.js"),read("js/rom/runtime/gen2.js")
  ]);
  assert.match(editor,/this\.catalogs=Object\.freeze\(\{overworld:catalog,pokemon:pokemonCatalog,\.\.\.resourceCatalogs\}\)/);
  assert.match(editor,/this\.populateCatalog\(this\.catalogs\[group\]\)/);
  assert.match(gba,/GbaSpeciesData/);assert.match(gba,/side==="back"\?"Back":"Front"/);assert.match(gba,/label:\s*"Menu icon"/);
  assert.doesNotMatch(gba,/PokemonViewer\.battle|GbaMonsterSpriteCatalog/);
  assert.match(gbc,/Gen1SpeciesData/);assert.match(gbc,/frontSprite/);assert.match(gbc,/backSprite/);
  assert.match(gen2,/Gen2SpeciesData/);assert.match(gen2,/label:"Normal"/);assert.match(gen2,/label:"Shiny"/);
  assert.match(gbaRuntime,/sprite\/gba\/pokemon-catalog\.js\?v=2/);
  assert.match(gbcRuntime,/sprite\/gbc\/pokemon-catalog\.js\?v=1/);
  assert.match(gen2Runtime,/sprite\/gen2\/pokemon-catalog\.js\?v=1/);
});

test("Sprite Battle scene exposes ROM-backed items and refreshes both mounted and source views",async()=>{
  const [html,sprite,battle]=await Promise.all([
    read("sprite.html"),read("js/sprite/editor.js"),read("js/battle/editor.js")
  ]);
  assert.match(html,/id="sprite_composition_item"/);
  assert.match(sprite,/await this\.reader\.ensureWorkspace\("battle_editor"\)/);
  assert.match(sprite,/populateCompositionItems\(elements/);
  assert.match(sprite,/selectCompositionItem\(index\)/);
  assert.match(sprite,/this\.group==="battle"\)this\.scheduleCompositionRefresh/);
  assert.match(sprite,/listen\(document,"romgraphicschange",\(\)=>this\.refreshComposition\(\)\)/);
  assert.match(battle,/listen\(document,"romgraphicschange",\(\)=>\{this\.renderParty\(\);this\.render\(\);\}\)/);
});

test("Gen I battle composition follows pokered's 20x18 HUD and text tilemap",async()=>{
  const [driver,hud,preview,trainers]=await Promise.all([
    read("js/battle/gbc/driver.js"),read("js/battle/gbc/hud-assets.js"),
    read("js/battle/preview.js"),read("js/core/gen1-trainers.js")
  ]);
  assert.match(driver,/player:Object\.freeze\(\{x:8,y:40,width:56,height:56\}\)/);
  assert.match(driver,/opponentHud:GEN1_HUD\.opponent\.bounds/);
  assert.match(driver,/playerHud:GEN1_HUD\.player\.bounds/);
  assert.match(hud,/bounds:Object\.freeze\(\{x:0,y:0,width:96,height:32\}\)/);
  assert.match(hud,/bounds:Object\.freeze\(\{x:72,y:56,width:88,height:40\}\)/);
  assert.match(hud,/this\.drawHpBar\(context,player\?8:16,16\)/);
  assert.match(hud,/this\.profile\.require\(name\)/);
  assert.match(hud,/this\.textboxBase=root\("TextBoxGraphics",512\)/);
  assert.doesNotMatch(hud,/\?\?0x(?:12080|11ea0|12288|3a97e)/);
  assert.match(hud,/put\(0x79,0,12\)/);assert.match(hud,/put\(0x7e,19,17\)/);
  assert.match(hud,/nameBaseX:8,nameY:0,nameWidth:80/);
  assert.match(hud,/levelX:40,levelY:8,levelWidth:24/);
  assert.match(hud,/if\(!statusLabel\(state\.status\)\)context\.drawImage\(this\.tile\(0x6e\)/);
  assert.match(hud,/if\(bits&0x40\)return"PAR"/);
  assert.match(driver,/length<=2\?0:length<=4\?8:16/);
  assert.match(preview,/item\.status&&!item\.statusInImage&&text\.statusX!=null/);
  assert.doesNotMatch(preview,/nameX=enemy\?|levelX=enemy\?/);
  assert.match(trainers,/replace\(\/@\.\*\$\/,""\)/);
});

test("Emerald battle HUD text follows battle_interface OBJ tile positions",async()=>{
  const [driver,preview,hud]=await Promise.all([
    read("js/battle/gba/driver.js"),read("js/battle/preview.js"),read("js/battle/gba/hud-assets.js")
  ]);
  assert.match(driver,/const GBA_HUD=ns\.gba\.HudLayout\.single/);
  assert.match(hud,/nameX:20,nameY:17,nameWidth:56/);
  assert.match(hud,/nameX:142,nameY:75,nameWidth:56/);
  assert.match(hud,/bounds:Object\.freeze\(\{x:12,y:14,width:128,height:32\}\)/);
  assert.match(hud,/bounds:Object\.freeze\(\{x:126,y:72,width:128,height:64\}\)/);
  assert.match(hud,/bar:Object\.freeze\(\{x:24,y:16\}\)/);
  assert.match(hud,/bar:Object\.freeze\(\{x:32,y:16\}\)/);
  assert.match(hud,/status:Object\.freeze\(\{x:8,y:16,battler:1,paletteIndex:13\}\)/);
  assert.match(hud,/status:Object\.freeze\(\{x:16,y:24,battler:0,paletteIndex:12\}\)/);
  assert.match(hud,/sleep:Object\.freeze\(\{player:27,opponent:77/);
  assert.match(hud,/exp:Object\.freeze\(\{x:32,y:32\}\)/);
  assert.match(driver,/statusInImage:Boolean\(status\)/);
  assert.match(preview,/font\.drawGlyphs\(ctx,\[text\.levelGlyph,\.\.\.font\.ids\(level\)\]/);
  assert.match(preview,/this\.clippedText\(scene,String\(item\.name/);
  assert.match(preview,/this\.wrappedLayer\(/);
  assert.match(preview,/this\.layer\(scene\.backgroundCanvas,0,0,scene\.backgroundCanvas\.width,scene\.backgroundCanvas\.height,forLayer\("background"\)\)/);
  assert.doesNotMatch(preview,/drawImage\(scene\.backgroundCanvas,0,0,width,height\)/);
});

test("Emerald monster coordinates use the retail agbcc MonCoords ABI stride",async()=>{
  const sprites=await read("js/battle/gba/sprites.js");
  assert.match(sprites,/const MON_COORDS_STRIDE=4/);
  assert.match(sprites,/const offset=table\+species\*MON_COORDS_STRIDE/);
  assert.match(sprites,/assertRange\(offset,MON_COORDS_STRIDE\)/);
  assert.match(sprites,/padding=this\.memory\.u16\(offset\+2\)/);
  assert.match(sprites,/padding!==0/);
});

test("Gen I Pokédex uses canonical progression documents for evolution lines",async()=>{
  const [driver,progression,runtime]=await Promise.all([
    read("js/pokedex/gbc/driver.js"),read("js/core/gen1-moves.js"),read("js/rom/runtime/gbc.js")
  ]);
  assert.match(driver,/this\.progression\.canonicalDocuments\(\)/);
  assert.doesNotMatch(driver,/this\.progression\.list\(\)/);
  assert.match(progression,/canonicalDocuments\(\)/);
  assert.match(runtime,/pokedex\/gbc\/driver\.js\?v=13/);
});

test("Crystal trainer parties use exact typed records across Map, Battle and Move workspaces",async()=>{
  const [model,battle,map,moves,runtime,capabilities]=await Promise.all([
    read("js/core/gen2-trainers.js"),read("js/battle/gen2/driver.js"),read("js/map/gen2/editor.js"),
    read("js/moves/gen2/driver.js"),read("js/rom/runtime/gen2.js"),read("js/core/capability-manifest.js")
  ]);
  assert.match(model,/class Gen2TrainerData/);
  assert.match(model,/TRAINERTYPE|FORMATS/);
  assert.match(model,/static CLASS_COUNT=67/);
  assert.match(battle,/this\.trainerData\.trainers/);
  assert.match(battle,/toBattleTrainer\(document,\{sprites:false\}\)/);
  assert.match(battle,/toBattleTrainer\(document,\{sprites:true\}\)/);
  assert.match(battle,/editPartyMon\(trainer,index,values,stack\)/);
  const battleEditor=await read("js/battle/editor.js");
  assert.match(battleEditor,/BattleTrainerRepository/);
  assert.match(battleEditor,/trainerRepository\.resolve\(value\)/);
  assert.match(map,/trainerReference\(event\)/);
  assert.match(map,/EditorLinks\.battle\(\{trainer/);
  assert.match(moves,/owner\?\.type==="party-member"/);
  assert.match(moves,/Gen2TrainerSpriteCatalog/);
  assert.match(await read("js/sprite/gen2/trainer-catalog.js"),/native Crystal LZ/);
  assert.match(runtime,/core\/gen2-trainers\.js\?v=3/);
  assert.match(runtime,/sprite\/gen2\/trainer-catalog\.js\?v=1/);
  assert.match(runtime,/battle\/gen2\/driver\.js\?v=6/);
  assert.match(capabilities,/541 bounded records/);
});

test("Crystal Encounter Editor uses exact grass, water, fishing, tree, rock, Contest, roamer and static records",async()=>{
  const [html,model,editor,driver,runtime,capabilities,init,reader]=await Promise.all([
    read("encounters.html"),read("js/core/gen2-encounters.js"),read("js/encounters/editor.js"),
    read("js/encounters/gen2/driver.js"),read("js/rom/runtime/gen2.js"),
    read("js/core/capability-manifest.js"),read("js/init.js"),read("js/rom_reader.js")
  ]);
  assert.match(html,/id="encounter_editor"/);assert.match(html,/id="encounter_time"/);assert.match(html,/id="encounter_code"/);
  assert.match(html,/data-ui-toolbar="Encounter links"/);assert.match(html,/class="[^"]*encounter-habitat[^"]*editor-shell__main[^"]*"/);
  assert.doesNotMatch(html,/id="encounter_table" size=/);
  assert.match(html,/id="encounter_table" class="encounter-method-browser"/);
  assert.doesNotMatch(html,/<select id="encounter_table"/);
  assert.match(model,/static GRASS_STRIDE=47/);assert.match(model,/static WATER_STRIDE=9/);
  assert.match(model,/\[30,30,20,10,5,4,1\]/);assert.match(model,/\[60,30,10\]/);
  assert.match(model,/STATIC_ENCOUNTERS/);assert.match(model,/0x5d/);
  assert.match(editor,/class EncounterEditor/);assert.match(editor,/encounter-method-tabs/);assert.match(editor,/encounter-method-rows/);assert.match(editor,/data-encounter-id/);
  assert.match(driver,/MemoryUtils\.replaceAll/);assert.match(driver,/codeLink/);
  assert.match(runtime,/core\/gen2-encounters\.js\?v=6/);assert.match(runtime,/encounters\/view-model\.js\?v=1/);assert.match(runtime,/encounters\/slot-view\.js\?v=2/);assert.match(runtime,/encounters\/editor\.js\?v=15/);assert.match(runtime,/encounters\/gen2\/driver\.js\?v=4/);
  assert.match(capabilities,/2,486 displayed slots/);
  assert.match(init,/id:\s*"encounter_editor"/);assert.match(init,/open:\(project,request\)=>project\.encounter_editor\?\.open/);
  assert.match(reader,/this\.gen2EncounterData=null/);
});

test("Red and Blue Encounter Editor uses isolated exact map wild records",async()=>{
  const [model,driver,runtime,capabilities,init,reader]=await Promise.all([
    read("js/core/gen1-encounters.js"),read("js/encounters/gbc/driver.js"),
    read("js/rom/runtime/gbc.js"),read("js/core/capability-manifest.js"),read("js/init.js"),read("js/rom_reader.js")
  ]);
  assert.match(model,/static MAP_COUNT=0xf8/);assert.match(model,/static SLOT_COUNT=10/);
  assert.match(model,/\[51,51,39,25,25,25,13,13,11,3\]/);
  assert.match(model,/WildDataPointers/);assert.match(model,/WildMonEncounterSlotChances/);
  assert.match(driver,/class Gen1EncounterDriver/);assert.match(driver,/MemoryUtils\.replaceAll/);
  assert.match(runtime,/core\/gen1-encounters\.js\?v=4/);assert.match(runtime,/encounters\/gbc\/driver\.js\?v=(3|4)/);
  assert.match(capabilities,/107 grass, water, fishing and static-battle documents/);
  assert.match(init,/request\.mapId/);
  assert.match(reader,/this\.gen1EncounterData=null/);
});

test("Move Editor is shared while exact GB and GBA drivers stay isolated", async () => {
  const html=await read("moves.html"),shared=await read("js/moves/editor.js"),driver=await read("js/moves/gbc/driver.js");
  const runtime=await read("js/rom/runtime/gbc.js"),capabilities=await read("js/core/capability-manifest.js"),init=await read("js/init.js"),reader=await read("js/rom_reader.js");
  assert.match(html,/id="move_list"/);assert.match(html,/id="move_references"/);assert.match(html,/id="move_profile"/);assert.match(html,/id="move_animation_open"/);assert.match(html,/data-ui-window="Preview"/);
  assert.match(html,/data-ui-toolbar="Move actions"/);assert.doesNotMatch(html,/id="move_list" size=/);
  assert.match(shared,/class MoveEditor/);assert.doesNotMatch(shared,/Gen1MoveData|GbcMoveDriver/);
  assert.match(driver,/Gen1MoveData/);assert.match(driver,/resourceGraph\(\)/);assert.match(driver,/MemoryUtils\.replace/);
  assert.match(driver,/animationLink\(move\)/);assert.match(shared,/renderProfile\(document,profile\)/);assert.match(shared,/new UiTable/);
  assert.match(runtime,/moves\/gbc\/driver\.js/);
  assert.match(capabilities,/move_editor=partial\("All 165 Red\/Blue move records/);
  const gbaDriver=await read("js/moves/gba/driver.js"),gbaRuntime=await read("js/rom/runtime/gba.js"),gbaModel=await read("js/core/gba-moves.js");
  assert.match(gbaModel,/class GbaMoveData/);assert.match(gbaModel,/memoryProfile\?\.structure\?\.\("GbaMove"\)/);assert.match(gbaDriver,/root\.moves\.registry\.register\("gba"/);
  assert.match(gbaDriver,/Generation III move changed after this command/);assert.match(gbaDriver,/GbaTrainerSpriteCatalog/);assert.match(gbaDriver,/levelUpMoves\(entry\.id\)/);
  assert.match(gbaDriver,/machineCanvas\(machine\)/);assert.match(gbaDriver,/this\.items\.machineSource\(machine\)/);assert.match(gbaRuntime,/moves\/gba\/driver\.js\?v=9/);
  assert.match(gbaDriver,/previewCanvas:this\.speciesPreview\(entry\.id\)/);
  assert.match(driver,/previewCanvas:this\.speciesPreview\(dex\)/);
  assert.match(gbaDriver,/GbaTrainerContract\.resolve\(reader\)/);assert.doesNotMatch(gbaDriver,/reader\.type==="emerald"/);
  assert.match(html,/id="move_animation_canvas"/);assert.match(html,/id="move_animation_scrubber"/);assert.match(html,/id="move_animation_reset"/);
  assert.match(capabilities,/All 354 Generation III BattleMove records/);
  assert.match(init,/id:\s*"pokedex_editor"[^]*Number\.isInteger\(request\.species\)/);
  assert.match(reader,/this\.move_editor/);
});

test("Gen I Pokédex edits the exact TM/HM bitset and Move references navigate compatible species", async () => {
  const html=await read("pokedex.html"),editor=await read("js/pokedex/editor.js"),driver=await read("js/pokedex/gbc/driver.js"),moves=await read("js/moves/gbc/driver.js");
  assert.match(html,/id="pokedex_machine_inline_edit"/);
  assert.match(editor,/editMachines\(\)/);assert.match(editor,/removeMachine\(index,label/);
  assert.match(driver,/machineFields\(entry\)/);
  assert.match(driver,/encodeMachines\(entry\.base,indexes\)/);
  assert.match(driver,/MemoryUtils\.replace/);
  assert.match(moves,/owner\?\.type==="machine"[^]*graph\.inbound\(owner\.id\)/);
  assert.match(moves,/workspace:"pokedex_editor",species:dex/);
});

test("shared Pokédex renders navigable evolution families and native GBA TM/HM editing",async()=>{
  const [markup,editor,driver,model,items,assets,runtime]=await Promise.all([
    read("pokedex.html"),read("js/pokedex/editor.js"),read("js/pokedex/gba/driver.js"),
    read("js/core/gba-species.js"),read("js/core/gba-items.js"),read("js/core/gba-rom-assets.js"),read("js/rom/runtime/gba.js")
  ]);
  assert.match(markup,/id="pokedex_evolution_line"/);assert.match(markup,/id="pokedex_machine_list"/);assert.match(markup,/data-ui-window-footer/);
  assert.match(editor,/evolutionComponent\(id\)/);assert.match(editor,/data-species-id/);assert.match(editor,/renderMachines\(\)/);assert.match(editor,/data-machine-sprite/);assert.match(editor,/fa-trash-can/);
  assert.match(driver,/evolutionEdges\(\)/);assert.match(driver,/machineFields\(entry\)/);assert.match(driver,/editMachines\(entry,values,stack\)/);assert.match(driver,/this\.items\.machineSource\(machine\)/);
  assert.match(model,/EVOLUTIONS_PER_SPECIES=5/);assert.match(model,/EVOLUTION_SIZE=8/);assert.match(model,/encodeMachines\(id,indexes\)/);
  assert.match(items,/iconSource\(id\)/);assert.match(items,/machineSource\(machine\)/);
  assert.match(assets,/evolutions:0x32531c/);assert.match(assets,/tmHmLearnsets:0x31e898/);
  assert.match(runtime,/gba-species\.js\?v=11/);assert.match(runtime,/gba-moves\.js\?v=4/);assert.match(runtime,/gba-items\.js\?v=2/);assert.match(runtime,/pokedex\/editor\.js\?v=26/);assert.match(runtime,/pokedex\/gba\/driver\.js\?v=24/);
});

test("resource cards keep navigation explicit and reusable across Pokédex collections",async()=>{
  const [index,component,editor,styles]=await Promise.all([
    read("index.html"),read("js/core/ui-resource-card.js"),read("js/pokedex/editor.js"),read("scss/components/_resource-card.scss")
  ]);
  assert.match(index,/core\/ui-resource-card\.js\?v=1/);
  assert.match(component,/class UiResourceCard/);assert.match(component,/static action/);assert.match(component,/actions=\[\]/);
  assert.match(component,/aria-label/);assert.match(component,/ui-resource-card__actions/);
  assert.match(editor,/UiResourceCard\.create/);assert.match(editor,/fa-eye/);assert.match(editor,/data-move-id/);
  assert.match(editor,/className:"pokedex-evolution-card"/);assert.match(editor,/data-species-id/);
  assert.match(styles,/focus-within/);assert.match(styles,/ui-resource-card__action--danger/);
});

test("Gen I CryData is editable from Sound and Pokédex through the shared exact writer", async()=>{
  const [species,sound,soundEditor,pokedex,soundMarkup,pokedexMarkup,runtime]=await Promise.all([
    readFile("js/core/gen1-species.js","utf8"),
    readFile("js/sound/gen1/driver.js","utf8"),
    readFile("js/sound/editor.js","utf8"),
    readFile("js/pokedex/gbc/driver.js","utf8"),
    readFile("sound.html","utf8"),
    readFile("pokedex.html","utf8"),
    readFile("js/rom/runtime/gbc.js","utf8")
  ]);
  assert.match(species,/static encodeCry/);
  assert.match(species,/cryEditPlan/);
  assert.match(sound,/editable:true/);
  assert.match(sound,/CryData changed after this command/);
  assert.match(soundEditor,/metadata\?\.dexNumber/);
  assert.match(pokedex,/editCry\(entry,values,stack\)/);
  assert.match(soundMarkup,/id="sound_edit"/);
  assert.match(pokedexMarkup,/id="pokedex_cry"/);
  assert.match(runtime,/generic-driver\.js\?v=15/);
  assert.match(runtime,/sound\/source-catalog\.js\?v=2/);
  assert.match(runtime,/sound\/gen1\/driver\.js\?v=1/);
  assert.match(runtime,/sound\/map-music-catalog\.js\?v=1/);
  assert.match(runtime,/sound\/waveform\.js\?v=2/);
  assert.match(runtime,/sound\/audition\.js\?v=3/);
  assert.match(runtime,/sound\/editor\.js\?v=26/);
  assert.doesNotMatch(soundEditor,/AppSettings/);
  for(const runtimePath of ["js/rom/runtime/gbc.js","js/rom/runtime/gen2.js"]){
    const runtime=await read(runtimePath);
    assert.match(runtime,/js\/sound\/generic-driver\.js\?v=15/);
    assert.match(runtime,/js\/sound\/source-catalog\.js\?v=2/);
    assert.match(runtime,/js\/sound\/map-music-catalog\.js\?v=1/);
    assert.match(runtime,/js\/sound\/waveform\.js\?v=2/);
    assert.match(runtime,/js\/sound\/audition\.js\?v=3/);
    assert.match(runtime,/js\/sound\/editor\.js\?v=26/);
  }
  assert.match(soundEditor,/globalThis\.editorPreferences\?\.experience/);
  const settings=await readFile("js/core/settings.js","utf8");
  assert.match(settings,/global\.AppSettings=global\.editorPreferences/);
});

test("GBA Sound isolates exact M4A songs and profile-owned Generation III CryData",async()=>{
  const [runtime,driver,wave,shared,model,manifest]=await Promise.all([
    read("js/rom/runtime/gba.js"),read("js/sound/gba/driver.js"),read("js/core/gba-wave-data.js"),read("js/sound/generic-driver.js"),read("js/core/gba-species.js"),read("manifests/generated/gen3-emerald.json")
  ]);
  assert.match(runtime,/sound\/gba\/driver\.js\?v=7/);assert.match(runtime,/gba-wave-data\.js\?v=3/);assert.match(runtime,/gba-species\.js\?v=11/);
  assert.match(driver,/class GbaM4aDecoder/);
  assert.match(driver,/songTable/);assert.match(driver,/songCount/);assert.match(driver,/MPlayDef/);
  assert.match(driver,/sourceRepository\(\)/);assert.match(driver,/sourceGame\(\)/);
  assert.match(driver,/Species-to-cry table → gCryTable ToneData/);
  assert.match(driver,/GbaWaveData\.decode/);assert.match(wave,/class GbaWaveData/);assert.match(wave,/new Float32Array\(size\)/);assert.match(wave,/MAX_SAMPLES=0x100000/);assert.match(wave,/sampleRate:frequency\/1024/);
  assert.match(model,/cryId\(id\)/);assert.match(model,/CRY_TONE_SIZE=12/);assert.match(model,/WaveData pointer/);
  assert.match(manifest,/gSpeciesIdToCryId/);assert.match(manifest,/gCryTable/);
  assert.doesNotMatch(driver,/memoryOffsets\.song/);
  assert.doesNotMatch(shared,/class GbaSoundDriver/);
});

test("pret audio catalog names map music without hard-coded runtime labels",()=>{
  const catalog=PokemonViewer.sound.sourceCatalog;
  assert.equal(catalog.gen1.maps.length,248);
  assert.equal(catalog.gen1.songs.length,206);
  assert.equal(catalog.gen2.songs.length,103);
  assert.equal(catalog.gen2.sfx.length,207);
  assert.equal(catalog.gba.songs.length,479);
  assert.equal(catalog.gba.groups.length,34);
  assert.equal(catalog.gba.groups.reduce((total,group)=>total+group.maps.length,0),518);
  assert.equal(catalog.gen1.maps[0].map,"PALLET_TOWN");
  assert.equal(catalog.gen2.songs[1].symbol,"MUSIC_TITLE");
  assert.equal(catalog.gen2.sfx[0].symbol,"SFX_DEX_FANFARE_50_79");
  assert.equal(catalog.gba.groups[0].maps[0].name,"PetalburgCity");
});

test("Gen I map music documents aggregate every MapSongBanks owner",()=>{
  const maps=PokemonViewer.sound.sourceCatalog.gen1.maps,bytes=new Uint8Array(maps.length*2);
  maps.forEach((_,index)=>{bytes[index*2]=index%4;bytes[index*2+1]=index%2;});
  const reader={memory:new RomMemory(bytes),memoryProfile:{symbol:name=>name==="MapSongBanks"?{offset:0,bank:0}:null}};
  const documents=new PokemonViewer.sound.MapMusicCatalog(reader,"gbc").list();
  assert.equal(documents.reduce((total,document)=>total+document.references.length,0),248);
  assert.equal(documents[0].metadata.group,"map");
  assert.equal(documents[0].references[0].label,"Pallet Town");
});

test("GBA and Crystal animation decoders execute native call and return flow",()=>{
  const gbaBytes=new Uint8Array(0x80),gba=Object.create(PokemonViewer.animation.GbaAnimationDriver.prototype);
  gba.memory=new GbaMemory(gbaBytes);
  gbaBytes.set([0x0e,0x40,0x00,0x00,0x08,0x04,0x02,0x08],0x20);
  gbaBytes.set([0x04,0x03,0x0f],0x40);
  assert.deepEqual(gba.decode(0x20).map(command=>command.label),["call","delay","return","delay","end"]);

  const crystalBytes=new Uint8Array(0x8000),crystal=Object.create(PokemonViewer.animation.Gen2AttackAnimationDriver.prototype);
  crystal.memory=new GbcMemory(crystalBytes);crystal.table={bank:1};
  crystalBytes.set([0xfe,0x10,0x41,0x02,0xff],0x4100);
  crystalBytes.set([0x03,0xff],0x4110);
  assert.deepEqual(crystal.decode(0x4100).map(command=>command.label),["call","Wait","ret","Wait","ret"]);
});

test("GBA createsprite preserves native battler, subpriority and signed callback arguments",()=>{
  const bytes=new Uint8Array(0x80),driver=Object.create(PokemonViewer.animation.GbaAnimationDriver.prototype);
  driver.memory=new GbaMemory(bytes);
  bytes.set([
    0x02,0x50,0x00,0x00,0x08,0x82,0x04,
    0xf8,0xff,0x04,0x00,0x01,0x00,0x02,0x00,
    0x08
  ],0x20);
  const command=driver.decode(0x20)[0];
  assert.equal(command.label,"createsprite");
  assert.equal(command.native.animBattler,"target");
  assert.equal(command.native.subpriorityOffset,-2);
  assert.deepEqual(command.native.values,[0xfff8,4,1,2]);
  assert.match(command.source,/target -2/);
});

test("Sound workspace prioritizes the arrangement and keeps raw commands advanced",async()=>{
  const [markup,editor,audition,waveform,styles]=await Promise.all([read("sound.html"),read("js/sound/editor.js"),read("js/sound/audition.js"),read("js/sound/waveform.js"),read("scss/editors/_sound.scss")]);
  assert.match(markup,/class="[^"]*sound-sidebar[^"]*editor-shell__library[^"]*"/);
  assert.match(markup,/class="[^"]*sound-primary[^"]*editor-shell__main[^"]*"/);
  assert.match(markup,/class="sound-arrangement"/);
  assert.match(markup,/class="[^"]*sound-inspector[^"]*editor-attributes[^"]*"/);
  assert.match(markup,/class="[^"]*sound-commands[^"]*editor-support[^"]*"[^>]*data-complexity="advanced"/);
  assert.match(markup,/id="sound_edit_form"/);assert.match(markup,/id="sound_stop"/);assert.match(markup,/id="sound_accuracy"/);
  assert.match(markup,/id="sound_playback"/);assert.match(markup,/id="sound_zoom_fit"/);assert.match(markup,/id="sound_timeline_scroller"/);
  assert.match(markup,/<header data-ui-window-header><strong id="sound_visual_title">Waveform<\/strong><span id="sound_accuracy"/);
  assert.match(editor,/Sound Editor markup is missing required controls/);
  assert.match(editor,/new FormData\(this\.elements\.editForm\)/);assert.match(editor,/data-complexity/);assert.doesNotMatch(editor,/AppDialog\.form/);
  assert.match(editor,/ns\.SoundAudition\.play/);assert.match(editor,/ns\.SoundAudition\.stop/);assert.doesNotMatch(editor,/PokemonViewer\.pokedex/);
  assert.match(editor,/playbackState\(\)/);assert.match(editor,/Native audio/);assert.match(editor,/Program decoded/);assert.match(editor,/Reference only/);
  assert.match(editor,/waveform:this\.detail\.waveform/);assert.doesNotMatch(editor,/parameterSamples\(this\.active/);
  assert.match(audition,/class SoundAudition/);assert.match(audition,/ns\.SoundAudition=SoundAudition/);assert.match(audition,/createBufferSource/);assert.match(audition,/copyToChannel/);assert.match(audition,/waveform\.sampleRate/);assert.doesNotMatch(audition,/createOscillator/);
  assert.match(waveform,/class SoundWaveform/);assert.doesNotMatch(waveform,/parameterSamples/);assert.match(waveform,/static arrangement/);
  assert.match(waveform,/activeTrack/);
  assert.match(markup,/class="[^"]*sound-stage[^"]*editor-shell__stage--document[^"]*"/);
  assert.doesNotMatch(markup,/id="sound_cue" size=/);
});

test("Gen I Pokédex edits verified Base Stats without touching pointers, machines, or padding",async()=>{
  const [model,driver,guide,runtime]=await Promise.all([
    readFile("js/core/gen1-species.js","utf8"),
    readFile("js/pokedex/gbc/driver.js","utf8"),
    readFile("doc/POKEDEX_EDITOR.md","utf8"),
    readFile("js/rom/runtime/gbc.js","utf8")
  ]);
  assert.match(model,/static encodeBase/);
  assert.match(model,/baseEditPlan\(species,values\)/);
  assert.match(driver,/baseFields\(entry\)/);
  assert.match(driver,/editBase\(entry,values,stack\)/);
  assert.match(driver,/sprite dimensions\/pointers, TM\/HM bytes and padding remain byte-identical/);
  assert.match(guide,/five battle stats/i);
  assert.equal((runtime.match(/js\/core\/gen1-species\.js\?v=7/g)||[]).length,8);
  assert.doesNotMatch(runtime,/js\/core\/gen1-species\.js\?v=[^7]/);
  assert.match(runtime,/js\/pokedex\/gbc\/driver\.js\?v=13/);
});

test("Gen I Pokédex edits evolution and learnset records with ownership-aware bank safety",async()=>{
  const [model,driver,runtime]=await Promise.all([
    readFile("js/core/gen1-moves.js","utf8"),
    readFile("js/pokedex/gbc/driver.js","utf8"),
    readFile("js/rom/runtime/gbc.js","utf8")
  ]);
  assert.match(model,/encodeProgression\(/);
  assert.match(model,/progressionPlan\(internalId,values\)/);
  assert.match(model,/owners\(offset\)/);
  assert.match(model,/Keep the compiled record within its/);
  assert.match(driver,/progressionFields\(entry\)/);
  assert.match(driver,/editProgression\(entry,values,stack\)/);
  assert.equal((runtime.match(/js\/core\/gen1-moves\.js\?v=8/g)||[]).length,6);
  assert.doesNotMatch(runtime,/js\/core\/gen1-moves\.js\?v=[^8]/);
  assert.match(runtime,/js\/pokedex\/gbc\/driver\.js\?v=13/);
});

test("Gen I Pokédex renders exact front and native-scale back sprites through one shared selector",async()=>{
  const [model,driver,editor,markup]=await Promise.all([
    readFile("js/core/gen1-species.js","utf8"),
    readFile("js/pokedex/gbc/driver.js","utf8"),
    readFile("js/pokedex/editor.js","utf8"),
    readFile("pokedex.html","utf8")
  ]);
  assert.match(model,/backSprite\(species/);
  assert.match(model,/back-sprite/);
  assert.match(model,/nativeScale:2/);
  assert.match(driver,/spriteSides\(\)/);
  assert.match(driver,/side==="back"/);
  assert.match(editor,/this\.driver\.sprite\(this\.current\.id,this\.elements\.side\.value\)/);
  assert.match(markup,/id="pokedex_sprite_side"/);
});

test("Pokédex workspace keeps its native sprite miniature and explicit cry audition separate from sound emulation",async()=>{
  const [html,editor,library]=await Promise.all([read("pokedex.html"),read("js/pokedex/editor.js"),read("js/pokedex/library.js")]);
  assert.match(html,/id="pokedex_miniature"/);assert.match(html,/id="pokedex_cry_play"/);assert.match(html,/class="pokedex-cry"/);
  assert.match(html,/class="[^"]*pokedex-primary[^"]*editor-shell__main[^"]*"/);assert.match(html,/class="pokedex-sprite-toolbar"/);
  assert.match(editor,/renderCry\(\)/);assert.match(editor,/auditionCry\(\)/);assert.match(editor,/this\.driver\.icon\?\./);assert.match(editor,/renderMiniature\(icon\)/);
  assert.match(library,/class CryAudition/);assert.match(library,/nativeSource\(context,waveform,key\)/);assert.match(editor,/not a replacement for the console audio engine/);
});

test("Crystal Pokédex and Sound load one exact shared Species document instead of placeholders",async()=>{
  const [model,progression,pokedex,sound,runtime]=await Promise.all([
    readFile("js/core/gen2-species.js","utf8"),readFile("js/core/gen2-progression.js","utf8"),
    readFile("js/pokedex/gen2/driver.js","utf8"),
    readFile("js/sound/gen2/driver.js","utf8"),readFile("js/rom/runtime/gen2.js","utf8")
  ]);
  assert.match(model,/class Gen2SpeciesData/);
  assert.match(model,/static BASE_SIZE=32/);
  assert.match(model,/static CRY_SIZE=6/);
  assert.match(model,/PokedexDataPointerTable/);
  assert.match(progression,/class Gen2MoveData/);
  assert.match(progression,/class Gen2ProgressionData/);
  assert.match(progression,/EvosAttacksPointers/);
  assert.match(progression,/EggMovePointers/);
  assert.match(pokedex,/this\.data\.document\(id\)/);
  assert.match(pokedex,/this\.progression\.document\(id\)/);
  assert.match(pokedex,/progressionFields\(entry\)/);
  assert.match(pokedex,/editProgression\(entry,values,stack\)/);
  assert.match(await readFile("pokedex.html","utf8"),/id="pokedex_progression"/);
  assert.match(pokedex,/editCry\(entry,values,stack\)/);
  assert.match(pokedex,/editBase\(entry,values,stack\)/);
  assert.doesNotMatch(pokedex,/placeholder|pointers are verified/);
  assert.match(sound,/class Gen2SoundDriver/);
  assert.match(sound,/pret\/pokecrystal PokemonCries/);
  assert.match(runtime,/sound\/gen2\/driver\.js\?v=1/);
  assert.match(runtime,/core\/gen2-species\.js\?v=5/);
  assert.match(runtime,/core\/gen2-progression\.js\?v=6/);
  assert.match(pokedex,/machineFields\(entry\)/);
  assert.match(pokedex,/encodeMachines\(entry\.base,indexes\)/);
  assert.match(await readFile("pokedex.html","utf8"),/id="pokedex_base"/);
});

test("Crystal Move Editor uses its isolated seven-byte driver and typed progression references",async()=>{
  const [model,driver,editor,runtime,capabilities]=await Promise.all([
    read("js/core/gen2-progression.js"),read("js/moves/gen2/driver.js"),read("js/moves/editor.js"),
    read("js/rom/runtime/gen2.js"),read("js/core/capability-manifest.js")
  ]);
  assert.match(model,/memoryProfile\?\.structure\?\.\("Gen2Move"\)/);
  assert.match(model,/encode\(move,values=/);
  assert.match(driver,/class Gen2MoveDriver/);
  assert.match(driver,/root\.moves\.registry\.register\("gen2"/);
  assert.match(driver,/Crystal Move record changed after this command/);
  assert.match(driver,/owner\?\.type==="learnset"/);
  assert.match(driver,/owner\?\.type==="egg-moves"/);
  assert.match(editor,/driver\.editMessage/);
  assert.match(runtime,/moves\/gen2\/driver\.js\?v=8/);
  assert.match(driver,/previewCanvas:this\.speciesPreview\(speciesId\)/);
  assert.match(driver,/owner\?\.type==="machine"/);
  assert.match(capabilities,/All 251 Crystal seven-byte Move records/);
});

test("sprite editor uses shared UI with isolated GB/GBC and GBA codecs", async () => {
  const shared=await read("js/sprite/editor.js");
  const gba=await read("js/sprite/codecs/gba-4bpp.js");
  const gbc=await read("js/sprite/codecs/gbc-2bpp.js");
  assert.match(shared,/class SpriteEditor/);
  assert.match(shared,/selectSource\(catalogId,title\)/);assert.match(shared,/data-linked-source/);
  assert.doesNotMatch(shared,/GbaSpriteCodec|GbcSpriteCodec/);
  assert.match(gba,/bytesPerTile:32/);
  assert.match(gbc,/bytesPerTile:16/);
  assert.doesNotMatch(gba,/Gbc/);
  assert.doesNotMatch(gbc,/Gba/);
  assert.match(await read("js/rom/runtime/gba.js"),/sprite\/codecs\/gba-4bpp\.js/);
  assert.match(await read("js/rom/runtime/gbc.js"),/sprite\/codecs\/gbc-2bpp\.js/);
  assert.match(await read("js/init.js"),/sprite_editor[^\n]+families:\["gba","gb"\]/);
});

test("Sprite Editor header controls shared zoom and pixel/tile grid rendering", async () => {
  const editor=await read("js/sprite/editor.js"),init=await read("js/init.js"),registry=await read("js/core/editor-descriptor-registry.js");
  assert.match(editor,/setZoom\(value\)[^]*zoomBy\(delta\)[^]*canZoom\(delta\)/);
  assert.match(editor,/toggleGrid\(force=!this\.showGrid\)/);
  assert.match(editor,/renderGrid\(width,height,zoom\)[^]*x=8[^]*y=8/);
  assert.match(editor,/CustomEvent\("spriteviewchange"/);
  assert.match(init,/Zoom in[^]*zoomBy\?\.\(1\)/);
  assert.match(init,/Zoom out[^]*zoomBy\?\.\(-1\)/);
  assert.match(init,/Pixel \/ tile grid[^]*toggleGrid\?\.\(\)/);
  assert.match(init,/refreshEvents:\["spriteviewchange"\]/);assert.match(registry,/addEventListener\(event,\(\)=>header\.render\(\)\)/);
  assert.doesNotMatch(init,/Sprite canvas",checked:true,disabled:true/);
});

test("overworld sprite catalogs expose verified GBA and Gen I resources", async () => {
  const classicBytes=new Uint8Array(0x10000),classicMemory=new GbcMemory(classicBytes),classicTable=0x200;
  for(let index=0;index<60;index++){
    const entry=classicTable+index*4;classicBytes.set([0x00,0x50,0xc0,1],entry);
  }
  const classic=new GbcOverworldSpriteCatalog(classicMemory);
  assert.equal(classic.tableOffset,classicTable);
  assert.equal(classic.list().length,60);
  const classicSource=classic.source(1);
  assert.equal(classicSource.views.length,4);
  assert.deepEqual(
    (({offset,count,columns,editable})=>({offset,count,columns,editable}))(classicSource.views[2]),
    {offset:0x5080,count:4,columns:2,editable:true}
  );

  const gbaBytes=new Uint8Array(0x1000),gbaMemory=new GbaMemory(gbaBytes),view=new DataView(gbaBytes.buffer),pointer=value=>GbaMemory.ROM_BASE+value;
  view.setUint32(0x100,pointer(0x200),true);
  view.setUint16(0x202,2,true);view.setUint16(0x206,0x80,true);view.setUint16(0x208,16,true);view.setUint16(0x20a,16,true);gbaBytes[0x20c]=7;
  for(const field of [0x210,0x214,0x218,0x21c,0x220])view.setUint32(field,pointer(0x300),true);
  view.setUint32(0x21c,pointer(0x400),true);
  view.setUint32(0x400,pointer(0x700),true);view.setUint16(0x404,0x80,true);
  for(let index=0;index<0x80;index++)gbaBytes[0x700+index]=index&0xff;
  view.setUint32(0x500,pointer(0x600),true);view.setUint16(0x504,2,true);view.setUint16(0x600,0x001f,true);
  const gba=new GbaOverworldSpriteCatalog({memory:gbaMemory,memoryOffsets:{sprite_header:0x100,sprite_palette:0x500}});
  assert.equal(gba.list().length,1);
  assert.equal(gba.list()[0].info.paletteTag,2);
  assert.equal(gba.list()[0].info.paletteSlot,7);
  assert.equal(gba.palette(2).colors[0],"#ff0000");
  const gbaSource=gba.source(0);
  assert.deepEqual((({offset,count,columns,editable})=>({offset,count,columns,editable}))(gbaSource),{offset:0x700,count:4,columns:2,editable:true});
  assert.deepEqual(gbaSource.bytes,gbaBytes.slice(0x700,0x780));
  assert.equal(GraphicSource.resolve(gbaMemory,{...gbaSource,colorCount:16}).verified,true);
  view.setUint16(0x404,31,true);assert.throws(()=>gba.source(0),/no valid native frame images/);view.setUint16(0x404,0x80,true);
  // ObjectEventGraphicsInfo.size is a VRAM allocation and can be larger than
  // the native width×height 4bpp frame (for example Emerald's player).
  view.setUint16(0x206,0x100,true);
  assert.equal(gba.source(0).count,4);
  assert.doesNotMatch(await read("js/structures/gba/sprite.js"),/Decompressor|compressedOffset|compressedSize/);

  const html=await read("sprite.html"),editor=await read("js/sprite/editor.js"),gbRuntime=await read("js/rom/runtime/gbc.js"),gbaRuntime=await read("js/rom/runtime/gba.js");
  assert.match(html,/id="sprite_catalog"/);assert.match(editor,/populateCatalog/);assert.match(editor,/openCatalog/);
  assert.match(gbRuntime,/structureRegistry\.createOverworldSpriteCatalog\(reader\.memory\)/);
  assert.match(gbaRuntime,/structureRegistry\.createOverworldSpriteCatalog\(reader\)/);
});

test("Crystal catalog resolves the complete native overworld sprite table", async () => {
  const bytes=new Uint8Array(0x10000),memory=new Gen2Memory(bytes),table=0x200;
  for(let index=0;index<102;index++)bytes.set([0x00,0x50,index%3?12:4,1,index%3+1,index%8],table+index*6);
  const catalog=new Gen2OverworldSpriteCatalog(memory);
  assert.equal(catalog.tableOffset,table);
  assert.equal(catalog.list().length,102);
  assert.deepEqual(
    (({offset,count,columns,title,editable})=>({offset,count,columns,title,editable}))(catalog.source(1)),
    {offset:0x5000,count:4,columns:2,title:"Chris",editable:true}
  );
  assert.equal(catalog.source(2).views.length,4);
  assert.equal(catalog.source(2).views[0].palette.length,4);
  const runtime=await read("js/rom/runtime/gen2.js"),map=await read("js/map/gen2/editor.js");
  assert.match(runtime,/structureRegistry\.createOverworldSpriteCatalog\(reader\.memory\)/);assert.match(map,/getOverworldSprite/);
  assert.match(map,/PokemonViewer\.maps\.overlays\.marker\(context,\{x,y,type,sprite\}\)/);assert.match(map,/label:"Open sprite"/);
});

test("code editor uses a shared disassembler with isolated CPU codecs", async () => {
  const shared=await read("js/code/editor.js");
  const gba=await read("js/code/codecs/gba-arm.js");
  const gbc=await read("js/code/codecs/gbc-lr35902.js");
  assert.match(shared,/class CodeEditor/);
  assert.doesNotMatch(shared,/GbaCodeCodec|GbcCodeCodec/);
  assert.match(shared,/CodeMirror/);
  assert.match(gba,/ARM7TDMI/);
  assert.match(gba,/Thumb \(16-bit\)/);
  assert.match(gbc,/LR35902/);
  assert.doesNotMatch(gba,/Gbc/);
  assert.doesNotMatch(gbc,/Gba/);
  assert.match(await read("js/rom/runtime/gba.js"),/code\/codecs\/gba-arm\.js/);
  assert.match(await read("js/rom/runtime/gbc.js"),/code\/codecs\/gbc-lr35902\.js/);
  assert.match(await read("js/init.js"),/code_workspace[^\n]+families:\["gba","gb"\]/);
  assert.match(await read("js/util/file.js"),/cache:\s*"no-store"/);
});

test("CodeMirror is mandatory and application failures use the managed notification center", async () => {
  const editor=await read("js/code/editor.js"),handler=await read("js/notification/handler.js"),notice=await read("js/notification/notification.js"),styles=await read("scss/components/_notifications.scss"),init=await read("js/init.js");
  assert.match(editor,/Code Editor requires CodeMirror/);
  assert.match(editor,/requires the PUSH CodeMirror language mode/);
  assert.doesNotMatch(editor,/getValue\(\)\?\?|sourceEditor\?\.(?:getValue|setValue)/);
  assert.match(handler,/class NotificationCenter/);
  assert.match(handler,/error\(title,error/);
  assert.match(handler,/persistent=type===NotificationType\.ERROR/);
  assert.match(handler,/dismiss\(id\)/);
  assert.doesNotMatch(handler,/notifiaction/);
  assert.match(notice,/class AppNotification/);
  assert.doesNotMatch(notice,/class Notification\b/);
  assert.match(styles,/\.notification-details/);
  assert.match(init,/NotificationHandler\.error\(title,error\)/);
});

test("code editor receives only the lazy script codec for the loaded ROM family", async () => {
  const editor=await read("js/code/editor.js"),gba=await read("js/rom/runtime/gba.js"),gbc=await read("js/rom/runtime/gbc.js"),gbaScript=await read("js/code/scripts/gba-event-script.js"),gbcScript=await read("js/code/scripts/gbc-text-script.js"),init=await read("js/init.js");
  assert.match(editor,/typeof ScriptCodec!==["']function["']/);
  assert.match(editor,/new ScriptCodec\(reader\)/);
  assert.match(editor,/decompile!==["']function["'][^]*compile!==["']function["']/);
  assert.match(gba,/gba-event-script\.js\?v=8[^]*code\/editor\.js\?v=25/);
  assert.match(gba,/new CodeEditor\(reader,GbaCodeCodec,GbaScriptCodec,\{defaultScriptKind:"event"/);
  assert.doesNotMatch(gba,/gbc-text-script|GbcTextScriptCodec/);
  assert.match(gbc,/gbc-text-script\.js\?v=3[^]*code\/editor\.js\?v=25/);
  assert.match(gbc,/new CodeEditor\(reader,GbcCodeCodec,GbcTextScriptCodec,\{defaultScriptKind:"text"/);
  assert.doesNotMatch(gbc,/gba-event-script|GbaEventScriptCodec/);
  assert.doesNotMatch(gbaScript,/GEN1|GbcText|RGBDS text/);
  assert.doesNotMatch(gbcScript,/GBA|GbaEvent|trainerbattle|0x08000000/);
  assert.match(init,/Script language reference[^]*SCRIPT_LANGUAGE\.md/);
});

test("Code Editor runtimes declare semantic defaults and bookmarks preserve the active language", async () => {
  const editor=await read("js/code/editor.js"),gba=await read("js/rom/runtime/gba.js"),gbc=await read("js/rom/runtime/gbc.js"),gen2=await read("js/rom/runtime/gen2.js"),init=await read("js/init.js");
  assert.match(editor,/\{defaultScriptKind="event",scriptLabel="Event script"\}/);
  assert.match(editor,/this\.elements\.view\.value="original"/);
  assert.match(editor,/this\.open\(0,false,\{view:"original",scriptKind:this\.defaultScriptKind\}\)/);
  assert.match(gba,/defaultScriptKind:"event"[^]*scriptLabel:"Event script"/);
  assert.match(gbc,/defaultScriptKind:"text"[^]*scriptLabel:"Text script \(RGBDS\)"/);
  assert.match(gen2,/defaultScriptKind:"event"[^]*scriptLabel:"Event \/ text script"/);
  assert.match(init,/view:active\?\.viewer/);
  assert.match(init,/scriptKind:active\?\.scriptKind/);
  assert.match(init,/mode:active\?\.mode/);
  assert.match(init,/view:target\.view,scriptKind:target\.scriptKind/);
});

test("Code Editor header switches real source views without resetting tab drafts", async () => {
  const editor=await read("js/code/editor.js"),init=await read("js/init.js"),registry=await read("js/core/editor-descriptor-registry.js");
  assert.match(editor,/setView\(view\)[^]*this\.open\(offset,false,/);
  assert.match(editor,/isView\(view\).*active\?\.viewer===view/);
  assert.match(editor,/dispatchEvent\(new CustomEvent\("codeviewchange"/);
  assert.match(init,/Event \/ text source[^]*setView\?\.\("script"\)/);
  assert.match(init,/Original CPU code[^]*setView\?\.\("original"\)/);
  assert.match(init,/refreshEvents:\["codeviewchange"\]/);assert.match(registry,/addEventListener\(event,\(\)=>header\.render\(\)\)/);
  assert.doesNotMatch(init,/label:"Disassembly",checked:true,disabled:true/);
});

test("map runtimes share one workspace while keeping family codecs separate", async () => {
  const gba=await read("js/rom/runtime/gba.js");
  const gbc=await read("js/rom/runtime/gbc.js");
  const gbcEditor=await read("js/map/gbc/editor.js");
  assert.match(gba,/js\/map\/editor-map\.js/);
  assert.doesNotMatch(gba,/js\/map\/gbc\/editor\.js/);
  assert.match(gbc,/js\/map\/gbc\/editor\.js/);
  assert.doesNotMatch(gbc,/js\/map\/editor-map\.js/);
  assert.match(gbcEditor,/class GbcMapDriver/);
  assert.match(gbcEditor,/GbcMapHeader\.read/);
  assert.match(gbcEditor,/GbcMapObjectBlock\.read/);
  assert.match(gbcEditor,/GbcSpriteCodec\.decodeTile/);
  assert.match(gbcEditor,/block\*16/);
  assert.match(gbc,/maps\.createEditor/);
  assert.match(gba,/maps\.createEditor/);
  assert.match(await read("js/map/editor.js"),/class MapEditor/);
  assert.match(await read("js/map/editor-map.js"),/new MapWorkspace/);
  const windowManager=await read("js/map/window-manager.js");
  for(const contract of ["register(","enhance(","toggle(","titles(","destroy("])assert.ok(windowManager.includes(contract));
  assert.match(await read("js/map/controls.js"),/MapWindowManager\.for/);
  assert.match(gbc,/sprite\/codecs\/gbc-2bpp\.js/);
  assert.match(await read("js/init.js"),/map_editor[^\n]+families:\["gba","gb"\]/);
  const structures=await read("js/structures/gbc/map.js");
  assert.match(structures,/CONNECTION_SIZE=11/);
  assert.match(structures,/connections:Object\.freeze/);
  assert.match(structures,/direction,mapId/);
  assert.match(structures,/\[8,"north"\]/);
  assert.match(structures,/objects:c\.pointer16\(bank\)/);
  assert.match(gbcEditor,/drawEventOverlays/);
  assert.match(gbcEditor,/buildScene/);
  assert.match(gbcEditor,/while\(queue\.length&&scene\.nodes\.length<maximum\)/);
  assert.match(gbcEditor,/for\(const connection of source\.header\.connections/);
  assert.match(gbcEditor,/new MapScene/);
  assert.match(gbcEditor,/renderScene/);
  assert.match(gbcEditor,/count=128/);
  assert.match(await read("js/map/workspace.js"),/bindViewport/);
  assert.match(await read("js/map/workspace.js"),/class MapScene/);
  assert.match(gbcEditor,/drawBounds/);
  assert.match(gbcEditor,/inspectEvent/);
  assert.match(await read("js/map/editor.js"),/setSupportedTools/);
  const gbaEditor=await read("js/map/editor-map.js");
  for(const structure of ["GbaObjectEventTemplate","GbaWarpEvent","GbaCoordEvent","GbaBgEvent"])assert.match(gbaEditor,new RegExp(`${structure}\\.read`));
  assert.match(gbaEditor,/signpost\.setType/);
  assert.match(await read("js/map/event-inspector.js"),/event\.properties/);
});

test("map editor exposes a driver-based library API", async () => {
  const library=await read("js/map/library.js");
  for(const contract of ["registerDriver","createEditor","hasDriver","unregisterDriver","capabilities"]){
    assert.ok(library.includes(contract),`missing map library contract: ${contract}`);
  }
  assert.match(await read("js/rom/runtime/gba.js"),/PokemonViewer\.maps\.createEditor/);
  assert.match(await read("js/rom/runtime/gbc.js"),/PokemonViewer\.maps\.createEditor/);
  assert.match(await read("doc/MAP_LIBRARY.md"),/PokemonViewer\.maps/);
});

test("RomMap models are namespaced without shadowing JavaScript Map", async () => {
  const NativeMap=globalThis.Map;
  await import("../js/map/map.js");
  assert.equal(globalThis.Map,NativeMap);
  assert.equal(PokemonViewer.maps.RomMap,globalThis.RomMap);
  assert.equal(PokemonViewer.maps.RomConnection,globalThis.RomConnection);
  const model=new globalThis.RomMap(3,4),connection=new globalThis.RomConnection(1,-2,5,6);
  assert.deepEqual([model.getBankIndex(),model.getMapIndex()],[3,4]);
  assert.deepEqual([connection.getDirection(),connection.getOffset(),connection.getBankIndex(),connection.getMapIndex()],[1,-2,5,6]);
  const source=await read("js/map/map.js");
  assert.doesNotMatch(source,/class Map\b|globalThis\.Map\s*=/);
});

test("editor layouts contain overflow and map-only UI belongs to the map workspace", async () => {
  const mapHtml=await read("map.html"),contextMenu=await read("js/map/context-menu.js");
  assert.match(mapHtml,/id="map_contextmenu" class="hide"/);
  assert.doesNotMatch(mapHtml,/Visit map|Watch Script|map_contextmenu_subpannel/);
  assert.match(contextMenu,/this\.element\.replaceChildren\(this\.build\(\)\)/);
  assert.match(await read("js/init.js"),/map_editor"\)\?\.append\(mapContextMenu\)/);
  const layout=await read("scss/layout/_app-shell.scss");
  assert.match(layout,/max-width:\s*100%/);
  assert.match(layout,/min-height:\s*0/);
  assert.match(layout,/overflow:\s*hidden/);
  assert.match(await read("scss/layout/_responsive.scss"),/\.code-sidebar, \.sprite-sidebar/);
});

test("editor layouts respond to assigned workspace width from one shared contract", async () => {
  const shared=await read("scss/components/_editor-contract.scss");
  for(const id of ["battle_editor","sprite_editor","pokedex_editor","sound_editor","encounter_editor"]){
    assert.match(shared,new RegExp(`#${id}\\.is-editor-(?:medium|narrow)`));
  }
  for(const file of ["_battle.scss","_sprite.scss","_pokedex.scss","_sound.scss","_encounters.scss"]){
    assert.doesNotMatch(await read(`scss/editors/${file}`),/@media\(max-width:(?:900|980|1000|1050|1080|1100|1180)px\)/);
  }
  const pokedex=await read("scss/editors/_pokedex.scss");
  const sound=await read("scss/editors/_sound.scss");
  assert.match(pokedex,/#pokedex_cry_detail\{[^}]*overflow-wrap:anywhere[^}]*white-space:normal/);
  assert.match(sound,/#sound_status\{[^}]*overflow-wrap:anywhere[^}]*white-space:normal/);
  const windowStyles=await read("scss/components/_window.scss");
  assert.match(windowStyles,/\.ui-data-table__sort span\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
  assert.match(windowStyles,/\.ui-data-table__sort i\{[^}]*flex:0 0 auto/);
  assert.match(shared,/\.ui-editor-workspace\.hide\{display:none!important\}/);
  assert.match(shared,/grid-template-columns:minmax\(0,var\(--editor-main-share\)\) minmax\(0,var\(--editor-panel-share\)\)!important/);
});

test("every editor declares the shared workspace, main view, and persistent panel contract",async()=>{
  const files=["hex.html","code.html","map.html","sprite.html","battle.html","pokedex.html","moves.html","sound.html","animation.html","encounters.html","items.html","profile.html"];
  for(const file of files){
    const source=await read(file);
    assert.match(source,/class="[^"]*editor_area[^"]*"[^>]*data-editor-workspace=/,`${file} must declare its shared editor workspace`);
    assert.match(source,/data-editor-region="main"/,`${file} must identify its main editing surface`);
  }
  for(const file of files.filter(file=>!["hex.html","code.html"].includes(file))){
    assert.match(await read(file),/data-editor-region="panels"/,`${file} must identify persistent supporting panels`);
  }
  for(const file of files){
    assert.match(await read(file),/data-editor-layout="(?:surface|document|split|stack)"/,`${file} must choose a semantic editor composition`);
    assert.match(await read(file),/data-editor-frame/,`${file} must identify the frame governed by that composition`);
  }
  assert.match(await read("js/init.js"),/UiEditorWorkspace\.enhanceAll\(elements\.main\)/);
});

test("memory cursors simplify sequential typed reads and preserve position", () => {
  const bytes=new Uint8Array([1,2,0,0,0,0,0,0]);
  const memory=new RomMemory(bytes);
  const cursor=memory.cursor(0);
  assert.equal(cursor.u8(),1);
  assert.equal(cursor.u16(),2);
  assert.equal(cursor.position,3);
  cursor.align(4);
  assert.equal(cursor.position,4);
  assert.throws(()=>cursor.seek(99),RangeError);
});

test("memory readers create frozen records and fixed-stride tables", () => {
  const memory=new RomMemory(new Uint8Array([4,0,8,0]));
  const reader=memory.reader();
  const record=reader.record(0,cursor=>({value:cursor.u16()}));
  assert.equal(record.value,4);
  assert.equal(Object.isFrozen(record),true);
  assert.deepEqual(reader.table(0,2,2,cursor=>cursor.u16()),[4,8]);
});

test("bookmarks replace search and persist named editor locations", async () => {
  const html=await read("index.html"),source=await read("js/core/bookmarks.js"),dialog=await read("js/core/dialog.js"),usage=await read("doc/USAGE.md");
  assert.match(html,/id="bookmarks"/);
  assert.doesNotMatch(html,/id="searchbox"/);
  assert.match(source,/class BookmarkStore/);
  assert.match(source,/localStorage/);
  assert.match(source,/description/);
  assert.match(source,/AppDialog\.form/);
  assert.match(source,/async edit\(id\)/);
  assert.match(source,/AppDialog\.confirm/);
  assert.doesNotMatch(source,/\bprompt\s*\(/);
  assert.match(dialog,/static form\(/);
  assert.match(dialog,/checkValidity/);
  assert.match(usage,/\*\*✎\*\*/);
});

test("bookmarks retain exact project identity and reject cross-game navigation", async () => {
  const bytes=new Uint8Array(1),reader={ReadOnlyMemory:bytes,family:"gba",editorProfile:"gba",type:"emerald",lang:"en",version:0};
  const identity=ProjectIdentity.capture(reader);
  assert.deepEqual({...identity},{family:"gba",profile:"gba",game:"emerald",lang:"en",revision:"0",label:"emerald · EN · Rev 0"});
  assert.equal(ProjectIdentity.assertCompatible(identity,reader).game,"emerald");
  assert.throws(()=>ProjectIdentity.assertCompatible({...identity,game:"fire_red",label:"FireRed"},reader),/different game/);
  assert.throws(()=>ProjectIdentity.assertCompatible({...identity,revision:"1"},reader),/different revision/);
  assert.throws(()=>ProjectIdentity.assertCompatible({family:"gb"},reader),/different platform family/);
  const init=await read("js/init.js"),bookmarks=await read("js/core/bookmarks.js"),html=await read("index.html");
  assert.match(init,/project:ProjectIdentity\.capture\(romEditor\)/);
  assert.match(init,/ProjectIdentity\.assertCompatible\(target\.project/);
  assert.match(bookmarks,/bookmark-project/);
  assert.match(html,/core\/project-identity\.js/);
});

test("Sprite bookmarks preserve reconstructable references and visual state without storing ROM bytes", async () => {
  const init=await read("js/init.js"),sprite=await read("js/sprite/editor.js"),usage=await read("doc/USAGE.md"),guide=await read("doc/SPRITE_EDITOR.md");
  assert.match(init,/id:\s*"sprite_editor"[^]*capture:project=>project\.sprite_editor\?\.bookmark/);
  assert.match(init,/id:\s*"sprite_editor"[^]*restore:\(project,target\)=>project\.sprite_editor\?\.restoreBookmark/);
  assert.match(sprite,/bookmark\(\)/);
  assert.match(sprite,/restoreBookmark\(target=\{\}\)/);
  for(const field of ["catalogId","offset","count","columns","zoom","grid","paletteMode","restorable"])assert.match(sprite,new RegExp(`${field}:`));
  assert.match(sprite,/\n\s+segments,\n/);
  assert.match(sprite,/GraphicSource\.segments\(target\.segments,expected\)/);
  assert.match(sprite,/MemoryUtils\.bytes\(this\.reader\.memory,segment\.offset,segment\.length\)/);
  assert.doesNotMatch(sprite,/bookmark[^]*Array\.from\(this\.reader\.(?:ReadOnlyMemory|memory\.bytes)/);
  assert.match(usage,/Sprite bookmark restores/);
  assert.match(guide,/Bookmarks never contain copied ROM bytes/);
});

test("Map bookmarks restore the inspected typed event across GBA, Gen I, and Gen II drivers", async () => {
  const init=await read("js/init.js"),shared=await read("js/map/editor.js"),inspector=await read("js/map/event-inspector.js"),utility=await read("js/core/event-bookmark-utils.js"),gba=await read("js/map/editor-map.js"),gbc=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js"),usage=await read("doc/USAGE.md"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(inspector,/this\.current=event\|\|null/);
  assert.match(inspector,/this\.current=null;this\.window\.hide/);
  assert.match(shared,/bookmark\(\)\{return this\.driver\.bookmark/);
  assert.match(shared,/restoreBookmark\(target\)/);
  assert.match(init,/id:\s*"map_editor"[^]*capture:project=>project\.map_editor\?\.bookmark/);
  assert.match(init,/id:\s*"map_editor"[^]*restore:\(project,target\)=>project\.map_editor\?\.restoreBookmark/);
  for(const driver of [gba,gbc,gen2]){
    assert.match(driver,/eventReference\(event=this\.eventInspector\?\.current\)/);
    assert.match(driver,/EventBookmarkUtils\.create/);
    assert.match(driver,/EventBookmarkUtils\.resolve/);
    assert.match(driver,/bookmark\(\)/);
    assert.match(driver,/restoreBookmark\(target\)/);
    assert.match(driver,/bookmarked map event no longer exists or is ambiguous/);
  }
  assert.match(utility,/class EventBookmarkUtils/);
  for(const runtime of ["gba","gbc","gen2"])assert.match(await read(`js/rom/runtime/${runtime}.js`),/core\/event-bookmark-utils\.js/);
  assert.match(usage,/centers that event/);
  assert.match(guide,/restores Event\s+properties/);
});

test("EventBookmarkUtils follows a uniquely shifted event and rejects replacement or ambiguity", () => {
  const original={eventType:"Object",eventIndex:1,x:4,y:5,spriteId:7,flagId:12};
  const reference=EventBookmarkUtils.create(original);
  assert.deepEqual({...reference},{type:"Object",index:1,fingerprint:'[["flagId",12],["spriteId",7]]'});
  const moved={...original,eventIndex:0,x:20,y:21};
  assert.equal(EventBookmarkUtils.resolve([{type:"Object",index:0,event:moved}],reference).event,moved);
  const replacement={...original,spriteId:8};
  assert.equal(EventBookmarkUtils.resolve([{type:"Object",index:1,event:replacement}],reference),null);
  assert.equal(EventBookmarkUtils.resolve([{type:"Object",index:0,event:moved},{type:"Object",index:2,event:{...moved,eventIndex:2}}],reference),null);
  assert.equal(EventBookmarkUtils.resolve([{type:"Object",index:1,event:replacement}],{type:"Object",index:1}).event,replacement);
});

test("editor changes use a visible undoable command stack", async () => {
  const stack=await read("js/core/command-stack.js"),editor=await read("js/map/editor.js"),workspace=await read("js/map/workspace.js");
  for(const contract of ["execute(command)","undo()","redo()","clear()"] )assert.ok(stack.includes(contract));
  assert.match(editor,/KeyboardUtils\.command\(event\)/);
  assert.match(workspace,/className:"map-history map-sidebar-panel ui-panel"/);
  assert.match(await read("js/map/editor-map.js"),/label:`Paint block/);
});

test("project journal orders editor scopes globally without allowing local history reordering", () => {
  const journal=new CommandStack(),events=[],hex=journal.scope("hex_editor",{label:"Hex Editor",onChange:scope=>events.push(scope.done.length)}),map=journal.scope("map_editor",{label:"Map Editor"});
  let value=0;
  hex.execute({label:"Hex byte",do:()=>{value+=1;},undo:()=>{value-=1;}});
  map.execute({label:"Map block",do:()=>{value+=10;},undo:()=>{value-=10;}});
  assert.equal(value,11);
  assert.deepEqual(journal.done.map(command=>[command.owner,command.label]),[["hex_editor","Hex byte"],["map_editor","Map block"]]);
  assert.deepEqual(hex.done.map(command=>command.label),["Hex byte"]);
  assert.equal(hex.canUndo,false);assert.equal(map.canUndo,true);
  assert.throws(()=>hex.undo(),/latest project change \(Map Editor\)/);
  assert.equal(value,11);assert.equal(journal.done.length,2);
  assert.equal(map.undo(),true);assert.equal(value,1);
  assert.equal(hex.undo(),true);assert.equal(value,0);
  assert.equal(hex.redo(),true);assert.equal(value,1);
  assert.equal(map.redo(),true);assert.equal(value,11);
  assert.ok(events.length>=4);
  hex.destroy();map.destroy();
});

test("map camera and context actions share viewport coordinates", async () => {
  const workspace=await read("js/map/workspace.js"),menu=await read("js/map/context-menu.js"),gbc=await read("js/map/gbc/editor.js");
  for(const contract of ["canvasPoint(","setCanvasZoom(","centerOnCanvas("] )assert.ok(workspace.includes(contract));
  assert.match(menu,/contextAt/);
  assert.match(menu,/runContextAction/);
  assert.match(gbc,/new MapContextMenu/);
  assert.match(gbc,/workspace\.canvasPoint/);
  assert.match(await read("js/camera.js"),/closest\("\.map-viewport"\)/);
});

test("code patches and event associations use the common editor UI", async () => {
  const code=await read("js/code/editor.js"),inspector=await read("js/map/event-inspector.js"),init=await read("js/init.js");
  assert.match(code,/assembleSource/);
  assert.match(code,/byte\|hword\|word/);
  assert.match(code,/this\.commands\.execute/);
  assert.match(inspector,/UiWindow\.table/);
  assert.match(inspector,/EditorLinks\.code/);
  assert.match(init,/New object/);
  assert.doesNotMatch(init,/Open ROM…/);
});

test("Code Editor preserves independent dirty drafts across tabs", async () => {
  const editor=await read("js/code/editor.js"),html=await read("code.html"),styles=await read("scss/editors/_code.scss"),guide=await read("doc/CODE_EDITOR.md"),gba=await read("js/rom/runtime/gba.js"),gbc=await read("js/rom/runtime/gbc.js");
  assert.match(html,/id="code_revert"/);
  assert.match(html,/id="code_apply"[^>]*disabled/);
  assert.match(editor,/tab\.draft/);
  assert.match(editor,/tab\.generated/);
  assert.match(editor,/tab\.dirty/);
  assert.match(editor,/modified draft/);
  assert.match(editor,/revertDraft\(\)/);
  assert.match(editor,/this\.elements\.apply\.disabled=!dirty/);
  assert.match(styles,/\.code-source-actions/);
  assert.match(html,/class="[^"]*code-editor-split[^"]*editor-shell__main[^"]*"/);
  assert.match(html,/class="code-source-pane"/);
  assert.match(html,/class="code-disassembly-pane"/);
  assert.doesNotMatch(html,/<h2>Disassembly<\/h2>/);
  assert.match(gba,/js\/code\/editor\.js\?v=25/);
  assert.match(gbc,/js\/code\/editor\.js\?v=25/);
  assert.match(guide,/Switching to another script[^]*no longer discards edits/);
  assert.match(guide,/Apply\/Revert controls are[^]*Nerd-only/);
});

test("editor switching preserves state and map selection focuses the chosen map", async () => {
  const gbaRuntime=await read("js/rom/runtime/gba.js"),gbcRuntime=await read("js/rom/runtime/gbc.js");
  assert.match(gbaRuntime,/if\(reader\.code_editor\)return/);
  assert.match(gbaRuntime,/if\(reader\.sprite_editor\)return/);
  assert.match(gbcRuntime,/if\(reader\.map_editor\)return/);
  assert.match(gbcRuntime,/if\(reader\.code_editor\)return/);
  assert.match(gbcRuntime,/if\(reader\.sprite_editor\)return/);
  assert.doesNotMatch(gbcRuntime,/map_editor\)\{reader\.map_editor\.refresh/);
  const gbc=await read("js/map/gbc/editor.js"),gba=await read("js/map/editor-map.js");
  assert.match(gbc,/if\(item\.id===this\.current\?\.id\)\{this\.focusCurrent\(\);this\.redraw\(\);return;\}/);
  assert.match(gbc,/this\.editor\.navigate\(\(\)=>this\.select\(item\.id,\{focus:true\}\)\)/);
  assert.match(gbc,/focusCurrent/);
  assert.match(gbc,/focusZoom/);
  assert.match(gba,/focusMap\(map/);
});

test("event scripts decompile to XSE-like commands and safely round-trip", () => {
  const bytes=new Uint8Array([0x6a,0x5a,0x0f,0x00,0x20,0x01,0x00,0x08,0x09,0x06,0x6c,0x02]);
  const reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)};
  const codec=new GbaEventScriptCodec(reader),result=codec.decompile(0);
  assert.match(result.source,/lock\nfaceplayer/);
  assert.match(result.source,/msgbox 0x000120, 0x06/);
  assert.match(result.source,/release\nend/);
  assert.deepEqual(codec.compile(result.source),bytes);
});

test("GBA event text links open an editable terminator-safe text codec", () => {
  const bytes=new Uint8Array(0x400),memory=new GbaMemory(bytes),dictionary=[];
  dictionary[0xbb]="A";dictionary[0xbc]="B";dictionary[0xff]="[e]";
  bytes.set([0x67,0x00,0x01,0x00,0x08,0x02],0);
  bytes.set([0xbb,0xbc,0xff],0x100);
  const reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory,textDictionary:"text",getDictionary:()=>dictionary,getTextByOffset:()=> "AB"};
  const event=new GbaScriptCodec(reader).decompile(0,{kind:"event"});
  assert.equal(event.links.length,1);assert.equal(event.links[0].offset,0x100);
  assert.deepEqual(event.links[0].reference,{kind:"gba32",pointerOffset:1});
  const codec=new GbaScriptCodec(reader),text=codec.decompile(0x100,{kind:"text"});
  assert.match(text.source,/text "AB"/);assert.equal(text.bytes,3);
  assert.deepEqual(codec.compile(text.source,{kind:"text"}),Uint8Array.of(0xbb,0xbc,0xff));
  assert.throws(()=>codec.compile('text "?"',{kind:"text"}),/not available/);
});

test("GBA event flow links retain the exact 32-bit owner pointer", () => {
  const bytes=new Uint8Array(0x400),memory=new GbaMemory(bytes);
  bytes.set([0x04,0x00,0x01,0x00,0x08,0x06,0x01,0x20,0x01,0x00,0x08,0x02],0);
  bytes[0x100]=0x02;bytes[0x120]=0x02;
  const reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory},result=new GbaEventScriptCodec(reader).decompile(0);
  assert.deepEqual(result.links.map(link=>[link.kind,link.offset,link.reference]),[
    ["event",0x100,{kind:"gba32",pointerOffset:1}],
    ["event",0x120,{kind:"gba32",pointerOffset:7}]
  ]);
  assert.match(result.links[0].label,/call/);assert.match(result.links[1].label,/goto_if/);
});

test("GBA event decompilation follows nearby forward goto blocks without losing intervening bytes",()=>{
  const bytes=new Uint8Array(0x40),memory=new GbaMemory(bytes);
  bytes.set([0x69,0x05,0x10,0x00,0x00,0x08],0);
  bytes.set([0xaa,0xbb,0xcc,0xdd,0xee,0xff,0x11,0x22,0x33,0x44],6);
  bytes.set([0x69,0x5a,0x6c,0x02],0x10);
  const reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory},codec=new GbaEventScriptCodec(reader),result=codec.decompile(0,{limit:0x20});
  assert.match(result.source,/goto 0x000010/);
  assert.match(result.source,/10 preserved bytes before script_000010/);
  assert.match(result.source,/script_000010:\nlockall\nfaceplayer\nrelease\nend/);
  assert.equal(result.bytes,0x14);
  assert.deepEqual(codec.compile(result.source),bytes.slice(0,0x14));
});

test("text tables preserve ambiguous and unknown bytes with explicit raw tokens", () => {
  const dictionary=[];dictionary[0xad]=".";dictionary[0xb8]=".";dictionary[0xbb]="A";
  const table=new TextTableCodec(dictionary),source=table.decodeLossless(Uint8Array.of(0xad,0xb8,0xbb,0x42));
  assert.equal(source,".[B8]A[42]");
  assert.deepEqual(table.encode(source),Uint8Array.of(0xad,0xb8,0xbb,0x42));
});

test("GBA runtime selects the Japanese table and shares the Western table with Spanish", async () => {
  const runtime=await read("js/rom/runtime/gba.js");
  assert.match(runtime,/text_table_en\.json/);assert.match(runtime,/text_table_jp\.json/);
  assert.match(runtime,/en:"text_table_en",es:"text_table_en",jp:"text_table_jp"/);
  const dictionary=[];dictionary[0xad]=".";dictionary[0xb8]=".";
  const bytes=new Uint8Array(0x40),memory=new GbaMemory(bytes);bytes.set([0xb8,0xff],0x10);
  const reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory,textDictionary:"text_table_jp",getDictionary:()=>dictionary};
  const codec=new GbaTextScriptCodec(reader),decoded=codec.decompile(0x10);
  assert.ok(decoded.source.includes('text "[B8]"'));
  assert.deepEqual(codec.compile(decoded.source),Uint8Array.of(0xb8,0xff));
});

test("GBA script codec preserves fixed commands, maps, movements, and variable trainer battles", () => {
  const reader={family:"gba",size:0x200,ReadOnlyMemory:new Uint8Array(0x200),memory:new RomMemory(new Uint8Array(0x200))},codec=new GbaEventScriptCodec(reader);
  const source=[
    "#org 0x000000","loadbyte 0x01, 0x02","addvar 0x4000, 0x0005","playbgm 0x0123, 0x00",
    "warp 0x02, 0x03, 0x04, 0x0005, 0x0006","applymovement 0x0007, 0x001000",
    "trainerbattle 0x02, 0x0011, 0x0000, 0x002000, 0x003000, 0x004000","end"
  ].join("\n");
  const bytes=codec.compile(source),decodedReader={...reader,size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)},decoded=new GbaEventScriptCodec(decodedReader).decompile(0);
  assert.match(decoded.source,/loadbyte 0x01, 0x02/);assert.match(decoded.source,/warp 0x02, 0x03, 0x04, 0x0005, 0x0006/);
  assert.match(decoded.source,/applymovement 0x0007, 0x001000/);assert.match(decoded.source,/trainerbattle 0x02, 0x0011, 0x0000, 0x002000, 0x003000, 0x004000/);
  assert.deepEqual(new GbaEventScriptCodec(decodedReader).compile(decoded.source),bytes);
  assert.deepEqual(codec.compile("loadbyte 1, -1\nend"),Uint8Array.of(0x10,1,0xff,0x02));
  assert.throws(()=>codec.compile("loadbyte 1, 300"),/does not fit byte/);
  assert.throws(()=>codec.compile("setvar 0x4000, 70000"),/does not fit short/);
});

test("GBA script codec covers the complete pokeemerald opcode table through 0xE2", async () => {
  const sourceCode=await read("js/code/scripts/gba-event-script.js"),opcodes=new Set([...sourceCode.matchAll(/\[0x([0-9a-f]{2}),\{name:/gi)].map(match=>parseInt(match[1],16)));
  assert.deepEqual(Array.from({length:0xe3},(_,opcode)=>opcode).filter(opcode=>!opcodes.has(opcode)),[]);
  const empty=new Uint8Array(0x400),reader={family:"gba",size:empty.length,ReadOnlyMemory:empty,memory:new RomMemory(empty)},codec=new GbaEventScriptCodec(reader);
  const source=[
    "hidemonpic","braillemessage 0x001000","givemon 0x0019, 0x05, 0x0001","giveegg 0x0085",
    "bufferstring 0x01, 0x002000","addmoney 0x12345678, 0x00","setmetatile 1, 2, 0x0200, 1",
    "createvobject 1, 2, 3, 4, 5, 6","setwildbattle 0x0096, 30, 0",
    "vcall 0x003000","setescapewarp 1, 2, 3, 4, 5","comparehiddenvar 2, 0x89ABCDEF","end"
  ].join("\n");
  const bytes=codec.compile(source),decodedReader={...reader,size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)},decodedCodec=new GbaEventScriptCodec(decodedReader),decoded=decodedCodec.decompile(0);
  assert.match(decoded.source,/givemon 0x0019, 0x05, 0x0001/);assert.match(decoded.source,/addmoney 0x12345678, 0x00/);
  assert.match(decoded.source,/comparehiddenvar 0x02, 0x89ABCDEF/);assert.deepEqual(decodedCodec.compile(decoded.source),bytes);
  const raw=codec.compile("givemon_raw 1, 2, 3, 4, 5, 6\nend"),rawReader={...reader,size:raw.length,ReadOnlyMemory:raw,memory:new RomMemory(raw)};
  assert.match(new GbaEventScriptCodec(rawReader).decompile(0).source,/givemon_raw 0x0001, 0x02, 0x0003, 0x00000004, 0x00000005, 0x06/);
});

test("unknown GBA script opcodes stop decoding before argument bytes are misidentified", () => {
  const bytes=Uint8Array.of(0xe3,0x6a,0x02),reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)},codec=new GbaEventScriptCodec(reader),result=codec.decompile(0);
  assert.equal(result.bytes,1);assert.equal(result.records.length,1);assert.equal(result.records[0].unknown,true);
  assert.match(result.source,/decoding stopped safely/);assert.deepEqual(codec.compile(result.source),Uint8Array.of(0xe3));
});

test("GBA event decoder rejects random ROM data that contains impossible semantic pointers", () => {
  const bytes=new Uint8Array(0x400000),memory=new GbaMemory(bytes);
  bytes.set([0x23,0xff,0xae,0x51,0x69],0);
  const reader={family:"gba",size:bytes.length,ReadOnlyMemory:bytes,memory};
  assert.throws(()=>new GbaEventScriptCodec(reader).decompile(0),/not valid GBA event bytecode[^]*invalid ROM pointer/);
});

test("Gen I text scripts render pret RGBDS macro names", () => {
  const bytes=new Uint8Array([0x00,0x80,0x81,0x7f,0xa0,0xa1,0x50]);
  const reader={family:"gb",size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)};
  const result=new GbcTextScriptCodec(reader).decompile(0);
  assert.match(result.source,/RGBDS text macros/);
  assert.match(result.source,/text "AB ab"/);
  assert.match(result.source,/text_end/);
  assert.deepEqual(new GbcTextScriptCodec(reader).compile(result.source),bytes);
});

test("Gen I text compiler preserves parameter widths, controls, and quoted punctuation", () => {
  const bytes=Uint8Array.of(0x01,0x34,0x12,0x02,0x78,0x56,0x9a,0x0c,0x03,0x00,0x80,0x9d,0xa0,0x4f,0x81,0xa1,0x17,0x00,0x40,0x02,0x50);
  const reader={family:"gb",size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)},codec=new GbcTextScriptCodec(reader),result=codec.decompile(0);
  assert.match(result.source,/text_ram \$1234/);
  assert.match(result.source,/text_bcd \$5678, \$9a/);
  assert.match(result.source,/text_dots \$03/);
  assert.match(result.source,/text "A;a"/);
  assert.match(result.source,/line "Bb"/);
  assert.match(result.source,/text_far \$4000, \$02/);
  assert.deepEqual(codec.compile(result.source),bytes);
  assert.throws(()=>codec.compile('text "€"\ntext_end'),/not available/);
});

test("BinaryCodecUtils centralizes little-endian reads, writes, numbers, and formatting", () => {
  const memory=new RomMemory(Uint8Array.of(0x12,0x56,0x34,0x03,0x02,0x01,0xef,0xcd,0xab,0x89));
  const decoded=BinaryCodecUtils.read(memory,0,["byte","word",3,"dword"]);
  assert.deepEqual(decoded.values,[0x12,0x3456,0x010203,0x89abcdef]);
  assert.deepEqual(decoded.offsets,[0,1,3,6]);assert.equal(decoded.cursor,10);
  const bytes=[];BinaryCodecUtils.append(bytes,["byte","word",3,"dword"],decoded.values);
  assert.deepEqual(bytes,[0x12,0x56,0x34,0x03,0x02,0x01,0xef,0xcd,0xab,0x89]);
  assert.equal(BinaryCodecUtils.format(decoded.values,["byte","word",3,"dword"]),"$12, $3456, $010203, $89abcdef");
  assert.equal(BinaryCodecUtils.number("$ff",{width:"byte"}),255);
  assert.equal(BinaryCodecUtils.number("0x1234",{width:"word"}),0x1234);
  assert.equal(BinaryCodecUtils.number("42",{width:1}),42);
  assert.throws(()=>BinaryCodecUtils.number("$100",{line:7,width:"byte"}),/Line 7.*does not fit 1 byte/);
  assert.throws(()=>BinaryCodecUtils.number("nope",{line:8}),/Line 8: invalid number/);
  assert.throws(()=>BinaryCodecUtils.append([],["byte"],[256]),/does not fit byte/);
});

test("Gen I special text scripts preserve official pokered macros without stealing digit characters", () => {
  const source=[
    "script_pokecenter_nurse","script_mart $01, $2a, $ff","script_bills_pc",
    "script_players_pc","script_pokecenter_pc","script_prize_vendor",
    "script_cable_club_receptionist","script_vending_machine"
  ];
  const expected=[
    [0xff],[0xfe,0x03,0x01,0x2a,0xff,0xff],[0xfd],[0xfc],[0xf9],[0xf7],[0xf6],[0xf5]
  ];
  source.forEach((macro,index)=>{
    const bytes=Uint8Array.from(expected[index]),reader={family:"gb",size:bytes.length,ReadOnlyMemory:bytes,memory:new RomMemory(bytes)},codec=new GbcTextScriptCodec(reader);
    const decoded=codec.decompile(0);assert.match(decoded.source,new RegExp(macro.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
    assert.deepEqual(codec.compile(decoded.source),bytes);
  });
  const digits=Uint8Array.of(0x00,0xf6,0xf7,0xf8,0xf9,0xfa,0xfb,0xfc,0xfd,0xfe,0xff,0x50);
  const reader={family:"gb",size:digits.length,ReadOnlyMemory:digits,memory:new RomMemory(digits)},codec=new GbcTextScriptCodec(reader);
  const decoded=codec.decompile(0);assert.match(decoded.source,/text "0123456789"/);assert.deepEqual(codec.compile(decoded.source),digits);
});

test("Gen I text_far exposes the exact editable far-pointer owner", () => {
  const bytes=new Uint8Array(0x8001);bytes.set([0x17,0x00,0x40,0x02,0x50],0);
  const reader={family:"gb",size:bytes.length,ReadOnlyMemory:bytes,memory:new GbcMemory(bytes)},result=new GbcTextScriptCodec(reader).decompile(0);
  assert.equal(result.links.length,1);assert.equal(result.links[0].offset,0x8000);
  assert.deepEqual(result.links[0].reference,{kind:"gen2Far",bankOffset:3,addressOffset:1});
});

test("Gen I text previews follow text_far banked pointers and decode characters", async () => {
  const bytes=new Uint8Array(0xc100);
  bytes.set([0x17,0x00,0x41,0x02],0x100);
  bytes.set([0x87,0xa4,0xab,0xab,0xae,0x7f,0x96,0xae,0xb1,0xab,0xa3,0xe7,0x50],0x8100);
  const codec=new GbcTextCodec(new GbcMemory(bytes));
  assert.equal(codec.resolve(0x100),0x8100);
  assert.equal(codec.decode(0x100),"Hello World!");
  assert.deepEqual(codec.analyze(0x100),{kind:"text",command:"text_far",offset:0x100,textOffset:0x8100,preview:"Hello World!"});
  bytes.set([0x08,0x3e,0x01,0xc9],0x200);
  assert.deepEqual(codec.analyze(0x200),{kind:"assembly",command:"text_asm",offset:0x200,scriptOffset:0x201,view:"original"});
});

test("Gen I display text handles Pokédex flow commands and every native terminator", () => {
  const bytes=Uint8Array.of(
    0x80,0x4e,0x81,0x49,0x82,0x5f, // A<NEXT>B<PAGE>C<DEXEND>
    0x83,0x50                         // must never leak into the entry
  );
  assert.equal(new GbcTextCodec(new GbcMemory(bytes)).decode(0),"A\nB\n\nC");
  const padded=Uint8Array.of(0x98,0x8e,0x94,0x8d,0x86,0x92,0x93,0x84,0x91,0x50,0x81,0x94,0x86);
  assert.equal(new GbcTextCodec(new GbcMemory(padded)).decode(0,{limit:13}),"YOUNGSTER");
});

test("Gen I event associations distinguish dialogue from executable text_asm", async () => {
  const gbc=await read("js/map/gbc/editor.js"),inspector=await read("js/map/event-inspector.js");
  assert.match(gbc,/\)\.analyze\(entryPointer\)/);
  assert.match(gbc,/analysis\.kind===["']text["']/);
  assert.match(gbc,/textScriptPointer:entryPointer/);
  assert.match(gbc,/\$codeView:analysis\.view/);
  assert.match(inspector,/view:event\?\.\$codeView\|\|["']script["']/);
  assert.match(inspector,/!key\.startsWith\(["']\$["']\)/);
});

test("first editor activation loads lazily after reveal and focuses its initializer", async () => {
  const init=await read("js/init.js"),reveal=init.indexOf('document.getElementById(workspace.id)?.classList.remove("hide")'),ensure=init.indexOf("await romEditor.ensureWorkspace(workspace.id)");
  assert.ok(reveal>=0&&ensure>reveal,"workspace must be visible before lazy initialization");
  assert.match(init,/firstOpen/);
  assert.match(init,/requestAnimationFrame/);
  assert.match(init,/EDITORS\.activate\(workspace\.id,romEditor,\{initial:firstOpen\}\)/);
  assert.match(await read("js/map/editor.js"),/activate\(options=\{\}\)/);
  assert.match(await read("js/map/gbc/editor.js"),/activate\(\{initial=false\}/);
  assert.match(await read("js/map/editor-map.js"),/worldX=.*camera\.width/);
});

test("lazy workspace initialization is single-flight and cannot cross a ROM generation", async () => {
  const reader=await read("js/rom_reader.js"),runtimes=await Promise.all(["gba","gbc","gen2"].map(name=>read(`js/rom/runtime/${name}.js`)));
  assert.match(reader,/this\.workspaceLoads = new Map\(\)/);
  assert.match(reader,/this\.loading = false/);
  assert.match(reader,/async loadROM\(file\)\{[^]*if\(this\.loading\)throw new Error\("A ROM is already loading\."\);[^]*this\.loading=true[^]*finally\{[^]*this\.loading=false/);
  assert.match(reader,/const existing=this\.workspaceLoads\.get\(workspaceId\);if\(existing\)return existing/);
  assert.match(reader,/const generation=this\.projectGeneration,runtime=this\.runtime/);
  assert.match(reader,/this\.workspaceLoads\.set\(workspaceId,pending\)/);
  assert.match(reader,/resetLoadedState\(\)\{[^]*this\.projectGeneration\+\+;[^]*this\.workspaceLoads\.clear\(\)/);
  for(const runtime of runtimes){
    assert.match(runtime,/generation=reader\.projectGeneration/);
    assert.match(runtime,/await AssetLoader\.loadScripts[^]*if\(!reader\.isProjectGeneration\(generation\)/);
  }
});

test("workspace navigation ignores stale lazy completions and rolls back only the active failure", async () => {
  const init=await read("js/init.js");
  assert.match(init,/let workspaceTransition = 0/);
  assert.match(init,/const transition=\+\+workspaceTransition/);
  assert.match(init,/await romEditor\.ensureWorkspace\(workspace\.id\);[^]*if\(transition!==workspaceTransition\)return/);
  assert.match(init,/catch\(error\)\{[^]*if\(transition!==workspaceTransition\)return false[^]*previousLink[^]*previousWorkspace/);
  assert.match(init,/romreset"[^]*workspaceTransition\+\+/);
});

test("map composition traverses the complete component without connection cycles", async () => {
  const gbc=await read("js/map/gbc/editor.js"),gba=await read("js/map/editor-map.js");
  assert.match(gbc,/const queue=\[main\]/);
  assert.match(gbc,/if\(scene\.add\(node\)\)queue\.push\(node\)/);
  assert.match(gba,/scheduled = new Set/);
  assert.match(gba,/scheduled\.add\(neighbour\.getHeaderOffset\(\)\)/);
  assert.doesNotMatch(gba,/next_map\.map === this\.current_map/);
});

test("information tooltips belong to ambiguous property keys, not window headers", async () => {
  const windowSource=await read("js/core/ui-window.js"),inspector=await read("js/map/event-inspector.js");
  assert.match(windowSource,/static key\(key,description\)/);
  assert.match(windowSource,/static table\(values=\{\},descriptions=\{\},\{columns=1,layout=\[\],complexity=\{\}\}=\{\}\)/);
  assert.doesNotMatch(windowSource,/if\(info\)controls\.append/);
  assert.doesNotMatch(inspector,/new UiWindow\(\{[^}]*info:/);
  assert.match(inspector,/scriptOffset:/);
  assert.match(inspector,/textId:/);
  assert.match(inspector,/UiWindow\.table\(formatted,descriptions,\{columns:2,layout:groups,complexity\}\)/);
});

test("typed map events expose navigation and objects prefer real sprites", async () => {
  const inspector=await read("js/map/event-inspector.js"),gbc=await read("js/map/gbc/editor.js"),gbcSprites=await read("js/structures/gbc/sprite.js"),gba=await read("js/map/editor-map.js"),map=await read("js/map/map.js");
  assert.match(inspector,/eventActions/);
  assert.match(gbc,/label:"Enter warp"/);
  assert.match(gbc,/enterWarp\(event\)/);
  assert.match(gbc,/spriteTable\(\)/);
  assert.match(gbcSprites,/size!==expected/);
  assert.match(gbc,/GbcOverworldSpriteCatalog/);
  assert.match(gbc,/GbcSpriteCodec\.decodeTile/);
  assert.match(gbc,/PokemonViewer\.maps\.overlays\.marker\(context,\{x,y,type,sprite\}\)/);
  assert.match(gba,/event instanceof Warp/);
  assert.match(gba,/enterWarp\(warp\)/);
  assert.match(map,/PokemonViewer\.maps\.overlays\.marker/);
});

test("Gen I object events preserve the distinct person, item, and trainer layouts", () => {
  const person=GbcObjectEvent.read(new GbcMemory(Uint8Array.of(1,4,4,0xfe,0,3)),0);
  const item=GbcObjectEvent.read(new GbcMemory(Uint8Array.of(2,5,6,0xff,1,0x80,42)),0);
  const trainer=GbcObjectEvent.read(new GbcMemory(Uint8Array.of(3,7,8,0xff,2,0x40,9,4)),0);
  assert.deepEqual([person.eventType,person.size,person.textId],["Object",6,3]);
  assert.deepEqual([item.eventType,item.size,item.itemId,item.textId],["Item",7,42,0]);
  assert.deepEqual([trainer.eventType,trainer.size,trainer.trainerClass,trainer.trainerNumber],["Trainer",8,9,4]);
});

test("Gen I map headers pair pointer and bank tables instead of guessing banks", async () => {
  const gbc=await read("js/map/gbc/editor.js");
  assert.match(gbc,/bankTable\(\)/);
  assert.match(gbc,/plausibleHeader\(bank,address\)/);
  assert.match(gbc,/bank=banks===null\?null:this\.memory\.u8\(banks\+id\)/);
  assert.match(gbc,/GbcMapHeader\.read\(this\.memory,offset,bank\)/);
  assert.match(gbc,/candidate\|\|=this\.findHeader\(address\)/);
  assert.match(gbc,/MapHeaderBanks/);
});

test("Gen I bank-table discovery tolerates pokered's official unused map 0x0B", () => {
  const bytes=new Uint8Array(0x10000),memory=new GbcMemory(bytes),pointers=0x200,banks=0x300;
  for(let id=0;id<40;id++){
    const bank=id===0x0b?1:2,address=id===0x0b?0:0x4000+id*8;
    bytes[banks+id]=bank;bytes[pointers+id*2]=address&0xff;bytes[pointers+id*2+1]=address>>8;
    if(id===0x0b)continue;
    const offset=memory.banked(bank,address);bytes.set([1,4,5,0x00,0x50],offset);
  }
  const result=GbcMapDiscovery.findBankTable(memory,pointers);
  assert.equal(result.offset,banks);assert.equal(result.score,39);assert.equal(result.eligible,39);
});

test("attribute tables support semantic pairs and full-width rows", async () => {
  const windowSource=await read("js/core/ui-window.js"),inspector=await read("js/map/event-inspector.js"),styles=await read("scss/components/_window.scss");
  assert.match(windowSource,/\{columns=1,layout=\[\],complexity=\{\}\}/);
  assert.match(windowSource,/ui-table--two/);
  assert.match(inspector,/\["x","y"\]/);
  assert.match(inspector,/"textPreview","message"/);
  assert.match(inspector,/UiWindow\.table\(formatted,descriptions,\{columns:2,layout:groups,complexity\}\)/);
  assert.match(windowSource,/ui-table__wide/);
  assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles,/grid-column:1\/-1/);
  assert.match(styles,/@media\(max-width:700px\)/);
});

test("GB/GBC and GBA layer tools share one four-mode control contract", async () => {
  const library=await read("js/map/library.js"),controls=await read("js/map/controls.js"),gbc=await read("js/map/gbc/editor.js"),gba=await read("js/map/editor-map.js"),map=await read("js/map/map.js");
  assert.match(library,/const layerModes=Object\.freeze/);
  assert.match(library,/readOnly:Object\.freeze\(\[2,3,4,7,8,\.\.\.Array\.from/);
  assert.match(controls,/MapLayerModes\.COLLISION/);
  assert.match(gbc,/MapLayerModes\.is\(mode\)/);
  assert.match(gbc,/collisionTiles\(tileset\)/);
  assert.match(gbc,/tileset\.collision/);
  assert.match(gbc,/\[start,start\+1,start\+4,start\+5\]\.every/);
  assert.match(gbc,/cellX\*16/);
  assert.match(gbc,/MapLayerModes\.COLLISION/);
  assert.match(gbc,/MapLayerModes\.showsEvents/);
  assert.match(gba,/MapLayerModes\.is\(mode\)/);
  assert.match(map,/MapLayerModes\.dimsMap/);
  assert.doesNotMatch(gba,/\$\("\\.map_tool"\)\.click/);
});

test("collision layers preserve GBA elevation bits without inventing them for Gen I", async () => {
  const gba=await read("js/map/map.js"),utils=await read("js/core/map-block-utils.js"),gbc=await read("js/map/gbc/editor.js");
  assert.match(gba,/MapBlockUtils\.gbaWithIndex/);
  assert.match(gba,/MapBlockUtils\.gbaWithElevation/);
  assert.match(utils,/GBA_INDEX_MASK=0x03ff/);
  assert.match(utils,/GBA_ELEVATION_MASK=0x3f/);
  assert.match(gba,/getBlockHeight/);
  assert.match(gbc,/Gen I has no elevation bits/);
  assert.ok(!gbc.includes('open?"rgba(22,163,74'));
});

test("tilesets and map entities can open their real graphics in Sprite Editor", async () => {
  const sprite=await read("js/sprite/editor.js"),init=await read("js/init.js"),gbc=await read("js/map/gbc/editor.js"),gbcSprites=await read("js/structures/gbc/sprite.js"),gba=await read("js/map/editor-map.js");
  assert.match(sprite,/open\(request=\{\}\)/);assert.match(sprite,/openViews\(views/);
  assert.match(sprite,/GraphicSource\.resolve/);
  assert.match(init,/id:\s*"sprite_editor"[^]*open:\(project,request\)=>project\.sprite_editor\?\.open/);
  for(const source of [gbc,gba]){
    assert.match(source,/addEventListener\(["']dblclick["']/);
    assert.match(source,/Open sprite/);
    assert.match(source,/EditorLinks\.sprite/);
  }
  assert.match(gbc,/openTilesetBlock\(event\)/);
  assert.match(gbc,/overworldSpriteData\(spriteId\)/);
  assert.match(gbcSprites,/DISPLAY_PALETTE/);
  assert.match(gba,/pack4bpp\(pixels\)/);
  assert.match(gba,/palette:sprite\.palette/);
  assert.match(gba,/byteLength: self\.getShort\(texture \+ 4\)/);
  assert.match(gba,/editable=bytes\.length===sprite\.byteLength/);
  assert.match(gba,/openTilesetBlock\(event\)/);
});

test("Battle layers open as validated Sprite Editor sources with a native live preview", async () => {
  const [battle,sprite,gba,gbc]=await Promise.all([
    read("js/battle/editor.js"),read("js/sprite/editor.js"),
    read("js/battle/gba/driver.js"),read("js/battle/gbc/driver.js")
  ]);
  assert.match(battle,/spriteLinkDetail\(element,sourcePreview=null\)/);
  assert.match(battle,/openSpriteLink\(element,sourcePreview=null\)/);
  assert.match(battle,/scenePreview\(sourcePreview\)/);
  assert.match(battle,/previewCanvas:this\.scenePreview\(sourcePreview\)/);
  assert.match(battle,/workspace:"sprite_editor"/);
  assert.match(sprite,/Linked sprite bytes must be a Uint8Array/);
  assert.match(sprite,/previewCanvas=null/);
  assert.match(sprite,/renderLinkedPreview\(this\.linkedPreview&&this\.flipX\?this\.mirror/);
  assert.match(sprite,/mounted in its native \$\{source\.width\}×\$\{source\.height\} scene/);
  for(const driver of [gba,gbc])assert.match(driver,/previewCanvas:canvas/);
  assert.match(gba,/battleSpriteSource\(species,side="front"\)\{return this\.monsters\.read/);
});

test("trainer battle introductions use family-owned pictures and native messages",async()=>{
  const [editor,gba,gbc,gen2,runtime,model,preview]=await Promise.all([
    read("js/battle/editor.js"),read("js/battle/gba/driver.js"),read("js/battle/gbc/driver.js"),
    read("js/battle/gen2/driver.js"),read("js/rom/runtime/gba.js"),read("js/core/gba-trainers.js"),read("js/battle/preview.js")
  ]);
  assert.match(editor,/this\.scenePhase="intro"/);assert.match(editor,/this\.scenePhase="battle"/);
  assert.match(gba,/GbaTrainerSpriteCatalog/);assert.match(gba,/would like to battle!/);
  assert.match(gba,/kind:"trainer"/);assert.match(gbc,/wants to fight!/);
  assert.match(gbc,/this\.trainerSprite\(trainer\.classId\)/);
  assert.match(gen2,/TrainerPicPointers LZ/);assert.match(gen2,/wants to battle!/);
  assert.match(runtime,/battle\/gba\/trainer-sprites\.js\?v=2/);
  assert.match(model,/trainerPic:requireField\(definition,"trainerPic","u8"\)/);
  assert.match(model,/trainerPic=read\(this\.memory,offset,contract\.fields\.trainerPic\)/);
  assert.doesNotMatch(model,/trainerPic=this\.memory\.u8\(offset\+3\)/);
  assert.doesNotMatch(preview,/layout\s*===?\s*["'](?:gen1|gen2|gen3)|platform\s*===?\s*["'](?:gba|gbc)/);
  assert.match(gba,/GBA_TEXT_LAYOUT/);assert.match(gbc,/GEN1_TEXT_LAYOUT/);
});

test("native font codecs accept the keyed JSON dictionaries used by ROM readers",async()=>{
  const source=await read("js/core/text-table.js");
  assert.match(source,/Object\.entries\(dictionary\|\|\{\}\)/);
  const codec=new TextTableCodec({"00":" ","BB":"A","BC":"B"});
  assert.deepEqual(Array.from(codec.encode("AB A")),[0xbb,0xbc,0x00,0xbb]);
});

test("GBA map sprite refreshes decode mutable RomMemory through the shared 4bpp codec", async () => {
  const map=await read("js/map/editor-map.js"),runtime=await read("js/rom/runtime/gba.js"),hex=await read("js/hex/editor-hex.js");
  assert.match(runtime,/sprite\/codecs\/gba-4bpp\.js\?v=4[^]*map\/editor-map\.js\?v=54/);
  assert.match(map,/GbaSpriteCodec\.decodeTile\(self\.memory,dec_position\+tile\*GbaSpriteCodec\.bytesPerTile\)/);
  assert.match(map,/document\.addEventListener\("romgraphicschange"[^]*this\.overworld_sprite_buffer=\[\]/);
  assert.doesNotMatch(map,/GBA_Decompress\(self\.ReadOnlyMemory\.slice\(dec_position/);
  assert.match(map,/MemoryUtils\.replace\(this\.reader\.memory,offset[^]*Map block changed after this command/);
  assert.match(hex,/MemoryUtils\.replace\(this\.reader\.memory,offset/);
  assert.doesNotMatch(`${map}\n${hex}`,/ReadOnlyMemory\[[^\]]+\]\s*=/);
});

test("GBA raw tileset blocks expose exact primary and secondary tile segments", async () => {
  const map=await read("js/map/editor-map.js"),guide=await read("doc/SPRITE_EDITOR.md");
  assert.match(map,/const tilesetHeader=self\.readStructure\("tilesetHeader",offset,\{frlg:self\.isFRLG\(\)\}\)/);
  assert.match(map,/compressed = tilesetHeader\.isCompressed/);
  assert.doesNotMatch(map,/compressed = self\.getByte\(tileset_offset\)/);
  assert.match(map,/tilesetHeader\.palettes/);
  assert.match(map,/tilesetHeader\.metatiles/);
  assert.match(map,/tilesetHeader\.tiles/);
  assert.match(map,/tile>=0x200\?sources\[1\]:sources\[0\]/);
  assert.match(map,/localTile=tile&0x1ff/);
  assert.match(map,/source\.offset\+localTile\*GbaSpriteCodec\.bytesPerTile/);
  assert.match(map,/if\(source\.compressed\)editable=false/);
  assert.match(map,/editable\?\{segments,editable:true\}:\{editable:false\}/);
  assert.match(map,/tileset\.memory=this\.decode4bppRange\(tileset\.offset\)/);
  assert.match(map,/this\.block_buffer\.forEach\(blocks=>\{blocks\.images=\[\];\}\)/);
  assert.match(guide,/raw GBA tileset block/i);
});

test("GBA Pokédex exposes all 411 internal Species without fabricating the 25 National Dex gaps", async()=>{
  const [assets,model,driver,editor,runtime,guide]=await Promise.all([
    read("js/core/gba-rom-assets.js"),read("js/core/gba-species.js"),read("js/pokedex/gba/driver.js"),
    read("js/pokedex/editor.js"),read("js/rom/runtime/gba.js"),read("doc/POKEDEX_EDITOR.md")
  ]);
  assert.match(assets,/speciesCount:411/);assert.match(assets,/pokedexCount:386/);
  assert.match(assets,/monsterBackPics:0x23654c/);assert.match(assets,/monsterNames:0x245ee0/);
  assert.match(assets,/shifted\.pokedexEntries\+=0x60/);assert.match(assets,/tmHmLearnsets","battleMoves","moveNames"/);
  assert.match(model,/if\(id<=276\)return null/);assert.match(model,/document\(id\)/);
  assert.match(driver,/this\.data\.list\(\)/);assert.match(driver,/canEditEntry\(entry\)/);
  assert.match(editor,/canEditEntry/);assert.match(runtime,/gba-species\.js\?v=11/);
  assert.match(guide,/411 internal Species IDs/);
});

test("GBA Minimap decodes the actual in-ROM Fly map instead of scaling the world canvas",async()=>{
  const [renderer,region,workspace,map,runtime,assets,guide]=await Promise.all([
    read("js/core/gba-tilemap.js"),read("js/map/gba/region-map.js"),read("js/map/workspace.js"),
    read("js/map/editor-map.js"),read("js/rom/runtime/gba.js"),read("js/core/gba-rom-assets.js"),read("doc/MAP_EDITOR.md")
  ]);
  assert.match(renderer,/renderAffine8bpp/);assert.match(renderer,/renderText4bpp/);
  assert.match(region,/palette:0x59f73c/);assert.match(region,/tiles:0x59f77c/);assert.match(region,/tilemap:0x5a04e0/);
  assert.match(region,/label:"Hoenn Minimap"/);assert.match(region,/gRegionMapEntries|regionMapEntries/);
  assert.match(assets,/regionMapEntries:0x5a14fc/);
  assert.match(workspace,/region-map-canvas/);assert.match(workspace,/setRegionMap\(regionMap/);
  assert.match(map,/new PokemonViewer\.maps\.gba\.RegionMap/);
  assert.match(runtime,/gba-tilemap\.js\?v=2/);assert.match(runtime,/map\/gba\/region-map\.js\?v=5/);
  assert.match(guide,/Minimap/);assert.doesNotMatch(workspace,/drawImage\(this\.canvas/);
});

test("Red and Blue Minimap decodes exact pret graphics, RLE tilemap, and outdoor locations",async()=>{
  const [region,editor,runtime,workspace,manifest]=await Promise.all([
    read("js/map/gbc/region-map.js"),read("js/map/gbc/editor.js"),read("js/rom/runtime/gbc.js"),
    read("js/map/workspace.js"),read("manifests/generated/gen1-blue.json")
  ]);
  assert.match(region,/WorldMapTileGraphics/);assert.match(region,/CompressedMap/);assert.match(region,/ExternalMapEntries/);
  assert.match(region,/tilemap\.length!==360/);assert.match(region,/GbcSpriteCodec\.decodeTile/);
  assert.match(editor,/new PokemonViewer\.maps\.gbc\.RegionMap/);
  assert.match(runtime,/map\/gbc\/region-map\.js\?v=2/);
  assert.match(workspace,/text:"Minimap"/);assert.match(manifest,/graphics-tilemap-outdoor-locations/);
});

test("GBA Battle uses ROM background layers, back sprites, and cross-editor navigation",async()=>{
  const [backgrounds,sprites,driver,editor,markup,runtime,guide]=await Promise.all([
    read("js/battle/gba/backgrounds.js"),read("js/battle/gba/sprites.js"),read("js/battle/gba/driver.js"),
    read("js/battle/editor.js"),read("battle.html"),read("js/rom/runtime/gba.js"),read("doc/BATTLE_EDITOR.md")
  ]);
  assert.match(backgrounds,/Grass","Long grass","Sand","Underwater","Water","Pond","Mountain","Cave","Building","Plain/);
  assert.match(backgrounds,/this\.table\+id\*20/);assert.match(backgrounds,/entryTilemap:pointer\(12\)/);
  assert.match(backgrounds,/width:32,height:32,stride:32/);
  assert.match(backgrounds,/wrapWidth:256,wrapHeight:256/);
  assert.match(driver,/backgroundCanvas:environment\.canvas/);assert.match(driver,/backgroundScrollCanvas:environment\.scrollCanvas/);assert.match(driver,/read\(playerSpecies,"back"\)/);
  assert.match(driver,/id:9,label:"Plain preview"/);assert.match(driver,/mapDerived:Boolean\(mapEnvironment\)/);
  assert.match(sprites,/offset:graphic\.offset,bytes:frameBytes,count:64,columns:8/);
  assert.match(sprites,/palette:paletteColors/);assert.match(sprites,/editable:false/);
  assert.match(driver,/Verified ROM battle scene/);assert.match(sprites,/side==="back"/);
  assert.match(markup,/id="battle_open_map"/);assert.match(editor,/EditorLinks\.map/);assert.match(editor,/EditorLinks\.species/);
  assert.match(editor,/inspectElement/);assert.match(editor,/openEncounter/);assert.match(markup,/id="battle_environment"/);assert.doesNotMatch(markup,/battle_background_select/);
  assert.match(runtime,/battle\/gba\/environment\.js\?v=1/);assert.match(runtime,/battle\/gba\/backgrounds\.js\?v=5/);assert.match(guide,/battle_bg\.c/);
});

test("wild encounter links render one battle scene without fabricating a trainer intro",async()=>{
  const editor=await read("js/battle/editor.js"),state=await read("js/battle/source-state.js"),styles=await read("scss/editors/_battle.scss"),gba=await read("js/rom/runtime/gba.js"),gbc=await read("js/rom/runtime/gbc.js");
  assert.match(editor,/sourceState\.wild/);
  assert.match(editor,/sourceState\.isWild\?null:this\.scene\("intro"\)/);
  assert.match(state,/Wild · \$\{label\}/);
  assert.match(styles,/\.battle-editor--wild \.battle-scene--trainer\{display:none\}/);
  assert.match(styles,/\.battle-editor--wild \.battle-preview-wrap\{grid-template-columns:minmax\(0,1fr\)\}/);
  for(const runtime of [gba,gbc]){assert.match(runtime,/battle\/source-state\.js\?v=2/);assert.match(runtime,/battle\/party-view\.js\?v=2/);assert.match(runtime,/battle\/trainer-repository\.js\?v=1/);assert.match(runtime,/battle\/editor\.js\?v=25/);}
});

test("Battle startup uses one revisioned project worker and a virtual lazy trainer catalog",async()=>{
  const [index,worker,repository,editor,virtual,loader,gba,gbc,gen2]=await Promise.all([
    read("js/core/project-index-service.js"),read("js/workers/project-index-worker.js"),read("js/battle/trainer-repository.js"),
    read("js/battle/editor.js"),read("js/core/ui-virtual-select.js"),read("js/core/asset-loader.js"),
    read("js/battle/gba/driver.js"),read("js/battle/gbc/driver.js"),read("js/battle/gen2/driver.js")
  ]);
  assert.match(index,/const services=new WeakMap/);assert.match(index,/projectGeneration/);assert.match(index,/romRevision/);
  assert.match(worker,/scan-fixed-records/);assert.match(repository,/ProjectScheduler\.afterPaint\(\)/);
  assert.match(editor,/new UiVirtualSelect/);assert.doesNotMatch(editor,/this\.driver\.listTrainers/);
  assert.match(virtual,/slice\(0,this\.visibleRows\)/);assert.doesNotMatch(virtual,/\.\.\.this\.items\.map/);assert.match(loader,/Promise\.all/);
  assert.match(gba,/listTrainerSummaries/);assert.doesNotMatch(gba.split("safeCatalog")[0],/resourceGraph\(/);
  assert.doesNotMatch(gbc.split("safeCatalog")[0],/refreshGraph\(\)/);assert.doesNotMatch(gen2.split("safeCatalog")[0],/refreshGraph\(\)/);
});

test("project emulator is one lazy mGBA PiP for GBA, GB, and GBC with live refresh and save data",async()=>{
  const [pkg,server,editor,performance,markup,styles,gba,gbc,gen2,guide,index,init,reader]=await Promise.all([
    read("package.json"),read("scripts/serve.mjs"),read("js/emulator/editor.js"),read("js/emulator/performance.js"),
    read("emulator.html"),read("scss/editors/_emulator.scss"),read("js/rom/runtime/gba.js"),read("js/rom/runtime/gbc.js"),
    read("js/rom/runtime/gen2.js"),read("doc/EMULATOR.md"),read("index.html"),read("js/init.js"),read("js/rom_reader.js")
  ]);
  assert.match(pkg,/@thenick775\/mgba-wasm/);
  assert.match(server,/Cross-Origin-Opener-Policy/);assert.match(server,/Cross-Origin-Embedder-Policy/);assert.match(server,/application\/wasm/);
  assert.match(editor,/import\(MODULE_PATH\)/);assert.match(editor,/quickReload\(\)/);assert.match(editor,/getSave\(\)/);assert.match(editor,/FSSync/);
  assert.match(markup,/emulator_fullscreen/);assert.match(styles,/position:fixed/);assert.match(styles,/z-index:1200/);
  for(const runtime of [gba,gbc,gen2])assert.match(runtime,/workspaceId==="emulator"/);
  for(const runtime of [gba,gbc,gen2]){assert.match(runtime,/emulator\/performance\.js\?v=2/);assert.match(runtime,/emulator\/editor\.js\?v=12/);}
  assert.match(performance,/audioSync:true/);assert.match(performance,/threadedVideo:true/);assert.match(performance,/audioBufferSize:2048/);assert.match(performance,/showFpsCounter:false/);
  assert.match(editor,/saveDataUpdatedCallback:\(\)=>this\.queueSaveSync\(\)/);assert.match(editor,/setTimeout\(\(\)=>this\.flushSaveSync\(\),750\)/);
  assert.match(reader,/workspaceId==="emulator"\?"emulator_editor":workspaceId/);
  assert.match(editor,/Starting mGBA with the loaded project ROM/);
  assert.match(editor,/retry\(\)/);assert.match(init,/emulator_editor\?\.failed/);
  assert.match(markup,/id="emulator_gamepad"/);assert.match(markup,/data-emulator-button="Up"/);assert.match(markup,/data-emulator-button="A"/);assert.match(markup,/id="emulator_info"/);
  for(const speed of [1,2,5,10])assert.match(markup,new RegExp(`data-emulator-speed="${speed}"`));
  assert.doesNotMatch(markup,/emulator-input-hint/);
  assert.match(editor,/gamepadDown\(event\)/);assert.match(editor,/activePointers=new Map/);assert.match(editor,/showInfo\(\)/);
  assert.match(editor,/setFastForwardMultiplier\(multiplier\)/);assert.match(editor,/\[1,2,5,10\]\.includes\(multiplier\)/);
  assert.match(styles,/\.emulator-dpad/);assert.match(styles,/\.emulator-face-buttons/);assert.match(styles,/\.emulator-speed/);assert.match(styles,/@media\(any-pointer:coarse\)\{\.emulator-gamepad\{display:grid\}\}/);
  assert.match(guide,/always-on-top/);assert.doesNotMatch(index,/Iodine GBA|emulator_dock_slot/);
  assert.match(init,/document\.body\.insertAdjacentHTML\("beforeend",emulatorFragment/);
});

test("sprite codecs encode exactly what they decode for GBA and GB/GBC", () => {
  const gbaPixels=Uint8Array.from({length:64},(_,index)=>index%16),gbaBytes=GbaSpriteCodec.encodeTile(gbaPixels);
  assert.equal(gbaBytes.length,32);
  assert.deepEqual(GbaSpriteCodec.decodeTile(new RomMemory(gbaBytes),0),gbaPixels);
  const secondPixels=Uint8Array.from({length:64},(_,index)=>15-index%16),secondBytes=GbaSpriteCodec.encodeTile(secondPixels);
  const imageBytes=new Uint8Array(64);imageBytes.set(gbaBytes);imageBytes.set(secondBytes,32);
  const image=GbaSpriteCodec.decodeImage(imageBytes,{width:16,height:8});
  for(let y=0;y<8;y++){
    assert.deepEqual(image.slice(y*16,y*16+8),gbaPixels.slice(y*8,y*8+8));
    assert.deepEqual(image.slice(y*16+8,y*16+16),secondPixels.slice(y*8,y*8+8));
  }
  assert.throws(()=>GbaSpriteCodec.decodeImage(gbaBytes,{width:64,height:64}),/requires 2048 bytes/);
  const gbcPixels=Uint8Array.from({length:64},(_,index)=>index%4),gbcBytes=GbcSpriteCodec.encodeTile(gbcPixels);
  assert.equal(gbcBytes.length,16);
  assert.deepEqual(GbcSpriteCodec.decodeTile(new RomMemory(gbcBytes),0),gbcPixels);
  assert.throws(()=>GbcSpriteCodec.encodeTile(new Uint8Array(63)),RangeError);
});

test("MemoryUtils centralizes safe typed writes, patches, snapshots, and formatting", () => {
  const memory=new RomMemory(Uint8Array.of(1,2,3,4,5,6,7,8));
  MemoryUtils.write(memory,1,"u16",0xabcd);
  assert.equal(MemoryUtils.read(memory,1,"u16"),0xabcd);
  const snapshot=MemoryUtils.snapshot(memory,[{offset:1,length:2}]);
  MemoryUtils.writeBytes(memory,1,Uint8Array.of(9,10));
  assert.equal(MemoryUtils.equals(memory,1,Uint8Array.of(9,10)),true);
  MemoryUtils.restore(memory,snapshot);
  assert.equal(memory.u16(1),0xabcd);
  assert.deepEqual(MemoryUtils.table(memory,0,2,2,offset=>memory.u8(offset)),[1,0xab]);
  assert.equal(MemoryUtils.hex(255,4),"0x00FF");
  assert.equal(MemoryUtils.find(memory,Uint8Array.of(4,5),{start:0}),3);
  assert.equal(MemoryUtils.find(memory,Uint8Array.of(1,0xcd),{start:2,wrap:true}),0);
  assert.equal(MemoryUtils.find(memory,Uint8Array.of(0xff),{wrap:true}),null);
  assert.throws(()=>MemoryUtils.find(memory,new Uint8Array()),/non-empty/);
  assert.throws(()=>MemoryUtils.writeBytes(memory,7,Uint8Array.of(1,2)),/ROM range/);
  const untouched=memory.slice(0,memory.size);
  assert.throws(()=>MemoryUtils.patch(memory,[{offset:0,bytes:Uint8Array.of(0xff)},{offset:8,bytes:Uint8Array.of(1)}]),/ROM range/);
  assert.deepEqual(memory.bytes,untouched,"a rejected multi-range patch must not partially write");
  const guarded=new RomMemory(Uint8Array.of(1,2,3,4));
  MemoryUtils.replaceAll(guarded,[
    {offset:0,expected:Uint8Array.of(1),next:Uint8Array.of(9)},
    {offset:2,expected:Uint8Array.of(3),next:Uint8Array.of(8)}
  ]);
  assert.deepEqual(Array.from(guarded.bytes),[9,2,8,4]);
  assert.throws(()=>MemoryUtils.replaceAll(guarded,[
    {offset:0,expected:Uint8Array.of(9),next:Uint8Array.of(7)},
    {offset:2,expected:Uint8Array.of(3),next:Uint8Array.of(6)}
  ]),/changed after this command/);
  assert.deepEqual(Array.from(guarded.bytes),[9,2,8,4],"a conflicting replacement must not partially write");
});

test("Sprite Editor paints ROM pixels as reversible strokes and protects assembled previews", async () => {
  const sprite=await read("js/sprite/editor.js"),html=await read("sprite.html"),init=await read("js/init.js"),guide=await read("doc/SPRITE_EDITOR.md");
  assert.match(sprite,/reader\.history\?\.\("sprite_editor"/);
  assert.match(sprite,/beginStroke\(event\)/);
  assert.match(sprite,/this\.codec\.encodeTile\(pixels\)/);
  assert.match(sprite,/MemoryUtils\.writeBytes\(this\.reader\.memory,offset,bytes\)/);
  assert.match(sprite,/Paint \$\{stroke\.pixels\.size\} sprite pixel/);
  assert.match(sprite,/GraphicSource\.resolve/);
  assert.match(sprite,/Verified contiguous ROM bytes/);
  assert.match(sprite,/romgraphicschange/);
  assert.match(html,/id="sprite_color"/);
  assert.match(html,/id="sprite_undo"/);
  assert.match(init,/sprite_editor\?\.undo/);
  assert.match(guide,/Preview only/);
  assert.match(guide,/compared with the claimed ROM range/);
  assert.match(guide,/Both experiences have the same painting/);
});

test("GraphicSource enables only byte-identical contiguous or segmented linked graphics", () => {
  const memory=new RomMemory(Uint8Array.of(9,8,7,6,5,4));
  const verified=GraphicSource.resolve(memory,{offset:1,bytes:Uint8Array.of(8,7,6),editable:true,title:"Sprite"});
  assert.equal(verified.verified,true);assert.equal(verified.external,null);assert.equal(verified.length,3);
  assert.equal(verified.locate(1,2),2);
  const segmented=GraphicSource.resolve(memory,{bytes:Uint8Array.of(8,7,5,4,8,7),segments:[{offset:1,length:2},{offset:4,length:2},{offset:1,length:2}],editable:true});
  assert.equal(segmented.verified,true);assert.equal(segmented.segmented,true);
  assert.deepEqual(segmented.external.bytes,Uint8Array.of(8,7,5,4,8,7));
  assert.equal(segmented.locate(0,2),1);assert.equal(segmented.locate(2,2),4);assert.equal(segmented.locate(4,2),1);
  assert.equal(segmented.locate(1,2),null,"a write may not cross segment boundaries");
  const mismatch=GraphicSource.resolve(memory,{offset:1,bytes:Uint8Array.of(8,0,6),editable:true});
  assert.equal(mismatch.verified,false);assert.deepEqual(mismatch.external.bytes,Uint8Array.of(8,0,6));
  const segmentedMismatch=GraphicSource.resolve(memory,{bytes:Uint8Array.of(8,0),segments:[{offset:1,length:2}],editable:true});
  assert.equal(segmentedMismatch.verified,false);assert.equal(segmentedMismatch.locate,null);
  assert.equal(GraphicSource.resolve(memory,{offset:1,bytes:Uint8Array.of(8,7,6),editable:false}).verified,false);
  assert.equal(GraphicSource.resolve(memory,{offset:5,bytes:Uint8Array.of(4,3),editable:true}).verified,false);
  assert.throws(()=>GraphicSource.resolve(memory,{bytes:Uint8Array.of(8,7),segments:[{offset:1,length:1}],editable:true}),/cover 1 bytes/);
  assert.throws(()=>GraphicSource.resolve(memory,{bytes:Uint8Array.of(8),segments:[{offset:-1,length:1}],editable:true}),/graphic segment/i);
  assert.deepEqual(GraphicSource.resolve(memory,{palette:[0xff0000,"#00FF00"],colorCount:2}).palette,["#ff0000","#00ff00"]);
  assert.deepEqual(GraphicSource.resolve(memory,{palette:["#ff0000","#00ff00"],colorCount:2,paletteOffset:1}).paletteReference,{offset:1,stride:2});
  assert.equal(GraphicSource.resolve(memory,{palette:["#ff0000","#00ff00"],colorCount:2,paletteOffset:4}).paletteReference,null);
  assert.equal(GraphicSource.resolve(memory,{palette:["#ffffff"],colorCount:2}).palette,null);
  assert.throws(()=>GraphicSource.resolve(memory,{palette:["red"],colorCount:1}),/Invalid linked palette/);
});

test("Gen I metatile links expose verified per-tile ROM segments to Sprite Editor", async () => {
  const source=await read("js/map/gbc/editor.js"),sprite=await read("js/sprite/editor.js");
  assert.match(source,/segments\.push\(\{offset,length:16\}\)/);
  assert.match(source,/bytes,segments,count:16,columns:4,editable:true/);
  assert.match(sprite,/Verified segmented ROM tiles/);
  assert.match(sprite,/this\.graphicTarget\(offset,bytes\.length\)/);
  assert.match(sprite,/MemoryUtils\.equals\(this\.reader\.memory,entry\.target,entry\.expected\)/);
  assert.match(sprite,/for\(const segment of this\.linkedSource\.segments\|\|\[\]\)/);
  assert.match(sprite,/segment\.start\+target-segment\.offset/);
});

test("GBA and GBC palette colors round-trip through each family codec", () => {
  for(const value of [0,0x001f,0x03e0,0x7c00,0x7fff])assert.equal(GbaSpriteCodec.encodeColor(GbaSpriteCodec.decodeColor(value)),value);
  assert.equal(GbaSpriteCodec.decodeColor(0x001f),"#f80000");
  assert.equal(GbaSpriteCodec.decodeColor(0x03e0),"#00f800");
  assert.equal(GbaSpriteCodec.decodeColor(0x7c00),"#0000f8");
  for(const value of [0,0x001f,0x03e0,0x7c00,0x7fff])assert.equal(GbcSpriteCodec.encodeColor(GbcSpriteCodec.decodeColor(value)),value);
});

test("Sprite Editor exposes a compact visual linked-palette workflow for verified family palettes", async () => {
  const sprite=await read("js/sprite/editor.js"),html=await read("sprite.html"),styles=await read("scss/editors/_sprite.scss"),guide=await read("doc/SPRITE_EDITOR.md"),gba=await read("js/map/editor-map.js"),gen2=await read("js/sprite/gen2/pokemon-catalog.js");
  assert.match(html,/id="sprite_palette_swatches"/);
  assert.match(html,/id="sprite_color" type="hidden"/);
  assert.doesNotMatch(html,/<label>Ink color<select/);
  assert.match(html,/id="sprite_palette_color"/);
  assert.match(sprite,/syncColorSelection\(\)/);
  assert.match(sprite,/Math\.ceil\(Math\.sqrt\(this\.codec\.colors\)\)/);
  assert.match(sprite,/paletteField\.classList\.add\("hide"\)/);
  assert.match(sprite,/data-color-index/);
  assert.match(sprite,/Editable ROM palette/);
  assert.match(sprite,/"Palette offset":"advanced"/);
  assert.match(sprite,/applyPaletteColor\(\)/);
  assert.match(styles,/\.sprite-palette-swatch\.is-selected/);
  assert.match(styles,/--palette-columns/);
  assert.match(gba,/paletteOffset:sprite\.paletteOffset/);
  assert.match(gen2,/paletteOffsets:\[null,normal\.offset,normal\.offset\+2,null\]/);
  assert.match(guide,/grid and palette editing/i);
  assert.match(guide,/available in both experiences/i);
});

test("all workspaces use reusable UiToolbar collections and Sprite uses a three-pane workspace", async () => {
  const ui=await read("js/core/ui-window.js"),html=await read("sprite.html"),styles=await read("scss/editors/_sprite.scss");
  assert.match(ui,/class UiToolbar/);
  assert.match(ui,/static mount\(root,definitions=\[\]\)/);
  assert.match(ui,/role:\"toolbar\"/);
  assert.match(html,/sprite-panel--source/);
  assert.match(html,/sprite-stage/);
  assert.match(html,/sprite-inspector/);
  assert.match(styles,/grid-template-columns:minmax\(0,1fr\) minmax\(260px,320px\)/);
  assert.match(html,/class="sprite-toolbox editor-toolbox"[^>]*role="toolbar"/);
});

test("declarative UiWindow and UiToolbar enhancement consolidates editor panels", async () => {
  const ui=await read("js/core/ui-window.js"),init=await read("js/init.js"),sprite=await read("sprite.html"),battle=await read("battle.html"),sound=await read("sound.html"),moves=await read("moves.html"),pokedex=await read("pokedex.html"),animation=await read("animation.html"),encounters=await read("encounters.html"),emulator=await read("emulator.html"),code=await read("code.html");
  assert.match(ui,/static enhanceAll\(root=document\)/);
  assert.match(ui,/data-ui-window/);assert.match(ui,/data-ui-toolbar/);assert.match(ui,/ui-window--docked/);
  assert.match(init,/UiWindow\.enhanceAll\(elements\.main\)/);assert.match(init,/UiToolbar\.enhanceAll\(elements\.main\)/);
  for(const source of [sprite,battle,sound,moves,pokedex,animation,encounters,emulator,code])assert.match(source,/data-ui-window|data-ui-toolbar/);
  assert.match(sprite,/sprite-panel--source sprite-sidebar editor-attributes/);assert.match(sprite,/class="sprite-toolbox editor-toolbox"[^>]*role="toolbar"/);assert.match(sprite,/data-ui-window="Canvas"/);assert.match(sprite,/data-ui-window="Palette &amp; paint"/);assert.match(sprite,/data-ui-window="Properties"/);
  assert.match(animation,/data-ui-window="Preview"/);assert.match(animation,/class="ui-panel-tabs animation-view-tabs"/);
  assert.match(encounters,/data-ui-toolbar="Encounter links"/);assert.doesNotMatch(encounters,/data-ui-window="Encounter table"/);assert.match(emulator,/data-ui-toolbar="Emulator controls"/);
  assert.match(code,/data-ui-toolbar="Source actions"[^]*id="code_disassemble"/);
  assert.match(ui,/:scope > label\.ui-button/);
});

test("sprite and graphic actions share the image action material", async () => {
  const ui=await read("js/core/ui-window.js"),pokedex=await read("pokedex.html"),items=await read("items.html"),pokedexEditor=await read("js/pokedex/editor.js"),battle=await read("js/battle/editor.js");
  assert.match(ui,/spriteAction=\/\\b\(sprite\|graphic\|image\)\\b\/i/);
  assert.match(ui,/spriteAction\?"fa-image"/);
  assert.match(pokedex,/id="pokedex_sprite"[^>]*ui-button--edit-sprite[^>]*>[\s\S]*?fa-image/);
  assert.match(items,/id="item_sprite"[^>]*ui-button--edit-sprite[^>]*>[\s\S]*?fa-image/);
  assert.match(pokedexEditor,/item sprite`,icon:"fa-image"/);
  assert.match(battle,/Open in Sprite Editor",\{icon:"fa-image"/);
});

test("map zoom preserves the world point beneath the cursor", async () => {
  const camera=await read("js/camera.js"),workspace=await read("js/map/workspace.js"),gba=await read("js/map/editor-map.js"),gesture=await read("js/core/gesture-zoom.js");
  assert.match(camera,/worldX=\(x-this\._x\)\/previous/);
  assert.match(camera,/this\._x=x-worldX\*next/);
  assert.match(camera,/next=pixelZoom\(previous\*z\)/);
  assert.match(workspace,/world=.*this\.viewport\.scrollLeft\+local\.x.*\/oldZoom/);
  assert.match(workspace,/this\.viewport\.scrollLeft=world\.x\*value-local\.x/);
  assert.match(workspace,/GestureZoom\.dragDelta/);
  assert.match(gesture,/sensitivity=\.0009/);
  assert.match(gesture,/limit=120/);
  assert.match(gesture,/sensitivity=\.72/);
  assert.match(gba,/GestureZoom\.bindPinch\(canvas/);
  assert.equal((gba.match(/addEventListener\(["']wheel["']/g)||[]).length,1);
  assert.doesNotMatch(gba,/\.on\(["']wheel["']/);
});

test("Map tools consolidate into a reusable vertical toolbox beside the canvas",async()=>{
  const [workspace,mapStyles,sharedStyles,gbaRuntime,gbcRuntime,gen2Runtime]=await Promise.all([
    read("js/map/workspace.js"),read("scss/editors/_map-tools.scss"),read("scss/components/_editor-workspace.scss"),
    read("js/rom/runtime/gba.js"),read("js/rom/runtime/gbc.js"),read("js/rom/runtime/gen2.js")
  ]);
  assert.match(workspace,/tools\.classList\.add\("editor-toolbox--vertical","editor-toolbox--floating"\)/);
  assert.match(workspace,/tools\.classList\.remove\("window"\)/);
  assert.match(workspace,/tools\.dataset\.toolbox="Map tools"/);
  assert.match(sharedStyles,/\.editor-toolbox--vertical/);
  assert.match(sharedStyles,/\.editor-toolbox--floating\{position:absolute\}/);
  assert.match(mapStyles,/top:50%/);
  assert.match(mapStyles,/left:14px/);
  assert.match(mapStyles,/transform:translateY\(-50%\)/);
  assert.match(mapStyles,/\.map-tools__group,.map-navigation-controls\{display:flex;flex-direction:column/);
  assert.doesNotMatch(mapStyles,/data-window-title="Map tools"[^\n]*translateX/);
  for(const runtime of[gbaRuntime,gbcRuntime,gen2Runtime])assert.match(runtime,/map\/workspace\.js\?v=35/);
});

test("Tool flyouts resolve their active state whenever they reopen",async()=>{
  const [ui,controls]=await Promise.all([read("js/core/ui-window.js"),read("js/map/controls.js")]);
  assert.match(ui,/resolveItems\(\).*typeof item\.active==="function"/);
  assert.match(ui,/role:"menuitemradio","aria-checked":String\(item\.active\)/);
  assert.match(ui,/this\.tool\.setAttribute\("aria-expanded","true"\)/);
  assert.match(controls,/items:\(\)=>states\.map/);
  assert.match(controls,/active:\(\)=>mode===Number\(tool\.dataset\.current\)/);
});

test("Minimap mode replaces local-map HUD with safe destination editing tools", async () => {
  const workspace=await read("js/map/workspace.js"),region=await read("js/map/gba/region-map.js"),styles=await read("scss/editors/_map-layout.scss"),gba=await read("js/map/editor-map.js"),gb=await read("js/map/gbc/region-map.js"),utils=await read("js/map/minimap-utils.js");
  assert.match(workspace,/region-editor-toolbar/);
  assert.match(workspace,/editRegionEntry/);
  assert.match(workspace,/setRegionZoom/);
  assert.match(workspace,/Move Minimap location/);
  assert.match(region,/canEdit\(entry\)/);
  assert.match(region,/updateEntry\(entry/);
  assert.match(styles,/data-map-view="region".*\.map-history/);
  assert.match(styles,/data-map-view="region".*\.window/);
  assert.match(gba,/setRegionMap\(this\.regionMap,\{onOpen:/);
  assert.match(workspace,/ensureRegionTilesWindow/);assert.match(workspace,/bindRegionGestures/);assert.match(workspace,/openRegionTiles/);
  assert.match(gb,/filter\(item=>item\.flyable\)/);assert.match(gb,/tileEditorSource/);
  assert.match(utils,/class MinimapUtils/);assert.match(utils,/static packing/);assert.match(utils,/renderUsedTiles/);
});

test("map families share pixel-aligned overlays and Minimap exposes exact used tiles", async () => {
  const library=await read("js/map/library.js"),gba=await read("js/map/map.js"),gbaEditor=await read("js/map/editor-map.js"),gb=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js"),region=await read("js/map/gba/region-map.js"),workspace=await read("js/map/workspace.js"),camera=await read("js/camera.js");
  assert.match(library,/overlayRenderer/);assert.match(library,/marker\(context/);assert.match(library,/grid\(context/);assert.match(library,/selection\(context/);
  for(const source of [gba,gb,gen2])assert.match(source,/PokemonViewer\.maps\.overlays\.marker/);
  for(const source of [gbaEditor,gb,gen2])assert.match(source,/PokemonViewer\.maps\.overlays\.grid/);
  assert.doesNotMatch(gba,/zoom > 0\.7/);
  assert.match(camera,/Math\.round\(Math\.max\(MIN_ZOOM/);assert.match(workspace,/Math\.round\(Math\.max\(\.125,Math\.min\(4/);
  assert.match(region,/renderUsedTiles/);assert.match(workspace,/Minimap tiles/);assert.match(workspace,/regionShowLocations/);assert.match(workspace,/regionShowGrid/);
});

test("map picker reveals and scrolls the shared Blocks window in every family", async () => {
  const manager=await read("js/map/window-manager.js"),gba=await read("js/map/editor-map.js"),gb=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js");
  assert.match(manager,/reveal\(titleOrId/);assert.match(manager,/classList\.remove\("is-minimized"\)/);assert.match(manager,/scrollIntoView/);
  assert.match(gba,/windowManager\.reveal\("Blocks"/);
  assert.match(gb,/windowManager\?\.reveal\("Blocks"/);assert.match(gen2,/windowManager\?\.reveal\("Blocks"/);
});

test("double-click map navigation can keep, discard, or cancel current-map changes", async () => {
  const dialog=await read("js/core/dialog.js"),editor=await read("js/map/editor.js"),library=await read("js/map/library.js"),gbc=await read("js/map/gbc/editor.js"),gba=await read("js/map/editor-map.js"),styles=await read("scss/components/_dialog.scss"),html=await read("index.html");
  assert.match(dialog,/class AppDialog/);
  assert.match(dialog,/showModal\(\)/);
  assert.match(dialog,/addEventListener\(["']cancel["']/);
  assert.match(html,/js\/core\/dialog\.js/);
  assert.match(styles,/::backdrop/);
  assert.match(dialog,/static choose/);
  assert.match(editor,/MapUtils\.resolveNavigation\(this\.commands,this\.navigationCheckpoint\)/);
  assert.match(library,/Open and keep changes/);
  assert.match(library,/Discard and open/);
  assert.match(library,/while\(stack\.done\.length>baseline\)stack\.undo\(\)/);
  assert.match(library,/stack\.done\.at\(-1\)/);
  assert.match(gbc,/openSceneMap\(event\)/);
  assert.match(gbc,/sceneMapAt\(clientX,clientY\)/);
  assert.match(gba,/mapAtScreen\(x,y\)/);
  assert.match(gba,/stopImmediatePropagation/);
  for(const source of [gbc,gba])assert.match(source,/editor\.navigate/);
});

test("map interaction utilities centralize coordinates, hit testing, and guarded history", async () => {
  const library=await read("js/map/library.js"),workspace=await read("js/map/workspace.js"),gbc=await read("js/map/gbc/editor.js"),gba=await read("js/map/editor-map.js");
  for(const method of ["pointInRect","canvasPoint","localPoint","gridPoint","screenToWorld","resolveNavigation"])assert.match(library,new RegExp(`${method}\\(`));
  assert.match(library,/global\.MapUtils=utils/);
  assert.match(workspace,/MapUtils\.canvasPoint/);
  assert.match(gbc,/MapUtils\.pointInRect/);
  assert.match(gbc,/MapUtils\.gridPoint/);
  assert.match(gba,/MapUtils\.screenToWorld/);
  assert.match(gba,/MapUtils\.localPoint/);
});

test("shared map frames keep labels and borders stable across GBA zoom and GB/GBC scenes", async () => {
  const calls=[],context={
    save:()=>calls.push(["save"]),restore:()=>calls.push(["restore"]),
    strokeRect:(...args)=>calls.push(["strokeRect",...args]),
    fillRect:(...args)=>calls.push(["fillRect",...args]),
    fillText:(...args)=>calls.push(["fillText",...args]),
    measureText:text=>({width:text.length*6})
  };
  assert.equal(MapUtils.drawMapFrame(context,{x:8,y:16,width:160,height:96},{label:"Route 1",scale:2}),true);
  assert.equal(context.lineWidth,1);
  assert.equal(context.font,"700 5.5px system-ui, sans-serif");
  assert.deepEqual(calls.find(call=>call[0]==="strokeRect").slice(1),[8.5,16.5,159,95]);
  assert.ok(calls.some(call=>call[0]==="fillText"&&call[1]==="Route 1"));
  assert.equal(PokemonViewer.maps.overlays.picker(context,{x:0,y:0,width:32,height:32}),true);
  assert.equal(PokemonViewer.maps.overlays.picker(context,{x:0,y:0,width:0,height:32}),false);
  assert.equal(MapUtils.drawMapFrame(context,{width:0,height:10}),false);
  const map=await read("js/map/map.js"),workspace=await read("js/map/workspace.js"),gbcEditor=await read("js/map/gbc/editor.js");
  assert.match(map,/MapUtils\.drawMapFrame/);
  assert.match(workspace,/MapUtils\.drawMapFrame/);
  assert.match(gbcEditor,/overlays\.picker/);
  assert.doesNotMatch(map,/bold 30px Arial|BLACK RECTANGLE TODO/);
});

test("Simple and Nerd experiences persist and are available from every editor header", async () => {
  const settings=await read("js/core/settings.js"),header=await read("js/core/editor-header.js"),init=await read("js/init.js"),styles=await read("scss/components/_settings.scss"),html=await read("index.html");
  assert.match(settings,/class EditorPreferences/);
  assert.match(settings,/localStorage\.getItem/);
  assert.match(settings,/localStorage\.setItem/);
  assert.match(settings,/experience:"simple"/);
  assert.match(settings,/setExperience\(value\)/);
  assert.match(settings,/editorpreferencechange/);
  assert.match(header,/item\.complexity!==["']advanced["']/);
  assert.match(init,/Simple experience/);
  assert.match(init,/Nerd experience/);
  assert.match(init,/Experience settings/);
  assert.match(styles,/\[data-experience=["']simple["']\] \[data-complexity=["']advanced["']\]/);
  assert.match(html,/js\/core\/settings\.js/);
  for(const file of ["code.html","sprite.html","hex.html"])assert.match(await read(file),/data-complexity=["']advanced["']/);
});

test("each editor header links to maintained usage documentation", async () => {
  const init=await read("js/init.js"),docs=["USAGE.md","MAP_EDITOR.md","CODE_EDITOR.md","SPRITE_EDITOR.md","HEX_EDITOR.md"];
  for(const doc of docs){
    assert.match(init,new RegExp(doc.replace(".","\\.")));
    const source=await read(`doc/${doc}`);
    assert.ok(source.length>200,`${doc} should contain a useful guide`);
  }
  assert.doesNotMatch(init,/Map controls["'],disabled:true/);
});

test("family checksum utility repairs GBA and GB/GBC exports without guessing a profile", () => {
  const gba=new Uint8Array(0xc0);
  assert.deepEqual(RomChecksum.inspect(gba,"gba"),{family:"gba",header:{stored:0,calculated:0xe7,valid:false},global:null});
  RomChecksum.repair(gba,"gba");
  assert.equal(gba[0xbd],0xe7);
  assert.equal(RomChecksum.inspect(gba,"gba").header.valid,true);

  const gb=new Uint8Array(0x200);
  RomChecksum.repair(gb,"gb");
  assert.equal(gb[0x14d],0xe7);
  assert.equal((gb[0x14e]<<8)|gb[0x14f],0xe7);
  gb[0x150]=1;
  RomChecksum.repair(gb,"gbc");
  assert.equal((gb[0x14e]<<8)|gb[0x14f],0xe8);
  assert.equal(RomChecksum.inspect(gb,"gb").global.valid,true);
  assert.equal(RomChecksum.inspect(new Uint8Array(4),"gb"),null);

  const original=gb.slice(),current=gb.slice(),storedGlobal=(current[0x14e]<<8)|current[0x14f];
  current[0x151]=2;
  const snapshot=RomExport.snapshot({OriginalMemory:original,ReadOnlyMemory:current,family:"gb"});
  assert.equal((current[0x14e]<<8)|current[0x14f],storedGlobal,"export must not mutate editor memory");
  assert.equal(RomChecksum.inspect(snapshot.bytes,"gb").global.valid,true);
  assert.equal(snapshot.checksums.before.global.valid,false);
  assert.equal(snapshot.checksums.after.global.valid,true);
  assert.ok(snapshot.ranges.some(range=>range.offset<=0x14f&&range.offset+range.length>0x14e));
});

test("ROM export reports deterministic changed-byte ranges and preserves the extension", () => {
  const original=Uint8Array.of(0,1,2,3,4,5,6),current=original.slice();
  current.set([9,8],1);current[5]=7;
  const reader={OriginalMemory:original,ReadOnlyMemory:current,gamePath:"Pokemon Emerald.gba",family:"gba"};
  assert.deepEqual(RomExport.changes(reader),[
    {offset:1,length:2,previous:[1,2],next:[9,8]},
    {offset:5,length:1,previous:[5],next:[7]}
  ]);
  assert.equal(RomExport.filename(reader),"Pokemon Emerald-edited.gba");
  assert.deepEqual(RomExport.summary(reader),{ranges:2,bytes:3,pending:[],byteDirty:true,dirty:true});
});

test("successful ROM saves checkpoint unsaved state without erasing the original diff", async () => {
  const original=Uint8Array.of(0,1,2,3),current=original.slice(),reader={
    OriginalMemory:original,ReadOnlyMemory:current,SavedMemory:original.slice(),family:"gb"
  };
  current[1]=9;
  assert.deepEqual(RomExport.summary(reader),{ranges:1,bytes:1,pending:[],byteDirty:true,dirty:true});
  RomExport.markSaved(reader);
  assert.deepEqual(RomExport.summary(reader),{ranges:0,bytes:0,pending:[],byteDirty:false,dirty:false});
  assert.deepEqual(RomExport.changes(reader),[{offset:1,length:1,previous:[1],next:[9]}],"source diff must survive the save checkpoint");
  current[1]=1;
  assert.deepEqual(RomExport.summary(reader),{ranges:1,bytes:1,pending:[],byteDirty:true,dirty:true},"Undo after save must become unsaved");

  const exporter=await read("js/core/rom-export.js"),romReader=await read("js/rom_reader.js"),init=await read("js/init.js"),guide=await read("doc/USAGE.md");
  assert.match(exporter,/this\.downloadBytes\([^]*this\.markSaved\(reader\)/);
  assert.match(romReader,/this\.SavedMemory = this\.ReadOnlyMemory\.slice\(\)/);
  assert.match(init,/addEventListener\("editorsaved",updateDirtyUi\)/);
  assert.match(guide,/immutable source snapshot[^]*change reports still describe every difference/);
});

test("ROM exports snapshot bytes once and change reports disclose excluded drafts", async () => {
  const original=validGbBytes(),current=original.slice();
  current[0x151]=9;
  const drafts=new DraftRegistry();
  drafts.register("code_editor",()=>[{kind:"source-draft",label:"TEXT · 0x004000",offset:0x4000}]);
  const reader={
    OriginalMemory:original,ReadOnlyMemory:current,gamePath:"Pokemon Blue.gb",family:"gb",
    editorProfile:"gen1-rgb-intl",memory:new RomMemory(current),drafts,
    validation:new ValidationRegistry()
  };
  const snapshot=RomExport.snapshot(reader);
  current[0x151]=8;
  assert.equal(snapshot.bytes[0x151],9);
  assert.ok(snapshot.changedBytes>=1);

  const previousDialog=globalThis.AppDialog,previousDownload=RomExport.downloadBytes;
  let confirmation=null,download=null;
  globalThis.AppDialog={confirm:async options=>{confirmation=options;return true;}};
  RomExport.downloadBytes=(bytes,filename,type)=>{download={bytes,filename,type};};
  try{
    const payload=await RomExport.report(reader);
    assert.equal(payload.version,4);
    assert.ok(payload.changedBytes>=1);
    assert.equal(payload.validation.valid,true);
    assert.deepEqual(payload.validation.errors,[]);
    assert.deepEqual(payload.excludedDrafts,[{editor:"code_editor",kind:"source-draft",label:"TEXT · 0x004000",offset:"0x4000"}]);
    assert.match(confirmation.detail,/applied byte changes only/i);
    assert.equal(download.filename,"Pokemon Blue-changes.json");
    assert.deepEqual(JSON.parse(new TextDecoder().decode(download.bytes)),payload);
  }finally{
    globalThis.AppDialog=previousDialog;
    RomExport.downloadBytes=previousDownload;
  }
});

test("project validation gates export across schema, domain, graph, allocation, and artifact checks", () => {
  const original=validGbBytes(),current=original.slice(),memory=new RomMemory(current);
  const reader={
    OriginalMemory:original,ReadOnlyMemory:current,memory,family:"gb",
    editorProfile:"gen1-rgb-intl",validation:new ValidationRegistry(),resourceGraph:null
  };
  const snapshot=RomExport.snapshot(reader),report=ProjectValidator.assertExportable(reader,{snapshot});
  assert.equal(report.valid,true);
  assert.deepEqual(report.categories,["schema","domain","graph","allocation","export"]);
  assert.ok(report.warnings.some(item=>item.code==="GRAPH_MISSING"));

  reader.validation.register("species",()=>[{level:"warning",code:"SPECIES_PARTIAL",message:"Species coverage is partial."}]);
  assert.ok(ProjectValidator.validate(reader,{snapshot}).warnings.some(item=>item.code==="SPECIES_PARTIAL"));
  reader.validation.register("broken",()=>{throw new Error("table pointer escaped its bank");});
  const blocked=ProjectValidator.validate(reader,{snapshot});
  assert.equal(blocked.valid,false);
  assert.ok(blocked.errors.some(item=>item.code==="DOMAIN_broken_FAILED"));
  assert.throws(()=>ProjectValidator.assertExportable(reader,{snapshot}),error=>
    error.name==="ProjectValidationError"&&error.validation?.errors.some(item=>item.code==="DOMAIN_broken_FAILED")
  );

  const malformed={...snapshot,changedBytes:snapshot.changedBytes+1};
  assert.ok(ProjectValidator.validate({...reader,validation:new ValidationRegistry()},{snapshot:malformed}).errors.some(item=>item.code==="CHANGE_COUNT_INVALID"));
});

test("a failing project validator blocks ROM download before any artifact is emitted", async () => {
  const original=validGbBytes(),current=original.slice();
  current[0x151]=1;
  const reader={
    OriginalMemory:original,ReadOnlyMemory:current,memory:new RomMemory(current),
    family:"gb",editorProfile:"gen1-rgb-intl",gamePath:"Pokemon Blue.gb",
    drafts:new DraftRegistry(),validation:new ValidationRegistry(),resourceGraph:null
  };
  reader.validation.register("trainer",()=>[{level:"error",code:"TRAINER_PARTY_INVALID",message:"A trainer party is unterminated."}]);
  const previousDownload=RomExport.downloadBytes,previousDialog=globalThis.AppDialog;
  let downloaded=false;
  RomExport.downloadBytes=()=>{downloaded=true;};
  globalThis.AppDialog={confirm:async()=>true};
  try{
    await assert.rejects(()=>RomExport.rom(reader),/validation blocked export/i);
    assert.equal(downloaded,false);
  }finally{
    RomExport.downloadBytes=previousDownload;
    globalThis.AppDialog=previousDialog;
  }
});

test("exact domain validators are project-owned, replaceable, and evaluated against live ROM state", async () => {
  const original=validGbBytes(),current=original.slice(),reader={
    OriginalMemory:original,ReadOnlyMemory:current,memory:new RomMemory(current),
    family:"gb",editorProfile:"gen1-rgb-intl",validation:new ValidationRegistry(),resourceGraph:null
  };
  let valid=true,runs=0;
  ProjectValidator.registerDomain(reader,"species",()=>{runs++;if(!valid)throw new Error("invalid species type");return[];});
  ProjectValidator.registerDomain(reader,"species",()=>{runs++;if(!valid)throw new Error("invalid species type");return[];});
  assert.equal(reader.validation.entries().length,1,"reopening an editor must replace, not duplicate, its domain validator");
  assert.equal(ProjectValidator.validate(reader,{snapshot:RomExport.snapshot(reader)}).valid,true);
  valid=false;
  const report=ProjectValidator.validate(reader,{snapshot:RomExport.snapshot(reader)});
  assert.equal(report.valid,false);
  assert.ok(report.errors.some(item=>item.code==="DOMAIN_species_FAILED"&&/invalid species type/.test(item.detail)));
  assert.equal(runs,2);

  const sources=await Promise.all([
    "gen1-species.js","gen1-moves.js","gen1-trainers.js","gen1-encounters.js",
    "gen2-species.js","gen2-progression.js","gen2-trainers.js","gen2-encounters.js"
  ].map(file=>read(`js/core/${file}`)));
  for(const source of sources)assert.match(source,/ProjectValidator\?\.registerDomain/);
});

test("change reports disclose the exact capability and provenance matrix", async () => {
  const source=await read("js/core/rom-export.js");
  assert.match(source,/capabilityManifest:reader\.capabilities/);
  assert.match(source,/CapabilityManifest\.WORKSPACES/);
  assert.match(source,/state:capability\.state/);
  assert.match(source,/writable:capability\.writable/);
  assert.match(source,/provenance:reader\.capabilities\.provenance/);
  assert.match(source,/resourceRequirements:capability\.resourceRequirements/);
});

test("change reports apply atomically as conflict-safe project Undo/Redo commands", () => {
  const bytes=Uint8Array.of(0,1,2,3,4,5),memory=new RomMemory(bytes);
  const reader={
    ReadOnlyMemory:bytes,memory,size:bytes.length,family:"gb",editorProfile:"gen1-rgb-intl",
    type:"blue",lang:"en",version:0,project_commands:new CommandStack()
  };
  const payload={
    format:"push-byte-patch",version:4,family:"gb",
    project:{family:"gb",profile:"gen1-rgb-intl",game:"blue",lang:"en",revision:"0"},
    ranges:[
      {offset:"0x4",length:2,previous:"04 05",next:"AA BB"},
      {offset:"0x1",length:2,previous:"01 02",next:"10 20"}
    ]
  };
  const plan=RomPatch.apply(reader,payload);
  assert.equal(plan.total,4);
  assert.deepEqual(bytes,Uint8Array.of(0,0x10,0x20,3,0xaa,0xbb));
  assert.equal(reader.project_commands.undo(),true);
  assert.deepEqual(bytes,Uint8Array.of(0,1,2,3,4,5));
  assert.equal(reader.project_commands.redo(),true);
  bytes[1]=0x99;
  assert.throws(()=>reader.project_commands.undo(),/conflicts with a later edit/);
  assert.equal(reader.project_commands.done.length,1,"a rejected undo must remain available");
  assert.equal(bytes[4],0xaa,"a conflict must reject before any range is restored");

  const fresh=Uint8Array.of(0,1,2,3),freshReader={ReadOnlyMemory:fresh,memory:new RomMemory(fresh),size:4,family:"gb",project_commands:new CommandStack()};
  assert.throws(()=>RomPatch.plan(freshReader,{format:"push-byte-patch",version:4,family:"gba",ranges:payload.ranges}),/targets GBA/);
  assert.throws(()=>RomPatch.plan(freshReader,{format:"push-byte-patch",version:4,family:"gb",ranges:[
    {offset:"0x1",length:2,previous:"01 02",next:"10 20"},
    {offset:"0x2",length:1,previous:"02",next:"30"}
  ]}),/must not overlap/);
  assert.deepEqual(fresh,Uint8Array.of(0,1,2,3));
});

test("unapplied editor drafts participate in project dirty and export guards", async () => {
  const bytes=Uint8Array.of(1,2,3),drafts=new DraftRegistry();
  drafts.register("code_editor",()=>[{kind:"source-draft",label:"SCRIPT · 0x001000",offset:0x1000}]);
  const reader={OriginalMemory:bytes.slice(),ReadOnlyMemory:bytes.slice(),drafts};
  const summary=RomExport.summary(reader);
  assert.equal(summary.bytes,0);assert.equal(summary.byteDirty,false);assert.equal(summary.dirty,true);assert.equal(summary.pending.length,1);
  assert.equal(summary.pending[0].editor,"code_editor");
  const init=await read("js/init.js"),editor=await read("js/code/editor.js"),guide=await read("doc/CODE_EDITOR.md"),usage=await read("doc/USAGE.md");
  assert.match(editor,/reader\.drafts\.register\("code_editor"/);
  assert.match(editor,/this\.reader\.drafts\.changed\("code_editor"\)/);
  assert.match(init,/addEventListener\(["']editorpendingchange["']/);
  assert.match(init,/RomExport\.summary\(romEditor\)\.dirty/);
  assert.doesNotMatch(await read("js/core/rom-export.js"),/hex_editor.*code_editor.*map_editor.*sprite_editor/);
  assert.match(guide,/Opening another ROM[^]*warns/);
  assert.match(usage,/Every registered unapplied editor draft/);
});

test("DraftRegistry aggregates every registered editor and fails closed on provider errors", () => {
  const drafts=new DraftRegistry(),unregisterCode=drafts.register("code_editor",()=>[{kind:"source-draft",label:"Script",offset:4}]);
  drafts.register("future_editor",()=>[{kind:"form-draft",label:"Unsaved form"}]);
  drafts.register("broken_editor",()=>{throw new Error("provider failed");});
  drafts.register("malformed_editor",()=>({kind:"not-an-array"}));
  assert.deepEqual(drafts.pending().map(item=>[item.editor,item.kind]),[
    ["code_editor","source-draft"],
    ["future_editor","form-draft"],
    ["broken_editor","draft-provider-error"],
    ["malformed_editor","draft-provider-error"]
  ]);
  assert.equal(drafts.has("code_editor"),true);
  assert.equal(unregisterCode(),true);
  assert.equal(unregisterCode(),false);
  assert.equal(drafts.has("code_editor"),false);
  assert.throws(()=>drafts.register("future_editor",()=>[]),/already registered/);
  drafts.clear();
  assert.equal(drafts.size,0);
});

test("replacing a ROM is guarded by the project-wide byte diff", async () => {
  const init=await read("js/init.js"),exporter=await read("js/core/rom-export.js"),commands=await read("js/core/command-stack.js"),styles=await read("scss/layout/_navigation.scss"),guide=await read("doc/USAGE.md");
  assert.match(exporter,/static async confirmDiscard/);
  assert.match(exporter,/changed .*byte/);
  assert.match(init,/await RomExport\.confirmDiscard\(romEditor\)/);
  assert.match(init,/editorhistorychange/);
  assert.match(commands,/new CustomEvent\(["']editorhistorychange/);
  assert.match(styles,/has-unsaved::after/);
  assert.match(guide,/project-wide confirmation/);
});

test("GBA block commands serialize the packed block and elevation word into ROM bytes", async () => {
  const gba=await read("js/map/editor-map.js"),map=await read("js/map/map.js"),attributes=await read("js/structures/gba/metatile-attributes.js"),context=await read("js/map/context-menu.js"),runtime=await read("js/rom/runtime/gba.js"),guide=await read("doc/MAP_EDITOR.md"),structures=await read("doc/STRUCTURES.md");
  assert.match(gba,/map\.getStructureOffset\(\)\+\(y\*map\.getWidth\(\)\+x\)\*2/);
  assert.match(gba,/MemoryUtils\.replace\(this\.reader\.memory,offset[^]*Map block changed after this command/);
  assert.doesNotMatch(gba,/ReadOnlyMemory\[offset(?:\+1)?\]\s*=/);
  assert.match(map,/getBlockHeight/);
  assert.match(map,/MapBlockUtils\.gbaWithElevation/);
  assert.match(gba,/setBlockElevation\(x,y,elevation/);
  assert.match(gba,/metatileAttribute\(block,map=this\.current_map\)/);
  assert.match(gba,/setBlockProperties\(point,resolved,values/);
  assert.match(gba,/GbaMetatileAttribute\.encode/);
  assert.match(gba,/do:\(\)=>apply\(previousWord,nextWord,previousRaw,nextRaw\),undo:\(\)=>apply\(nextWord,previousWord,nextRaw,previousRaw\)/);
  assert.match(gba,/Set elevation/);
  assert.match(gba,/map\.height_map=undefined/);
  assert.match(context,/Edit block properties/);
  assert.match(context,/name===["']properties["']\?enabled!==true/);
  assert.match(runtime,/js\/core\/map-block-utils\.js/);
  assert.match(runtime,/structures\/gba\/metatile-attributes\.js/);
  assert.match(attributes,/mask:0x000001ff/);
  assert.match(attributes,/mask:0x60000000/);
  assert.match(guide,/Edit block properties/);
  assert.match(guide,/full 32-bit record/);
  assert.match(structures,/FireRed\/LeafGreen reverse those two fields/);
});

test("MapBlockUtils safely composes GBA metatile and elevation bits", () => {
  const packed=MapBlockUtils.gbaPack(0x2cd,0x2a);
  assert.equal(packed,0xaacd);
  assert.equal(MapBlockUtils.gbaIndex(packed),0x2cd);
  assert.equal(MapBlockUtils.gbaElevation(packed),0x2a);
  assert.equal(MapBlockUtils.gbaWithIndex(packed,0x123),0xa923);
  assert.equal(MapBlockUtils.gbaWithElevation(packed,3),0x0ecd);
  assert.equal(MapBlockUtils.offset(0x100,20,4,3,2),0x180);
  assert.throws(()=>MapBlockUtils.gbaPack(0x400,0),/block index/);
  assert.throws(()=>MapBlockUtils.gbaPack(0,0x40),/block elevation/);
  assert.throws(()=>MapBlockUtils.offset(0,4,4,0,2),/outside/);
});

test("MapBlockUtils preserves Crystal's four native collision quadrants", async () => {
  assert.equal(MapBlockUtils.gen2CollisionOffset(0x4000,0x12),0x4048);
  assert.deepEqual(MapBlockUtils.gen2Collision([0x10,0x20,0x30,0x40]),Uint8Array.of(0x10,0x20,0x30,0x40));
  assert.throws(()=>MapBlockUtils.gen2Collision([1,2,3]),/exactly four/);
  assert.throws(()=>MapBlockUtils.gen2Collision([0,0,0,256]),/collision value/);
  assert.throws(()=>MapBlockUtils.gen2CollisionOffset(0,128),/metatile/);
  const editor=await read("js/map/gen2/editor.js"),runtime=await read("js/rom/runtime/gen2.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(editor,/setBlockCollision\(block,values\)/);
  assert.match(editor,/MapBlockUtils\.gen2CollisionOffset/);
  assert.match(editor,/this\.structureWriter\.replaceCommand\(this\.editor\.commands/);
  assert.match(editor,/Edit collision/);
  assert.match(editor,/\["pick","fill","properties","center","copy"\]/);
  assert.match(runtime,/js\/core\/map-block-utils\.js/);
  assert.match(guide,/four native collision bytes/);
});

test("Gen I collision tables grow within their bank and restore pointer plus bytes", () => {
  const bytes=new Uint8Array(0x8000);bytes.fill(0);bytes.fill(0xff,0x5000);
  const memory=new GbcMemory(bytes),writer=new GbcCollisionTableWriter(memory),tileset={id:1,offset:0x100,bank:1,collision:0x4100};
  memory.view.setUint16(tileset.offset+5,0x4100,true);bytes.set([1,2,0xff],tileset.collision);
  const grow=writer.plan({tileset,tiles:[3,2,1]});
  assert.equal(grow.previous.length,3);
  assert.deepEqual(grow.nextTiles,[1,2,3]);
  assert.equal(grow.patch.relocated,true);
  const target=writer.apply(grow);
  assert.equal(Math.floor(target/GbcMemory.BANK_SIZE),1);
  assert.deepEqual(writer.read(target).tiles,[1,2,3]);
  assert.notEqual(memory.u16(tileset.offset+5),0x4100);
  writer.restore(grow);
  assert.equal(memory.u16(tileset.offset+5),0x4100);
  assert.deepEqual(writer.read(tileset.collision).tiles,[1,2]);
  assert.ok(memory.slice(target,grow.patch.nextBytes.length).every(byte=>byte===0xff));

  const shrink=writer.plan({tileset,tiles:[2]});
  assert.equal(shrink.patch.relocated,false);
  writer.apply(shrink);assert.deepEqual(writer.read(tileset.collision).tiles,[2]);
  writer.restore(shrink);assert.deepEqual(writer.read(tileset.collision).tiles,[1,2]);
  assert.throws(()=>writer.encode([0xff]),/0\.\.254/);
});

test("Gen I block properties edit shared passable tiles through boolean form controls", async () => {
  const driver=await read("js/map/gbc/editor.js"),writer=await read("js/structures/gbc/collision-writer.js"),dialog=await read("js/core/dialog.js"),styles=await read("scss/components/_dialog.scss"),runtime=await read("js/rom/runtime/gbc.js"),registry=await read("js/structures/gbc/registry.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(driver,/new GbcCollisionTableWriter/);
  assert.match(driver,/type:"checkbox"/);
  assert.match(driver,/setCollisionTiles\(tiles\)/);
  assert.match(driver,/collisionTableWriter\.apply\(plan\)/);
  assert.match(driver,/collisionTableWriter\.restore\(plan\)/);
  assert.match(writer,/reference:\{kind:"gbc16",pointerOffset:tileset\.offset\+5,bank:tileset\.bank\}/);
  assert.match(dialog,/field\.type===["']checkbox["']\?input\.checked/);
  assert.match(styles,/app-dialog__field--checkbox/);
  assert.match(runtime,/structures\/gbc\/collision-writer\.js/);
  assert.match(registry,/collisionWriter:GbcCollisionTableWriter/);
  assert.match(guide,/native passable-tile list/);
});

test("all editor File menus expose ROM download and change reports in both experiences", async () => {
  const init=await read("js/init.js"),html=await read("index.html");
  assert.match(init,/Download edited ROM/);
  assert.match(init,/RomExport\.rom\(romEditor\)/);
  assert.match(init,/Export change report/);
  assert.match(init,/RomExport\.report\(romEditor\)/);
  assert.match(init,/Import change report/);
  assert.match(init,/RomExport\.importReport\(romEditor/);
  assert.match(init,/projectHistoryLabel/);
  assert.match(init,/command\?\.label\|\|["']project change["']/);
  assert.doesNotMatch(init,/Export change report…["'],complexity:["']advanced/);
  assert.match(init,/beforeunload/);
  assert.match(html,/js\/core\/rom-export\.js/);
});

test("Hex Editor writes real ROM bytes through reversible commands", () => {
  const bytes=Uint8Array.of(0x10,0x20,0x30),memory=new RomMemory(bytes),reader={ReadOnlyMemory:bytes,memory,isROMOffset:offset=>memory.contains(offset),getByte:offset=>memory.u8(offset)};
  const editor=Object.create(EHex.prototype);editor.reader=reader;editor.hexBuffer=Array.from({length:256},(_,byte)=>byte.toString(16).toUpperCase().padStart(2,"0"));editor.updateCell=()=>{};editor.updateStatus=()=>{};editor.commands=new CommandStack();
  assert.equal(editor.writeByte(1,0xab),true);
  assert.equal(bytes[1],0xab);
  editor.commands.undo();assert.equal(bytes[1],0x20);
  editor.commands.redo();assert.equal(bytes[1],0xab);
  MemoryUtils.write(memory,1,"u8",0xcd);
  assert.throws(()=>editor.commands.undo(),/changed after this command/);
  assert.equal(bytes[1],0xcd);
  assert.equal(editor.commands.done.length,1,"the conflicting command must remain available");
});

test("Hex Editor hides technical navigation without gating byte-edit capability", async () => {
  const hex=await read("js/hex/editor-hex.js"),reader=await read("js/rom_reader.js"),html=await read("hex.html"),guide=await read("doc/HEX_EDITOR.md");
  assert.match(hex,/const dataset=\{byteOffset:String\(absolute\)\}/);
  assert.match(hex,/this\.commands\.execute/);
  assert.doesNotMatch(hex,/editorPreferences\.experience/);
  assert.match(hex,/this\.area===["']text["']/);
  assert.match(hex,/navigator\.clipboard/);
  assert.match(reader,/hex_editor\.writeByte/);
  assert.match(reader,/hex_editor\.writeText/);
  assert.match(html,/id=["']hex_status["']/);
  assert.match(guide,/two-nibble byte entry/);
  assert.match(guide,/Both modes\s+can produce the same byte edits/);
  assert.doesNotMatch(hex,/innerHTML\s*=/);
});

test("Hex Editor header controls real translation and mirrored layout state", async () => {
  const editor=await read("js/hex/editor-hex.js"),init=await read("js/init.js"),registry=await read("js/core/editor-descriptor-registry.js"),html=await read("hex.html"),style=await read("scss/editors/_hex.scss");
  assert.match(editor,/toggleTranslation\(force=!this\.translationVisible\)/);
  assert.match(editor,/toggleMirror\(force=!this\.mirrored\)/);
  assert.match(editor,/CustomEvent\("hexviewchange"/);
  assert.match(init,/Text translation[^]*isTranslationVisible[^]*toggleTranslation/);
  assert.match(init,/Mirror layout[^]*isMirrored[^]*toggleMirror/);
  assert.match(init,/refreshEvents:\["hexviewchange"\]/);assert.match(registry,/addEventListener\(event,\(\)=>header\.render\(\)\)/);
  assert.match(html,/id="hex_toggle_text"[^]*aria-pressed="true"/);
  assert.match(html,/id="hex_toggle_mirror"[^]*aria-pressed="false"/);
  assert.match(html,/data-ui-toolbar="Memory view"/);
  assert.match(html,/id="memory_search"/);
  assert.doesNotMatch(html,/<h1>Translation<\/h1>/);
  assert.match(style,/#hex_content\.is-mirrored/);
  assert.doesNotMatch(init,/#hex_editor > nav a/);
});

test("Hex Editor pastes family text or raw bytes as one reversible range command", async () => {
  const bytes=Uint8Array.of(0,0,0,0,0,0),memory=new RomMemory(bytes),dictionary=[];dictionary[0x80]="A";dictionary[0x81]="B";dictionary[0x52]="<PLAYER>";
  const editor=Object.create(EHex.prototype);editor.reader={memory,ReadOnlyMemory:bytes,getByte:offset=>bytes[offset]};editor.commands=new CommandStack();editor.current=0;editor.head=1;editor.anchor=1;editor.pendingNibble=null;editor.dictionary=()=>dictionary;editor.pageSize=()=>16;editor.updateCell=()=>{};editor.renderSelection=()=>{};editor.updateStatus=()=>{};editor.go=()=>editor;
  assert.deepEqual(editor.decodeHexPaste("0xA9, 00 ff"),Uint8Array.of(0xa9,0,0xff));
  assert.deepEqual(editor.encodeText("<PLAYER>AB"),Uint8Array.of(0x52,0x80,0x81));
  assert.equal(editor.writeSequence(1,Uint8Array.of(0xaa,0xbb,0xcc),"Paste bytes"),true);
  assert.deepEqual(bytes,Uint8Array.of(0,0xaa,0xbb,0xcc,0,0));
  assert.equal(editor.commands.done.length,1);
  editor.commands.undo();assert.deepEqual(bytes,Uint8Array.of(0,0,0,0,0,0));
  editor.commands.redo();assert.deepEqual(bytes,Uint8Array.of(0,0xaa,0xbb,0xcc,0,0));
  editor.area="hex";editor.head=1;
  assert.equal(editor.paste("11 22"),true);
  assert.deepEqual(bytes,Uint8Array.of(0,0x11,0x22,0xcc,0,0));
  assert.throws(()=>editor.writeSequence(5,Uint8Array.of(1,2),"Invalid"),/ROM range/);
  assert.throws(()=>editor.decodeHexPaste("A 00"),/complete byte pairs/);
  assert.throws(()=>editor.encodeText("C"),/not available/);
  const gbc=await read("js/rom/runtime/gbc.js"),table=JSON.parse(await read("decrypt/text_table_gen1_en.json")),guide=await read("doc/HEX_EDITOR.md"),init=await read("js/init.js");
  assert.match(gbc,/text_table_gen1_en\.json/);assert.equal(table["80"],"A");assert.equal(table["A0"],"a");assert.equal(table["F6"],"0");
  assert.match(init,/label:"Paste"/);assert.match(guide,/Edit → Paste/);assert.match(guide,/pret\/pokered/);
});

test("Hex Editor offset/text search drives both Enter and the visible find button", async () => {
  const bytes=Uint8Array.of(0x80,0x81,0,0x80,0x81,0),memory=new RomMemory(bytes),dictionary=[];dictionary[0x80]="A";dictionary[0x81]="B";
  const editor=Object.create(EHex.prototype);
  Object.assign(editor,{reader:{memory,size:bytes.length},head:0,anchor:0,area:"hex",pendingNibble:null,current:0});
  editor.dictionary=()=>dictionary;
  editor.elements={status:{textContent:""},search:{value:"AB"}};
  editor.go=function(offset){this.current=offset;return this;};
  assert.equal(editor.search("AB"),3);
  assert.deepEqual(editor.selection(),{start:3,end:4});
  assert.equal(editor.area,"text");
  assert.match(editor.elements.status.textContent,/search again/);
  assert.equal(editor.search("AB"),0,"text search should wrap after the final match");
  assert.equal(editor.search("$2"),2);
  assert.equal(editor.area,"hex");

  const source=await read("js/hex/editor-hex.js"),html=await read("hex.html"),guide=await read("doc/HEX_EDITOR.md");
  assert.match(source,/searchButton.*addEventListener\(["']click["']/);
  assert.match(source,/MemoryUtils\.find/);
  assert.match(html,/aria-label="Find next"/);
  assert.match(guide,/search again from its end/);
});

test("Gen I Hex, Code, and preview text share one authoritative token table", async () => {
  const raw=JSON.parse(await read("decrypt/text_table_gen1_en.json")),dictionary=[];
  for(const [byte,token] of Object.entries(raw))dictionary[parseInt(byte,16)]=token;
  const table=new TextTableCodec(dictionary),source="<PLAYER> DON'T #";
  const encoded=table.encode(source);
  assert.equal(table.decode(encoded),source);
  assert.deepEqual(table.encode("'d'l's't'v'r'm"),Uint8Array.of(0xbb,0xbc,0xbd,0xbe,0xbf,0xe4,0xe5));
  assert.equal(table.decodeByte(0x54),"#");
  const reader={memory:new GbcMemory(Uint8Array.of(...encoded,0x50)),size:encoded.length+1,textDictionary:"text_table_gen1_en",getDictionary:()=>dictionary};
  const script=new GbcTextScriptCodec(reader);
  assert.deepEqual(script.encodeString(source,0),encoded);
  assert.equal(script.character(0x54),"#");
  const preview=new GbcTextCodec(reader.memory,dictionary);
  assert.equal(preview.character(0x54),"POKé");
  const previewMemory=new GbcMemory(Uint8Array.of(0x80,0x4f,0x81,0x50));
  assert.equal(new GbcTextCodec(previewMemory,dictionary).decode(0),"A\nB");
  const hex=await read("js/hex/editor-hex.js"),code=await read("js/code/scripts/gbc-text-script.js"),text=await read("js/structures/gbc/text.js"),architecture=await read("doc/ARCHITECTURE.md");
  for(const sourceFile of [hex,code,text])assert.match(sourceFile,/TextTableCodec/);
  assert.match(architecture,/js\/core\/text-table\.js/);
});

test("StructureWriter validates and writes signed little-endian event fields", () => {
  const bytes=new Uint8Array(8),memory=new RomMemory(bytes),writer=new StructureWriter(memory);
  writer.fields(0,{x:{offset:0,type:"s16"},y:{offset:2,type:"s16"},kind:{offset:4,type:"u8"}},{x:-2,y:300,kind:7});
  assert.deepEqual(Array.from(bytes.slice(0,5)),[0xfe,0xff,0x2c,0x01,7]);
  assert.throws(()=>writer.write(0,"u8",256),RangeError);
  assert.throws(()=>writer.write(0,"s16",-32769),RangeError);
});

test("EditUtils and StructureWriter simplify reversible structure edits", () => {
  const bytes=new Uint8Array(4),memory=new RomMemory(bytes),writer=new StructureWriter(memory),stack=new CommandStack();
  const model={x:1,y:2},schema={x:{offset:0,type:"u8",label:"X"},y:{offset:1,type:"u8",label:"Y"}};
  assert.equal(writer.edit(stack,{base:0,schema,current:model,values:{x:9},afterWrite:values=>Object.assign(model,values)}),true);
  assert.deepEqual({bytes:Array.from(bytes.slice(0,2)),model}, {bytes:[9,2],model:{x:9,y:2}});
  stack.undo();
  assert.deepEqual({bytes:Array.from(bytes.slice(0,2)),model}, {bytes:[1,2],model:{x:1,y:2}});
  assert.equal(writer.edit(stack,{base:0,schema,current:model,values:{x:1,y:2}}),false);
});

test("StructureWriter range commands reject overlapping edits without partial Undo", () => {
  const bytes=Uint8Array.of(1,2,3,4),memory=new RomMemory(bytes),writer=new StructureWriter(memory),stack=new CommandStack();
  let model="before";
  writer.replaceCommand(stack,{
    label:"Atomic pair",
    patches:[
      {offset:0,previous:Uint8Array.of(1),next:Uint8Array.of(9)},
      {offset:2,previous:Uint8Array.of(3),next:Uint8Array.of(7)}
    ],
    afterApply:()=>{model="after";},afterUndo:()=>{model="before";}
  });
  assert.deepEqual([...bytes],[9,2,7,4]);assert.equal(model,"after");
  bytes[2]=6;
  const conflicted=bytes.slice();
  assert.throws(()=>stack.undo(),/Structure changed after this command/);
  assert.deepEqual(bytes,conflicted);
  assert.equal(model,"after");
  assert.equal(stack.done.length,1);
  bytes[2]=7;assert.equal(stack.undo(),true);
  assert.deepEqual([...bytes],[1,2,3,4]);assert.equal(model,"before");
});

test("EditUtils reports history conflicts without losing the command", () => {
  const stack=new CommandStack(),previousHandler=globalThis.NotificationHandler,previousType=globalThis.NotificationType;
  let notice=null;
  globalThis.NotificationType={ERROR:"error"};
  globalThis.NotificationHandler={pop:(title,message,type)=>{notice={title,message,type};}};
  try{
    stack.execute({label:"Guarded edit",do(){},undo(){throw new Error("Overlapping bytes changed");}});
    assert.equal(EditUtils.history(stack,"undo",{title:"Hex history"}),false);
    assert.equal(stack.done.length,1);
    assert.deepEqual(notice,{title:"Hex history",message:"Overlapping bytes changed",type:"error"});
  }finally{
    globalThis.NotificationHandler=previousHandler;
    globalThis.NotificationType=previousType;
  }
});

test("StructureWriter edit schemas serialize logical values without leaking storage offsets", () => {
  const bytes=new Uint8Array(2),memory=new RomMemory(bytes),writer=new StructureWriter(memory),stack=new CommandStack(),model={x:3};
  const schema={x:{offset:0,type:"u8",serialize:value=>value+4}};
  writer.edit(stack,{base:0,schema,current:model,values:{x:9},afterWrite:values=>Object.assign(model,values)});
  assert.equal(bytes[0],13);
  assert.equal(model.x,9);
  stack.undo();
  assert.equal(bytes[0],7);
  assert.equal(model.x,3);
});

test("GB/GBC map editing preserves Gen I block and variable event layouts", async () => {
  const editor=await read("js/map/gbc/editor.js"),runtime=await read("js/rom/runtime/gbc.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(runtime,/capabilities\.full/);
  assert.match(editor,/this\.current\.header\.blocks\+index/);
  assert.match(editor,/Fill \$\{indices\.length\} blocks/);
  assert.match(editor,/fillSelections\(block=this\.selected_block\)/);
  assert.match(editor,/new MapSelection\(point\)/);
  assert.match(editor,/name===["']fill-selection["']/);
  assert.match(editor,/serialize:value=>value\+4/);
  assert.match(editor,/serialize:value=>event\.kind\|\(value&0x3f\)/);
  assert.match(editor,/destinationWarpId/);
  assert.match(editor,/trainerClass/);
  assert.match(editor,/itemId/);
  assert.match(guide,/one-byte Gen I blocks/);
});

test("Gen I Map requires the active profile's exact roots without retail fallbacks",async()=>{
  const editor=await read("js/map/gbc/editor.js");
  assert.match(editor,/requireSourceSymbol\("MapHeaderPointers"\)\.offset/);
  assert.match(editor,/requireSourceSymbol\("MapHeaderBanks"\)\.offset/);
  assert.doesNotMatch(editor,/gbMetadata\?\.map_header|0x1ae/);
  assert.doesNotMatch(editor,/findBankTable\(this\.memory,this\.pointerTable\(\)\)/);
});

test("Map side panels own bounded space and the Gen I border stays a compact native block", async () => {
  const [workspace,editor,panelStyles,mapStyles,guide]=await Promise.all([
    read("js/map/workspace.js"),
    read("js/map/gbc/editor.js"),
    read("scss/components/_panel.scss"),
    read("scss/editors/_map-layout.scss"),
    read("doc/UX_GUIDELINES.md")
  ]);
  assert.match(workspace,/ui-panel-stack/);
  assert.match(workspace,/ui-panel--fill/);
  assert.match(workspace,/ui-panel--bounded/);
  assert.match(panelStyles,/\.ui-panel-stack/);
  assert.match(panelStyles,/\.ui-panel--fill/);
  assert.match(panelStyles,/\.ui-panel--bounded/);
  assert.match(mapStyles,/#map_banks[\s\S]*overflow:\s*hidden/);
  assert.match(editor,/width:"32",height:"32"/);
  assert.match(editor,/width:210/);
  assert.doesNotMatch(editor,/width:"256",height:"512"/);
  assert.match(guide,/a long Maps list must not[\s\S]*merge with Encounters, History or Properties/);
});

test("GBA event dragging commits one serialized undoable structure command", async () => {
  const editor=await read("js/map/editor-map.js"),inspector=await read("js/map/event-inspector.js"),entities=await read("js/map/entities.js");
  assert.match(editor,/moveEvent\(entity,x,y/);
  assert.match(editor,/entity instanceof Overworld\?4:0/);
  assert.match(editor,/type:"s16"/);
  assert.match(editor,/this\.eventDrag/);
  assert.match(editor,/this\.structureWriter\.edit\(this\.editor\.commands/);
  assert.match(inspector,/\.\.\.primitives\(event\.properties\),\.\.\.primitives\(event\)/);
  assert.match(entities,/setX\(_x\)\{ this\.x = _x/);
});

test("GBA event property forms serialize safe fields as one reversible command", async () => {
  const editor=await read("js/map/editor-map.js"),inspector=await read("js/map/event-inspector.js"),dialog=await read("js/core/dialog.js"),styles=await read("scss/components/_dialog.scss"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(editor,/eventFieldSchema\(entity\)/);
  assert.match(editor,/updateEventFields\(entity,values\)/);
  for(const field of ["Sprite","Elevation","Destination warp","Trigger variable","Signpost type"])assert.ok(editor.includes(field));
  assert.match(editor,/this\.structureWriter\.edit\(this\.editor\.commands/);
  assert.match(inspector,/Edit properties/);
  assert.match(inspector,/AppDialog\.form/);
  assert.match(inspector,/type:"number"[^]*min:field\.min[^]*max:field\.max/);
  assert.match(dialog,/field\.type===["']number["']\?input\.valueAsNumber/);
  assert.match(styles,/app-dialog__fields/);
  assert.match(guide,/safe in-place fields/);
});

test("GBA event table plans relocate entries and restore count and pointer exactly", () => {
  const bytes=new Uint8Array(512);bytes.fill(0xff);bytes.fill(0,0,88);
  const view=new DataView(bytes.buffer);bytes[0]=1;view.setUint32(4,0x08000040,true);bytes[64]=1;
  const memory=new GbaMemory(bytes),writer=new GbaEventTableWriter(memory),entry=writer.entry(0,{x:7,y:9,localId:2}),plan=writer.insert(0,0,entry);
  assert.equal(entry.length,24);assert.equal(entry[0],2);assert.equal(new DataView(entry.buffer).getInt16(4,true),7);
  writer.apply(plan);
  assert.equal(memory.u8(0),2);assert.equal(memory.pointer(4),plan.allocation);
  assert.deepEqual(Array.from(memory.slice(plan.allocation+24,24)),Array.from(entry));
  writer.restore(plan);
  assert.equal(memory.u8(0),1);assert.equal(memory.pointer(4),64);
  assert.ok(Array.from(memory.slice(plan.allocation,48)).every(byte=>byte===0xff));
});

test("GBA map event creation and deletion use the relocatable table library", async () => {
  const editor=await read("js/map/editor-map.js"),runtime=await read("js/rom/runtime/gba.js"),map=await read("js/map/map.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(runtime,/js\/structures\/gba\/event-writer\.js/);
  assert.match(map,/eventsHeaderOffset/);
  assert.match(editor,/this\.eventTableWriter\.insert/);
  assert.match(editor,/this\.eventTableWriter\.remove/);
  assert.match(editor,/rebaseEventTable\(map,type/);
  assert.match(editor,/confirmDeleteEvent\(entity\)/);
  assert.match(guide,/fixed-stride table/);
});

test("GB/GBC object-block plans stay in-bank and preserve variable records", () => {
  const bytes=new Uint8Array(0x10000);bytes.fill(0xff);
  const memory=new GbcMemory(bytes),header={offset:0x4100,size:12,bank:1},pointerOffset=header.offset+header.size-2;
  memory.view.setUint16(pointerOffset,0x4200,true);
  bytes.set([5,1,8,9,2,3,1,4,6,7,1,9,12,11,1,2,3],0x4200);
  const events=GbcMapObjectBlock.read(memory,0x4200),writer=new GbcEventBlockWriter(memory),entry=writer.entry("Object",{x:10,y:12}),plan=writer.insert(header,events,"Object",entry);
  assert.ok(plan.allocation>=0x4000&&plan.allocation<0x8000);
  writer.apply(plan);
  assert.equal(memory.banked(1,memory.u16(pointerOffset)),plan.allocation);
  const expanded=GbcMapObjectBlock.read(memory,plan.allocation);
  assert.equal(expanded.warpCount,1);assert.equal(expanded.bgCount,1);assert.equal(expanded.objectCount,2);
  assert.deepEqual([expanded.objects[0].size,expanded.objects[1].x,expanded.objects[1].y],[6,10,12]);
  writer.restore(plan);
  assert.equal(memory.u16(pointerOffset),0x4200);
  assert.ok(Array.from(memory.slice(plan.allocation,plan.nextBytes.length)).every(byte=>byte===0xff));
});

test("GB/GBC map event creation exposes only structures present in Gen I", async () => {
  const editor=await read("js/map/gbc/editor.js"),runtime=await read("js/rom/runtime/gbc.js"),init=await read("js/init.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(runtime,/js\/structures\/gbc\/event-writer\.js/);
  assert.match(editor,/canCreateEvent\(type\)/);
  assert.match(editor,/this\.eventBlockWriter\.insert/);
  assert.match(editor,/this\.eventBlockWriter\.remove/);
  assert.match(editor,/same ROM bank/);
  assert.match(init,/canCreateEvent/);
  assert.match(guide,/variable-size object block/);
});

test("replacing a ROM destroys editor listeners and GBA owns one cancellable render loop", async () => {
  const reader=await read("js/rom_reader.js"),hex=await read("js/hex/editor-hex.js"),code=await read("js/code/editor.js"),sprite=await read("js/sprite/editor.js"),gba=await read("js/map/editor-map.js"),gbc=await read("js/map/gbc/editor.js"),battle=await read("js/battle/editor.js"),battleTimeline=await read("js/battle/timeline.js"),pokedex=await read("js/pokedex/editor.js"),moves=await read("js/moves/editor.js"),sound=await read("js/sound/editor.js"),animation=await read("js/animation/editor.js"),animationTimeline=await read("js/animation/timeline.js"),emulator=await read("js/emulator/editor.js"),workspace=await read("js/map/workspace.js"),architecture=await read("doc/ARCHITECTURE.md");
  assert.match(reader,/this\.destroyEditors\(\)/);
  assert.match(reader,/editor\?\.destroy\?\.\(\)/);
  for(const source of [hex,code,sprite,gba,gbc,battle,battleTimeline,pokedex,moves,sound,animation,animationTimeline,emulator]){assert.match(source,/new EventScope\(\)/);assert.match(source,/scope\.destroy\(\)/);}
  assert.match(gba,/this\.animationFrame=this\.scope\.frame/);
  assert.match(gba,/this\.scope\.cancelFrame\(this\.animationFrame\)/);
  assert.doesNotMatch(gba,/requestAnimationFrame\(\(\)=>this\.render\(ctx\)\)/);
  assert.doesNotMatch(gba,/\$\(/);
  assert.match(workspace,/this\.viewport\.onwheel=null/);
  assert.match(architecture,/RomReader\.resetLoadedState\(\)[^]*destroyEditors\(\)/);
});

test("ROM replacement resets every family object before asynchronous loading and after failure", async () => {
  const reader=await read("js/rom_reader.js"),init=await read("js/init.js");
  assert.match(reader,/async loadROM\(file\)[^]*try\{[^]*this\.resetLoadedState\(\);[^]*file\.arrayBuffer\(\)/);
  assert.match(reader,/catch\(error\)\{[^]*this\.resetLoadedState\(\)/);
  assert.match(reader,/resetLoadedState\(\)\{[^]*this\.destroyEditors\(\)/);
  for(const field of ["ReadOnlyMemory","OriginalMemory","memory","structureRegistry","runtime","dictionary","items","family","editorProfile","textDictionary"]){
    assert.match(reader,new RegExp(`this\\.${field}=`));
  }
  assert.match(reader,/dispatchEvent\(new CustomEvent\("romreset"\)\)/);
  assert.match(await read("js/core/editor-descriptor-registry.js"),/className:`icon-\$\{descriptor\.icon\} disabled`/);
  assert.match(init,/window\.addEventListener\("romreset"[^]*textContent="Open ROM"/);
  assert.match(init,/romreset"[^]*EDITORS\.resetNavigation\(elements\.navigation\)[^]*editor_area[^]*updateDirtyUi\(\)/);
  assert.match(await read("js/core/editor-descriptor-registry.js"),/setAttribute\("aria-disabled","true"\)/);
});

test("EventScope simplifies listener and cleanup ownership", () => {
  const scope=new EventScope(),target=new EventTarget();let events=0,cleanups=0;
  scope.listen(target,"change",()=>events++);
  scope.cleanup(()=>cleanups++);
  target.dispatchEvent(new Event("change"));
  scope.destroy();scope.destroy();
  target.dispatchEvent(new Event("change"));
  assert.deepEqual({events,cleanups,destroyed:scope.destroyed},{events:1,cleanups:1,destroyed:true});
});

test("KeyboardUtils unifies editor undo/redo without stealing native field editing", async () => {
  assert.equal(KeyboardUtils.command({key:"z",ctrlKey:true,shiftKey:false,target:null}),"undo");
  assert.equal(KeyboardUtils.command({key:"Z",metaKey:true,shiftKey:true,target:null}),"redo");
  assert.equal(KeyboardUtils.command({key:"y",ctrlKey:true,target:null}),"redo");
  assert.equal(KeyboardUtils.command({key:"z",ctrlKey:true,altKey:true,target:null}),null);
  const editable={nodeType:1,closest:selector=>selector.includes("textarea")?editable:null};
  assert.equal(KeyboardUtils.command({key:"z",metaKey:true,target:editable}),null);
  const sources=await Promise.all(["js/hex/editor-hex.js","js/code/editor.js","js/sprite/editor.js","js/map/editor.js"].map(read));
  for(const source of sources)assert.match(source,/KeyboardUtils\.command\(event\)/);
  assert.match(sources[0],/KeyboardUtils\.isEditableTarget\(event\.target\)/);
  assert.match(await read("index.html"),/core\/keyboard-utils\.js/);
});

test("AllocationLedger prevents protected overlap, double reservation, and unsafe redo", () => {
  const bytes=new Uint8Array(0x300);bytes.fill(0xff,0x80);
  const memory=new RomMemory(bytes),firstAllocator=new RomAllocator(memory),secondAllocator=new RomAllocator(memory);
  const ledger=AllocationLedger.forMemory(memory);
  ledger.protect(0x80,0x20,{owner:"fixture:header",reason:"Known source-owned bytes"});
  const first=firstAllocator.reserve(0x20,{start:0x80,alignment:1,minimumRun:0x20,owner:"fixture:first"});
  const second=secondAllocator.reserve(0x20,{start:0x80,alignment:1,minimumRun:0x20,owner:"fixture:second"});
  assert.equal(first.offset,0xa0);
  assert.equal(second.offset,0xc0);
  assert.throws(()=>ledger.own(0x90,0x20,{owner:"fixture:overlap"}),/overlaps protected 'fixture:header'/);
  assert.equal(ledger.snapshot().length,3);
  assert.equal(ledger.release(first),true);
  const replacement=secondAllocator.reserve(0x20,{start:0x80,alignment:1,minimumRun:0x20,owner:"fixture:replacement"});
  assert.equal(replacement.offset,0xa0);
  assert.throws(()=>ledger.acquire(first),/overlaps reservation 'fixture:replacement'/);
  ledger.release(replacement);
  ledger.acquire(first);
  assert.equal(ledger.entry(first)?.owner,"fixture:first");
});

test("verified graph ranges synchronize into a replaceable allocation scope", async () => {
  const bytes=new Uint8Array(0x200);bytes.fill(0xff);
  const memory=new RomMemory(bytes),ledger=AllocationLedger.forMemory(memory);
  ledger.syncProtected("resource-graph",[
    {offset:0x80,length:0x20},
    {offset:0x90,length:0x20},
    {offset:0xc0,length:0x10}
  ],{owner:"verified resource graph"});
  const protectedRanges=ledger.snapshot().filter(range=>range.scope==="resource-graph");
  assert.deepEqual(protectedRanges.map(range=>[range.offset,range.length]),[[0x80,0x30],[0xc0,0x10]]);
  const allocator=new RomAllocator(memory);
  const between=allocator.reserve(0x10,{start:0x80,alignment:1,minimumRun:0x10,owner:"fixture:between"});
  assert.equal(between.offset,0xb0);
  ledger.syncProtected("resource-graph",[{offset:0xe0,length:0x10}],{owner:"verified resource graph"});
  assert.deepEqual(ledger.snapshot().filter(range=>range.scope==="resource-graph").map(range=>[range.offset,range.length]),[[0xe0,0x10]]);
  const reclaimed=allocator.reserve(0x10,{start:0x80,alignment:1,minimumRun:0x10,owner:"fixture:reclaimed"});
  assert.equal(reclaimed.offset,0x80);
  const readerSource=await read("js/rom_reader.js");
  assert.match(readerSource,/set resourceGraph\(graph\)[^]*node\.accuracy==="verified"[^]*edge\.confidence==="verified"[^]*syncProtected\("resource-graph"/);
  assert.match(readerSource,/ManifestResourceGraph\.build\(this\.memoryProfile\)/);
  assert.match(readerSource,/_manifestResourceGraph[^]*ResourceGraphBuilder\(\)[^]*addGraph\(this\._manifestResourceGraph\)[^]*addGraph\(graph\)/);
});

test("RelocatablePatch reservations survive apply, release on Undo, and reacquire on Redo", () => {
  const bytes=new Uint8Array(0x300);bytes.fill(0);bytes.fill(0xff,0x100);
  const memory=new GbaMemory(bytes);
  memory.view.setUint32(0x10,GbaMemory.ROM_BASE+0x20,true);
  memory.view.setUint32(0x14,GbaMemory.ROM_BASE+0x30,true);
  bytes.set([1],0x20);bytes.set([2],0x30);
  const firstPatcher=new RelocatablePatch(memory),secondPatcher=new RelocatablePatch(memory);
  const first=firstPatcher.plan({offset:0x20,previousLength:1,nextBytes:new Uint8Array(40).fill(3),reference:{kind:"gba32",pointerOffset:0x10}});
  const second=secondPatcher.plan({offset:0x30,previousLength:1,nextBytes:new Uint8Array(40).fill(4),reference:{kind:"gba32",pointerOffset:0x14}});
  assert.notEqual(first.target,second.target);
  firstPatcher.apply(first);
  firstPatcher.restore(first);
  assert.equal(AllocationLedger.forMemory(memory).entry(first.reservation),null);
  firstPatcher.apply(first);
  assert.equal(memory.pointer(0x10),first.target);
  firstPatcher.restore(first);
  secondPatcher.apply(second);
  secondPatcher.restore(second);
});

test("RelocatablePatch moves oversized GBA scripts and restores their pointer", () => {
  const bytes=new Uint8Array(0x400);bytes.fill(0);bytes.fill(0xff,0x100);
  const memory=new GbaMemory(bytes),patcher=new RelocatablePatch(memory);
  memory.view.setUint32(0x10,GbaMemory.ROM_BASE+0x20,true);bytes.set([0x02,0xaa],0x20);
  const next=Uint8Array.from({length:40},(_,index)=>index),plan=patcher.plan({offset:0x20,previousLength:2,nextBytes:next,reference:{kind:"gba32",pointerOffset:0x10}});
  assert.throws(()=>patcher.plan({offset:0x20,previousLength:2,nextBytes:next}),/no owning pointer/);
  assert.equal(plan.relocated,true);assert.equal(plan.target%4,0);
  patcher.apply(plan);
  assert.equal(memory.pointer(0x10),plan.target);assert.deepEqual(memory.slice(plan.target,next.length),next);
  patcher.restore(plan);
  assert.equal(memory.pointer(0x10),0x20);assert.ok(memory.slice(plan.target,next.length).every(byte=>byte===0xff));
});

test("RelocatablePatch keeps Gen I near pointers in-bank and supports far pointers", () => {
  const bytes=new Uint8Array(0xc000);bytes.fill(0);bytes.fill(0xff,0x5000,0x8000);bytes.fill(0xff,0x9000);
  const memory=new GbcMemory(bytes),patcher=new RelocatablePatch(memory),next=new Uint8Array(48).fill(0x57);
  memory.view.setUint16(0x4100,0x4200,true);bytes.set([0x00,0x57],0x4200);
  const near=patcher.plan({offset:0x4200,previousLength:2,nextBytes:next,reference:{kind:"gbc16",pointerOffset:0x4100,bank:1}});
  patcher.apply(near);
  assert.equal(Math.floor(near.target/0x4000),1);assert.equal(memory.pointer16(0x4100,1),near.target);
  patcher.restore(near);assert.equal(memory.pointer16(0x4100,1),0x4200);

  memory.view.setUint16(0x101,0x4200,true);memory.view.setUint8(0x103,1);
  const far=patcher.plan({offset:0x4200,previousLength:2,nextBytes:next,reference:{kind:"gbcFar",addressOffset:0x101,bankOffset:0x103}});
  patcher.apply(far);
  const textFarTarget=()=>memory.banked(memory.u8(0x103),memory.u16(0x101));
  assert.equal(textFarTarget(),far.target);
  patcher.restore(far);assert.equal(textFarTarget(),0x4200);
});

test("RelocatablePatch keeps Crystal event scripts inside their Gen II bank", () => {
  const bytes=new Uint8Array(0xc000);bytes.fill(0xff);
  const memory=new Gen2Memory(bytes),pointerOffset=0x100,scriptOffset=0x8100;
  bytes.set([0x00,0x41],pointerOffset);bytes.set([0x91,0xff],scriptOffset);
  const patcher=new RelocatablePatch(memory),plan=patcher.plan({offset:scriptOffset,previousLength:1,nextBytes:Uint8Array.of(0x47,0x49,0x91),reference:{kind:"gen2Near",pointerOffset,bank:2}});
  assert.equal(plan.relocated,true);patcher.apply(plan);
  assert.equal(memory.banked(2,memory.u16(pointerOffset)),plan.target);
  patcher.restore(plan);assert.equal(memory.u16(pointerOffset),0x4100);assert.equal(memory.u8(scriptOffset),0x91);
});

test("Code links carry proven event pointers while manual oversized patches stay protected", async () => {
  const code=await read("js/code/editor.js"),init=await read("js/init.js"),inspector=await read("js/map/event-inspector.js"),gba=await read("js/map/editor-map.js"),gbc=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js"),guide=await read("doc/CODE_EDITOR.md");
  assert.match(code,/new RelocatablePatch\(reader\.memory\)/);
  assert.match(code,/reference:tab\.viewer==="script"\?tab\.reference:null/);
  assert.match(init,/open:\(project,request\)=>project\.code_editor\?\.open\?\.\(request\.offset\|\|0,false,\{view:request\.view\|\|"original",reference:request\.reference,scriptKind:request\.scriptKind\}\)/);
  assert.match(inspector,/reference:scriptReference/);assert.match(inspector,/reference:textReference/);
  assert.match(gba,/kind:"gba32"/);assert.match(gbc,/kind:"gbc16"/);assert.match(gbc,/kind:"gbcFar"/);
  assert.match(gen2,/kind:"gen2Near"/);assert.match(inspector,/scriptKind:event\?\.\$codeKind/);
  assert.match(guide,/Manual ROM offsets/);assert.match(code,/decompileScript\(tab,\{resetSource=false\}/);
});

test("MapLayoutWriter preserves the top-left block rectangle for 8-bit and 16-bit maps", () => {
  const memory=new RomMemory(new Uint8Array(64)),writer=new MapLayoutWriter(memory);
  const one=Uint8Array.of(1,2,3,4,5,6),expanded=writer.resizeBytes(one,3,2,4,3,1);
  assert.deepEqual([...expanded],[1,2,3,0,4,5,6,0,0,0,0,0]);
  const two=Uint8Array.of(1,0,2,0,3,0,4,0,5,0,6,0),cropped=writer.resizeBytes(two,3,2,2,2,2);
  assert.deepEqual([...cropped],[1,0,2,0,4,0,5,0]);
});

test("MapLayoutWriter atomically resizes GBA and Gen I block layouts", () => {
  const gbaBytes=new Uint8Array(0x400);gbaBytes.fill(0);gbaBytes.fill(0xff,0x100);
  const gba=new GbaMemory(gbaBytes),gbaWriter=new MapLayoutWriter(gba);
  gba.view.setInt32(0x40,2,true);gba.view.setInt32(0x44,2,true);gba.view.setUint32(0x4c,GbaMemory.ROM_BASE+0x60,true);gbaBytes.set([1,0,2,0,3,0,4,0],0x60);
  const gbaPlan=gbaWriter.plan({offset:0x60,width:2,height:2,nextWidth:3,nextHeight:2,stride:2,reference:{kind:"gba32",pointerOffset:0x4c},dimensions:[{offset:0x40,type:"s32"},{offset:0x44,type:"s32"}]});
  const gbaTarget=gbaWriter.apply(gbaPlan);
  assert.deepEqual([gba.view.getInt32(0x40,true),gba.view.getInt32(0x44,true),gba.pointer(0x4c)],[3,2,gbaTarget]);
  assert.deepEqual([...gba.slice(gbaTarget,12)],[1,0,2,0,0,0,3,0,4,0,0,0]);
  gbaWriter.restore(gbaPlan);assert.deepEqual([gba.view.getInt32(0x40,true),gba.view.getInt32(0x44,true),gba.pointer(0x4c)],[2,2,0x60]);

  const gbBytes=new Uint8Array(0x8000);gbBytes.fill(0);gbBytes.fill(0xff,0x5000);
  const gb=new GbcMemory(gbBytes),gbWriter=new MapLayoutWriter(gb);
  gbBytes.set([2,2],0x4101);gb.view.setUint16(0x4103,0x4200,true);gbBytes.set([1,2,3,4],0x4200);
  const gbPlan=gbWriter.plan({offset:0x4200,width:2,height:2,nextWidth:3,nextHeight:2,stride:1,reference:{kind:"gbc16",pointerOffset:0x4103,bank:1},dimensions:[{offset:0x4102,type:"u8"},{offset:0x4101,type:"u8"}]});
  const gbTarget=gbWriter.apply(gbPlan);
  assert.deepEqual([gb.u8(0x4102),gb.u8(0x4101),gb.pointer16(0x4103,1)],[3,2,gbTarget]);
  assert.deepEqual([...gb.slice(gbTarget,6)],[1,2,0,3,4,0]);
  gbWriter.restore(gbPlan);assert.deepEqual([gb.u8(0x4102),gb.u8(0x4101),gb.pointer16(0x4103,1)],[2,2,0x4200]);
});

test("MapLayoutWriter conflict checks dimensions, pointer, and allocation before restoring anything", () => {
  const bytes=new Uint8Array(0x400);bytes.fill(0);bytes.fill(0xff,0x100);
  const memory=new GbaMemory(bytes),writer=new MapLayoutWriter(memory);
  memory.view.setInt32(0x40,2,true);memory.view.setInt32(0x44,2,true);
  memory.view.setUint32(0x4c,GbaMemory.ROM_BASE+0x60,true);bytes.set([1,0,2,0,3,0,4,0],0x60);
  const plan=writer.plan({
    offset:0x60,width:2,height:2,nextWidth:3,nextHeight:2,stride:2,
    reference:{kind:"gba32",pointerOffset:0x4c},
    dimensions:[{offset:0x40,type:"s32"},{offset:0x44,type:"s32"}]
  });
  writer.apply(plan);
  memory.view.setInt32(0x40,4,true);
  const conflicted=bytes.slice();
  assert.throws(()=>writer.restore(plan),/Memory changed after this command/);
  assert.deepEqual(bytes,conflicted);
  memory.view.setInt32(0x40,3,true);
  writer.restore(plan);
  assert.deepEqual([memory.view.getInt32(0x40,true),memory.view.getInt32(0x44,true),memory.pointer(0x4c)],[2,2,0x60]);
});

test("MapLayoutWriter relocates Crystal blocks through a bank-first Gen II dba", () => {
  const bytes=new Uint8Array(0xc000),memory=new Gen2Memory(bytes),writer=new MapLayoutWriter(memory),attributes=0x100,blocks=0x8100;
  bytes.fill(0xff,0x6000,0x6100);
  bytes.set([2,2,2,0,0x41],attributes+1);
  bytes.set([1,2,3,4],blocks);
  const plan=writer.plan({
    offset:blocks,width:2,height:2,nextWidth:3,nextHeight:2,stride:1,
    reference:{kind:"gen2Far",bankOffset:attributes+3,addressOffset:attributes+4},
    dimensions:[{offset:attributes+2,type:"u8"},{offset:attributes+1,type:"u8"}]
  });
  const target=writer.apply(plan),bank=Math.floor(target/0x4000),address=bank===0?target:0x4000+target-bank*0x4000;
  assert.deepEqual([memory.u8(attributes+2),memory.u8(attributes+1),memory.u8(attributes+3),memory.u16(attributes+4)],[3,2,bank,address]);
  assert.deepEqual(Array.from(memory.slice(target,6)),[1,2,0,3,4,0]);
  writer.restore(plan);
  assert.deepEqual([memory.u8(attributes+2),memory.u8(attributes+1),memory.u8(attributes+3),memory.u16(attributes+4)],[2,2,2,0x4100]);
  assert.deepEqual(Array.from(memory.slice(blocks,4)),[1,2,3,4]);
});

test("all map drivers expose one shared resize experience", async () => {
  const workspace=await read("js/map/workspace.js"),gba=await read("js/map/editor-map.js"),gbc=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js"),model=await read("js/map/map.js"),init=await read("js/init.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(workspace,/editLayout\(/);assert.match(workspace,/AppDialog\.form/);assert.match(init,/label:"Resize…"/);
  assert.match(gba,/new MapLayoutWriter/);assert.match(gba,/kind:"gba32"/);
  assert.match(gbc,/new MapLayoutWriter/);assert.match(gbc,/kind:"gbc16"/);
  assert.match(gen2,/new MapLayoutWriter/);assert.match(gen2,/kind:"gen2Far"/);
  assert.match(model,/getStructureOffset\(\)\{ return this\.structureOffset/);
  assert.doesNotMatch(model,/getStructureOffset\(\)\{ return this\.script/);
  assert.match(guide,/Resize map/);
});

test("GBA connection edits preserve signed offsets and undo exact bytes", () => {
  const bytes=new Uint8Array(32),memory=new GbaMemory(bytes),writer=new StructureWriter(memory),stack=new CommandStack();
  bytes.set([1,0,0,0,0xfc,0xff,0xff,0xff,2,3,0,0],4);
  let connection=GbaMapConnection.read(memory,4);assert.equal(connection.relativeOffset,-4);
  writer.edit(stack,{base:4,schema:{direction:{offset:0,type:"u8"},relativeOffset:{offset:4,type:"s32"},mapGroup:{offset:8,type:"u8"},mapNum:{offset:9,type:"u8"}},current:connection,values:{direction:4,relativeOffset:7,mapGroup:5,mapNum:6}});
  connection=GbaMapConnection.read(memory,4);assert.deepEqual([connection.direction,connection.relativeOffset,connection.mapGroup,connection.mapNum],[4,7,5,6]);
  stack.undo();connection=GbaMapConnection.read(memory,4);assert.deepEqual([connection.direction,connection.relativeOffset,connection.mapGroup,connection.mapNum],[1,-4,2,3]);
});

test("Gen I connection edits retain direction flags and protected addresses", () => {
  const bytes=new Uint8Array(64),memory=new GbcMemory(bytes),writer=new StructureWriter(memory),stack=new CommandStack();
  bytes.set([1,4,5],0);memory.view.setUint16(3,0x20,true);memory.view.setUint16(5,0x30,true);memory.view.setUint16(7,0x38,true);bytes[9]=1;
  bytes[10]=8;memory.view.setUint16(11,0x4000,true);memory.view.setUint16(13,0x4100,true);bytes.set([8,7,0xfe,4],15);memory.view.setUint16(19,0x4200,true);memory.view.setUint16(21,0x28,true);
  let header=GbcMapHeader.read(memory,0,0),connection=header.connections[0],protectedBytes=memory.slice(connection.offset+1,4);
  assert.deepEqual([connection.direction,connection.mapId,connection.y,connection.x],["east",8,-2,4]);
  writer.edit(stack,{base:connection.offset,schema:{mapId:{offset:0,type:"u8"},length:{offset:5,type:"u8"},width:{offset:6,type:"u8"},y:{offset:7,type:"s8"},x:{offset:8,type:"s8"}},current:connection,values:{mapId:9,length:10,width:11,y:-6,x:5}});
  header=GbcMapHeader.read(memory,0,0);connection=header.connections[0];
  assert.deepEqual([header.connectionFlags,connection.direction,connection.mapId,connection.length,connection.width,connection.y,connection.x],[1,"east",9,10,11,-6,5]);
  assert.deepEqual(memory.slice(connection.offset+1,4),protectedBytes);
  stack.undo();connection=GbcMapHeader.read(memory,0,0).connections[0];assert.deepEqual([connection.mapId,connection.length,connection.width,connection.y,connection.x],[8,8,7,-2,4]);
});

test("GBA connection tables relocate safely for insertion and removal", () => {
  const bytes=new Uint8Array(0x120000);bytes.fill(0);bytes.fill(0xff,0x100000);
  const memory=new GbaMemory(bytes),writer=new GbaConnectionTableWriter(memory),header=0x200;
  const add=writer.insert(header,{direction:1,relativeOffset:-5,mapGroup:2,mapNum:3});
  writer.apply(add);
  const table=GbaMapConnections.read(memory,memory.pointer(header+12));
  assert.equal(table.count,1);assert.deepEqual([table.entries[0].direction,table.entries[0].relativeOffset,table.entries[0].mapGroup,table.entries[0].mapNum],[1,-5,2,3]);
  const remove=writer.remove(header,0);writer.apply(remove);assert.equal(memory.pointer(header+12),null);
  writer.restore(remove);assert.equal(GbaMapConnections.read(memory,memory.pointer(header+12)).count,1);
  writer.restore(add);assert.equal(memory.u32(header+12),0);assert.ok(memory.slice(add.allocation,add.length).every(byte=>byte===0xff));
});

test("relocated GBA event Undo is atomic when another editor changes its pointer", () => {
  const bytes=new Uint8Array(512);bytes.fill(0xff);bytes.fill(0,0,88);
  const memory=new GbaMemory(bytes),writer=new GbaEventTableWriter(memory);
  bytes[0]=1;memory.view.setUint32(4,GbaMemory.ROM_BASE+64,true);bytes[64]=1;
  const plan=writer.insert(0,0,writer.entry(0,{x:7,y:9,localId:2}));
  writer.apply(plan);
  memory.view.setUint32(4,GbaMemory.ROM_BASE+80,true);
  const conflicted=bytes.slice();
  assert.throws(()=>writer.restore(plan),/Memory changed after this command/);
  assert.deepEqual(bytes,conflicted);
  memory.view.setUint32(4,GbaMemory.ROM_BASE+plan.allocation,true);
  writer.restore(plan);
  assert.equal(memory.pointer(4),64);
});

test("Gen I connection headers preserve object pointers and canonical direction order", () => {
  const bytes=new Uint8Array(0x8000);bytes.fill(0);bytes.fill(0xff,0x5000);
  const memory=new GbcMemory(bytes),writer=new GbcConnectionHeaderWriter(memory),pointerOffset=0x200,headerOffset=0x4100;
  memory.view.setUint16(pointerOffset,0x4100,true);bytes.set([1,4,5],headerOffset);memory.view.setUint16(headerOffset+3,0x4200,true);memory.view.setUint16(headerOffset+5,0x4300,true);memory.view.setUint16(headerOffset+7,0x4400,true);bytes[headerOffset+9]=0;memory.view.setUint16(headerOffset+10,0x4500,true);
  const header=GbcMapHeader.read(memory,headerOffset,1),east={direction:"east",mapId:2,blocksAddress:0x4600,mapAddress:0xc700,length:5,width:6,y:-4,x:0,windowAddress:0xc800},north={direction:"north",mapId:3,blocksAddress:0x4700,mapAddress:0xc710,length:4,width:7,y:9,x:2,windowAddress:0xc820};
  const eastPlan=writer.insert({header,pointerOffset},east),eastOffset=writer.apply(eastPlan).allocation,eastHeader=GbcMapHeader.read(memory,eastOffset,1);
  assert.deepEqual([eastHeader.connectionFlags,eastHeader.connections[0].direction,memory.u16(eastOffset+eastHeader.size-2)],[1,"east",0x4500]);
  const northPlan=writer.insert({header:eastHeader,pointerOffset},north),nextOffset=writer.apply(northPlan).allocation,nextHeader=GbcMapHeader.read(memory,nextOffset,1);
  assert.deepEqual(nextHeader.connections.map(item=>item.direction),["north","east"]);assert.equal(memory.u16(nextOffset+nextHeader.size-2),0x4500);
  writer.restore(northPlan);assert.equal(memory.u16(pointerOffset),eastPlan.nextPointerRaw);
  writer.restore(eastPlan);assert.equal(memory.u16(pointerOffset),0x4100);
});

test("all map drivers create, edit, and remove connections through the shared dialog", async () => {
  const workspace=await read("js/map/workspace.js"),dialog=await read("js/core/dialog.js"),gba=await read("js/map/editor-map.js"),gbc=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js"),init=await read("js/init.js"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(workspace,/editConnections\(/);assert.match(init,/label:"Connections…"/);
  assert.match(workspace,/onAdd/);assert.match(workspace,/onRemove/);
  assert.match(workspace,/AppDialog\.controls\(schema/);assert.match(workspace,/fieldControls\.values\(\)/);
  assert.match(workspace,/form\.checkValidity\(\)/);assert.match(dialog,/static controls\(fields/);
  assert.match(gba,/GbaConnectionTableWriter/);assert.match(gba,/addConnection\(values\)/);assert.match(gba,/removeConnection\(index\)/);
  assert.match(gbc,/GbcConnectionHeaderWriter/);assert.match(gbc,/createConnectionValues/);assert.match(gbc,/worldMapBase/);
  assert.match(gen2,/Gen2ConnectionWriter/);assert.match(gen2,/createConnectionValues/);assert.match(gen2,/removeConnection\(index\)/);
  assert.match(gba,/type:"s32"/);assert.match(gba,/Edit connection/);
  assert.match(gbc,/type:"s8"/);assert.match(gbc,/Update Gen I map connection/);
  assert.match(guide,/direction flag/);assert.match(guide,/creates and removes neighbours/);assert.match(guide,/variable attribute tail/);
});

test("dynamic property tables obey the same Simple and Nerd complexity contract", async () => {
  const ui=await read("js/core/ui-window.js"),settings=await read("js/core/settings.js"),styles=await read("scss/components/_settings.scss"),workspace=await read("js/map/workspace.js"),gba=await read("js/map/editor-map.js"),gbc=await read("js/map/gbc/editor.js"),inspector=await read("js/map/event-inspector.js"),code=await read("js/code/editor.js"),sprite=await read("js/sprite/editor.js"),guide=await read("doc/USAGE.md");
  assert.match(ui,/complexityAttributes/);assert.match(ui,/"data-complexity":explicit\|\|inferred/);
  assert.match(ui,/offset\|pointer\|address\|bytes/);
  assert.match(ui,/static properties\(values=\{\},descriptions=\{\},complexity=\{\}\)/);
  assert.match(ui,/static table\(values=\{\},descriptions=\{\},\{columns=1,layout=\[\],complexity=\{\}\}/);
  assert.match(workspace,/UiWindow\.table\(values,descriptions,\{columns:1,complexity\}\)/);
  assert.match(gba,/\["Bank","Index","Header","Layout","Blocks"\]/);
  assert.match(gbc,/\["ID","Bank","Header","Bank table","Tileset","Blocks","Blockset","Graphics"\]/);
  assert.match(inspector,/technical=\["offset","size","sourceOffset","scriptOffset","scriptPointer","textAddress","textPointer"\]/);
  assert.match(code,/\{Start:"advanced",Bytes:"advanced"\}/);assert.match(sprite,/\{Offset:"advanced","Bytes\/tile":"advanced","Palette offset":"advanced"\}/);
  assert.match(settings,/documentElement\.dataset\.experience/);assert.match(styles,/\[data-experience="simple"\] \[data-complexity="advanced"\]/);
  assert.match(guide,/does not hide semantic editor actions/);
});

test("Emerald Animation Editor uses the pinned move-animation table decoder", async () => {
  const driver=await read("js/animation/gba-driver.js"),callbacks=await read("js/animation/gba/callbacks.js"),visuals=await read("js/animation/gba/visuals.js"),runtime=await read("js/rom/runtime/gba.js"),editor=await read("js/animation/editor.js"),guide=await read("doc/ANIMATION_EDITOR.md");
  assert.match(driver,/gBattleAnims_Moves/);
  assert.match(driver,/gBattleAnims_General/);
  assert.match(driver,/gBattleAnims_Special/);
  assert.match(driver,/gba-general/);
  assert.match(driver,/gba-special/);
  assert.match(driver,/GENERAL_NAMES\.length/);
  assert.match(driver,/SPECIAL_NAMES\.length/);
  assert.match(await read("scripts/audit-rom.mjs"),/engine programs.*enginePrograms/);
  assert.match(driver,/createvisualtask/);
  assert.match(driver,/0x2f:\["stopsound"/);
  assert.match(driver,/unknown native opcode/);
  assert.match(driver,/ns\.registry\.register\("gba"/);
  assert.match(visuals,/gBattleAnimPicTable \+ gBattleAnimPaletteTable/);
  assert.match(visuals,/GbaLz77\.decode/);
  assert.match(callbacks,/class GbaAnimationCallbackRegistry/);
  assert.match(callbacks,/AnimHitSplatBasic/);
  assert.match(runtime,/animation\/gba\/callbacks\.js\?v=5/);
  assert.match(runtime,/animation\/gba\/tasks\.js\?v=14/);
  assert.match(runtime,/animation\/gba\/backgrounds\.js\?v=2/);
  assert.match(runtime,/animation\/gba\/timing\.js\?v=1/);
  assert.match(runtime,/animation\/gba-driver\.js\?v=30/);
  assert.match(runtime,/sprite\/gba\/scene-catalogs\.js\?v=2/);
  assert.match(runtime,/animation\/asset-catalog\.js\?v=1/);
  assert.match(driver,/new ns\.AnimationAssetCatalog/);
  assert.match(driver,/const root=\(global\.PokemonViewer\|\|=\{\}\),ns=\(root\.animation\|\|=\{\}\)/);
  assert.doesNotMatch(runtime,/animation\/generic-driver\.js/);
  assert.match(editor,/AnimationDocumentResolver\.resolve/);
  assert.match(guide,/0x2C9398/);
  assert.match(guide,/\*\*partial\*\*/);
});

test("GB and Crystal animation visuals follow native tiles, frames, OAM and graphics tables",async()=>{
  const [gen1,gen2,gbRuntime,crystalRuntime]=await Promise.all([
    read("js/animation/gbc/visuals.js"),read("js/animation/gen2/visuals.js"),read("js/rom/runtime/gbc.js"),read("js/rom/runtime/gen2.js")
  ]);
  assert.match(gen1,/MoveAnimationTilesPointers/);assert.match(gen1,/SubanimationPointers/);
  assert.match(gen1,/FrameBlockPointers/);assert.match(gen1,/FrameBlockBaseCoords/);assert.match(gen1,/GbcSpriteCodec\.decodeTile/);
  assert.match(gen2,/BattleAnimObjects/);assert.match(gen2,/BattleAnimFrameData/);assert.match(gen2,/BattleAnimOAMData/);assert.match(gen2,/AnimObjGFX/);
  assert.match(gen2,/GscLz\.decompress/);assert.match(gen2,/GbcSpriteCodec\.decodeTile/);
  assert.match(gbRuntime,/animation\/gbc\/visuals\.js\?v=5/);assert.match(crystalRuntime,/animation\/gen2\/visuals\.js\?v=2/);
});

test("Animation playback projects family commands into isolated visual tracks",()=>{
  const commands=[
    {label:"Load",source:"load resource",duration:1,event:{kind:"resource",value:"Spark"}},
    {label:"Create",source:"create object",duration:2,event:{kind:"sprite",value:"Impact",sound:"SFX 12"}},
    {label:"Fade",source:"change background",duration:3,event:{kind:"background",value:"Dark"}}
  ];
  const document=new PokemonViewer.animation.AnimationDocument({id:"fixture",name:"Fixture",commands});
  assert.equal(document.frames.length,3);
  assert.deepEqual(document.frames[0].state.resources,["Spark"]);
  assert.deepEqual(document.frames[1].state.sprites,["Impact"]);
  assert.deepEqual(document.frames[1].state.sounds,["SFX 12"]);
  assert.equal(document.frames[2].state.background,"Dark");
  assert.deepEqual(document.frames.map(frame=>frame.duration),[1,2,3]);
});

test("GBA encounter data joins the immutable family namespace and resets with the ROM", async () => {
  const encounters=await read("js/core/gba-encounters.js"),reader=await read("js/rom_reader.js"),runtime=await read("js/rom/runtime/gba.js");
  assert.match(encounters,/root\.gba=Object\.freeze\(\{\.\.\.root\.gba,GbaEncounterContract,GbaEncounterData\}\)/);
  assert.match(reader,/this\.gbaSpeciesData=this\.gbaTrainerData=this\.gbaEncounterData=null/);
  assert.match(runtime,/js\/core\/gba-encounters\.js/);
  assert.match(runtime,/new global\.EncounterEditor\(reader,"gba"\)/);
});

test("connected map scenes bound canvas memory and rasterize only visible blocks",async()=>{
  const workspace=await read("js/map/workspace.js"),gbc=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js"),gba=await read("js/map/editor-map.js");
  assert.match(workspace,/maxPixels=12\*1024\*1024/);
  assert.match(workspace,/maxNodes=64/);
  assert.match(workspace,/visibleBounds\(canvas,viewport/);
  assert.match(workspace,/static blockRange/);
  assert.match(gbc,/MapScene\.blockRange/);
  assert.match(gen2,/MapScene\.blockRange/);
  assert.match(gbc,/this\.workspace\.viewport,"scroll"/);
  assert.match(gen2,/this\.workspace\.viewport,"scroll"/);
  assert.match(gba,/scheduled\.size < 128/);
});

test("shared tables sort configured columns and buttons use one size scale",async()=>{
  const ui=await read("js/core/ui-window.js"),styles=await read("scss/components/_window.scss"),panel=await read("js/encounters/map-panel.js"),guide=await read("doc/UX_GUIDELINES.md");
  assert.match(ui,/class UiTable/);
  assert.match(ui,/sortable=false/);
  assert.match(ui,/aria-sort/);
  assert.match(ui,/static iconButton/);
  assert.match(ui,/size="md"/);
  assert.match(styles,/ui-button--sm/);
  assert.match(styles,/ui-button--md/);
  assert.match(styles,/ui-button--lg/);
  assert.match(panel,/new UiTable/);
  assert.match(panel,/map-encounters__sprite/);
  assert.match(panel,/UiWindow\.iconButton/);
  assert.match(guide,/Tables and button scale/);
});

test("encounters expose method subtables in the workspace and map panel",async()=>{
  const page=await read("encounters.html"),editor=await read("js/encounters/editor.js"),panel=await read("js/encounters/map-panel.js"),mapEditor=await read("js/map/editor.js");
  const gbaDriver=await read("js/encounters/gba/driver.js"),gbcDriver=await read("js/encounters/gbc/driver.js"),gen2Driver=await read("js/encounters/gen2/driver.js");
  assert.match(page,/id="encounter_table" class="encounter-method-browser"/);
  assert.doesNotMatch(page,/<select id="encounter_table"/);
  assert.match(editor,/encounter-method-tabs/);
  assert.match(panel,/map-encounter-method/);
  assert.match(panel,/map-encounter-subtable/);
  assert.doesNotMatch(panel,/aria-label:"Encounter method"/);
  assert.match(panel,/this\.driver\.tableLabel\?\.\(document\)\|\|document\.rodLabel\|\|document\.methodLabel/);
  assert.match(panel,/links\.length===0&&!Number\.isInteger\(document\.mapId\)/);
  assert.doesNotMatch(panel,/return`\$\{document\.rodLabel\}/);
  for(const driver of[gbaDriver,gbcDriver,gen2Driver])assert.match(driver,/tableLabel\(document\)/);
  assert.match(mapEditor,/\["gb","gen2","gba"\]/);
});

test("encounter workspace renders one compact method and contextual slot actions",async()=>{
  const page=await read("encounters.html"),editor=await read("js/encounters/editor.js"),model=await read("js/encounters/view-model.js"),styles=await read("scss/editors/_encounters.scss");
  assert.match(page,/class="encounter-stage__controls"/);
  assert.match(editor,/encounter-method-tabs/);
  assert.match(editor,/EncounterBrowserModel/);
  assert.match(model,/class EncounterBrowserModel/);
  assert.match(model,/selected\(\)\{return this\.groups\.get\(this\.activeMethod\)\|\|\[\]\;\}/);
  assert.match(styles,/grid-template-columns:64px minmax\(0,1fr\) auto/);
  assert.doesNotMatch(styles,/min-height:252px/);
  assert.doesNotMatch(styles,/\.encounter-slot__actions\{position:absolute/);
});

test("map border patterns are editable from the shared Blocks selection",async()=>{
  const gba=await read("js/map/editor-map.js"),gen1=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js");
  for(const source of [gba,gen1,gen2]){
    assert.match(source,/Use selected block/);
    assert.match(source,/Open block/);
    assert.match(source,/setBorderPattern/);
  }
  assert.match(gba,/setBorderPatternCell/);
  assert.match(gba,/gbaWithIndex/);
  assert.match(gen1,/max:127/);
  assert.match(gen2,/attributes\.borderBlock/);
});

test("Minimap zoom-out is content bounded and Open map returns to the focused world",async()=>{
  const workspace=await read("js/map/workspace.js"),gba=await read("js/map/editor-map.js"),gen1=await read("js/map/gbc/editor.js"),gen2=await read("js/map/gen2/editor.js");
  assert.match(workspace,/regionZoomBounds\(\)/);
  assert.match(workspace,/fit\*\.72/);
  assert.match(workspace,/data-region-tool='zoom-out'/);
  assert.match(workspace,/async openRegionEntry\(\)/);
  assert.match(workspace,/setViewMode\("map"\)/);
  assert.match(workspace,/mapdestinationfocus/);
  assert.match(gba,/return this\.navigateToMap/);
  for(const source of [gen1,gen2])assert.match(source,/return this\.editor\.navigate/);
});

test("map banks use the shared accessible accordion material",async()=>{
  const page=await read("index.html"),accordion=await read("js/core/ui-accordion.js"),styles=await read("scss/components/_accordion.scss"),map=await read("js/map/editor-map.js"),layout=await read("scss/editors/_map-layout.scss");
  assert.match(page,/js\/core\/ui-accordion\.js\?v=1/);
  assert.match(accordion,/class UiAccordion/);
  assert.match(accordion,/"aria-expanded"/);
  assert.match(accordion,/uiaccordiontoggle/);
  assert.match(accordion,/static group\(definitions/);
  assert.match(map,/UiAccordion\.group/);
  assert.match(map,/bankAccordion\?\.reveal\(mapElement\)/);
  assert.doesNotMatch(layout,/\.bank_option \{ height:44px/);
  assert.match(styles,/\.ui-accordion__panel\[hidden\]/);
});

test("map properties use one compact panel hierarchy instead of loose headings",async()=>{
  const workspace=await read("js/map/workspace.js"),styles=await read("scss/editors/_map-gbc.scss"),guide=await read("doc/MAP_EDITOR.md");
  assert.match(workspace,/map-properties__header/);
  assert.match(workspace,/map-properties__body/);
  assert.match(workspace,/map-properties__events/);
  assert.match(workspace,/ui-panel__footer map-properties__actions/);
  assert.doesNotMatch(workspace,/Dom\.create\("h2",\{text:title\}\),UiWindow\.properties/);
  assert.match(styles,/\.map-properties__header/);
  assert.match(styles,/\.map-properties__events/);
  assert.match(guide,/Details tab/);
  assert.match(workspace,/new UiPanelTabs/);
  assert.match(workspace,/sidebar\.hidden=mode!=="map"/);
});
test("movement previews use family artwork without editor collision or boundary overlays", async () => {
  const movement=await read("js/map/movement.js");
  const gbaProfile=await read("js/map/gba/movement-profile.js"),gbcProfile=await read("js/map/gbc/movement-profile.js"),gen2Profile=await read("js/map/gen2/movement-profile.js");
  const gen1=await read("js/map/gbc/editor.js");
  const gen2=await read("js/map/gen2/editor.js");
  assert.match(movement,/movementProfiles/);
  assert.doesNotMatch(movement,/gbaInitial|movement===0xfe|0xd3/);
  assert.match(gbaProfile,/profiles\.gba/);assert.match(gbcProfile,/0xd3:\"east\"/);assert.match(gen2Profile,/9:\"east\"/);
  assert.match(movement,/renderMovementEnvironment/);
  assert.doesNotMatch(movement,/rgba\(220,38,38,.14\)/);
  assert.doesNotMatch(movement,/strokeStyle="rgba\(40,127,197,.18\)"/);
  assert.match(gen1,/renderMovementEnvironment\(event,canvas/);
  assert.match(gen1,/createPattern\(tile,"repeat"\)/);
  assert.match(gen2,/renderMovementEnvironment\(event,canvas/);
  assert.match(gen2,/availableFrames/);
});

test("overworld sprite states expose native directions and derived horizontal flips",async()=>{
  const sprite=await read("sprite.html"),editor=await read("js/sprite/editor.js"),styles=await read("scss/editors/_sprite.scss");
  const gba=await read("js/structures/gba/sprite.js"),gbc=await read("js/structures/gbc/sprite.js"),gen2=await read("js/structures/gen2/sprite.js");
  assert.match(sprite,/class="sprite-stage-content" data-ui-window-content/);
  assert.match(sprite,/class="sprite-canvas-wrap">[\s\S]*id="sprite_canvas"[\s\S]*id="sprite_view_dock"/);
  assert.match(sprite,/id="sprite_flip_x"/);
  assert.match(editor,/syncFlipControl/);assert.match(editor,/if\(this\.flipX\)x=/);assert.match(editor,/mirror\(source\)/);
  assert.match(styles,/\.sprite-stage-content/);assert.match(styles,/\.sprite-view-dock/);assert.match(styles,/overscroll-behavior-x:contain/);
  for(const source of [gba,gbc,gen2]){assert.match(source,/label:\"East\"/);assert.match(source,/flipX:true/);assert.match(source,/canFlipX/);}
});

test("battle parties and encounter slots render through reusable view components",async()=>{
  const battle=await read("js/battle/editor.js"),party=await read("js/battle/party-view.js");
  const encounters=await read("js/encounters/editor.js"),slots=await read("js/encounters/slot-view.js");
  const gba=await read("js/rom/runtime/gba.js"),gbc=await read("js/rom/runtime/gbc.js"),gen2=await read("js/rom/runtime/gen2.js");
  assert.match(battle,/new ns\.BattlePartyView/);
  assert.doesNotMatch(battle,/battle-mon-sprite/);
  assert.match(party,/class BattlePartyView/);
  assert.match(party,/EditorLinks\.species/);
  assert.match(encounters,/new PokemonViewer\.encounters\.EncounterSlotView/);
  assert.doesNotMatch(encounters,/encounter-slot__sprite/);
  assert.match(slots,/class EncounterSlotView/);
  assert.match(slots,/this\.driver\.battleLink/);
  for(const runtime of [gba,gbc,gen2]){
    assert.match(runtime,/js\/battle\/party-view\.js\?v=2/);
    assert.match(runtime,/js\/encounters\/slot-view\.js\?v=2/);
  }
});

test("cross-editor invalidation uses one typed ProjectEvents service",async()=>{
  const index=await read("index.html"),events=await read("js/core/project-events.js");
  const sources=await Promise.all([
    read("js/battle/gbc/driver.js"),read("js/battle/gen2/driver.js"),
    read("js/encounters/gbc/driver.js"),read("js/encounters/gen2/driver.js"),
    read("js/sprite/editor.js"),read("js/map/workspace.js")
  ]);
  assert.match(index,/js\/core\/project-events\.js\?v=1/);
  assert.match(events,/class ProjectEvents/);
  assert.match(events,/static resources\(graph\)/);
  assert.match(events,/static graphics\(offsets=\[\],detail=\{\}\)/);
  for(const source of sources)assert.match(source,/ProjectEvents\.(?:resources|graphics)/);
  assert.equal(sources.filter(source=>/dispatchEvent\(new CustomEvent\("(?:resourcegraphchange|romgraphicschange)"/.test(source)).length,0);
});

test("shared editor views copy native artwork through PixelCanvas",async()=>{
  const index=await read("index.html"),utility=await read("js/core/pixel-canvas.js");
  const sources=await Promise.all([
    read("js/battle/party-view.js"),read("js/battle/editor.js"),
    read("js/encounters/slot-view.js"),read("js/encounters/map-panel.js"),
    read("js/pokedex/editor.js"),read("js/sprite/editor.js")
  ]);
  assert.match(index,/js\/core\/pixel-canvas\.js\?v=2/);
  assert.match(utility,/class PixelCanvas/);
  assert.match(utility,/imageSmoothingEnabled=false/);
  assert.match(utility,/static copy\(source/);
  assert.match(utility,/static fit\(canvas/);
  assert.match(sources[1],/PixelCanvas\.fit/);
  for(const source of sources)assert.match(source,/PixelCanvas\.(?:create|copy|context|draw)/);
});

test("supporting editor panels share accessible keyboard tabs",async()=>{
  const component=await read("js/core/ui-window.js");
  const sources=await Promise.all([
    read("js/pokedex/editor.js"),
    read("js/moves/editor.js"),
    read("js/sound/editor.js"),
    read("js/sprite/editor.js"),
    read("js/battle/editor.js")
  ]);
  assert.match(component,/class UiPanelTabs/);
  assert.match(component,/static mount\(container/);
  assert.match(component,/ArrowLeft/);
  assert.match(component,/role","tabpanel/);
  for(const source of sources)assert.match(source,/UiPanelTabs\.mount/);
  const battlePage=await read("battle.html"),contract=await read("scss/components/_editor-contract.scss");
  assert.match(battlePage,/class="battle-source-panel"/);
  assert.doesNotMatch(contract,/grid-template-areas:"source party technical"/);
});

test("Gen I Animation lazy-loads its native 2bpp codec before constructing the driver",async()=>{
  const runtime=await read("js/rom/runtime/gbc.js");
  const branch=runtime.slice(runtime.indexOf('if(workspaceId==="animation_editor")'),runtime.indexOf('if(workspaceId==="item_editor")'));
  assert.ok(branch.indexOf("js/sprite/codecs/gbc-2bpp.js")<branch.indexOf("js/animation/gbc/driver.js"));
});

test("Sprite scene groups use exact isolated family catalogs without fabricated fallbacks",async()=>{
  const page=await read("sprite.html");
  const editor=await read("js/sprite/editor.js");
  const gbaSchema=await read("manifests/config/gen3-emerald.json");
  const gba=await read("js/sprite/gba/scene-catalogs.js");
  const gen1=await read("js/sprite/gbc/scene-catalogs.js");
  const gen2=await read("js/sprite/gen2/scene-catalogs.js");
  const gbaRuntime=await read("js/rom/runtime/gba.js");
  const gen1Runtime=await read("js/rom/runtime/gbc.js");
  const gen2Runtime=await read("js/rom/runtime/gen2.js");
  for(const group of ["intro","title","bag","badges"])assert.match(page,new RegExp(`value="${group}"`));
  assert.match(editor,/ensureWorkspace\("map_editor"\)/);
  assert.match(gbaSchema,/Brendan bag states/);
  assert.match(gbaSchema,/Hoenn badges/);
  assert.match(gbaSchema,/gIntroVolbeat_Gfx/);
  assert.match(gbaSchema,/gTitleScreenBgPalettes/);
  assert.match(gbaSchema,/"paletteDisplacement": 448/);
  assert.doesNotMatch(gbaSchema+gba,/\b0x(?:53f058|56f4ec|d85cb0|d85f50|dde418)\b/i);
  assert.match(gba,/memoryProfile/);
  assert.match(gba,/profile\.require\(definition\.gfx\)/);
  assert.match(gba,/continue/);
  assert.match(gen1,/Nidorino/);
  assert.match(gen1,/Kanto badges/);
  assert.doesNotMatch(gen1,/bag:/);
  assert.match(gen2,/Male pack/);
  assert.match(gen2,/Johto badges/);
  assert.match(gbaRuntime,/sprite\/gba\/scene-catalogs\.js/);
  assert.doesNotMatch(gbaRuntime,/sprite\/(?:gbc|gen2)\/scene-catalogs\.js/);
  assert.match(gen1Runtime,/sprite\/gbc\/scene-catalogs\.js/);
  assert.doesNotMatch(gen1Runtime,/sprite\/(?:gba|gen2)\/scene-catalogs\.js/);
  assert.match(gen2Runtime,/sprite\/gen2\/scene-catalogs\.js/);
  assert.doesNotMatch(gen2Runtime,/sprite\/(?:gba|gbc)\/scene-catalogs\.js/);
});

test("GBA scene catalogs relocate through profile symbols and fail by independent group",async()=>{
  const context=vm.createContext({
    globalThis:null,
    RomMemory:class{constructor(bytes){this.bytes=bytes;}u16(){return 0;}},
    GbaSpriteCodec:{bytesPerTile:32,decodeColor:value=>value}
  });
  context.globalThis=context;
  context.PokemonViewer={
    gba:{GbaLz77:{decode:()=>({bytes:new Uint8Array(32)})}},
    sprites:{SpriteResourceCatalog:class{constructor(entries){this.entries=entries;}}}
  };
  vm.runInContext(await read("js/sprite/gba/scene-catalogs.js"),context);
  const schema=JSON.parse(await read("manifests/config/gen3-emerald.json")).structures.GbaSceneCatalogs;
  const names=new Set(Object.values(schema.groups)
    .flat().flatMap(entry=>[entry.gfx,entry.palette]));
  const symbols=Object.fromEntries([...names].map((name,index)=>[name,{offset:0x1000+index*0x100}]));
  const reader={
    memory:{u16:()=>0},
    memoryProfile:{
      structure:name=>name==="GbaSceneCatalogs"?schema:null,
      offset:name=>symbols[name]?.offset??null,
      require:name=>{
        if(!symbols[name])throw new Error(name);
        return symbols[name];
      }
    }
  };
  const Catalog=context.PokemonViewer.sprites.GbaSceneCatalogs;
  const complete=new Catalog(reader).create();
  assert.deepEqual(Object.keys(complete),["intro","title","bag","badges"]);
  delete symbols.sHoennTrainerCardBadges_Gfx;
  const partial=new Catalog(reader).create();
  assert.deepEqual(Object.keys(partial),["intro","title","bag"]);
  assert.equal(partial.intro.entries[0].source().offset,symbols.gIntroVolbeat_Gfx.offset);
  assert.equal(
    partial.title.entries[0].source().paletteOffset,
    symbols.gTitleScreenBgPalettes.offset+0x1c0
  );
});

test("Animation Editor keeps the native preview primary and exposes complete searchable move domains",async()=>{
  const page=await read("animation.html");
  const editor=await read("js/animation/editor.js");
  const styles=await read("scss/editors/_animation.scss");
  const gba=await read("js/animation/gba-driver.js");
  const gen1=await read("js/animation/gbc/driver.js");
  const gen2=await read("js/animation/gen2/driver.js");
  assert.match(page,/animation_domain_tabs/);
  assert.match(page,/animation_search/);
  assert.match(page,/data-animation-view="preview"/);
  assert.match(page,/data-animation-view="program"/);
  assert.doesNotMatch(page,/data-animation-detail="edit"/);
  assert.match(page,/id="animation_logic"/);assert.match(page,/animation_commands"[^>]*data-complexity="advanced"/);
  assert.match(editor,/toLocaleLowerCase/);
  assert.match(editor,/new ScriptLogicGraph/);assert.match(editor,/renderProgram\(\)/);assert.match(editor,/data-complexity/);
  assert.match(page,/class="[^"]*animation-library[^"]*editor-shell__panels[^"]*"/);assert.doesNotMatch(page,/data-ui-split-pane/);
  assert.match(page,/class="[^"]*animation-stage[^"]*editor-shell__main[^"]*"/);
  assert.match(styles,/\.animation-library__body\{display:grid/);
  assert.match(styles,/\[data-experience="nerd"\] #animation_editor \.animation-logic/);
  assert.match(gba,/Array\.from\(\{length:355\}/);
  assert.match(gba,/gBattleAnims_StatusConditions/);assert.match(gba,/STATUS_NAMES/);
  assert.match(gba,/gBattleAnims_General/);assert.match(gba,/GENERAL_NAMES/);
  assert.match(gba,/gBattleAnims_Special/);assert.match(gba,/SPECIAL_NAMES/);
  assert.match(gen1,/AnimationEntryProvider/);assert.match(gen1,/gen1-visual-effects/);
  assert.match(gen2,/AnimationEntryProvider/);assert.match(gen2,/gen2-visual-objects/);
  assert.match(gen2,/gen2-engine-programs/);assert.match(gen2,/BATTLE_ANIMATION_COUNT=0x116/);
  assert.match(gen2,/BattleAnim_ThrowPokeBall/);assert.match(gen2,/engineAnimationId/);
  assert.match(gba,/AnimationEntryProvider/);
  assert.match(gba,/gba-animation-components/);assert.match(gba,/rememberComponents/);
  assert.doesNotMatch(gba+gen1+gen2,/illustrative frame|pointer-scanned/i);
});

test("Gen I Animation catalog composes the complete Red and Blue opening battle",async()=>{
  const [scenes,driver,runtime,editor,renderer,markup]=await Promise.all([
    read("js/animation/gbc/scenes.js"),read("js/animation/gbc/driver.js"),read("js/rom/runtime/gbc.js"),
    read("js/animation/editor.js"),read("js/animation/renderer.js"),read("animation.html")
  ]);
  assert.match(scenes,/ea9bcae617fdf159b045185467ae58b2e4a48b9a/);assert.match(scenes,/d7037c83e1ae5b39bde3c30787637ba1d4c48ce2/);
  assert.match(scenes,/Background \+ sprite 1 \+ sprite 2/);
  assert.match(scenes,/IntroMoveMon MOVE_NIDORINO_RIGHT/);
  assert.match(scenes,/AnimateIntroNidorino/);
  assert.match(scenes,/TILEMAP_GENGAR_INTRO_1 \+ InitIntroNidorinoOAM/);
  assert.match(scenes,/Step \$\{commands\.length\+1\}/);
  assert.doesNotMatch(scenes,/enters|Hip|Hop|raises|slashes|reels|braces|lunges/);
  assert.match(scenes,/Verified visual delays, scroll steps, picture changes and movement lists/);
  assert.match(driver,/new ns\.Gen1SceneAnimationCatalog\(reader\)/);
  assert.doesNotMatch(driver,/for\(const group of \["intro","title"\]/);
  assert.match(runtime,/animation\/gbc\/timing\.js\?v=1/);
  assert.match(scenes,/\["#e0f8cf","#86c06c","#306850","#071821"\]/);
  assert.match(scenes,/imageFor:isolation/);assert.match(scenes,/id:"gengar"/);assert.match(scenes,/id:"front"/);
  assert.match(markup,/id="animation_layers"/);assert.match(editor,/setLayer\(id\)/);assert.match(renderer,/pickLayer\(clientX,clientY\)/);
  assert.match(editor,/\$\{command\.track\|\|"step"\}-\$\{index\+1\}/);
  assert.match(runtime,/animation\/gbc\/scenes\.js\?v=5/);assert.match(runtime,/sprite\/codecs\/gbc-2bpp\.js\?v=3/);
});

test("GB-family move animations mount both native battlers through the reusable battle compositor",async()=>{
  const [picture,scene,gen2Species,gen2Battle,gen1Runtime,gen2Runtime,gbaRuntime]=await Promise.all([
    read("js/core/gb-picture-canvas.js"),read("js/animation/scene.js"),read("js/core/gen2-species.js"),
    read("js/battle/gen2/driver.js"),read("js/rom/runtime/gbc.js"),read("js/rom/runtime/gen2.js"),read("js/rom/runtime/gba.js")
  ]);
  assert.match(picture,/class GbPictureCanvas/);
  assert.doesNotMatch(picture,/PokemonPicPointers|BaseData|gMonFrontPicTable|reader\.family/);
  assert.match(gen2Species,/backSprite\(id\)/);assert.match(gen2Species,/picturePointer\(id,\{back:true\}\)/);
  assert.match(gen2Battle,/this\.speciesSprite\(species,"front"\)/);
  assert.match(gen2Battle,/this\.speciesSprite\(species,"back"\)/);
  assert.match(gen2Battle,/layout:"gen2-animation"/);
  assert.match(scene,/nativeScene:native/);assert.match(scene,/data\.backSprite\(species\)/);
  for(const runtime of[gen1Runtime,gen2Runtime,gbaRuntime]){
    const moveBlock=runtime.slice(runtime.indexOf('workspaceId==="move_editor"'),runtime.indexOf('workspaceId==="sound_editor"'));
    assert.match(moveBlock,/battle\/preview\.js/);
    assert.match(moveBlock,/battle\/(?:gbc|gen2|gba)\/driver\.js/);
  }
});

test("GBA species subdomains fail independently instead of disabling verified pictures",async()=>{
  const species=await read("js/core/gba-species.js");
  assert.match(species,/requireProfile\(\.\.\.names\)/);
  assert.doesNotMatch(species,/\"pokedexCount\",\"evolutions\",\"tmHmLearnsets\",\"tmHmCount\",\"speciesIdToCryId\",\"cryTable\"/);
  assert.match(species,/requireProfile\("evolutions"\)/);
  assert.match(species,/requireProfile\("tmHmLearnsets","tmHmCount"\)/);
  assert.match(species,/requireProfile\("speciesIdToCryId","cryTable"\)/);
});

test("Item Editor uses the shared compact document layout for every game family",async()=>{
  const [page,editor,styles,gbaRuntime,gbcRuntime,gen2Runtime]=await Promise.all([
    read("items.html"),read("js/items/editor.js"),read("scss/editors/_items.scss"),
    read("js/rom/runtime/gba.js"),read("js/rom/runtime/gbc.js"),read("js/rom/runtime/gen2.js")
  ]);
  assert.match(page,/id="item_list" aria-label="Items"/);
  assert.doesNotMatch(page,/id="item_list"[^>]*size=/);
  assert.match(page,/class="[^"]*item-visual[^"]*editor-shell__main[^"]*"/);
  assert.match(page,/data-ui-window-footer class="editor-actions"/);
  assert.match(editor,/technicalAttributes\(key\)/);
  assert.match(editor,/this\.elements\.sprite\.hidden=!spriteLink/);
  assert.match(editor,/padded!==query/);
  assert.doesNotMatch(styles,/#item_editor\{grid-template-columns/);
  assert.match(styles,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles,/grid-template-rows:minmax\(0,2fr\) minmax\(180px,\.8fr\) auto/);
  for(const runtime of[gbaRuntime,gbcRuntime])assert.match(runtime,/items\/editor\.js\?v=8/);
  assert.match(gen2Runtime,/items\/editor\.js\?v=6/);
});
