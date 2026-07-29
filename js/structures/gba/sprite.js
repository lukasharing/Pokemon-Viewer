(function(global){
  "use strict";
  class GbaOverworldSpriteInfo{
    static SIZE=36;
    static read(m,o){
      m.assertRange(o,this.SIZE);
      return Object.freeze({
        offset:o,
        tileTag:m.u16(o),
        paletteTag:m.u16(o+2),
        reflectionPaletteTag:m.u16(o+4),
        frameSize:m.u16(o+6),
        width:m.u16(o+8),
        height:m.u16(o+10),
        paletteSlot:m.u8(o+12)&0x0f,
        flags:m.u8(o+12),
        tracks:m.u8(o+13),
        oam:m.pointer(o+16),
        subspriteTables:m.pointer(o+20),
        anims:m.pointer(o+24),
        images:m.pointer(o+28),
        affineAnims:m.pointer(o+32)
      });
    }
  }
  class GbaOverworldSpriteCatalog{
    constructor(reader){
      if(!(reader?.memory instanceof GbaMemory))throw new TypeError("GbaOverworldSpriteCatalog requires a GBA reader.");
      this.reader=reader;this.memory=reader.memory;this.header=reader.memoryOffsets.sprite_header;this.paletteHeader=reader.memoryOffsets.sprite_palette;this.entries=this.readEntries();
    }
    readEntries(){
      if(!Number.isInteger(this.header))return Object.freeze([]);
      const entries=[];
      for(let id=0;id<256;id++)try{
        const offset=this.memory.pointer(this.header+id*4),info=GbaOverworldSpriteInfo.read(this.memory,offset);
        if(!info.width||!info.height||info.width>128||info.height>128)break;
        entries.push(Object.freeze({id,label:`Overworld sprite ${id}`,offset,info}));
      }catch{break;}
      return Object.freeze(entries);
    }
    available(){return this.entries.length>0;}
    list(){return this.entries;}
    palette(tag){
      if(!Number.isInteger(this.paletteHeader))return null;
      for(let index=0;index<256;index++)try{
        const entry=this.paletteHeader+index*8,offset=this.memory.pointer(entry),entryTag=this.memory.u16(entry+4);
        if(entryTag===tag){
          const colors=Object.freeze(Array.from({length:16},(_,color)=>`#${CoreUtils.bgr555ToRgb(this.memory.u16(offset+color*2)).map(value=>value.toString(16).padStart(2,"0")).join("")}`));
          return{colors,offset};
        }
      }catch{break;}
      return null;
    }
    frames(entry){
      const {info}=entry,frames=[],images=info.images;
      // ObjectEventGraphicsInfo.size is the OBJ_VRAM allocation. It is not
      // always one frame's byte length (BrendanNormal reserves 0x200 bytes for
      // a native 16×32/0x100-byte frame). SpriteFrameImage.size and the
      // declared pixel dimensions own the actual frame extent.
      const expectedSize=info.width*info.height/2;
      if(!expectedSize||expectedSize%GbaSpriteCodec.bytesPerTile||info.frameSize<expectedSize)throw new RangeError("The GBA sprite declares an invalid native frame size.");
      let firstOffset=null;
      for(let index=0;index<64;index++)try{
        const record=images+index*8,offset=this.memory.pointer(record),size=this.memory.u16(record+4);
        if(size!==expectedSize)break;
        if(firstOffset===null)firstOffset=offset;
        if(offset!==firstOffset+index*expectedSize)break;
        frames.push(Object.freeze({
          offset,
          bytes:this.memory.slice(offset,size),
          count:size/GbaSpriteCodec.bytesPerTile,
          columns:Math.max(1,info.width/8),
          label:`State ${index+1}`,
          title:`${entry.label} · State ${index+1}`,
          editable:true
        }));
      }catch{break;}
      if(!frames.length)throw new RangeError("The GBA sprite has no valid native frame images.");
      return frames;
    }
    source(id){
      const entry=this.entries.find(item=>item.id===id);if(!entry)throw new RangeError("Choose a valid GBA overworld sprite.");
      const palette=this.palette(entry.info.paletteTag);
      if(!palette)throw new RangeError(`The GBA sprite palette tag ${entry.info.paletteTag} is not present in the native palette table.`);
      const views=this.frames(entry).map(frame=>Object.freeze({...frame,palette:palette.colors,paletteOffset:palette.offset}));
      return views.length===1?Object.freeze({...views[0],title:entry.label}):Object.freeze({title:entry.label,views:Object.freeze(views)});
    }
  }
  Object.assign(global,{GbaOverworldSpriteInfo,GbaOverworldSpriteCatalog});
  ((global.PokemonViewer ||= {}).structures ||= {}).GbaOverworldSpriteCatalog=GbaOverworldSpriteCatalog;
})(globalThis);
