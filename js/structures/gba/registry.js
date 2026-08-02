globalThis.GbaStructureRegistry = class GbaStructureRegistry {
  static overworldCatalogs = new WeakMap();
  static manifest = Object.freeze({item:GbaItem,mapHeader:GbaMapHeader,mapLayout:GbaMapLayout,mapEvents:GbaMapEvents,mapScripts:GbaMapScripts,objectEvent:GbaObjectEventTemplate,warp:GbaWarpEvent,coordEvent:GbaCoordEvent,bgEvent:GbaBgEvent,connections:GbaMapConnections,tileset:GbaTileset,tilesetHeader:GbaTilesetHeader,metatileAttribute:GbaMetatileAttribute,overworldSprite:GbaOverworldSpriteInfo,overworldSprites:GbaOverworldSpriteCatalog});
  static list() { return Object.keys(this.manifest); }
  static get(name) { return this.manifest[name] ?? null; }
  static createMemory(bytes) { return new GbaMemory(bytes); }
  static createItemCatalog(memory, options) { return new GbaItemCatalog(memory, options); }
  static createOverworldSpriteCatalog(reader) {
    let catalog=this.overworldCatalogs.get(reader);
    if(!catalog){catalog=new GbaOverworldSpriteCatalog(reader);this.overworldCatalogs.set(reader,catalog);}
    return catalog;
  }
};
{
  const structures=(globalThis.PokemonViewer||={}).structures||={},registries=structures.registries||={};
  registries.gba=GbaStructureRegistry;
  structures.gba=Object.freeze({Registry:GbaStructureRegistry,...GbaStructureRegistry.manifest});
}
