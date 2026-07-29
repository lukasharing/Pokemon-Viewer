(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).pokedex;
  const PREVIEW_PALETTE=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);

  class GbcPokedexDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.data=reader.gen1SpeciesData||=new PokemonViewer.gen1.Gen1SpeciesData(reader);
      this.progression=reader.gen1ProgressionData||=new PokemonViewer.gen1.Gen1ProgressionData(reader,{speciesData:this.data});
      const graph=this.reader.resourceGraph||this.data.resourceGraph();
      if(!graph.has("gen1:move:1"))this.reader.resourceGraph=this.progression.resourceGraph(graph);
      this.editable=true;
    }

    resourceGraph(){return this.reader.resourceGraph;}
    evolutionEdges(){
      if(this._evolutionEdges)return this._evolutionEdges;
      const edges=[];
      for(const document of this.progression.canonicalDocuments()){
        const from=document.species.dexNumber;if(!from)continue;
        for(const value of document.evolutions){
          const to=value.target.dexNumber;if(!to)continue;
          const label=value.name==="level"?`Lv ${value.minimumLevel}`:value.name==="item"?value.itemName:"Trade";
          edges.push(Object.freeze({from,to,label}));
        }
      }
      return this._evolutionEdges=Object.freeze(edges);
    }

    list(){
      return Array.from({length:151},(_,index)=>{
        const dexNumber=index+1,species=this.data.speciesByDex(dexNumber);
        return{id:dexNumber,name:species?`${String(dexNumber).padStart(3,"0")} · ${species.name}`:`Pokédex #${dexNumber}`};
      });
    }

    read(id){
      if(!Number.isInteger(id)||id<1||id>151)return null;
      const document=this.data.document(id);
      const progression=this.progression.document(document.internalId);
      return Object.freeze({...document,progression,resourceId:PokemonViewer.resources.ResourceId.create("gen1","species",String(id))});
    }

    properties(entry){
      const base=entry.base;
      return [
        ["Pokédex number",`#${entry.id}`],
        ["Resource ID",entry.resourceId],
        ["Internal species ID",`${MemoryUtils.hex(entry.internalId)} (${entry.internalId})`],
        ["Category",entry.category],
        ["Height",`${entry.feet}′ ${entry.inches}″`],
        ["Weight",`${(entry.weight/10).toFixed(1)} lb`],
        ["HP",base.hp],["Attack",base.attack],["Defense",base.defense],
        ["Speed",base.speed],["Special",base.special],
        ["Types",base.type1===base.type2?this.data.typeName(base.type1):`${this.data.typeName(base.type1)} / ${this.data.typeName(base.type2)}`],
        ["Catch rate",base.catchRate],["Base experience",base.baseExperience],
        ["Growth",this.data.growthName(base.growthRate)],
        ["Starting moves",base.startingMoves.map(id=>id===0?"NO_MOVE":this.progression.moves.get(id)?.name||`Move ${id}`).join(" · ")],
        ["Entry offset",MemoryUtils.hex(entry.offset,6)],
        ["Base stats offset",MemoryUtils.hex(base.offset,6)]
      ];
    }

    editFields(entry){
      return [
        {name:"feet",label:"Height (feet)",type:"number",value:entry.feet,min:0,max:255},
        {name:"inches",label:"Height (inches)",type:"number",value:entry.inches,min:0,max:11},
        {name:"weight",label:"Weight (0.1 lb)",type:"number",value:entry.weight,min:0,max:65535}
      ];
    }

    editMessage(){return "Red/Blue stores Pokédex height as feet/inches and weight in tenths of a pound.";}

    baseFields(entry){
      const base=entry.base,field=(name,label,max=255)=>({name,label,type:"number",value:base[name],min:0,max,fullWidth:false});
      const typeOptions=PokemonViewer.gen1.Gen1SpeciesData.TYPE_IDS.map(value=>({value,label:`${this.data.typeName(value)} · ${value}`}));
      const moveName=id=>id===0?"NO_MOVE":this.progression.moves.get(id)?.name||`Move ${id}`;
      return[
        field("hp","HP"),field("attack","Attack"),field("defense","Defense"),field("speed","Speed"),field("special","Special"),
        {name:"type1",label:"Primary type",options:typeOptions,value:base.type1,valueType:"number",fullWidth:false},
        {name:"type2",label:"Secondary type",options:typeOptions,value:base.type2,valueType:"number",fullWidth:false},
        field("catchRate","Catch rate"),field("baseExperience","Base experience"),
        ...base.startingMoves.map((id,index)=>({name:`move${index+1}`,label:`Starting move ${index+1} · ${moveName(id)}`,type:"number",value:id,min:0,max:165,fullWidth:false})),
        {name:"growthRate",label:"Growth rate",options:PokemonViewer.gen1.GROWTH_NAMES.map((label,value)=>({value,label:`${label} · ${value}`})),value:base.growthRate,valueType:"number",fullWidth:false}
      ];
    }

    baseMessage(){return "Edits verified Red/Blue stats, types, catch/base EXP, four starting moves and growth. Pokédex identity, sprite dimensions/pointers, TM/HM bytes and padding remain byte-identical.";}

    editBase(entry,values,stack){
      const plan=this.data.baseEditPlan(entry.species,values);
      if(plan.before.every((value,index)=>value===plan.after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"Red/Blue Base Stats changed after this command"});
      stack.execute({
        label:`Edit ${entry.name} base data`,description:`Pokédex #${entry.id}`,
        do:()=>{write(plan.before,plan.after);this.refreshGraph();},
        undo:()=>{write(plan.after,plan.before);this.refreshGraph();}
      });
      return true;
    }

    token(value){return String(value??"").trim();}
    speciesId(value){
      const token=this.token(value),internalMatch=/^internal:(\d+)$/i.exec(token);
      if(internalMatch){
        const internalId=Number(internalMatch[1]);
        if(this.data.catalog.get(internalId))return internalId;
      }
      const numeric=Number(token);
      if(Number.isInteger(numeric)&&numeric>=1&&numeric<=151)return this.data.speciesByDex(numeric).internalId;
      const match=this.data.catalog.list().find(species=>species.dexNumber&&species.name.toLowerCase()===token.toLowerCase());
      if(!match)throw new RangeError(`Unknown Red/Blue species '${token}'. Use a name, Pokédex number, or internal:<id>.`);
      return match.internalId;
    }

    moveId(value){
      const token=this.token(value),numeric=Number(token);
      if(Number.isInteger(numeric)&&numeric>=1&&numeric<=165)return numeric;
      const match=this.progression.moves.list().find(move=>move.name.toLowerCase()===token.toLowerCase());
      if(!match)throw new RangeError(`Unknown Red/Blue move '${token}'.`);
      return match.id;
    }

    lines(value){return String(value??"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);}

    parseEvolution(line){
      const parts=line.split(",").map(value=>value.trim()),method=parts.shift()?.toLowerCase();
      if(method==="level")return{method,minimumLevel:Number(parts[0]),targetId:this.speciesId(parts[1])};
      if(method==="item")return{method,item:Number(parts[0]),minimumLevel:Number(parts[1]),targetId:this.speciesId(parts[2])};
      if(method==="trade")return{method,minimumLevel:Number(parts[0]),targetId:this.speciesId(parts[1])};
      throw new RangeError(`Unknown Red/Blue evolution method '${method}'.`);
    }

    progressionFields(entry){
      const evolution=value=>{
        if(value.name==="level")return`level, ${value.minimumLevel}, ${value.target.name}`;
        if(value.name==="item")return`item, ${value.item}, ${value.minimumLevel}, ${value.target.name}`;
        return`trade, ${value.minimumLevel}, ${value.target.name}`;
      };
      return[
        {name:"evolutions",label:"Evolutions",multiline:true,value:entry.progression.evolutions.map(evolution).join("\n"),hint:"level, 16, Ivysaur · item, 32, 1, Vaporeon · trade, 1, Alakazam"},
        {name:"learnset",label:"Level-up moves",multiline:true,value:entry.progression.learnset.map(item=>`${item.level}, ${item.move.name}`).join("\n"),hint:"One level and move name per line, for example: 15, Razor Leaf"}
      ];
    }

    progressionMessage(entry){
      const owners=this.progression.owners(entry.progression.offset);
      return`Uses the exact Red/Blue evolution and learnset record. Names or Pokédex numbers are accepted. ${owners.length>1?`This record is shared by ${owners.length} internal slots and will be detached before writing.`:"Growth relocates inside the original ROM bank when required."}`;
    }

    editProgression(entry,values,stack){
      const evolutions=this.lines(values.evolutions).map(line=>this.parseEvolution(line));
      const learnset=this.lines(values.learnset).map(line=>{
        const [level,...move]=line.split(",");
        return{level:Number(level.trim()),moveId:this.moveId(move.join(",").trim())};
      });
      const nextBytes=this.progression.encodeProgression({evolutions,learnset}),current=entry.progression;
      if(nextBytes.length===current.length&&nextBytes.every((value,index)=>this.memory.u8(current.offset+index)===value))return false;
      let plan=null;
      const apply=()=>{
        plan||=this.progression.progressionPlan(entry.internalId,{evolutions,learnset});
        this.progression.apply(plan);this._evolutionEdges=null;this.refreshGraph();
      };
      const restore=()=>{this.progression.restore(plan);this._evolutionEdges=null;this.refreshGraph();};
      stack.execute({
        label:`Edit ${entry.name} progression`,
        description:`${evolutions.length} evolutions · ${learnset.length} level-up moves`,
        do:apply,undo:restore
      });
      return true;
    }

    cryFields(entry){
      return[
        {name:"baseCry",label:"Base cry",type:"number",value:entry.cry.baseCry,min:0,max:255},
        {name:"pitch",label:"Pitch",type:"number",value:entry.cry.pitch,min:0,max:255},
        {name:"length",label:"Length",type:"number",value:entry.cry.length,min:0,max:255}
      ];
    }

    editCry(entry,values,stack){
      const plan=this.data.cryEditPlan(entry.species,values);
      if(plan.before.every((value,index)=>value===plan.after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,plan.offset,expected,next,{message:"CryData changed after this command"});
      stack.execute({
        label:`Edit ${entry.name} cry`,description:`Pokédex #${entry.id}`,
        do:()=>{write(plan.before,plan.after);this.refreshGraph();},
        undo:()=>{write(plan.after,plan.before);this.refreshGraph();}
      });
      return true;
    }

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

    editMachines(entry,values,stack){
      const indexes=this.progression.moves.machines().filter(machine=>values[`machine_${machine.index}`]).map(machine=>machine.index);
      const offset=entry.base.offset+20,before=MemoryUtils.bytes(this.memory,offset,7),after=this.data.encodeMachines(entry.base,indexes);
      if(before.every((value,index)=>value===after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,offset,expected,next,{message:"Species TM/HM compatibility changed after this command"});
      stack.execute({label:`Edit ${entry.name} TM/HM compatibility`,description:`Pokédex #${entry.id}`,
        do:()=>{write(before,after);this.refreshGraph();},undo:()=>{write(after,before);this.refreshGraph();}
      });
      return true;
    }

    refreshGraph(){
      this.progression.invalidate();
      let graph=this.progression.resourceGraph(this.data.resourceGraph());
      const trainers=this.reader.gen1TrainerData;if(trainers)graph=trainers.resourceGraph(graph);
      this.reader.resourceGraph=graph;
    }

    edit(entry,values,stack){
      const before=MemoryUtils.bytes(this.memory,entry.measurementOffset,4);
      const after=PokemonViewer.gen1.Gen1SpeciesData.encodeMeasurements(values);
      if(before.every((value,index)=>value===after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.memory,entry.measurementOffset,expected,next,{message:"Pokédex measurements changed after this command"});
      stack.execute({
        label:`Edit Pokédex #${entry.id} measurements`,
        description:entry.name,
        do:()=>write(before,after),undo:()=>write(after,before)
      });
      return true;
    }

    spriteSides(){return Object.freeze([{id:"front",label:"Front sprite"},{id:"back",label:"Back sprite"}]);}
    levelUpMoves(entry){return entry?.progression?.learnset?.map(value=>Object.freeze({moveId:value.moveId,level:value.level,name:value.move.name}))||[];}

    sprite(id,side="front"){
      const entry=this.read(id);if(!entry)return null;
      const back=side==="back",picture=back?this.data.backSprite(entry.species,entry.base):this.data.frontSprite(entry.species,entry.base),scale=back?2:1,canvas=document.createElement("canvas");
      canvas.width=canvas.height=64;
      const context=canvas.getContext("2d"),image=context.createImageData(64,64);
      const renderedWidth=picture.width*8*scale,renderedHeight=picture.height*8*scale;
      const originX=Math.floor((64-renderedWidth)/2),originY=Math.floor((64-renderedHeight)/2);
      const memory=new RomMemory(picture.bytes);
      for(let tile=0;tile<picture.width*picture.height;tile++){
        const pixels=GbcSpriteCodec.decodeTile(memory,tile*16),tileX=tile%picture.width,tileY=Math.floor(tile/picture.width);
        for(let pixel=0;pixel<64;pixel++){
          const color=pixels[pixel],hex=PREVIEW_PALETTE[color],rgb=Number.parseInt(hex.slice(1),16);
          const sourceX=originX+(tileX*8+pixel%8)*scale,sourceY=originY+(tileY*8+Math.floor(pixel/8))*scale;
          for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
            const target=((sourceY+dy)*64+sourceX+dx)*4;
            image.data[target]=rgb>>16;image.data[target+1]=rgb>>8&0xff;image.data[target+2]=rgb&0xff;image.data[target+3]=color===0?0:255;
          }
        }
      }
      context.putImageData(image,0,0);
      return{
        canvas,bytes:picture.bytes,count:picture.width*picture.height,columns:picture.width,
        offset:picture.offset,title:`${entry.name} ${back?"back":"front"} sprite · decompressed Gen I preview`,
        editable:false,palette:PREVIEW_PALETTE,compressedOffset:picture.offset,side:back?"back":"front",nativeScale:scale
      };
    }
  }

  ns.registry.register("gbc",context=>new GbcPokedexDriver(context));
})(globalThis);
