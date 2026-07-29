(function(global){
  "use strict";

  class RomPatch{
    static bytes(value,{name="Bytes",length}={}){
      const compact=String(value??"").trim().replace(/\s+/g,"");
      if(!compact||compact.length%2||!/^[0-9a-f]+$/i.test(compact))throw new SyntaxError(`${name} must contain complete hexadecimal byte pairs.`);
      const bytes=Uint8Array.from(compact.match(/../g),pair=>Number.parseInt(pair,16));
      if(length!==undefined&&bytes.length!==length)throw new RangeError(`${name} must contain exactly ${length} bytes.`);
      return bytes;
    }

    static plan(reader,payload){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array)||!reader.memory)throw new Error("Load a ROM before importing a change report.");
      if(!payload||payload.format!=="push-byte-patch")throw new TypeError("This is not a PUSH change report.");
      const version=CoreUtils.integer(payload.version,{name:"Patch version",min:1,max:4});
      if(payload.family&&payload.family!==reader.family)throw new Error(`This report targets ${payload.family.toUpperCase()}, not the loaded ${reader.family.toUpperCase()} ROM.`);
      if(payload.project)ProjectIdentity.assertCompatible(payload.project,reader);
      if(!Array.isArray(payload.ranges)||!payload.ranges.length)throw new Error("The report contains no byte changes.");
      if(payload.ranges.length>reader.size)throw new RangeError("The report contains too many byte ranges.");

      const ranges=payload.ranges.map((range,index)=>{
        const name=`Range ${index+1}`,offset=CoreUtils.parseOffset(range?.offset,reader.size,{name:`${name} offset`});
        const length=CoreUtils.integer(range?.length,{name:`${name} length`,min:1,max:reader.size-offset});
        const previous=this.bytes(range.previous,{name:`${name} previous bytes`,length});
        const next=this.bytes(range.next,{name:`${name} replacement bytes`,length});
        return Object.freeze({offset,length,previous,next});
      }).sort((left,right)=>left.offset-right.offset);

      let end=0,total=0;
      for(const range of ranges){
        if(range.offset<end)throw new RangeError("Change-report ranges must not overlap.");
        end=range.offset+range.length;total+=range.length;
        if(!MemoryUtils.equals(reader.memory,range.offset,range.previous))throw new Error(`The loaded ROM does not match the report at ${MemoryUtils.hex(range.offset,6)}.`);
      }
      return Object.freeze({version,ranges:Object.freeze(ranges),total});
    }

    static refresh(reader,ranges){
      reader.hex_editor?.refresh?.();
      reader.code_editor?.refresh?.();
      reader.sprite_editor?.refresh?.();
      reader.map_editor?.refresh?.();
      if(typeof global.CustomEvent==="function")global.document?.dispatchEvent?.(new CustomEvent("romgraphicschange",{detail:{offsets:ranges.map(range=>range.offset),patch:true}}));
    }

    static apply(reader,payload){
      const plan=this.plan(reader,payload),stack=reader.history?.("report_import",{label:"Change Report"})||reader.project_commands;
      if(!stack?.execute)throw new Error("Project history is unavailable.");
      const write=(field,expected)=>{
        for(const range of plan.ranges)if(!MemoryUtils.equals(reader.memory,range.offset,range[expected]))throw new Error(`Project history conflicts with a later edit at ${MemoryUtils.hex(range.offset,6)}.`);
        for(const range of plan.ranges)MemoryUtils.writeBytes(reader.memory,range.offset,range[field]);
        this.refresh(reader,plan.ranges);
      };
      stack.execute({
        label:`Import ${plan.total} patched ${plan.total===1?"byte":"bytes"}`,
        description:`${plan.ranges.length} verified ${plan.ranges.length===1?"range":"ranges"}`,
        do:()=>write("next","previous"),
        undo:()=>write("previous","next")
      });
      return plan;
    }
  }

  global.RomPatch=RomPatch;
  ((global.PokemonViewer ||= {}).core ||= {}).RomPatch=RomPatch;
})(globalThis);
