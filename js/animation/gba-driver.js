(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const COMMANDS=Object.freeze({
    0x00:["loadspritegfx",2],0x01:["unloadspritegfx",2],0x02:["createsprite","sprite"],0x03:["createvisualtask","task"],0x04:["delay",1],0x05:["waitforvisualfinish",0],0x06:["nop",0],0x07:["nop2",0],0x08:["end",0],0x09:["playse",2],0x0a:["monbg",1],0x0b:["clearmonbg",1],0x0c:["setalpha",2],0x0d:["blendoff",0],0x0e:["call",4],0x0f:["return",0],0x10:["setarg",3],0x11:["choosetwoturnanim",8],0x12:["jumpifmoveturn",5],0x13:["goto",4],0x14:["fadetobg",1],0x15:["restorebg",0],0x16:["waitbgfadeout",0],0x17:["waitbgfadein",0],0x18:["changebg",1],0x19:["playsewithpan",3],0x1a:["setpan",1],0x1b:["panse",6]
  });
  const STATUS_NAMES=Object.freeze(["Poison","Confusion","Burn","Infatuation","Sleep","Paralysis","Frozen","Curse","Nightmare"]);
  class GbaAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.symbols=reader.capabilities?.provenance?.symbols||{};
      this.table=this.symbols.gBattleAnims_Moves?.offset;this.statusTable=this.symbols.gBattleAnims_StatusConditions?.offset;this.moveNames=this.symbols.gMoveNames?.offset;
      this.catalog=new ns.AnimationCatalog();
      if(typeof ns.GbaSpeciesAnimationCatalog==="function")this.catalog.add(this.speciesAnimations=new ns.GbaSpeciesAnimationCatalog(reader));
      this.catalog.add({list:()=>this.moves()}).add({list:()=>this.statusAnimations()});
    }
    moveName(id){if(!Number.isInteger(this.moveNames))return`Move #${id}`;try{return this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),this.moveNames+id*13,13).trim()||`Move #${id}`;}catch{return`Move #${id}`;}}
    pointer(id){if(!Number.isInteger(this.table)||id<0||id>354||!this.memory.contains(this.table+id*4,4))return null;try{const pointer=this.memory.pointer(this.table+id*4);return Number.isInteger(pointer)&&this.memory.contains(pointer)?pointer:null;}catch{return null;}}
    list(){return this.catalog.list();}
    moves(){
      if(!Number.isInteger(this.table))return[];
      return Array.from({length:355},(_,id)=>this.document(id)).filter(Boolean);
    }
    statusAnimations(){return Number.isInteger(this.statusTable)?STATUS_NAMES.map((name,id)=>this.statusDocument(id,name)).filter(Boolean):[];}
    statusDocument(id,name){
      let offset;try{offset=this.memory.pointer(this.statusTable+id*4);}catch{return null;}if(!Number.isInteger(offset)||!this.memory.contains(offset))return null;
      const commands=this.decode(offset),frames=commands.map((command,index)=>({command:index,label:command.label,duration:command.opcode===0x04?Math.max(1,Number(command.args?.[0])||1):1}));
      return new ns.AnimationDocument({id:`status:${id}`,name,domain:"status",type:"battle",fps:60,offset,commands,frames,accuracy:"partial",source:{repository:"pret/pokeemerald",file:"data/battle_anim_scripts.s"},properties:[
        {label:"Status",value:name},{label:"Engine",value:"Generation III battle animation program"},{label:"Rendering",value:"Program verified; visual tasks remain partial"},{label:"Script",value:MemoryUtils.hex(offset,6),complexity:"advanced"}
      ]});
    }
    document(id){
      const offset=this.pointer(id);if(!Number.isInteger(offset))return null;
      const commands=this.decode(offset),name=this.moveName(id),frames=commands.map((command,index)=>({command:index,label:command.label}));
      return new ns.AnimationDocument({id:`move:${id}`,name,domain:"move",type:"battle",fps:60,offset,commands,frames,accuracy:"partial",properties:[
        {label:"Move",value:`#${id} · ${name}`},{label:"Decoder",value:"Gen III battle animation command stream"},{label:"Rendering",value:"Command stream verified; task/sprite runtime is partial"},{label:"Pointer table",value:MemoryUtils.hex(this.table,6),complexity:"advanced"},{label:"Script",value:MemoryUtils.hex(offset,6),complexity:"advanced"}
      ]});
    }
    decode(offset,{limit=256}={}){
      const commands=[];let cursor=offset;
      for(let count=0;count<limit&&this.memory.contains(cursor);count++){
        const start=cursor,opcode=this.memory.u8(cursor++),definition=COMMANDS[opcode];
        if(!definition){commands.push({label:`db 0x${opcode.toString(16).toUpperCase().padStart(2,"0")}`,source:"unknown battle-animation opcode — decoding stopped safely",offset:start});break;}
        const [name,width]=definition;let args=[];
        try{
          if(width==="sprite"){const template=this.memory.pointer(cursor);const battler=this.memory.u8(cursor+4),countArgs=this.memory.u8(cursor+5);cursor+=6;args=[MemoryUtils.hex(template,6),`battler ${battler}`];for(let i=0;i<countArgs;i++){args.push(String(this.memory.u16(cursor)));cursor+=2;}}
          else if(width==="task"){const task=this.memory.pointer(cursor);const priority=this.memory.u8(cursor+4),countArgs=this.memory.u8(cursor+5);cursor+=6;args=[MemoryUtils.hex(task,6),`priority ${priority}`];for(let i=0;i<countArgs;i++){args.push(String(this.memory.u16(cursor)));cursor+=2;}}
          else if(opcode===0x0e||opcode===0x13){args=[MemoryUtils.hex(this.memory.pointer(cursor),6)];cursor+=4;}
          else if(opcode===0x11){args=[MemoryUtils.hex(this.memory.pointer(cursor),6),MemoryUtils.hex(this.memory.pointer(cursor+4),6)];cursor+=8;}
          else if(opcode===0x12){args=[`turn ${this.memory.u8(cursor)}`,MemoryUtils.hex(this.memory.pointer(cursor+1),6)];cursor+=5;}
          else if(opcode===0x09){args=[`song ${this.memory.u16(cursor)}`];cursor+=2;}
          else if(opcode===0x19){args=[`song ${this.memory.u16(cursor)}`,`pan ${this.memory.u8(cursor+2)}`];cursor+=3;}
          else if(opcode===0x1b){args=[`song ${this.memory.u16(cursor)}`,`pan ${this.memory.u8(cursor+2)}`,`target ${this.memory.u8(cursor+3)}`,`increment ${this.memory.u8(cursor+4)}`,`interval ${this.memory.u8(cursor+5)}`];cursor+=6;}
          else if(opcode===0x0c){args=[`EVA ${this.memory.u8(cursor)}`,`EVB ${this.memory.u8(cursor+1)}`];cursor+=2;}
          else {for(let i=0;i<width;i++)args.push(this.memory.u8(cursor+i));cursor+=width;}
        }catch{commands.push({label:name,source:"truncated native command — decoding stopped safely",offset:start});break;}
        const source=`${name}${args.length?` ${args.join(", ")}`:""}`;
        commands.push({label:name,source,offset:start,opcode,args});
        if(opcode===0x08||opcode===0x0f)break;
      }
      return commands;
    }
    patch(document,changes){return this.speciesAnimations?.patch(document,changes)||[];}
  }
  ns.registry.register("gba",context=>new GbaAnimationDriver(context));
})(globalThis);
