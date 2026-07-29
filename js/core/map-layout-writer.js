(function(global){
  "use strict";

  class MapLayoutWriter{
    constructor(memory){
      if(!(memory instanceof RomMemory))throw new TypeError("MapLayoutWriter requires RomMemory.");
      this.memory=memory;
      this.patcher=new RelocatablePatch(memory);
      this.writer=new StructureWriter(memory);
    }

    resizeBytes(source,width,height,nextWidth,nextHeight,stride,fill=0){
      for(const [name,value] of Object.entries({width,height,nextWidth,nextHeight,stride}))
        if(!Number.isInteger(value)||value<1)throw new RangeError(`${name} must be a positive integer.`);
      if(!(source instanceof Uint8Array)||source.length!==width*height*stride)throw new RangeError("Source block data does not match its dimensions.");
      const result=new Uint8Array(nextWidth*nextHeight*stride);if(fill)result.fill(fill);
      const copyWidth=Math.min(width,nextWidth),copyHeight=Math.min(height,nextHeight);
      for(let y=0;y<copyHeight;y++)for(let x=0;x<copyWidth;x++){
        const from=(y*width+x)*stride,to=(y*nextWidth+x)*stride;
        result.set(source.slice(from,from+stride),to);
      }
      return result;
    }

    plan({offset,width,height,nextWidth,nextHeight,stride=1,fill=0,reference,dimensions}){
      if(nextWidth>255||nextHeight>255)throw new RangeError("Map dimensions cannot exceed 255 × 255.");
      const source=this.memory.slice(offset,width*height*stride),nextBytes=this.resizeBytes(source,width,height,nextWidth,nextHeight,stride,fill);
      const patch=this.patcher.plan({offset,previousLength:source.length,nextBytes,reference});
      const previousDimensions=dimensions.map(field=>this.memory.slice(field.offset,this.width(field.type)));
      const nextDimensions=dimensions.map((field,index)=>this.writer.encode(field.type,index===0?nextWidth:nextHeight));
      return Object.freeze({patch,sourceBytes:source.slice(),nextBytes:nextBytes.slice(),width,height,nextWidth,nextHeight,stride,dimensions:Object.freeze(dimensions.map(field=>Object.freeze({...field}))),previousDimensions:Object.freeze(previousDimensions),nextDimensions:Object.freeze(nextDimensions)});
    }

    apply(plan){
      const dimensions=plan.dimensions.map((field,index)=>({offset:field.offset,expected:plan.previousDimensions[index],next:plan.nextDimensions[index]}));
      return this.patcher.apply(plan.patch,dimensions);
    }

    restore(plan){
      const dimensions=plan.dimensions.map((field,index)=>({offset:field.offset,expected:plan.nextDimensions[index],next:plan.previousDimensions[index]}));
      return this.patcher.restore(plan.patch,dimensions);
    }

    width(type){const widths={u8:1,s8:1,u16:2,s16:2,u32:4,s32:4};if(!widths[type])throw new TypeError(`Unsupported dimension type '${type}'.`);return widths[type];}
  }

  global.MapLayoutWriter=MapLayoutWriter;
  ((global.PokemonViewer ||= {}).core ||= {}).MapLayoutWriter=MapLayoutWriter;
})(globalThis);
