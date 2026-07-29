(function(global){
  "use strict";
  class StructureWriter{
    constructor(memory){if(!(memory instanceof RomMemory))throw new TypeError("StructureWriter requires RomMemory.");this.memory=memory;}
    encode(type,value){
      const widths={u8:1,s8:1,u16:2,s16:2,u32:4,s32:4},width=widths[type];if(!width)throw new TypeError(`Unsupported field type '${type}'.`);
      const limit=2**(width*8),signed=type.startsWith("s"),minimum=signed?-(limit/2):0,maximum=signed?limit/2-1:limit-1;
      if(!Number.isInteger(value)||value<minimum||value>maximum)throw new RangeError(`${type} value ${value} is outside ${minimum}..${maximum}.`);
      const normalized=value<0?limit+value:value;return Uint8Array.from({length:width},(_,index)=>normalized>>>(index*8)&0xff);
    }
    write(offset,type,value){const bytes=this.encode(type,value);MemoryUtils.writeBytes(this.memory,offset,bytes);return bytes;}
    fields(base,schema,values){for(const [name,{offset=0,type}] of Object.entries(schema))if(values[name]!==undefined)this.write(base+offset,type,values[name]);return values;}
    command(stack,{label="Edit structure",description="",apply,undo}){
      return EditUtils.command(stack,{label,description,apply,undo});
    }
    replaceCommand(stack,{label="Edit structure",description="",patches,afterApply,afterUndo}){
      const replacements=Array.from(patches||[]).map(({offset,previous,next})=>{
        if(!(previous instanceof Uint8Array)||!(next instanceof Uint8Array)||previous.length!==next.length)throw new TypeError("Structure replacements require equally sized previous and next bytes.");
        this.memory.assertRange(offset,next.length);
        return Object.freeze({offset,previous,next});
      });
      if(!replacements.length)return false;
      const replace=(expected,next)=>MemoryUtils.replaceAll(this.memory,replacements.map(patch=>({
        offset:patch.offset,expected:patch[expected],next:patch[next]
      })),{message:"Structure changed after this command"});
      this.command(stack,{
        label,description,
        apply:()=>{replace("previous","next");afterApply?.();},
        undo:()=>{replace("next","previous");afterUndo?.();}
      });
      return true;
    }
    edit(stack,{base,schema,current,values,label="Edit structure",description="",afterWrite}){
      const state=EditUtils.values(schema,current,values);
      if(!state.changed)return false;
      for(const [name,{min,max}] of Object.entries(schema)){
        if(values[name]===undefined)continue;
        const value=state.next[name];
        if(!Number.isFinite(value)||(min!==undefined&&value<min)||(max!==undefined&&value>max)){
          throw new RangeError(`${name} value ${value} is outside ${min??"-∞"}..${max??"∞"}.`);
        }
      }
      const serialize=data=>Object.fromEntries(Object.entries(schema).map(([name,field])=>[
        name,field.serialize?field.serialize(data[name],data,current):data[name]
      ]));
      const previousBytes=serialize(state.previous),nextBytes=serialize(state.next);
      for(const [name,{type}] of Object.entries(schema)){this.encode(type,previousBytes[name]);this.encode(type,nextBytes[name]);}
      const patches=Object.entries(schema).map(([name,{offset=0,type}])=>{
        const target=base+offset,next=this.encode(type,nextBytes[name]),previous=this.encode(type,previousBytes[name]);
        return Object.freeze({offset:target,initial:this.memory.slice(target,next.length),previous,next});
      });
      const apply=(data,expected,stored)=>{
        MemoryUtils.replaceAll(this.memory,patches.map(patch=>({
          offset:patch.offset,expected:patch[expected],next:patch[stored]
        })));
        afterWrite?.(data);
      };
      let first=true;
      this.command(stack,{
        label,description,
        apply:()=>{apply(state.next,first?"initial":"previous","next");first=false;},
        undo:()=>apply(state.previous,"next","previous")
      });
      return true;
    }
  }
  global.StructureWriter=StructureWriter;((global.PokemonViewer ||= {}).structures ||= {}).Writer=StructureWriter;
})(globalThis);
