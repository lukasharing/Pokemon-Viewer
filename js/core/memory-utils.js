(function(global){
  "use strict";

  class MemoryUtils{
    static widths=Object.freeze({u8:1,s8:1,u16:2,s16:2,u24:3,u32:4,s32:4});

    static width(type){
      const width=this.widths[type];
      if(!width)throw new TypeError(`Unsupported memory type '${type}'.`);
      return width;
    }

    static read(memory,offset,type="u8",options={}){
      if(!(memory instanceof RomMemory))throw new TypeError("MemoryUtils requires RomMemory.");
      const method=memory[type];
      if(typeof method!=="function")throw new TypeError(`Unsupported memory type '${type}'.`);
      return method.call(memory,offset,options.littleEndian??true);
    }

    static write(memory,offset,type,value,{littleEndian=true}={}){
      if(!(memory instanceof RomMemory))throw new TypeError("MemoryUtils requires RomMemory.");
      const width=this.width(type);memory.assertRange(offset,width);
      const method={u8:"setUint8",s8:"setInt8",u16:"setUint16",s16:"setInt16",u32:"setUint32",s32:"setInt32"}[type];
      if(!method)throw new TypeError(`Memory type '${type}' is read-only.`);
      memory.view[method](offset,value,littleEndian);return value;
    }

    static bytes(memory,offset,length){return memory.slice(offset,length);}

    static valueBytes(type,value,{littleEndian=true}={}){
      const width=this.width(type),bytes=new Uint8Array(width),view=new DataView(bytes.buffer);
      const method={u8:"setUint8",s8:"setInt8",u16:"setUint16",s16:"setInt16",u32:"setUint32",s32:"setInt32"}[type];
      if(!method)throw new TypeError(`Memory type '${type}' cannot be encoded.`);
      view[method](0,value,littleEndian);return bytes;
    }

    static filled(length,value=0xff){
      if(!Number.isInteger(length)||length<0)throw new RangeError("Filled byte length must be a non-negative integer.");
      const bytes=new Uint8Array(length);bytes.fill(value);return bytes;
    }

    static writeBytes(memory,offset,bytes){
      if(!(bytes instanceof Uint8Array))throw new TypeError("Memory patch must be a Uint8Array.");
      memory.assertRange(offset,bytes.length);memory.bytes.set(bytes,offset);return bytes.length;
    }

    static patch(memory,entries){
      const patches=Array.from(entries||[]);
      for(const {offset,bytes} of patches){
        if(!(bytes instanceof Uint8Array))throw new TypeError("Every memory patch must contain Uint8Array bytes.");
        memory.assertRange(offset,bytes.length);
      }
      for(const {offset,bytes} of patches)memory.bytes.set(bytes,offset);
      return patches.length;
    }

    static replaceAll(memory,entries,{message="Memory changed after this command"}={}){
      if(!(memory instanceof RomMemory))throw new TypeError("MemoryUtils requires RomMemory.");
      const replacements=Array.from(entries||[]);
      for(const {offset,expected,next} of replacements){
        if(!(expected instanceof Uint8Array)||!(next instanceof Uint8Array)||expected.length!==next.length)throw new TypeError("Every replacement requires equally sized expected and next Uint8Arrays.");
        memory.assertRange(offset,next.length);
        if(!this.equals(memory,offset,expected))throw new Error(`${message} at ${this.hex(offset,6)}.`);
      }
      for(const {offset,next} of replacements)memory.bytes.set(next,offset);
      globalThis.ProjectIndexService?.patchMemory(memory,replacements.map(({offset,next})=>({offset,bytes:next})));
      return replacements.length;
    }

    static replace(memory,offset,expected,next,options){
      this.replaceAll(memory,[{offset,expected,next}],options);
      return next.length;
    }

    static equals(memory,offset,bytes){
      if(!(bytes instanceof Uint8Array)||!memory.contains(offset,bytes.length))return false;
      return bytes.every((value,index)=>memory.u8(offset+index)===value);
    }

    static find(memory,needle,{start=0,wrap=false}={}){
      if(!(memory instanceof RomMemory))throw new TypeError("MemoryUtils requires RomMemory.");
      if(!(needle instanceof Uint8Array)||!needle.length)throw new TypeError("Search pattern must be a non-empty Uint8Array.");
      const offset=CoreUtils.integer(start,{name:"Search start",min:0,max:memory.size});
      if(needle.length>memory.size)return null;
      const prefix=new Uint32Array(needle.length);
      for(let index=1,length=0;index<needle.length;){
        if(needle[index]===needle[length])prefix[index++]=++length;
        else if(length)length=prefix[length-1];
        else prefix[index++]=0;
      }
      const scan=(begin,lastStart)=>{
        if(begin>lastStart)return null;
        const lastByte=lastStart+needle.length-1;
        for(let cursor=begin,matched=0;cursor<=lastByte;cursor++){
          while(matched&&memory.bytes[cursor]!==needle[matched])matched=prefix[matched-1];
          if(memory.bytes[cursor]===needle[matched])matched++;
          if(matched===needle.length)return cursor-needle.length+1;
        }
        return null;
      };
      const lastStart=memory.size-needle.length,found=scan(offset,lastStart);
      if(found!==null||!wrap||offset===0)return found;
      return scan(0,Math.min(offset-1,lastStart));
    }

    static snapshot(memory,ranges){
      return Object.freeze(ranges.map(({offset,length})=>Object.freeze({offset,bytes:memory.slice(offset,length)})));
    }

    static restore(memory,snapshot){return this.patch(memory,snapshot);}

    static table(memory,offset,count,stride,read){
      if(!Number.isInteger(count)||count<0||!Number.isInteger(stride)||stride<1)throw new RangeError("Invalid memory table dimensions.");
      return Array.from({length:count},(_,index)=>read(offset+index*stride,index,memory));
    }

    static hex(value,width=2){return `0x${Number(value).toString(16).toUpperCase().padStart(width,"0")}`;}
  }

  global.MemoryUtils=MemoryUtils;
  ((global.PokemonViewer ||= {}).core ||= {}).MemoryUtils=MemoryUtils;
})(globalThis);
