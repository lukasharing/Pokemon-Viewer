(function(global){
  "use strict";
  class GraphicSource{
    static resolve(memory,{offset=0,bytes,segments,editable=false,title="Linked graphics",palette,colorCount,paletteOffset,paletteOffsets,paletteStride=2}={}){
      if(!(memory instanceof RomMemory))throw new TypeError("GraphicSource requires RomMemory.");
      const linked=bytes instanceof Uint8Array;
      const colors=GraphicSource.palette(palette,colorCount);
      const offsets=colors&&Array.isArray(paletteOffsets)&&paletteOffsets.length===colors.length
        ?paletteOffsets.map(value=>Number.isInteger(value)&&memory.contains(value,2)?value:null)
        :null;
      const paletteReference=offsets&&offsets.some(Number.isInteger)
        ?Object.freeze({offset:offsets.find(Number.isInteger),stride:paletteStride,offsets:Object.freeze(offsets)})
        :colors&&Number.isInteger(paletteOffset)&&memory.contains(paletteOffset,colors.length*paletteStride)
          ?Object.freeze({offset:paletteOffset,stride:paletteStride})
          :null;
      if(!linked)return Object.freeze({linked:false,verified:false,external:null,length:0,palette:colors,paletteReference,locate:null});
      const ranges=GraphicSource.segments(segments,bytes.length);
      const segmented=Boolean(ranges);
      const verified=editable&&(segmented?GraphicSource.verifySegments(memory,bytes,ranges):memory.contains(offset,bytes.length)&&GraphicSource.equals(memory,offset,bytes));
      const locate=verified?(segmented?GraphicSource.segmentLocator(ranges):((start,length=1)=>memory.contains(offset+start,length)&&start>=0&&start+length<=bytes.length?offset+start:null)):null;
      return Object.freeze({
        linked:true,verified,segmented,
        external:segmented||!verified?Object.freeze({bytes,offset,title}):null,
        segments:ranges,length:bytes.length,palette:colors,paletteReference,locate
      });
    }
    static equals(memory,offset,bytes){return MemoryUtils.equals(memory,offset,bytes);}
    static segments(values,length){
      if(values===undefined)return null;
      if(!Array.isArray(values)||!values.length)throw new TypeError("Graphic segments must be a non-empty array.");
      let cursor=0;
      const result=values.map(value=>{
        const offset=Number(value?.offset),size=Number(value?.length);
        if(!Number.isInteger(offset)||offset<0||!Number.isInteger(size)||size<1)throw new RangeError("Every graphic segment requires a non-negative offset and positive length.");
        const segment=Object.freeze({offset,length:size,start:cursor});cursor+=size;return segment;
      });
      if(cursor!==length)throw new RangeError(`Graphic segments cover ${cursor} bytes, but the assembled source contains ${length}.`);
      return Object.freeze(result);
    }
    static verifySegments(memory,bytes,segments){
      return segments.every(segment=>memory.contains(segment.offset,segment.length)&&MemoryUtils.equals(memory,segment.offset,bytes.subarray(segment.start,segment.start+segment.length)));
    }
    static segmentLocator(segments){
      return(start,length=1)=>{
        if(!Number.isInteger(start)||start<0||!Number.isInteger(length)||length<1)return null;
        const segment=segments.find(item=>start>=item.start&&start+length<=item.start+item.length);
        return segment?segment.offset+(start-segment.start):null;
      };
    }
    static palette(values,count){
      if(!Array.isArray(values)||!Number.isInteger(count)||values.length<count)return null;
      const result=values.slice(0,count).map(value=>{
        if(Number.isInteger(value)&&value>=0&&value<=0xffffff)return`#${value.toString(16).padStart(6,"0")}`;
        if(typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value))return value.toLowerCase();
        throw new RangeError(`Invalid linked palette color '${value}'.`);
      });
      return Object.freeze(result);
    }
  }
  global.GraphicSource=GraphicSource;((global.PokemonViewer ||= {}).core ||= {}).GraphicSource=GraphicSource;
})(globalThis);
