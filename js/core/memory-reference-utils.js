(function(global){
  "use strict";

  /**
   * Creates portable editor links from the pointer formats stored in a ROM.
   * Consumers receive both the resolved ROM offset and the reference descriptor
   * needed by RelocatablePatch; they do not need to duplicate bank arithmetic.
   */
  class MemoryReferenceUtils{
    static link(offset,reference,{kind="resource",label="Open resource",source}={}){
      if(!Number.isInteger(offset)||offset<0)throw new RangeError("A memory link requires a valid ROM offset.");
      return Object.freeze({offset,reference:Object.freeze({...reference}),kind,label,source});
    }

    static gen2Near(memory,pointerOffset,bank,options={}){
      memory.assertRange(pointerOffset,2);
      const address=memory.u16(pointerOffset),offset=memory.banked(bank,address);
      return this.link(offset,{kind:"gen2Near",pointerOffset,bank},{
        source:pointerOffset,...options
      });
    }

    static gen2Far(memory,bankOffset,addressOffset,options={}){
      memory.assertRange(bankOffset,1);memory.assertRange(addressOffset,2);
      const bank=memory.u8(bankOffset),address=memory.u16(addressOffset),offset=memory.banked(bank,address);
      return this.link(offset,{kind:"gen2Far",bankOffset,addressOffset},{
        source:bankOffset,...options
      });
    }

    static gba(memory,pointerOffset,options={}){
      memory.assertRange(pointerOffset,4);
      const offset=memory.pointer(pointerOffset);
      if(offset===null)throw new RangeError("The GBA pointer does not target this ROM.");
      return this.link(offset,{kind:"gba32",pointerOffset},{source:pointerOffset,...options});
    }

    static try(create){
      try{return create();}catch{return null;}
    }
  }

  global.MemoryReferenceUtils=MemoryReferenceUtils;
  ((global.PokemonViewer||={}).core||={}).MemoryReferenceUtils=MemoryReferenceUtils;
})(globalThis);
