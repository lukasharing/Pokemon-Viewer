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
  class Gen2AttackAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.symbols=reader.capabilities?.provenance?.symbols||{};
      this.moves=reader.gen2MoveData||=new root.gen2.Gen2MoveData(reader);this.table=this.symbols.BattleAnimations;
      if(!Number.isInteger(this.table?.offset))throw new Error("Crystal source manifest is missing BattleAnimations.");
    }
    list(){return this.moves.list().map(move=>this.document(move));}
    pointer(animation){
      const at=this.table.offset+animation*2;this.memory.assertRange(at,2);
      return this.memory.banked(this.table.bank,this.memory.u16(at));
    }
    document(move){
      const offset=this.pointer(move.animation),commands=this.decode(offset);
      return new ns.AnimationDocument({
        id:`move:${move.id}`,name:move.name,domain:"move",type:"battle",fps:60,offset,commands,
        frames:commands.map((command,index)=>({command:index,label:command.label,duration:command.duration||1})),
        accuracy:"partial",source:{repository:"pret/pokecrystal",file:"data/moves/animations.asm"},
        properties:[
          {label:"Move",value:`#${move.id} · ${move.name}`},{label:"Engine",value:"Generation II BattleAnimCommands"},
          {label:"Rendering",value:"Command stream verified; objects, tilemaps and palettes are partial"},{label:"Animation ID",value:move.animation,complexity:"advanced"},
          {label:"Script",value:MemoryUtils.hex(offset,5),complexity:"advanced"}
        ]
      });
    }
    decode(offset,{limit=512}={}){
      const commands=[];let cursor=offset;
      for(let index=0;index<limit&&this.memory.contains(cursor);index++){
        const at=cursor,opcode=this.memory.u8(cursor++);
        if(opcode<0xd0){commands.push({label:"Wait",source:`anim_wait ${opcode}`,offset:at,opcode,duration:Math.max(1,opcode)});continue;}
        const definition=COMMANDS[opcode];if(!definition){commands.push({label:"Unknown",source:`db ${MemoryUtils.hex(opcode)} ; decoding stopped`,offset:at,opcode});break;}
        const [name,width]=definition;this.memory.assertRange(cursor,width);const args=Array.from(this.memory.slice(cursor,width));cursor+=width;
        commands.push({label:name.replace(/^anim_/,"").replaceAll("_"," "),source:`${name}${args.length?` ${args.map(value=>MemoryUtils.hex(value)).join(", ")}`:""}`,offset:at,opcode,args,duration:1});
        if(opcode===0xff)break;
      }
      return commands;
    }
  }
  ns.registry.register("gen2",context=>new Gen2AttackAnimationDriver(context));
})(globalThis);
