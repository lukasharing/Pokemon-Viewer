globalThis.GbaMemory = class GbaMemory extends RomMemory {
  static ROM_BASE = 0x08000000;
  static ROM_END = 0x0a000000;

  pointer(offset, {nullable = true} = {}) {
    const address = this.u32(offset);
    if(nullable && address === 0) return null;
    if(address < GbaMemory.ROM_BASE || address >= GbaMemory.ROM_END) return null;
    const fileOffset = address - GbaMemory.ROM_BASE;
    return this.contains(fileOffset) ? fileOffset : null;
  }

  address(fileOffset) {
    this.assertRange(fileOffset);
    return GbaMemory.ROM_BASE + fileOffset;
  }
}
