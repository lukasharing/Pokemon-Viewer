(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).pokedex;
  const machines=()=>PokemonViewer.gba.GBA_MACHINES;

  class GbaPokedexDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.data=reader.gbaSpeciesData||=new PokemonViewer.gba.GbaSpeciesData(reader);
      this.profile=this.data.profile;
      this.species=this.data.catalog;
      this.sprites=new PokemonViewer.battle.GbaMonsterSpriteCatalog(reader);
      if(!reader.resourceGraph?.has?.("gba:species:1"))reader.resourceGraph=this.data.resourceGraph(reader.resourceGraph);
      this.editable=true;
    }
    list(){return Object.freeze(this.data.list().map(item=>Object.freeze({...item,label:`#${item.id} · ${item.name}`})));}
    read(id){if(!Number.isInteger(id)||id<1||id>this.profile.speciesCount)return null;try{const entry=this.data.document(id);return Object.freeze({...entry,cry:this.data.cry(id),evolutions:this.data.evolutions(id),learnset:this.levelUpMoves(entry),machines:this.machineDocuments(entry)});}catch(error){if(id<1||id>this.profile.speciesCount)return null;throw error;}}
    sprite(id,side="front"){return this.sprites.source(id,side);}
    icon(id){return this.data.iconSource(id);}
    footprint(id){
      return ns.FootprintCodec.source(this.data.footprint(id));
    }
    moveName(id){
      if(!Number.isInteger(this.profile.moveNames)||!Number.isInteger(id)||id<1||id>this.profile.moveCount)return `Move ${id}`;
      return this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),this.profile.moveNames+id*13,13).trim()||`Move ${id}`;
    }
    levelUpMoves(entry){return this.data.levelUpMoves(entry.id).map(move=>Object.freeze({...move,name:this.moveName(move.moveId)}));}
    spriteSides(){return Number.isInteger(this.profile.monsterBackPics)?[{id:"front",label:"Front sprite"},{id:"back",label:"Back sprite"}]:[{id:"front",label:"Front sprite"}];}
    canEditEntry(entry){return Number.isInteger(entry?.offset)&&Number.isInteger(entry?.dexNumber);}
    evolutionLabel(value){
      const condition=value.method===4?`Lv ${value.param}`:
        value.method===5?"Trade":
        value.method===6?`Trade holding item #${value.param}`:
        value.method===7?`Use item #${value.param}`:
        value.method===15?`Beauty ${value.param}`:
        value.methodName;
      return`${condition} → ${value.target?.name||`Species ${value.targetId}`}`;
    }
    properties(entry){return[
      ["Internal species",`#${entry.id} of ${this.profile.speciesCount}`],["National Pokédex",entry.dexNumber===null?"No independent entry":`#${entry.dexNumber}`],["Category",entry.category],
      ["Height",Number.isInteger(entry.height)?`${entry.height/10} m`:"Not stored"],["Weight",Number.isInteger(entry.weight)?`${entry.weight/10} kg`:"Not stored"],
      ["Entry offset",Number.isInteger(entry.offset)?MemoryUtils.hex(entry.offset,6):"Not applicable"]
    ];}
    cryAudition(entry){return entry?.cry?{...entry.cry,family:"gba"}:null;}
    evolutionEdges(){
      if(this._evolutionEdges)return this._evolutionEdges;
      const edges=[];
      // Empty internal slots 252–276 are valid engine IDs but are not Pokédex
      // species and may contain non-canonical evolution padding.  Evolution
      // lines describe the canonical Pokédex graph only.
      for(const species of this.data.pokedexSpecies())for(const value of this.data.evolutions(species.id)){
        edges.push(Object.freeze({from:species.id,to:value.targetId,label:this.evolutionLabel(value).split(" → ")[0]}));
      }
      return this._evolutionEdges=Object.freeze(edges);
    }
    machineDocuments(entry){
      const selected=new Set(this.data.machineIndexes(entry.id));
      return Object.freeze(machines().slice(0,this.profile.tmHmCount).filter(machine=>selected.has(machine.index)));
    }
    machineFields(entry){
      const selected=new Set(this.data.machineIndexes(entry.id));
      return machines().slice(0,this.profile.tmHmCount).map(machine=>({
        name:`machine_${machine.index}`,label:`${machine.label} · ${machine.name}`,type:"checkbox",value:selected.has(machine.index),fullWidth:false
      }));
    }
    machineMessage(){return`Select the exact ${this.profile.tmHmCount===58?"50 TMs and 8 HMs":"50 TMs and 7 HMs"} stored in this ROM's eight-byte learnset. Unused high bits remain byte-identical.`;}
    editMachines(entry,values,stack){
      const indexes=machines().slice(0,this.profile.tmHmCount).filter(machine=>values[`machine_${machine.index}`]).map(machine=>machine.index);
      const offset=this.profile.tmHmLearnsets+entry.id*8,before=MemoryUtils.bytes(this.memory,offset,8),after=this.data.encodeMachines(entry.id,indexes);
      if(before.every((value,index)=>value===after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,offset,expected,next,{message:"Generation III TM/HM compatibility changed after this command"});
      stack.execute({label:`Edit ${entry.name} TM/HM compatibility`,description:`${indexes.length} machines`,do:()=>write(before,after),undo:()=>write(after,before)});
      return true;
    }
    progressionFields(entry){
      return[{name:"evolutions",label:"Evolution slots",multiline:true,value:entry.evolutions.map(value=>`${value.method}, ${value.param}, ${value.target.name}`).join("\n"),hint:"One per line: method ID, parameter, species name or ID. Example: 4, 16, Ivysaur"}];
    }
    progressionMessage(){return"Generation III stores exactly five fixed evolution slots per species. Method, parameter and target are editable; the compiler preserves each record's two alignment bytes.";}
    speciesId(value){
      const token=String(value??"").trim(),numeric=Number(token);
      if(Number.isInteger(numeric)&&numeric>=1&&numeric<=this.profile.speciesCount)return numeric;
      const match=this.species.list().find(item=>item.name.toLowerCase()===token.toLowerCase());
      if(!match)throw new RangeError(`Unknown Generation III species '${token}'.`);
      return match.id;
    }
    editProgression(entry,values,stack){
      const evolutions=String(values.evolutions??"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
        const [method,param,...target]=line.split(",").map(value=>value.trim());
        return{method:Number(method),param:Number(param),targetId:this.speciesId(target.join(","))};
      });
      const plan=this.data.evolutionEditBytes(entry.id,evolutions);
      if(plan.before.every((value,index)=>value===plan.after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"Generation III evolution table changed after this command"});
      stack.execute({label:`Edit ${entry.name} evolutions`,description:`${evolutions.length} evolution slots`,do:()=>{write(plan.before,plan.after);this._evolutionEdges=null;},undo:()=>{write(plan.after,plan.before);this._evolutionEdges=null;}});
      return true;
    }
    edit(entry,values,stack){
      if(!this.canEditEntry(entry))throw new Error(`Internal species ${entry?.id} has no Pokédex height/weight record to edit.`);
      const before={height:entry.height,weight:entry.weight},after={height:Number(values.height),weight:Number(values.weight)};
      for(const [label,value] of Object.entries(after))if(!Number.isInteger(value)||value<0||value>0xffff)throw new RangeError(`${label} must be an unsigned 16-bit integer.`);
      const replacements=(expected,next)=>[
        {offset:entry.offset+12,expected:MemoryUtils.valueBytes("u16",expected.height),next:MemoryUtils.valueBytes("u16",next.height)},
        {offset:entry.offset+14,expected:MemoryUtils.valueBytes("u16",expected.weight),next:MemoryUtils.valueBytes("u16",next.weight)}
      ];
      const apply=(expected,next)=>MemoryUtils.replaceAll(this.memory,replacements(expected,next),{message:"Pokédex entry changed after this command"});
      stack.execute({label:`Edit Pokédex ${entry.id}`,do:()=>apply(before,after),undo:()=>apply(after,before)});
      return true;
    }
  }
  ns.registry.register("gba",context=>new GbaPokedexDriver(context));
})(globalThis);
