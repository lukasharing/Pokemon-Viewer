import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {parseSymbolText,buildPretManifest} from "../scripts/lib/pret-manifest.mjs";

test("pret manifest parser normalizes RGBDS banked and GBA ROM symbols",()=>{
  const rgb=parseSymbolText("00:0150 Start\n0E:5D3B TrainerDataPointers\n",{platform:"gb"});
  assert.deepEqual(rgb.get("Start"),{offset:0x150,bank:0,address:0x150,format:"rgbds"});
  assert.deepEqual(rgb.get("TrainerDataPointers"),{offset:0x39d3b,bank:0x0e,address:0x5d3b,format:"rgbds"});
  const gba=parseSymbolText("08310030 gTrainers\n083185C8 D gSpeciesNames\n                0x08486578                gMapGroups\n",{platform:"gba"});
  assert.deepEqual(gba.get("gTrainers"),{offset:0x310030,address:0x08310030,format:"gnu"});
  assert.deepEqual(gba.get("gSpeciesNames"),{offset:0x3185c8,address:0x083185c8,format:"gnu"});
  assert.deepEqual(gba.get("gMapGroups"),{offset:0x486578,address:0x08486578,format:"gnu"});
  const sized=parseSymbolText("08310030 00001F20 D gTrainers\n0x083185C8 0x00000E00 gSpeciesNames\n",{platform:"gba"});
  assert.deepEqual(sized.get("gTrainers"),{offset:0x310030,address:0x08310030,extent:0x1f20,format:"gnu"});
  assert.deepEqual(sized.get("gSpeciesNames"),{offset:0x3185c8,address:0x083185c8,extent:0xe00,format:"gnu"});
});

test("pret manifests require every declared symbol and pin clean provenance",()=>{
  const config={
    profile:"gen3-emerald-en",fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7",
    platform:"gba",repository:"pret/pokeemerald",build:"reference",
    knowledge:{id:"gen3-emerald-en",family:"gba",method:"reviewed-manual",evidence:"fixture review"},
    requiredSymbols:["gTrainers","gSpeciesNames"],optionalSymbols:["gSongTable"],
    resources:{trainers:{coverage:"partial-roots",symbols:["gTrainers","gSpeciesNames"]}},
    symbolMetadata:{
      gTrainers:{kind:"table",count:4,stride:8,extent:32,pointerKind:"gba32",ownership:"exclusive"}
    }
  };
  const manifest=buildPretManifest({
    config,commit:"83df84e40623b79281f2397faa611cbf044170bd",
    symbolText:"08310030 gTrainers\n083185C8 gSpeciesNames\n"
  });
  assert.equal(manifest.symbols.gTrainers.offset,0x310030);
  assert.deepEqual(manifest.symbols.gTrainers,{
    offset:0x310030,address:0x08310030,format:"gnu",
    kind:"table",count:4,stride:8,extent:32,pointerKind:"gba32",ownership:"exclusive"
  });
  assert.equal(manifest.source.commit,"83df84e40623b79281f2397faa611cbf044170bd");
  assert.deepEqual(manifest.resources.trainers.symbols,["gTrainers","gSpeciesNames"]);
  assert.equal("gSongTable" in manifest.symbols,false);
  assert.throws(()=>buildPretManifest({config,commit:manifest.source.commit,symbolText:"08310030 gTrainers"}),/gSpeciesNames/);
  assert.throws(()=>buildPretManifest({
    config:{...config,resources:{trainers:{symbols:["gSongTable"]}}},
    commit:manifest.source.commit,symbolText:"08310030 gTrainers\n083185C8 gSpeciesNames"
  }),/unselected symbols/);
  assert.throws(()=>buildPretManifest({
    config:{...config,symbolMetadata:{gTrainers:{extent:16,count:4,stride:8}}},
    commit:manifest.source.commit,symbolText:"08310030 gTrainers\n083185C8 gSpeciesNames"
  }),/count × stride/);
});

test("pret manifest patterns collect source-named resource dictionaries without runtime offsets",()=>{
  const manifest=buildPretManifest({
    config:{
      profile:"pattern",fingerprint:"1111111111111111111111111111111111111111",
      platform:"gba",repository:"pret/example",
      knowledge:{id:"pattern",family:"gba",method:"reviewed-manual",evidence:"fixture review"},
      requiredSymbols:["gRoot"],optionalSymbolPatterns:["^g.*SpriteTemplate$"],
      resources:{animations:{coverage:"source-dictionary",symbols:["gRoot"],symbolPatterns:["SpriteTemplate$"]}}
    },
    commit:"2222222222222222222222222222222222222222",
    symbolText:"08000100 gRoot\n08000200 gImpactSpriteTemplate\n08000300 gOtherSpriteTemplate\n08000400 Ignored"
  });
  assert.deepEqual(Object.keys(manifest.symbols),["gRoot","gImpactSpriteTemplate","gOtherSpriteTemplate"]);
  assert.deepEqual(manifest.resources.animations.symbols,["gRoot","gImpactSpriteTemplate","gOtherSpriteTemplate"]);
  assert.throws(()=>buildPretManifest({
    config:{
      profile:"bad",fingerprint:"1111111111111111111111111111111111111111",
      platform:"gba",repository:"pret/example",requiredSymbols:["gRoot"],optionalSymbolPatterns:["["]
    },
    commit:"2222222222222222222222222222222222222222",symbolText:"08000100 gRoot"
  }),/pattern 1 is invalid/);
});

test("browser source registry exactly mirrors committed generated manifests",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  const registrySource=await readFile(new URL("../js/core/source-manifest-registry.js",import.meta.url),"utf8");
  vm.runInContext(registrySource,context);
  for(const file of ["gen1-red.json","gen1-blue.json","gen2-crystal.json","gen3-emerald.json","gen3-firered-rev1.json"]){
    const expected=JSON.parse(await readFile(new URL(`../manifests/generated/${file}`,import.meta.url),"utf8"));
    const actual=context.SourceManifestRegistry.get(expected.fingerprint);
    assert.ok(actual,`${file} is registered`);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
  }
  const red=context.SourceManifestRegistry.get("ea9bcae617fdf159b045185467ae58b2e4a48b9a");
  const crystal=context.SourceManifestRegistry.get("f4cd194bdee0d04ca4eac29e09b8e4e9d818c133");
  const emerald=context.SourceManifestRegistry.get("f3ae088181bf583e55daf962a92bb46f4f1d07b7");
  const fireRed=context.SourceManifestRegistry.get("dd5945db9b930750cb39d00c84da8571feebf417");
  assert.deepEqual(
    {count:red.symbols.Moves.count,stride:red.symbols.Moves.stride,extent:red.symbols.Moves.extent},
    {count:165,stride:6,extent:990}
  );
  assert.deepEqual(
    {count:crystal.symbols.Moves.count,stride:crystal.symbols.Moves.stride,extent:crystal.symbols.Moves.extent},
    {count:251,stride:7,extent:1757}
  );
  assert.deepEqual(
    {
      count:emerald.symbols.gBattleAnims_Moves.count,
      stride:emerald.symbols.gBattleAnims_Moves.stride,
      pointerKind:emerald.symbols.gBattleAnims_Moves.pointerKind
    },
    {count:355,stride:4,pointerKind:"gba32"}
  );
  assert.deepEqual(
    {count:fireRed.symbols.gTrainers.count,stride:fireRed.symbols.gTrainers.stride},
    {count:743,stride:40}
  );
});

test("FireRed Rev 1 provenance resolves exact source roots without Emerald aliases",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const file of ["../js/core/source-manifest-registry.js","../js/core/capability-manifest.js"]){
    vm.runInContext(await readFile(new URL(file,import.meta.url),"utf8"),context);
  }
  const result=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-fire_red-en",base:"fire_red",lang:"en",version:1,
    fingerprint:"dd5945db9b930750cb39d00c84da8571feebf417"
  });
  assert.equal(result.provenance.repository,"pret/pokefirered");
  assert.equal(result.provenance.commit,"df4449a27cd78dd747ce269e47d3ab4a0149d8f4");
  assert.equal(result.provenance.build,"pokefirered_rev1.gba reference");
  assert.equal(result.provenance.symbols.gMapGroups.offset,0x352718);
  assert.equal(result.provenance.symbols.sTMHMLearnsets.offset,0x252c38);
  assert.equal(result.provenance.symbols.sHoennSpeciesIdToCryId.offset,0x253a44);
  assert.equal(result.provenance.symbols.sItemIconTable.offset,0x3d4304);
  assert.equal(result.provenance.resources.townMap.coverage,"palette-graphics-kanto-and-sevii-section-roots");
  assert.equal(result.get("map_editor").state,"verified");
  assert.equal(result.get("pokedex_editor").state,"partial");
  assert.equal(result.get("item_editor").state,"partial");
  assert.equal(result.get("encounter_editor").state,"partial");
  assert.equal(result.get("encounter_editor").writable,true);
  assert.match(result.get("encounter_editor").reason,/2,176 native slots/);
  assert.match(result.get("sound_editor").reason,/FireRed/);
  assert.doesNotMatch(result.get("sound_editor").reason,/exact Emerald/);
  assert.match(result.get("animation_editor").reason,/FireRed/);
  assert.deepEqual(JSON.parse(JSON.stringify(result.get("item_editor").resources)),[
    {id:"items",coverage:"records-and-icon-table-root",symbols:["gItems","sItemIconTable"]},
    {id:"overworldSprites",coverage:"graphics-info-pointer-root",symbols:["gObjectEventGraphicsInfoPointers"]}
  ]);
});

test("Emerald provenance promotes encounters and items from exact source roots",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const file of ["../js/core/source-manifest-registry.js","../js/core/capability-manifest.js"]){
    vm.runInContext(await readFile(new URL(file,import.meta.url),"utf8"),context);
  }
  const result=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-emerald-en",base:"emerald",lang:"en",version:0,
    fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7"
  });
  assert.equal(result.provenance.repository,"pret/pokeemerald");
  assert.equal(result.provenance.commit,"83df84e40623b79281f2397faa611cbf044170bd");
  assert.equal(result.provenance.symbols.gWildMonHeaders.offset,0x552d48);
  assert.equal(result.provenance.symbols.gObjectEventGraphicsInfoPointers.offset,0x505620);
  assert.equal(result.provenance.symbols.gIntroVolbeat_Gfx.offset,0xd85f50);
  assert.equal(result.provenance.symbols.gTitleScreenBgPalettes.offset,0xdde258);
  assert.equal(result.provenance.symbols.sHoennTrainerCardBadges_Gfx.offset,0x56f5cc);
  assert.deepEqual(JSON.parse(JSON.stringify(result.provenance.resources.sceneTitle.symbols)),[
    "sTitleScreenRayquazaGfx","sTitleScreenLogoShineGfx","sTitleScreenCloudsGfx",
    "gTitleScreenBgPalettes","gTitleScreenPressStartPal","gTitleScreenPressStartGfx"
  ]);
  assert.equal(result.provenance.symbols.gItems.offset,0x5839a0);
  assert.equal(result.provenance.symbols.gItemIconTable.offset,0x614410);
  assert.equal(result.get("encounter_editor").state,"partial");
  assert.equal(result.get("item_editor").state,"partial");
  assert.equal(result.get("encounter_editor").resourceRequirements.complete,true);
  assert.equal(result.get("item_editor").resourceRequirements.complete,true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.get("encounter_editor").resourceRequirements.missing)),[]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.get("item_editor").resourceRequirements.missing)),[]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.get("sprite_editor").resourceRequirements.missingOptional)),[]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.get("item_editor").resources)),[
    {id:"items",coverage:"records-and-icon-table-root",symbols:["gItems","gItemIconTable"]},
    {id:"overworldSprites",coverage:"graphics-info-pointer-root",symbols:["gObjectEventGraphicsInfoPointers"]}
  ]);
});

test("a partial exact GBA source manifest promotes only independently audited workspaces",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  context.SourceManifestRegistry={
    get(){
      return {
        schemaVersion:1,
        source:{repository:"pret/pokefirered",commit:"df4449a27cd78dd747ce269e47d3ab4a0149d8f4",build:"partial"},
        symbols:{gMapGroups:{offset:0x352718}},
        resources:{maps:{coverage:"root-only",symbols:["gMapGroups"]}}
      };
    }
  };
  vm.runInContext(await readFile(new URL("../js/core/capability-manifest.js",import.meta.url),"utf8"),context);
  const result=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-fire_red-en",base:"fire_red",lang:"en",version:1,
    fingerprint:"dd5945db9b930750cb39d00c84da8571feebf417"
  });
  assert.equal(result.get("map_editor").state,"verified");
  assert.equal(result.get("sprite_editor").state,"research");
  assert.equal(result.get("battle_editor").state,"research");
  assert.equal(result.get("pokedex_editor").state,"research");
  assert.equal(result.get("move_editor").state,"research");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.get("map_editor").resourceRequirements)),
    {
      workspace:"map_editor",
      required:["maps"],
      optional:["townMap"],
      resources:[
        {id:"maps",necessity:"required",coverage:"root-only",symbols:["gMapGroups"],present:true,missingSymbols:[]},
        {id:"townMap",necessity:"optional",coverage:null,symbols:[],present:false,missingSymbols:[]}
      ],
      missing:[],
      missingOptional:["townMap"],
      complete:true
    }
  );
  assert.equal(result.get("sprite_editor").resourceRequirements.complete,false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.get("sprite_editor").resourceRequirements.missing)),
    ["species"]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.get("sprite_editor").resourceRequirements.missingOptional)),
    ["overworldSprites","trainers"]
  );
});

test("workspace resource requirements are independent and expose missing symbols",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/capability-manifest.js",import.meta.url),"utf8"),context);
  const manifest={
    symbols:{gSongTable:{offset:1}},
    resources:{
      audio:{coverage:"song-root",symbols:["gSongTable","gCryTable"]},
      species:{coverage:"names",symbols:["gSpeciesNames"]}
    }
  };
  const sound=context.CapabilityManifest.inspectWorkspaceResources(manifest,"sound_editor");
  const map=context.CapabilityManifest.inspectWorkspaceResources(manifest,"map_editor");
  assert.equal(sound.complete,false);
  assert.deepEqual(JSON.parse(JSON.stringify(sound.missing)),["audio"]);
  assert.deepEqual(JSON.parse(JSON.stringify(sound.missingOptional)),["species"]);
  assert.deepEqual(JSON.parse(JSON.stringify(sound.resources[0].missingSymbols)),["gCryTable"]);
  assert.deepEqual(JSON.parse(JSON.stringify(sound.resources[1].missingSymbols)),["gSpeciesNames"]);
  assert.deepEqual(JSON.parse(JSON.stringify(map.missing)),["maps"]);
  assert.deepEqual(JSON.parse(JSON.stringify(map.missingOptional)),["townMap"]);
});

test("GBA workspace audits require pinned source provenance as well as a matching ROM fingerprint",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  context.SourceManifestRegistry={
    get(){
      return {
        schemaVersion:1,
        source:{repository:"pret/pokefirered",commit:"untrusted",build:"spoofed"},
        symbols:{gMapGroups:{offset:0x352718}},
        resources:{maps:{coverage:"root-only",symbols:["gMapGroups"]}}
      };
    }
  };
  vm.runInContext(await readFile(new URL("../js/core/capability-manifest.js",import.meta.url),"utf8"),context);
  const result=context.CapabilityManifest.resolve({
    family:"gba",editorProfile:"gen3-fire_red-en",base:"fire_red",lang:"en",version:1,
    fingerprint:"dd5945db9b930750cb39d00c84da8571feebf417"
  });
  assert.equal(result.get("map_editor").state,"research");
  assert.equal(result.get("map_editor").ordinary,false);
});

test("GBA asset dictionaries resolve engine-local source symbol names",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/gba-rom-assets.js",import.meta.url),"utf8"),context);
  const offsets=new Map([
    ["sTMHMLearnsets",0x252c38],
    ["sHoennSpeciesIdToCryId",0x253a44],
    ["sItemIconTable",0x3d4304]
  ]);
  const profile=context.PokemonViewer.gba.assets.profile({
    type:"fire_red",version:1,
    memoryProfile:{verified:true,offset:name=>offsets.get(name)??null}
  });
  assert.equal(profile.tmHmLearnsets,0x252c38);
  assert.equal(profile.speciesIdToCryId,0x253a44);
  assert.equal(profile.itemIcons,0x3d4304);
});

test("capability provenance resolves the exact source manifest",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const file of ["../js/core/source-manifest-registry.js","../js/core/capability-manifest.js"]){
    vm.runInContext(await readFile(new URL(file,import.meta.url),"utf8"),context);
  }
  const result=context.CapabilityManifest.resolve({
    family:"gbc",editorProfile:"gen2-crystal-intl",base:"crystal",lang:"en",version:0,
    fingerprint:"f4cd194bdee0d04ca4eac29e09b8e4e9d818c133"
  });
  assert.equal(result.provenance.commit,"3438c7003a57fa2987fcb223d14b660761b33c64");
  assert.equal(result.provenance.symbols.MapGroupPointers.offset,0x94000);
  assert.equal(result.provenance.resources.maps.coverage,"table-root");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.get("map_editor").resources)),
    [
      {id:"maps",coverage:"table-root",symbols:["MapGroupPointers"]},
      {id:"townMap",coverage:"graphics-tilemaps-palettes-landmarks-flypoints",symbols:["TownMapGFX","JohtoMap","KantoMap","TownMapPals.PalMap","MalePokegearPals","Landmarks","Flypoints"]}
    ]
  );
  assert.equal(result.map_editor?.state,undefined);
  assert.equal(result.get("map_editor").state,"partial");
});

test("exact Red/Blue exposes verified-profile Pokédex, Move and cry capabilities",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  for(const file of ["../js/core/source-manifest-registry.js","../js/core/capability-manifest.js"]){
    vm.runInContext(await readFile(new URL(file,import.meta.url),"utf8"),context);
  }
  const blue=context.CapabilityManifest.resolve({
    family:"gbc",editorProfile:"gen1-rgb-intl",base:"blue",lang:"en",version:0,
    fingerprint:"d7037c83e1ae5b39bde3c30787637ba1d4c48ce2"
  });
  assert.equal(blue.get("pokedex_editor").state,"partial");
  assert.equal(blue.get("pokedex_editor").writable,true);
  assert.equal(blue.get("sound_editor").state,"partial");
  assert.equal(blue.get("sound_editor").writable,true);
  assert.equal(blue.get("move_editor").state,"partial");
  assert.equal(blue.get("move_editor").writable,true);
  assert.equal(blue.get("encounter_editor").state,"partial");
  assert.equal(blue.get("encounter_editor").writable,true);
  assert.deepEqual(JSON.parse(JSON.stringify(blue.get("encounter_editor").resources)),[
    {id:"encounters",coverage:"grass-water-fishing-static-roots",symbols:["WildDataPointers","WildMonEncounterSlotChances","ItemUseOldRod","GoodRodMons","SuperRodData","Route12DefaultScript","Route16DefaultScript"]},
    {id:"maps",coverage:"table-roots",symbols:["MapHeaderPointers","MapHeaderBanks"]},
    {id:"species",coverage:"partial-roots",symbols:["BaseStats","MewBaseStats","MonsterNames","PokedexOrder","EvosMovesPointerTable","HealEffect_"]}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(blue.get("move_editor").resources)),[
    {id:"moves",coverage:"records-effects-tmhm-animation-sound-subanimations-tiles-oam",symbols:["Moves","MoveNames","TechnicalMachines","MoveEffectPointerTable","MoveSoundTable","AttackAnimationPointers","MoveAnimationTilesPointers","SubanimationPointers","FrameBlockPointers","FrameBlockBaseCoords"]},
    {id:"species",coverage:"partial-roots",symbols:["BaseStats","MewBaseStats","MonsterNames","PokedexOrder","EvosMovesPointerTable","HealEffect_"]}
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(blue.get("animation_editor").resourceRequirements.required)),
    ["moves"],
    "Gen I animation evidence comes from its move animation tables, never the GBA resource policy"
  );
  assert.equal(blue.get("animation_editor").resourceRequirements.complete,true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(blue.get("item_editor").resourceRequirements.required)),
    [],
    "the current Gen I item capability is operation-audited while its dedicated resource group remains future manifest work"
  );
  assert.ok(blue.get("pokedex_editor").evidence.includes("Gen I front/back picture codec"));
  assert.ok(blue.get("pokedex_editor").evidence.includes("native ScaleSpriteByTwo back rendering"));

  const crystal=context.CapabilityManifest.resolve({
    family:"gbc",editorProfile:"gen2-crystal-intl",base:"crystal",lang:"en",version:0,
    fingerprint:"f4cd194bdee0d04ca4eac29e09b8e4e9d818c133"
  });
  assert.equal(crystal.get("pokedex_editor").state,"partial");
  assert.equal(crystal.get("pokedex_editor").writable,true);
  assert.equal(crystal.get("sound_editor").state,"partial");
  assert.equal(crystal.get("sound_editor").writable,true);
  assert.equal(crystal.get("move_editor").state,"partial");
  assert.equal(crystal.get("move_editor").writable,true);
  assert.equal(crystal.get("battle_editor").state,"partial");
  assert.equal(crystal.get("battle_editor").writable,true);
  assert.equal(crystal.get("item_editor").state,"partial");
  assert.equal(crystal.get("item_editor").writable,true);
  assert.equal(crystal.get("item_editor").resourceRequirements.complete,true);
  assert.deepEqual(JSON.parse(JSON.stringify(crystal.get("item_editor").resources)),[
    {id:"items",coverage:"names-attributes-description-pointers",symbols:["ItemNames","ItemAttributes","ItemDescriptions"]}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(crystal.get("battle_editor").resources)),[
    {id:"trainers",coverage:"classes-parties-pictures",symbols:["TrainerGroups","TrainerClassNames","TrainerPicPointers"]},
    {id:"species",coverage:"entries-base-pics-palettes-footprints-cries-progression-machines",symbols:["BaseData","PokemonNames","PokemonPalettes","PokemonPicPointers","UnownPicPointers","FixPicBank.PicsBanks","Footprints","PokemonCries","EvosAttacksPointers","EggMovePointers","TMHMMoves"]},
    {id:"battleAnimations",coverage:"scripts-objects-frames-oam-graphics",symbols:["BattleAnimations","BattleAnimObjects","BattleAnimFrameData","BattleAnimOAMData","AnimObjGFX"]}
  ]);
  assert.equal(crystal.get("encounter_editor").state,"partial");
  assert.equal(crystal.get("encounter_editor").writable,true);
  assert.deepEqual(JSON.parse(JSON.stringify(crystal.get("encounter_editor").resources)),[
    {id:"encounters",coverage:"grass-water-fishing-headbutt-rock-contest-roamer-static-slots",symbols:["JohtoGrassWildMons","JohtoWaterWildMons","KantoGrassWildMons","KantoWaterWildMons","FishGroups","TimeFishGroups","TreeMons","TreeMonMaps","RockMonMaps","ContestMons","NationalParkBugContest_MapAttributes","InitRoamMons","RoamMaps","RedGyarados","IlexForestShrineScript.CelebiEvent","VermilionSnorlax","VoltorbExplodingTrap","GeodudeExplodingTrap","KoffingExplodingTrap","WateredWeirdTreeScript","TinTowerHoOh","UnionCaveLapras","Route29Tutorial1","Route29Tutorial2","CatchingTutorialDudeScript","TinTower1FSuicuneBattleScript","RocketElectrode1","RocketElectrode2","RocketElectrode3","Lugia","LakeOfRage_MapAttributes","IlexForest_MapAttributes","VermilionCity_MapAttributes","TeamRocketBaseB1F_MapAttributes","Route36_MapAttributes","TinTowerRoof_MapAttributes","UnionCaveB2F_MapAttributes","Route29_MapAttributes","TinTower1F_MapAttributes","TeamRocketBaseB2F_MapAttributes","WhirlIslandLugiaChamber_MapAttributes"]},
    {id:"maps",coverage:"table-root",symbols:["MapGroupPointers"]},
    {id:"species",coverage:"entries-base-pics-palettes-footprints-cries-progression-machines",symbols:["BaseData","PokemonNames","PokemonPalettes","PokemonPicPointers","UnownPicPointers","FixPicBank.PicsBanks","Footprints","PokemonCries","EvosAttacksPointers","EggMovePointers","TMHMMoves"]}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(crystal.get("move_editor").resources)),[
    {id:"moves",coverage:"records-names-machines",symbols:["Moves","MoveNames","TMHMMoves"]},
    {id:"species",coverage:"entries-base-pics-palettes-footprints-cries-progression-machines",symbols:["BaseData","PokemonNames","PokemonPalettes","PokemonPicPointers","UnownPicPointers","FixPicBank.PicsBanks","Footprints","PokemonCries","EvosAttacksPointers","EggMovePointers","TMHMMoves"]}
  ]);
});
