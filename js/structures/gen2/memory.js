(function(global){
  "use strict";
  class Gen2Memory extends RomMemory{
    static BANK_SIZE=0x4000;
    banked(bank,address){
      if(!Number.isInteger(bank)||bank<0||bank>0xff)throw new RangeError("Invalid Gen II ROM bank.");
      if(!Number.isInteger(address)||address<0||address>0x7fff)throw new RangeError("Invalid Game Boy address.");
      const offset=address<Gen2Memory.BANK_SIZE?address:bank*Gen2Memory.BANK_SIZE+address-Gen2Memory.BANK_SIZE;
      this.assertRange(offset);return offset;
    }
    pointer16(offset,bank){return this.banked(bank,this.u16(offset));}
    farPointer(offset){return this.banked(this.u8(offset+2),this.u16(offset));}
  }
  global.Gen2Memory=Gen2Memory;
})(globalThis);
