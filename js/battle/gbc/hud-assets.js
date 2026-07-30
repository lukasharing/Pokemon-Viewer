(function(global){
  "use strict";
  const battle=((global.PokemonViewer||={}).battle||={});
  const gbc=battle.gbc||(battle.gbc={});
  const canvas=(width,height)=>{const value=document.createElement("canvas");value.width=width;value.height=height;return value;};
  const tile=(memory,offset)=>{
    const out=canvas(8,8),context=out.getContext("2d"),image=context.createImageData(8,8);
    for(let y=0;y<8;y++){const bits=memory.u8(offset+y);for(let x=0;x<8;x++){const on=(bits>>(7-x))&1,target=(y*8+x)*4,value=on?0:255;image.data.set([value,value,value,on?255:0],target);}}
    context.putImageData(image,0,0);return out;
  };
  const tile2bpp=(memory,offset)=>{
    const out=canvas(8,8),context=out.getContext("2d"),image=context.createImageData(8,8),colors=[255,170,85,0];
    for(let y=0;y<8;y++){const low=memory.u8(offset+y*2),high=memory.u8(offset+y*2+1);for(let x=0;x<8;x++){const shift=7-x,value=((high>>shift)&1)*2+((low>>shift)&1),target=(y*8+x)*4,color=colors[value];image.data.set([color,color,color,value?255:0],target);}}
    context.putImageData(image,0,0);return out;
  };
  const expand1bpp=bytes=>{const output=new Uint8Array(bytes.length*2);for(let index=0;index<bytes.length;index++){output[index*2]=bytes[index];output[index*2+1]=bytes[index];}return output;};
  const GEN1_SINGLE_HUD=Object.freeze({
    opponent:Object.freeze({
      bounds:Object.freeze({x:0,y:0,width:96,height:32}),
      text:Object.freeze({nameBaseX:8,nameY:0,nameWidth:80,levelX:40,levelY:8,levelWidth:24,statusX:40,statusY:8,statusWidth:32})
    }),
    player:Object.freeze({
      bounds:Object.freeze({x:72,y:56,width:88,height:40}),
      text:Object.freeze({nameBaseX:80,nameY:56,nameWidth:72,levelX:120,levelY:64,levelWidth:24,statusX:120,statusY:64,statusWidth:32})
    })
  });
  const statusLabel=value=>{
    if(value==null||value===0||value==="")return null;
    if(typeof value==="string"){
      const token=value.trim().toUpperCase();
      if(/SLP|SLEEP/.test(token))return"SLP";
      if(/PSN|POISON|TOXIC/.test(token))return"PSN";
      if(/BRN|BURN/.test(token))return"BRN";
      if(/FRZ|FREEZ/.test(token))return"FRZ";
      if(/PAR/.test(token))return"PAR";
      return null;
    }
    const bits=Number(value)&0xff;
    if(bits&0x7)return"SLP";
    if(bits&0x8)return"PSN";
    if(bits&0x10)return"BRN";
    if(bits&0x20)return"FRZ";
    if(bits&0x40)return"PAR";
    return null;
  };

  class Gen1BattleHudAssets{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.symbols=reader.capabilities?.provenance?.symbols||{};this.base=this.symbols.BattleHudTiles1?.offset??0x12080;this.hp=this.symbols.HpBarAndStatusGraphics?.offset??0x11ea0;this.textboxBase=this.symbols.TextBoxGraphics?.offset??0x12288;this.partyBallBase=this.symbols.PokeballTileGraphics?.offset??0x3a97e;this.tiles=new Map();this.hpTiles=new Map();this.textboxTiles=new Map();this.partyBallTiles=new Map();}
    tile(id){
      if(this.tiles.has(id))return this.tiles.get(id);
      const relative=id-0x6d,offset=relative<6?this.base+relative*8:this.base+0x18+(relative-6)*8,result=tile(this.memory,offset);
      this.tiles.set(id,result);return result;
    }
    hpTile(id){
      if(this.hpTiles.has(id))return this.hpTiles.get(id);
      const result=tile2bpp(this.memory,this.hp+(id-0x62)*16);this.hpTiles.set(id,result);return result;
    }
    drawHpBar(context,x,y){
      [0x71,0x62,...Array(6).fill(0x6b),0x6d].forEach((id,index)=>context.drawImage(this.hpTile(id),x+index*8,y));
    }
    healthbox(side,state={}){
      const player=side==="player",image=canvas(player?88:96,player?40:32),context=image.getContext("2d"),ids=player?[0x6f,...Array(8).fill(0x76),0x77]:[0x74,...Array(8).fill(0x76),0x78];
      ids.forEach((id,index)=>context.drawImage(this.tile(id),index*8,24));
      context.drawImage(this.tile(0x73),player?72:8,16);
      if(!statusLabel(state.status))context.drawImage(this.tile(0x6e),player?40:32,8);
      this.drawHpBar(context,player?8:16,16);
      return Object.freeze({image,resource:Object.freeze({offset:this.base,bytes:expand1bpp(this.memory.slice(this.base,0x48)),count:9,columns:9,palette:[0xffffff,0,0x555555,0],title:`Red/Blue ${side} battle HUD tiles · ROM 1bpp`,editable:false,sourceEncoding:"1bpp doubled by engine"})});
    }
    elements(){return Object.freeze({offset:this.hp,bytes:expand1bpp(this.memory.slice(this.hp,0x1e0)),count:60,columns:10,palette:[0xffffff,0,0x555555,0],title:"Red/Blue HP bar and status patterns · ROM 1bpp",editable:false,sourceEncoding:"1bpp doubled by engine"});}
    partyBallTile(index){
      if(this.partyBallTiles.has(index))return this.partyBallTiles.get(index);
      const result=tile2bpp(this.memory,this.partyBallBase+index*16);this.partyBallTiles.set(index,result);return result;
    }
    partyStatus(count=0,{side="opponent"}={}){
      const occupied=Math.max(0,Math.min(6,Number(count)||0)),image=canvas(48,8),context=image.getContext("2d");
      for(let slot=0;slot<6;slot++){
        const index=slot<occupied?0:3,x=side==="opponent"?(5-slot)*8:slot*8;
        context.drawImage(this.partyBallTile(index),x,0);
      }
      return Object.freeze({
        image,
        resource:Object.freeze({offset:this.partyBallBase,bytes:this.memory.slice(this.partyBallBase,64),count:4,columns:4,palette:[0xffffff,0xaaaaaa,0x555555,0],title:"Red/Blue party Poké Ball states · ROM 2bpp",editable:false,sourceEncoding:"PokeballTileGraphics → native 2bpp OAM tiles"})
      });
    }
    textboxTile(id){
      if(this.textboxTiles.has(id))return this.textboxTiles.get(id);
      const result=tile2bpp(this.memory,this.textboxBase+(id-0x60)*16);this.textboxTiles.set(id,result);return result;
    }
    textbox(){
      const image=canvas(160,144),context=image.getContext("2d"),put=(id,x,y)=>context.drawImage(this.textboxTile(id),x*8,y*8);
      context.fillStyle="#fff";context.fillRect(0,96,160,48);
      put(0x79,0,12);for(let x=1;x<19;x++)put(0x7a,x,12);put(0x7b,19,12);
      for(let y=13;y<17;y++){put(0x7c,0,y);put(0x7c,19,y);}
      put(0x7d,0,17);for(let x=1;x<19;x++)put(0x7a,x,17);put(0x7e,19,17);
      return Object.freeze({image,resource:Object.freeze({offset:this.textboxBase,bytes:this.memory.slice(this.textboxBase,0x200),count:32,columns:8,palette:[0xffffff,0xaaaaaa,0x555555,0],title:"Red/Blue text-box graphics · ROM 2bpp",editable:false,sourceEncoding:"native 2bpp tiles"})});
    }
  }

  gbc.HudLayout=Object.freeze({single:GEN1_SINGLE_HUD,statusLabel});
  battle.HudAssets.register("gbc",reader=>new Gen1BattleHudAssets(reader));
})(globalThis);
