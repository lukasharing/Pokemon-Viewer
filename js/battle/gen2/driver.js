(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).battle;
  class Gen2BattleDriver {
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.label="Generation II battle viewer";this.screen={width:160,height:144};this.catalog=this.safeCatalog();this.speciesSprites=new Map();this.trainerSprites=new Map();
      this.speciesData=reader.gen2SpeciesData||=new PokemonViewer.gen2.Gen2SpeciesData(reader);
      this.progressionData=reader.gen2ProgressionData||=new PokemonViewer.gen2.Gen2ProgressionData(reader,{speciesData:this.speciesData});
      this.trainerData=reader.gen2TrainerData||=new PokemonViewer.gen2.Gen2TrainerData(reader,{speciesData:this.speciesData,moveData:this.progressionData.moves});
      // Resource graphs are indexed outside the editor's startup path.
    }
    safeCatalog(){try{return this.reader.structureRegistry.createOverworldSpriteCatalog(this.memory);}catch{return null;}}
    listAnimations(){
      return [];
    }
    findCommandStreams(){
      const found=[];
      for(let offset=0;offset<this.memory.size-6&&found.length<48;offset++){
        const a=this.memory.u8(offset),b=this.memory.u8(offset+1),c=this.memory.u8(offset+2);
        if(a<=0x3f&&b<=0x7f&&c<=0x7f)found.push(offset);
      }
      return found;
    }
    animation(id,name,offset){
      const commands=this.decodeCommands(offset),frames=commands.map((command,index)=>({command:index,label:command.label,effects:[{x:100+Math.sin(index)*16,y:48+index%5*4,radius:5,color:index%2?"#7b61ff":"#d63d6c"}]}));
      return new ns.BattleAnimation({id,name,offset,commands,frames,sprite:this.defaultSprite(),properties:[{label:"Source",value:"Crystal command scan MVP"},{label:"Pic Anim",value:"Timeline-ready"}]});
    }
    decodeCommands(offset){
      if(!Number.isInteger(offset))return [{label:"Scene",source:"static_preview"}];
      const commands=[];
      for(let index=0;index<24;index++){
        const byte=this.memory.u8(offset+index);
        commands.push({label:byte===0xff?"end":`anim command ${byte}`,source:`db $${byte.toString(16).toUpperCase().padStart(2,"0")}`});
        if(byte===0xff)break;
      }
      return commands;
    }
    defaultSprite(){const first=this.catalog?.list?.()[0];return first?{offset:first.offset,count:4,columns:2,title:first.label}:null;}
    listTrainers(){return this.trainerData.trainers().map(document=>this.toBattleTrainer(document,{sprites:false}));}
    resolveTrainer(reference){try{const document=this.trainerData.resolve(reference),trainer=document?this.toBattleTrainer(document,{sprites:true}):null;if(trainer)trainer.mapReference=reference?.mapReference||null;return trainer;}catch{return null;}}
    toBattleTrainer(document,{sprites=true}={}){
      const trainer=new ns.BattleTrainer({
        id:document.id,classId:document.classId,name:document.name,source:document.source,
        party:document.party.map(member=>Object.freeze({...member,...(sprites?{sprite:this.speciesSprite(member.species)}:{})})),editable:true
      });
      Object.assign(trainer,{number:document.number,offset:document.offset,format:document.format,hasItems:document.hasItems,hasMoves:document.hasMoves,...(sprites?{sprite:this.trainerSprite(document.classId)}:{}),resourceId:`gen2:trainer:${document.classId}-${document.number}`});
      return trainer;
    }
    trainerSprite(classId){
      if(this.trainerSprites.has(classId))return this.trainerSprites.get(classId);
      const source=this.trainerData.classDocument(classId),decoded=GscLz.decompress(this.memory,source.pictureOffset,{maxOutput:0x1000}).bytes;
      if(decoded.length<49*16)throw new Error(`${source.name} trainer picture is shorter than the native 7×7 tile area.`);
      const canvas=document.createElement("canvas");canvas.width=canvas.height=56;
      const context=canvas.getContext("2d"),image=context.createImageData(56,56),memory=new RomMemory(decoded),colors=[[255,255,255,0],[170,170,170,255],[85,85,85,255],[0,0,0,255]];
      for(let tile=0;tile<49;tile++){
        const pixels=GbcSpriteCodec.decodeTile(memory,tile*16),tileX=tile%7,tileY=Math.floor(tile/7);
        for(let pixel=0;pixel<64;pixel++){
          const rgba=colors[pixels[pixel]],target=((tileY*8+Math.floor(pixel/8))*56+tileX*8+pixel%8)*4;
          image.data.set(rgba,target);
        }
      }
      context.putImageData(image,0,0);
      const result=Object.freeze({canvas,offset:source.pictureOffset,bytes:decoded.slice(0,49*16),count:49,columns:7,title:`${source.name} trainer picture · native Crystal LZ`,editable:false,sourceEncoding:"Crystal TrainerPicPointers LZ → native 2bpp"});
      this.trainerSprites.set(classId,result);return result;
    }
    speciesSprite(id,side="front"){
      const key=`${id}:${side}`;if(this.speciesSprites.has(key))return this.speciesSprites.get(key);
      const back=side==="back",picture=back?this.speciesData.backSprite(id):this.speciesData.frontSprite(id),
        palette=this.speciesData.palette(id),frame={...picture,bytes:picture.bytes.slice(0,picture.frameBytes)},
        canvas=PokemonViewer.graphics.GbPictureCanvas.render(frame,{
          palette:palette.colors,canvasWidth:back?48:56,canvasHeight:back?48:56,alignY:"bottom"
        });
      const result=Object.freeze({canvas,offset:picture.offset,title:`${this.speciesData.catalog.get(id).name} ${side} battle sprite · native Crystal LZ/2bpp`,species:id,side});
      this.speciesSprites.set(key,result);return result;
    }
    speciesField(){return{label:"Species ID",max:251};}
    partyEditFields(trainer,mon){
      const fields=[
        {name:"species",label:"Species ID",type:"number",value:mon.species,min:1,max:251,fullWidth:false},
        {name:"level",label:"Level",type:"number",value:mon.level,min:1,max:100,fullWidth:false}
      ];
      if(trainer.hasItems)fields.push({name:"item",label:"Held item ID",type:"number",value:mon.item,min:0,max:255});
      if(trainer.hasMoves)for(let index=0;index<4;index++)fields.push({name:`move${index+1}`,label:`Move ${index+1} ID`,type:"number",value:mon.moveIds[index],min:0,max:251,fullWidth:false});
      return fields;
    }
    partyEditMessage(trainer){return`Edits one existing ${trainer.format} Crystal party record. Its native width and party terminator are preserved.`;}
    editPartyMon(trainer,index,values,stack){
      const plan=this.trainerData.editPlan(trainer,index,values);
      if(plan.before.every((value,position)=>value===plan.after[position]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"Crystal trainer party changed after this command"});
      stack.execute({label:`Edit ${trainer.name} Pokémon ${index+1}`,description:`${plan.species.name} · Lv ${plan.level}`,
        do:()=>{write(plan.before,plan.after);this.trainerData.invalidate();this.refreshGraph();},
        undo:()=>{write(plan.after,plan.before);this.trainerData.invalidate();this.refreshGraph();}
      });return true;
    }
    refreshGraph(){
      this.reader.resourceGraph=this.trainerData.resourceGraph(this.progressionData.resourceGraph());
      ProjectEvents.resources(this.reader.resourceGraph);
      return this.reader.resourceGraph;
    }
    scene({trainer,opponent,phase="battle"}={}){
      if(phase==="battle"){
        const species=Number(opponent?.species||trainer?.party?.[0]?.species||1),
          enemy=this.speciesSprite(species,"front"),player=this.speciesSprite(species,"back"),
          name=this.speciesData.catalog.get(species)?.name||`Species ${species}`;
        return{
          verified:true,layout:"gen2-animation",nativeHud:false,font:null,
          background:["#ffffff","#ffffff"],platform:false,text:"",
          enemy:{x:96,y:0,width:56,height:56,image:enemy.canvas},
          player:{x:8,y:48,width:48,height:48,image:player.canvas},
          hud:null,
          elements:[
            {id:"background",kind:"background",label:"Crystal battle field",bounds:{x:0,y:0,width:160,height:96}},
            {id:"opponent",kind:"pokemon",label:`${name} · front`,bounds:{x:96,y:0,width:56,height:56},resource:enemy,species,side:"front"},
            {id:"player",kind:"pokemon",label:`${name} · back`,bounds:{x:8,y:48,width:48,height:48},resource:player,species,side:"back"}
          ]
        };
      }
      if(phase!=="intro"||!trainer||trainer.encounter)return{verified:false,reason:"Crystal battle scene requires either a Pokémon opponent or a trainer introduction."};
      const portrait=trainer.sprite||this.trainerSprite(trainer.classId),resource=Object.freeze({...portrait,previewCanvas:portrait.canvas});
      return{
        verified:true,layout:"gen2",nativeHud:false,font:null,background:["#ffffff","#ffffff"],platform:false,
        enemy:{x:96,y:8,width:56,height:56,image:portrait.canvas},player:null,hud:null,text:"",
        message:Object.freeze({kind:"trainer-intro",template:"{TRAINER_NAME} wants to battle!",trainerName:trainer.name,displayText:`${trainer.name} wants to battle!`}),
        elements:[{id:"trainer",kind:"trainer",label:`${trainer.name} · trainer picture`,bounds:{x:96,y:8,width:56,height:56},resource,trainerClass:trainer.classId}]
      };
    }
  }
  ns.registry.register("gen2",context=>new Gen2BattleDriver(context));
})(globalThis);
