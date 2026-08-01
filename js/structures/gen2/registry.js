(function(global){
  "use strict";
  class Gen2StructureRegistry{
    static manifest=Object.freeze({mapGroupEntry:Gen2MapGroupEntry,mapAttributes:Gen2MapAttributes,mapConnection:Gen2MapConnection,mapEvents:Gen2MapEvents,mapScripts:Gen2MapScripts,warp:Gen2WarpEvent,coordEvent:Gen2CoordEvent,bgEvent:Gen2BgEvent,objectEvent:Gen2ObjectEvent,tileset:Gen2TilesetHeader,overworldSprites:Gen2OverworldSpriteCatalog});
    static list(){return Object.keys(this.manifest);}
    static get(name){return this.manifest[name]??null;}
    static createMemory(bytes){return new Gen2Memory(bytes);}
    static createMapDirectory(memory,options){return new Gen2MapDirectory(memory,options);}
    static createTileset(memory,header,options){return new Gen2TilesetCodec(memory,header,options);}
    static createOverworldSpriteCatalog(memory){return new Gen2OverworldSpriteCatalog(memory);}
  }
  global.Gen2StructureRegistry=Gen2StructureRegistry;
  const structures=(global.PokemonViewer||={}).structures||={},registries=structures.registries||={};
  registries.gen2=Gen2StructureRegistry;
  structures.gen2=Object.freeze({Registry:Gen2StructureRegistry,...Gen2StructureRegistry.manifest});
})(globalThis);
