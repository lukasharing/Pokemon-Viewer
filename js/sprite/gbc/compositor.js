(function(global){
  "use strict";
  const sprites=global.PokemonViewer.sprites,tools=sprites.CompositionTools;
  class GbcSpriteCompositor{
    constructor(reader){this.reader=reader;this.font=PokemonViewer.fonts.registry.get(reader,"gbc");}
    speechbox({variant="dialogue",text=""}={}){
      const tilesWide=20,tilesHigh=variant==="menu"?7:4,result=tools.textWindow({width:tilesWide*8,height:tilesHigh*8,tilesWide,tilesHigh,text,font:this.font,background:"#e0f8cf",border:"#071821",lineHeight:8,maxLines:tilesHigh-2});
      return Object.freeze({...result,family:"gbc",variant,status:`GB/C ${tilesWide}×${tilesHigh} tile dialogue layout · mounted live preview.`});
    }
    composition({layers=[]}={}){return Object.freeze({...tools.scene({width:160,height:144,layers}),family:"gbc"});}
  }
  sprites.Compositors.register("gbc",reader=>new GbcSpriteCompositor(reader));
})(globalThis);
