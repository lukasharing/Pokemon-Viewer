(function(global){
  "use strict";
  const sprites=global.PokemonViewer.sprites,tools=sprites.CompositionTools;
  class GbaSpriteCompositor{
    constructor(reader){this.reader=reader;this.font=PokemonViewer.fonts.registry.get(reader,"gba");}
    speechbox({variant="dialogue",text=""}={}){
      const tilesWide=30,tilesHigh=variant==="menu"?9:6,result=tools.textWindow({width:tilesWide*8,height:tilesHigh*8,tilesWide,tilesHigh,text,font:this.font,background:"#f7fbff",border:"#243f64",lineHeight:16,maxLines:tilesHigh-2});
      return Object.freeze({...result,family:"gba",variant,status:`GBA ${tilesWide}×${tilesHigh} tile dialogue layout · mounted live preview.`});
    }
    composition({layers=[]}={}){return Object.freeze({...tools.scene({width:240,height:160,layers}),family:"gba"});}
  }
  sprites.Compositors.register("gba",reader=>new GbaSpriteCompositor(reader));
})(globalThis);
