(function(global){
  "use strict";

  class RelocatablePatch{
    constructor(memory){
      if(!(memory instanceof RomMemory))throw new TypeError("RelocatablePatch requires RomMemory.");
      this.memory=memory;
      this.allocator=new RomAllocator(memory);
    }

    pointerBytes(reference,target){
      if(reference.kind==="gba32"){
        if(typeof global.GbaMemory!=="function"||!(this.memory instanceof global.GbaMemory))throw new TypeError("A GBA pointer requires GbaMemory.");
        return this.u32(global.GbaMemory.ROM_BASE+target);
      }
      if(reference.kind==="gbc16"){
        if(typeof global.GbcMemory!=="function"||!(this.memory instanceof global.GbcMemory))throw new TypeError("A banked pointer requires GbcMemory.");
        const bank=Math.floor(target/global.GbcMemory.BANK_SIZE);
        if(bank!==reference.bank)throw new RangeError("A Gen I near pointer cannot leave its ROM bank.");
        return this.u16(bank===0?target:0x4000+target-bank*global.GbcMemory.BANK_SIZE);
      }
      if(reference.kind==="gbcFar"){
        if(typeof global.GbcMemory!=="function"||!(this.memory instanceof global.GbcMemory))throw new TypeError("A far pointer requires GbcMemory.");
        const bank=Math.floor(target/global.GbcMemory.BANK_SIZE),address=bank===0?target:0x4000+target-bank*global.GbcMemory.BANK_SIZE;
        if(bank>0xff)throw new RangeError("The relocated target is outside the Gen I bank range.");
        return Uint8Array.of(address&0xff,address>>>8&0xff,bank);
      }
      if(reference.kind==="gen2Far"){
        if(typeof global.Gen2Memory!=="function"||!(this.memory instanceof global.Gen2Memory))throw new TypeError("A Gen II far pointer requires Gen2Memory.");
        const bank=Math.floor(target/global.Gen2Memory.BANK_SIZE),address=bank===0?target:0x4000+target-bank*global.Gen2Memory.BANK_SIZE;
        if(bank>0xff)throw new RangeError("The relocated target is outside the Gen II bank range.");
        return Uint8Array.of(bank,address&0xff,address>>>8&0xff);
      }
      if(reference.kind==="gen2Near"){
        if(typeof global.Gen2Memory!=="function"||!(this.memory instanceof global.Gen2Memory))throw new TypeError("A Gen II near pointer requires Gen2Memory.");
        const bank=Math.floor(target/global.Gen2Memory.BANK_SIZE);
        if(bank!==reference.bank)throw new RangeError("A Gen II near pointer cannot leave its ROM bank.");
        return this.u16(bank===0?target:0x4000+target-bank*global.Gen2Memory.BANK_SIZE);
      }
      throw new RangeError(`Unknown relocatable pointer kind '${reference.kind}'.`);
    }

    referenceRanges(reference){
      if(reference.kind==="gba32")return[{offset:reference.pointerOffset,length:4}];
      if(reference.kind==="gbc16")return[{offset:reference.pointerOffset,length:2}];
      if(reference.kind==="gbcFar")return[{offset:reference.addressOffset,length:2},{offset:reference.bankOffset,length:1}];
      if(reference.kind==="gen2Far")return[{offset:reference.bankOffset,length:1},{offset:reference.addressOffset,length:2}];
      if(reference.kind==="gen2Near")return[{offset:reference.pointerOffset,length:2}];
      throw new RangeError(`Unknown relocatable pointer kind '${reference.kind}'.`);
    }

    allocationOptions(reference){
      if(reference.kind==="gbc16"||reference.kind==="gen2Near"){
        const size=reference.kind==="gbc16"?global.GbcMemory.BANK_SIZE:global.Gen2Memory.BANK_SIZE,start=reference.bank*size;
        return{start,end:Math.min(this.memory.size,start+size),alignment:1};
      }
      const gba=typeof global.GbaMemory==="function"&&this.memory instanceof global.GbaMemory;
      return{start:gba&&this.memory.size>0x100000?0x100000:0,alignment:gba?4:1};
    }

    plan({offset,previousLength,nextBytes,reference,allocation=null}){
      if(!(nextBytes instanceof Uint8Array)||!nextBytes.length)throw new RangeError("A patch must contain at least one byte.");
      this.memory.assertRange(offset,previousLength);
      if(nextBytes.length<=previousLength){
        const previous=this.memory.slice(offset,previousLength),replacement=new Uint8Array(previousLength);replacement.fill(0xff);replacement.set(nextBytes);
        return Object.freeze({relocated:false,offset,target:offset,previousLength,nextBytes:replacement,sourceBytes:previous});
      }
      if(!reference)throw new RangeError(`Compiled output is ${nextBytes.length} bytes; ${previousLength} bytes are available and no owning pointer was supplied.`);
      const ranges=this.referenceRanges(reference);for(const range of ranges)this.memory.assertRange(range.offset,range.length);
      const bounds=this.allocationOptions(reference),options=allocation||{};
      const start=Math.max(bounds.start??0,options.start??bounds.start??0),end=Math.min(bounds.end??this.memory.size,options.end??bounds.end??this.memory.size);
      const allocationFill=options.fill??0xff;
      const pointerOwner=reference.pointerOffset??reference.addressOffset??reference.bankOffset;
      const owner=options.owner||`relocatable:${reference.kind}:0x${pointerOwner.toString(16)}`;
      const reservation=this.allocator.reserve(nextBytes.length,{...bounds,start,end,fill:allocationFill,minimumRun:Math.max(options.minimumRun??32,nextBytes.length),owner,reason:options.reason||`Relocation of 0x${offset.toString(16)}`});
      const target=reservation.offset;
      const pointerBytes=this.pointerBytes(reference,target),pointerPrevious=ranges.map(range=>this.memory.slice(range.offset,range.length));
      return Object.freeze({relocated:true,offset,target,previousLength,nextBytes:nextBytes.slice(),allocationFill,reservation,reference:Object.freeze({...reference}),ranges:Object.freeze(ranges),pointerBytes,pointerPrevious:Object.freeze(pointerPrevious)});
    }

    applyPatches(plan){
      if(!plan.relocated)return[{offset:plan.offset,expected:plan.sourceBytes,next:plan.nextBytes}];
      return[
        {offset:plan.target,expected:MemoryUtils.filled(plan.nextBytes.length,plan.allocationFill??0xff),next:plan.nextBytes},
        ...this.pointerPatches(plan,plan.pointerPrevious,plan.pointerBytes)
      ];
    }

    restorePatches(plan){
      if(!plan.relocated)return[{offset:plan.offset,expected:plan.nextBytes,next:plan.sourceBytes}];
      return[
        {offset:plan.target,expected:plan.nextBytes,next:MemoryUtils.filled(plan.nextBytes.length,plan.allocationFill??0xff)},
        ...this.pointerPatches(plan,plan.pointerBytes,plan.pointerPrevious)
      ];
    }

    apply(plan,additional=[]){
      if(plan.relocated)this.allocator.ledger.acquire(plan.reservation);
      try{MemoryUtils.replaceAll(this.memory,[...this.applyPatches(plan),...additional]);}
      catch(error){if(plan.relocated)this.allocator.ledger.release(plan.reservation);throw error;}
      return plan.target;
    }

    restore(plan,additional=[]){
      MemoryUtils.replaceAll(this.memory,[...this.restorePatches(plan),...additional]);
      if(plan.relocated)
      this.allocator.ledger.release(plan.reservation);
      return plan.offset;
    }

    pointerPatches(plan,expected,next){
      const split=plan.reference.kind==="gbcFar"||plan.reference.kind==="gen2Far";
      const divide=value=>{
        if(Array.isArray(value))return value;
        if(!split)return[value];
        const width=plan.reference.kind==="gbcFar"?2:1;
        return[value.slice(0,width),value.slice(width,3)];
      };
      const previous=divide(expected),replacement=divide(next);
      return plan.ranges.map((range,index)=>({offset:range.offset,expected:previous[index],next:replacement[index]}));
    }

    writePointer(plan,value){
      if(plan.reference.kind==="gbcFar"||plan.reference.kind==="gen2Far"){
        const split=plan.reference.kind==="gbcFar"?2:1;
        const parts=Array.isArray(value)?value:[value.slice(0,split),value.slice(split,3)];
        MemoryUtils.patch(this.memory,plan.ranges.map((range,index)=>({offset:range.offset,bytes:parts[index]})));
      }else MemoryUtils.writeBytes(this.memory,plan.ranges[0].offset,Array.isArray(value)?value[0]:value);
    }

    u16(value){return Uint8Array.of(value&0xff,value>>>8&0xff);}
    u32(value){return Uint8Array.of(value&0xff,value>>>8&0xff,value>>>16&0xff,value>>>24&0xff);}
  }

  global.RelocatablePatch=RelocatablePatch;
  ((global.PokemonViewer ||= {}).core ||= {}).RelocatablePatch=RelocatablePatch;
})(globalThis);
