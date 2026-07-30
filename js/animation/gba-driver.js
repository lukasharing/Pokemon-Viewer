(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  // Exact Emerald command order and operand widths from pret/pokeemerald
  // src/battle_anim.c::sScriptCmdTable and its Cmd_* readers.
  const COMMANDS=Object.freeze({
    0x00:["loadspritegfx",2,"resource"],0x01:["unloadspritegfx",2,"resource"],0x02:["createsprite","sprite","sprite"],
    0x03:["createvisualtask","visualTask","task"],0x04:["delay",1,"wait"],0x05:["waitforvisualfinish",0,"wait"],
    0x06:["nop",0,"flow"],0x07:["nop2",0,"flow"],0x08:["end",0,"flow"],0x09:["playse",2,"sound"],
    0x0a:["monbg",1,"background"],0x0b:["clearmonbg",1,"background"],0x0c:["setalpha",2,"blend"],
    0x0d:["blendoff",0,"blend"],0x0e:["call",4,"flow"],0x0f:["return",0,"flow"],0x10:["setarg",3,"flow"],
    0x11:["choosetwoturnanim",8,"flow"],0x12:["jumpifmoveturn",5,"flow"],0x13:["goto",4,"flow"],
    0x14:["fadetobg",1,"background"],0x15:["restorebg",0,"background"],0x16:["waitbgfadeout",0,"wait"],
    0x17:["waitbgfadein",0,"wait"],0x18:["changebg",1,"background"],0x19:["playsewithpan",3,"sound"],
    0x1a:["setpan",1,"sound"],0x1b:["panse",6,"sound"],0x1c:["loopsewithpan",5,"sound"],
    0x1d:["waitplaysewithpan",4,"sound"],0x1e:["setbldcnt",2,"blend"],0x1f:["createsoundtask","soundTask","sound"],
    0x20:["waitsound",0,"wait"],0x21:["jumpargeq",7,"flow"],0x22:["monbg_static",1,"background"],
    0x23:["clearmonbg_static",1,"background"],0x24:["jumpifcontest",4,"flow"],0x25:["fadetobgfromset",3,"background"],
    0x26:["panse_adjustnone",6,"sound"],0x27:["panse_adjustall",6,"sound"],0x28:["splitbgprio",1,"background"],
    0x29:["splitbgprio_all",0,"background"],0x2a:["splitbgprio_foes",1,"background"],
    0x2b:["invisible",1,"visibility"],0x2c:["visible",1,"visibility"],0x2d:["teamattack_moveback",1,"sprite"],
    0x2e:["teamattack_movefwd",1,"sprite"],0x2f:["stopsound",0,"sound"]
  });
  const STATUS_NAMES=Object.freeze(["Poison","Confusion","Burn","Infatuation","Sleep","Paralysis","Frozen","Curse","Nightmare"]);
  const hexByte=value=>MemoryUtils.hex(value);
  class GbaAnimationDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.profile=reader.memoryProfile;
      this.table=this.profile?.offset("gBattleAnims_Moves");this.statusTable=this.profile?.offset("gBattleAnims_StatusConditions");this.moveNames=this.profile?.offset("gMoveNames");
      try{this.visuals=new ns.GbaBattleAnimationVisuals(reader);}catch(error){this.visuals=null;console.warn("GBA animation visuals are unavailable.",error);}
      this.scene=ns.AnimationSceneFactory.battle(reader);
      this.catalog=new ns.AnimationCatalog();
      if(typeof ns.GbaSpeciesAnimationCatalog==="function")this.catalog.add(this.speciesAnimations=new ns.GbaSpeciesAnimationCatalog(reader));
      this.catalog.add({list:()=>this.moves()}).add({list:()=>this.statusAnimations()});
    }
    moveName(id){if(!Number.isInteger(this.moveNames))return`Move #${id}`;try{return this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),this.moveNames+id*13,13).trim()||`Move #${id}`;}catch{return`Move #${id}`;}}
    pointer(id){if(!Number.isInteger(this.table)||id<0||id>354||!this.memory.contains(this.table+id*4,4))return null;try{const pointer=this.memory.pointer(this.table+id*4);return Number.isInteger(pointer)&&this.memory.contains(pointer)?pointer:null;}catch{return null;}}
    list(){const documents=this.catalog.list();this.diagnostics=this.catalog.diagnostics;return documents;}
    safeDocument(id){
      try{return this.document(id);}
      catch(error){this.catalog.diagnostics.push(Object.freeze({id:`move:${id}`,error}));return null;}
    }
    moves(){return Number.isInteger(this.table)?Array.from({length:355},(_,id)=>this.safeDocument(id)).filter(Boolean):[];}
    statusAnimations(){return Number.isInteger(this.statusTable)?STATUS_NAMES.map((name,id)=>{try{return this.statusDocument(id,name);}catch(error){this.catalog.diagnostics.push(Object.freeze({id:`status:${id}`,error}));return null;}}).filter(Boolean):[];}
    statusDocument(id,name){
      const offset=this.memory.pointer(this.statusTable+id*4);if(!Number.isInteger(offset)||!this.memory.contains(offset))return null;
      const commands=this.visuals?.decorate(this.decode(offset))||this.decode(offset);
      return new ns.AnimationDocument({id:`status:${id}`,name,domain:"status",type:"battle",fps:60,offset,commands,accuracy:"partial",
        scene:this.scene,references:{statusId:id},source:{repository:"pret/pokeemerald",file:"data/battle_anim_scripts.s"},properties:[
          {label:"Status",value:name},{label:"Engine",value:"Generation III battle animation program"},
          {label:"Playback",value:"Native call/return/goto flow executed; C tasks and sprites remain explicit runtime tracks"},
          {label:"Script",value:MemoryUtils.hex(offset,6),complexity:"advanced"}
        ]});
    }
    document(id){
      const offset=this.pointer(id);if(!Number.isInteger(offset))return null;
      const decoded=this.decode(offset),commands=this.visuals?.decorate(decoded)||decoded,name=this.moveName(id);
      return new ns.AnimationDocument({id:`move:${id}`,name,domain:"move",type:"battle",fps:60,offset,commands,accuracy:"partial",
        scene:this.scene,references:{moveId:id,animationId:id},source:{repository:"pret/pokeemerald",file:"data/battle_anim_scripts.s"},properties:[
          {label:"Move",value:`#${id} · ${name}`},{label:"Engine",value:"Generation III battle animation program"},
          {label:"Playback",value:"Native call/return/goto flow executed; C tasks and sprites remain explicit runtime tracks"},
          {label:"Pointer table",value:MemoryUtils.hex(this.table,6),complexity:"advanced"},{label:"Script",value:MemoryUtils.hex(offset,6),complexity:"advanced"}
        ]});
    }
    pointerArg(cursor){return MemoryUtils.hex(this.memory.pointer(cursor),6);}
    bytes(cursor,width){this.memory.assertRange(cursor,width);return Array.from(this.memory.slice(cursor,width));}
    dynamicArgs(cursor,{priority=false}={}){
      const target=this.pointerArg(cursor),priorityValue=priority?this.memory.u8(cursor+4):null,countOffset=cursor+(priority?5:4),count=this.memory.u8(countOffset);
      if(count>32)throw new RangeError(`Animation command declares ${count} arguments.`);
      const argsOffset=countOffset+1;this.memory.assertRange(argsOffset,count*2);
      const values=Array.from({length:count},(_,index)=>this.memory.u16(argsOffset+index*2));
      return{cursor:argsOffset+count*2,args:[target,...(priority?[`priority ${priorityValue}`]:[]),...values],value:target};
    }
    event(opcode,name,track,args){
      const joined=args.map(String).join(", ");
      if(opcode===0x00)return{kind:"resource",value:`Sprite tag ${args[0]}`};
      if(opcode===0x01)return{kind:"resource",value:`Sprite tag ${args[0]}`,remove:true};
      if(opcode===0x02)return{kind:"sprite",value:`Template ${args[0]}`};
      if(opcode===0x03)return{kind:"task",value:`Visual task ${args[0]}`};
      if(opcode===0x1f)return{kind:"sound",value:`Sound task ${args[0]}`};
      if(track==="sound")return{kind:"sound",value:joined||name};
      if(track==="background")return{kind:"background",value:joined||name};
      if(track==="blend")return{kind:"blend",value:joined||name};
      if(track==="visibility")return{kind:"visibility",value:opcode===0x2b?"hidden":"visible"};
      return{kind:"flow",value:name,flow:opcode===0x0e?"call":opcode===0x0f?"return":opcode===0x13?"jump":"step",note:`${name}${joined?` ${joined}`:""}`};
    }
    decode(offset,{limit=1024}={}){
      const commands=[],returns=[],visits=new Map();let cursor=offset;
      for(let count=0;count<limit&&this.memory.contains(cursor);count++){
        const visitKey=`${cursor}:${returns.length}`,visitCount=(visits.get(visitKey)||0)+1;visits.set(visitKey,visitCount);
        if(visitCount>4){
          commands.push({label:"Loop boundary",source:`execution stopped at ${MemoryUtils.hex(cursor,6)} after four visits`,offset:cursor,valid:true,event:{kind:"flow",note:"Bounded native loop"}});
          break;
        }
        const start=cursor,opcode=this.memory.u8(cursor++),definition=COMMANDS[opcode];
        if(!definition){commands.push({label:`Data ${hexByte(opcode)}`,source:`db ${hexByte(opcode)} ; unknown native opcode`,offset:start,opcode,valid:false,event:{kind:"flow",note:"Unknown opcode"}});break;}
        const [name,width,track]=definition;let args=[];
        try{
          if(width==="sprite"){const decoded=this.dynamicArgs(cursor,{priority:true});cursor=decoded.cursor;args=[decoded.args[0],`battler/subpriority ${decoded.args[1].replace("priority ","")}`,...decoded.args.slice(2)];}
          else if(width==="visualTask"){const decoded=this.dynamicArgs(cursor,{priority:true});cursor=decoded.cursor;args=decoded.args;}
          else if(width==="soundTask"){const decoded=this.dynamicArgs(cursor);cursor=decoded.cursor;args=decoded.args;}
          else if([0x0e,0x13,0x24].includes(opcode)){args=[this.pointerArg(cursor)];cursor+=4;}
          else if(opcode===0x11){args=[this.pointerArg(cursor),this.pointerArg(cursor+4)];cursor+=8;}
          else if(opcode===0x12){args=[`turn ${this.memory.u8(cursor)}`,this.pointerArg(cursor+1)];cursor+=5;}
          else if(opcode===0x21){args=[`arg ${this.memory.u8(cursor)}`,this.memory.u16(cursor+1),this.pointerArg(cursor+3)];cursor+=7;}
          else if(opcode===0x00||opcode===0x01){args=[this.memory.u16(cursor)];cursor+=2;}
          else if([0x09,0x19,0x1b,0x1c,0x1d,0x26,0x27].includes(opcode)){
            const bytes=this.bytes(cursor,width);args=[`song ${this.memory.u16(cursor)}`,...bytes.slice(2)];cursor+=width;
          }else{args=this.bytes(cursor,width);cursor+=width;}
        }catch(error){
          commands.push({label:name,source:`${name} ; truncated native command`,offset:start,opcode,valid:false,error,event:{kind:"flow",note:"Truncated command"}});break;
        }
        const duration=opcode===0x04?Math.max(1,Number(args[0])||1):1,source=`${name}${args.length?` ${args.join(", ")}`:""}`;
        const event=this.event(opcode,name,track,args),conditional=[0x11,0x12,0x21,0x24].includes(opcode);
        commands.push({label:name,source,offset:start,opcode,args,duration,track,event:conditional?Object.freeze({...event,branchIgnored:true,note:`${name} · live battle/input branch shown but not guessed`}):event,callDepth:returns.length,valid:true});
        if(opcode===0x08)break;
        if(opcode===0x0e){
          const target=Number(args[0]);if(Number.isInteger(target)&&this.memory.contains(target)){returns.push(cursor);cursor=target;}
          continue;
        }
        if(opcode===0x0f){
          if(returns.length)cursor=returns.pop();else break;
          continue;
        }
        if(opcode===0x13){
          const target=Number(args[0]);if(Number.isInteger(target)&&this.memory.contains(target))cursor=target;else break;
        }
      }
      return commands;
    }
    patch(document,changes){return this.speciesAnimations?.patch(document,changes)||[];}
  }
  ns.GbaAnimationDriver=GbaAnimationDriver;
  ns.registry.register("gba",context=>new GbaAnimationDriver(context));
})(globalThis);
