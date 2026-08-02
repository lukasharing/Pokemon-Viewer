globalThis.GbcStructureRegistry = class GbcStructureRegistry {
  static overworldCatalogs = new WeakMap();
  static manifest = Object.freeze({itemCatalog:GbcItemCatalog,mapHeader:GbcMapHeader,mapObjects:GbcMapObjectBlock,objectEvent:GbcObjectEvent,warp:GbcWarpEvent,bgEvent:GbcBgEvent,collisionWriter:GbcCollisionTableWriter,overworldSprites:GbcOverworldSpriteCatalog});
  static list() { return Object.keys(this.manifest); }
  static get(name) { return this.manifest[name] ?? null; }
  static createMemory(bytes) { return new GbcMemory(bytes); }
  static createItemCatalog(memory, options) { return new GbcItemCatalog(memory, options); }
  static createOverworldSpriteCatalog(memory) {
    let catalog=this.overworldCatalogs.get(memory);
    if(!catalog){catalog=new GbcOverworldSpriteCatalog(memory);this.overworldCatalogs.set(memory,catalog);}
    return catalog;
  }
};
{
  const structures=(globalThis.PokemonViewer||={}).structures||={},registries=structures.registries||={};
  registries.gbc=GbcStructureRegistry;
  structures.gbc=Object.freeze({Registry:GbcStructureRegistry,...GbcStructureRegistry.manifest});
}
