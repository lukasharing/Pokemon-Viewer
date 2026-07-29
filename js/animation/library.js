(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={});ns.animation||={};
  ns.animation.registry=ns.animation.registry||new DriverRegistry("Animation");
  const DOMAINS=Object.freeze({
    pokemon:Object.freeze({label:"Pokémon",icon:"fa-paw"}),
    trainer:Object.freeze({label:"Trainer & Poké Ball",icon:"fa-person-running"}),
    move:Object.freeze({label:"Moves",icon:"fa-wand-magic-sparkles"}),
    transition:Object.freeze({label:"Transitions",icon:"fa-right-left"}),
    scene:Object.freeze({label:"Scenes",icon:"fa-film"}),
    tile:Object.freeze({label:"Tiles",icon:"fa-table-cells"}),
    interface:Object.freeze({label:"Interface",icon:"fa-window-maximize"}),
    palette:Object.freeze({label:"Palette & camera",icon:"fa-palette"})
  });
  class AnimationDocument{
    constructor({id,name,type="sprite",domain="scene",fps=60,offset=null,commands=[],frames=[],accuracy="partial",properties=[],editable=false,editor=null,source=null}={}){
      Object.assign(this,{id,name,type,domain,fps,offset,commands,frames,accuracy,properties,editable,editor,source});
    }
  }
  class AnimationCatalog{
    constructor(){this.providers=[];}
    add(provider){if(provider&&typeof provider.list==="function")this.providers.push(provider);return this;}
    list(){return this.providers.flatMap(provider=>provider.list()).filter(Boolean);}
  }
  ns.animation.DOMAINS=DOMAINS;
  ns.animation.AnimationDocument=AnimationDocument;
  ns.animation.AnimationCatalog=AnimationCatalog;
})(globalThis);
