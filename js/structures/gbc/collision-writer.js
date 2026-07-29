(function(global){
  "use strict";

  class GbcCollisionTableWriter{
    static TERMINATOR=0xff;
    static MAX_TILES=0xff;

    constructor(memory){
      if(!(memory instanceof GbcMemory))throw new TypeError("GbcCollisionTableWriter requires GbcMemory.");
      this.memory=memory;
      this.patch=new RelocatablePatch(memory);
    }

    read(offset,{limit=this.constructor.MAX_TILES}={}){
      this.memory.assertRange(offset,1);
      const tiles=[];
      for(let index=0;index<=limit;index++){
        if(!this.memory.contains(offset+index))throw new RangeError("Gen I collision table has no FF terminator.");
        const value=this.memory.u8(offset+index);
        if(value===this.constructor.TERMINATOR)return Object.freeze({offset,length:index+1,tiles:Object.freeze(tiles)});
        tiles.push(value);
      }
      throw new RangeError("Gen I collision table exceeds its 255-tile safety limit.");
    }

    encode(values){
      if(!values||typeof values[Symbol.iterator]!=="function")throw new TypeError("Gen I collision tiles must be iterable.");
      const tiles=[...new Set(Array.from(values,value=>{
        if(!Number.isInteger(value)||value<0||value>=this.constructor.TERMINATOR)throw new RangeError("Gen I passable tile IDs must be 0..254.");
        return value;
      }))].sort((a,b)=>a-b);
      if(tiles.length>this.constructor.MAX_TILES)throw new RangeError("Gen I collision table contains too many tile IDs.");
      return Uint8Array.of(...tiles,this.constructor.TERMINATOR);
    }

    plan({tileset,tiles}){
      if(!tileset||!Number.isInteger(tileset.collision)||!Number.isInteger(tileset.offset)||!Number.isInteger(tileset.bank))throw new TypeError("A resolved Gen I tileset is required.");
      const previous=this.read(tileset.collision),nextBytes=this.encode(tiles);
      const patch=this.patch.plan({
        offset:previous.offset,previousLength:previous.length,nextBytes,
        reference:{kind:"gbc16",pointerOffset:tileset.offset+5,bank:tileset.bank}
      });
      return Object.freeze({tileset:Object.freeze({...tileset}),previous,nextTiles:Object.freeze(Array.from(nextBytes.subarray(0,-1))),patch});
    }

    apply(plan){return this.patch.apply(plan.patch);}
    restore(plan){return this.patch.restore(plan.patch);}
  }

  global.GbcCollisionTableWriter=GbcCollisionTableWriter;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbcCollisionTableWriter=GbcCollisionTableWriter;
})(globalThis);
