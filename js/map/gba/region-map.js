(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),gba=root.gba;

  class GbaRegionMap{
    static profiles=Object.freeze({
      emerald:Object.freeze({
        label:"Hoenn Minimap",palette:0x59f73c,paletteLength:64,paletteBase:112,
        tiles:0x59f77c,tilemap:0x5a04e0,mode:"affine8",mapWidth:28,mapHeight:15,
        cursorX:1,cursorY:2,entryLimit:256
      }),
      fire_red:Object.freeze({
        label:"Kanto Minimap",palette:0x3ef34c,paletteLength:160,paletteBase:0,
        tiles:0x3ef68c,tilemap:0x3f090c,mode:"text4",mapWidth:22,mapHeight:15,
        cursorX:0,cursorY:0,entryLimit:0
      })
    });
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=this.constructor.profiles[reader.type]||null;
      if(!this.profile)throw new Error(`The exact in-ROM Minimap is not profiled for ${reader.type}.`);
      this.base=this.decodeBackground();
      this.entries=this.decodeEntries();
    }
    reload(){this.base=this.decodeBackground();return this;}
    cellDocument(){
      const cells=[];for(let y=0;y<20;y++)for(let x=0;x<30;x++)cells.push(this.tileEntry(x,y));
      const ids=[...new Set(cells)];
      return{width:30,height:20,tileSize:8,cells:Object.freeze(cells),palette:Object.freeze(ids.map(id=>Object.freeze({id,canvas:this.tileCanvas(id)}))),editable:true};
    }
    canEditCells(){return true;}
    decodeBackground(){
      const profile=this.profile,paletteBytes=MemoryUtils.bytes(this.memory,profile.palette,profile.paletteLength);
      this.palette=gba.GbaTilemapRenderer.colors(paletteBytes,{base:profile.paletteBase});
      this.tiles=gba.GbaLz77.decode(this.memory,profile.tiles).bytes;
      const decoded=gba.GbaLz77.decode(this.memory,profile.tilemap);this.tilemap=Uint8Array.from(decoded.bytes);
      // pret declares these native compressed assets as u32 arrays. Respect
      // their 4-byte allocation padding, but only when the ROM really contains
      // padding bytes so a modified/hacked layout can never be overwritten.
      if(!this.tilemapAllocation)this.tilemapAllocation=gba.GbaLz77.allocationLength(this.memory,profile.tilemap,decoded.consumed);
      return this.renderBackground();
    }
    renderBackground(){
      return this.profile.mode==="affine8"
        ?gba.GbaTilemapRenderer.renderAffine8bpp({tiles:this.tiles,tilemap:this.tilemap,palette:this.palette,width:30,height:20,stride:64})
        :gba.GbaTilemapRenderer.renderText4bpp({tiles:this.tiles,tilemap:this.tilemap,palette:this.palette,width:30,height:20,stride:30});
    }
    tileOffset(x,y){return this.profile.mode==="affine8"?y*64+x:(y*30+x)*2;}
    tileEntry(x,y){
      const offset=this.tileOffset(x,y);return this.profile.mode==="affine8"?this.tilemap[offset]:this.tilemap[offset]|this.tilemap[offset+1]<<8;
    }
    tileCanvas(entry){
      if(this.profile.mode==="affine8")return gba.GbaTilemapRenderer.renderAffine8bpp({tiles:this.tiles,tilemap:Uint8Array.of(entry),palette:this.palette,width:1,height:1,stride:1});
      return gba.GbaTilemapRenderer.renderText4bpp({tiles:this.tiles,tilemap:Uint8Array.of(entry&255,entry>>>8&255),palette:this.palette,width:1,height:1,stride:1});
    }
    planCellUpdate(index,entry){
      index=Number(index);entry=Number(entry);
      if(!Number.isInteger(index)||index<0||index>=600)throw new RangeError("GBA Minimap cell is outside its 30 × 20 visible tilemap.");
      const maximum=this.profile.mode==="affine8"?0xff:0xffff;
      if(!Number.isInteger(entry)||entry<0||entry>maximum)throw new RangeError(`GBA Minimap tile entry must be between 0 and ${maximum}.`);
      const x=index%30,y=Math.floor(index/30),offset=this.tileOffset(x,y),previous=this.tileEntry(x,y);
      if(previous===entry)return null;
      const nextTilemap=Uint8Array.from(this.tilemap);nextTilemap[offset]=entry&255;if(this.profile.mode!=="affine8")nextTilemap[offset+1]=entry>>>8&255;
      const encoded=gba.GbaLz77.encode(nextTilemap);
      if(encoded.length>this.tilemapAllocation)throw new RangeError(`This edit needs ${encoded.length} compressed bytes, but the verified Minimap allocation has ${this.tilemapAllocation}. Choose another tile or relocate the tilemap in Nerd mode.`);
      const before=MemoryUtils.bytes(this.memory,this.profile.tilemap,this.tilemapAllocation),after=new Uint8Array(this.tilemapAllocation);after.set(encoded);
      const previousTilemap=Uint8Array.from(this.tilemap),commit=(expected,replacement,tilemap)=>{MemoryUtils.replace(this.memory,this.profile.tilemap,expected,replacement);this.tilemap=Uint8Array.from(tilemap);this.base=this.renderBackground();return{previous,next:entry,offset:this.profile.tilemap};};
      return Object.freeze({previous,next:entry,offset:this.profile.tilemap,apply:()=>commit(before,after,nextTilemap),revert:()=>commit(after,before,previousTilemap)});
    }
    updateCell(index,entry){const plan=this.planCellUpdate(index,entry);plan?.apply();return plan||{previous:entry,next:entry,offset:this.profile.tilemap};}
    decodeEntries(){
      const base=gba.assets.profile(this.reader)?.regionMapEntries;
      if(!Number.isInteger(base)||!this.profile.entryLimit)return Object.freeze([]);
      const entries=[];
      for(let id=0;id<this.profile.entryLimit;id++){
        const offset=base+id*8,x=this.memory.u8(offset),y=this.memory.u8(offset+1),width=this.memory.u8(offset+2),height=this.memory.u8(offset+3),nameOffset=this.memory.pointer(offset+4);
        // gRegionMapEntries is immediately followed by unrelated const data.
        // Every entry before MAPSEC_NONE has a non-zero rectangle and a ROM
        // name pointer, so the first invalid record is its exact terminator.
        if(width<1||height<1||width>this.profile.mapWidth||height>this.profile.mapHeight||nameOffset===null)break;
        const name=this.reader.getTextByOffset(this.reader.getDictionary(this.reader.textDictionary||"text_table_en"),nameOffset,32).replace(/\s+/g," ").trim()||`Map section ${id}`;
        entries.push(Object.freeze({id,offset,x,y,width,height,name,nameOffset}));
      }
      if(!entries.length)throw new Error("The in-ROM Minimap location table is empty.");
      return Object.freeze(entries);
    }
    sectionForMap(map){
      const header=map?.getHeaderOffset?.();
      return Number.isInteger(header)?this.memory.u8(header+20):null;
    }
    entry(id){return this.entries[id]||null;}
    canEdit(entry){return Boolean(entry&&Number.isInteger(entry.offset)&&this.profile.entryLimit>0);}
    updateEntry(entry,{x,y,width,height}){
      if(!this.canEdit(entry))throw new Error("This Minimap profile has no verified writable location table.");
      const values=[x,y,width,height].map(Number);
      if(values.some(value=>!Number.isInteger(value)))throw new TypeError("Region coordinates and size must be whole tile values.");
      if(x<0||y<0||width<1||height<1||x+width>this.profile.mapWidth||y+height>this.profile.mapHeight)throw new RangeError(`The location rectangle must fit inside ${this.profile.mapWidth} × ${this.profile.mapHeight} region tiles.`);
      const next=Uint8Array.of(x,y,width,height),previous=MemoryUtils.bytes(this.memory,entry.offset,4);
      MemoryUtils.replace(this.memory,entry.offset,previous,next);
      const replacement=Object.freeze({...entry,x,y,width,height});
      this.entries=Object.freeze(this.entries.map(item=>item.id===entry.id?replacement:item));
      return {previous,next,entry:replacement};
    }
    hitTest(x,y){
      return this.entries.find(entry=>x>=entry.x+this.profile.cursorX&&y>=entry.y+this.profile.cursorY&&x<entry.x+this.profile.cursorX+entry.width&&y<entry.y+this.profile.cursorY+entry.height)||null;
    }
    renderUsedTiles(canvas){
      return MinimapUtils.renderUsedTiles(this.base,canvas);
    }
    render(canvas,{sectionId=null,showLocations=true,showGrid=false}={}){
      canvas.width=this.base.width;canvas.height=this.base.height;
      const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(this.base,0,0);
      if(showGrid){context.save();context.strokeStyle="rgba(255,255,255,.22)";context.lineWidth=1;for(let x=.5;x<canvas.width;x+=8){context.beginPath();context.moveTo(x,0);context.lineTo(x,canvas.height);context.stroke();}for(let y=.5;y<canvas.height;y+=8){context.beginPath();context.moveTo(0,y);context.lineTo(canvas.width,y);context.stroke();}context.restore();}
      if(showLocations){context.save();context.strokeStyle="rgba(255,255,255,.62)";context.lineWidth=1;for(const item of this.entries){const x=(item.x+this.profile.cursorX)*8,y=(item.y+this.profile.cursorY)*8;context.strokeRect(x+.5,y+.5,item.width*8-1,item.height*8-1);}context.restore();}
      const entry=this.entry(sectionId);
      if(entry){
        const x=(entry.x+this.profile.cursorX)*8,y=(entry.y+this.profile.cursorY)*8,width=entry.width*8,height=entry.height*8;
        context.save();context.fillStyle="rgba(40,127,197,.24)";context.strokeStyle="#fff";context.lineWidth=3;context.fillRect(x,y,width,height);context.strokeRect(x+.5,y+.5,width-1,height-1);context.strokeStyle="#287fc5";context.lineWidth=1;context.strokeRect(x+.5,y+.5,width-1,height-1);context.restore();
        canvas.setAttribute("aria-label",`${this.profile.label}. Current section: ${entry.name}.`);
      }else canvas.setAttribute("aria-label",this.profile.label);
      return canvas;
    }
  }

  ((root.maps||={}).gba||={}).RegionMap=GbaRegionMap;
})(globalThis);
