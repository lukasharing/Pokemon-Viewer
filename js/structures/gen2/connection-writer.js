(function(global){
  "use strict";

  class Gen2ConnectionWriter{
    constructor(memory){
      if(!(memory instanceof Gen2Memory))throw new TypeError("Gen2ConnectionWriter requires Gen2Memory.");
      this.memory=memory;
      this.patcher=new RelocatablePatch(memory);
    }

    normalize(connections){
      const byDirection=new Map();
      for(const connection of connections){
        const direction=Gen2ConnectionUtils.direction(connection.direction);
        if(byDirection.has(direction))throw new RangeError(`Crystal maps support one ${direction} connection.`);
        byDirection.set(direction,{...connection,direction});
      }
      return Gen2ConnectionUtils.NAMES.flatMap(direction=>byDirection.has(direction)?[byDirection.get(direction)]:[]);
    }

    encode(attributes,connections){
      if(!attributes||!Number.isInteger(attributes.offset))throw new TypeError("Decoded Gen II map attributes are required.");
      const ordered=this.normalize(connections),base=this.memory.slice(attributes.offset,Gen2MapAttributes.SIZE);
      base[11]=Gen2ConnectionUtils.mask(ordered);
      const bytes=new Uint8Array(base.length+ordered.length*Gen2MapConnection.SIZE);bytes.set(base);
      ordered.forEach((connection,index)=>bytes.set(
        connection.bytes instanceof Uint8Array?connection.bytes:Gen2ConnectionUtils.encode(connection),
        base.length+index*Gen2MapConnection.SIZE
      ));
      return bytes;
    }

    plan({entry,attributes,connections,previousCount=connections.length}){
      if(!entry||!Number.isInteger(entry.offset))throw new TypeError("The owning Gen II map-group entry is required.");
      const nextBytes=this.encode(attributes,connections);
      return this.patcher.plan({
        offset:attributes.offset,
        previousLength:Gen2MapAttributes.SIZE+previousCount*Gen2MapConnection.SIZE,
        nextBytes,
        reference:{kind:"gen2Far",bankOffset:entry.offset,addressOffset:entry.offset+3}
      });
    }

    insert(map,connection){
      if(!map?.attributes||!map?.entry)throw new TypeError("A decoded Gen II map is required.");
      return this.plan({entry:map.entry,attributes:map.attributes,connections:[...map.connections,connection],previousCount:map.connections.length});
    }

    remove(map,index){
      if(!Number.isInteger(index)||index<0||index>=map?.connections?.length)throw new RangeError("Connection index is outside the Crystal connection table.");
      return this.plan({entry:map.entry,attributes:map.attributes,connections:map.connections.filter((_,position)=>position!==index),previousCount:map.connections.length});
    }

    apply(plan){return this.patcher.apply(plan);}
    restore(plan){return this.patcher.restore(plan);}
  }

  global.Gen2ConnectionWriter=Gen2ConnectionWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).Gen2ConnectionWriter=Gen2ConnectionWriter;
})(globalThis);
