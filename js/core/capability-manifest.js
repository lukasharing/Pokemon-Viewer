(function(global){
  "use strict";

  const STATES=Object.freeze({
    unavailable:Object.freeze({rank:0,label:"Unavailable",ordinary:false}),
    research:Object.freeze({rank:1,label:"Research",ordinary:false}),
    partial:Object.freeze({rank:2,label:"Partial",ordinary:true}),
    verified:Object.freeze({rank:3,label:"Verified",ordinary:true})
  });
  const WORKSPACES=Object.freeze([
    "hex_editor","code_workspace","map_editor","sprite_editor","battle_editor",
    "pokedex_editor","move_editor","sound_editor","animation_editor","encounter_editor","item_editor","emulator_editor"
  ]);
  const WORKSPACE_RESOURCES=Object.freeze({
    code_workspace:Object.freeze([]),
    map_editor:Object.freeze(["maps","townMap"]),
    sprite_editor:Object.freeze(["overworldSprites","species","trainers"]),
    battle_editor:Object.freeze(["trainers","species","battleAnimations"]),
    pokedex_editor:Object.freeze(["pokedex","species","audio"]),
    move_editor:Object.freeze(["moves","species"]),
    sound_editor:Object.freeze(["audio","species"]),
    animation_editor:Object.freeze(["battleAnimations","species","audio"]),
    encounter_editor:Object.freeze(["encounters","maps","species"]),
    item_editor:Object.freeze(["items","overworldSprites"]),
    emulator_editor:Object.freeze([])
  });
  const REQUIRED_GBA_AUDIT_RESOURCES=Object.freeze([
    "maps","species","trainers","pokedex","audio","battleAnimations","moves","townMap"
  ]);
  const PRET=Object.freeze({
    gba:Object.freeze({repository:"pret/pokeruby + pret/pokeemerald + pret/pokefirered",commit:null,auditCommits:Object.freeze({pokeruby:"63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1",pokeemerald:"83df84e40623b79281f2397faa611cbf044170bd",pokefirered:"df4449a27cd78dd747ce269e47d3ab4a0149d8f4"})}),
    gen1:Object.freeze({repository:"pret/pokered",commit:null,auditCommits:Object.freeze({pokered:"405b6246372d7e5a2cb029cbb65219b13286b8c9"})}),
    gen2:Object.freeze({repository:"pret/pokecrystal",commit:null,auditCommits:Object.freeze({pokecrystal:"3438c7003a57fa2987fcb223d14b660761b33c64"})})
  });
  const REFERENCES=Object.freeze({
    "ea9bcae617fdf159b045185467ae58b2e4a48b9a":Object.freeze({profile:"gen1-rgb-intl",base:"red",label:"pret/pokered reference Red"}),
    "d7037c83e1ae5b39bde3c30787637ba1d4c48ce2":Object.freeze({profile:"gen1-rgb-intl",base:"blue",label:"pret/pokered reference Blue"}),
    "f4cd194bdee0d04ca4eac29e09b8e4e9d818c133":Object.freeze({profile:"gen2-crystal-intl",base:"crystal",label:"pret/pokecrystal reference Crystal"}),
    "f3ae088181bf583e55daf962a92bb46f4f1d07b7":Object.freeze({profile:"gen3-emerald-en",base:"emerald",label:"pret/pokeemerald reference Emerald EN Rev 0"}),
    "dd5945db9b930750cb39d00c84da8571feebf417":Object.freeze({profile:"gen3-fire_red-en",base:"fire_red",label:"pret/pokefirered reference FireRed EN Rev 1"})
  });
  const referenceFor=info=>{
    const reference=REFERENCES[String(info.fingerprint||"").toLowerCase()];
    return reference&&reference.profile===info.editorProfile&&reference.base===info.base?reference:null;
  };
  const sourceManifestFor=info=>global.SourceManifestRegistry?.get(info.fingerprint);
  const hasCompleteResourceSet=(manifest,resourceIds)=>Boolean(manifest&&resourceIds.every(id=>{
    const resource=manifest.resources?.[id];
    return Array.isArray(resource?.symbols)&&resource.symbols.length>0&&
      resource.symbols.every(name=>Boolean(manifest.symbols?.[name]));
  }));
  const record=(state,reason,{writable=false,evidence=[]}={})=>Object.freeze({
    state,label:STATES[state].label,ordinary:STATES[state].ordinary,writable:Boolean(writable),
    reason,evidence:Object.freeze(Array.from(evidence))
  });
  const unavailable=reason=>record("unavailable",reason);
  const research=reason=>record("research",reason);
  const partial=(reason,options)=>record("partial",reason,options);
  const verified=(reason,options)=>record("verified",reason,options);

  const base=reason=>Object.fromEntries(WORKSPACES.map(id=>[id,unavailable(reason)]));
  const classic=(info)=>{
    const result=base("No verified table manifest is registered for this workspace.");
    result.hex_editor=verified("Cartridge-bounded byte editing and native checksums.",{writable:true,evidence:["header","bounds","checksum"]});
    const reference=referenceFor(info);
    if(!reference){
      result.code_workspace=research("This ROM is recognized, but its complete fingerprint does not match a pinned stock reference.");
      result.map_editor=research("Stock map offsets are disabled for a modified or unpinned ROM.");
      result.sprite_editor=research("Semantic sprite tables are disabled for a modified or unpinned ROM.");
      result.battle_editor=research("Trainer and battle tables are disabled for a modified or unpinned ROM.");
      result.pokedex_editor=unavailable("The classic Pokédex graph is not implemented for this profile.");
      result.move_editor=unavailable("Exact move records are disabled for a modified or unpinned ROM.");
      result.sound_editor=research("Native audio tables are not verified.");
      result.animation_editor=research("Native animation tables are not verified.");
      result.encounter_editor=research("Wild encounter tables are disabled for a modified or unpinned ROM.");
      result.item_editor=research("Item tables are disabled for a modified or unpinned ROM.");
      result.emulator_editor=partial("The GB/GBC runtime can execute the selected cartridge base without trusting semantic table addresses.",{writable:false,evidence:["mGBA runtime","user-selected engine profile"]});
      return result;
    }
    result.code_workspace=verified("LR35902 view and family text/event codecs have round-trip fixtures.",{writable:true,evidence:["codec round-trip","relocatable patch"]});
    result.map_editor=verified("Map, connection, block, collision and event layouts have typed fixtures and real-ROM audit coverage.",{writable:true,evidence:["pret structures","real-ROM audit","exact undo"]});
    result.sprite_editor=verified("Native 2bpp sources are writable only when their byte ownership is proven.",{writable:true,evidence:["2bpp round-trip","GraphicSource ownership"]});
    result.battle_editor=partial("All exact Red/Blue trainer classes and both party formats are modeled and existing members are writable; party resizing, battle animation streams and battle sprites are not complete.",{writable:true,evidence:["47 trainer classes","415 bounded trainer records","shared-level and variable-level party layouts","canonical Species graph links"]});
    result.pokedex_editor=partial("Red/Blue entries, exact 28-byte Base Stats, all 151 compressed front and native-scale back sprites, cry records, evolutions, named level-up learnsets and all 55 TM/HM compatibility flags resolve through the canonical 190-slot species graph. Measurements, verified base fields, cries, compatibility and evolution/learnset records within their current bank budget are writable; shared records detach only when verified free space exists. Pictures are exact read-only previews until deterministic recompression and repointing exist. Stock Red/Blue have no general progression-bank growth capacity, so larger records require a future linker/rebuild workflow.",{writable:true,evidence:["PokedexEntryPointers","BaseStats + MewBaseStats selective writer","Gen I front/back picture codec","native ScaleSpriteByTwo back rendering","CryData","EvosMovesPointerTable bounded encoder","ownership-aware gbc16 relocation","TechnicalMachines","3,037 compatibility links","protected pointer/TM/padding bytes","exact Red/Blue reversible progression audit","compare-before-write"]});
    result.move_editor=partial("All 165 Red/Blue move records, named effect IDs/handler pointers, TM/HM assignments, animation pointers, sound parameters and canonical level-up references are exact. Power, accuracy, PP and canonical type are writable; command-stream decoding and broader battle/script compatibility references remain incomplete.",{writable:true,evidence:["Moves","MoveNames","MoveEffectPointerTable","TechnicalMachines","AttackAnimationPointers","MoveSoundTable","EvosMovesPointerTable","728 level-up references","compare-before-write"]});
    result.sound_editor=partial("Gen I CryData records are verified, species-linked and writable. MapSongBanks maps all 248 native map IDs to their exact song and audio bank; channel-stream playback and writing remain incomplete.",{writable:true,evidence:["CryData","MapSongBanks","248 source-named map references","three-byte cry writer"]});
    result.animation_editor=partial("All 165 move animation roots decode native subanimation, special-effect, delay, SFX and terminator records. The exact Red/Blue intro picture sequence is available; tile/OAM composition and writing remain incomplete.",{evidence:["AttackAnimationPointers","Gen I subanimation records","special-effect records","exact intro picture sources"]});
    result.encounter_editor=partial("Exact Red and Blue expose 107 grass, water, fishing and static-battle documents with 706 slots. Old/Good/Super Rod storage, all 33 Super Rod map associations, 14 static battles, native rates and shared ownership are exact and reversible. Runtime Repel logic, Old/Good Rod map eligibility, remaining machine-code battle contexts and encounter simulation remain incomplete.",{writable:true,evidence:["WildDataPointers","WildMonEncounterSlotChances","ItemUseOldRod","GoodRodMons","SuperRodData","12 typed static object events","2 Snorlax script payloads","107 documents","706 slots","exact Red/Blue ROM audit","compare-before-write"]});
    result.item_editor=partial("All 83 Red/Blue item names and BCD prices use exact native tables. Prices are writable; Gen I correctly exposes one shared field Poké Ball sprite rather than fabricated per-item icons.",{writable:true,evidence:["ItemNames","ItemPrices","Sprites shared field object","compare-before-write"]});
    result.emulator_editor=partial("The GB runtime can execute the loaded cartridge in mGBA; semantic hot refresh and gameplay-state mapping remain incomplete.",{writable:false,evidence:["mGBA runtime","loaded project ROM"]});
    if(info.editorProfile==="gen2-crystal-intl"){
      result.code_workspace=partial("Crystal text/event codecs are bounded, but complete command and relocation coverage is not yet proven.",{writable:false,evidence:["pinned pokecrystal symbols","partial codec fixtures"]});
      result.map_editor=partial("The exact map-group root is pinned, but a full stock-ROM edit/export/reload audit is still required.",{writable:false,evidence:["MapGroupPointers symbol","typed Gen II map records"]});
      result.sprite_editor=partial("Overworld sprites can be decoded, but Pokémon/trainer compressed graphics ownership is incomplete.",{writable:false,evidence:["pinned graphics symbols","partial LZ codec"]});
      result.battle_editor=partial("All 67 Crystal trainer classes, 541 bounded records and four native party formats resolve to 1,254 named Pokémon; existing members, held items and explicit moves are writable. Battle scene and animation engines, party resizing, AI and rematches remain incomplete.",{writable:true,evidence:["TrainerGroups","TrainerClassNames","TrainerPicPointers","four TRAINERTYPE layouts","1,385 explicit move links","exact ROM audit","compare-before-write"]});
      result.pokedex_editor=partial("Crystal names, exact 32-byte BaseData, four-bank Pokédex entries/descriptions, six-byte PokemonCries, native-palette LZ3 front pictures, all moves, five evolution methods, level-up/egg moves and all 60 TM/HM/tutor flags resolve through one 251-Species graph. Base fields, measurements, cry parameters, progression and compatibility are writable with bank-safe relocation, shared-list detachment and unused-bit preservation; back pictures, animations, extra Unown forms and broader species tables remain incomplete.",{writable:true,evidence:["PokemonNames","BaseData selective writer","PokedexDataPointerTable + entry bank table","PokemonCries","PokemonPicPointers + FixPicBank.PicsBanks","PokemonPalettes","Moves + MoveNames + TMHMMoves","EvosAttacksPointers + EggMovePointers","bank-tail relocation","shared NoEggMoves detachment","122 evolutions","2,215 level-up entries","480 egg-move entries","6,592 compatibility links","2,821-node / 12,230-edge Species graph","compare-before-write"]});
      result.move_editor=partial("All 251 Crystal seven-byte Move records, 60 TM/HM/tutor assignments and reverse Species progression/compatibility references resolve through the shared graph. Animation, effect, power, type, accuracy, PP, effect chance and Species compatibility are writable; effect handlers, animation command streams, descriptions and wider battle/script references remain incomplete.",{writable:true,evidence:["Moves","MoveNames","TMHMMoves","Gen2MoveData","EvosAttacksPointers","EggMovePointers","exact 60-bit BaseData compatibility","compare-before-write"]});
      result.sound_editor=partial("All 251 Crystal PokemonCries records are writable. The 103 source-named Music entries and every map-group music byte resolve through the exact Music dba table; APU channel execution, native playback and instruments remain incomplete.",{writable:true,evidence:["PokemonCries","Music","MapGroupPointers","103 source-named music entries","six-byte cry writer"]});
      result.animation_editor=partial("All Crystal move animation roots decode native BattleAnimCommands with exact widths and execute unconditional jump, loop, call and return flow with bounded cycle guards; object, tilemap and palette composition and writing remain incomplete.",{evidence:["BattleAnimations","BattleAnimCommands","exact $d0-$ff decoder","bounded native control flow"]});
      result.encounter_editor=partial("Crystal Rev 0 exposes 224 exact grass, water, fishing, Headbutt, Rock Smash, Contest, roamer and direct static-battle documents with 2,486 displayed slots. Seventeen direct loadwildmon commands have verified script offsets, map owners and reversible species/level operands. Source audit confirms there is no loadvarmon command: dynamic randomwildmon contexts consume table/runtime state. Raikou/Entei initialization and the 16-map route network are exact; current HP, DVs and location correctly remain save/WRAM state. Machine-code/state-derived battles and runtime modifier simulation remain incomplete.",{writable:true,evidence:["JohtoGrassWildMons","JohtoWaterWildMons","KantoGrassWildMons","KantoWaterWildMons","FishGroups","TimeFishGroups","TreeMons","TreeMonMaps","RockMonMaps","ContestMons","InitRoamMons","RoamMaps","17 verified loadwildmon commands","randomwildmon command audit","official slot probabilities","exact ROM audit","compare-before-write"]});
      result.item_editor=unavailable("Crystal item tables require a separate Gen II driver; the Gen I layout is never reused.");
    }
    return result;
  };
  const gba=(info)=>{
    const result=base("This exact game/language/revision has no verified semantic manifest.");
    result.hex_editor=verified("Cartridge-bounded byte editing and native checksum repair.",{writable:true,evidence:["header","bounds","checksum"]});
    const reference=referenceFor(info);
    const sourceManifest=sourceManifestFor(info);
    const audited=Boolean(reference&&hasCompleteResourceSet(sourceManifest,REQUIRED_GBA_AUDIT_RESOURCES));
    if(!audited){
      result.code_workspace=research("Header recognition is broader than the exact source/table manifest.");
      result.map_editor=research("Map signatures may be discoverable, but this exact ROM profile has not passed the production audit.");
      result.sprite_editor=research("Raw codecs exist, but semantic graphics tables are not verified for this exact profile.");
      result.battle_editor=research("Battle pointers and trainers are not verified for this exact profile.");
      result.pokedex_editor=unavailable("Pokédex tables are not verified for this exact profile.");
      result.move_editor=unavailable("Move tables are not verified for this exact profile.");
      result.sound_editor=research("Pointer scans are not an authoritative sound manifest.");
      result.animation_editor=research("Native animation tables are not verified for this exact ROM profile.");
      result.item_editor=research("Item tables are not verified for this exact ROM profile.");
      result.emulator_editor=partial("The GBA runtime can execute a snapshot, but this is not semantic profile validation.",{writable:false,evidence:["IodineGBA runtime"]});
      return result;
    }
    result.code_workspace=verified("ARM/THUMB and GBA event/text codecs have bounded round-trip coverage.",{writable:true,evidence:["opcode fixtures","text fixtures","relocation"]});
    result.map_editor=verified("The map/event/script/sprite/export vertical slice passed a real-ROM audit.",{writable:true,evidence:["real-ROM audit","pret layouts","exact undo"]});
    result.sprite_editor=verified("Native 4bpp sources are writable only with verified byte ownership.",{writable:true,evidence:["4bpp round-trip","GraphicSource ownership"]});
    result.battle_editor=info.base==="emerald"
      ?partial("Real monster and trainer resources are available for the bounded Emerald battle document. Full engine, AI and animation coverage remains incomplete.",{writable:true,evidence:["monster tables","Emerald trainer table"]})
      :partial("FireRed monster and trainer picture roots are pinned, but trainer-party editing and the complete battle scene still require an isolated FireRed driver audit.",{writable:false,evidence:["gMonFrontPicTable","gMonBackPicTable","gTrainerFrontPicTable","gTrainerFrontPicPaletteTable"]});
    result.pokedex_editor=partial("Native entries, names, text, front sprites, the five-slot evolution table, all TM/HM compatibility flags and the exact CryData routing/ToneData records are available. Measurements, fixed evolution slots and machine bits are writable with exact padding/unused-bit preservation; base stats, learnsets, egg moves, back sprites, cry writing and broader Species references remain incomplete.",{writable:true,evidence:["gPokedexEntries","gSpeciesNames","gMonFrontPicTable","gEvolutionTable","gTMHMLearnsets","gSpeciesIdToCryId","gCryTable ToneData","compare-before-write"]});
    result.move_editor=info.base==="emerald"
      ?partial("All 354 Generation III BattleMove records and names use the exact profile tables. Fixed fields are writable with flag preservation; level-up learnsets, 58 TM/HM compatibility flags, explicit trainer-party references and verified battle-animation programs are navigable. The embedded timeline decodes native commands but labels its visual runtime partial. Effects and audio command graphs remain incomplete.",{writable:true,evidence:["gBattleMoves fixed records","gMoveNames","level-up learnsets","58 TM/HM assignments","native TM/HM item icons","Emerald explicit trainer moves","gBattleAnims_Moves","compare-before-write"]})
      :partial("All 354 Generation III BattleMove records and names use the exact profile tables. Fixed fields are writable with flag preservation; 57 TM/HM compatibility flags, native machine item icons and verified battle-animation programs are navigable. FireRed learnset and explicit trainer-party reverse indexes remain unavailable until their exact roots are added to the profile.",{writable:true,evidence:["gBattleMoves fixed records","gMoveNames","57 TM/HM assignments","native TM/HM item icons","gBattleAnims_Moves","compare-before-write"]});
    result.sound_editor=info.base==="emerald"
      ?partial("The exact Emerald gSongTable exposes all 610 M4A/Sappy headers. Source constants name 479 music/SFX IDs and all 518 map headers resolve their native music field to the shared song table. Pokémon WaveData samples audition natively; complete M4A song mixing and stream writing remain incomplete.",{writable:false,evidence:["gSongTable","gMapGroups","518 map headers","479 source-named music/SFX IDs","gSpeciesIdToCryId","gCryTable ToneData","bounded M4A track decoder"]})
      :partial("FireRed song and cry roots are pinned and bounded M4A track commands can be inspected. A FireRed-specific song catalog, map-reference index, mixer and stream writer remain incomplete.",{writable:false,evidence:["gSongTable","sHoennSpeciesIdToCryId","gCryTable ToneData","bounded M4A track decoder"]});
    result.animation_editor=info.base==="emerald"
      ?partial("Emerald move scripts and Pokémon front-picture sequences use verified roots. Unconditional animation call, return and goto flow executes with bounded cycle guards. Species picture, duration and movement assignments are writable; visual-task execution and complex scene writing remain incomplete.",{writable:true,evidence:["gBattleAnims_Moves","gMonFrontAnimsPtrTable","sMonFrontAnimIdsTable","bounded native control flow","native 60 Hz AnimCmd timing"]})
      :partial("FireRed move, status, general and special battle-animation roots are pinned. Bounded command inspection is available, while FireRed visual-task execution, complete scene composition and writers remain read-only.",{writable:false,evidence:["gBattleAnims_Moves","gBattleAnims_StatusConditions","gBattleAnims_General","gBattleAnims_Special"]});
    if(info.base==="emerald")result.encounter_editor=partial("All 124 Emerald gWildMonHeaders entries expose exact grass, surfing, Rock Smash and fishing records with native slot weights. Existing species, level ranges and encounter rates are writable; swarm and runtime modifier simulation remain incomplete.",{writable:true,evidence:["gWildMonHeaders","WildPokemonInfo","WildPokemon","pret slot weights","compare-before-write"]});
    if(info.base==="fire_red"&&Number(info.version)===1)result.encounter_editor=unavailable("The FireRed gWildMonHeaders root is pinned, but its encounter documents and writer have not yet passed an isolated real-ROM round-trip audit.");
    if(info.base==="emerald")result.item_editor=partial("All 376 usable Emerald item records and native 24×24 bag icons resolve through gItems and gItemIconTable. Price, pocket and importance are writable; field-object graphics remain linked to their overworld resources.",{writable:true,evidence:["gItems","gItemIconTable","LZ77 item icons","compare-before-write"]});
    if(info.base==="fire_red"&&Number(info.version)===1)result.item_editor=partial("All 374 usable FireRed Rev 1 item records and native 24×24 bag icons resolve through the audited gItems and gItemIconTable build addresses. Price, pocket and importance are writable.",{writable:true,evidence:["gItems","gItemIconTable","LZ77 item icons","compare-before-write"]});
    result.emulator_editor=partial("A snapshot can run in IodineGBA; semantic hot refresh and gameplay gates are incomplete.",{writable:false,evidence:["IodineGBA runtime"]});
    return result;
  };

  const resolve=(info)=>{
    const family=info.family==="gba"?"gba":info.editorProfile==="gen2-crystal-intl"?"gen2":"gen1";
    const entries=family==="gba"?gba(info):classic(info);
    const sourceManifest=sourceManifestFor(info);
    const bindResources=(id,capability)=>{
      const resources=(WORKSPACE_RESOURCES[id]||[])
        .map(resourceId=>{
          const definition=sourceManifest?.resources?.[resourceId];
          return definition?Object.freeze({id:resourceId,coverage:definition.coverage,symbols:definition.symbols}):null;
        })
        .filter(Boolean);
      return Object.freeze({...capability,resources:Object.freeze(resources)});
    };
    const workspaces=Object.freeze(Object.fromEntries(WORKSPACES.map(id=>[
      id,bindResources(id,entries[id]||unavailable("No capability declaration."))
    ])));
    const enabledWorkspaces=Object.freeze(WORKSPACES.filter(id=>workspaces[id].ordinary));
    const provenance=sourceManifest
      ?Object.freeze({
        repository:sourceManifest.source.repository,
        commit:sourceManifest.source.commit,
        build:sourceManifest.source.build,
        manifestVersion:sourceManifest.schemaVersion,
        reference:referenceFor(info)?.label||null,
        symbols:sourceManifest.symbols,
        resources:sourceManifest.resources
      })
      :Object.freeze({...PRET[family],manifestVersion:1,reference:referenceFor(info)?.label||null,symbols:Object.freeze({}),resources:Object.freeze({})});
    return Object.freeze({
      id:`${info.editorProfile||"unsupported"}:${info.base}:${info.lang}:r${info.version}`,
      family,game:info.base,language:info.lang,revision:info.version,
      fingerprint:info.fingerprint||null,
      provenance,
      workspaces,enabledWorkspaces,
      get(id){return workspaces[id]||unavailable("Unknown workspace.");}
    });
  };

  global.CapabilityManifest=Object.freeze({STATES,WORKSPACES,WORKSPACE_RESOURCES,REFERENCES,resolve});
  ((global.PokemonViewer||={}).core||={}).CapabilityManifest=global.CapabilityManifest;
})(globalThis);
