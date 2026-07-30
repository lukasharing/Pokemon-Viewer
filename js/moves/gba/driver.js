(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  class GbaMoveDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.editable=true;
      this.moves=reader.gbaMoveData||=new root.gba.GbaMoveData(reader);
      this.species=reader.gbaSpeciesData||=new root.gba.GbaSpeciesData(reader);
      this.items=reader.gbaItemData||=new root.gba.GbaItemData(reader);
      this.trainers=reader.type==="emerald"?(reader.gbaTrainerData||=new root.gba.GbaTrainerData(reader,{speciesData:this.species})):null;
      this.trainerSprites=this.trainers&&root.battle?.GbaTrainerSpriteCatalog?new root.battle.GbaTrainerSpriteCatalog(reader):null;
      this._references=null;
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
    machineCanvas(machine){
      const source=this.items.machineSource(machine);
      if(!source)throw new Error(`${machine.label} has no native Generation III bag icon.`);
      return source.canvas;
    }
    referenceIndex(){
      if(this._references)return this._references;
      const references=new Map(),add=(moveId,reference)=>{
        if(!references.has(moveId))references.set(moveId,[]);
        references.get(moveId).push(Object.freeze(reference));
      };
      const machines=root.gba.GBA_MACHINES.slice(0,this.species.profile.tmHmCount);
      for(const entry of this.species.catalog.list()){
        const name=entry.name;
        for(const value of this.species.levelUpMoves(entry.id))add(value.moveId,{
          kind:"species",kindLabel:"Pokémon",icon:"fa-paw",label:`${name} · level ${value.level}`,
          link:{workspace:"pokedex_editor",species:entry.id,reference:`gba:learnset:${entry.id}`}
        });
        for(const machineIndex of this.species.machineIndexes(entry.id)){
          const machine=machines[machineIndex];if(!machine)continue;
          add(machine.moveId,{
            kind:"machine",kindLabel:"TM/HM",icon:"fa-compact-disc",previewCanvas:this.machineCanvas(machine),
            label:`${machine.label} · ${machine.name} · ${name}`,
            link:{workspace:"pokedex_editor",species:entry.id,reference:`gba:machine-compatibility:${entry.id}`}
          });
        }
      }
      if(this.trainers)for(const trainer of this.trainers.list())for(const member of trainer.party)member.moves.forEach((moveId,slot)=>{
        if(!moveId)return;
        const name=this.reader.getTextByOffset(this.reader.getDictionary(this.reader.textDictionary||"text_table_en"),trainer.offset+4,12).replace(/\s+/g," ").trim()||`Trainer ${trainer.id}`;
        const previewCanvas=this.trainerSprites?.read(trainer.trainerPic)?.canvas||null;
        add(moveId,{
          kind:"trainer",kindLabel:"Trainer",icon:"fa-user",previewCanvas,
          label:`${trainer.trainerClassName} ${name} · Pokémon ${member.index+1} · move ${slot+1}`,
          link:{workspace:"battle_editor",trainer:{trainerId:trainer.id}}
        });
      });
      for(const values of references.values())values.sort((a,b)=>a.label.localeCompare(b.label));
      return this._references=references;
    }
    references(move){
      return this.referenceIndex().get(move.id)||[];
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
