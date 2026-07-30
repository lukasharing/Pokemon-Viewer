(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),ns=(root.animation||={});
  const DMG=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);
  const canvas=(width=64,height=64)=>{
    const value=document.createElement("canvas");value.width=width;value.height=height;return value;
  };
  const paint2bpp=(picture,{width=64,height=64,scale=1,palette=DMG}={})=>{
    const output=canvas(width,height),context=output.getContext("2d"),image=context.createImageData(width,height);
    const source=new RomMemory(picture.bytes),drawWidth=picture.width*8*scale,drawHeight=picture.height*8*scale;
    const originX=Math.floor((width-drawWidth)/2),originY=Math.floor((height-drawHeight)/2);
    for(let tile=0;tile<picture.width*picture.height;tile++){
      const pixels=GbcSpriteCodec.decodeTile(source,tile*16),tileX=tile%picture.width*8,tileY=Math.floor(tile/picture.width)*8;
      for(let pixel=0;pixel<64;pixel++){
        const index=pixels[pixel],hex=palette[index]||palette.at(-1),rgb=Number.parseInt(hex.slice(1),16);
        const x=originX+(tileX+pixel%8)*scale,y=originY+(tileY+Math.floor(pixel/8))*scale;
        for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
          const target=((y+dy)*width+x+dx)*4;
          image.data.set([rgb>>16&255,rgb>>8&255,rgb&255,index===0?0:255],target);
        }
      }
    }
    context.putImageData(image,0,0);return output;
  };
  class AnimationSceneFactory{
    static mountedBattle(reader,{species=1}={}){
      const registry=root.battle?.registry;
      if(!registry?.supports?.(reader.family)||typeof global.BattlePreview!=="function")return null;
      const driver=registry.create(reader.family,{reader}),native=driver.scene({opponent:{species,level:5,hp:20,maxHp:20},phase:"battle"});
      if(!native?.verified)return null;
      const output=canvas(driver.screen.width,driver.screen.height),preview=new global.BattlePreview(output);
      preview.render(native,{});
      return Object.freeze({
        family:reader.family,width:driver.screen.width,height:driver.screen.height,baseCanvas:output,player:null,opponent:null,
        anchors:Object.freeze(reader.family==="gba"?{player:{x:72,y:80},opponent:{x:176,y:40},target:{x:176,y:40},user:{x:72,y:80}}:{player:{x:40,y:68},opponent:{x:124,y:28},target:{x:124,y:36},user:{x:48,y:80}})
      });
    }
    static battle(reader,{species=1}={}){
      try{
        const mounted=this.mountedBattle(reader,{species});if(mounted)return mounted;
        if(reader.family==="gba"){
          const catalog=new root.battle.GbaMonsterSpriteCatalog(reader);
          return Object.freeze({family:"gba",width:240,height:160,player:catalog.read(species,"back")?.canvas,opponent:catalog.read(species,"front")?.canvas,
            anchors:Object.freeze({player:{x:40,y:76},opponent:{x:152,y:24},target:{x:176,y:48},user:{x:64,y:104}})});
        }
        if(reader.family==="gbc"){
          const data=reader.gen1SpeciesData||=new root.gen1.Gen1SpeciesData(reader),entry=data.catalog.get(species),base=data.baseStats(entry);
          return Object.freeze({family:"gbc",width:160,height:144,player:paint2bpp(data.backSprite(entry,base),{scale:2}),opponent:paint2bpp(data.frontSprite(entry,base)),
            anchors:Object.freeze({player:{x:16,y:64},opponent:{x:88,y:8},target:{x:120,y:40},user:{x:48,y:96}})});
        }
        if(reader.family==="gen2"){
          const data=reader.gen2SpeciesData||=new root.gen2.Gen2SpeciesData(reader),picture=data.frontSprite(species),palette=data.palette(species).colors;
          return Object.freeze({family:"gen2",width:160,height:144,player:null,opponent:paint2bpp({width:picture.width,height:picture.height,bytes:picture.bytes.slice(0,picture.frameBytes)},{palette}),
            anchors:Object.freeze({player:{x:16,y:64},opponent:{x:88,y:8},target:{x:120,y:40},user:{x:48,y:96}})});
        }
      }catch(error){console.warn("Animation battle scene could not resolve its native battlers.",error);}
      return Object.freeze({family:reader.family,width:reader.family==="gba"?240:160,height:reader.family==="gba"?160:144,player:null,opponent:null,
        anchors:Object.freeze({player:{x:24,y:72},opponent:{x:96,y:16},target:{x:120,y:40},user:{x:48,y:96}})});
    }
  }
  ns.AnimationSceneFactory=AnimationSceneFactory;
})(globalThis);
