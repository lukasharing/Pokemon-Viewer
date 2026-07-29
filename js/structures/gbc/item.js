globalThis.GbcItemCatalog = class GbcItemCatalog {
  // Gen I stores ITEM_NAME_LENGTH - 1 bytes in ItemNames. The terminator is
  // part of each fixed record, so the next name starts twelve bytes later.
  static NAME_SIZE = 12;

  constructor(memory, {namesOffset, pricesOffset, count, decodeText}) {
    this.memory = memory;
    this.namesOffset = namesOffset;
    this.pricesOffset = pricesOffset;
    this.count = count;
    this.decodeText = decodeText;
  }
  bcdPrice(offset) {
    return [this.memory.u8(offset), this.memory.u8(offset + 1), this.memory.u8(offset + 2)]
      .reduce((value, byte) => value * 100 + (byte >> 4) * 10 + (byte & 0xf), 0);
  }
  encodePrice(value) {
    const numeric=Number(value);
    if(!Number.isInteger(numeric)||numeric<0||numeric>999999)throw new RangeError("Gen I item price must be 0–999999.");
    return Uint8Array.from(String(numeric).padStart(6,"0").match(/../g).map(pair=>(Number(pair[0])<<4)|Number(pair[1])));
  }
  get(index) {
    if(index < 0 || index >= this.count) throw new RangeError("Unknown item index.");
    return Object.freeze({
      itemId: index + 1,
      name: this.decodeText(this.namesOffset + index * GbcItemCatalog.NAME_SIZE, GbcItemCatalog.NAME_SIZE),
      price: this.bcdPrice(this.pricesOffset + index * 3)
    });
  }
  all() { return Array.from({length: this.count}, (_, index) => this.get(index)); }
}
