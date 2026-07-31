(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const colorHex=color=>`#${color.slice(0,3).map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,"0")).join("")}`;

  class GbaBattleBackgrounds{
    static names=Object.freeze(["Grass","Long grass","Sand","Underwater","Water","Pond","Mountain","Cave","Building","Plain"]);
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      const profile=root.gba?.assets?.profile?.(reader);
      this.table=profile?.verifiedReference?profile.battleEnvironmentTable:null;this.cache=new Map();
    }
    list(){return Number.isInteger(this.table)?this.constructor.names.map((label,id)=>({id,label})):[];}
    record(id){
      id=Number(id);if(!Number.isInteger(this.table)||!Number.isInteger(id)||id<0||id>=this.constructor.names.length)return null;
      const offset=this.table+id*20,pointer=at=>this.memory.pointer(offset+at),record={id,label:this.constructor.names[id],offset,tiles:pointer(0),tilemap:pointer(4),entryTiles:pointer(8),entryTilemap:pointer(12),palette:pointer(16)};
      if([record.tiles,record.tilemap,record.entryTiles,record.entryTilemap,record.palette].some(value=>!Number.isInteger(value)))throw new Error(`Battle environment ${id} has an invalid pointer.`);
      return Object.freeze(record);
    }
    source(id=0){
      if(this.cache.has(id))return this.cache.get(id);
      const record=this.record(id);if(!record)return null;
      const platform=root.gba,decoder=platform?.GbaLz77,renderer=platform?.GbaTilemapRenderer;
      if(typeof decoder?.decode!=="function"){
        throw new Error("GBA battle background rendering requires the GBA LZ77 codec.");
      }
      if(typeof renderer?.colors!=="function"||typeof renderer?.renderText4bpp!=="function"){
        throw new Error("GBA battle background rendering requires the GBA tilemap codec.");
      }
      const tiles=decoder.decode(this.memory,record.tiles).bytes;
      const paletteBytes=decoder.decode(this.memory,record.palette).bytes;
      const tilemap=decoder.decode(this.memory,record.tilemap).bytes;
      const palette=renderer.colors(paletteBytes,{base:32});
      const canvas=renderer.renderText4bpp({tiles,tilemap,palette,width:30,height:20,stride:32});
      // Battle BG3 is a 32x32 text background. Keep its complete hardware
      // surface as well as the 240x160 viewport so HOFS/VOFS animation tasks
      // can wrap through the two off-screen columns and twelve rows exactly.
      const scrollCanvas=renderer.renderText4bpp({tiles,tilemap,palette,width:32,height:32,stride:32});
      // GbaTilemapRenderer reserves entries 0..31. GraphicSource needs the
      // compact, serialisable 16-colour bank used by these tiles.
      const linkedPalette=palette.slice(32,48).map(colorHex);
      const result=Object.freeze({id:record.id,label:record.label,canvas,scrollCanvas,viewport:Object.freeze({width:240,height:160,wrapWidth:256,wrapHeight:256}),tilesOffset:record.tiles,paletteOffset:record.palette,tilemapOffset:record.tilemap,bytes:tiles,count:Math.floor(tiles.length/32),columns:16,palette:Object.freeze(linkedPalette),editable:false,title:`${record.label} battle background tiles`});
      this.cache.set(id,result);return result;
    }
  }

  ((root.battle||={}).gba||={}).Backgrounds=GbaBattleBackgrounds;
})(globalThis);
