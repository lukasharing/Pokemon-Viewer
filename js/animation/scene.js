(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),ns=(root.animation||={});
  const DMG=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);
  const paint2bpp=(picture,{width=64,height=64,scale=1,palette=DMG}={})=>
    root.graphics.GbPictureCanvas.render(picture,{palette,canvasWidth:width,canvasHeight:height,scale});
  class AnimationSceneFactory{
    static center(layer,fallback){
      if(!layer)return Object.freeze({...fallback});
      return Object.freeze({
        x:Number(layer.x||0)+Number(layer.width||layer.image?.width||0)/2,
        y:Number(layer.y||0)+Number(layer.height||layer.image?.height||0)/2
      });
    }
    static mountedBattle(reader,{species=1}={}){
      const registry=root.battle?.registry;
      if(!registry?.supports?.(reader.family)||typeof global.BattlePreview!=="function")return null;
      const driver=registry.create(reader.family,{reader}),native=driver.scene({opponent:{species,level:5,hp:20,maxHp:20},phase:"battle"});
      if(!native?.verified)return null;
      const player=this.center(native.player,reader.family==="gba"?{x:72,y:80}:{x:48,y:80});
      const opponent=this.center(native.enemy,reader.family==="gba"?{x:176,y:40}:{x:120,y:36});
      const playerBase=reader.family==="gba"?Object.freeze({x:72,y:80}):player;
      const opponentBase=reader.family==="gba"?Object.freeze({x:176,y:40}):opponent;
      return Object.freeze({
        family:reader.family,width:driver.screen.width,height:driver.screen.height,
        // Keep the family-owned scene as separate layers. Baking it into one
        // canvas loses the actual battler bounds and makes callbacks/tasks
        // impossible to compose at their native coordinates.
        nativeScene:native,player:null,opponent:null,
        anchors:Object.freeze({
          screen:Object.freeze({x:0,y:0}),
          player,opponent,target:opponent,user:player,
          // Generation III distinguishes the fixed battler coordinate from
          // BATTLER_COORD_Y_PIC_OFFSET. Family callbacks opt into the exact
          // coordinate space instead of treating every battler anchor alike.
          playerBase,opponentBase,userBase:playerBase,targetBase:opponentBase,
          userPic:player,targetPic:opponent
        })
      });
    }
    static battle(reader,{species=1}={}){
      try{
        const mounted=this.mountedBattle(reader,{species});if(mounted)return mounted;
        if(reader.family==="gba"){
          const catalog=new root.battle.GbaMonsterSpriteCatalog(reader);
          return Object.freeze({family:"gba",width:240,height:160,player:catalog.read(species,"back")?.canvas,opponent:catalog.read(species,"front")?.canvas,
            anchors:Object.freeze({player:{x:40,y:76},opponent:{x:152,y:24},target:{x:176,y:48},user:{x:64,y:104},userBase:{x:64,y:104},targetBase:{x:176,y:48},userPic:{x:64,y:104},targetPic:{x:176,y:48}})});
        }
        if(reader.family==="gbc"){
          const data=reader.gen1SpeciesData||=new root.gen1.Gen1SpeciesData(reader),entry=data.catalog.get(species),base=data.baseStats(entry);
          return Object.freeze({family:"gbc",width:160,height:144,player:paint2bpp(data.backSprite(entry,base),{scale:2}),opponent:paint2bpp(data.frontSprite(entry,base)),
            anchors:Object.freeze({player:{x:16,y:64},opponent:{x:88,y:8},target:{x:120,y:40},user:{x:48,y:96},userBase:{x:48,y:96},targetBase:{x:120,y:40},userPic:{x:48,y:96},targetPic:{x:120,y:40}})});
        }
        if(reader.family==="gen2"){
          const data=reader.gen2SpeciesData||=new root.gen2.Gen2SpeciesData(reader),front=data.frontSprite(species),back=data.backSprite(species),palette=data.palette(species).colors;
          return Object.freeze({family:"gen2",width:160,height:144,
            player:paint2bpp({...back,bytes:back.bytes.slice(0,back.frameBytes)},{width:48,height:48,palette}),
            opponent:paint2bpp({...front,bytes:front.bytes.slice(0,front.frameBytes)},{width:56,height:56,palette}),
            anchors:Object.freeze({player:{x:8,y:48},opponent:{x:96,y:0},target:{x:124,y:28},user:{x:32,y:72},userBase:{x:32,y:72},targetBase:{x:124,y:28},userPic:{x:32,y:72},targetPic:{x:124,y:28}})});
        }
      }catch(error){console.warn("Animation battle scene could not resolve its native battlers.",error);}
      return Object.freeze({family:reader.family,width:reader.family==="gba"?240:160,height:reader.family==="gba"?160:144,player:null,opponent:null,
        anchors:Object.freeze({screen:{x:0,y:0},player:{x:24,y:72},opponent:{x:96,y:16},target:{x:120,y:40},user:{x:48,y:96},userBase:{x:48,y:96},targetBase:{x:120,y:40},userPic:{x:48,y:96},targetPic:{x:120,y:40}})});
    }
  }
  ns.AnimationSceneFactory=AnimationSceneFactory;
})(globalThis);
