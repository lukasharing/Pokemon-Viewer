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

  const root=(global.PokemonViewer||={});
  // Several GBA domain modules publish an immutable namespace snapshot.
  // Replacing that snapshot preserves the existing domains and makes this
  // codec available regardless of which editor was opened first.
  root.gba=Object.freeze({...root.gba,GbaWaveData});
})(globalThis);
