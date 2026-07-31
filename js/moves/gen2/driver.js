(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});

  class Gen2MoveDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.editable=true;
      this.species=reader.gen2SpeciesData||=new root.gen2.Gen2SpeciesData(reader);
      this.progression=reader.gen2ProgressionData||=new root.gen2.Gen2ProgressionData(reader,{speciesData:this.species});
      this.moves=reader.gen2MoveData=this.progression.moves;
      this.trainers=reader.gen2TrainerData||=new root.gen2.Gen2TrainerData(reader,{speciesData:this.species,moveData:this.moves});
      this.trainerSprites=new root.sprites.Gen2TrainerSpriteCatalog(reader,{trainerData:this.trainers});
      this.reader.resourceGraph=this.trainers.resourceGraph(this.progression.resourceGraph());
    }
    list(){return this.moves.list();}
    read(id){
      const move=this.moves.get(id);
      return Object.freeze({...move,resourceId:root.resources.ResourceId.create("gen2","move",String(id))});
    }
    summary(move){
      const power=move.power?`${move.power} power`:"Status move";
      return`${this.species.typeName(move.type)} · ${power} · ${move.accuracyPercent}% accuracy · ${move.pp} PP · ${move.effectChancePercent}% effect chance`;
    }
    profile(move){return[
      {label:"Type",value:this.species.typeName(move.type),icon:"fa-circle"},{label:"Power",value:move.power||"Status",icon:"fa-burst"},
      {label:"Accuracy",value:`${move.accuracyPercent}%`,icon:"fa-bullseye"},{label:"PP",value:move.pp,icon:"fa-battery-three-quarters"},
      {label:"Effect chance",value:`${move.effectChancePercent}%`,icon:"fa-wand-magic-sparkles"},{label:"Animation",value:move.animation,icon:"fa-film"}
    ];}
    properties(move){return[
      ["Move ID",`${move.id} (${MemoryUtils.hex(move.id)})`],["Resource ID",move.resourceId],
      ["Type",`${this.species.typeName(move.type)} (${MemoryUtils.hex(move.type)})`],
      ["Power",move.power],["Accuracy",`${move.accuracyPercent}% (${move.accuracy}/255)`],["PP",move.pp],
      ["Effect",MemoryUtils.hex(move.effect)],["Effect chance",`${move.effectChancePercent}% (${move.effectChance}/255)`],
      ["Animation",MemoryUtils.hex(move.animation)],
      ["Record offset",MemoryUtils.hex(move.offset,6)],["Name offset",MemoryUtils.hex(move.nameOffset,6)]
    ];}
    references(move){
      const graph=this.reader.resourceGraph;
      return graph.inbound(move.resourceId).flatMap(edge=>{
        const owner=graph.node(edge.source);
        if(owner?.type==="learnset"){
          const speciesId=Number(owner.key);
          return[Object.freeze({kind:"species",kindLabel:"Pokémon",icon:"fa-paw",label:`${this.species.catalog.get(speciesId)?.name||owner.label} · level ${edge.data.level}`,link:{workspace:"pokedex_editor",species:speciesId,reference:edge.id}})];
        }
        if(owner?.type==="egg-moves"){
          const speciesId=Number(owner.key);
          return[Object.freeze({kind:"species",kindLabel:"Pokémon",icon:"fa-egg",label:`${this.species.catalog.get(speciesId)?.name||owner.label} · egg move`,link:{workspace:"pokedex_editor",species:speciesId,reference:edge.id}})];
        }
        if(owner?.type==="machine"){
          const compatible=graph.inbound(owner.id).flatMap(machineEdge=>{
            const speciesOwner=graph.node(machineEdge.source);
            if(speciesOwner?.type!=="species")return[];
            const speciesId=Number(speciesOwner.key),species=this.species.catalog.get(speciesId);
            return[Object.freeze({kind:"machine",kindLabel:"TM/HM",icon:"fa-compact-disc",label:`${owner.label} · ${species?.name||speciesOwner.label}`,link:{workspace:"pokedex_editor",species:speciesId,reference:machineEdge.id}})];
          });
          return compatible.length?compatible:[Object.freeze({kind:"machine",kindLabel:"TM/HM",icon:"fa-compact-disc",label:owner.label,link:null})];
        }
        if(owner?.type==="party-member"){
          return[Object.freeze({
            kind:"trainer",kindLabel:"Trainer",icon:"fa-user",previewCanvas:this.trainerSprites.source(owner.data.classId).canvas,label:`${owner.label} · explicit move`,
            link:{workspace:"battle_editor",trainer:{trainerClass:owner.data.classId,trainerNumber:owner.data.trainerNumber},reference:edge.id}
          })];
        }
        return[Object.freeze({kind:"data",kindLabel:"Game data",icon:"fa-database",label:owner?.label||edge.source,link:null})];
      }).sort((a,b)=>a.label.localeCompare(b.label));
    }
    editFields(move){
      const typeOptions=[...root.gen2.Gen2SpeciesData.TYPES].map(([value,label])=>({value,label:`${label} · ${value}`}));
      return[
        {name:"power",label:"Power",type:"number",value:move.power,min:0,max:255,fullWidth:false},
        {name:"accuracy",label:"Accuracy (0–255)",type:"number",value:move.accuracy,min:0,max:255,fullWidth:false},
        {name:"pp",label:"PP",type:"number",value:move.pp,min:1,max:40,fullWidth:false},
        {name:"effectChance",label:"Effect chance (0–255)",type:"number",value:move.effectChance,min:0,max:255,fullWidth:false},
        {name:"type",label:"Type",valueType:"number",value:move.type,options:typeOptions},
        {name:"animation",label:"Animation ID",type:"number",value:move.animation,min:0,max:255,fullWidth:false},
        {name:"effect",label:"Effect ID",type:"number",value:move.effect,min:0,max:255,fullWidth:false}
      ];
    }
    editMessage(){return"Edits Crystal's exact seven-byte Move record: animation, effect, power, type, accuracy, PP and effect chance. Names and variable tables are not moved.";}
    edit(move,values,stack){
      const before=MemoryUtils.bytes(this.memory,move.offset,this.moves.recordSize),after=this.moves.encode(move,values);
      if(before.every((value,index)=>value===after[index]))return false;
      const replace=(expected,next)=>MemoryUtils.replace(this.memory,move.offset,expected,next,{message:"Crystal Move record changed after this command"});
      stack.execute({label:`Edit ${move.name}`,description:`Crystal Move #${move.id}`,
        do:()=>{replace(before,after);this.refresh();},undo:()=>{replace(after,before);this.refresh();}
      });
      return true;
    }
    refresh(){this.progression.invalidate();this.trainers.invalidate();this.reader.resourceGraph=this.trainers.resourceGraph(this.progression.resourceGraph());}
    animationLink(move){return{workspace:"animation_editor",animation:move.animation,reference:move.resourceId,move:move.id};}
    animationSummary(move){return `Crystal animation ${MemoryUtils.hex(move.animation)}. Open the Animation Editor for its family-specific decoder status.`;}
  }

  root.moves.registry.register("gen2",context=>new Gen2MoveDriver(context));
})(globalThis);
