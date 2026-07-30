(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  class GbaMoveDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.editable=true;
      this.moves=reader.gbaMoveData||=new root.gba.GbaMoveData(reader);
      this.species=reader.gbaSpeciesData||=new root.gba.GbaSpeciesData(reader);
      this.trainers=reader.type==="emerald"?(reader.gbaTrainerData||=new root.gba.GbaTrainerData(reader,{speciesData:this.species})):null;
      this.trainerSprites=this.trainers&&root.battle?.GbaTrainerSpriteCatalog?new root.battle.GbaTrainerSpriteCatalog(reader):null;
    }
    list(){return this.moves.list();}
    read(id){const move=this.moves.get(id);return Object.freeze({...move,resourceId:root.resources.ResourceId.create("gba","move",String(id))});}
    summary(move){return`${this.moves.typeName(move.type)} · ${move.power?`${move.power} power`:"Status move"} · ${move.accuracy}% accuracy · ${move.pp} PP`;}
    profile(move){return[
      {label:"Type",value:this.moves.typeName(move.type),icon:"fa-circle"},{label:"Power",value:move.power||"Status",icon:"fa-burst"},
      {label:"Accuracy",value:`${move.accuracy}%`,icon:"fa-bullseye"},{label:"PP",value:move.pp,icon:"fa-battery-three-quarters"},
      {label:"Priority",value:move.priority,icon:"fa-arrow-up"},{label:"Target",value:this.moves.targetName(move.target),icon:"fa-crosshairs"}
    ];}
    properties(move){return[
      ["Move ID",`${move.id} (${MemoryUtils.hex(move.id)})`],["Resource ID",move.resourceId],["Type",`${this.moves.typeName(move.type)} (${move.type})`],
      ["Power",move.power],["Accuracy",`${move.accuracy}%`],["PP",move.pp],["Effect",MemoryUtils.hex(move.effect)],["Effect chance",`${move.effectChance}%`],
      ["Target",`${this.moves.targetName(move.target)} (${MemoryUtils.hex(move.target)})`],["Priority",move.priority],["Flags",MemoryUtils.hex(move.flags,8)],
      ["Record offset",MemoryUtils.hex(move.offset,6)],["Name offset",MemoryUtils.hex(move.nameOffset,6)]
    ];}
    references(move){
      if(!this.trainers)return[];const references=[];
      for(const trainer of this.trainers.list())for(const member of trainer.party)member.moves.forEach((id,slot)=>{
        if(id!==move.id)return;
        const name=this.reader.getTextByOffset(this.reader.getDictionary(this.reader.textDictionary||"text_table_en"),trainer.offset+4,12).replace(/\s+/g," ").trim()||`Trainer ${trainer.id}`;
        let previewCanvas=null;
        try{previewCanvas=this.trainerSprites?.read(trainer.trainerPic)?.canvas||null;}catch(error){console.warn("Move trainer preview failed",{trainer:trainer.id,error});}
        references.push(Object.freeze({
          kind:"trainer",kindLabel:"Trainer",icon:"fa-user",previewCanvas,
          label:`${trainer.trainerClassName} ${name} · Pokémon ${member.index+1} · slot ${slot+1}`,
          link:{workspace:"battle_editor",trainer:{trainerId:trainer.id}}
        }));
      });
      return references;
    }
    editFields(move){return[
      {name:"power",label:"Power",type:"number",value:move.power,min:0,max:255,fullWidth:false},{name:"accuracy",label:"Accuracy %",type:"number",value:move.accuracy,min:0,max:255,fullWidth:false},
      {name:"pp",label:"PP",type:"number",value:move.pp,min:1,max:40,fullWidth:false},{name:"effectChance",label:"Effect chance %",type:"number",value:move.effectChance,min:0,max:255,fullWidth:false},
      {name:"type",label:"Type",valueType:"number",value:move.type,options:root.gba.GBA_MOVE_TYPES.map((label,value)=>({value,label}))},
      {name:"effect",label:"Effect ID",type:"number",value:move.effect,min:0,max:255,fullWidth:false},{name:"target",label:"Target ID",type:"number",value:move.target,min:0,max:255,fullWidth:false},{name:"priority",label:"Priority",type:"number",value:move.priority,min:-128,max:127,fullWidth:false}
    ];}
    editMessage(){return"Edits the exact 12-byte Generation III BattleMove record. The four-byte engine flag mask is intentionally preserved until every bit has a verified semantic control.";}
    edit(move,values,stack){
      const before=MemoryUtils.bytes(this.memory,move.offset,root.gba.GbaMoveData.RECORD_SIZE),after=this.moves.encode(move,values);if(before.every((value,index)=>value===after[index]))return false;
      const replace=(expected,next)=>MemoryUtils.replace(this.memory,move.offset,expected,next,{message:"Generation III move changed after this command"});
      stack.execute({label:`Edit ${move.name}`,description:`GBA Move #${move.id}`,do:()=>{replace(before,after);this.moves.invalidate();},undo:()=>{replace(after,before);this.moves.invalidate();}});return true;
    }
    animationLink(move){
      const table=this.species.profile.battleAnimations;if(!Number.isInteger(table))return null;
      const offset=this.memory.pointer(table+move.id*4);return Number.isInteger(offset)?{workspace:"animation_editor",animation:move.id,offset,reference:`gba:move:${move.id}`}:null;
    }
    animationSummary(move,link){return `Verified gBattleAnims_Moves pointer ${MemoryUtils.hex(link.offset,6)} for ${move.name}. Rendering accuracy is reported by Animation Editor.`;}
  }
  root.moves.registry.register("gba",context=>new GbaMoveDriver(context));
})(globalThis);
