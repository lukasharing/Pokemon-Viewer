(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),battle=root.battle;
  const palette=bytes=>Array.from({length:16},(_,index)=>{
    const value=bytes[index*2]|bytes[index*2+1]<<8,[r,g,b]=CoreUtils.bgr555ToRgb(value);
    return`#${[r,g,b].map(channel=>channel.toString(16).padStart(2,"0")).join("")}`;
  });
  class GbaTrainerSpriteCatalog{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.profile=root.gba.assets.profile(reader);this.cache=new Map();}
    source(id){
      try{return this.read(id);}
      catch(error){console.warn("Unable to decode GBA trainer picture",{id,error});return null;}
    }
    read(id){
      if(this.cache.has(id))return this.cache.get(id);
      if(!Number.isInteger(id)||id<0||id>92)throw new RangeError("Emerald trainer picture must be 0–92.");
      if(!Number.isInteger(this.profile?.trainerFrontPics)||!Number.isInteger(this.profile?.trainerFrontPalettes))throw new Error("This GBA profile has no verified trainer picture and palette tables.");
      const graphicRecord=this.profile.trainerFrontPics+id*8,paletteRecord=this.profile.trainerFrontPalettes+id*8;
      this.memory.assertRange(graphicRecord,8);this.memory.assertRange(paletteRecord,8);
      const graphicOffset=this.memory.pointer(graphicRecord),paletteOffset=this.memory.pointer(paletteRecord);
      if(graphicOffset===null||paletteOffset===null)throw new Error(`Trainer picture ${id} has an invalid ROM pointer.`);
      const graphic=root.gba.GbaLz77.decode(this.memory,graphicOffset).bytes;
      const paletteBytes=root.gba.GbaLz77.decode(this.memory,paletteOffset).bytes;
      if(!(graphic instanceof Uint8Array)||graphic.length<0x800)throw new Error(`Trainer picture ${id} is shorter than one native 64×64 frame.`);
      if(!(paletteBytes instanceof Uint8Array)||paletteBytes.length<32)throw new Error(`Trainer picture ${id} palette contains fewer than 16 colors.`);
      const colors=palette(paletteBytes);
      const frame=graphic.slice(0,0x800),indices=GbaSpriteCodec.decodeImage(frame,{width:64,height:64});
      const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
      const context=canvas.getContext("2d"),image=context.createImageData(64,64);
      for(let pixel=0;pixel<indices.length;pixel++){
        const index=indices[pixel],color=colors[index];
        if(typeof color!=="string")throw new Error(`Trainer picture ${id} references missing palette color ${index}.`);
        const value=Number.parseInt(color.slice(1),16),target=pixel*4;
        image.data[target]=value>>16;image.data[target+1]=value>>8&255;image.data[target+2]=value&255;image.data[target+3]=index===0?0:255;
      }
      context.putImageData(image,0,0);
      const result=Object.freeze({canvas,offset:graphicOffset,paletteOffset,bytes:frame,count:64,columns:8,palette:colors,title:`Trainer picture ${id} · Emerald ROM`,editable:false,sourceEncoding:"Emerald gTrainerFrontPicTable LZ77 → native 4bpp"});
      this.cache.set(id,result);return result;
    }
  }
  battle.GbaTrainerSpriteCatalog=GbaTrainerSpriteCatalog;
})(globalThis);
