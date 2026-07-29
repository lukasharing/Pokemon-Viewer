globalThis.GbaItem = class GbaItem {
  static SIZE = 44;

  static read(memory, offset, decodeText = () => "") {
    memory.assertRange(offset, GbaItem.SIZE);
    return Object.freeze({
      offset,
      name: decodeText(offset, 14),
      itemId: memory.u16(offset + 14),
      price: memory.u16(offset + 16),
      holdEffect: memory.u8(offset + 18),
      holdEffectParam: memory.u8(offset + 19),
      description: memory.pointer(offset + 20),
      importance: memory.u8(offset + 24),
      exitsBagOnUse: Boolean(memory.u8(offset + 25)),
      pocket: memory.u8(offset + 26),
      type: memory.u8(offset + 27),
      fieldUseFunc: memory.pointer(offset + 28),
      battleUsage: memory.u8(offset + 32),
      battleUseFunc: memory.pointer(offset + 36),
      secondaryId: memory.u8(offset + 40)
    });
  }
}

globalThis.GbaItemCatalog = class GbaItemCatalog {
  constructor(memory, {tableOffset, count, decodeText}) {
    this.memory = memory;
    this.tableOffset = tableOffset;
    this.count = count;
    this.decodeText = decodeText;
  }
  get(index) { return GbaItem.read(this.memory, this.tableOffset + index * GbaItem.SIZE, this.decodeText); }
  all() { return Array.from({length: this.count}, (_, index) => this.get(index)); }
}
