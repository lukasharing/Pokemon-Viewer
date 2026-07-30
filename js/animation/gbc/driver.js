(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  class Gen1AttackAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.moves=reader.gen1MoveData||=new root.gen1.Gen1MoveData(reader);
      this.catalog=new ns.AnimationCatalog().add({list:()=>this.moves.list().map(move=>this.document(move))}).add(new ns.Gen1SceneAnimationCatalog(reader));
    }
    list(){return this.catalog.list();}
    document(move){
      const offset=move.animationDocument.offset,commands=this.decode(offset);
      return new ns.AnimationDocument({
        id:`move:${move.id}`,name:move.name,domain:"move",type:"battle",fps:60,offset,commands,
        frames:commands.map((command,index)=>({command:index,label:command.label,duration:command.duration||1})),
        accuracy:"partial",source:{repository:"pret/pokered",file:"data/moves/animations.asm"},
        properties:[
          {label:"Move",value:`#${move.id} · ${move.name}`},
          {label:"Engine",value:"Generation I subanimations and special effects"},
          {label:"Rendering",value:"Command stream verified; tile/OAM runtime is partial"},{label:"Script",value:MemoryUtils.hex(offset,5),complexity:"advanced"}
        ]
      });
    }
    decode(offset,{limit=192}={}){
      const commands=[];let cursor=offset;
      for(let index=0;index<limit&&this.memory.contains(cursor);index++){
        const at=cursor,opcode=this.memory.u8(cursor++);
        if(opcode===0xff){commands.push({label:"End",source:"animation_end",offset:at,opcode});break;}
        if(opcode<0xc0){
          this.memory.assertRange(cursor,2);const duration=opcode&0x3f,tileset=opcode>>6,sound=this.memory.u8(cursor++),subanimation=this.memory.u8(cursor++);
          commands.push({label:`Subanimation ${subanimation}`,source:`subanimation ${subanimation}, tileset ${tileset}, ${duration} ticks, sound ${sound}`,offset:at,opcode,duration:Math.max(1,duration)});
        }else{
          this.memory.assertRange(cursor);const sound=this.memory.u8(cursor++);
          commands.push({label:`Special effect ${MemoryUtils.hex(opcode)}`,source:`special_effect ${MemoryUtils.hex(opcode)}, sound ${sound}`,offset:at,opcode,duration:1});
        }
      }
      return commands;
    }
  }
  ns.registry.register("gbc",context=>new Gen1AttackAnimationDriver(context));
})(globalThis);
