(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),ns=root.animation;

  const CONTRACT_NAME="GbaBattleAnimationBackgrounds";
  const hex=color=>`#${color.slice(0,3).map(value=>value.toString(16).padStart(2,"0")).join("")}`;

  class GbaAnimationBackgrounds{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.table=null;this.searched=false;this.cache=new Map();
      this.contract=reader.memoryProfile?.structure?.(CONTRACT_NAME)||null;
      const contract=this.contract,fields=contract?.fields;
      if(!Number.isInteger(contract?.count)||!Number.isInteger(contract?.recordSize)
        ||!Number.isInteger(contract?.paletteBytes)||!Array.isArray(contract?.names)
        ||contract.names.length!==contract.count||!fields?.image||!fields?.palette||!fields?.tilemap){
        throw new Error("The selected GBA engine has no reviewed battle-animation background contract.");
      }
    }
    symbolOffset(){
      const offset=this.reader.capabilities?.provenance?.symbols?.gBattleAnimBackgroundTable?.offset;
      return Number.isInteger(offset)?offset:null;
    }
    compressedLength(offset){
      if(!Number.isInteger(offset)||!this.memory.contains(offset,4)||this.memory.u8(offset)!==0x10)return null;
      return this.memory.u8(offset+1)|this.memory.u8(offset+2)<<8|this.memory.u8(offset+3)<<16;
    }
    validTable(offset){
      const contract=this.contract,{image,palette,tilemap}=contract.fields;
      if(!Number.isInteger(offset)||!this.memory.contains(offset,contract.count*contract.recordSize))return false;
      const [firstDuplicate,secondDuplicate]=contract.duplicateRecords||[];
      if(Number.isInteger(firstDuplicate)&&Number.isInteger(secondDuplicate)){
        for(let byte=0;byte<contract.recordSize;byte++){
          if(this.memory.u8(offset+firstDuplicate*contract.recordSize+byte)
            !==this.memory.u8(offset+secondDuplicate*contract.recordSize+byte))return false;
        }
      }
      for(let id=0;id<contract.count;id++){
        const record=offset+id*contract.recordSize;
        let imageOffset,paletteOffset,tilemapOffset;
        try{
          imageOffset=this.memory.pointer(record+image.byte);
          paletteOffset=this.memory.pointer(record+palette.byte);
          tilemapOffset=this.memory.pointer(record+tilemap.byte);
        }catch{return false;}
        const imageLength=this.compressedLength(imageOffset),
          paletteLength=this.compressedLength(paletteOffset),
          tilemapLength=this.compressedLength(tilemapOffset);
        if(!imageLength||imageLength>image.maximumBytes||imageLength%image.multipleOf)return false;
        if(paletteLength!==palette.exactBytes)return false;
        if(!tilemapLength||tilemapLength<tilemap.minimumBytes
          ||tilemapLength>tilemap.maximumBytes||tilemapLength%tilemap.multipleOf)return false;
      }
      return true;
    }
    locate(){
      if(this.searched)return this.table;
      this.searched=true;
      const exact=this.symbolOffset();
      if(exact!==null&&this.validTable(exact))return this.table=exact;
      let match=null;
      for(let offset=0;offset<=this.memory.size-this.contract.count*this.contract.recordSize;offset+=4){
        if(!this.validTable(offset))continue;
        if(match!==null)throw new Error("Ambiguous GBA battle-animation background tables.");
        match=offset;
      }
      return this.table=match;
    }
    record(id){
      id=Number(id);const table=this.locate();
      const contract=this.contract,fields=contract.fields;
      if(!Number.isInteger(table)||!Number.isInteger(id)||id<0||id>=contract.count)return null;
      const offset=table+id*contract.recordSize;
      return Object.freeze({
        id,label:contract.names[id],offset,
        image:this.memory.pointer(offset+fields.image.byte),
        palette:this.memory.pointer(offset+fields.palette.byte),
        tilemap:this.memory.pointer(offset+fields.tilemap.byte)
      });
    }
    render(tiles,tilemap,palette){
      const renderer=root.gba?.GbaTilemapRenderer;
      if(typeof renderer?.renderText4bpp!=="function"){
        throw new Error("GBA animation background rendering requires the GBA tilemap codec.");
      }
      return renderer.renderText4bpp({
        tiles,tilemap,palette,width:30,height:20,stride:32
      });
    }
    source(id){
      id=Number(id);if(this.cache.has(id))return this.cache.get(id);
      const record=this.record(id);if(!record)return null;
      const platform=root.gba,decoder=platform?.GbaLz77,renderer=platform?.GbaTilemapRenderer;
      if(typeof decoder?.decode!=="function"){
        throw new Error("GBA animation background rendering requires the GBA LZ77 codec.");
      }
      if(typeof renderer?.colors!=="function"||typeof renderer?.renderText4bpp!=="function"){
        throw new Error("GBA animation background rendering requires the GBA tilemap codec.");
      }
      const fields=this.contract.fields,
        tiles=decoder.decode(this.memory,record.image,{maxOutput:fields.image.maximumBytes}).bytes,
        paletteBytes=decoder.decode(this.memory,record.palette,{maxOutput:fields.palette.exactBytes}).bytes,
        tilemap=decoder.decode(this.memory,record.tilemap,{maxOutput:fields.tilemap.maximumBytes}).bytes,
        palette=renderer.colors(paletteBytes,{base:32}),
        sourcePalette=palette.slice(),
        cycles=[];
      // AnimTask_SetPsychicBackground rotates native palette entries 1..11.
      // Precomposing exact phases keeps GBA palette-bank knowledge here.
      for(let phase=0;phase<11;phase++){
        cycles.push(this.render(tiles,tilemap,palette));
        const last=palette[43];
        for(let index=42;index>32;index--)palette[index+1]=palette[index];
        palette[33]=last;
      }
      const result=Object.freeze({
        id,label:record.label,canvas:cycles[0],paletteCycles:Object.freeze(cycles),
        scrollCanvas:tilemap.length>=32*32*2?renderer.renderText4bpp({
          tiles,tilemap,palette:sourcePalette,width:32,height:32,stride:32
        }):null,
        viewport:Object.freeze({width:240,height:160}),
        tableOffset:this.table,recordOffset:record.offset,tilesOffset:record.image,
        paletteOffset:record.palette,tilemapOffset:record.tilemap,
        palette:Object.freeze(sourcePalette.slice(32,48).map(hex)),
        sourceEncoding:"gBattleAnimBackgroundTable · LZ77 · 4bpp text background",
        verified:true
      });
      this.cache.set(id,result);return result;
    }
  }

  ns.GBA_ANIMATION_BACKGROUND_CONTRACT=CONTRACT_NAME;
  ns.GbaAnimationBackgrounds=GbaAnimationBackgrounds;
})(globalThis);
