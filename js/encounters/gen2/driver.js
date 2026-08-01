(function(global){
  "use strict";
  class Gen2EncounterDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=reader.gen2SpeciesData||=new PokemonViewer.gen2.Gen2SpeciesData(reader);
      this.progression=reader.gen2ProgressionData||=new PokemonViewer.gen2.Gen2ProgressionData(reader,{speciesData:this.speciesData});
      this.trainers=reader.gen2TrainerData||=new PokemonViewer.gen2.Gen2TrainerData(reader,{speciesData:this.speciesData,moveData:this.progression.moves});
      const symbol=reader.capabilities.provenance.symbols.MapGroupPointers;
      this.directory=reader.structureRegistry.createMapDirectory(this.memory,{tableOffset:symbol.offset,tableBank:symbol.bank});
      this.data=reader.gen2EncounterData||=new PokemonViewer.gen2.Gen2EncounterData(reader,{speciesData:this.speciesData,mapDirectory:this.directory});
      this.sprites=new Map();
      this.refreshGraph();
    }
    list(){return this.data.list();}
    read(reference){return this.data.find(reference);}
    timeLabel(time){return({morning:"Morning",day:"Day",night:"Night",all:"All day"})[time]||time;}
    tableLabel(document){return document.method==="fishing"?document.rodLabel:document.label;}
    properties(document){
      const owners=this.data.mapOwners(document);
      if(document.method==="fishing")return[
        ["Method","Fishing"],["Fish group",`${document.fishGroup} · ${PokemonViewer.gen2.Gen2EncounterData.FISH_GROUPS[document.fishGroup-1]}`],
        ["Rod",document.rodLabel],["Maps using group",owners.length],["Record",MemoryUtils.hex(document.offset,6)],["Native list size",`${document.size} bytes`]
      ];
      if(document.method==="headbutt"||document.method==="rock")return[
        ["Method",document.method==="rock"?"Rock smash":"Headbutt"],["Set",`${document.treeSet} · ${PokemonViewer.gen2.Gen2EncounterData.TREE_SETS[document.treeSet]}`],
        ["Variant",document.variant],["Maps using set",owners.length],["Record",MemoryUtils.hex(document.offset,6)],["Native list size",`${document.size} bytes`]
      ];
      if(document.method==="contest")return[
        ["Method","Bug-Catching Contest"],["Map",owners[0]?`${owners[0].group}:${owners[0].map}`:"Unresolved"],
        ["Record",MemoryUtils.hex(document.offset,6)],["Native list size",`${document.size} bytes`]
      ];
      if(document.method==="roamer")return[
        ["Method","Roaming Pokémon"],["Configured roamers",document.slots.length],["Route network",`${document.routes.length} maps`],
        ["Initializer",MemoryUtils.hex(document.offset,6)],["Route data",MemoryUtils.hex(document.routesOffset,6)],
        ["Runtime state","Stored in save/WRAM; not inferred from ROM"]
      ];
      if(document.method==="static")return[
        ["Method","Static / scripted"],["Context",document.context],["Script",document.scriptSymbol],
        ["Command",MemoryUtils.hex(document.offset,6)],["Opcode","loadwildmon ($5D)"]
      ];
      return[
        ["Region",document.region==="johto"?"Johto":"Kanto"],["Method",document.method==="grass"?"Grass / walking":"Water / surfing"],
        ["Map",`${document.group}:${document.map}`],["Record",MemoryUtils.hex(document.offset,6)],["Native size",`${document.size} bytes`]
      ];
    }
    mapLinks(document){return this.data.mapOwners(document).map(owner=>({workspace:"map_editor",group:owner.group,map:owner.map,label:`Map ${owner.group}:${owner.map}`}));}
    mapLink(document){return this.mapLinks(document)[0]||null;}
    codeLink(document){return document.method==="static"?{workspace:"code_workspace",offset:document.scriptOffset,view:"script",scriptKind:"event",reference:`gen2:static-encounter:${document.id}`}:null;}
    sprite(slot){
      const id=Number(slot?.species);if(this.sprites.has(id))return this.sprites.get(id);
      const picture=this.speciesData.frontSprite(id),palette=this.speciesData.palette(id),frame=picture.bytes.slice(0,picture.frameBytes),canvas=document.createElement("canvas");
      canvas.width=canvas.height=64;
      const context=canvas.getContext("2d"),image=context.createImageData(64,64),memory=new RomMemory(frame),originX=4+Math.floor((7-picture.width)/2)*8,originY=4+Math.floor((7-picture.height)/2)*8;
      for(let tile=0;tile<picture.width*picture.height;tile++){
        const pixels=GbcSpriteCodec.decodeTile(memory,tile*16),tileX=tile%picture.width,tileY=Math.floor(tile/picture.width);
        for(let pixel=0;pixel<64;pixel++){
          const rgb=Number.parseInt(palette.colors[pixels[pixel]].slice(1),16),x=originX+tileX*8+pixel%8,y=originY+tileY*8+Math.floor(pixel/8),target=(y*64+x)*4;
          image.data[target]=rgb>>16;image.data[target+1]=rgb>>8&0xff;image.data[target+2]=rgb&0xff;image.data[target+3]=pixels[pixel]===0?0:255;
        }
      }
      context.putImageData(image,0,0);
      const source=Object.freeze({canvas,offset:picture.offset,title:`${this.speciesData.catalog.get(id).name} · native Crystal miniature`});this.sprites.set(id,source);return source;
    }
    levelLabel(slot){return slot.maxLevel!==slot.level?`${slot.level}–${slot.maxLevel}`:String(slot.level);}
    probabilityLabel(slot){return slot.probability===null?"Roamer":`${slot.probability}%`;}
    rateLabel(rate){return rate.editable===false?rate.label:`Native encounter rate ${rate.native}/256 (${(rate.native/256*100).toFixed(1)}%)`;}
    editFields(document,slot,rate){
      const fields=[
        {name:"species",label:"Species ID",type:"number",value:slot.species,min:1,max:251},
        {name:"level",label:slot.maxLevel!==slot.level?"Minimum level":"Level",type:"number",value:slot.level,min:1,max:100}
      ];
      if(slot.maxLevel!==slot.level)fields.push({name:"maxLevel",label:"Maximum level",type:"number",value:slot.maxLevel,min:1,max:100});
      if(document.method==="roamer")fields.push(
        {name:"mapGroup",label:"Starting map group",type:"number",value:slot.mapGroup,min:1,max:26},
        {name:"mapNumber",label:"Starting map number",type:"number",value:slot.mapNumber,min:1,max:91}
      );
      if(rate.editable!==false)fields.push({name:"rate",label:"Native rate (0–255)",type:"number",value:rate.native,min:0,max:255});
      return fields;
    }
    edit(document,values,stack){
      const plan=this.data.editPlan(document,values);
      if(plan.writes.every(write=>write.before.every((value,index)=>value===write.after[index])))return false;
      const apply=(reverse=false)=>{
        const writes=reverse?[...plan.writes].reverse():plan.writes;
        MemoryUtils.replaceAll(this.memory,writes.map(write=>({
          offset:write.offset,expected:reverse?write.after:write.before,next:reverse?write.before:write.after
        })),{message:"Crystal encounter changed after this command"});
        this.data.invalidate();this.refreshGraph();
      };
      stack.execute({label:`Edit ${document.label} slot ${Number(values.slot)+1}`,description:`Species ${values.species} · Lv ${values.level}`,do:()=>apply(false),undo:()=>apply(true)});
      return true;
    }
    refreshGraph(){
      const base=this.trainers.resourceGraph(this.progression.resourceGraph());
      this.reader.resourceGraph=this.data.resourceGraph(base);
      ProjectEvents.resources(this.reader.resourceGraph);
      return this.reader.resourceGraph;
    }
  }
  PokemonViewer.encounters.registry.register("gen2",context=>new Gen2EncounterDriver(context));
})(globalThis);
