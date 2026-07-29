(function(global){
  "use strict";
  global.GbaSpriteCodec=Object.freeze({
    id:"gba-4bpp",label:"GBA 4bpp",bytesPerTile:32,colors:16,
    decodeTile(memory,offset){
      memory.assertRange(offset,32);
      const pixels=new Uint8Array(64);
      for(let index=0;index<32;index++){
        const value=memory.u8(offset+index);
        pixels[index*2]=value&0xf;
        pixels[index*2+1]=value>>4;
      }
      return pixels;
    },
    decodeImage(bytes,{width,height}={}){
      if(!(bytes instanceof Uint8Array))throw new TypeError("GBA image data must be Uint8Array.");
      if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width%8||height%8)throw new RangeError("GBA image dimensions must be positive multiples of 8.");
      const tileColumns=width/8,tileRows=height/8,required=tileColumns*tileRows*32;
      if(bytes.length<required)throw new RangeError(`A ${width}×${height} GBA 4bpp image requires ${required} bytes.`);
      const pixels=new Uint8Array(width*height);
      for(let tile=0;tile<tileColumns*tileRows;tile++){
        const tileX=tile%tileColumns*8,tileY=Math.floor(tile/tileColumns)*8,source=tile*32;
        for(let y=0;y<8;y++)for(let pair=0;pair<4;pair++){
          const value=bytes[source+y*4+pair],target=(tileY+y)*width+tileX+pair*2;
          pixels[target]=value&15;pixels[target+1]=value>>4;
        }
      }
      return pixels;
    },
    encodeTile(pixels){
      if(!pixels||pixels.length!==64)throw new RangeError("A GBA tile requires 64 pixels.");
      const bytes=new Uint8Array(32);
      for(let index=0;index<32;index++){
        const low=Number(pixels[index*2]),high=Number(pixels[index*2+1]);
        if(!Number.isInteger(low)||low<0||low>15||!Number.isInteger(high)||high<0||high>15)throw new RangeError("GBA pixel values must be 0..15.");
        bytes[index]=low|high<<4;
      }
      return bytes;
    },
    decodeColor(value){
      if(!Number.isInteger(value)||value<0||value>0x7fff)throw new RangeError("GBA palette colors must be 15-bit values.");
      const red=(value&0x1f)<<3,green=(value>>5&0x1f)<<3,blue=(value>>10&0x1f)<<3;
      return`#${[red,green,blue].map(channel=>channel.toString(16).padStart(2,"0")).join("")}`;
    },
    encodeColor(color){
      if(typeof color!=="string"||!/^#[0-9a-f]{6}$/i.test(color))throw new RangeError("GBA palette colors require #RRGGBB.");
      const value=parseInt(color.slice(1),16),red=value>>16&0xff,green=value>>8&0xff,blue=value&0xff;
      return(red>>3)|(green>>3)<<5|(blue>>3)<<10;
    }
  });
})(globalThis);
