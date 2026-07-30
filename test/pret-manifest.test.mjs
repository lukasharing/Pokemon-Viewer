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
});

test("pret manifests require every declared symbol and pin clean provenance",()=>{
  const config={
    profile:"gen3-emerald-en",fingerprint:"f3ae088181bf583e55daf962a92bb46f4f1d07b7",
    platform:"gba",repository:"pret/pokeemerald",build:"reference",
    requiredSymbols:["gTrainers","gSpeciesNames"],optionalSymbols:["gSongTable"],
    resources:{trainers:{coverage:"partial-roots",symbols:["gTrainers","gSpeciesNames"]}}
  };
  const manifest=buildPretManifest({
    config,commit:"83df84e40623b79281f2397faa611cbf044170bd",
    symbolText:"08310030 gTrainers\n083185C8 gSpeciesNames\n"
  });
  assert.equal(manifest.symbols.gTrainers.offset,0x310030);
  assert.equal(manifest.source.commit,"83df84e40623b79281f2397faa611cbf044170bd");
  assert.deepEqual(manifest.resources.trainers.symbols,["gTrainers","gSpeciesNames"]);
  assert.equal("gSongTable" in manifest.symbols,false);
  assert.throws(()=>buildPretManifest({config,commit:manifest.source.commit,symbolText:"08310030 gTrainers"}),/gSpeciesNames/);
  assert.throws(()=>buildPretManifest({
    config:{...config,resources:{trainers:{symbols:["gSongTable"]}}},
    commit:manifest.source.commit,symbolText:"08310030 gTrainers\n083185C8 gSpeciesNames"
  }),/unselected symbols/);
});

test("browser source registry exactly mirrors committed generated manifests",async()=>{
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  const registrySource=await readFile(new URL("../js/core/source-manifest-registry.js",import.meta.url),"utf8");
  vm.runInContext(registrySource,context);
  for(const file of ["gen1-red.json","gen1-blue.json","gen2-crystal.json","gen3-emerald.json"]){
    const expected=JSON.parse(await readFile(new URL(`../manifests/generated/${file}`,import.meta.url),"utf8"));
    const actual=context.SourceManifestRegistry.get(expected.fingerprint);
    assert.ok(actual,`${file} is registered`);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
  }
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
