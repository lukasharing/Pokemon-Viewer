(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).pokedex;
  class Gen2PokedexDriver{
    constructor({reader}){this.reader=reader;this.memory=reader.memory;this.data=reader.gen2SpeciesData||=new PokemonViewer.gen2.Gen2SpeciesData(reader);this.progression=reader.gen2ProgressionData||=new PokemonViewer.gen2.Gen2ProgressionData(reader,{speciesData:this.data});reader.gen2MoveData=this.progression.moves;this.editable=true;}
    refreshGraph(){const base=this.progression.resourceGraph();this.reader.resourceGraph=this.reader.gen2TrainerData?.resourceGraph(base)||base;return this.reader.resourceGraph;}
    evolutionEdges(){
      if(this._evolutionEdges)return this._evolutionEdges;
      const edges=[];
      for(const document of this.progression.list())for(const value of document.evolutions){
        const match=/\((.*)\)$/.exec(this.evolutionLabel(value));
        edges.push(Object.freeze({from:document.id,to:value.targetId,label:match?.[1]||value.name}));
      }
      return this._evolutionEdges=Object.freeze(edges);
    }
    list(){return this.data.catalog.list().map(species=>({id:species.id,name:`${String(species.id).padStart(3,"0")} · ${species.name}`}));}
    read(id){return Number.isInteger(id)&&id>=1&&id<=251?Object.freeze({...this.data.document(id),progression:this.progression.document(id),resourceId:`gen2:species:${id}`}):null;}
    footprint(id){return ns.FootprintCodec.source(this.data.footprint(id));}
    evolutionLabel(evolution){
      const detail=evolution.name==="level"?`Lv ${evolution.level}`:
        evolution.name==="item"?`item #${evolution.item}`:
        evolution.name==="trade"?(evolution.heldItem===0xff?"trade":`trade holding #${evolution.heldItem}`):
        evolution.name==="happiness"?`happiness · ${evolution.triggerName}`:
        `Lv ${evolution.level} · ${evolution.statName}`;
      return`${evolution.target.name} (${detail})`;
    }
    levelUpMoves(entry){return entry?.progression?.learnset?.map(value=>Object.freeze({moveId:value.moveId,level:value.level,name:value.move.name}))||[];}
    properties(entry){const base=entry.base;return[
      ["Pokédex number",`#${entry.id}`],["Resource ID",entry.resourceId],["Category",entry.category],
      ["Height",this.height(entry.height)],["Weight",`${(entry.weight/10).toFixed(1)} lb`],
      ["HP",base.hp],["Attack",base.attack],["Defense",base.defense],["Speed",base.speed],
      ["Special Attack",base.specialAttack],["Special Defense",base.specialDefense],
      ["Types",`${this.data.typeName(base.type1)} / ${this.data.typeName(base.type2)}`],["Catch rate",base.catchRate],["Base experience",base.baseExperience],
      ["Held items",`${base.item1} / ${base.item2}`],["Gender ratio",base.genderRatio],
      ["Hatch cycles",base.hatchCycles],["Growth rate",this.data.growthName(base.growthRate)],
      ["Egg groups",`${this.data.eggGroupName(base.eggGroups>>>4)} / ${this.data.eggGroupName(base.eggGroups&15)}`],
      ["Egg moves",progression.eggMoves.length?progression.eggMoves.map(item=>item.move.name).join("; "):"None"],
      ["Entry offset",MemoryUtils.hex(entry.offset,6)],["Base data offset",MemoryUtils.hex(base.offset,6)]
    ];}
    height(value){const text=String(value).padStart(3,"0");return`${Number(text.slice(0,-2))}′ ${Number(text.slice(-2))}″`;}
    editFields(entry){return[
      {name:"height",label:"Height (native feet/inches number)",type:"number",value:entry.height,min:0,max:65535},
      {name:"weight",label:"Weight (0.1 lb)",type:"number",value:entry.weight,min:0,max:65535}
    ];}
    editMessage(){return"Crystal stores the displayed feet/inches as one native word and weight in tenths of a pound.";}
    edit(entry,values,stack){const offset=entry.measurementOffset,before=MemoryUtils.bytes(this.memory,offset,4),after=PokemonViewer.gen2.Gen2SpeciesData.encodeMeasurements(values);if(before.every((value,index)=>value===after[index]))return false;const write=(expected,next)=>MemoryUtils.replace(this.memory,offset,expected,next,{message:"Crystal Pokédex measurements changed after this command"});stack.execute({label:`Edit ${entry.name} measurements`,description:`Pokédex #${entry.id}`,do:()=>write(before,after),undo:()=>write(after,before)});return true;}
    baseFields(entry){const base=entry.base,field=(name,label,max=255)=>({name,label,type:"number",value:base[name],min:0,max,fullWidth:false}),options=(values,current)=>values.map(([value,label])=>({value,label:`${label} · ${value}`}));return[
      field("hp","HP"),field("attack","Attack"),field("defense","Defense"),field("speed","Speed"),
      field("specialAttack","Special Attack"),field("specialDefense","Special Defense"),
      {name:"type1",label:"Primary type",options:options([...PokemonViewer.gen2.Gen2SpeciesData.TYPES],base.type1),value:base.type1,valueType:"number",fullWidth:false},
      {name:"type2",label:"Secondary type",options:options([...PokemonViewer.gen2.Gen2SpeciesData.TYPES],base.type2),value:base.type2,valueType:"number",fullWidth:false},
      field("catchRate","Catch rate"),
      field("baseExperience","Base experience"),field("item1","Held item 1"),field("item2","Held item 2"),
      field("genderRatio","Gender ratio"),field("hatchCycles","Hatch cycles"),
      {name:"growthRate",label:"Growth rate",options:PokemonViewer.gen2.Gen2SpeciesData.GROWTH_RATES.map((label,value)=>({value,label:`${label} · ${value}`})),value:base.growthRate,valueType:"number",fullWidth:false},
      {name:"eggGroup1",label:"Egg group 1",options:PokemonViewer.gen2.Gen2SpeciesData.EGG_GROUPS.map((label,value)=>({value,label:`${label} · ${value}`})),value:base.eggGroups>>>4,valueType:"number",fullWidth:false},
      {name:"eggGroup2",label:"Egg group 2",options:PokemonViewer.gen2.Gen2SpeciesData.EGG_GROUPS.map((label,value)=>({value,label:`${label} · ${value}`})),value:base.eggGroups&15,valueType:"number",fullWidth:false}
    ];}
    baseMessage(){return"Edits only verified Crystal BaseData fields. Unknown bytes, picture dimensions, obsolete picture pointers and the machine bitset remain byte-identical in this dialog; use Machine compatibility to edit its 60 verified flags.";}
    editBase(entry,values,stack){const plan=this.data.baseEditPlan(entry.id,values);if(plan.before.every((value,index)=>value===plan.after[index]))return false;const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"Crystal BaseData changed after this command"});stack.execute({label:`Edit ${entry.name} base data`,description:`Pokédex #${entry.id}`,do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)});return true;}
    machineDocuments(entry){
      const selected=new Set(this.data.machineIndexes(entry.base));
      return this.progression.moves.machines().filter(machine=>selected.has(machine.index)).map(machine=>Object.freeze({...machine,move:this.progression.moves.get(machine.moveId)}));
    }
    machineFields(entry){
      const selected=new Set(this.data.machineIndexes(entry.base));
      return this.progression.moves.machines().map(machine=>({
        name:`machine_${machine.index}`,label:`${machine.label} · ${this.progression.moves.get(machine.moveId).name}`,
        type:"checkbox",value:selected.has(machine.index),fullWidth:false
      }));
    }
    machineMessage(){return"Select Crystal's exact 50 TMs, 7 HMs and 3 Move Tutor moves. The four unused high bits in the final BaseData byte remain byte-identical.";}
    editMachines(entry,values,stack){
      const indexes=this.progression.moves.machines().filter(machine=>values[`machine_${machine.index}`]).map(machine=>machine.index);
      const offset=entry.base.offset+24,before=MemoryUtils.bytes(this.memory,offset,8),after=this.data.encodeMachines(entry.base,indexes);
      if(before.every((value,index)=>value===after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,offset,expected,next,{message:"Crystal TM/HM/tutor compatibility changed after this command"});
      const refresh=()=>{this.progression.invalidate();this.reader.gen2TrainerData?.invalidate();this.refreshGraph();};
      stack.execute({label:`Edit ${entry.name} machine compatibility`,description:`${indexes.length} of 60 moves`,
        do:()=>{write(before,after);refresh();},undo:()=>{write(after,before);refresh();}
      });
      return true;
    }
    cryFields(entry){return[
      {name:"baseCry",label:"Base cry",type:"number",value:entry.cry.baseCry,min:0,max:65535},
      {name:"pitch",label:"Pitch",type:"number",value:entry.cry.pitch,min:0,max:65535},
      {name:"length",label:"Length",type:"number",value:entry.cry.length,min:0,max:65535}
    ];}
    editCry(entry,values,stack){const plan=this.data.cryEditPlan(entry.id,values);if(plan.before.every((value,index)=>value===plan.after[index]))return false;const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"Crystal PokemonCries changed after this command"});stack.execute({label:`Edit ${entry.name} cry`,description:`Pokédex #${entry.id}`,do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)});return true;}
    token(value){return String(value??"").trim();}
    speciesId(value){
      const token=this.token(value),numeric=Number(token);
      if(Number.isInteger(numeric)&&numeric>=1&&numeric<=251)return numeric;
      const match=this.data.catalog.list().find(species=>species.name.toLowerCase()===token.toLowerCase());
      if(!match)throw new RangeError(`Unknown Crystal species '${token}'.`);
      return match.id;
    }
    moveId(value){
      const token=this.token(value),numeric=Number(token);
      if(Number.isInteger(numeric)&&numeric>=1&&numeric<=251)return numeric;
      const match=this.progression.moves.list().find(move=>move.name.toLowerCase()===token.toLowerCase());
      if(!match)throw new RangeError(`Unknown Crystal move '${token}'.`);
      return match.id;
    }
    lines(value){return String(value??"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);}
    parseEvolution(line){
      const parts=line.split(",").map(value=>value.trim()),method=parts.shift()?.toLowerCase(),target=this.speciesId(parts.pop());
      if(method==="level")return{method,level:Number(parts[0]),targetId:target};
      if(method==="item")return{method,item:Number(parts[0]),targetId:target};
      if(method==="trade")return{method,heldItem:/^(?:none|-|255)$/i.test(parts[0])?255:Number(parts[0]),targetId:target};
      if(method==="happiness"){
        const triggers={any:1,anytime:1,day:2,morning:2,mornday:2,night:3};
        return{method,trigger:triggers[parts[0]?.toLowerCase()]??Number(parts[0]),targetId:target};
      }
      if(method==="stat"){
        const conditions={"attack>defense":1,"atk>def":1,"attack<defense":2,"atk<def":2,"attack=defense":3,"atk=def":3};
        return{method,level:Number(parts[0]),stat:conditions[parts[1]?.toLowerCase()]??Number(parts[1]),targetId:target};
      }
      throw new RangeError(`Unknown Crystal evolution method '${method}'.`);
    }
    progressionFields(entry){
      const progression=entry.progression,evolution=value=>{
        const target=value.target.name;
        if(value.name==="level")return`level, ${value.level}, ${target}`;
        if(value.name==="item")return`item, ${value.item}, ${target}`;
        if(value.name==="trade")return`trade, ${value.heldItem===255?"none":value.heldItem}, ${target}`;
        if(value.name==="happiness")return`happiness, ${value.trigger===1?"any":value.trigger===2?"day":"night"}, ${target}`;
        return`stat, ${value.level}, ${value.stat===1?"attack>defense":value.stat===2?"attack<defense":"attack=defense"}, ${target}`;
      };
      return[
        {name:"evolutions",label:"Evolutions",multiline:true,value:progression.evolutions.map(evolution).join("\n"),hint:"level, 16, Ivysaur · item, 8, Raichu · trade, none, Alakazam · happiness, day, Espeon · stat, 20, attack>defense, Hitmonlee"},
        {name:"learnset",label:"Level-up moves",multiline:true,value:progression.learnset.map(item=>`${item.level}, ${item.move.name}`).join("\n"),hint:"One level and move name per line, for example: 15, Razor Leaf"},
        {name:"eggMoves",label:"Egg moves",multiline:true,value:progression.eggMoves.map(item=>item.move.name).join("\n"),hint:"One move name per line. Shared empty lists are automatically detached before writing."}
      ];
    }
    progressionMessage(){return"Uses Crystal's exact evolution/learnset and egg-move formats. Names or numeric IDs are accepted. Growing records are relocated inside their original ROM bank; shared egg lists are never edited in place.";}
    editProgression(entry,values,stack){
      const evolutions=this.lines(values.evolutions).map(line=>this.parseEvolution(line));
      const learnset=this.lines(values.learnset).map(line=>{const [level,...move]=line.split(",");return{level:Number(level.trim()),moveId:this.moveId(move.join(",").trim())};});
      const eggMoves=this.lines(values.eggMoves).map(move=>this.moveId(move));
      const progressionBytes=this.progression.encodeProgression({evolutions,learnset}),eggBytes=this.progression.encodeEggMoves(eggMoves);
      const same=(bytes,current)=>bytes.length===current.length&&bytes.every((value,index)=>this.memory.u8(current.offset+index)===value);
      const progressionSame=same(progressionBytes,entry.progression),eggCurrent={offset:entry.progression.eggOffset,length:entry.progression.eggMoves.length+1},eggSame=same(eggBytes,eggCurrent);
      if(progressionSame&&eggSame)return false;
      let progressionPlan=null,eggPlan=null;
      const apply=()=>{
        if(!progressionSame){progressionPlan||=this.progression.progressionPlan(entry.id,{evolutions,learnset});this.progression.apply(progressionPlan);}
        if(!eggSame){eggPlan||=this.progression.eggMovePlan(entry.id,eggMoves);this.progression.apply(eggPlan);}
        this._evolutionEdges=null;this.refreshGraph();
      };
      const restore=()=>{if(eggPlan)this.progression.restore(eggPlan);if(progressionPlan)this.progression.restore(progressionPlan);this._evolutionEdges=null;this.refreshGraph();};
      stack.execute({label:`Edit ${entry.name} progression`,description:`${evolutions.length} evolutions · ${learnset.length} level-up moves · ${eggMoves.length} egg moves`,do:apply,undo:restore});
      return true;
    }
    sprite(id){
      const picture=this.data.frontSprite(id),palette=this.data.palette(id),frame=picture.bytes.slice(0,picture.frameBytes),canvas=document.createElement("canvas");
      canvas.width=canvas.height=64;
      const context=canvas.getContext("2d"),image=context.createImageData(64,64);
      const originX=4+Math.floor((7-picture.width)/2)*8,originY=4+Math.floor((7-picture.height)/2)*8,memory=new RomMemory(frame);
      for(let tile=0;tile<picture.width*picture.height;tile++){
        const pixels=GbcSpriteCodec.decodeTile(memory,tile*16),tileX=tile%picture.width,tileY=Math.floor(tile/picture.width);
        for(let pixel=0;pixel<64;pixel++){
          const hex=palette.colors[pixels[pixel]],rgb=Number.parseInt(hex.slice(1),16),x=originX+tileX*8+pixel%8,y=originY+tileY*8+Math.floor(pixel/8),target=(y*64+x)*4;
          image.data[target]=rgb>>16;image.data[target+1]=rgb>>8&0xff;image.data[target+2]=rgb&0xff;image.data[target+3]=255;
        }
      }
      context.putImageData(image,0,0);
      return{canvas,bytes:frame,count:picture.width*picture.height,columns:picture.width,offset:picture.offset,title:`${this.data.catalog.get(id).name} front sprite · Crystal LZ3 base frame`,editable:false,palette:palette.colors,compressedOffset:picture.offset};
    }
  }
  ns.registry.register("gen2",context=>new Gen2PokedexDriver(context));
})(globalThis);
