(function(global){
  "use strict";
  class GbaGameFont{
    constructor(reader,{variant="normal"}={}){
      this.reader=reader;this.memory=reader.memory;this.cache=new Map();
      this.codec=new TextTableCodec(reader.getDictionary(reader.textDictionary)||[]);
      const profile=PokemonViewer.gba?.assets?.profile?.(reader);
      const small=variant==="small",glyphs=small?profile?.fontSmallLatin:profile?.fontNormalLatin,widths=small?profile?.fontSmallWidths:profile?.fontNormalWidths;
      if(!profile?.verifiedReference||![glyphs,widths].every(Number.isInteger))throw new Error(`This GBA profile has no verified native ${variant} font table.`);
      this.variant=variant;this.glyphs=glyphs;this.widths=widths;
      this.memory.assertRange(this.glyphs,512*64);this.memory.assertRange(this.widths,512);
    }
    ids(text){
      return this.codec.encode(String(text??""));
    }
    measure(text,{letterSpacing=0,scale=1}={}){return Array.from(this.ids(text)).reduce((width,id)=>width+(this.glyph(id).width+letterSpacing)*scale,0);}
    glyph(id){
      const key=Number(id);if(this.cache.has(key))return this.cache.get(key);
      const canvas=document.createElement("canvas");canvas.width=canvas.height=16;
      const context=canvas.getContext("2d"),image=context.createImageData(16,16),offset=this.glyphs+key*64;
      for(let tile=0;tile<4;tile++)for(let row=0;row<8;row++){
        const at=offset+tile*16+row*2,packed=[this.memory.u8(at+1),this.memory.u8(at)];
        for(let x=0;x<8;x++){
          const value=packed[x>>2]>>((3-(x&3))*2)&3;if(value===0||value===3)continue;
          const px=(tile&1)*8+x,py=(tile>>1)*8+row,target=(py*16+px)*4,color=value===1?56:216;
          image.data.set([color,color,color,255],target);
        }
      }
      context.putImageData(image,0,0);
      const result=Object.freeze({canvas,width:this.memory.u8(this.widths+key),height:15});this.cache.set(key,result);return result;
    }
    draw(context,text,x,y,{maxWidth=Infinity,letterSpacing=0,scale=1}={}){
      return this.drawGlyphs(context,this.ids(text),x,y,{maxWidth,letterSpacing,scale});
    }
    drawGlyphs(context,ids,x,y,{maxWidth=Infinity,letterSpacing=0,scale=1}={}){
      let cursor=x;for(const id of ids){const glyph=this.glyph(id),width=glyph.width*scale;if(cursor+width>x+maxWidth)break;context.drawImage(glyph.canvas,Math.round(cursor),Math.round(y),Math.round(glyph.canvas.width*scale),Math.round(glyph.canvas.height*scale));cursor+=(glyph.width+letterSpacing)*scale;}return cursor-x;
    }
  }
  PokemonViewer.fonts.registry.register("gba",reader=>new GbaGameFont(reader));
  PokemonViewer.fonts.registry.register("gba-small",reader=>new GbaGameFont(reader,{variant:"small"}));
})(globalThis);
