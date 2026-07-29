(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),ns=((root.maps||={}).gen2||={});
  const rgb5=value=>Math.round((value&31)*255/31);
  const color=(memory,offset)=>{const word=memory.u16(offset);return[rgb5(word),rgb5(word>>5),rgb5(word>>10),255];};

  class Gen2RegionMap{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["TownMapGFX","JohtoMap","KantoMap","TownMapPals.PalMap","MalePokegearPals","Landmarks","Flypoints"])if(!this.symbols[name])throw new Error(`Crystal Minimap requires the pinned ${name} symbol.`);
      this.profile=Object.freeze({label:"Crystal Minimap",mapWidth:20,mapHeight:18,cursorX:0,cursorY:0});
      this.tiles=GscLz.decompress(this.memory,this.symbols.TownMapGFX.offset,{maxOutput:48*16,maxInput:0x1000}).bytes;
      if(this.tiles.length!==48*16)throw new Error(`Crystal TownMapGFX decoded to ${this.tiles.length} bytes instead of 768.`);
      this.paletteMap=MemoryUtils.bytes(this.memory,this.symbols["TownMapPals.PalMap"].offset,48);
      this.palettes=Object.freeze(Array.from({length:6},(_,palette)=>Object.freeze(Array.from({length:4},(_,index)=>Object.freeze(color(this.memory,this.symbols.MalePokegearPals.offset+(palette*4+index)*2))))));
      this.maps=Object.freeze({johto:this.renderMap(this.symbols.JohtoMap.offset),kanto:this.renderMap(this.symbols.KantoMap.offset)});
      this.flyable=this.readFlypoints();this.entries=this.readLandmarks();this.activeRegion="johto";
    }
    readFlypoints(){const ids=new Set(),base=this.symbols.Flypoints.offset;for(let cursor=base;this.memory.contains(cursor,2);cursor+=2){const id=this.memory.u8(cursor);if(id===0xff)break;ids.add(id);}return ids;}
    readLandmarks(){
      const base=this.symbols.Landmarks.offset,bank=this.symbols.Landmarks.bank,entries=[];
      for(let id=0;id<96;id++){
        const offset=base+id*4,rawX=this.memory.u8(offset),rawY=this.memory.u8(offset+1),address=this.memory.u16(offset+2),nameOffset=this.memory.banked(bank,address);
        const name=this.reader.getTextByOffset(this.reader.getDictionary(this.reader.textDictionary||"text_table_gen2_en"),nameOffset,18).replace(/\s+/g," ").trim()||`Landmark ${id}`;
        entries.push(Object.freeze({id,offset,x:rawX/8,y:rawY/8,width:1,height:1,rawX,rawY,name,nameOffset,region:id>=0x2f&&id<=0x5e?"kanto":"johto",flyable:this.flyable.has(id)}));
      }
      return Object.freeze(entries);
    }
    paletteFor(tile){if(tile>=0x60)return 0;const packed=this.paletteMap[tile>>1];return tile&1?packed>>4&7:packed&7;}
    renderMap(offset){
      const tilemap=MemoryUtils.bytes(this.memory,offset,360),canvas=document.createElement("canvas");canvas.width=160;canvas.height=144;const context=canvas.getContext("2d"),image=context.createImageData(canvas.width,canvas.height);
      for(let cell=0;cell<tilemap.length;cell++){
        const tile=tilemap[cell],palette=this.palettes[this.paletteFor(tile)]||this.palettes[0],source=tile*16,originX=cell%20*8,originY=Math.floor(cell/20)*8;
        for(let y=0;y<8;y++){const low=this.tiles[source+y*2],high=this.tiles[source+y*2+1];for(let x=0;x<8;x++){const index=(low>>(7-x)&1)|((high>>(7-x)&1)<<1),target=((originY+y)*160+originX+x)*4;image.data.set(palette[index],target);}}
      }
      context.putImageData(image,0,0);return canvas;
    }
    sectionForMap(map){return map?.data?.entry?.landmark??map?.entry?.landmark??null;}
    entry(id){return this.entries.find(entry=>entry.id===Number(id))||null;}
    canEdit(entry){return Boolean(entry&&Number.isInteger(entry.offset));}
    updateEntry(entry,{x,y}){
      if(!this.canEdit(entry))throw new Error("This landmark is not writable.");
      x=Number(x);y=Number(y);if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError("Landmark coordinates must be numbers.");
      const rawX=Math.round(x*8),rawY=Math.round(y*8);if(rawX<0||rawX>159||rawY<0||rawY>143)throw new RangeError("Landmark coordinates must fit the native 160 × 144 Town Map.");
      const previous=MemoryUtils.bytes(this.memory,entry.offset,2),next=Uint8Array.of(rawX,rawY);MemoryUtils.replace(this.memory,entry.offset,previous,next);
      const replacement=Object.freeze({...entry,x:rawX/8,y:rawY/8,rawX,rawY});this.entries=Object.freeze(this.entries.map(item=>item.id===entry.id?replacement:item));return{previous,next,entry:replacement};
    }
    hitTest(x,y){return this.entries.filter(entry=>entry.region===this.activeRegion&&Math.floor(entry.x)===x&&Math.floor(entry.y)===y).sort((a,b)=>Number(b.flyable)-Number(a.flyable))[0]||null;}
    renderUsedTiles(canvas){return MinimapUtils.renderUsedTiles(this.maps[this.activeRegion],canvas);}
    render(canvas,{sectionId=null,showLocations=true,showGrid=false}={}){
      const selected=this.entry(sectionId);this.activeRegion=selected?.region||this.activeRegion||"johto";const base=this.maps[this.activeRegion];canvas.width=base.width;canvas.height=base.height;const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;context.drawImage(base,0,0);
      if(showGrid){context.strokeStyle="rgba(255,255,255,.18)";context.lineWidth=1;for(let x=.5;x<canvas.width;x+=8){context.beginPath();context.moveTo(x,0);context.lineTo(x,canvas.height);context.stroke();}for(let y=.5;y<canvas.height;y+=8){context.beginPath();context.moveTo(0,y);context.lineTo(canvas.width,y);context.stroke();}}
      if(showLocations)for(const entry of this.entries.filter(item=>item.region===this.activeRegion&&item.flyable)){context.fillStyle=entry.id===selected?.id?"#fff":"rgba(255,255,255,.72)";context.strokeStyle=entry.id===selected?.id?"#287fc5":"rgba(21,45,63,.7)";context.lineWidth=1;context.fillRect(entry.rawX-2,entry.rawY-2,5,5);context.strokeRect(entry.rawX-2.5,entry.rawY-2.5,6,6);}
      canvas.setAttribute("aria-label",`Crystal ${this.activeRegion==="kanto"?"Kanto":"Johto"} Minimap${selected?`. ${selected.name}`:""}.`);return canvas;
    }
  }
  ns.RegionMap=Gen2RegionMap;
})(globalThis);
