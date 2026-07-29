(function(global){
  "use strict";
  class GbcEventBlockWriter{
    constructor(memory){if(!(memory instanceof GbcMemory))throw new TypeError("GbcEventBlockWriter requires GbcMemory.");this.memory=memory;this.allocator=new RomAllocator(memory);}
    encode(events,{insert,remove}={}){
      if(!events)throw new TypeError("A decoded Gen I object block is required.");
      const keep=(kind,index)=>!remove||remove.kind!==kind||remove.index!==index,parts=[Uint8Array.of(events.border)];
      const warps=events.warps.filter((_,index)=>keep("Warp",index)).map(event=>this.memory.slice(event.offset,event.size||GbcWarpEvent.SIZE));
      const backgrounds=events.backgrounds.filter((_,index)=>keep("Sign",index)).map(event=>this.memory.slice(event.offset,event.size||GbcBgEvent.SIZE));
      const objects=events.objects.filter((_,index)=>keep("Object",index)).map(event=>this.memory.slice(event.offset,event.size));
      if(insert?.kind==="Warp")warps.push(insert.bytes);if(insert?.kind==="Sign")backgrounds.push(insert.bytes);if(insert?.kind==="Object")objects.push(insert.bytes);
      for(const list of [warps,backgrounds,objects])if(list.length>255)throw new RangeError("Gen I event groups support at most 255 entries.");
      parts.push(Uint8Array.of(warps.length),...warps,Uint8Array.of(backgrounds.length),...backgrounds,Uint8Array.of(objects.length),...objects);
      const length=parts.reduce((total,part)=>total+part.length,0),result=new Uint8Array(length);let cursor=0;for(const part of parts){result.set(part,cursor);cursor+=part.length;}return result;
    }
    plan({header,events,nextBytes}){
      const pointerOffset=header.offset+header.size-2,previousPointerRaw=this.memory.u16(pointerOffset),bankStart=header.bank*0x4000,bankEnd=Math.min(this.memory.size,bankStart+0x4000);
      const reservation=this.allocator.reserve(nextBytes.length,{start:bankStart,end:bankEnd,alignment:1,minimumRun:Math.max(32,nextBytes.length),owner:`gen1:event-block:0x${pointerOffset.toString(16)}`,reason:"Relocated Gen I object block"});
      const allocation=reservation.offset;
      return Object.freeze({pointerOffset,previousPointerRaw,previousOffset:events.offset,nextBytes:nextBytes.slice(),allocation,reservation,nextPointerRaw:header.bank===0?allocation:0x4000+(allocation-bankStart)});
    }
    insert(header,events,kind,bytes){return this.plan({header,events,nextBytes:this.encode(events,{insert:{kind,bytes}})});}
    remove(header,events,kind,index){return this.plan({header,events,nextBytes:this.encode(events,{remove:{kind,index}})});}
    apply(plan){
      this.allocator.ledger.acquire(plan.reservation);
      try{MemoryUtils.replaceAll(this.memory,[
        {offset:plan.allocation,expected:MemoryUtils.filled(plan.nextBytes.length),next:plan.nextBytes},
        {offset:plan.pointerOffset,expected:MemoryUtils.valueBytes("u16",plan.previousPointerRaw),next:MemoryUtils.valueBytes("u16",plan.nextPointerRaw)}
      ]);}
      catch(error){this.allocator.ledger.release(plan.reservation);throw error;}
      return plan;
    }
    restore(plan){
      MemoryUtils.replaceAll(this.memory,[
        {offset:plan.allocation,expected:plan.nextBytes,next:MemoryUtils.filled(plan.nextBytes.length)},
        {offset:plan.pointerOffset,expected:MemoryUtils.valueBytes("u16",plan.nextPointerRaw),next:MemoryUtils.valueBytes("u16",plan.previousPointerRaw)}
      ]);
      this.allocator.ledger.release(plan.reservation);return plan;
    }
    entry(kind,{x=0,y=0}={}){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>251||y>251)throw new RangeError("Gen I event coordinates must be inside 0..251.");
      if(kind==="Warp")return Uint8Array.of(y,x,0,0);
      if(kind==="Sign")return Uint8Array.of(y,x,0);
      if(kind==="Object")return Uint8Array.of(1,y+4,x+4,0xff,0,0);
      throw new RangeError(`Unsupported Gen I event kind '${kind}'.`);
    }
  }
  global.GbcEventBlockWriter=GbcEventBlockWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbcEventBlockWriter=GbcEventBlockWriter;
})(globalThis);
