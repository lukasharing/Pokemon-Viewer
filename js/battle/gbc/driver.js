(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).battle;
  const GEN1_HUD=ns.gbc.HudLayout.single;
  const GEN1_LAYOUT=Object.freeze({
    opponent:Object.freeze({x:96,y:0,width:56,height:56}),
    player:Object.freeze({x:8,y:40,width:56,height:56}),
    opponentHud:GEN1_HUD.opponent.bounds,
    playerHud:GEN1_HUD.player.bounds,
    hpElements:Object.freeze({x:16,y:16,width:72,height:8})
  });
  const GEN1_TEXT_LAYOUT=Object.freeze({top:96,x:8,y:112,maxWidth:144,lineHeight:16,maxLines:2});
  // pokered's CenterMonName begins two tiles to the right and moves back one
  // tile for each missing pair in a four-character minimum. Longer names keep
  // the full two-tile indent.
  const nameText=(layout,name)=>{
    const length=String(name||"").replace(/@.*$/,"").length;
    return Object.freeze({...layout,nameX:layout.nameBaseX+(length<=2?0:length<=4?8:16)});
  };
  class GbcBattleDriver {
    constructor({reader,sceneOnly=false}){
      this.reader=reader;this.memory=reader.memory;this.label="Generation I battle viewer";this.screen={width:160,height:144};this.compactStatic=true;this.speciesSprites=new Map();this.trainerSprites=new Map();
      this.catalog=this.safeCatalog();this.hudAssets=ns.HudAssets.create(reader,"gbc");this.font=PokemonViewer.fonts.registry.get(reader,"gbc");
      this.speciesData=reader.gen1SpeciesData||=new PokemonViewer.gen1.Gen1SpeciesData(reader);
      this.species=this.speciesData.catalog;
      this.sceneOnly=Boolean(sceneOnly);
      if(!this.sceneOnly){
        this.progressionData=reader.gen1ProgressionData||=new PokemonViewer.gen1.Gen1ProgressionData(reader,{speciesData:this.speciesData});
        this.trainerData=reader.gen1TrainerData||=new PokemonViewer.gen1.Gen1TrainerData(reader,{speciesData:this.speciesData});
        this.refreshGraph();
      }
    }
    safeCatalog(){try{return this.reader.structureRegistry.createOverworldSpriteCatalog(this.memory);}catch{return null;}}
    listAnimations(){
      return [new ns.BattleAnimation({
        id:"verified-scene",name:"Verified ROM battle scene",offset:null,
        commands:[{label:"Scene",source:"Gen I compressed front/back Pokémon pictures"}],
        frames:[{command:0,label:"Static scene"}],sprite:this.battleSpriteSource(0x99,"front"),
        properties:[
          {label:"Accuracy",value:"Verified static rendering"},
          {label:"Source",value:"BaseStats picture pointers + native Gen I compression"},
          {label:"Animation",value:"Read-only command interpreter remains separate"}
        ]
      })];
    }
    findRgbdsAnimationCandidates(){
      const found=[];
      for(let offset=0;offset<this.memory.size-8&&found.length<48;offset++){
        const a=this.memory.u8(offset),b=this.memory.u8(offset+1),c=this.memory.u8(offset+2);
        if((a===0xff||a<0x40)&&b<0xc0&&c<0xc0)found.push(offset);
      }
      return found;
    }
    animation(id,name,offset){
      const commands=this.decodeCommands(offset),frames=commands.map((command,index)=>({command:index,label:command.label,effects:[{x:96-index%3*8,y:52+index%4*5,radius:4+index%4,color:"#306850"}]}));
      return new ns.BattleAnimation({id,name,offset,commands,frames,sprite:this.defaultSprite(),properties:[{label:"Source",value:"Gen I command scan MVP"},{label:"Renderer",value:"DMG/SGB style"}]});
    }
    decodeCommands(offset){
      if(!Number.isInteger(offset))return [{label:"Scene",source:"static_preview"}];
      const commands=[];
      for(let index=0;index<20;index++){
        const byte=this.memory.u8(offset+index);
        commands.push({label:byte===0xff?"end":byte<0x40?"subanimation":"special/effect",source:`db $${byte.toString(16).toUpperCase().padStart(2,"0")}`});
        if(byte===0xff)break;
      }
      return commands;
    }
    defaultSprite(){const first=this.catalog?.list?.()[0];return first?{offset:first.offset,count:4,columns:2,title:first.label}:null;}
    battleSpriteSource(internalId,side="front"){
      return this.speciesSprite(internalId,side);
    }
    speciesField(){return{label:"Internal species ID",max:190};}
    partyEditFields(trainer,mon){
      return[
        {name:"species",label:"Internal species ID",type:"number",value:mon.species,min:1,max:190},
        {name:"level",label:trainer.format==="shared-level"?"Shared party level":"Level",type:"number",value:mon.level,min:1,max:100}
      ];
    }
    partyEditMessage(trainer){
      return trainer.format==="shared-level"
        ?"This native format stores one level for the entire team. Changing it updates every Pokémon in this trainer party; species remains per slot."
        :"This native format stores an independent level and species pair for this party slot.";
    }
    listTrainers(){
      return this.trainerData?.trainers().map(document=>this.toBattleTrainer(document))||[];
    }
    resolveTrainer(reference){
      try{const document=this.trainerData.resolve(reference),trainer=document?this.toBattleTrainer(document,{sprites:true}):null;if(trainer)trainer.mapReference=reference?.mapReference||null;return trainer;}
      catch{return null;}
    }
    toBattleTrainer(document,{sprites=false}={}){
      const trainer=new ns.BattleTrainer({
        id:document.id,classId:document.classId,name:document.name,source:document.source,
        party:document.party.map(member=>Object.freeze({...member,...(sprites?{sprite:this.speciesSprite(member.species,"front")}:{})})),editable:true
      });
      Object.assign(trainer,{number:document.number,offset:document.offset,format:document.format,opponentId:document.opponentId,classAliases:document.classAliases,resourceId:`gen1:trainer:${document.classId}-${document.number}`,...(sprites?{sprite:this.trainerSprite(document.classId)}:{})});
      return trainer;
    }
    trainerSprite(classId){
      if(this.trainerSprites.has(classId))return this.trainerSprites.get(classId);
      const trainerClass=this.trainerData.classDocument(classId),picture=PokemonViewer.gen1.Gen1PicCodec.decode(this.memory,trainerClass.pictureOffset),width=picture.width,height=picture.height,tileCount=width*height;
      const canvas=document.createElement("canvas");canvas.width=width*8;canvas.height=height*8;
      const context=canvas.getContext("2d"),image=context.createImageData(canvas.width,canvas.height),source=new RomMemory(picture.bytes),colors=[[255,255,255,0],[170,170,170,255],[85,85,85,255],[0,0,0,255]];
      for(let tile=0;tile<tileCount;tile++){
        const pixels=GbcSpriteCodec.decodeTile(source,tile*16),tileX=tile%width,tileY=Math.floor(tile/width);
        for(let pixel=0;pixel<64;pixel++){
          const rgba=colors[pixels[pixel]],x=tileX*8+pixel%8,y=tileY*8+Math.floor(pixel/8),target=(y*canvas.width+x)*4;
          image.data[target]=rgba[0];image.data[target+1]=rgba[1];image.data[target+2]=rgba[2];image.data[target+3]=rgba[3];
        }
      }
      context.putImageData(image,0,0);
      const result=Object.freeze({canvas,offset:trainerClass.pictureOffset,bytes:picture.bytes,count:tileCount,columns:width,title:`${trainerClass.name} trainer picture · native Gen I compression`,editable:false,sourceEncoding:"Gen I trainer picture compression → native 2bpp tiles"});
      this.trainerSprites.set(classId,result);return result;
    }
    speciesSprite(internalId,side="front"){
      const key=`${internalId}:${side}`;if(this.speciesSprites.has(key))return this.speciesSprites.get(key);
      const species=this.species.get(Number(internalId));
      if(!species?.dexNumber)return null;
      const base=this.speciesData.baseStats(species),back=side==="back";
      const picture=back?this.speciesData.backSprite(species,base):this.speciesData.frontSprite(species,base);
      const scale=back?2:1,canvasSize=back?64:56,canvas=document.createElement("canvas");canvas.width=canvas.height=canvasSize;
      const context=canvas.getContext("2d"),image=context.createImageData(canvasSize,canvasSize),source=new RomMemory(picture.bytes);
      const width=picture.width*8*scale,height=picture.height*8*scale;
      // Front pictures are mounted in the engine's 7×7 battle picture area.
      // Using an 8-tile centring box shifts narrow species one complete tile.
      const originX=back?0:Math.ceil((7-picture.width)/2)*8,originY=back?0:(7-picture.height)*8;
      const colors=[[255,255,255,0],[170,170,170,255],[85,85,85,255],[0,0,0,255]];
      for(let tile=0;tile<picture.width*picture.height;tile++){
        const pixels=GbcSpriteCodec.decodeTile(source,tile*16),tileX=tile%picture.width,tileY=Math.floor(tile/picture.width);
        for(let pixel=0;pixel<64;pixel++){
          const rgba=colors[pixels[pixel]],x=originX+(tileX*8+pixel%8)*scale,y=originY+(tileY*8+Math.floor(pixel/8))*scale;
          for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
            const target=((y+dy)*canvasSize+x+dx)*4;
            image.data[target]=rgba[0];image.data[target+1]=rgba[1];image.data[target+2]=rgba[2];image.data[target+3]=rgba[3];
          }
        }
      }
      context.putImageData(image,0,0);
      const result=Object.freeze({
        canvas,offset:picture.offset,bytes:picture.bytes,
        count:picture.width*picture.height,columns:picture.width,
        palette:["#ffffff","#aaaaaa","#555555","#000000"],
        title:`${species.name} ${side} battle sprite · native Gen I picture`,
        species:internalId,side,compressedOffset:picture.offset,editable:false,
        sourceEncoding:"Gen I picture compression → native 2bpp tiles"
      });
      this.speciesSprites.set(key,result);return result;
    }
    refreshGraph(){
      const progression=this.progressionData.resourceGraph(this.speciesData.resourceGraph());
      this.reader.resourceGraph=this.trainerData.resourceGraph(progression);
      ProjectEvents.resources(this.reader.resourceGraph);
      return this.reader.resourceGraph;
    }
    editPartyMon(trainer,index,values,stack){
      const mon=trainer.party[index];if(!mon)return false;
      const species=this.species.get(Number(values.species)),level=Number(values.level);
      if(!species)throw new RangeError("Gen I internal species ID must be 1–190.");
      if(species.isGlitch&&globalThis.editorPreferences?.experience!=="nerd")throw new RangeError("MissingNo. slots are available only in Nerd mode.");
      if(!Number.isInteger(level)||level<1||level>100)throw new RangeError("Level must be 1–100.");
      const before={species:mon.species,level:mon.level},after={species:species.id,level};
      if(before.species===after.species&&before.level===after.level)return false;
      const apply=value=>{
        const plan=this.trainerData.editPatches(trainer,index,value);
        MemoryUtils.replaceAll(this.memory,plan.patches);
        this.trainerData.invalidate();this.refreshGraph();
      };
      stack.execute({label:`Edit ${trainer.name} Pokémon ${index+1}`,description:`${species.name} · Lv ${level}`,do:()=>apply(after),undo:()=>apply(before)});
      return true;
    }
    listBackgrounds(){return[{id:"gen1-native",label:"Generation I battle field"}];}
    encounter({species,level=1,label="Wild encounter",mapReference=null}={}){
      const id=Number(species),record=this.species.get(id);if(!record)return null;
      const trainer=new ns.BattleTrainer({name:label,source:"Encounter table",party:[{species:id,speciesName:record.name,level:Number(level)||1,sprite:this.speciesSprite(id,"front")}],editable:false});
      trainer.mapReference=mapReference;trainer.encounter=true;return trainer;
    }
    scene({trainer,opponent,phase="battle"}={}){
      if(phase==="intro"&&trainer&&!trainer.encounter){
        const portrait=trainer.sprite||this.trainerSprite(trainer.classId),textbox=this.hudAssets.textbox(),label=trainer.name,partyStatus=this.hudAssets.partyStatus(trainer.party.length,{side:"opponent"});
        const resource=Object.freeze({...portrait,previewCanvas:portrait.canvas}),partyResource=Object.freeze({...partyStatus.resource,previewCanvas:partyStatus.image});
        return{
          verified:true,layout:"gen1",nativeHud:true,font:this.font,textLayout:GEN1_TEXT_LAYOUT,background:["#ffffff","#ffffff"],platform:false,textboxCanvas:textbox.image,
          enemy:{...GEN1_LAYOUT.opponent,image:portrait.canvas},player:null,hud:null,
          overlays:[{x:24,y:16,width:48,height:8,image:partyStatus.image}],
          text:`${label} wants to fight!`,message:Object.freeze({kind:"trainer-intro",template:"{TRAINER_NAME} wants to fight!",trainerName:label}),
          elements:[{id:"trainer-party",kind:"hud",label:`${trainer.party.length} trainer Poké Balls`,bounds:{x:24,y:16,width:48,height:8},resource:partyResource},{id:"trainer",kind:"trainer",label:`${label} · trainer picture`,bounds:GEN1_LAYOUT.opponent,resource,trainerClass:trainer.classId},{id:"textbox",kind:"hud",label:"Trainer introduction message",bounds:{x:0,y:96,width:160,height:48},resource:Object.freeze({...textbox.resource,previewCanvas:textbox.image})}]
        };
      }
      const enemyId=opponent?.species||trainer?.party?.[0]?.species||0x99,playerId=enemyId;
      const enemy=this.speciesSprite(enemyId,"front"),player=this.speciesSprite(playerId,"back");
      if(!enemy)return{verified:false,reason:`Internal species #${enemyId} has no canonical Gen I battle picture.`};
      const enemyName=this.species.get(enemyId)?.name||`Species ${enemyId}`;
      const enemyLayer={id:"opponent",kind:"pokemon",label:`${enemyName} · front`,bounds:GEN1_LAYOUT.opponent,resource:enemy,species:enemyId,side:"front"};
      const playerLayer=player?{id:"player",kind:"pokemon",label:`${enemyName} · back`,bounds:GEN1_LAYOUT.player,resource:player,species:playerId,side:"back"}:null;
      const status=ns.gbc.HudLayout.statusLabel(opponent?.status),hudState={status,hp:opponent?.hp,maxHp:opponent?.maxHp};
      const enemyHud=this.hudAssets.healthbox("opponent",hudState),playerHud=this.hudAssets.healthbox("player",hudState),hudElements=this.hudAssets.elements(),textbox=this.hudAssets.textbox();
      const preview=(resource,canvas)=>resource?Object.freeze({...resource,previewCanvas:canvas}):null;
      return{
        verified:true,layout:"gen1",nativeHud:true,font:this.font,textLayout:GEN1_TEXT_LAYOUT,background:["#ffffff","#ffffff"],platform:false,textboxCanvas:textbox.image,
        enemy:{...enemyLayer.bounds,image:enemy.canvas},player:player?{...playerLayer.bounds,image:player.canvas}:null,
        hud:{enemy:{...GEN1_LAYOUT.opponentHud,name:enemyName,level:opponent?.level,status,image:enemyHud.image,text:nameText(GEN1_HUD.opponent.text,enemyName)},player:{...GEN1_LAYOUT.playerHud,name:enemyName,level:opponent?.level,status,image:playerHud.image,text:nameText(GEN1_HUD.player.text,enemyName)}},
        text:trainer?.encounter?`WILD ${enemyName} APPEARED!`:`${trainer?.name||"TRAINER"} SENT OUT ${enemyName}!`,
        elements:[{id:"background",kind:"background",label:"Generation I battle field",bounds:{x:0,y:0,width:160,height:96}},enemyLayer,playerLayer,{id:"enemy-hud",kind:"hud",label:"Opponent HUD tiles",bounds:GEN1_LAYOUT.opponentHud,resource:preview(enemyHud.resource,enemyHud.image)},{id:"player-hud",kind:"hud",label:"Player HUD tiles",bounds:GEN1_LAYOUT.playerHud,resource:preview(playerHud.resource,playerHud.image)},{id:"hp-elements",kind:"hud",label:"HP bar and status patterns",bounds:GEN1_LAYOUT.hpElements,resource:hudElements},{id:"textbox",kind:"hud",label:"Battle textbox",bounds:{x:0,y:96,width:160,height:48},resource:preview(textbox.resource,textbox.image)}].filter(Boolean)
      };
    }
  }
  ns.registry.register("gbc",context=>new GbcBattleDriver(context));
})(globalThis);
