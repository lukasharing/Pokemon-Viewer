(function(global){
  "use strict";
  global.Gen2RomRuntime=Object.freeze({
    family:"gen2",
    structureScripts:["js/core/gsc-lz.js?v=1","js/structures/gen2/memory.js?v=1","js/structures/gen2/connection-utils.js?v=1","js/structures/gen2/map.js?v=3","js/structures/gen2/connection-writer.js?v=1","js/structures/gen2/event-writer.js?v=1","js/structures/gen2/tileset.js?v=1","js/structures/gen2/sprite.js?v=1","js/structures/gen2/registry.js?v=6"],
    dictionaryPaths:["./decrypt/text_table_gen2_en.json"],
    registry(){return PokemonViewer.structures.registries.gen2;},
    configure(reader,info){
      if(info.editorProfile!=="gen2-crystal-intl")throw new Error(`${info.name} does not have a compatible Gen II editor profile.`);
      reader.spriteCompositorId="gen2";
      reader.textDictionary="text_table_gen2_en";
    },
    async ensureWorkspace(reader,workspaceId,generation=reader.projectGeneration){
      if(workspaceId==="emulator"){
        if(reader.emulator_editor)return;
        await AssetLoader.loadScripts(["js/emulator/performance.js?v=4","js/emulator/editor.js?v=13"]);
        if(!reader.isProjectGeneration(generation)||reader.emulator_editor)return;
        reader.emulator_editor=new global.ProjectEmulator(reader);return;
      }
      if(workspaceId==="code_workspace"){
        if(reader.code_editor)return;
        await AssetLoader.loadStyles(["node_modules/codemirror/lib/codemirror.css"]);
        await AssetLoader.loadDagre();
        await AssetLoader.loadScripts(["node_modules/codemirror/lib/codemirror.js","js/core/ui-graph-layout.js?v=2","js/code/codemirror-mode.js?v=1","js/code/logic-graph.js?v=13","js/code/codecs/gbc-lr35902.js?v=2","js/code/scripts/gen2-text-script.js?v=2","js/code/scripts/gen2-event-script.js?v=4","js/code/editor.js?v=25"]);
        if(!reader.isProjectGeneration(generation)||reader.code_editor)return;
        reader.code_editor=new CodeEditor(reader,GbcCodeCodec,Gen2ScriptCodec,{defaultScriptKind:"event",scriptLabel:"Event / text script"});return;
      }
      if(workspaceId==="sprite_editor"){
        if(reader.sprite_editor)return;
        await AssetLoader.loadScripts(["js/core/graphic-source.js?v=4","js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=7","js/sprite/codecs/gbc-2bpp.js?v=3","js/sprite/compositor.js?v=3","js/sprite/resource-catalog.js?v=1","js/sprite/gen2/compositor.js?v=1","js/sprite/gen2/pokemon-catalog.js?v=1","js/sprite/gen2/scene-catalogs.js?v=1","js/sprite/editor.js?v=36"]);
        if(!reader.isProjectGeneration(generation)||reader.sprite_editor)return;
        const scenes=new PokemonViewer.sprites.Gen2SceneCatalogs(reader).create();
        reader.sprite_editor=new SpriteEditor(reader,GbcSpriteCodec,reader.structureRegistry.createOverworldSpriteCatalog(reader.memory),new PokemonViewer.sprites.Gen2PokemonSpriteCatalog(reader),{...scenes});return;
      }
      if(workspaceId==="battle_editor"){
        if(reader.battle_editor)return;
        await AssetLoader.loadScripts(["js/core/gsc-lz.js?v=1","js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=8","js/core/gen2-progression.js?v=6","js/core/gen2-trainers.js?v=3","js/sprite/codecs/gbc-2bpp.js?v=3","js/core/gb-picture-canvas.js?v=1","js/battle/library.js?v=3","js/battle/source-state.js?v=2","js/battle/party-view.js?v=2","js/battle/preview.js?v=25","js/battle/timeline.js?v=1","js/battle/trainer-repository.js?v=1","js/battle/editor.js?v=25","js/battle/gen2/driver.js?v=7"]);
        if(!reader.isProjectGeneration(generation)||reader.battle_editor)return;
        reader.battle_editor=new BattleEditor(reader,"gen2");return;
      }
      if(workspaceId==="pokedex_editor"){
        if(reader.pokedex_editor)return;
        await AssetLoader.loadScripts(["js/core/gsc-lz.js?v=1","js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=7","js/core/gen2-progression.js?v=6","js/sprite/codecs/gbc-2bpp.js?v=3","js/pokedex/library.js?v=9","js/pokedex/editor.js?v=26","js/pokedex/gen2/driver.js?v=14"]);
        if(!reader.isProjectGeneration(generation)||reader.pokedex_editor)return;
        if(typeof global.PokedexEditor!=="function")throw new Error("Pokédex editor failed to load for this GB Color ROM.");
        reader.pokedex_editor=new global.PokedexEditor(reader,"gen2");return;
      }
      if(workspaceId==="move_editor"){
        if(reader.move_editor)return;
        await AssetLoader.loadScripts([
          "js/core/gsc-lz.js?v=1","js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=8","js/core/gen2-progression.js?v=6","js/core/gen2-trainers.js?v=3","js/sprite/codecs/gbc-2bpp.js?v=3","js/core/gb-picture-canvas.js?v=1","js/sprite/gen2/trainer-catalog.js?v=1",
          "js/battle/library.js?v=3","js/battle/source-state.js?v=1","js/battle/preview.js?v=25","js/battle/gen2/driver.js?v=6",
          "js/animation/source-catalog.js?v=1","js/animation/library.js?v=21","js/animation/gen2/timing.js?v=1","js/animation/scene.js?v=6","js/animation/timeline.js?v=4","js/animation/renderer.js?v=21","js/animation/gen2/visuals.js?v=2","js/animation/gen2/driver.js?v=12",
          "js/moves/library.js?v=1","js/moves/animation-preview.js?v=2","js/moves/editor.js?v=9","js/moves/gen2/driver.js?v=8"
        ]);
        if(!reader.isProjectGeneration(generation)||reader.move_editor)return;
        if(typeof global.MoveEditor!=="function")throw new Error("Move editor failed to load for this Crystal ROM.");
        reader.move_editor=new global.MoveEditor(reader,"gen2");return;
      }
      if(workspaceId==="sound_editor"){
        if(reader.sound_editor)return;
        await AssetLoader.loadScripts(["js/core/gsc-lz.js?v=1","js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=5","js/sound/library.js?v=7","js/sound/source-catalog.js?v=2","js/sound/map-music-catalog.js?v=1","js/sound/audition.js?v=3","js/sound/waveform.js?v=2","js/sound/generic-driver.js?v=15","js/sound/gen2/driver.js?v=1","js/sound/editor.js?v=26"]);
        if(!reader.isProjectGeneration(generation)||reader.sound_editor)return;
        reader.sound_editor=new global.SoundEditor(reader,"gen2");return;
      }
      if(workspaceId==="animation_editor"){
        if(reader.animation_editor)return;
        await AssetLoader.loadDagre();
        await AssetLoader.loadScripts(["js/core/gsc-lz.js?v=1","js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=8","js/core/gen2-progression.js?v=6","js/core/gen2-trainers.js?v=3","js/sprite/codecs/gbc-2bpp.js?v=3","js/core/gb-picture-canvas.js?v=1","js/sprite/resource-catalog.js?v=1","js/sprite/gen2/scene-catalogs.js?v=1","js/battle/library.js?v=3","js/battle/source-state.js?v=1","js/battle/preview.js?v=25","js/battle/gen2/driver.js?v=6","js/animation/source-catalog.js?v=1","js/animation/library.js?v=21","js/animation/asset-catalog.js?v=1","js/animation/gen2/timing.js?v=1","js/animation/scene.js?v=6","js/animation/timeline.js?v=4","js/animation/renderer.js?v=21","js/core/ui-graph-layout.js?v=2","js/code/logic-graph.js?v=13","js/animation/gen2/visuals.js?v=2","js/animation/editor.js?v=20","js/animation/gen2/driver.js?v=12"]);
        if(!reader.isProjectGeneration(generation)||reader.animation_editor)return;
        reader.animation_editor=new global.AnimationEditor(reader,"gen2");return;
      }
      if(workspaceId==="encounter_editor"){
        if(reader.encounter_editor)return;
        await AssetLoader.loadScripts(["js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=5","js/core/gen2-progression.js?v=6","js/core/gen2-trainers.js?v=3","js/core/gen2-encounters.js?v=6","js/encounters/library.js?v=1","js/encounters/view-model.js?v=1","js/encounters/slot-view.js?v=2","js/encounters/editor.js?v=15","js/encounters/gen2/driver.js?v=4"]);
        if(!reader.isProjectGeneration(generation)||reader.encounter_editor)return;
        reader.encounter_editor=new global.EncounterEditor(reader,"gen2");return;
      }
      if(workspaceId==="item_editor"){
        if(reader.item_editor)return;
        await AssetLoader.loadScripts(["js/core/gen2-items.js?v=1","js/items/library.js?v=1","js/items/editor.js?v=6","js/items/gen2/driver.js?v=1"]);
        if(!reader.isProjectGeneration(generation)||reader.item_editor)return;
        reader.item_editor=new global.ItemEditor(reader,"gen2");return;
      }
      if(workspaceId==="map_editor"){
        if(reader.map_editor)return;
        await AssetLoader.loadScripts([
          "js/core/species-catalog.js?v=3","js/core/gen2-species.js?v=5","js/core/gen2-progression.js?v=6","js/core/gen2-trainers.js?v=3","js/core/gen2-encounters.js?v=6",
          "js/encounters/library.js?v=1","js/encounters/gen2/driver.js?v=5","js/encounters/map-panel.js?v=9",
          "js/core/map-block-utils.js?v=1","js/sprite/codecs/gbc-2bpp.js?v=3","js/core/event-bookmark-utils.js?v=1","js/map/gen2/movement-profile.js?v=1","js/map/movement.js?v=4","js/map/library.js?v=11","js/map/window-manager.js?v=5","js/map/minimap-utils.js?v=2","js/map/pointer-session.js?v=1","js/map/workspace.js?v=41",
          "js/map/editor.js?v=13","js/map/controls.js?v=7","js/map/selection.js?v=2","js/map/context-menu.js?v=4",
          "js/map/event-inspector.js?v=18","js/map/gen2/region-map.js?v=5","js/map/gen2/editor.js?v=23"
        ]);
        if(!reader.isProjectGeneration(generation)||reader.map_editor)return;
        PokemonViewer.maps.registerDriver("gen2",{create:current=>new Gen2MapDriver(current),tools:PokemonViewer.maps.capabilities.fixedEditing});
        reader.map_editor=PokemonViewer.maps.createEditor(reader,"gen2");
        reader.map_editor.init();
      }
    }
  });
})(globalThis);
