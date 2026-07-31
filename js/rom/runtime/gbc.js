(function(global){
  "use strict";

  global.GbcRomRuntime=Object.freeze({
    family:"gbc",
    structureScripts:[
      "js/structures/gbc/memory.js",
      "js/structures/gbc/text.js?v=4",
      "js/structures/gbc/item.js",
      "js/structures/gbc/map.js?v=3",
      "js/structures/gbc/sprite.js?v=1",
      "js/structures/gbc/connection-writer.js",
      "js/structures/gbc/collision-writer.js?v=1",
      "js/structures/gbc/event-writer.js",
      "js/structures/gbc/registry.js?v=1"
    ],
    dictionaryPaths:["./decrypt/text_table_gen1_en.json"],

    registry(){ return PokemonViewer.structures.registries.gbc; },

    configure(reader,info){
      if(info.editorProfile!=="gen1-rgb-intl")throw new Error(`${info.name} does not have a compatible Gen I editor profile.`);
      reader.spriteCompositorId="gbc";
      reader.gbMetadata=reader.gb_game_bases[info.base]?.memory?.[reader.lang] || {};
      reader.textDictionary="text_table_gen1_en";
    },

    async ensureWorkspace(reader,workspaceId,generation=reader.projectGeneration){
      if(workspaceId==="emulator"){
        if(reader.emulator_editor)return;
        await AssetLoader.loadScripts(["js/emulator/performance.js?v=2","js/emulator/editor.js?v=12"]);
        if(!reader.isProjectGeneration(generation)||reader.emulator_editor)return;
        reader.emulator_editor=new global.ProjectEmulator(reader);return;
      }
      if(workspaceId==="code_workspace"){
        if(reader.code_editor)return;
        await AssetLoader.loadStyles(["node_modules/codemirror/lib/codemirror.css"]);
        await AssetLoader.loadScripts(["node_modules/codemirror/lib/codemirror.js","js/code/codemirror-mode.js?v=1","js/code/logic-graph.js?v=3","js/code/codecs/gbc-lr35902.js?v=2","js/code/scripts/gbc-text-script.js?v=3","js/code/editor.js?v=25"]);
        if(!reader.isProjectGeneration(generation)||reader.code_editor)return;
        reader.code_editor=new CodeEditor(reader,GbcCodeCodec,GbcTextScriptCodec,{defaultScriptKind:"text",scriptLabel:"Text script (RGBDS)"});
        return;
      }
      if(workspaceId==="map_editor"){
        if(reader.map_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=2","js/core/gen1-species.js?v=7","js/core/gen1-moves.js?v=7","js/core/gen1-trainers.js?v=5","js/core/gen1-encounters.js?v=3","js/encounters/library.js?v=1","js/encounters/gbc/driver.js?v=4","js/encounters/map-panel.js?v=8","js/sprite/codecs/gbc-2bpp.js?v=3","js/structures/gbc/map-discovery.js?v=1","js/core/event-bookmark-utils.js?v=1","js/map/gbc/movement-profile.js?v=1","js/map/movement.js?v=4","js/map/library.js?v=11","js/map/window-manager.js?v=5","js/map/minimap-utils.js?v=1","js/map/workspace.js?v=34","js/map/editor.js?v=13","js/map/controls.js?v=7","js/map/selection.js?v=2","js/map/context-menu.js?v=4","js/map/event-inspector.js?v=18","js/map/gbc/region-map.js?v=2","js/map/gbc/editor.js?v=63"]);
        if(!reader.isProjectGeneration(generation)||reader.map_editor)return;
        PokemonViewer.maps.registerDriver("gb",{create:current=>new GbcMapDriver(current),tools:PokemonViewer.maps.capabilities.full});
        reader.map_editor=PokemonViewer.maps.createEditor(reader,"gb");
        reader.map_editor.init();
        return;
      }
      if(workspaceId==="battle_editor"){
        if(reader.battle_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=2","js/core/gen1-species.js?v=7","js/core/gen1-moves.js?v=7","js/core/gen1-trainers.js?v=5","js/fonts/library.js?v=2","js/fonts/gbc/decoder.js?v=5","js/sprite/codecs/gbc-2bpp.js?v=3","js/battle/library.js?v=2","js/battle/source-state.js?v=1","js/battle/party-view.js?v=2","js/battle/hud-assets.js?v=4","js/battle/gbc/hud-assets.js?v=5","js/battle/preview.js?v=22","js/battle/timeline.js?v=1","js/battle/editor.js?v=24","js/battle/gbc/driver.js?v=26"]);
        if(!reader.isProjectGeneration(generation)||reader.battle_editor)return;
        reader.battle_editor=new BattleEditor(reader,"gbc");
        return;
      }
      if(workspaceId==="pokedex_editor"){
        if(reader.pokedex_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=2","js/core/gen1-species.js?v=7","js/core/gen1-moves.js?v=7","js/sprite/codecs/gbc-2bpp.js?v=3","js/pokedex/library.js?v=9","js/pokedex/editor.js?v=24","js/pokedex/gbc/driver.js?v=12"]);
        if(!reader.isProjectGeneration(generation)||reader.pokedex_editor)return;
        if(typeof global.PokedexEditor!=="function")throw new Error("Pokédex editor failed to load for this GB ROM.");
        reader.pokedex_editor=new global.PokedexEditor(reader,"gbc");return;
      }
      if(workspaceId==="move_editor"){
        if(reader.move_editor)return;
        await AssetLoader.loadScripts([
          "js/core/species-catalog.js?v=2","js/core/gen1-species.js?v=7","js/core/gen1-moves.js?v=7",
          "js/animation/source-catalog.js?v=1","js/animation/library.js?v=14","js/animation/gbc/timing.js?v=1","js/animation/scene.js?v=3","js/animation/timeline.js?v=4","js/animation/renderer.js?v=11","js/animation/gbc/scenes.js?v=3","js/animation/gbc/visuals.js?v=3","js/animation/gbc/driver.js?v=6",
          "js/moves/library.js?v=1","js/moves/animation-preview.js?v=1","js/moves/editor.js?v=7","js/moves/gbc/driver.js?v=3"
        ]);
        if(!reader.isProjectGeneration(generation)||reader.move_editor)return;
        if(typeof global.MoveEditor!=="function")throw new Error("Move editor failed to load for this GB ROM.");
        reader.move_editor=new global.MoveEditor(reader,"gbc");return;
      }
      if(workspaceId==="encounter_editor"){
        if(reader.encounter_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=2","js/core/gen1-species.js?v=7","js/core/gen1-moves.js?v=7","js/core/gen1-trainers.js?v=5","js/core/gen1-encounters.js?v=3","js/encounters/library.js?v=1","js/encounters/view-model.js?v=1","js/encounters/slot-view.js?v=2","js/sprite/codecs/gbc-2bpp.js?v=3","js/encounters/editor.js?v=15","js/encounters/gbc/driver.js?v=5"]);
        if(!reader.isProjectGeneration(generation)||reader.encounter_editor)return;
        reader.encounter_editor=new global.EncounterEditor(reader,"gbc");return;
      }
      if(workspaceId==="sound_editor"){
        if(reader.sound_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=2","js/core/gen1-species.js?v=7","js/sound/library.js?v=6","js/sound/source-catalog.js?v=1","js/sound/map-music-catalog.js?v=1","js/sound/audition.js?v=2","js/sound/waveform.js?v=1","js/sound/generic-driver.js?v=13","js/sound/editor.js?v=23"]);
        if(!reader.isProjectGeneration(generation)||reader.sound_editor)return;
        reader.sound_editor=new global.SoundEditor(reader,"gbc");return;
      }
      if(workspaceId==="animation_editor"){
        if(reader.animation_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=3","js/core/gen1-species.js?v=7","js/core/gen1-moves.js?v=7","js/core/gen1-trainers.js?v=5","js/fonts/library.js?v=2","js/fonts/gbc/decoder.js?v=5","js/sprite/codecs/gbc-2bpp.js?v=3","js/battle/library.js?v=3","js/battle/source-state.js?v=1","js/battle/hud-assets.js?v=4","js/battle/gbc/hud-assets.js?v=5","js/battle/preview.js?v=22","js/battle/gbc/driver.js?v=26","js/animation/source-catalog.js?v=1","js/animation/library.js?v=14","js/animation/gbc/timing.js?v=1","js/animation/scene.js?v=3","js/animation/timeline.js?v=4","js/animation/renderer.js?v=11","js/code/logic-graph.js?v=5","js/animation/editor.js?v=11","js/animation/gbc/scenes.js?v=3","js/animation/gbc/visuals.js?v=3","js/animation/gbc/driver.js?v=6"]);
        if(!reader.isProjectGeneration(generation)||reader.animation_editor)return;
        reader.animation_editor=new global.AnimationEditor(reader,"gbc");return;
      }
      if(workspaceId==="item_editor"){
        if(reader.item_editor)return;
        await AssetLoader.loadScripts(["js/core/gen1-items.js?v=1","js/sprite/codecs/gbc-2bpp.js?v=3","js/items/library.js?v=1","js/items/editor.js?v=1","js/items/gbc/driver.js?v=1"]);
        if(!reader.isProjectGeneration(generation)||reader.item_editor)return;
        reader.item_editor=new global.ItemEditor(reader,"gbc");return;
      }
      if(workspaceId!=="sprite_editor")return;
      if(reader.sprite_editor)return;
      await AssetLoader.loadScripts(["js/core/graphic-source.js?v=4","js/core/species-catalog.js?v=3","js/core/gen1-species.js?v=7","js/core/gen1-items.js?v=1","js/fonts/library.js?v=2","js/fonts/gbc/decoder.js?v=5","js/sprite/codecs/gbc-2bpp.js?v=3","js/sprite/compositor.js?v=3","js/sprite/resource-catalog.js?v=1","js/sprite/gbc/compositor.js?v=1","js/sprite/gbc/pokemon-catalog.js?v=1","js/sprite/gbc/item-catalog.js?v=1","js/sprite/gbc/scene-catalogs.js?v=1","js/sprite/editor.js?v=36"]);
      if(!reader.isProjectGeneration(generation)||reader.sprite_editor)return;
      const scenes=new PokemonViewer.sprites.Gen1SceneCatalogs(reader).create();
      reader.sprite_editor=new SpriteEditor(reader,GbcSpriteCodec,reader.structureRegistry.createOverworldSpriteCatalog(reader.memory),new PokemonViewer.sprites.Gen1PokemonSpriteCatalog(reader),{objects:new PokemonViewer.sprites.GbcObjectSpriteCatalog(reader),items:new PokemonViewer.sprites.GbcItemSpriteCatalog(reader),berries:null,...scenes});
    }
  });
})(globalThis);
