(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  class Gen1AttackAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.moves=reader.gen1MoveData||=new root.gen1.Gen1MoveData(reader);
      this.scene=ns.AnimationSceneFactory.battle(reader);
      try{this.visuals=new ns.Gen1BattleAnimationVisuals(reader);}catch(error){this.visuals=null;console.warn("Red/Blue animation visuals are unavailable.",error);}
      this.catalog=new ns.AnimationCatalog().add({list:()=>this.moves.list().map(move=>this.safeDocument(move)).filter(Boolean)}).add(new ns.Gen1SceneAnimationCatalog(reader));
      if(root.sprites?.Gen1SceneCatalogs&&ns.AnimationAssetCatalog){
        const scenes=new root.sprites.Gen1SceneCatalogs(reader).create();
        for(const group of ["title"])if(scenes[group])this.catalog.add(new ns.AnimationAssetCatalog(reader,{
          catalog:scenes[group],codec:GbcSpriteCodec,prefix:`gen1-${group}`,group:"Red/Blue title",fps:ns.GBC_ANIMATION_TIMING?.refreshHz,
          repository:"pret/pokered",file:"native title graphics"
        }));
      }
    }
    list(){const documents=this.catalog.list();this.diagnostics=this.catalog.diagnostics;return documents;}
    safeDocument(move){try{return this.document(move);}catch(error){this.catalog.diagnostics.push(Object.freeze({id:`move:${move.id}`,error}));return null;}}
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
      const move=this.moves.list().find(item=>item.id===document?.references?.moveId);
      return move?this.document(move,{context}):null;
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
