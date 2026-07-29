(function(global){
  "use strict";
  const colors=raw=>Array.from({length:16},(_,index)=>raw[index*2]|raw[index*2+1]<<8).map(value=>CoreUtils.bgr555ToRgb(value));
  class GbaMonsterSpriteCatalog{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.data=reader.gbaSpeciesData||=new PokemonViewer.gba.GbaSpeciesData(reader);this.profile=this.data.profile;}
    coords(species,side="front"){
      const table=side==="back"?this.profile?.monsterBackCoords:this.profile?.monsterFrontCoords;
      if(!Number.isInteger(table))throw new Error(`This GBA profile has no verified ${side} picture-coordinate table.`);
      const offset=table+species*4;this.memory.assertRange(offset,4);
      const size=this.memory.u8(offset),yOffset=this.memory.u8(offset+1),padding=this.memory.u16(offset+2);
      if(padding!==0)throw new Error(`${side} picture coordinates for Species #${species} have invalid compiler padding.`);
      const width=(size>>4)*8,height=(size&15)*8;
      if(width<8||width>64||height<8||height>64||yOffset>64)throw new Error(`${side} picture coordinates for Species #${species} are invalid.`);
      return Object.freeze({offset,size,width,height,yOffset});
    }
    source(species,side="front"){
      try{return this.read(species,side);}catch(error){console.warn("Unable to decode GBA monster sprite",{species,side,error});return null;}
    }
    resource(species,side="front"){
      if(!this.profile||!Number.isInteger(species)||species<1||species>this.profile.speciesCount)return null;
      if(!["front","back"].includes(side))throw new RangeError(`Unknown monster sprite side '${side}'.`);
      // Retail Gen III stores both graphic tables and palettes as
      // {pointer, size, tag} records. The first native 64×64 frame is used by
      // this static scene; animation ownership remains in Animation Editor.
      const graphic=side==="back"?this.data.back(species):this.data.front(species),palette=this.data.palette(species),coords=this.coords(species,side);
      const frameBytes=graphic.bytes.slice(0,0x800),rgb=colors(palette.bytes);
      const paletteColors=Object.freeze(rgb.map(color=>`#${color.map(value=>value.toString(16).padStart(2,"0")).join("")}`));
      return Object.freeze({
        graphic:graphic.offset,paletteCompressedOffset:palette.offset,width:64,height:64,side,frameBytes,coords,
        offset:graphic.offset,bytes:frameBytes,count:64,columns:8,
        title:`${this.data.name(species)} · ${side} sprite`,editable:false,palette:paletteColors
      });
    }
    read(species,side="front"){
      const resource=this.resource(species,side);if(!resource)return null;
      const indices=GbaSpriteCodec.decodeImage(resource.bytes,{width:64,height:64}),canvas=document.createElement("canvas");
      canvas.width=canvas.height=64;const ctx=canvas.getContext("2d"),image=ctx.createImageData(64,64);
      for(let pixel=0;pixel<indices.length;pixel++){
        const index=indices[pixel],hex=resource.palette[index]||"#000000",value=Number.parseInt(hex.slice(1),16),color=[value>>16&255,value>>8&255,value&255],point=pixel*4;
        image.data.set([color[0],color[1],color[2],index===0?0:255],point);
      }
      ctx.putImageData(image,0,0);
      return Object.freeze({...resource,canvas});
    }
  }
  ((global.PokemonViewer||={}).battle||={}).GbaMonsterSpriteCatalog=GbaMonsterSpriteCatalog;
})(globalThis);
