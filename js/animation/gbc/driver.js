(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  class Gen1AttackAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.moves=reader.gen1MoveData||=new root.gen1.Gen1MoveData(reader);
      this.scene=ns.AnimationSceneFactory.battle(reader);
      try{this.visuals=new ns.Gen1BattleAnimationVisuals(reader);}catch(error){this.visuals=null;console.warn("Red/Blue animation visuals are unavailable.",error);}
      this.moveProvider=new ns.AnimationEntryProvider({id:"gen1-moves",entries:()=>this.moves.list(),document:move=>this.document(move)});
      this.catalog=new ns.AnimationCatalog().add(this.moveProvider);
      if(this.visuals){
        this.componentProvider=new ns.AnimationEntryProvider({id:"gen1-visual-effects",entries:()=>this.components(),document:component=>this.componentDocument(component)});
        this.catalog.add(this.componentProvider);
      }
      this.catalog.add(new ns.Gen1SceneAnimationCatalog(reader));
      if(root.sprites?.Gen1SceneCatalogs&&ns.AnimationAssetCatalog){
        const scenes=new root.sprites.Gen1SceneCatalogs(reader).create();
        for(const group of ["title"])if(scenes[group])this.catalog.add(new ns.AnimationAssetCatalog(reader,{
          catalog:scenes[group],codec:GbcSpriteCodec,prefix:`gen1-${group}`,group:"Red/Blue title",fps:ns.GBC_ANIMATION_TIMING?.refreshHz,
          repository:"pret/pokered",file:"native title graphics"
        }));
      }
    }
    list(){const documents=this.catalog.list();this.diagnostics=this.catalog.diagnostics;return documents;}
    async listAsync(options={}){const documents=await this.catalog.listAsync(options);this.diagnostics=this.catalog.diagnostics;return documents;}
    components(){
      if(this._components)return this._components;
      this._components=Object.freeze(Object.entries(ns.sourceCatalog?.gen1||{}).map(([key,source])=>{
        const match=String(source.symbol||"").match(/^SUBANIM_(\d+)_/),tileset=Number(match?.[1]);
        if(!Number.isInteger(tileset))return null;
        return Object.freeze({id:Number(key),tileset,name:source.name,symbol:source.symbol});
      }).filter(Boolean));
      return this._components;
    }
    componentDocument(component,{context="player-to-rival"}={}){
      const direction=ns.AnimationBattleContext.get(context),base=Object.freeze({
        label:component.name,source:component.symbol,offset:this.visuals.subanimations.offset+component.id*2,opcode:0,
        args:Object.freeze([4,component.tileset,0,component.id]),duration:4,track:"sprite",
        event:Object.freeze({kind:"sprite",value:Object.freeze({id:`subanimation-${component.id}`,label:component.name,subanimation:component.id,tileset:component.tileset,anchor:"target"})})
      }),commands=Object.freeze(this.visuals.decorate([base],{attackerSide:direction.attackerSide}));
      return new ns.AnimationDocument({
        id:`effect:gen1:${component.id}`,name:component.name,domain:"effect",type:"animation-component",
        fps:ns.GBC_ANIMATION_TIMING?.refreshHz,offset:base.offset,commands,frames:ns.AnimationProgram.frames(commands),accuracy:"verified",
        scene:ns.AnimationBattleContext.scene(this.scene,context),references:{componentId:component.id,subanimationId:component.id},
        ...ns.AnimationBattleContext.documentOptions(context),source:{repository:"pret/pokered",file:"data/moves/animations.asm + data/battle/animations.asm"},properties:[
          {label:"Component",value:component.symbol},{label:"Direction",value:direction.label},
          {label:"Tileset",value:component.tileset,complexity:"advanced"},
          {label:"Source",value:"SubanimationPointers → frame blocks → native OAM",complexity:"advanced"}
        ]
      });
    }
    document(move,{context="player-to-rival"}={}){
      const direction=ns.AnimationBattleContext.get(context),offset=move.animationDocument.offset,decoded=this.decode(offset),
        commands=this.visuals?.decorate(decoded,{attackerSide:direction.attackerSide})||decoded;
      return new ns.AnimationDocument({
        id:`move:${move.id}`,name:move.name,domain:"move",type:"battle",fps:ns.GBC_ANIMATION_TIMING?.refreshHz,offset,commands,
        accuracy:"partial",scene:ns.AnimationBattleContext.scene(this.scene,context),frames:ns.NativeAnimationProgram.frames(commands),references:{moveId:move.id,animationId:move.animation},
        ...ns.AnimationBattleContext.documentOptions(context),
        source:{repository:"pret/pokered",file:"data/moves/animations.asm"},
        properties:[
          {label:"Move",value:`#${move.id} · ${move.name}`},
          {label:"Direction",value:direction.label},
          {label:"Engine",value:"Generation I subanimations and special effects"},
          {label:"Playback",value:"Native tilesets, frame blocks, base coordinates, transforms and command timing"},
          {label:"Animation ID",value:MemoryUtils.hex(move.animation),complexity:"advanced"},{label:"Script",value:MemoryUtils.hex(offset,5),complexity:"advanced"}
        ]
      });
    }
    contextualize(document,context){
      if(Number.isInteger(document?.references?.componentId)){
        const component=this.components().find(item=>item.id===document.references.componentId);
        return component?this.componentDocument(component,{context}):null;
      }
      const move=this.moves.list().find(item=>item.id===document?.references?.moveId);
      return move?this.document(move,{context}):null;
    }
    commandInputs(command){
      if(command?.opcode<0xc0)return[
        {id:"ticks",label:"Duration",type:"number",value:Math.max(1,Number(command.args?.[0])||1),min:1,max:63,editable:true},
        {id:"tileset",label:"Tileset",type:"number",value:Number(command.args?.[1])||0,editable:false},
        {id:"sound",label:"Sound",type:"number",value:Number(command.args?.[2])||0,editable:false},
        {id:"subanimation",label:"Subanimation",type:"number",value:Number(command.args?.[3])||0,editable:false}
      ];
      return(command?.args||[]).map((value,index)=>({id:`arg-${index}`,label:index===0?"Effect":"Sound",type:"number",value,editable:false}));
    }
    patchCommand(document,command,input,value){
      if(command?.opcode>=0xc0||input!=="ticks")return[];
      const ticks=Number(value);if(!Number.isInteger(ticks)||ticks<1||ticks>63)throw new RangeError("Generation I animation duration must be between 1 and 63 ticks.");
      const offset=command.offset,expected=Array.from(this.memory.slice(offset,1)),next=(expected[0]&0xc0)|ticks;
      return expected[0]===next?[]:[{offset,expected,next:[next]}];
    }
    decode(offset,{limit=192}={}){
      const commands=[];let cursor=offset;
      for(let index=0;index<limit&&this.memory.contains(cursor);index++){
        const at=cursor,opcode=this.memory.u8(cursor++);
        if(opcode===0xff){commands.push({label:"End",source:"animation_end",offset:at,opcode,event:{kind:"flow",note:"End animation"}});break;}
        if(opcode<0xc0){
          this.memory.assertRange(cursor,2);const duration=opcode&0x3f,tileset=opcode>>6,storedSound=this.memory.u8(cursor++),sound=storedSound+1,subanimation=this.memory.u8(cursor++);
          const native=ns.sourceCatalog?.gen1?.[subanimation],label=native?.name||`Subanimation ${subanimation}`;
          commands.push({label,source:`battle_anim ${duration}, ${tileset}, SFX ${sound}, ${native?.symbol||subanimation}`,offset:at,opcode,
            args:[duration,tileset,sound,subanimation],duration:Math.max(1,duration),track:"sprite",
            event:{kind:"sprite",value:Object.freeze({id:`subanimation-${at}`,label,subanimation,tileset,anchor:"target"}),sound:`SFX ${sound}`,note:`SFX ${sound}`}});
        }else{
          this.memory.assertRange(cursor);const storedSound=this.memory.u8(cursor++),sound=storedSound+1;
          commands.push({label:`Special effect ${MemoryUtils.hex(opcode)}`,source:`battle_anim ${MemoryUtils.hex(opcode)}, SFX ${sound}`,offset:at,opcode,
            args:[opcode,sound],duration:1,track:"task",event:{kind:"task",value:`Special effect ${MemoryUtils.hex(opcode)}`,sound:`SFX ${sound}`,note:`SFX ${sound}`}});
        }
      }
      return commands;
    }
  }
  ns.Gen1AttackAnimationDriver=Gen1AttackAnimationDriver;
  ns.registry.register("gbc",context=>new Gen1AttackAnimationDriver(context));
})(globalThis);
