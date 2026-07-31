(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).battle;
  const GBA_TEXT_LAYOUT=Object.freeze({top:112,x:16,y:121,maxWidth:208,lineHeight:16,maxLines:2});
  const GBA_HUD=ns.gba.HudLayout.single;
  const GBA_SINGLE_LAYOUT=Object.freeze({
    opponentCenter:Object.freeze({x:176,y:40}),
    playerCenter:Object.freeze({x:72,y:80}),
    opponentHud:GBA_HUD.opponent.bounds,
    playerHud:GBA_HUD.player.bounds
  });
  const monBounds=(center,coords,elevation=0)=>Object.freeze({
    x:center.x-32,
    y:center.y+coords.yOffset-elevation-32,
    width:64,
    height:64
  });
  class GbaBattleDriver {
    constructor({reader,sceneOnly=false}){
      this.reader=reader;this.memory=reader.memory;this.label="Generation III battle viewer";
      this.screen={width:240,height:160};this.compactStatic=true;this.catalog=this.safeCatalog();
      this.monsters=new ns.GbaMonsterSpriteCatalog(reader);this.trainerSprites=new ns.GbaTrainerSpriteCatalog(reader);
      this.profile=this.monsters.profile;this.font=PokemonViewer.fonts.registry.get(reader,"gba");
      this.hudFont=PokemonViewer.fonts.registry.get(reader,"gba-small");this.backgrounds=new ns.gba.Backgrounds(reader);
      this.hudAssets=ns.HudAssets.create(reader,"gba");
      this.sceneOnly=Boolean(sceneOnly);
      const trainerContract=this.sceneOnly?null:PokemonViewer.gba.GbaTrainerContract.resolve(reader);
      this.trainerData=trainerContract
        ?(reader.gbaTrainerData||=new PokemonViewer.gba.GbaTrainerData(reader,{speciesData:this.monsters.data}))
        :null;
      if(this.trainerData)reader.resourceGraph=this.trainerData.resourceGraph(reader.resourceGraph);
    }
    safeCatalog(){try{return this.reader.structureRegistry.createOverworldSpriteCatalog(this.reader);}catch{return null;}}
    listAnimations(){
      return [new ns.BattleAnimation({
        id:"verified-scene",name:"Verified ROM battle scene",offset:null,
        commands:[{label:"Scene",source:"ROM background + native Species sprite tables"}],
        frames:[{command:0,label:"Static scene"}],
        sprite:this.defaultSprite(),
        properties:[
          {label:"Accuracy",value:"Verified static rendering"},
          {label:"Animation",value:"Read-only command interpreter remains separate"}
        ]
      })];
    }
    findPointerLikeTable(){
      const out=[],limit=Math.min(this.memory.size-4,0x900000);
      for(let offset=0;offset<limit&&out.length<48;offset+=4){
        try{const target=this.memory.pointer(offset);if(Number.isInteger(target)&&target>0x100&&target<this.memory.size)out.push(target);}catch{}
      }
      return out.filter((value,index,array)=>array.indexOf(value)===index);
    }
    animation(id,name,offset){
      const commands=this.decodeCommands(offset);
      const frames=commands.map((command,index)=>({command:index,label:command.label,effects:[{x:150+index%4*8,y:58+index%3*6,radius:5+index%5,color:index%2?"#f45b69":"#f4d35e"}]}));
      return new ns.BattleAnimation({id,name,offset,commands,frames,sprite:this.defaultSprite(),properties:[{label:"Source",value:"Pointer scan MVP"},{label:"Mode",value:"Read-only"}]});
    }
    decodeCommands(offset){
      if(!Number.isInteger(offset))return [{label:"Scene",source:"static_preview"}];
      const commands=[];
      for(let index=0;index<16;index++){
        if(offset+index>=this.memory.size)break;
        const byte=this.memory.u8(offset+index);
        commands.push({label:this.commandName(byte),source:`.byte 0x${byte.toString(16).toUpperCase().padStart(2,"0")}`});
        if(byte===0xff||byte===0x08)break;
      }
      return commands.length?commands:[{label:"Scene",source:"static_preview"}];
    }
    commandName(byte){
      const names={0x00:"load/background",0x01:"delay",0x02:"sprite/object",0x03:"blend/palette",0x04:"sound",0x05:"pan/translate",0x08:"end",0xff:"end"};
      return names[byte]||`battle command 0x${byte.toString(16).toUpperCase().padStart(2,"0")}`;
    }
    defaultSprite(){const first=this.catalog?.list?.()[0];return first?{offset:first.offset,count:4,columns:2,title:first.label}:null;}
    speciesField(){return{label:"Species ID",max:this.profile?.speciesCount||411};}
    listTrainers(){
      return this.trainerData?this.trainerData.list().filter(record=>record.party.length).map(record=>this.toBattleTrainer(record,{sprites:false})):[];
    }
    resolveTrainer(reference){const record=this.trainerData?.resolve(reference);if(!record)return null;const trainer=this.toBattleTrainer(record);trainer.mapReference=reference?.mapReference||null;trainer.environment=reference?.environment||reference?.mapReference?.battleEnvironment||null;return trainer;}
    readTrainer(id){
      if(!this.trainerData)return null;
      return this.toBattleTrainer(this.trainerData.read(id));
    }
    toBattleTrainer(record,{sprites=true}={}){
      const name=this.reader.getTextByOffset(
        this.reader.getDictionary("text_table_en"),record.nameOffset,record.nameLength
      ).replace(/\s+/g," ").trim()||`Trainer ${record.id}`;
      const graphics=mon=>{
        if(!sprites)return{};
        let icon=null;
        try{icon=this.monsters.data.iconSource(mon.species);}catch(error){console.warn("Unable to decode GBA party icon",{species:mon.species,error});}
        return{sprite:this.monsters.source(mon.species),icon};
      };
      const party=record.party.map(mon=>({offset:mon.offset,species:mon.species,speciesName:this.speciesName(mon.species),level:mon.level,item:mon.item,moves:mon.moves,stride:mon.stride,flags:record.flags,...graphics(mon)}));
      const trainer=new ns.BattleTrainer({id:record.id,name,source:`gTrainers · ${this.trainerData.contract.id}`,party,editable:true});
      Object.assign(trainer,{
        flags:record.flags,format:record.format,offset:record.offset,
        classId:record.trainerClass,className:record.trainerClassName,
        trainerPic:record.trainerPic,encounterMusicGender:record.encounterMusicGender,
        items:record.items,doubleBattle:record.doubleBattle,aiFlags:record.aiFlags,
        ...(sprites?{sprite:this.trainerSprites.source(record.trainerPic)}:{}),
        resourceId:`gba:trainer:${record.id}`
      });
      return trainer;
    }
    speciesName(id){const offset=this.profile?.monsterNames+(id*11);return Number.isInteger(offset)?this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),offset,11).trim()||`Species #${id}`:`Species #${id}`;}
    partyEditFields(trainer,mon){
      const fields=[
        {name:"species",label:"Species ID",type:"number",value:mon.species,min:1,max:this.profile.speciesCount,fullWidth:false},
        {name:"level",label:"Level",type:"number",value:mon.level,min:1,max:100,fullWidth:false}
      ];
      if(trainer.format.item)fields.push({name:"item",label:"Held item ID",type:"number",value:mon.item,min:0,max:65535});
      if(trainer.format.moves)for(let slot=0;slot<4;slot++)fields.push({
        name:`move${slot+1}`,label:`Move ${slot+1} ID`,type:"number",
        value:mon.moves[slot],min:0,max:this.trainerData.maximumMoveId,fullWidth:false
      });
      return fields;
    }
    partyEditMessage(trainer){return`Edits one existing ${trainer.format.stride}-byte Generation III party record. IV, compiler padding, party size and pointer remain byte-identical.`;}
    editPartyMon(trainer,index,values,stack){
      const plan=this.trainerData.editPlan(trainer,index,values);
      if(plan.before.every((value,at)=>value===plan.after[at]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"Trainer party changed after this command"});
      stack.execute({label:`Edit trainer Pokémon ${index+1}`,description:`${plan.species.name} · Lv ${plan.level}`,do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)});
      return true;
    }
    battleSpriteSource(species,side="front"){return this.monsters.read(Number(species),side);}
    listBackgrounds(){return this.backgrounds.list();}
    encounter({species,level=1,label="Wild encounter",mapReference=null}={}){
      const id=Number(species),sprite=this.monsters.read(id);if(!sprite)return null;
      const trainer=new ns.BattleTrainer({name:label,source:"Encounter table",party:[{species:id,speciesName:this.speciesName(id),level:Number(level)||1,sprite,icon:this.monsters.data.iconSource(id)}],editable:false});
      trainer.mapReference=mapReference;trainer.encounter=true;return trainer;
    }
    scene({trainer,opponent,phase="battle"}={}){
      const enemySpecies=opponent?.species||trainer?.party?.[0]?.species||1,playerSpecies=enemySpecies;
      const mapEnvironment=trainer?.environment||trainer?.mapReference?.battleEnvironment;
      const environmentReference=Number.isInteger(mapEnvironment?.id)
        ?mapEnvironment
        :{id:9,label:"Plain preview",reason:"Neutral ROM background; open from Map Editor for the map-derived environment"};
      let environment;try{environment=this.backgrounds.source(environmentReference.id);}catch(error){return{verified:false,reason:`The ${environmentReference.label||"selected"} environment could not be decoded from this ROM: ${error.message}`};}
      if(phase==="intro"&&trainer&&!trainer.encounter){
        let portrait=trainer.sprite||null;
        try{portrait||=this.trainerSprites.read(trainer.trainerPic);}
        catch(error){return{verified:false,reason:`Trainer picture ${trainer.trainerPic} could not be decoded: ${error.message}`};}
        if(!portrait)return{verified:false,reason:`Trainer picture ${trainer.trainerPic} has no verified native graphics in this ROM.`};
        const textbox=this.hudAssets.textbox();
        const label=`${trainer.className||"TRAINER"} ${trainer.name}`.replace(/\s+/g," ").trim();
        const resource=Object.freeze({...portrait,previewCanvas:portrait.canvas}),partyStatus=this.hudAssets.partyStatus(trainer.party.length,{side:"opponent"}),partyResource=partyStatus?.resource?Object.freeze({...partyStatus.resource,previewCanvas:partyStatus.image}):null;
        return{
          verified:true,layout:"gen3",nativeHud:true,font:this.font,textLayout:GBA_TEXT_LAYOUT,backgroundCanvas:environment.canvas,backgroundScrollCanvas:environment.scrollCanvas,backgroundViewport:environment.viewport,backgroundLabel:environment.label,textboxCanvas:textbox?.image,
          environment:Object.freeze({...environmentReference,mapDerived:Boolean(mapEnvironment)}),
          enemy:{x:144,y:8,width:64,height:64,image:portrait.canvas},player:null,hud:null,
          overlays:partyStatus?[{x:8,y:32,width:128,height:16,image:partyStatus.image}]:[],
          text:`${label} would like to battle!`,message:Object.freeze({kind:"trainer-intro",template:"{TRAINER_CLASS} {TRAINER_NAME} would like to battle!",trainerClass:trainer.className,trainerName:trainer.name}),
          elements:[{id:"background",kind:"background",label:`${environment.label} environment`,bounds:{x:0,y:0,width:240,height:112},resource:Object.freeze({...environment,previewCanvas:environment.canvas})},{id:"trainer-party",kind:"hud",label:`${trainer.party.length} trainer Poké Balls`,bounds:{x:8,y:32,width:128,height:16},resource:partyResource},{id:"trainer",kind:"trainer",label:`${label} · front picture`,bounds:{x:144,y:8,width:64,height:64},resource,trainerId:trainer.id,trainerClass:trainer.classId,trainerPic:trainer.trainerPic},{id:"textbox",kind:"hud",label:"Trainer introduction message",bounds:{x:0,y:112,width:240,height:48},resource:textbox?.resource?Object.freeze({...textbox.resource,previewCanvas:textbox.image}):null}].filter(item=>item.resource)
        };
      }
      let enemy,player;
      try{enemy=this.monsters.read(enemySpecies,"front");}
      catch(error){return{verified:false,reason:`Species #${enemySpecies} front sprite could not be decoded: ${error.message}`};}
      try{player=this.monsters.read(playerSpecies,"back");}
      catch(error){return{verified:false,reason:`Species #${playerSpecies} back sprite could not be decoded: ${error.message}`};}
      if(!environment)return{verified:false,reason:"This GBA profile has no verified in-ROM battle environment table."};
      if(!enemy)return{verified:false,reason:`Species #${enemySpecies} has no valid front-sprite record in this ROM.`};
      const elevation=Number.isInteger(this.profile?.enemyMonElevation)?this.memory.u8(this.profile.enemyMonElevation+enemySpecies):0;
      const enemyBounds=monBounds(GBA_SINGLE_LAYOUT.opponentCenter,enemy.coords,elevation);
      const playerBounds=player?monBounds(GBA_SINGLE_LAYOUT.playerCenter,player.coords):null;
      const enemyLayer={id:"opponent",kind:"pokemon",label:`${this.speciesName(enemySpecies)} · front`,bounds:enemyBounds,resource:this.battleSpriteSource(enemySpecies,"front"),species:enemySpecies,side:"front"};
      const playerLayer=player?{id:"player",kind:"pokemon",label:`${this.speciesName(playerSpecies)} · back`,bounds:playerBounds,resource:this.battleSpriteSource(playerSpecies,"back"),species:playerSpecies,side:"back"}:null;
      const preview=(resource,canvas)=>resource?Object.freeze({...resource,previewCanvas:canvas}):null;
      const hudState={status:opponent?.status,hp:opponent?.hp,maxHp:opponent?.maxHp,exp:opponent?.exp,maxExp:opponent?.maxExp};
      const enemyHud=this.hudAssets.healthbox("opponent",hudState),playerHud=this.hudAssets.healthbox("player",hudState),hudElements=this.hudAssets.elements(),textbox=this.hudAssets.textbox();
      const status=enemyHud?.statusKind||null;
      return{
        verified:true,layout:"gen3",nativeHud:true,font:this.font,hudFont:this.hudFont,textLayout:GBA_TEXT_LAYOUT,backgroundCanvas:environment.canvas,backgroundScrollCanvas:environment.scrollCanvas,backgroundViewport:environment.viewport,backgroundLabel:environment.label,textboxCanvas:textbox?.image,
        environment:Object.freeze({...environmentReference,mapDerived:Boolean(mapEnvironment)}),
        enemy:{...enemyLayer.bounds,image:enemy.canvas},player:player?{...playerLayer.bounds,image:player.canvas}:null,
        hud:{enemy:{...GBA_SINGLE_LAYOUT.opponentHud,name:this.speciesName(enemySpecies),level:opponent?.level,status,statusInImage:Boolean(status),image:enemyHud?.image,text:GBA_HUD.opponent.text},player:{...GBA_SINGLE_LAYOUT.playerHud,name:this.speciesName(enemySpecies),level:opponent?.level,status,statusInImage:Boolean(status),image:playerHud?.image,text:GBA_HUD.player.text}},
        text:`What will ${this.speciesName(playerSpecies)} do?`,
        elements:[{id:"background",kind:"background",label:`${environment.label} environment`,bounds:{x:0,y:0,width:240,height:112},resource:preview(environment,environment.canvas)},enemyLayer,playerLayer,{id:"textbox",kind:"hud",label:"Battle textbox",bounds:{x:0,y:112,width:240,height:48},resource:preview(textbox?.resource,textbox?.image)},{id:"enemy-hud",kind:"hud",label:"Opponent healthbox",bounds:GBA_SINGLE_LAYOUT.opponentHud,resource:preview(enemyHud?.resource,enemyHud?.image)},{id:"player-hud",kind:"hud",label:"Player healthbox",bounds:GBA_SINGLE_LAYOUT.playerHud,resource:preview(playerHud?.resource,playerHud?.image)},{id:"hp-elements",kind:"hud",label:"HP bar and status tiles",bounds:{x:20,y:26,width:64,height:8},resource:hudElements}].filter(item=>item&&item.resource)
      };
    }
  }
  ns.registry.register("gba",context=>new GbaBattleDriver(context));
})(globalThis);
