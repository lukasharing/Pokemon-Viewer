(function(global){
  "use strict";
  class GbcGameFont{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=reader.memoryProfile;this.cache=new Map();
      if(!this.profile)throw new Error("Generation I native font requires a resolved memory profile.");
      const symbol=this.profile.require("FontGraphics");
      const extent=Number(symbol.extent)||Number(this.profile.schema("FontGraphics")?.extent)||0;
      if(extent<128*8)throw new RangeError(`Memory symbol 'FontGraphics' is too small for the Generation I native font (${extent}/${128*8} bytes).`);
      this.glyphs=symbol.offset;
      this.codec=new TextTableCodec(reader.getDictionary(reader.textDictionary)||[]);
      this.memory.assertRange(this.glyphs,128*8);
    }
    ids(text){
      return this.codec.encode(String(text??""));
    }
    measure(text,{letterSpacing=0}={}){return Array.from(this.ids(text)).reduce((width,id)=>width+this.glyph(id).width+letterSpacing,0);}
    glyph(id){
      const key=Number(id);if(this.cache.has(key))return this.cache.get(key);
      const canvas=document.createElement("canvas");canvas.width=canvas.height=8;
      const context=canvas.getContext("2d"),image=context.createImageData(8,8),index=key-0x80;
      if(index>=0&&index<128)for(let y=0;y<8;y++){const bits=this.memory.u8(this.glyphs+index*8+y);for(let x=0;x<8;x++)if(bits>>(7-x)&1)image.data.set([0,0,0,255],(y*8+x)*4);}
      context.putImageData(image,0,0);
      const result=Object.freeze({canvas,width:8,height:8});this.cache.set(key,result);return result;
    }
    draw(context,text,x,y,{maxWidth=Infinity,letterSpacing=0}={}){
      let cursor=x;for(const id of this.ids(text)){const glyph=this.glyph(id);if(cursor+8>x+maxWidth)break;context.drawImage(glyph.canvas,Math.round(cursor),Math.round(y));cursor+=8+letterSpacing;}return cursor-x;
    }
  }
  PokemonViewer.fonts.registry.register("gbc",reader=>new GbcGameFont(reader));
})(globalThis);
