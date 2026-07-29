(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={}),factories=new Map();
  class SpriteCompositionTools{
    static canvas(width,height){const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;canvas.getContext("2d").imageSmoothingEnabled=false;return canvas;}
    static checker(context,width,height){context.fillStyle="#e8eef4";context.fillRect(0,0,width,height);context.fillStyle="#f7fafc";for(let y=0;y<height;y+=8)for(let x=0;x<width;x+=8)if((x/8+y/8)&1)context.fillRect(x,y,8,8);}
    static scene({width,height,layers=[]}={}){
      const canvas=this.canvas(width,height),context=canvas.getContext("2d");this.checker(context,width,height);
      for(const layer of layers)if(layer?.canvas)context.drawImage(layer.canvas,layer.x||0,layer.y||0,layer.width||layer.canvas.width,layer.height||layer.canvas.height);
      return Object.freeze({canvas,width,height,kind:"scene",verified:layers.every(layer=>layer.verified),layers:Object.freeze(layers),status:"Live scene compositor · verified layers are mounted at native coordinates."});
    }
    static textWindow({width,height,tilesWide,tilesHigh,text,font,background,border,lineHeight,maxLines}={}){
      if(!font?.draw||!font?.measure)throw new Error("A verified native ROM font is required to compose a speech box.");
      const canvas=this.canvas(width,height),context=canvas.getContext("2d");context.fillStyle=background;context.fillRect(0,0,width,height);context.strokeStyle=border;context.lineWidth=2;context.strokeRect(1,1,width-2,height-2);context.strokeRect(5,5,width-10,height-10);
      const maxWidth=width-20,words=String(text).replace(/\s+/g," ").trim().split(" ");let line="",row=0;
      for(const word of words){const next=line?`${line} ${word}`:word;if(font.measure(next)>maxWidth&&line){font.draw(context,line,10,10+row*lineHeight,{maxWidth});line=word;if(++row>=maxLines)break;}else line=next;}
      if(row<maxLines&&line)font.draw(context,line,10,10+row*lineHeight,{maxWidth});
      return{canvas,width,height,tilesWide,tilesHigh,kind:"speechbox",verified:false,reason:"Engine window geometry; ROM frame graphics require a verified source table."};
    }
  }
  sprites.CompositionTools=SpriteCompositionTools;
  sprites.Compositors=Object.freeze({
    register(id,factory){if(typeof id!=="string"||typeof factory!=="function")throw new TypeError("Sprite compositor registration requires an ID and factory.");factories.set(id,factory);},
    create(id,reader){const factory=factories.get(id);if(!factory)throw new Error(`No sprite compositor is registered for '${id}'.`);return factory(reader);}
  });
})(globalThis);
