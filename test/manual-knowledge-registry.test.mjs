import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {buildProjectManifestFromSymbols} from "../js/core/source-symbol-parser.mjs";
import {buildManualKnowledge} from "../scripts/lib/pret-manifest.mjs";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const fingerprint="0123456789abcdef0123456789abcdef01234567";

test("manual engine knowledge is offset-free, family-isolated, and reusable by engine profile",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/core/manual-knowledge-registry.js"),context);
  const registry=context.ManualKnowledgeRegistry;
  assert.equal(registry.all.length,4);
  assert.equal(registry.get("gen1-rgb-intl").id,"gen1-rgb-intl");
  assert.equal(registry.get("gen1-red-en"),registry.get("gen1-rgb-intl"));
  assert.equal(registry.get("gen3-emerald-en").family,"gba");
  assert.equal(registry.get("gen3-emerald-en").schemaVersion,2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.get("gen3-emerald-en").policy)),
    {
      addressAuthority:"none",
      compatibilityAuthority:"none",
      writeAuthority:"operation-audit-required"
    }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.get("gen1-rgb-intl").reviews.map(review=>review.profile))),
    ["gen1-blue-en","gen1-red-en"]
  );
  assert.ok(registry.get("gen3-emerald-en").reviews[0].commit.match(/^[0-9a-f]{40}$/));
  assert.equal(registry.schema("gen3-emerald-en","gBattleMoves").stride,12);
  assert.equal(registry.structure("gen3-fire_red-en","WildPokemonHeader").size,20);
  assert.equal(registry.structure("gen3-fire_red-en","WildPokemon").fields.species.byte,2);
  assert.equal(registry.structure("gen3-emerald-en","GbaTrainer").size,40);
  assert.equal(registry.structure("gen3-emerald-en","GbaTrainer").fields.trainerName.count,12);
  assert.equal(registry.structure("gen3-emerald-en","GbaTrainer").partyFormats["3"].fields.moves.byte,8);
  const gen1Move=registry.structure("gen1-blue-en","Gen1Move");
  const gen2Move=registry.structure("gen2-crystal-intl","Gen2Move");
  const gbaMove=registry.structure("gen3-emerald-en","GbaMove");
  assert.equal(gen1Move.size,6);
  assert.equal(gen1Move.accuracyScale,255);
  assert.equal(gen2Move.size,7);
  assert.equal(gen2Move.fields.effectChance.byte,6);
  assert.equal(gbaMove.size,12);
  assert.equal(gbaMove.accuracyScale,100);
  assert.equal(gbaMove.fields.flags.type,"u32");
  assert.notEqual(gen1Move,gen2Move);
  assert.notEqual(gen2Move,gbaMove);
  assert.equal(registry.structure("gen3-fire_red-en","GbaTrainer").partyFormats["1"].stride,16);
  for(const profile of ["gen3-emerald-en","gen3-fire_red-en"]){
    const assets=registry.structure(profile,"GbaBattleAnimationAssets");
    assert.equal(assets.firstTag,10000);
    assert.equal(assets.count,289);
    assert.equal(assets.picture.tag,6);
    assert.equal(assets.palette.tag,4);
    assert.equal(assets.picture.compression,"gba-lz77");
    assert.equal(assets.paletteTagAliases["47"],46);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.structure("gen3-emerald-en","WildEncounterMethods").methods[0].weights)),
    [20,20,10,10,10,10,5,5,4,4,1,1]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.resource("gen2-crystal-intl","battleAnimations").symbols)),
    ["BattleAnimations","BattleAnimObjects","BattleAnimFrameData","BattleAnimOAMData","AnimObjGFX"]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.resource("gen1-rgb-intl","battleHud").symbols)),
    ["BattleHudTiles1","HpBarAndStatusGraphics","TextBoxGraphics","PokeballTileGraphics"]
  );
  assert.equal(registry.schema("gen1-blue-en","BattleHudTiles1").extent,24);
  assert.equal(registry.schema("gen1-red-en","HpBarAndStatusGraphics").extent,480);
  assert.deepEqual(
    JSON.parse(JSON.stringify(registry.resource("gen1-rgb-intl","nativeFont").symbols)),
    ["FontGraphics"]
  );
  assert.equal(registry.schema("gen1-blue-en","FontGraphics").extent,1024);
  const contract=registry.contract("gen3-emerald-en","structure","WildPokemon");
  assert.equal(contract.value.fields.species.type,"u16");
  assert.equal(contract.provenance.knowledgeId,"gen3-emerald-en");
  assert.equal(contract.provenance.policy.addressAuthority,"none");
  assert.equal(registry.contract("gen3-emerald-en","structure","MissingStructure"),null);
  const serialized=JSON.stringify(registry.all);
  assert.doesNotMatch(serialized,/"offset"\s*:/);
  assert.doesNotMatch(serialized,/"fingerprint"\s*:/);
});

test("manual knowledge loads before exact manifests and capability resolution",async()=>{
  const html=await read("index.html");
  const knowledge=html.indexOf("js/core/manual-knowledge-registry.js");
  const source=html.indexOf("js/core/source-manifest-registry.js");
  const capabilities=html.indexOf("js/core/capability-manifest.js");
  assert.ok(knowledge>=0,"manual knowledge registry must be loaded");
  assert.ok(source>knowledge,"exact manifests load after the offset-free contract");
  assert.ok(capabilities>source,"capabilities resolve only after both evidence layers");
});

test("MemoryProfile exposes reviewed schemas without converting them into addresses",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const path of ["js/core/manual-knowledge-registry.js","js/core/memory-profile.js"]){
    vm.runInContext(await read(path),context);
  }
  const profile=new context.MemoryProfile(
    {editorProfile:"gen3-emerald-en",selection:"user-base"},
    {
      id:"hack",family:"gba",game:"emerald",fingerprint,
      provenance:{origin:"project",engineProfile:"gen3-emerald-en",symbols:{},resources:{}}
    }
  );
  assert.equal(profile.knowledgeId,"gen3-emerald-en");
  assert.equal(profile.schema("gBattleMoves").count,355);
  assert.equal(profile.structure("WildPokemonInfo").fields.wildPokemon.type,"gba32");
  assert.equal(profile.resourceContract("moves").coverage,"fixed-records-names-animation-root");
  assert.equal(profile.contract("structure","WildPokemon").value.size,4);
  assert.equal(profile.contract("structure","WildPokemon").provenance.policy.writeAuthority,"operation-audit-required");
  assert.equal(profile.requireStructure("GbaMove").size,12);
  assert.throws(()=>profile.requireStructure("Gen1Move"),/not reviewed/);
  assert.equal(profile.offset("gBattleMoves"),null);
  assert.equal(profile.exact,false);
});

test("manual engine knowledge rejects absolute ROM identity even before registry generation",()=>{
  const config={
    profile:"test-engine",platform:"gba",repository:"example/test",
    knowledge:{
      id:"test-engine",family:"gba",method:"reviewed-manual",
      evidence:"reviewed fixture"
    },
    symbolMetadata:{UnsafeTable:{kind:"table",offset:0x1234}}
  };
  assert.throws(
    ()=>buildManualKnowledge(config,{source:{
      repository:"example/test",commit:"a".repeat(40),build:"test.gba"
    }}),
    /cannot contain absolute identity field.*offset/
  );
});

test("hack symbol imports combine exact addresses with reviewed manual schemas",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/core/manual-knowledge-registry.js"),context);
  const template=context.ManualKnowledgeRegistry.get("gen3-emerald-en");
  const result=buildProjectManifestFromSymbols({
    symbolText:"08001000 000010A4 gBattleMoves\n08003000 00001207 gMoveNames\n08005000 0000058C gBattleAnims_Moves",
    platform:"gba",romSize:0x10000,fingerprint,
    engineProfile:"gen3-emerald-en",profile:"my-emerald-hack",
    source:{repository:"example/hack",commit:"a".repeat(40),build:"hack.gba"},
    template
  });
  assert.equal(result.manifest.knowledge.id,"gen3-emerald-en");
  assert.equal(result.manifest.symbols.gBattleMoves.offset,0x1000);
  assert.equal(result.manifest.symbols.gBattleMoves.count,355);
  assert.equal(result.manifest.symbols.gBattleMoves.stride,12);
  assert.equal(result.manifest.symbols.gBattleMoves.kind,"table");
  assert.equal(result.manifest.resources.moves.coverage,"fixed-records-names-animation-root");
  assert.equal(result.manifest.resources.maps,undefined);
});

test("one manually located hack symbol inherits only its engine schema, never a stock offset",async()=>{
  const context=vm.createContext({globalThis:null,localStorage:null});
  context.globalThis=context;
  for(const path of ["js/core/manual-knowledge-registry.js","js/core/project-manifest-registry.js"]){
    vm.runInContext(await read(path),context);
  }
  const template=context.ManualKnowledgeRegistry.get("gen3-emerald-en");
  const registry=new context.ProjectManifestRegistryClass({storage:null});
  const manifest=registry.upsertManualSymbol({
    fingerprint,profile:"my-emerald-hack",engineProfile:"gen3-emerald-en",platform:"gba",
    name:"gBattleMoves",entry:{offset:0x7000},template
  },{fingerprint,profile:"gen3-emerald-en",platform:"gba",romSize:0x10000});
  assert.equal(manifest.knowledge.id,"gen3-emerald-en");
  assert.equal(manifest.symbols.gBattleMoves.offset,0x7000);
  assert.equal(manifest.symbols.gBattleMoves.extent,4260);
  assert.equal(manifest.symbols.gBattleMoves.count,355);
  assert.equal(manifest.symbols.gBattleMoves.stride,12);
  assert.equal(manifest.symbols.gBattleMoves.origin,"manual");
  assert.equal(manifest.resources.moves,undefined);
});

test("a Gen I hack unlocks the native battle HUD only after every verified root is supplied",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/core/manual-knowledge-registry.js"),context);
  const template=context.ManualKnowledgeRegistry.get("gen1-rgb-intl");
  const partial=buildProjectManifestFromSymbols({
    symbolText:"03:4000 MapHeaderPointers\n03:4200 MapHeaderBanks\n04:6080 BattleHudTiles1\n04:5ea0 HpBarAndStatusGraphics\n04:6288 TextBoxGraphics",
    platform:"gb",romSize:0x80000,fingerprint,
    engineProfile:"gen1-blue-en",profile:"blue-derived-hack",
    source:{repository:"example/blue-hack",commit:"b".repeat(40),build:"hack.gb"},
    template
  });
  assert.equal(partial.manifest.resources.battleHud,undefined);
  assert.deepEqual(
    JSON.parse(JSON.stringify(partial.report.missing.battleHud)),
    ["PokeballTileGraphics"]
  );
  assert.equal(partial.manifest.symbols.BattleHudTiles1,undefined);
  const complete=buildProjectManifestFromSymbols({
    symbolText:"04:6080 BattleHudTiles1\n04:5ea0 HpBarAndStatusGraphics\n04:6288 TextBoxGraphics\n0e:697e PokeballTileGraphics",
    platform:"gb",romSize:0x80000,fingerprint,
    engineProfile:"gen1-blue-en",profile:"blue-derived-hack",
    source:{repository:"example/blue-hack",commit:"b".repeat(40),build:"hack.gb"},
    template
  });
  assert.equal(complete.manifest.resources.battleHud.coverage,"native-hud-textbox-status-and-party-tiles");
  assert.equal(complete.manifest.symbols.PokeballTileGraphics.offset,0x3a97e);
  assert.equal(complete.manifest.symbols.PokeballTileGraphics.extent,64);
});

test("the Gen I battle HUD fails locally instead of reading stock fallback addresses",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const path of ["js/battle/hud-assets.js","js/battle/gbc/hud-assets.js"]){
    vm.runInContext(await read(path),context);
  }
  const symbols={
    BattleHudTiles1:{offset:0x1000,extent:24},
    HpBarAndStatusGraphics:{offset:0x2000,extent:480},
    TextBoxGraphics:{offset:0x3000,extent:512},
    PokeballTileGraphics:{offset:0x4000,extent:64}
  };
  const makeReader=entries=>({
    memory:{assertRange(){}},
    memoryProfile:{
      require(name){
        const symbol=entries[name];
        if(!symbol)throw new Error(`Memory symbol '${name}' is not verified for a test hack.`);
        return symbol;
      },
      schema(){return null;}
    }
  });
  const complete=context.PokemonViewer.battle.HudAssets.create(makeReader(symbols),"gbc");
  assert.equal(complete.base,0x1000);
  assert.equal(complete.partyBallBase,0x4000);
  const missing={...symbols};
  delete missing.TextBoxGraphics;
  assert.throws(
    ()=>context.PokemonViewer.battle.HudAssets.create(makeReader(missing),"gbc"),
    /TextBoxGraphics.*not verified/
  );
});

test("a Gen I hack resolves the native font from its own symbol instead of a retail address",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await read("js/core/manual-knowledge-registry.js"),context);
  const template=context.ManualKnowledgeRegistry.get("gen1-rgb-intl");
  const result=buildProjectManifestFromSymbols({
    symbolText:"09:5000 FontGraphics",
    platform:"gb",romSize:0x80000,fingerprint,
    engineProfile:"gen1-blue-en",profile:"relocated-font-hack",
    source:{repository:"example/relocated-font",commit:"c".repeat(40),build:"hack.gb"},
    template
  });
  assert.equal(result.manifest.resources.nativeFont.coverage,"complete-gen1-fixed-width-glyph-table");
  assert.equal(result.manifest.symbols.FontGraphics.offset,0x25000);
  assert.equal(result.manifest.symbols.FontGraphics.extent,1024);
});
