(function(global){
  "use strict";

  class RomChecksum{
    static kind(family){
      if(family==="gba")return"gba";
      if(family==="gb"||family==="gbc")return"gb";
      return null;
    }

    static supports(memory,family){
      if(!(memory instanceof Uint8Array))return false;
      const kind=this.kind(family);
      return kind==="gba"?memory.length>0xbd:kind==="gb"?memory.length>0x14f:false;
    }

    static gbaHeader(memory){
      let sum=0;
      for(let offset=0xa0;offset<=0xbc;offset++)sum=(sum+memory[offset])&0xff;
      return(-sum-0x19)&0xff;
    }

    static gbHeader(memory){
      let checksum=0;
      for(let offset=0x134;offset<=0x14c;offset++)checksum=(checksum-memory[offset]-1)&0xff;
      return checksum;
    }

    static gbGlobal(memory){
      let checksum=0;
      for(let offset=0;offset<memory.length;offset++){
        if(offset===0x14e||offset===0x14f)continue;
        checksum=(checksum+memory[offset])&0xffff;
      }
      return checksum;
    }

    static inspect(memory,family){
      if(!this.supports(memory,family))return null;
      if(this.kind(family)==="gba"){
        const stored=memory[0xbd],calculated=this.gbaHeader(memory);
        return Object.freeze({family:"gba",header:Object.freeze({stored,calculated,valid:stored===calculated}),global:null});
      }
      const headerStored=memory[0x14d],headerCalculated=this.gbHeader(memory);
      const globalStored=(memory[0x14e]<<8)|memory[0x14f],globalCalculated=this.gbGlobal(memory);
      return Object.freeze({
        family:"gb",
        header:Object.freeze({stored:headerStored,calculated:headerCalculated,valid:headerStored===headerCalculated}),
        global:Object.freeze({stored:globalStored,calculated:globalCalculated,valid:globalStored===globalCalculated})
      });
    }

    static repair(memory,family){
      if(!this.supports(memory,family))return null;
      if(this.kind(family)==="gba")memory[0xbd]=this.gbaHeader(memory);
      else{
        memory[0x14d]=this.gbHeader(memory);
        const checksum=this.gbGlobal(memory);
        memory[0x14e]=checksum>>8;
        memory[0x14f]=checksum&0xff;
      }
      return this.inspect(memory,family);
    }
  }

  global.RomChecksum=RomChecksum;
  ((global.PokemonViewer ||= {}).core ||= {}).RomChecksum=RomChecksum;
})(globalThis);
