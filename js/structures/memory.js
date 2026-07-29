globalThis.RomMemory = class RomMemory {
  constructor(bytes) {
    if(!(bytes instanceof Uint8Array)) throw new TypeError("ROM memory must be a Uint8Array.");
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get size() { return this.bytes.byteLength; }
  contains(offset, length = 1) { return Number.isInteger(offset) && offset >= 0 && offset + length <= this.size; }
  assertRange(offset, length = 1) {
    if(!this.contains(offset, length)) throw new RangeError(`ROM range 0x${offset.toString(16)}..0x${(offset + length).toString(16)} is invalid.`);
  }
  u8(offset) { this.assertRange(offset); return this.view.getUint8(offset); }
  u16(offset, littleEndian = true) { this.assertRange(offset, 2); return this.view.getUint16(offset, littleEndian); }
  u24(offset, littleEndian = true) {
    this.assertRange(offset, 3);
    return littleEndian ? this.u8(offset) | this.u8(offset + 1) << 8 | this.u8(offset + 2) << 16 : this.u8(offset) << 16 | this.u8(offset + 1) << 8 | this.u8(offset + 2);
  }
  u32(offset, littleEndian = true) { this.assertRange(offset, 4); return this.view.getUint32(offset, littleEndian); }
  s8(offset) { this.assertRange(offset); return this.view.getInt8(offset); }
  s16(offset, littleEndian = true) { this.assertRange(offset, 2); return this.view.getInt16(offset, littleEndian); }
  s32(offset, littleEndian = true) { this.assertRange(offset, 4); return this.view.getInt32(offset, littleEndian); }
  slice(offset, length) { this.assertRange(offset, length); return this.bytes.slice(offset, offset + length); }
  table(offset, count, stride, read) {
    return Array.from({length: count}, (_, index) => read(offset + index * stride, index));
  }
  cursor(offset=0) { return new MemoryCursor(this,offset); }
  reader() { return new MemoryReader(this); }
}
