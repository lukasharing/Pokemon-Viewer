(function(global){
  "use strict";
  const DIRECTIONS=Object.freeze([["north",8],["south",4],["west",2],["east",1]]);
  class GbcConnectionHeaderWriter{
    constructor(memory){if(!(memory instanceof GbcMemory))throw new TypeError("GbcConnectionHeaderWriter requires GbcMemory.");this.memory=memory;this.allocator=new RomAllocator(memory);}
    encodeRecord(connection){
      const bytes=new Uint8Array(GbcMapHeader.CONNECTION_SIZE),view=new DataView(bytes.buffer);
      const u8=["mapId","length","width"],u16=["blocksAddress","mapAddress","windowAddress"],s8=["y","x"];
      for(const key of u8)if(!Number.isInteger(connection[key])||connection[key]<0||connection[key]>255)throw new RangeError(`${key} must be 0..255.`);
      for(const key of u16)if(!Number.isInteger(connection[key])||connection[key]<0||connection[key]>0xffff)throw new RangeError(`${key} must be 0..65535.`);
      for(const key of s8)if(!Number.isInteger(connection[key])||connection[key]<-128||connection[key]>127)throw new RangeError(`${key} must be -128..127.`);
      view.setUint8(0,connection.mapId);view.setUint16(1,connection.blocksAddress,true);view.setUint16(3,connection.mapAddress,true);view.setUint8(5,connection.length);view.setUint8(6,connection.width);view.setInt8(7,connection.y);view.setInt8(8,connection.x);view.setUint16(9,connection.windowAddress,true);return bytes;
    }
    encodeHeader(header,connections){
      const ordered=DIRECTIONS.flatMap(([direction])=>connections.filter(item=>item.direction===direction));
      if(ordered.length!==connections.length||new Set(ordered.map(item=>item.direction)).size!==ordered.length)throw new RangeError("Gen I supports one connection per cardinal direction.");
      const bytes=new Uint8Array(GbcMapHeader.BASE_SIZE+ordered.length*GbcMapHeader.CONNECTION_SIZE+2),flags=ordered.reduce((value,item)=>value|DIRECTIONS.find(([name])=>name===item.direction)[1],0);
      bytes.set(this.memory.slice(header.offset,GbcMapHeader.BASE_SIZE),0);bytes[9]=flags;let cursor=GbcMapHeader.BASE_SIZE;
      for(const connection of ordered){bytes.set(this.encodeRecord(connection),cursor);cursor+=GbcMapHeader.CONNECTION_SIZE;}
      const objectRaw=this.memory.u16(header.offset+header.size-2);new DataView(bytes.buffer).setUint16(cursor,objectRaw,true);return bytes;
    }
    plan({header,pointerOffset,connections}){
      const nextBytes=this.encodeHeader(header,connections),bankStart=header.bank*GbcMemory.BANK_SIZE,bankEnd=Math.min(this.memory.size,bankStart+GbcMemory.BANK_SIZE);
      const reservation=this.allocator.reserve(nextBytes.length,{start:bankStart,end:bankEnd,alignment:1,minimumRun:Math.max(32,nextBytes.length),owner:`gen1:connections:0x${pointerOffset.toString(16)}`,reason:"Relocated Gen I map header"});
      const allocation=reservation.offset;
      const nextPointerRaw=header.bank===0?allocation:0x4000+allocation-bankStart;
      return Object.freeze({header,pointerOffset,previousPointerRaw:this.memory.u16(pointerOffset),nextBytes,connections:Object.freeze(connections.map(item=>Object.freeze({...item}))),allocation,reservation,nextPointerRaw});
    }
    insert(options,connection){if(options.header.connections.some(item=>item.direction===connection.direction))throw new RangeError(`A ${connection.direction} connection already exists.`);return this.plan({...options,connections:[...options.header.connections,connection]});}
    remove(options,index){if(index<0||index>=options.header.connections.length)throw new RangeError("Connection removal index is outside the header.");return this.plan({...options,connections:options.header.connections.filter((_,position)=>position!==index)});}
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
  }
  global.GbcConnectionHeaderWriter=GbcConnectionHeaderWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbcConnectionHeaderWriter=GbcConnectionHeaderWriter;
})(globalThis);
