(function(global){
  "use strict";
  const reverseBits=value=>{let result=0;for(let bit=0;bit<8;bit++)result|=(value>>bit&1)<<(7-bit);return result;};
  class GscLz{
    static decompress(memory,offset,{maxOutput=0x10000,maxInput=0x10000}={}){
      if(!memory?.contains?.(offset))throw new RangeError("Invalid GSC compressed-data offset.");
      const output=[];let cursor=offset;
      const read=()=>{if(cursor-offset>=maxInput||!memory.contains(cursor))throw new RangeError("GSC compressed stream has no terminator.");return memory.u8(cursor++);};
      while(true){
        const control=read();if(control===0xff)break;
        let command=control>>5,length=(control&0x1f)+1;
        if(command===7){command=control>>2&7;length=((control&3)<<8|read())+1;}
        if(output.length+length>maxOutput)throw new RangeError("GSC decompressed output exceeds its safety limit.");
        if(command===0){for(let index=0;index<length;index++)output.push(read());continue;}
        if(command===1){const value=read();for(let index=0;index<length;index++)output.push(value);continue;}
        if(command===2){const first=read(),second=read();for(let index=0;index<length;index++)output.push(index&1?second:first);continue;}
        if(command===3){output.push(...new Array(length).fill(0));continue;}
        const pointer=read(),source=pointer&0x80?output.length-(pointer&0x7f)-1:(pointer<<8|read());
        if(source<0||source>=output.length)throw new RangeError("GSC compressed stream references unavailable output.");
        for(let index=0;index<length;index++){
          const position=command===6?source-index:source+index;
          if(position<0||position>=output.length)throw new RangeError("GSC compressed stream has an invalid rewrite range.");
          output.push(command===5?reverseBits(output[position]):output[position]);
        }
      }
      return Object.freeze({bytes:Uint8Array.from(output),consumed:cursor-offset});
    }
  }
  global.GscLz=GscLz;
  ((global.PokemonViewer||={}).core||={}).GscLz=GscLz;
})(globalThis);
