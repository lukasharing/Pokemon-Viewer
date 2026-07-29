(function(global){
  "use strict";

  const ledgers=new WeakMap();
  let nextReservationId=1;

  class AllocationLedger{
    constructor(memory){
      if(!(memory instanceof RomMemory))throw new TypeError("AllocationLedger requires RomMemory.");
      this.memory=memory;
      this.ranges=new Map();
    }

    static forMemory(memory){
      if(!(memory instanceof RomMemory))throw new TypeError("AllocationLedger requires RomMemory.");
      if(!ledgers.has(memory))ledgers.set(memory,new AllocationLedger(memory));
      return ledgers.get(memory);
    }

    normalize(offset,length){
      this.memory.assertRange(offset,length);
      if(!Number.isInteger(length)||length<1)throw new RangeError("Allocation ranges require a positive length.");
      return{offset,length,end:offset+length};
    }

    overlaps(offset,length,{excludeId=null,excludeIds=null}={}){
      const range=this.normalize(offset,length);
      const excluded=excludeIds instanceof Set?excludeIds:new Set();
      return[...this.ranges.values()].filter(entry=>entry.id!==excludeId&&!excluded.has(entry.id)&&range.offset<entry.end&&entry.offset<range.end);
    }

    assertAvailable(offset,length,{excludeId=null,excludeIds=null}={}){
      const conflicts=this.overlaps(offset,length,{excludeId,excludeIds});
      if(conflicts.length){
        const conflict=conflicts[0];
        throw new RangeError(`ROM range 0x${offset.toString(16)}..0x${(offset+length).toString(16)} overlaps ${conflict.kind} '${conflict.owner}'.`);
      }
    }

    add({offset,length,owner,kind="owned",reason="",scope=null}){
      if(typeof owner!=="string"||!owner.trim())throw new TypeError("Allocation ranges require a stable owner.");
      const range=this.normalize(offset,length);
      this.assertAvailable(range.offset,range.length);
      const id=`rom-range-${nextReservationId++}`;
      const entry={id,...range,owner:owner.trim(),kind,reason:String(reason||""),scope:scope==null?null:String(scope),active:true};
      this.ranges.set(id,entry);
      return Object.freeze({id,offset:entry.offset,length:entry.length,owner:entry.owner,kind:entry.kind,reason:entry.reason,scope:entry.scope});
    }

    protect(offset,length,{owner,reason=""}={}){
      return this.add({offset,length,owner,kind:"protected",reason});
    }

    own(offset,length,{owner,reason=""}={}){
      return this.add({offset,length,owner,kind:"owned",reason});
    }

    reserve(offset,length,{owner,reason=""}={}){
      return this.add({offset,length,owner,kind:"reservation",reason});
    }

    syncProtected(scope,ranges,{owner=`scope:${scope}`,reason="Verified resource range"}={}){
      if(typeof scope!=="string"||!scope.trim())throw new TypeError("Protected-range synchronization requires a scope.");
      if(!Array.isArray(ranges))throw new TypeError("Protected-range synchronization requires an array.");
      const normalized=ranges.map(range=>this.normalize(Number(range.offset),Number(range.length))).sort((a,b)=>a.offset-b.offset||a.end-b.end);
      const merged=[];
      for(const range of normalized){
        const previous=merged.at(-1);
        if(previous&&range.offset<=previous.end)previous.end=Math.max(previous.end,range.end),previous.length=previous.end-previous.offset;
        else merged.push({...range});
      }
      const old=[...this.ranges.values()].filter(entry=>entry.kind==="protected"&&entry.scope===scope);
      const oldIds=new Set(old.map(entry=>entry.id));
      for(const range of merged){
        const conflicts=this.overlaps(range.offset,range.length,{excludeIds:oldIds}).filter(entry=>
          entry.kind!=="reservation"||entry.offset<range.offset||entry.end>range.end
        );
        if(conflicts.length){
          const conflict=conflicts[0];
          throw new RangeError(`Verified scope '${scope}' overlaps ${conflict.kind} '${conflict.owner}'.`);
        }
      }
      for(const entry of old)this.ranges.delete(entry.id);
      const handles=[];
      for(const range of merged){
        const id=`rom-range-${nextReservationId++}`;
        const entry={id,...range,owner,kind:"protected",reason:String(reason||""),scope,active:true};
        this.ranges.set(id,entry);
        handles.push(Object.freeze({id,offset:entry.offset,length:entry.length,owner:entry.owner,kind:entry.kind,reason:entry.reason,scope}));
      }
      return Object.freeze(handles);
    }

    acquire(handle){
      const current=this.entry(handle);
      if(current)return handle;
      if(!handle||handle.kind!=="reservation")throw new TypeError("Only a reservation can be reacquired.");
      this.assertAvailable(handle.offset,handle.length);
      const entry={...handle,end:handle.offset+handle.length,active:true};
      this.ranges.set(handle.id,entry);
      return handle;
    }

    release(handle){
      if(!handle?.id)return false;
      const current=this.ranges.get(handle.id);
      if(!current)return false;
      if(current.kind!=="reservation")throw new RangeError(`Cannot release ${current.kind} range '${current.owner}'.`);
      this.ranges.delete(handle.id);
      return true;
    }

    entry(handle){return handle?.id?this.ranges.get(handle.id)||null:null;}
    snapshot(){return Object.freeze([...this.ranges.values()].map(({end,active,...entry})=>Object.freeze({...entry})));}
  }

  class RomAllocator{
    constructor(memory){
      if(!(memory instanceof RomMemory))throw new TypeError("RomAllocator requires RomMemory.");
      this.memory=memory;
      this.ledger=AllocationLedger.forMemory(memory);
    }

    find(length,{fill=0xff,alignment=4,start=0,end=this.memory.size,minimumRun=32}={}){
      if(!Number.isInteger(length)||length<1)throw new RangeError("Allocation length must be a positive integer.");
      if(!Number.isInteger(alignment)||alignment<1)throw new RangeError("Allocation alignment must be positive.");
      let runStart=-1,candidate=null;
      const bytes=this.memory.bytes;
      const consider=runEnd=>{
        if(runStart<0)return;
        let aligned=Math.ceil(runStart/alignment)*alignment;
        while(runEnd-runStart>=Math.max(length,minimumRun)&&aligned+length<=runEnd){
          if(!this.ledger.overlaps(aligned,length).length){candidate=aligned;return;}
          const conflict=this.ledger.overlaps(aligned,length)[0];
          aligned=Math.ceil(conflict.end/alignment)*alignment;
        }
      };
      const limit=Math.min(this.memory.size,end);
      for(let offset=Math.max(0,start);offset<=limit;offset++){
        if(offset<limit&&bytes[offset]===fill){if(runStart<0)runStart=offset;}
        else{consider(offset);runStart=-1;}
      }
      if(candidate===null)throw new RangeError(`No aligned ${length}-byte unowned free-space region was found.`);
      return candidate;
    }

    reserve(length,{owner,reason="",...options}={}){
      if(typeof owner!=="string"||!owner.trim())throw new TypeError("Allocations require a stable owner.");
      const offset=this.find(length,options);
      return this.ledger.reserve(offset,length,{owner,reason});
    }
  }

  global.AllocationLedger=AllocationLedger;
  global.RomAllocator=RomAllocator;
  const core=((global.PokemonViewer ||= {}).core ||= {});
  core.AllocationLedger=AllocationLedger;
  core.RomAllocator=RomAllocator;
})(globalThis);
