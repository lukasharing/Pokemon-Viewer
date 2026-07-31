(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),graphics=(root.graphics||={});
  class GbPictureCanvas{
    static render(picture,{palette,canvasWidth=64,canvasHeight=64,scale=1,alignX="center",alignY="center",transparentZero=true}={}){
      if(!picture?.bytes||!Number.isInteger(picture.width)||!Number.isInteger(picture.height))throw new TypeError("GB picture rendering requires decoded bytes and tile dimensions.");
      if(!Array.isArray(palette)||palette.length<4)throw new TypeError("GB picture rendering requires a four-color palette.");
      const canvas=document.createElement("canvas");canvas.width=canvasWidth;canvas.height=canvasHeight;
      const context=canvas.getContext("2d"),image=context.createImageData(canvasWidth,canvasHeight),
        source=new RomMemory(picture.bytes),width=picture.width*8*scale,height=picture.height*8*scale,
        originX=alignX==="left"?0:alignX==="right"?canvasWidth-width:Math.floor((canvasWidth-width)/2),
        originY=alignY==="top"?0:alignY==="bottom"?canvasHeight-height:Math.floor((canvasHeight-height)/2);
      for(let tile=0;tile<picture.width*picture.height;tile++){
        const pixels=GbcSpriteCodec.decodeTile(source,tile*16),tileX=tile%picture.width*8,tileY=Math.floor(tile/picture.width)*8;
        for(let pixel=0;pixel<64;pixel++){
          const ink=pixels[pixel],rgb=Number.parseInt(String(palette[ink]).replace(/^#/,""),16),
            x=originX+(tileX+pixel%8)*scale,y=originY+(tileY+Math.floor(pixel/8))*scale;
          for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
            const target=((y+dy)*canvasWidth+x+dx)*4;
            image.data.set([rgb>>16&255,rgb>>8&255,rgb&255,transparentZero&&ink===0?0:255],target);
          }
        }
      }
      context.putImageData(image,0,0);return canvas;
    }
  }
  graphics.GbPictureCanvas=GbPictureCanvas;
})(globalThis);
