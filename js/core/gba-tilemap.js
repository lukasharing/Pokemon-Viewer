(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});

  class GbaTilemapRenderer{
    static colors(bytes,{base=0}={}){
      if(!(bytes instanceof Uint8Array)||bytes.length%2)throw new TypeError("A GBA palette must contain complete 16-bit colors.");
      const result=[];
      for(let index=0;index<bytes.length;index+=2)result[base+index/2]=CoreUtils.bgr555ToRgb(bytes[index]|bytes[index+1]<<8);
      return result;
    }
    static target(width,height){
      const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;
      return{canvas,context,image:context.createImageData(width,height)};
    }
    static put(image,width,x,y,color,alpha=255){
      const offset=(y*width+x)*4;
      image.data[offset]=color?.[0]??0;
      image.data[offset+1]=color?.[1]??0;
      image.data[offset+2]=color?.[2]??0;
      image.data[offset+3]=alpha;
    }
    static renderText4bpp({tiles,tilemap,palette,width=30,height=20,stride=32,transparentZero=false}={}){
      if(!(tiles instanceof Uint8Array)||!(tilemap instanceof Uint8Array))throw new TypeError("GBA text backgrounds require tile and tilemap bytes.");
      const output=this.target(width*8,height*8),view=new DataView(tilemap.buffer,tilemap.byteOffset,tilemap.byteLength);
      for(let cellY=0;cellY<height;cellY++)for(let cellX=0;cellX<width;cellX++){
        const entryOffset=(cellY*stride+cellX)*2;
        if(entryOffset+2>tilemap.byteLength)throw new RangeError("GBA tilemap does not contain the requested visible screen.");
        const entry=view.getUint16(entryOffset,true),tile=entry&0x3ff,flipX=Boolean(entry&0x400),flipY=Boolean(entry&0x800),bank=entry>>>12,source=tile*32;
        if(source+32>tiles.length)throw new RangeError(`GBA tile ${tile} is outside the decoded tileset.`);
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){
          const sx=flipX?7-x:x,sy=flipY?7-y:y,packed=tiles[source+sy*4+(sx>>1)],index=sx&1?packed>>>4:packed&15;
          this.put(output.image,output.canvas.width,cellX*8+x,cellY*8+y,palette[bank*16+index],transparentZero&&index===0?0:255);
        }
      }
      output.context.putImageData(output.image,0,0);return output.canvas;
    }
    static renderAffine8bpp({tiles,tilemap,palette,width=30,height=20,stride=64}={}){
      if(!(tiles instanceof Uint8Array)||!(tilemap instanceof Uint8Array))throw new TypeError("GBA affine backgrounds require tile and tilemap bytes.");
      const output=this.target(width*8,height*8);
      for(let cellY=0;cellY<height;cellY++)for(let cellX=0;cellX<width;cellX++){
        const mapOffset=cellY*stride+cellX;if(mapOffset>=tilemap.length)throw new RangeError("GBA affine tilemap does not contain the requested visible screen.");
        const tile=tilemap[mapOffset],source=tile*64;
        if(source+64>tiles.length)throw new RangeError(`GBA affine tile ${tile} is outside the decoded tileset.`);
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){
          const index=tiles[source+y*8+x];
          this.put(output.image,output.canvas.width,cellX*8+x,cellY*8+y,palette[index]);
        }
      }
      output.context.putImageData(output.image,0,0);return output.canvas;
    }
  }

  root.gba=Object.freeze({...root.gba,GbaTilemapRenderer});
})(globalThis);
