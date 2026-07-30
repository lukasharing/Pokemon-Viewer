(function(global){
  "use strict";

  global.GbaRomRuntime=Object.freeze({
    family:"gba",
    structureScripts:[
      "js/structures/gba/memory.js",
      "js/structures/gba/item.js",
      "js/structures/gba/map.js?v=5",
      "js/structures/gba/metatile-attributes.js?v=1",
      "js/structures/gba/connection-writer.js",
      "js/structures/gba/event-writer.js",
      "js/structures/gba/sprite.js?v=3",
      "js/structures/gba/registry.js?v=3"
    ],
    dictionaryPaths:["./decrypt/text_table_en.json","./decrypt/text_table_jp.json","./decrypt/dcccode.json","./decrypt/dccmovement.json"],

    registry(){ return PokemonViewer.structures.registries.gba; },

    configure(reader,info){
      reader.spriteCompositorId="gba";
      const configuredGame=reader.game_bases[info.base];
      if(!configuredGame?.memory?.[info.lang])throw new Error(`${info.name} (${info.lang.toUpperCase()}) has no GBA metadata configuration.`);
      for(const [property,definition] of Object.entries(reader.game_bases.global || {})){
        const matches=reader.findByHex(definition.chain);
        if(matches.length>definition.index)reader.memoryOffsets[property]=reader.getOffset(matches[definition.index]+definition.chain.length*.5);
      }
      const textDictionaries={en:"text_table_en",es:"text_table_en",jp:"text_table_jp"};
      reader.textDictionary=textDictionaries[info.lang];
      if(!reader.textDictionary)throw new Error(`${info.lang.toUpperCase()} has no configured Generation III text table.`);
    },

    async ensureWorkspace(reader,workspaceId,generation=reader.projectGeneration){
      if(workspaceId==="code_workspace"){
        if(reader.code_editor)return;
        await AssetLoader.loadStyles(["node_modules/codemirror/lib/codemirror.css"]);
        await AssetLoader.loadScripts(["node_modules/codemirror/lib/codemirror.js","js/code/codemirror-mode.js?v=1","js/code/logic-graph.js?v=3","js/code/codecs/gba-arm.js","js/code/scripts/gba-event-script.js?v=8","js/code/editor.js?v=25"]);
        if(!reader.isProjectGeneration(generation)||reader.code_editor)return;
        reader.code_editor=new CodeEditor(reader,GbaCodeCodec,GbaScriptCodec,{defaultScriptKind:"event",scriptLabel:"Event script"});
        return;
      }
      if(workspaceId==="sprite_editor"){
        if(reader.sprite_editor)return;
        await AssetLoader.loadScripts(["js/core/graphic-source.js?v=4","js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/core/gba-items.js?v=1","js/fonts/library.js?v=2","js/fonts/gba/decoder.js?v=5","js/sprite/codecs/gba-4bpp.js?v=4","js/sprite/compositor.js?v=3","js/sprite/gba/compositor.js?v=1","js/sprite/resource-catalog.js?v=1","js/sprite/gba/pokemon-catalog.js?v=2","js/sprite/gba/item-catalog.js?v=1","js/sprite/gba/scene-catalogs.js?v=1","js/sprite/editor.js?v=37"]);
        if(!reader.isProjectGeneration(generation)||reader.sprite_editor)return;
        const itemCatalog=new PokemonViewer.sprites.GbaItemSpriteCatalog(reader);
        const scenes=new PokemonViewer.sprites.GbaSceneCatalogs(reader).create();
        reader.sprite_editor=new SpriteEditor(reader,GbaSpriteCodec,reader.structureRegistry.createOverworldSpriteCatalog(reader),new PokemonViewer.sprites.GbaPokemonSpriteCatalog(reader),{objects:reader.structureRegistry.createOverworldSpriteCatalog(reader),items:itemCatalog,berries:new PokemonViewer.sprites.GbaItemSpriteCatalog(reader,{berries:true}),...scenes});
        return;
      }
      if(workspaceId==="battle_editor"){
        if(reader.battle_editor)return;
        await AssetLoader.loadScripts(["js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/core/gba-trainers.js?v=4","js/core/gba-tilemap.js?v=2","js/fonts/library.js?v=2","js/fonts/gba/decoder.js?v=5","js/sprite/codecs/gba-4bpp.js?v=4","js/battle/library.js?v=3","js/battle/source-state.js?v=1","js/battle/party-view.js?v=2","js/battle/hud-assets.js?v=4","js/battle/gba/hud-assets.js?v=5","js/battle/preview.js?v=17","js/battle/timeline.js?v=1","js/battle/gba/sprites.js?v=11","js/battle/gba/trainer-sprites.js?v=1","js/battle/gba/environment.js?v=1","js/battle/gba/backgrounds.js?v=3","js/battle/editor.js?v=24","js/battle/gba/driver.js?v=30"]);
        if(!reader.isProjectGeneration(generation)||reader.battle_editor)return;
        reader.battle_editor=new BattleEditor(reader,"gba");
        return;
      }
      if(workspaceId==="pokedex_editor"){
        if(reader.pokedex_editor)return;
        await AssetLoader.loadScripts(["js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/sprite/codecs/gba-4bpp.js?v=4","js/battle/library.js?v=3","js/battle/gba/sprites.js?v=10","js/pokedex/library.js?v=9","js/pokedex/editor.js?v=22","js/pokedex/gba/driver.js?v=18"]);
        if(!reader.isProjectGeneration(generation)||reader.pokedex_editor)return;
        if(typeof global.PokedexEditor!=="function")throw new Error("Pokédex editor failed to load for this GBA ROM.");
        reader.pokedex_editor=new global.PokedexEditor(reader,"gba");return;
      }
      if(workspaceId==="move_editor"){
        if(reader.move_editor)return;
        await AssetLoader.loadScripts([
          "js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/core/gba-trainers.js?v=4","js/core/gba-moves.js?v=2","js/core/gba-items.js?v=1",
          "js/sprite/codecs/gba-4bpp.js?v=4","js/battle/library.js?v=3","js/battle/gba/trainer-sprites.js?v=1",
          "js/animation/library.js?v=4","js/animation/timeline.js?v=2","js/animation/renderer.js?v=3","js/animation/gba-driver.js?v=2",
          "js/moves/library.js?v=1","js/moves/animation-preview.js?v=1","js/moves/editor.js?v=7","js/moves/gba/driver.js?v=4"
        ]);
        if(!reader.isProjectGeneration(generation)||reader.move_editor)return;
        if(typeof global.MoveEditor!=="function")throw new Error("Move editor failed to load for this GBA ROM.");
        reader.move_editor=new global.MoveEditor(reader,"gba");return;
      }
      if(workspaceId==="sound_editor"){
        if(reader.sound_editor)return;
        await AssetLoader.loadScripts(["js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/sound/library.js?v=5","js/sound/audition.js?v=1","js/sound/waveform.js?v=1","js/sound/generic-driver.js?v=12","js/sound/gba/driver.js?v=4","js/sound/editor.js?v=21"]);
        if(!reader.isProjectGeneration(generation)||reader.sound_editor)return;
        reader.sound_editor=new global.SoundEditor(reader,"gba");return;
      }
      if(workspaceId==="animation_editor"){
        if(reader.animation_editor)return;
        await AssetLoader.loadScripts([
          "js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/sprite/codecs/gba-4bpp.js?v=4",
          "js/animation/library.js?v=4","js/animation/timeline.js?v=2","js/animation/renderer.js?v=3","js/code/logic-graph.js?v=3",
          "js/animation/gba/species.js?v=1","js/animation/editor.js?v=6","js/animation/gba-driver.js?v=2"
        ]);
        if(!reader.isProjectGeneration(generation)||reader.animation_editor)return;
        reader.animation_editor=new global.AnimationEditor(reader,"gba");return;
      }
      if(workspaceId==="encounter_editor"){
        if(reader.encounter_editor)return;
        await AssetLoader.loadScripts(["js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/core/gba-encounters.js?v=2","js/encounters/library.js?v=1","js/encounters/view-model.js?v=1","js/encounters/slot-view.js?v=2","js/encounters/editor.js?v=15","js/encounters/gba/driver.js?v=2"]);
        if(!reader.isProjectGeneration(generation)||reader.encounter_editor)return;
        reader.encounter_editor=new global.EncounterEditor(reader,"gba");return;
      }
      if(workspaceId==="item_editor"){
        if(reader.item_editor)return;
        await AssetLoader.loadScripts(["js/core/gba-rom-assets.js?v=25","js/core/gba-species.js?v=11","js/core/gba-items.js?v=1","js/sprite/codecs/gba-4bpp.js?v=4","js/items/library.js?v=1","js/items/editor.js?v=1","js/items/gba/driver.js?v=1"]);
        if(!reader.isProjectGeneration(generation)||reader.item_editor)return;
        reader.item_editor=new global.ItemEditor(reader,"gba");return;
      }
      if(workspaceId==="emulator"){
        if(reader.emulator_editor)return;
        await AssetLoader.loadScripts(["js/emulator/performance.js?v=2","js/emulator/editor.js?v=12"]);
        if(!reader.isProjectGeneration(generation)||reader.emulator_editor)return;
        reader.emulator_editor=new global.ProjectEmulator(reader);return;
      }
      if(workspaceId!=="map_editor" || reader.map_editor)return;
      await AssetLoader.loadScripts([
        "js/decompressor.js","js/camera.js?v=4","js/core/map-block-utils.js?v=1","js/core/gba-rom-assets.js?v=25","js/core/species-catalog.js?v=3","js/core/gba-species.js?v=11","js/core/gba-encounters.js?v=2","js/encounters/library.js?v=1","js/encounters/gba/driver.js?v=2","js/encounters/map-panel.js?v=8","js/core/gba-tilemap.js?v=2","js/sprite/palette.js","js/sprite/tileset.js","js/sprite/codecs/gba-4bpp.js?v=4",
        "js/core/event-bookmark-utils.js?v=1","js/map/entities.js?v=2","js/map/gba/movement-profile.js?v=1","js/map/movement.js?v=4","js/map/map.js?v=11","js/map/bank.js","js/map/library.js?v=11","js/map/window-manager.js?v=5","js/map/minimap-utils.js?v=1","js/map/workspace.js?v=34","js/map/editor.js?v=13","js/map/controls.js?v=7",
        "js/map/selection.js?v=2","js/map/context-menu.js?v=3","js/map/event-inspector.js?v=18","js/battle/gba/environment.js?v=1","js/battle/gba/backgrounds.js?v=3","js/map/gba/region-map.js?v=5","js/map/editor-map.js?v=54"
      ]);
      if(!reader.isProjectGeneration(generation)||reader.map_editor)return;
      PokemonViewer.maps.registerDriver("gba",{create:current=>new EMap(current),tools:PokemonViewer.maps.capabilities.full});
      reader.map_editor=PokemonViewer.maps.createEditor(reader,"gba");
      reader.map_editor.init();
      reader.map_editor.change_map(0,0);
      document.getElementById("map_editor")?.editorHeader?.render();
    }
  });
})(globalThis);
