(function(global){
  "use strict";
  const TABLES=Object.freeze({
    Warp:Object.freeze({property:"warps",Record:Gen2WarpEvent}),
    Coordinate:Object.freeze({property:"coordinates",Record:Gen2CoordEvent}),
    Background:Object.freeze({property:"backgrounds",Record:Gen2BgEvent}),
    Object:Object.freeze({property:"objects",Record:Gen2ObjectEvent})
  });
  class Gen2EventBlockWriter{
    constructor(memory){
      if(!(memory instanceof Gen2Memory))throw new TypeError("Gen2EventBlockWriter requires Gen2Memory.");
      this.memory=memory;this.allocator=new RomAllocator(memory);
    }
    table(kind){const table=TABLES[kind];if(!table)throw new RangeError(`Unsupported Gen II event kind '${kind}'.`);return table;}
    encode(events,{insert,remove}={}){
      if(!events)throw new TypeError("A decoded Gen II event block is required.");
      const parts=[this.memory.slice(events.offset,2)];
      for(const [kind,{property,Record}] of Object.entries(TABLES)){
        const records=events[property].filter((_,index)=>!remove||remove.kind!==kind||remove.index!==index).map(event=>this.memory.slice(event.offset,Record.SIZE));
        if(insert?.kind===kind)records.push(insert.bytes);
        if(records.length>255)throw new RangeError("Gen II event groups support at most 255 entries.");
        parts.push(Uint8Array.of(records.length),...records);
      }
      const length=parts.reduce((sum,part)=>sum+part.length,0),bytes=new Uint8Array(length);let cursor=0;
      for(const part of parts){bytes.set(part,cursor);cursor+=part.length;}return bytes;
    }
    plan({attributes,events,nextBytes}){
      if(!attributes||!events)throw new TypeError("Gen II attributes and events are required.");
      if(!(nextBytes instanceof Uint8Array)||nextBytes.length<6)throw new RangeError("Invalid Gen II event block.");
      const bank=attributes.scriptsBank,bankStart=bank*Gen2Memory.BANK_SIZE,bankEnd=Math.min(this.memory.size,bankStart+Gen2Memory.BANK_SIZE);
      const reservation=this.allocator.reserve(nextBytes.length,{start:bankStart,end:bankEnd,alignment:1,minimumRun:Math.max(32,nextBytes.length),owner:`gen2:event-block:0x${(attributes.offset+9).toString(16)}`,reason:"Relocated Gen II event block"});
      const allocation=reservation.offset;
      const nextAddress=bank===0?allocation:0x4000+allocation-bankStart;
      if(nextAddress<0||nextAddress>0x7fff)throw new RangeError("Relocated Gen II event block cannot be represented by its near pointer.");
      return Object.freeze({pointerOffset:attributes.offset+9,previousAddress:attributes.eventsAddress,previousOffset:events.offset,bank,nextBytes:nextBytes.slice(),allocation,reservation,nextAddress});
    }
    insert(attributes,events,kind,bytes){
      const {Record}=this.table(kind);
      if(!(bytes instanceof Uint8Array)||bytes.length!==Record.SIZE)throw new RangeError(`A Gen II ${kind} entry requires ${Record.SIZE} bytes.`);
      return this.plan({attributes,events,nextBytes:this.encode(events,{insert:{kind,bytes}})});
    }
    remove(attributes,events,kind,index){
      const {property}=this.table(kind),records=events[property];
      if(!Number.isInteger(index)||index<0||index>=records.length)throw new RangeError("Removal index is outside the Gen II event table.");
      return this.plan({attributes,events,nextBytes:this.encode(events,{remove:{kind,index}})});
    }
    apply(plan){
      this.allocator.ledger.acquire(plan.reservation);
      try{MemoryUtils.replaceAll(this.memory,[
        {offset:plan.allocation,expected:MemoryUtils.filled(plan.nextBytes.length),next:plan.nextBytes},
        {offset:plan.pointerOffset,expected:MemoryUtils.valueBytes("u16",plan.previousAddress),next:MemoryUtils.valueBytes("u16",plan.nextAddress)}
      ]);}
      catch(error){this.allocator.ledger.release(plan.reservation);throw error;}
      return plan;
    }
    restore(plan){
      MemoryUtils.replaceAll(this.memory,[
        {offset:plan.allocation,expected:plan.nextBytes,next:MemoryUtils.filled(plan.nextBytes.length)},
        {offset:plan.pointerOffset,expected:MemoryUtils.valueBytes("u16",plan.nextAddress),next:MemoryUtils.valueBytes("u16",plan.previousAddress)}
      ]);
      this.allocator.ledger.release(plan.reservation);return plan;
    }
    entry(kind,{x=0,y=0,mapGroup=1,mapNumber=1}={}){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>251||y>251)throw new RangeError("Gen II event coordinates must be inside 0..251.");
      if(kind==="Warp")return Uint8Array.of(y,x,1,mapGroup,mapNumber);
      if(kind==="Coordinate")return Uint8Array.of(0,y,x,0,0,0,0,0);
      if(kind==="Background")return Uint8Array.of(y,x,0,0,0);
      if(kind==="Object")return Uint8Array.of(1,y+4,x+4,0,0,0xff,0xff,0,0,0,0,0xff,0xff);
      throw new RangeError(`Unsupported Gen II event kind '${kind}'.`);
    }
  }
  global.Gen2EventBlockWriter=Gen2EventBlockWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).Gen2EventBlockWriter=Gen2EventBlockWriter;
})(globalThis);
