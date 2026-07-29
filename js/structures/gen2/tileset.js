(function(global){
  "use strict";
  class Gen2TilesetHeader{
    static SIZE=15;
    static read(memory,offset,{id=0}={}){
      memory.assertRange(offset,this.SIZE);
      const far=position=>{const bank=memory.u8(position),address=memory.u16(position+1);return{bank,address,offset:memory.banked(bank,address)};};
      return Object.freeze({
        id,offset,gfx:Object.freeze(far(offset)),metatiles:Object.freeze(far(offset+3)),collision:Object.freeze(far(offset+6)),
        animationAddress:memory.u16(offset+9),paletteMapAddress:memory.u16(offset+13),paletteMapOffset:memory.banked(0x3f,memory.u16(offset+13))
      });
    }
  }

  class Gen2TilesetCodec{
    static TILES=0xc0;
    static BYTES_PER_TILE=16;
    static METATILE_SIZE=16;
    static COLLISION_SIZE=4;
    constructor(memory,header,{maxOutput=0x2000}={}){
      this.memory=memory;this.header=header;
      const decoded=GscLz.decompress(memory,header.gfx.offset,{maxOutput});
      if(decoded.bytes.length<Gen2TilesetCodec.TILES*Gen2TilesetCodec.BYTES_PER_TILE)throw new RangeError("Gen II tileset graphics are shorter than 192 tiles.");
      this.graphics=decoded.bytes;this.compressedSize=decoded.consumed;
    }
    tile(index){
      if(!Number.isInteger(index)||index<0||index>=Gen2TilesetCodec.TILES)throw new RangeError("Gen II tile index must be 0–191.");
      const pixels=new Uint8Array(64),offset=index*Gen2TilesetCodec.BYTES_PER_TILE;
      for(let y=0;y<8;y++){const low=this.graphics[offset+y*2],high=this.graphics[offset+y*2+1];for(let x=0;x<8;x++){const bit=7-x;pixels[y*8+x]=(low>>bit&1)|(high>>bit&1)<<1;}}
      return pixels;
    }
    metatile(block){
      if(!Number.isInteger(block)||block<0||block>0x7f)throw new RangeError("Gen II metatile index must be 0–127.");
      return this.memory.slice(this.header.metatiles.offset+block*Gen2TilesetCodec.METATILE_SIZE,Gen2TilesetCodec.METATILE_SIZE);
    }
    collision(block){
      if(!Number.isInteger(block)||block<0||block>0x7f)throw new RangeError("Gen II collision index must be 0–127.");
      return this.memory.slice(this.header.collision.offset+block*Gen2TilesetCodec.COLLISION_SIZE,Gen2TilesetCodec.COLLISION_SIZE);
    }
    paletteIndex(tile){
      if(!Number.isInteger(tile)||tile<0||tile>=Gen2TilesetCodec.TILES)throw new RangeError("Gen II palette tile index must be 0–191.");
      const packed=this.memory.u8(this.header.paletteMapOffset+(tile>>1));
      return(tile&1?packed>>4:packed&15)&7;
    }
    renderMetatile(block,palettes){
      if(!Array.isArray(palettes)||palettes.length<8||palettes.some(palette=>!Array.isArray(palette)||palette.length<4))throw new TypeError("Gen II rendering requires eight four-color palettes.");
      const rgba=new Uint8ClampedArray(32*32*4),tiles=this.metatile(block);
      for(let tileY=0;tileY<4;tileY++)for(let tileX=0;tileX<4;tileX++){
        const tileId=tiles[tileY*4+tileX],pixels=this.tile(tileId),palette=palettes[this.paletteIndex(tileId)];
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){
          const color=palette[pixels[y*8+x]],target=((tileY*8+y)*32+tileX*8+x)*4;
          rgba.set([color[0],color[1],color[2],color[3]??255],target);
        }
      }
      return Object.freeze({width:32,height:32,pixels:rgba});
    }
  }

  Object.assign(global,{Gen2TilesetHeader,Gen2TilesetCodec});
})(globalThis);
