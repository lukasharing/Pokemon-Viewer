(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});

  class Gen2TrainerSpriteCatalog{
    constructor(reader,{trainerData=null}={}){
      this.memory=reader.memory;this.trainerData=trainerData;this.cache=new Map();
    }
    source(classId){
      if(this.cache.has(classId))return this.cache.get(classId);
      if(!this.trainerData)throw new Error("Crystal trainer picture catalog requires typed trainer data.");
      const source=this.trainerData.classDocument(classId),decoded=GscLz.decompress(this.memory,source.pictureOffset,{maxOutput:0x1000}).bytes;
      if(decoded.length<49*16)throw new Error(`${source.name} trainer picture is shorter than the native 7×7 tile area.`);
      const canvas=document.createElement("canvas");canvas.width=canvas.height=56;
      const context=canvas.getContext("2d"),image=context.createImageData(56,56),memory=new RomMemory(decoded);
      const colors=[[255,255,255,0],[170,170,170,255],[85,85,85,255],[0,0,0,255]];
      for(let tile=0;tile<49;tile++){
        const pixels=GbcSpriteCodec.decodeTile(memory,tile*16),tileX=tile%7,tileY=Math.floor(tile/7);
        for(let pixel=0;pixel<64;pixel++){
          const rgba=colors[pixels[pixel]],target=((tileY*8+Math.floor(pixel/8))*56+tileX*8+pixel%8)*4;
          image.data.set(rgba,target);
        }
      }
      context.putImageData(image,0,0);
      const result=Object.freeze({
        canvas,offset:source.pictureOffset,bytes:decoded.slice(0,49*16),count:49,columns:7,
        title:`${source.name} trainer picture · native Crystal LZ`,editable:false,
        sourceEncoding:"Crystal TrainerPicPointers LZ → native 2bpp tiles"
      });
      this.cache.set(classId,result);return result;
    }
  }

  sprites.Gen2TrainerSpriteCatalog=Gen2TrainerSpriteCatalog;
})(globalThis);
