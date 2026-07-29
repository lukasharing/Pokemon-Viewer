globalThis.GbcMemory = class GbcMemory extends RomMemory {
  static BANK_SIZE = 0x4000;

  banked(bank, address) {
    if(!Number.isInteger(bank) || bank < 0 || bank > 0xff) throw new RangeError("Invalid ROM bank.");
    if(address < 0 || address > 0x7fff) throw new RangeError("Invalid Game Boy address.");
    const offset = address < GbcMemory.BANK_SIZE ? address : bank * GbcMemory.BANK_SIZE + address - GbcMemory.BANK_SIZE;
    this.assertRange(offset);
    return offset;
  }

  pointer16(offset, bank) { return this.banked(bank, this.u16(offset)); }
  farPointer(offset) { return this.banked(this.u8(offset), this.u16(offset + 1)); }
}
