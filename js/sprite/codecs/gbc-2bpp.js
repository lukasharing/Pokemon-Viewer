(function(global){
  "use strict";
  global.GbcSpriteCodec=Object.freeze({
    id:"gbc-2bpp",label:"GB/GBC 2bpp",bytesPerTile:16,colors:4,
    decodeTile(memory,offset){
      memory.assertRange(offset,16);
      const pixels=new Uint8Array(64);
      for(let y=0;y<8;y++){
        const low=memory.u8(offset+y*2),high=memory.u8(offset+y*2+1);
        for(let x=0;x<8;x++){
          const bit=7-x;
          pixels[y*8+x]=((high>>bit)&1)*2+((low>>bit)&1);
        }
      }
      return pixels;
    },
    encodeTile(pixels){
      if(!pixels||pixels.length!==64)throw new RangeError("A GB/GBC tile requires 64 pixels.");
      const bytes=new Uint8Array(16);
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const value=Number(pixels[y*8+x]);if(!Number.isInteger(value)||value<0||value>3)throw new RangeError("GB/GBC pixel values must be 0..3.");
        const bit=7-x;bytes[y*2]|=(value&1)<<bit;bytes[y*2+1]|=(value>>1&1)<<bit;
      }
      return bytes;
    },
    decodeColor(value){
      if(!Number.isInteger(value)||value<0||value>0x7fff)throw new RangeError("GBC palette colors must be 15-bit values.");
      const expand=component=>Math.round(component*255/31);
      const channels=[expand(value&31),expand(value>>5&31),expand(value>>10&31)];
      return`#${channels.map(channel=>channel.toString(16).padStart(2,"0")).join("")}`;
    },
    encodeColor(color){
      if(typeof color!=="string"||!/^#[0-9a-f]{6}$/i.test(color))throw new RangeError("GBC palette colors require #RRGGBB.");
      const value=parseInt(color.slice(1),16),red=value>>16&255,green=value>>8&255,blue=value&255;
      return(red>>3)|(green>>3)<<5|(blue>>3)<<10;
    }
  });
})(globalThis);
