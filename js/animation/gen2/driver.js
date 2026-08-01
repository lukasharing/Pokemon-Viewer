(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  const COMMANDS=Object.freeze({
    0xd0:["anim_obj",4],0xd1:["anim_1gfx",1],0xd2:["anim_2gfx",2],0xd3:["anim_3gfx",3],0xd4:["anim_4gfx",4],0xd5:["anim_5gfx",5],
    0xd6:["anim_incobj",1],0xd7:["anim_setobj",2],0xd8:["anim_incbgeffect",1],0xd9:["anim_battlergfx_2row",0],
    0xda:["anim_battlergfx_1row",0],0xdb:["anim_checkpokeball",0],0xdc:["anim_transform",0],0xdd:["anim_raisesub",0],
    0xde:["anim_dropsub",0],0xdf:["anim_resetobp0",0],0xe0:["anim_sound",2],0xe1:["anim_cry",1],0xe2:["anim_minimizeopp",0],
    0xe3:["anim_oamon",0],0xe4:["anim_oamoff",0],0xe5:["anim_clearobjs",0],0xe6:["anim_beatup",0],0xe7:["anim_0xe7",0],
    0xe8:["anim_updateactorpic",0],0xe9:["anim_minimize",0],0xea:["anim_0xea",0],0xeb:["anim_0xeb",0],0xec:["anim_0xec",0],
    0xed:["anim_0xed",0],0xee:["anim_if_param_and",3],0xef:["anim_jumpuntil",2],0xf0:["anim_bgeffect",4],0xf1:["anim_bgp",1],
    0xf2:["anim_obp0",1],0xf3:["anim_obp1",1],0xf4:["anim_keepsprites",0],0xf5:["anim_0xf5",0],0xf6:["anim_0xf6",0],
    0xf7:["anim_0xf7",0],0xf8:["anim_if_param_equal",3],0xf9:["anim_setvar",1],0xfa:["anim_incvar",0],
    0xfb:["anim_if_var_equal",3],0xfc:["anim_jump",2],0xfd:["anim_loop",3],0xfe:["anim_call",2],0xff:["anim_ret",0]
  });
  // Exact non-move entries from pokecrystal's BattleAnimations table. The
  // table reserves $fc-$fe, then exposes Sweet Scent 2 at $ff and the native
  // battle-engine programs at $100-$115 (NUM_BATTLE_ANIMS).
  const ENGINE_PROGRAMS=Object.freeze([
    [0xff,"Sweet Scent 2","BattleAnim_SweetScent2","effect"],
    [0x100,"Throw Poké Ball","BattleAnim_ThrowPokeBall","transition"],
    [0x101,"Send Out Pokémon","BattleAnim_SendOutMon","transition"],
    [0x102,"Return Pokémon","BattleAnim_ReturnMon","transition"],
    [0x103,"Confused","BattleAnim_Confused","status"],
    [0x104,"Sleep","BattleAnim_Slp","status"],
    [0x105,"Burn","BattleAnim_Brn","status"],
    [0x106,"Poison","BattleAnim_Psn","status"],
    [0x107,"Sap","BattleAnim_Sap","status"],
    [0x108,"Freeze","BattleAnim_Frz","status"],
    [0x109,"Paralysis","BattleAnim_Par","status"],
    [0x10a,"In Love","BattleAnim_InLove","status"],
    [0x10b,"In Sandstorm","BattleAnim_InSandstorm","status"],
    [0x10c,"In Nightmare","BattleAnim_InNightmare","status"],
    [0x10d,"In Whirlpool","BattleAnim_InWhirlpool","status"],
    [0x10e,"Miss","BattleAnim_Miss","effect"],
    [0x10f,"Enemy Damage","BattleAnim_EnemyDamage","effect"],
    [0x110,"Enemy Stat Down","BattleAnim_EnemyStatDown","effect"],
    [0x111,"Player Stat Down","BattleAnim_PlayerStatDown","effect"],
    [0x112,"Player Damage","BattleAnim_PlayerDamage","effect"],
    [0x113,"Wobble","BattleAnim_Wobble","effect"],
    [0x114,"Shake","BattleAnim_Shake","effect"],
    [0x115,"Hit Confusion","BattleAnim_HitConfusion","effect"]
  ].map(([id,name,symbol,domain])=>Object.freeze({id,name,symbol,domain})));
  const BATTLE_ANIMATION_COUNT=0x116;
  class Gen2AttackAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.profile=reader.memoryProfile;
      this.moves=reader.gen2MoveData||=new root.gen2.Gen2MoveData(reader);this.table=this.profile?.symbol("BattleAnimations");
      this.scene=ns.AnimationSceneFactory.battle(reader);
      try{this.visuals=new ns.Gen2BattleAnimationVisuals(reader);}catch(error){this.visuals=null;console.warn("Crystal animation visuals are unavailable.",error);}
      if(!Number.isInteger(this.table?.offset))throw new Error("Crystal source dictionary is missing BattleAnimations.");
      this.catalog=new ns.AnimationCatalog().add(new ns.AnimationEntryProvider({
        id:"gen2-moves",entries:()=>this.moves.list(),document:move=>this.document(move)
      }));
      this.catalog.add(new ns.AnimationEntryProvider({
        id:"gen2-engine-programs",entries:()=>this.enginePrograms(),document:entry=>this.engineDocument(entry)
      }));
      if(this.visuals)this.catalog.add(new ns.AnimationEntryProvider({
        id:"gen2-visual-objects",entries:()=>this.components(),document:component=>this.componentDocument(component)
      }));
      if(root.sprites?.Gen2SceneCatalogs&&ns.AnimationAssetCatalog){
        const scenes=new root.sprites.Gen2SceneCatalogs(reader).create();
        for(const group of ["intro","title"])if(scenes[group])this.catalog.add(new ns.AnimationAssetCatalog(reader,{
          catalog:scenes[group],codec:GbcSpriteCodec,prefix:`gen2-${group}`,group:group==="intro"?"Crystal introduction":"Crystal title",fps:ns.GEN2_ANIMATION_TIMING?.refreshHz,
          repository:"pret/pokecrystal",file:"native intro/title graphics"
        }));
      }
    }
    list(){
      const documents=this.catalog.list();this.diagnostics=this.catalog.diagnostics;return documents;
    }
    async listAsync(options={}){const documents=await this.catalog.listAsync(options);this.diagnostics=this.catalog.diagnostics;return documents;}
    enginePrograms(){return ENGINE_PROGRAMS;}
    components(){
      if(this._components)return this._components;
      this._components=Object.freeze(Object.entries(ns.sourceCatalog?.gen2Objects||{}).map(([id,source])=>Object.freeze({
        id:Number(id),name:source.name,symbol:source.symbol
      })).filter(component=>Number.isInteger(component.id)));
      return this._components;
    }
    componentDocument(component,{context="player-to-rival"}={}){
      const direction=ns.AnimationBattleContext.get(context),base=Object.freeze({
        label:component.name,source:`anim_obj ${component.symbol}, 80, 56, 0`,offset:this.visuals.objects.offset+component.id*6,
        opcode:0xd0,args:Object.freeze([component.id,80,56,0]),duration:1,track:"sprite",
        event:Object.freeze({kind:"sprite",value:Object.freeze({id:`object-${component.id}`,label:component.name,x:80,y:56,anchor:"screen",parameter:0})})
      }),commands=Object.freeze(this.visuals.decorate([base],{attackerSide:direction.attackerSide}));
      return new ns.AnimationDocument({
        id:`effect:gen2:${component.id}`,name:component.name,domain:"effect",type:"animation-component",
        fps:ns.GEN2_ANIMATION_TIMING?.refreshHz,offset:base.offset,commands,frames:ns.AnimationProgram.frames(commands),accuracy:"verified",
        scene:ns.AnimationBattleContext.scene(this.scene,context),references:{componentId:component.id},
        ...ns.AnimationBattleContext.documentOptions(context),source:{repository:"pret/pokecrystal",file:"data/battle_anims/objects.asm + framesets.asm + oam.asm"},properties:[
          {label:"Component",value:component.symbol},{label:"Direction",value:direction.label},
          {label:"Source",value:"BattleAnimObjects → frame data → OAM → native LZ/2bpp",complexity:"advanced"}
        ]
      });
    }
    pointer(animation){
      if(!Number.isInteger(animation)||animation<0||animation>=BATTLE_ANIMATION_COUNT)return null;
      const at=this.table.offset+animation*2;this.memory.assertRange(at,2);
      const offset=this.memory.banked(this.table.bank,this.memory.u16(at));
      return this.memory.contains(offset)?offset:null;
    }
    programDocument({id,name,domain,animation,references,properties=[]},{context="player-to-rival"}={}){
      const direction=ns.AnimationBattleContext.get(context);
      const offset=this.pointer(animation);
      if(!Number.isInteger(offset))throw new Error(`Crystal battle animation ${MemoryUtils.hex(animation,3)} has no valid native program.`);
      const decoded=this.decode(offset),
        commands=this.visuals?.decorate(decoded,{attackerSide:direction.attackerSide})||decoded;
      return new ns.AnimationDocument({
        id,name,domain,type:"battle",fps:ns.GEN2_ANIMATION_TIMING?.refreshHz,offset,commands,
        accuracy:"partial",scene:ns.AnimationBattleContext.scene(this.scene,context),frames:ns.NativeAnimationProgram.frames(commands),references,
        ...ns.AnimationBattleContext.documentOptions(context),
        source:{repository:"pret/pokecrystal",file:"data/moves/animations.asm"},
        properties:[
          ...properties,{label:"Engine",value:"Generation II BattleAnimCommands"},
          {label:"Direction",value:direction.label},
          {label:"Playback",value:"Native call/return/jump flow executed with bounded loops"},{label:"Animation ID",value:animation,complexity:"advanced"},
          {label:"Script",value:MemoryUtils.hex(offset,5),complexity:"advanced"}
        ]
      });
    }
    document(move,options={}){
      return this.programDocument({
        id:`move:${move.id}`,name:move.name,domain:"move",animation:move.animation,
        references:{moveId:move.id,animationId:move.animation},properties:[{label:"Move",value:`#${move.id} · ${move.name}`}]
      },options);
    }
    engineDocument(entry,options={}){
      return this.programDocument({
        id:`engine:gen2:${entry.id}`,name:entry.name,domain:entry.domain,animation:entry.id,
        references:{engineAnimationId:entry.id},properties:[
          {label:"Program",value:entry.symbol},{label:"Source index",value:MemoryUtils.hex(entry.id,3),complexity:"advanced"}
        ]
      },options);
    }
    contextualize(document,context){
      if(Number.isInteger(document?.references?.componentId)){
        const component=this.components().find(item=>item.id===document.references.componentId);
        return component?this.componentDocument(component,{context}):null;
      }
      if(Number.isInteger(document?.references?.engineAnimationId)){
        const entry=this.enginePrograms().find(item=>item.id===document.references.engineAnimationId);
        return entry?this.engineDocument(entry,{context}):null;
      }
      const move=this.moves.list().find(item=>item.id===document?.references?.moveId);
      return move?this.document(move,{context}):null;
    }
    event(opcode,args,name){
      if(opcode>=0xd1&&opcode<=0xd5)return{kind:"resource",value:args.map(id=>Object.freeze({id:`gfx-${id}`,name:ns.sourceCatalog?.gen2Graphics?.[id]?.name||`Graphics ${MemoryUtils.hex(id)}`,symbol:ns.sourceCatalog?.gen2Graphics?.[id]?.symbol||null}))};
      if(opcode===0xd0){
        const id=args[0],source=ns.sourceCatalog?.gen2Objects?.[id];
        // anim_obj stores absolute Game Boy screen coordinates. Treating them
        // as target-relative introduced a permanent vertical offset and made
        // the same object move when the selected battler changed.
        return{kind:"sprite",value:Object.freeze({id:`object-${id}`,label:source?.name||`Object ${id}`,symbol:source?.symbol||null,x:args[1],y:args[2],anchor:"screen",parameter:args[3]})};
      }
      if(opcode===0xe5)return{kind:"clear-sprites",value:"Clear objects"};
      if(opcode===0xe0||opcode===0xe1)return{kind:"sound",value:opcode===0xe1?`Cry pitch ${args[0]}`:`Sound ${args[1]}`};
      if(opcode===0xf0)return{kind:"background",value:`Effect ${args[0]}`};
      if(opcode>=0xf1&&opcode<=0xf3)return{kind:"palette",value:`${name} ${args[0]}`};
      if(opcode===0xe3||opcode===0xe4)return{kind:"visibility",value:opcode===0xe3?"visible":"hidden"};
      const flow=opcode===0xfe?"call":opcode===0xff?"return":opcode===0xfc?"jump":opcode===0xfd?"loop":
        [0xee,0xf8,0xfb].includes(opcode)?"branch":"step";
      return{kind:"flow",value:name,flow,note:`${name}${args.length?` ${args.join(", ")}`:""}`};
    }
    decode(offset,{limit=512}={}){
      const commands=[],returns=[],visits=new Map(),bank=this.table.bank;let cursor=offset;
      for(let index=0;index<limit&&this.memory.contains(cursor);index++){
        const visitKey=`${cursor}:${returns.length}`,visitCount=(visits.get(visitKey)||0)+1;visits.set(visitKey,visitCount);
        if(visitCount>4){
          commands.push({label:"Loop boundary",source:`execution stopped at ${MemoryUtils.hex(cursor,5)} after four visits`,offset:cursor,event:{kind:"flow",note:"Bounded native loop"}});
          break;
        }
        const at=cursor,opcode=this.memory.u8(cursor++);
        if(opcode<0xd0){commands.push({label:"Wait",source:`anim_wait ${opcode}`,offset:at,opcode,args:[opcode],duration:Math.max(1,opcode),track:"wait",event:{kind:"flow",note:`Wait ${opcode} ticks`}});continue;}
        const definition=COMMANDS[opcode];if(!definition){commands.push({label:"Unknown",source:`db ${MemoryUtils.hex(opcode)} ; decoding stopped`,offset:at,opcode});break;}
        const [name,width]=definition;this.memory.assertRange(cursor,width);const args=Array.from(this.memory.slice(cursor,width));cursor+=width;
        const label=name.replace(/^anim_/,"").replaceAll("_"," ");
        const event=this.event(opcode,args,name),conditional=[0xee,0xf8,0xfb].includes(opcode);
        const target=width>=2?this.memory.banked(bank,args.at(-2)|(args.at(-1)<<8)):null;
        const control=event.flow&&event.flow!=="step"?Object.freeze({
          kind:event.flow,conditional,targets:Object.freeze(Number.isInteger(target)?[target]:[]),unresolved:conditional
        }):null;
        commands.push({label,source:`${name}${args.length?` ${args.map(value=>MemoryUtils.hex(value)).join(", ")}`:""}`,offset:at,opcode,args,duration:1,control,event:conditional?Object.freeze({...event,branchIgnored:true,note:`${name} · live battle/input branch shown but not guessed`}):event,callDepth:returns.length});
        if(opcode===0xfe&&Number.isInteger(target)&&this.memory.contains(target)){returns.push(cursor);cursor=target;continue;}
        if(opcode===0xff){if(returns.length){cursor=returns.pop();continue;}break;}
        if(opcode===0xfc&&Number.isInteger(target)&&this.memory.contains(target)){cursor=target;continue;}
        if(opcode===0xfd&&Number.isInteger(target)&&this.memory.contains(target)){
          const repetitions=Math.max(1,args[0]||1),loopKey=`loop:${at}`,done=visits.get(loopKey)||0;
          if(done<Math.min(repetitions,4)){visits.set(loopKey,done+1);cursor=target;}
        }
      }
      return commands;
    }
  }
  ns.Gen2AttackAnimationDriver=Gen2AttackAnimationDriver;
  ns.registry.register("gen2",context=>new Gen2AttackAnimationDriver(context));
})(globalThis);
