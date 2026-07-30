(function(global){
  "use strict";
  const root=global.PokemonViewer||={},battle=root.battle||={};
  const gba=battle.gba||(battle.gba={});
  const canvas=(width,height)=>{const value=document.createElement("canvas");value.width=width;value.height=height;return value;};
  const bgr555=(memory,offset,count=16)=>Array.from({length:count},(_,index)=>{const color=memory.u16(offset+index*2);return[(color&31)*255/31,((color>>5)&31)*255/31,((color>>10)&31)*255/31,255].map(Math.round);});
  const rgb5=(red,green,blue)=>[red*255/31,green*255/31,blue*255/31,255].map(Math.round);
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
  const GBA_SINGLE_HUD=Object.freeze({
    opponent:Object.freeze({
      bounds:Object.freeze({x:12,y:14,width:128,height:32}),
      text:Object.freeze({
        nameX:20,nameY:17,nameWidth:56,nameClip:Object.freeze({x:20,y:14,width:56,height:16}),
        levelX:76,levelY:17,levelWidth:16,levelClip:Object.freeze({x:76,y:14,width:16,height:16}),
        levelGlyph:0x105,levelDigitAlign:5
      }),
      bar:Object.freeze({x:24,y:16}),
      status:Object.freeze({x:8,y:16,battler:1,paletteIndex:13})
    }),
    player:Object.freeze({
      // CreateBattlerHealthboxSprites changes the two 64x32 OAM objects to
      // square without recalculating centerToCornerVecY. Their hardware top
      // therefore remains y - 16 (72), not y - 32 (56).
      bounds:Object.freeze({x:126,y:72,width:128,height:64}),
      text:Object.freeze({
        nameX:142,nameY:75,nameWidth:56,nameClip:Object.freeze({x:142,y:72,width:56,height:16}),
        levelX:198,levelY:75,levelWidth:16,levelClip:Object.freeze({x:198,y:72,width:16,height:16}),
        levelGlyph:0x105,levelDigitAlign:5
      }),
      bar:Object.freeze({x:32,y:16}),
      status:Object.freeze({x:16,y:24,battler:0,paletteIndex:12}),
      exp:Object.freeze({x:32,y:32})
    })
  });
  const statusKind=value=>{
    if(value==null||value===0||value==="")return null;
    if(typeof value==="string"){
      const token=value.trim().toLowerCase();
      if(/sleep|slp/.test(token))return"sleep";
      if(/toxic|poison|psn/.test(token))return"poison";
      if(/burn|brn/.test(token))return"burn";
      if(/freeze|frozen|frz/.test(token))return"freeze";
      if(/paral|prz|par/.test(token))return"paralysis";
      return null;
    }
    const bits=Number(value)>>>0;
    if(bits&0x7)return"sleep";
    if(bits&0x88)return"poison";
    if(bits&0x10)return"burn";
    if(bits&0x20)return"freeze";
    if(bits&0x40)return"paralysis";
    return null;
  };
  const STATUS=Object.freeze({
    sleep:Object.freeze({player:27,opponent:77,color:rgb5(20,20,17)}),
    poison:Object.freeze({player:21,opponent:71,color:rgb5(24,12,24)}),
    burn:Object.freeze({player:33,opponent:83,color:rgb5(28,14,10)}),
    freeze:Object.freeze({player:30,opponent:80,color:rgb5(17,22,28)}),
    paralysis:Object.freeze({player:24,opponent:74,color:rgb5(23,23,3)})
  });
  const fraction=(value,maxValue,fallback=1)=>{
    const current=Number(value),max=Number(maxValue);
    return Number.isFinite(current)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,current/max)):fallback;
  };

  class GbaBattleHudAssets{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.profile=root.gba.assets.profile(reader);this.cache=new Map();}
    base(side){
      const cacheKey=`base-${side}`;if(this.cache.has(cacheKey))return this.cache.get(cacheKey);
      const offset=this.profile?.[side==="player"?"healthboxPlayer":"healthboxOpponent"],paletteOffset=this.profile?.healthboxPalette,elementsOffset=this.profile?.healthboxElements;
      if(![offset,paletteOffset,elementsOffset].every(Number.isInteger)||!this.profile?.verifiedReference||this.memory.u8(offset)!==0x10)return null;
      let bytes;try{bytes=root.gba.GbaLz77.decode(this.memory,offset).bytes;}catch{return null;}
      const palette=bgr555(this.memory,paletteOffset),player=side==="player",halfTiles=player?64:32,source=sheet(bytes,palette,halfTiles*2,8),image=canvas(128,player?64:32),context=image.getContext("2d");
      context.drawImage(source,0,0,64,image.height,0,0,64,image.height);
      context.drawImage(source,0,image.height,64,image.height,64,0,64,image.height);
      const resource=Object.freeze({offset,bytes,count:halfTiles*2,columns:8,palette:palette.map(([r,g,b])=>(r<<16)|(g<<8)|b),title:`Emerald ${side} healthbox · ROM LZ77`,editable:false,compressed:true});
      const result=Object.freeze({image,resource,palette,elementsOffset});this.cache.set(cacheKey,result);return result;
    }
    element(id,palette){
      const offset=this.profile.healthboxElements+Number(id)*32;
      return tile(this.memory.slice(offset,32),0,palette);
    }
    drawBar(context,layout,palette,ratio,status){
      const {x,y}=layout.bar,hasOpponentStatus=layout===GBA_SINGLE_HUD.opponent&&Boolean(status);
      context.drawImage(this.element(hasOpponentStatus?0:1,palette),x,y);
      context.drawImage(this.element(hasOpponentStatus?65:2,palette),x+8,y);
      const filled=Math.round(Math.max(0,Math.min(1,ratio))*48),base=filled>24?3:filled>9?47:56;
      for(let index=0;index<6;index++){
        const pixels=Math.max(0,Math.min(8,filled-index*8));
        context.drawImage(this.element(base+pixels,palette),x+16+index*8,y);
      }
    }
    drawStatus(context,side,layout,palette,status){
      const kind=statusKind(status);if(!kind)return null;
      const entry=STATUS[kind],statusPalette=palette.map(color=>color.slice());
      statusPalette[layout.status.paletteIndex]=entry.color;
      const start=entry[side];
      for(let index=0;index<3;index++)context.drawImage(this.element(start+index,statusPalette),layout.status.x+index*8,layout.status.y);
      return kind;
    }
    drawExp(context,layout,palette,ratio){
      if(!layout.exp)return;
      const filled=Math.round(Math.max(0,Math.min(1,ratio))*64);
      for(let index=0;index<8;index++){
        const pixels=Math.max(0,Math.min(8,filled-index*8));
        context.drawImage(this.element(12+pixels,palette),layout.exp.x+index*8,layout.exp.y);
      }
    }
    healthbox(side,state={}){
      const base=this.base(side);if(!base)return null;
      const layout=GBA_SINGLE_HUD[side],image=canvas(base.image.width,base.image.height),context=image.getContext("2d"),kind=statusKind(state.status);
      context.drawImage(base.image,0,0);
      this.drawBar(context,layout,base.palette,fraction(state.hp,state.maxHp),kind);
      this.drawStatus(context,side,layout,base.palette,state.status);
      if(side==="player")this.drawExp(context,layout,base.palette,fraction(state.exp,state.maxExp,0));
      return Object.freeze({image,resource:base.resource,statusKind:kind});
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

  gba.HudLayout=Object.freeze({single:GBA_SINGLE_HUD,statusKind});
  battle.HudAssets.register("gba",reader=>new GbaBattleHudAssets(reader));
})(globalThis);
