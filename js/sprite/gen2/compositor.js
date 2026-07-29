(function(global){
  "use strict";
  const sprites=global.PokemonViewer.sprites,tools=sprites.CompositionTools;
  class Gen2SpriteCompositor{
    speechbox(){throw new Error("Crystal speech-box composition requires a verified Gen II font/window decoder.");}
    composition({layers=[]}={}){return Object.freeze({...tools.scene({width:160,height:144,layers}),family:"gen2"});}
  }
  sprites.Compositors.register("gen2",()=>new Gen2SpriteCompositor());
})(globalThis);
