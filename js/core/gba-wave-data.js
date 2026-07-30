(function(global){
  "use strict";

  class GbaWaveData{
    static HEADER_SIZE=16;
    static MAX_SAMPLES=0x100000;

    static decode(memory,offset){
      if(!Number.isInteger(offset)||!memory?.contains?.(offset,this.HEADER_SIZE))return null;
      const frequency=memory.u32(offset+4),loopStart=memory.u32(offset+8),size=memory.u32(offset+12);
      if(frequency<1||size<1||size>this.MAX_SAMPLES||loopStart>size||!memory.contains(offset+this.HEADER_SIZE,size))return null;
      const bytes=memory.slice(offset+this.HEADER_SIZE,size),samples=new Float32Array(size);
      for(let index=0;index<size;index++)samples[index]=((bytes[index]<<24)>>24)/128;
      return Object.freeze({
        native:true,offset:offset+this.HEADER_SIZE,headerOffset:offset,
        samples,frequency,sampleRate:frequency/1024,loopStart,size
      });
    }
  }

  ((global.PokemonViewer||={}).gba||={}).GbaWaveData=GbaWaveData;
})(globalThis);
