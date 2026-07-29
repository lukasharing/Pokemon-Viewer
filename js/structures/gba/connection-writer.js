(function(global){
  "use strict";
  class GbaConnectionTableWriter{
    constructor(memory){if(!(memory instanceof GbaMemory))throw new TypeError("GbaConnectionTableWriter requires GbaMemory.");this.memory=memory;this.allocator=new RomAllocator(memory);}
    read(mapHeaderOffset){
      const pointerRaw=this.memory.u32(mapHeaderOffset+12),header=this.memory.pointer(mapHeaderOffset+12);
      if(header===null)return{mapHeaderOffset,pointerRaw,header:null,count:0,bytes:new Uint8Array()};
      const count=this.memory.u32(header),entries=this.memory.pointer(header+4);
      if(count>255||count&&entries===null)throw new RangeError("The GBA connection table is invalid.");
      return{mapHeaderOffset,pointerRaw,header,count,bytes:count?this.memory.slice(entries,count*GbaMapConnection.SIZE):new Uint8Array()};
    }
    encode(values){
      const bytes=new Uint8Array(GbaMapConnection.SIZE),view=new DataView(bytes.buffer);
      if(!Number.isInteger(values.direction)||values.direction<1||values.direction>6)throw new RangeError("GBA connection direction must be 1..6.");
      for(const key of ["mapGroup","mapNum"])if(!Number.isInteger(values[key])||values[key]<0||values[key]>255)throw new RangeError(`${key} must be 0..255.`);
      if(!Number.isInteger(values.relativeOffset)||values.relativeOffset<(-0x80000000)||values.relativeOffset>0x7fffffff)throw new RangeError("Connection offset is outside signed 32-bit range.");
      view.setUint8(0,values.direction);view.setInt32(4,values.relativeOffset,true);view.setUint8(8,values.mapGroup);view.setUint8(9,values.mapNum);return bytes;
    }
    plan(mapHeaderOffset,nextBytes,nextCount){
      const previous=this.read(mapHeaderOffset);
      if(!(nextBytes instanceof Uint8Array)||nextBytes.length!==nextCount*GbaMapConnection.SIZE)throw new RangeError("GBA connection bytes do not match their count.");
      const length=nextCount?8+nextBytes.length:0,start=this.memory.size>0x100000?0x100000:0;
      const reservation=length?this.allocator.reserve(length,{start,owner:`gba:connections:0x${mapHeaderOffset.toString(16)}`,reason:"Relocated GBA connection table"}):null;
      const allocation=reservation?.offset??null;
      const allocationBytes=allocation===null?null:new Uint8Array(length);
      if(allocationBytes){const view=new DataView(allocationBytes.buffer);view.setUint32(0,nextCount,true);view.setUint32(4,GbaMemory.ROM_BASE+allocation+8,true);allocationBytes.set(nextBytes,8);}
      return Object.freeze({...previous,nextBytes:nextBytes.slice(),nextCount,allocation,reservation,allocationBytes,length,nextPointerRaw:allocation===null?0:GbaMemory.ROM_BASE+allocation});
    }
    insert(mapHeaderOffset,values,index){
      const table=this.read(mapHeaderOffset),at=index===undefined?table.count:index,entry=this.encode(values);
      if(at<0||at>table.count)throw new RangeError("Connection insertion index is outside the table.");
      const split=at*GbaMapConnection.SIZE,next=new Uint8Array(table.bytes.length+entry.length);next.set(table.bytes.slice(0,split));next.set(entry,split);next.set(table.bytes.slice(split),split+entry.length);
      return this.plan(mapHeaderOffset,next,table.count+1);
    }
    remove(mapHeaderOffset,index){
      const table=this.read(mapHeaderOffset);if(index<0||index>=table.count)throw new RangeError("Connection removal index is outside the table.");
      const start=index*GbaMapConnection.SIZE,next=new Uint8Array(table.bytes.length-GbaMapConnection.SIZE);next.set(table.bytes.slice(0,start));next.set(table.bytes.slice(start+GbaMapConnection.SIZE),start);
      return this.plan(mapHeaderOffset,next,table.count-1);
    }
    apply(plan){
      if(plan.reservation)this.allocator.ledger.acquire(plan.reservation);
      const patches=[{offset:plan.mapHeaderOffset+12,expected:MemoryUtils.valueBytes("u32",plan.pointerRaw),next:MemoryUtils.valueBytes("u32",plan.nextPointerRaw)}];
      if(plan.allocation!==null)patches.unshift({offset:plan.allocation,expected:MemoryUtils.filled(plan.length),next:plan.allocationBytes});
      try{MemoryUtils.replaceAll(this.memory,patches);}
      catch(error){if(plan.reservation)this.allocator.ledger.release(plan.reservation);throw error;}
      return plan;
    }
    restore(plan){
      const patches=[{offset:plan.mapHeaderOffset+12,expected:MemoryUtils.valueBytes("u32",plan.nextPointerRaw),next:MemoryUtils.valueBytes("u32",plan.pointerRaw)}];
      if(plan.allocation!==null)patches.unshift({offset:plan.allocation,expected:plan.allocationBytes,next:MemoryUtils.filled(plan.length)});
      MemoryUtils.replaceAll(this.memory,patches);
      if(plan.reservation)this.allocator.ledger.release(plan.reservation);return plan;
    }
  }
  global.GbaConnectionTableWriter=GbaConnectionTableWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbaConnectionTableWriter=GbaConnectionTableWriter;
})(globalThis);
