globalThis.GbcItemCatalog = class GbcItemCatalog {
  // Gen I ItemNames is a packed list of variable-width strings terminated by
  // the native text byte $50. It is not a fixed-stride table: MASTER BALL uses
  // 12 bytes including its terminator while ULTRA BALL uses 11.
  static NAME_TERMINATOR = 0x50;
  static MAX_NAME_SIZE = 16;

  constructor(memory, {namesOffset, pricesOffset, count, decodeText}) {
    this.memory = memory;
    this.namesOffset = namesOffset;
    this.pricesOffset = pricesOffset;
    this.count = count;
    this.decodeText = decodeText;
    this.names = this.indexNames();
  }
  indexNames() {
    const entries=[];
    let cursor=this.namesOffset;
    for(let index=0;index<this.count;index++){
      const offset=cursor;
      while(this.memory.contains(cursor,1)&&this.memory.u8(cursor)!==GbcItemCatalog.NAME_TERMINATOR){
        cursor++;
        if(cursor-offset>=GbcItemCatalog.MAX_NAME_SIZE)throw new Error(`Gen I item name ${index+1} has no native terminator.`);
      }
      if(!this.memory.contains(cursor,1))throw new Error(`Gen I item name ${index+1} is outside the ROM.`);
      cursor++;
      entries.push(Object.freeze({offset,length:cursor-offset}));
    }
    return Object.freeze(entries);
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
    const source=this.names[index];
    return Object.freeze({
      itemId: index + 1,
      name: this.decodeText(source.offset,source.length),
      nameOffset:source.offset,
      nameLength:source.length,
      price: this.bcdPrice(this.pricesOffset + index * 3)
    });
  }
  all() { return Array.from({length: this.count}, (_, index) => this.get(index)); }
}
