(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  class Gen1AttackAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.moves=reader.gen1MoveData||=new root.gen1.Gen1MoveData(reader);
      this.catalog=new ns.AnimationCatalog().add({list:()=>this.moves.list().map(move=>this.safeDocument(move)).filter(Boolean)}).add(new ns.Gen1SceneAnimationCatalog(reader));
    }
    list(){const documents=this.catalog.list();this.diagnostics=this.catalog.diagnostics;return documents;}
    safeDocument(move){try{return this.document(move);}catch(error){this.catalog.diagnostics.push(Object.freeze({id:`move:${move.id}`,error}));return null;}}
    document(move){
      const offset=move.animationDocument.offset,commands=this.decode(offset);
      return new ns.AnimationDocument({
        id:`move:${move.id}`,name:move.name,domain:"move",type:"battle",fps:60,offset,commands,
        accuracy:"partial",references:{moveId:move.id,animationId:move.animation},
        source:{repository:"pret/pokered",file:"data/moves/animations.asm"},
        properties:[
          {label:"Move",value:`#${move.id} · ${move.name}`},
          {label:"Engine",value:"Generation I subanimations and special effects"},
          {label:"Playback",value:"Exact command timing, tileset, subanimation and sound events"},
          {label:"Animation ID",value:MemoryUtils.hex(move.animation),complexity:"advanced"},{label:"Script",value:MemoryUtils.hex(offset,5),complexity:"advanced"}
        ]
      });
    }
    decode(offset,{limit=192}={}){
      const commands=[];let cursor=offset;
      for(let index=0;index<limit&&this.memory.contains(cursor);index++){
        const at=cursor,opcode=this.memory.u8(cursor++);
        if(opcode===0xff){commands.push({label:"End",source:"animation_end",offset:at,opcode,event:{kind:"flow",note:"End animation"}});break;}
        if(opcode<0xc0){
          this.memory.assertRange(cursor,2);const duration=opcode&0x3f,tileset=opcode>>6,storedSound=this.memory.u8(cursor++),sound=storedSound+1,subanimation=this.memory.u8(cursor++);
          commands.push({label:`Subanimation ${subanimation}`,source:`battle_anim ${duration}, ${tileset}, SFX ${sound}, ${subanimation}`,offset:at,opcode,
            args:[duration,tileset,sound,subanimation],duration:Math.max(1,duration),track:"sprite",
            event:{kind:"sprite",value:`Subanimation ${subanimation} · tileset ${tileset}`,sound:`SFX ${sound}`,note:`SFX ${sound}`}});
        }else{
          this.memory.assertRange(cursor);const storedSound=this.memory.u8(cursor++),sound=storedSound+1;
          commands.push({label:`Special effect ${MemoryUtils.hex(opcode)}`,source:`battle_anim ${MemoryUtils.hex(opcode)}, SFX ${sound}`,offset:at,opcode,
            args:[opcode,sound],duration:1,track:"task",event:{kind:"task",value:`Special effect ${MemoryUtils.hex(opcode)}`,sound:`SFX ${sound}`,note:`SFX ${sound}`}});
        }
      }
      return commands;
    }
  }
  ns.registry.register("gbc",context=>new Gen1AttackAnimationDriver(context));
})(globalThis);
