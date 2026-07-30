(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const rgb=(r,g,b)=>`#${[r,g,b].map(value=>Math.round(value*255/31).toString(16).padStart(2,"0")).join("")}`;
  const PALETTES=Object.freeze([
    ["#ffffff","#d0d0d0","#686868","#000000"],
    ["#ffffff",rgb(31,31,7),rgb(31,16,1),"#000000"],
    ["#ffffff",rgb(31,19,24),rgb(30,10,6),"#000000"],
    ["#ffffff",rgb(12,25,1),rgb(5,14,0),"#000000"],
    ["#ffffff",rgb(8,12,31),rgb(1,4,31),"#000000"],
    ["#ffffff",rgb(24,18,7),rgb(20,15,3),"#000000"]
  ]);
  const signed=value=>value>127?value-256:value;
  class Gen2BattleAnimationVisuals{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=reader.memoryProfile;this.cache=new Map();
      this.objects=this.require("BattleAnimObjects");this.frames=this.require("BattleAnimFrameData");this.oam=this.require("BattleAnimOAMData");this.graphics=this.require("AnimObjGFX");
    }
    require(name){const symbol=this.profile?.symbol(name);if(!Number.isInteger(symbol?.offset))throw new Error(`Crystal source dictionary is missing ${name}.`);return symbol;}
    pointer(symbol,at){return this.memory.banked(symbol.bank,this.memory.u16(at));}
    graphic(id){
      const at=this.graphics.offset+id*4;this.memory.assertRange(at,4);
      const tiles=this.memory.u8(at),bank=this.memory.u8(at+1),address=this.memory.u16(at+2);
      if(!tiles||!address)return null;
      const offset=this.memory.banked(bank,address),decoded=GscLz.decompress(this.memory,offset,{maxOutput:tiles*16,maxInput:0x4000}).bytes;
      if(decoded.length<tiles*16)throw new RangeError(`Crystal animation graphics ${id} decoded fewer than ${tiles} tiles.`);
      return Object.freeze({id,tiles,offset,bytes:decoded.slice(0,tiles*16),name:ns.sourceCatalog?.gen2Graphics?.[id]?.name||`Graphics ${id}`});
    }
    renderOam(oamSet,gfx,paletteId,frameFlags=0){
      const oamRecord=this.oam.offset+oamSet*4;this.memory.assertRange(oamRecord,4);
      const tileBase=this.memory.u8(oamRecord),count=this.memory.u8(oamRecord+1),oamPointer=this.pointer(this.oam,oamRecord+2);
      this.memory.assertRange(oamPointer,count*4);
      const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
      const context=canvas.getContext("2d"),image=context.createImageData(64,64),source=new RomMemory(gfx.bytes);
      const palette=PALETTES[Math.max(0,Math.min(PALETTES.length-1,paletteId-2))]||PALETTES[0],frameFlipX=Boolean(frameFlags&0x40),frameFlipY=Boolean(frameFlags&0x80);
      for(let item=0;item<count;item++){
        const entry=oamPointer+item*4,rawY=signed(this.memory.u8(entry)),rawX=signed(this.memory.u8(entry+1)),tile=tileBase+this.memory.u8(entry+2),attributes=this.memory.u8(entry+3);
        if(tile>=gfx.tiles)continue;
        const pixels=GbcSpriteCodec.decodeTile(source,tile*16),flipX=Boolean(attributes&0x20)^frameFlipX,flipY=Boolean(attributes&0x40)^frameFlipY;
        const dx=frameFlipX?-rawX-8:rawX,dy=frameFlipY?-rawY-8:rawY;
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){
          const colorIndex=pixels[(flipY?7-y:y)*8+(flipX?7-x:x)],px=32+dx+x,py=32+dy+y;if(px<0||py<0||px>=64||py>=64)continue;
          const hex=palette[colorIndex],color=Number.parseInt(hex.slice(1),16),target=(py*64+px)*4;
          image.data.set([color>>16&255,color>>8&255,color&255,colorIndex===0?0:255],target);
        }
      }
      context.putImageData(image,0,0);
      return Object.freeze({canvas,width:64,height:64,oamSet,oamPointer,count});
    }
    decodeFrameset(id,gfx,paletteId){
      const start=this.pointer(this.frames,this.frames.offset+id*2),frames=[];let cursor=start;
      for(let step=0;step<64&&this.memory.contains(cursor);step++){
        const opcode=this.memory.u8(cursor++);
        if(opcode===0xfc||opcode===0xff)break;
        if(opcode===0xfe){if(!frames.length)break;else continue;}
        if(opcode===0xfd){this.memory.assertRange(cursor);cursor++;continue;}
        this.memory.assertRange(cursor);const flags=this.memory.u8(cursor++),duration=Math.max(1,flags&0x3f);
        frames.push(Object.freeze({...this.renderOam(opcode,gfx,paletteId,flags),duration,flags}));
      }
      return Object.freeze(frames);
    }
    object(id){
      if(this.cache.has(id))return this.cache.get(id);
      const at=this.objects.offset+id*6;this.memory.assertRange(at,6);
      const flags=this.memory.u8(at),yFix=this.memory.u8(at+1),frameset=this.memory.u8(at+2),callback=this.memory.u8(at+3),paletteId=this.memory.u8(at+4),graphicId=this.memory.u8(at+5);
      const gfx=this.graphic(graphicId);if(!gfx)return null;
      const frames=this.decodeFrameset(frameset,gfx,paletteId);if(!frames.length){this.cache.set(id,null);return null;}
      const first=frames[0];
      const sourceName=ns.sourceCatalog?.gen2Objects?.[id],asset=Object.freeze({
        id,flags,yFix,frameset,callback,paletteId,graphicId,gfx,frames,oamSet:first.oamSet,oamPointer:first.oamPointer,canvas:first.canvas,width:64,height:64,
        name:sourceName?.name||`Object ${id}`,symbol:sourceName?.symbol||null,
        sourceEncoding:"BattleAnimObjects → BattleAnimFrameData → BattleAnimOAMData → AnimObjGFX · native Crystal LZ/2bpp"
      });
      this.cache.set(id,asset);return asset;
    }
    decorate(commands){
      return commands.map(command=>{
        if(command.opcode!==0xd0)return command;
        const event={...(command.event||{})},asset=this.object(Number(command.args?.[0]));
        if(asset)event.value=Object.freeze({...event.value,asset,label:asset.name});
        return Object.freeze({...command,event:Object.freeze(event)});
      });
    }
  }
  ns.Gen2BattleAnimationVisuals=Gen2BattleAnimationVisuals;
})(globalThis);
