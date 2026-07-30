(function(global){
  "use strict";
  const root=global.PokemonViewer||={},battle=root.battle||={};
  const canvas=(width,height)=>{const value=document.createElement("canvas");value.width=width;value.height=height;return value;};
  const bgr555=(memory,offset,count=16)=>Array.from({length:count},(_,index)=>{const color=memory.u16(offset+index*2);return[(color&31)*255/31,((color>>5)&31)*255/31,((color>>10)&31)*255/31,255].map(Math.round);});
  const tile=(bytes,index,palette)=>{
    const out=canvas(8,8),context=out.getContext("2d"),image=context.createImageData(8,8),memory=new RomMemory(bytes),pixels=GbaSpriteCodec.decodeTile(memory,index*32);
    for(let pixel=0;pixel<64;pixel++){const color=palette[pixels[pixel]]||[0,0,0,0];image.data.set(pixels[pixel]?[...color.slice(0,3),255]:[0,0,0,0],pixel*4);}
    context.putImageData(image,0,0);return out;
  };
  const sheet=(bytes,palette,tiles,columns=8)=>{
    const out=canvas(columns*8,Math.ceil(tiles/columns)*8),context=out.getContext("2d");
    for(let index=0;index<tiles;index++)context.drawImage(tile(bytes,index,palette),(index%columns)*8,Math.floor(index/columns)*8);
    return out;
  };

  class GbaBattleHudAssets{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.profile=root.gba.assets.profile(reader);this.cache=new Map();}
    healthbox(side){
      if(this.cache.has(side))return this.cache.get(side);
      const offset=this.profile?.[side==="player"?"healthboxPlayer":"healthboxOpponent"],paletteOffset=this.profile?.healthboxPalette,elementsOffset=this.profile?.healthboxElements;
      if(![offset,paletteOffset,elementsOffset].every(Number.isInteger)||!this.profile?.verifiedReference||this.memory.u8(offset)!==0x10)return null;
      let bytes;try{bytes=root.gba.GbaLz77.decode(this.memory,offset).bytes;}catch{return null;}
      const palette=bgr555(this.memory,paletteOffset),player=side==="player",halfTiles=player?64:32,source=sheet(bytes,palette,halfTiles*2,8),image=canvas(128,player?64:32),context=image.getContext("2d");
      context.drawImage(source,0,0,64,image.height,0,0,64,image.height);
      context.drawImage(source,0,image.height,64,image.height,64,0,64,image.height);
      // battle_interface.c creates a separate 64x8 OBJ for the live HP bar.
      // Its first two tiles are H/P and the remaining six are the filled
      // HEALTHBOX_GFX_HP_BAR_GREEN tiles. Mount that OBJ at the exact
      // single-battle offset relative to the healthbox.
      // SpriteCB_HealthBar places the healthbar origin at main.x + 16 for
      // the player and main.x + 8 for the opponent. Relative to the
      // healthbox's left edge (main.x - 32), the first 32×8 subsprite begins
      // at x=16 and x=8 respectively. The opponent's third 8×8 subsprite is
      // the status/caught slot at x=-32 from the healthbar origin.
      const barX=player?16:8,barY=player?28:12;
      context.drawImage(tile(this.memory.slice(elementsOffset+32,32),0,palette),barX,barY);
      context.drawImage(tile(this.memory.slice(elementsOffset+64,32),0,palette),barX+8,barY);
      const full=tile(this.memory.slice(elementsOffset+11*32,32),0,palette);
      for(let index=0;index<6;index++)context.drawImage(full,barX+16+index*8,barY);
      const resource=Object.freeze({offset,bytes,count:halfTiles*2,columns:8,palette:palette.map(([r,g,b])=>(r<<16)|(g<<8)|b),title:`Emerald ${side} healthbox · ROM LZ77`,editable:false,compressed:true});
      const result=Object.freeze({image,resource});this.cache.set(side,result);return result;
    }
    elements(){
      const offset=this.profile?.healthboxElements,paletteOffset=this.profile?.healthboxPalette;
      if(!this.profile?.verifiedReference||!Number.isInteger(offset)||!Number.isInteger(paletteOffset)||!this.memory.contains(offset,0xec0))return null;
      const bytes=this.memory.slice(offset,0xec0),palette=bgr555(this.memory,paletteOffset);
      return Object.freeze({offset,bytes,count:118,columns:16,palette:palette.map(([r,g,b])=>(r<<16)|(g<<8)|b),title:"Emerald HP bar and status elements · ROM 4bpp",editable:true});
    }
    partyStatus(count=0,{side="opponent"}={}){
      const offset=this.profile?.ballStatusBar,paletteOffset=this.profile?.healthboxPalette,ballPaletteOffset=this.profile?.ballDisplayPalette,elementsOffset=this.profile?.healthboxElements;
      if(!this.profile?.verifiedReference||![offset,paletteOffset,ballPaletteOffset,elementsOffset].every(Number.isInteger)||this.memory.u8(offset)!==0x10)return null;
      const cacheKey=`party-${side}-${Math.max(0,Math.min(6,Number(count)||0))}`;if(this.cache.has(cacheKey))return this.cache.get(cacheKey);
      let bytes;try{bytes=root.gba.GbaLz77.decode(this.memory,offset).bytes;}catch{return null;}
      if(bytes.length!==0x200)return null;
      const occupied=Math.max(0,Math.min(6,Number(count)||0)),barPalette=bgr555(this.memory,paletteOffset),ballPalette=bgr555(this.memory,ballPaletteOffset);
      const image=canvas(128,16),context=image.getContext("2d"),bar=sheet(bytes,barPalette,16,16);
      context.drawImage(bar,0,4);
      for(let slot=0;slot<6;slot++){
        const element=slot<occupied?66:67,ball=tile(this.memory.slice(elementsOffset+element*32,32),0,ballPalette);
        context.drawImage(ball,22+slot*10,0);
      }
      const resource=Object.freeze({offset,bytes,count:16,columns:16,palette:barPalette.map(([r,g,b])=>(r<<16)|(g<<8)|b),paletteOffset,relatedOffsets:[elementsOffset+66*32,ballPaletteOffset],title:"Emerald trainer party status bar · ROM LZ77 and status-ball tiles",editable:false,compressed:true,sourceEncoding:"gBattleInterface_BallStatusBarGfx + gHealthboxElementsGfxTable status balls"});
      const result=Object.freeze({image,resource});this.cache.set(cacheKey,result);return result;
    }
    textbox(){
      if(this.cache.has("textbox"))return this.cache.get("textbox");
      const tilesOffset=this.profile?.battleTextboxTiles,paletteOffset=this.profile?.battleTextboxPalette,tilemapOffset=this.profile?.battleTextboxTilemap;
      if(!this.profile?.verifiedReference||![tilesOffset,paletteOffset,tilemapOffset].every(Number.isInteger))return null;
      try{
        const tiles=root.gba.GbaLz77.decode(this.memory,tilesOffset).bytes,paletteBytes=root.gba.GbaLz77.decode(this.memory,paletteOffset).bytes,tilemap=root.gba.GbaLz77.decode(this.memory,tilemapOffset).bytes;
        const palette=root.gba.GbaTilemapRenderer.colors(paletteBytes),image=root.gba.GbaTilemapRenderer.renderText4bpp({tiles,tilemap,palette,width:30,height:20,stride:32,transparentZero:true});
        const resource=Object.freeze({offset:tilesOffset,bytes:tiles,count:Math.floor(tiles.length/32),columns:16,palette:palette.filter(Boolean).map(([r,g,b])=>(r<<16)|(g<<8)|b),title:"Emerald battle textbox · ROM tiles, palette and tilemap",editable:false,tilemapOffset,paletteOffset});
        const result=Object.freeze({image,resource});this.cache.set("textbox",result);return result;
      }catch{return null;}
    }
  }

  battle.HudAssets.register("gba",reader=>new GbaBattleHudAssets(reader));
})(globalThis);
