(function(global){
  "use strict";
  const CONFIG=Object.freeze([
    Object.freeze({name:"object",countOffset:0,pointerOffset:4,stride:24}),
    Object.freeze({name:"warp",countOffset:1,pointerOffset:8,stride:8}),
    Object.freeze({name:"script trigger",countOffset:2,pointerOffset:12,stride:16}),
    Object.freeze({name:"signpost",countOffset:3,pointerOffset:16,stride:12})
  ]);
  class GbaEventTableWriter{
    constructor(memory){if(!(memory instanceof GbaMemory))throw new TypeError("GbaEventTableWriter requires GbaMemory.");this.memory=memory;this.allocator=new RomAllocator(memory);}
    config(type){const value=CONFIG[type];if(!value)throw new RangeError(`Unknown GBA event table ${type}.`);return value;}
    table(eventsOffset,type){
      const config=this.config(type),count=this.memory.u8(eventsOffset+config.countOffset),pointerRaw=this.memory.u32(eventsOffset+config.pointerOffset),pointer=this.memory.pointer(eventsOffset+config.pointerOffset);
      if(count&&pointer===null)throw new RangeError(`${config.name} table has ${count} entries but no valid ROM pointer.`);
      return{eventsOffset,type,config,count,pointerRaw,pointer,bytes:count?this.memory.slice(pointer,count*config.stride):new Uint8Array()};
    }
    plan(eventsOffset,type,nextBytes,nextCount){
      const previous=this.table(eventsOffset,type),expected=nextCount*previous.config.stride;
      if(!(nextBytes instanceof Uint8Array)||nextBytes.length!==expected)throw new RangeError(`${previous.config.name} table requires ${expected} bytes.`);
      if(nextCount<0||nextCount>255)throw new RangeError("GBA event tables support at most 255 entries.");
      const start=this.memory.size>0x100000?0x100000:0;
      const reservation=nextBytes.length?this.allocator.reserve(nextBytes.length,{start,owner:`gba:event-table:0x${eventsOffset.toString(16)}:${type}`,reason:`Relocated ${previous.config.name} table`}):null;
      const allocation=reservation?.offset??null;
      return Object.freeze({...previous,nextBytes:nextBytes.slice(),nextCount,allocation,reservation,nextPointerRaw:allocation===null?0:GbaMemory.ROM_BASE+allocation});
    }
    insert(eventsOffset,type,entry,index){
      const table=this.table(eventsOffset,type),at=index===undefined?table.count:index;
      if(!(entry instanceof Uint8Array)||entry.length!==table.config.stride)throw new RangeError(`A ${table.config.name} entry requires ${table.config.stride} bytes.`);
      if(at<0||at>table.count)throw new RangeError("Insertion index is outside the event table.");
      const next=new Uint8Array(table.bytes.length+table.config.stride),split=at*table.config.stride;next.set(table.bytes.slice(0,split));next.set(entry,split);next.set(table.bytes.slice(split),split+entry.length);
      return this.plan(eventsOffset,type,next,table.count+1);
    }
    remove(eventsOffset,type,index){
      const table=this.table(eventsOffset,type);if(index<0||index>=table.count)throw new RangeError("Removal index is outside the event table.");
      const start=index*table.config.stride,next=new Uint8Array(table.bytes.length-table.config.stride);next.set(table.bytes.slice(0,start));next.set(table.bytes.slice(start+table.config.stride),start);
      return this.plan(eventsOffset,type,next,table.count-1);
    }
    apply(plan){
      if(plan.reservation)this.allocator.ledger.acquire(plan.reservation);
      const patches=[
        {offset:plan.eventsOffset+plan.config.countOffset,expected:MemoryUtils.valueBytes("u8",plan.count),next:MemoryUtils.valueBytes("u8",plan.nextCount)},
        {offset:plan.eventsOffset+plan.config.pointerOffset,expected:MemoryUtils.valueBytes("u32",plan.pointerRaw),next:MemoryUtils.valueBytes("u32",plan.nextPointerRaw)}
      ];
      if(plan.allocation!==null)patches.unshift({offset:plan.allocation,expected:MemoryUtils.filled(plan.nextBytes.length),next:plan.nextBytes});
      try{MemoryUtils.replaceAll(this.memory,patches);}
      catch(error){if(plan.reservation)this.allocator.ledger.release(plan.reservation);throw error;}
      return plan;
    }
    restore(plan){
      const patches=[
        {offset:plan.eventsOffset+plan.config.countOffset,expected:MemoryUtils.valueBytes("u8",plan.nextCount),next:MemoryUtils.valueBytes("u8",plan.count)},
        {offset:plan.eventsOffset+plan.config.pointerOffset,expected:MemoryUtils.valueBytes("u32",plan.nextPointerRaw),next:MemoryUtils.valueBytes("u32",plan.pointerRaw)}
      ];
      if(plan.allocation!==null)patches.unshift({offset:plan.allocation,expected:plan.nextBytes,next:MemoryUtils.filled(plan.nextBytes.length)});
      MemoryUtils.replaceAll(this.memory,patches);
      if(plan.reservation)this.allocator.ledger.release(plan.reservation);
      return plan;
    }
    entry(type,{x=0,y=0,localId=1}={}){
      const config=this.config(type),bytes=new Uint8Array(config.stride),view=new DataView(bytes.buffer);
      if(type===3){view.setUint16(0,x,true);view.setUint16(2,y,true);}
      else{view.setInt16(type===0?4:0,x,true);view.setInt16(type===0?6:2,y,true);}
      if(type===0)view.setUint8(0,localId);
      return bytes;
    }
  }
  global.GbaEventTableWriter=GbaEventTableWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbaEventTableWriter=GbaEventTableWriter;
})(globalThis);
