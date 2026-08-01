(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),ns=((root.maps||={}).gbc||={});
  const COLORS=Object.freeze([[224,248,208,255],[136,192,112,255],[52,104,86,255],[8,24,32,255]]);
  const NAMES=Object.freeze(["Pallet Town","Viridian City","Pewter City","Cerulean City","Lavender Town","Vermilion City","Celadon City","Fuchsia City","Cinnabar Island","Indigo Plateau","Saffron City","Unused","Route 1","Route 2","Route 3","Route 4","Route 5","Route 6","Route 7","Route 8","Route 9","Route 10","Route 11","Route 12","Route 13","Route 14","Route 15","Route 16","Route 17","Route 18","Route 19","Route 20","Route 21","Route 22","Route 23","Route 24","Route 25"]);
  const FALLBACK=Object.freeze({WorldMapTileGraphics:0x125a8,CompressedMap:0x71100,ExternalMapEntries:0x71313});

  class GbcRegionMap{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;const symbols=reader.capabilities?.provenance?.symbols||{};
      this.offsets=Object.freeze(Object.fromEntries(Object.keys(FALLBACK).map(name=>[name,symbols[name]?.offset??FALLBACK[name]])));
      this.profile=Object.freeze({label:"Kanto Minimap",mapWidth:20,mapHeight:18,coordinateWidth:16,coordinateHeight:16,supportsSize:false,cursorX:0,cursorY:0});
      this.base=this.decodeBackground();this.entries=this.decodeEntries();
    }
    decodeBackground(){
      this.tiles=Array.from({length:16},(_,id)=>GbcSpriteCodec.decodeTile(this.memory,this.offsets.WorldMapTileGraphics+id*16));const tilemap=[];
      let cursor=this.offsets.CompressedMap;
      for(;tilemap.length<360;cursor++){
        const packed=this.memory.u8(cursor);if(!packed)break;
        const run=packed&15,tile=packed>>4;if(!run)throw new Error("Gen I Minimap contains an empty RLE run.");
        for(let index=0;index<run&&tilemap.length<360;index++)tilemap.push(tile);
      }
      if(tilemap.length!==360)throw new Error(`Gen I Minimap decoded ${tilemap.length} tiles instead of 360.`);
      this.compressedLength=Math.max(this.compressedLength||0,cursor-this.offsets.CompressedMap+1);this.tilemap=tilemap;
      const canvas=document.createElement("canvas");canvas.width=160;canvas.height=144;const context=canvas.getContext("2d"),image=context.createImageData(160,144);
      for(let cell=0;cell<tilemap.length;cell++){const pixels=this.tiles[tilemap[cell]],originX=cell%20*8,originY=Math.floor(cell/20)*8;for(let y=0;y<8;y++)for(let x=0;x<8;x++)image.data.set(COLORS[pixels[y*8+x]],((originY+y)*160+originX+x)*4);}
      context.putImageData(image,0,0);return canvas;
    }
    reload(){this.base=this.decodeBackground();return this;}
    tileCanvas(id){
      const canvas=document.createElement("canvas");canvas.width=8;canvas.height=8;const context=canvas.getContext("2d"),image=context.createImageData(8,8),pixels=this.tiles[id];
      for(let index=0;index<64;index++)image.data.set(COLORS[pixels[index]],index*4);context.putImageData(image,0,0);return canvas;
    }
    cellDocument(){return{width:20,height:18,tileSize:8,cells:Object.freeze([...this.tilemap]),palette:Object.freeze(this.tiles.map((_,id)=>({id,canvas:this.tileCanvas(id)}))),editable:true};}
    canEditCells(){return true;}
    encodeTilemap(cells){
      const bytes=[];for(let index=0;index<cells.length;){const tile=cells[index];let run=1;while(index+run<cells.length&&cells[index+run]===tile&&run<15)run++;bytes.push((tile<<4)|run);index+=run;}bytes.push(0);return Uint8Array.from(bytes);
    }
    updateCell(index,tile){
      index=Number(index);tile=Number(tile);if(!Number.isInteger(index)||index<0||index>=360)throw new RangeError("Gen I Minimap cell is outside its 20 × 18 tilemap.");if(!Number.isInteger(tile)||tile<0||tile>=16)throw new RangeError("Gen I Minimap tile must be between 0 and 15.");
      const previousTile=this.tilemap[index];if(previousTile===tile)return{previous:previousTile,next:tile,offset:this.offsets.CompressedMap};
      const nextCells=[...this.tilemap];nextCells[index]=tile;const encoded=this.encodeTilemap(nextCells);
      if(encoded.length>this.compressedLength)throw new RangeError(`This edit needs ${encoded.length} compressed bytes, but the verified Minimap allocation has ${this.compressedLength}. Choose another tile or relocate the data in Nerd mode.`);
      const previous=MemoryUtils.bytes(this.memory,this.offsets.CompressedMap,this.compressedLength),next=new Uint8Array(this.compressedLength);next.set(encoded);
      MemoryUtils.replace(this.memory,this.offsets.CompressedMap,previous,next);this.tilemap=nextCells;this.base=this.renderTilemap();return{previous:previousTile,next:tile,offset:this.offsets.CompressedMap};
    }
    renderTilemap(){
      const canvas=document.createElement("canvas");canvas.width=160;canvas.height=144;const context=canvas.getContext("2d"),image=context.createImageData(160,144);
      for(let cell=0;cell<this.tilemap.length;cell++){const pixels=this.tiles[this.tilemap[cell]],originX=cell%20*8,originY=Math.floor(cell/20)*8;for(let y=0;y<8;y++)for(let x=0;x<8;x++)image.data.set(COLORS[pixels[y*8+x]],((originY+y)*160+originX+x)*4);}
      context.putImageData(image,0,0);return canvas;
    }
    decodeEntries(){
      return Object.freeze(NAMES.map((name,id)=>{const offset=this.offsets.ExternalMapEntries+id*3,packed=this.memory.u8(offset);return Object.freeze({id,offset,x:packed&15,y:packed>>4,width:1,height:1,name,flyable:id<11});}));
    }
    sectionForMap(map){const id=Number(map?.id??map?.getMapIndex?.());return Number.isInteger(id)&&id>=0&&id<this.entries.length?id:null;}
    entry(id){return this.entries[Number(id)]||null;}
    canEdit(entry){return Boolean(entry&&Number.isInteger(entry.offset));}
    tileEditorSource(){return{offset:this.offsets.WorldMapTileGraphics,bytes:MemoryUtils.bytes(this.memory,this.offsets.WorldMapTileGraphics,16*16),count:16,columns:4,editable:true,title:"Kanto Minimap tiles",palette:COLORS.map(color=>`#${color.slice(0,3).map(value=>value.toString(16).padStart(2,"0")).join("")}`)};}
    updateEntry(entry,{x,y}){
      if(!this.canEdit(entry))throw new Error("This Minimap location is not writable.");
      x=Number(x);y=Number(y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>15||y<0||y>15)throw new RangeError("Gen I Minimap coordinates must be in the native 16 × 16 coordinate range.");
      const previous=Uint8Array.of(this.memory.u8(entry.offset)),next=Uint8Array.of((y<<4)|x);MemoryUtils.replace(this.memory,entry.offset,previous,next);
      const replacement=Object.freeze({...entry,x,y});this.entries=Object.freeze(this.entries.map(item=>item.id===entry.id?replacement:item));return{previous,next,entry:replacement};
    }
    hitTest(x,y){return this.entries.find(entry=>entry.x===x&&entry.y===y)||null;}
    renderUsedTiles(canvas){
      return MinimapUtils.renderUsedTiles(this.base,canvas);
    }
    render(canvas,{sectionId=null,showLocations=true,showGrid=false}={}){
      canvas.width=this.base.width;canvas.height=this.base.height;const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;context.drawImage(this.base,0,0);
      if(showGrid){context.strokeStyle="rgba(255,255,255,.2)";for(let x=.5;x<160;x+=8){context.beginPath();context.moveTo(x,0);context.lineTo(x,144);context.stroke();}for(let y=.5;y<144;y+=8){context.beginPath();context.moveTo(0,y);context.lineTo(160,y);context.stroke();}}
      const selected=this.entry(sectionId);if(showLocations)for(const entry of this.entries.filter(item=>item.flyable)){context.strokeStyle=entry.id===selected?.id?"#287fc5":"rgba(21,45,63,.62)";context.lineWidth=entry.id===selected?.id?2:1;context.strokeRect(entry.x*8+.5,entry.y*8+.5,7,7);}
      canvas.setAttribute("aria-label",`Pokémon Red and Blue Kanto Minimap${selected?`. ${selected.name}`:""}.`);return canvas;
    }
  }
  ns.RegionMap=GbcRegionMap;
})(globalThis);
