(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});

  class GbcMoveDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.editable=true;
      this.species=reader.gen1SpeciesData||=new root.gen1.Gen1SpeciesData(reader);
      this.moves=reader.gen1MoveData||=new root.gen1.Gen1MoveData(reader);
      this.progression=reader.gen1ProgressionData||=new root.gen1.Gen1ProgressionData(reader,{speciesData:this.species,moveData:this.moves});
      this.ensureGraph();
    }
    ensureGraph(){
      let graph=this.reader.resourceGraph||this.species.resourceGraph();
      if(!graph.has("gen1:move:1"))graph=this.progression.resourceGraph(graph);
      this.reader.resourceGraph=graph;return graph;
    }
    list(){return this.moves.list();}
    read(id){
      const move=this.moves.get(id);
      return Object.freeze({...move,resourceId:root.resources.ResourceId.create("gen1","move",String(id))});
    }
    summary(move){
      const power=move.power?`${move.power} power`:"Status move";
      return `${this.moves.typeName(move.type)} · ${power} · ${move.accuracyPercent}% accuracy · ${move.pp} PP`;
    }
    profile(move){return[
      {label:"Type",value:this.moves.typeName(move.type),icon:"fa-circle"},{label:"Power",value:move.power||"Status",icon:"fa-burst"},
      {label:"Accuracy",value:`${move.accuracyPercent}%`,icon:"fa-bullseye"},{label:"PP",value:move.pp,icon:"fa-battery-three-quarters"},
      {label:"Effect",value:move.effectDocument.label,icon:"fa-wand-magic-sparkles"},{label:"Machine",value:move.machines.length?move.machines.map(item=>item.label).join(", "):"None",icon:"fa-compact-disc"}
    ];}
    properties(move){return[
      ["Move ID",`${move.id} (${MemoryUtils.hex(move.id)})`],["Resource ID",move.resourceId],
      ["Type",`${this.moves.typeName(move.type)} (${MemoryUtils.hex(move.type)})`],
      ["Power",move.power],["Accuracy",`${move.accuracyPercent}% (${move.accuracy}/255)`],["PP",move.pp],
      ["Effect",`${move.effectDocument.label} (${MemoryUtils.hex(move.effect)})`],
      ["Effect handler",Number.isInteger(move.effectDocument.offset)?MemoryUtils.hex(move.effectDocument.offset,6):"Battle core / none"],
      ["Animation",`${move.name} (${MemoryUtils.hex(move.animation)})`],
      ["Animation script",MemoryUtils.hex(move.animationDocument.offset,6)],
      ["Sound",`SFX ${MemoryUtils.hex(move.sound.sfxId)} · pitch ${MemoryUtils.hex(move.sound.pitch)} · tempo ${MemoryUtils.hex(move.sound.tempo)}`],
      ["TM/HM",move.machines.length?move.machines.map(machine=>machine.label).join(" · "):"None"],
      ["Record offset",MemoryUtils.hex(move.offset,6)],["Name offset",MemoryUtils.hex(move.nameOffset,6)]
    ];}
    references(move){
      const graph=this.ensureGraph();
      return graph.inbound(move.resourceId).flatMap(edge=>{
        const owner=graph.node(edge.source);
        if(owner?.type==="learnset"){
          const dex=Number(owner.key),species=this.species.speciesByDex(dex);
          return [Object.freeze({kind:"species",kindLabel:"Pokémon",icon:"fa-paw",label:`${species?.name||owner.label||`Pokédex #${dex}`} · level ${edge.data.level}`,
            link:{workspace:"pokedex_editor",species:dex,reference:edge.id}})];
        }
        if(owner?.type==="machine"){
          const compatibility=graph.inbound(owner.id).filter(reference=>graph.node(reference.source)?.type==="species").map(reference=>{
            const speciesNode=graph.node(reference.source),dex=Number(speciesNode.key);
            return Object.freeze({kind:"machine",kindLabel:"TM/HM",icon:"fa-compact-disc",label:`${owner.label} · ${speciesNode.label} compatible`,
              link:{workspace:"pokedex_editor",species:dex,reference:reference.id}});
          });
          return [Object.freeze({kind:"machine",kindLabel:"TM/HM",icon:"fa-compact-disc",label:`${owner.label} · machine`,link:null}),...compatibility];
        }
        return [Object.freeze({kind:"data",kindLabel:"Game data",icon:"fa-database",label:owner?.label||edge.source,link:null})];
      }).sort((a,b)=>a.label.localeCompare(b.label));
    }
    editFields(move){return[
      {name:"power",label:"Power",type:"number",value:move.power,min:0,max:255},
      {name:"accuracy",label:"Accuracy (0–255)",type:"number",value:move.accuracy,min:0,max:255},
      {name:"pp",label:"PP",type:"number",value:move.pp,min:1,max:40},
      {name:"type",label:"Type",valueType:"number",value:move.type,options:Object.entries(root.gen1.TYPES).map(([value,label])=>({value:Number(value),label}))}
    ];}
    edit(move,values,stack){
      const before=MemoryUtils.bytes(this.memory,move.offset,root.gen1.Gen1MoveData.RECORD_SIZE),after=this.moves.encode(move,values);
      if(before.every((value,index)=>value===after[index]))return false;
      const replace=(expected,next)=>MemoryUtils.replace(this.memory,move.offset,expected,next,{message:"Move record changed after this command"});
      stack.execute({label:`Edit ${move.name}`,description:`Move #${move.id}`,
        do:()=>{replace(before,after);this.refresh();},undo:()=>{replace(after,before);this.refresh();}
      });
      return true;
    }
    refresh(){
      this.progression.invalidate();
      let graph=this.progression.resourceGraph(this.species.resourceGraph());
      const trainers=this.reader.gen1TrainerData;
      if(trainers)graph=trainers.resourceGraph(graph);
      this.reader.resourceGraph=graph;
    }
    animationLink(move){return{workspace:"animation_editor",animation:move.animation,offset:move.animationDocument.offset,reference:move.resourceId,move:move.id};}
    animationSummary(move,link){return `Native Gen I animation ${MemoryUtils.hex(move.animation)} at ${MemoryUtils.hex(link.offset,6)}. The command engine is opened separately and remains accuracy-labelled.`;}
  }

  root.moves.registry.register("gbc",context=>new GbcMoveDriver(context));
})(globalThis);
