globalThis.MemoryCursor = class MemoryCursor {
  constructor(memory, offset=0) { this.memory=memory; this.start=offset; this.offset=offset; }
  get position(){return this.offset;}
  get length(){return this.offset-this.start;}
  seek(offset){this.memory.assertRange(offset,0);this.offset=offset;return this;}
  skip(length){return this.seek(this.offset+length);}
  align(bytes=4){return this.seek(Math.ceil(this.offset/bytes)*bytes);}
  read(method,length,...args){const value=this.memory[method](this.offset,...args);this.offset+=length;return value;}
  u8(){return this.read("u8",1);}
  s8(){return this.read("s8",1);}
  u16(littleEndian=true){return this.read("u16",2,littleEndian);}
  s16(littleEndian=true){return this.read("s16",2,littleEndian);}
  u24(littleEndian=true){return this.read("u24",3,littleEndian);}
  u32(littleEndian=true){return this.read("u32",4,littleEndian);}
  s32(littleEndian=true){return this.read("s32",4,littleEndian);}
  bytes(length){const value=this.memory.slice(this.offset,length);this.offset+=length;return value;}
  pointer(options){if(typeof this.memory.pointer!=="function")throw new TypeError("This memory family has no native pointer reader.");const value=this.memory.pointer(this.offset,options);this.offset+=4;return value;}
  pointer16(bank){if(typeof this.memory.pointer16!=="function")throw new TypeError("This memory family has no banked pointer reader.");const value=this.memory.pointer16(this.offset,bank);this.offset+=2;return value;}
  farPointer(){if(typeof this.memory.farPointer!=="function")throw new TypeError("This memory family has no far-pointer reader.");const value=this.memory.farPointer(this.offset);this.offset+=3;return value;}
  array(count,reader){return Array.from({length:count},(_,index)=>reader(this,index));}
};

globalThis.MemoryReader = class MemoryReader {
  constructor(memory){this.memory=memory;}
  at(offset){return new MemoryCursor(this.memory,offset);}
  record(offset,read){const cursor=this.at(offset);return Object.freeze({offset,...read(cursor)});}
  table(offset,count,stride,read){return Array.from({length:count},(_,index)=>read(this.at(offset+index*stride),index));}
};
