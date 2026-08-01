(function(global){
  "use strict";
  class Gen1EncounterDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=reader.gen1SpeciesData||=new PokemonViewer.gen1.Gen1SpeciesData(reader);
      this.progression=reader.gen1ProgressionData||=new PokemonViewer.gen1.Gen1ProgressionData(reader,{speciesData:this.speciesData});
      this.trainers=reader.gen1TrainerData||=new PokemonViewer.gen1.Gen1TrainerData(reader,{speciesData:this.speciesData});
      this.data=reader.gen1EncounterData||=new PokemonViewer.gen1.Gen1EncounterData(reader,{speciesData:this.speciesData});
      this.refreshGraph();
    }
    list(){return this.data.list();}
    read(reference){return this.data.find(reference);}
    timeLabel(){return"All day";}
    tableLabel(document){return document.method==="fishing"?document.rodLabel:document.label;}
    properties(document){
      const owners=this.data.owners(document);
      if(document.method==="fishing")return[
        ["Generation","I · Red/Blue"],["Method","Fishing"],["Rod",document.rodLabel],
        ["Scope",document.rod==="super"?`Map $${document.mapId.toString(16).toUpperCase().padStart(2,"0")}`:"Global"],
        ["Maps sharing group",owners.length||"Global"],["Record",MemoryUtils.hex(document.offset,6)]
      ];
      if(document.method==="static")return[
        ["Generation","I · Red/Blue"],["Method","Static battle"],["Context",document.context],
        ["Map",`$${document.mapId.toString(16).toUpperCase().padStart(2,"0")}`],["Record",MemoryUtils.hex(document.offset,6)]
      ];
      return[
        ["Generation","I · Red/Blue"],["Method",document.method==="grass"?"Grass / walking":"Water / surfing"],
        ["Map",`$${document.mapId.toString(16).toUpperCase().padStart(2,"0")}`],["Maps sharing record",owners.length],
        ["Pointer",MemoryUtils.hex(document.pointerOffset,6)],["Record",MemoryUtils.hex(document.recordOffset,6)]
      ];
    }
    mapLinks(document){return this.data.owners(document).map(owner=>({workspace:"map_editor",mapId:owner.mapId,label:`Map ${owner.id}`}));}
    mapLink(document){return this.mapLinks(document)[0]||null;}
    codeLink(document){return document.method==="static"&&Number.isInteger(document.scriptOffset)?{workspace:"code_workspace",offset:document.scriptOffset,view:"original",reference:`gen1:static-encounter:${document.id}`}:null;}
    battleLink(document,slot){return{workspace:"battle_editor",encounter:{species:slot.species,level:slot.level,label:`${document.label} encounter`,mapReference:this.mapLink(document),background:"gen1-native"}};}
    sprite(slot){
      const species=this.speciesData.catalog.get(Number(slot?.species));if(!species?.dexNumber)return null;
      const picture=this.speciesData.frontSprite(species),source=new RomMemory(picture.bytes),canvas=document.createElement("canvas");canvas.width=canvas.height=56;
      const context=canvas.getContext("2d"),image=context.createImageData(56,56),colors=[[255,255,255,0],[170,170,170,255],[85,85,85,255],[0,0,0,255]],originX=Math.ceil((7-picture.width)/2)*8,originY=(7-picture.height)*8;
      for(let tile=0;tile<picture.width*picture.height;tile++){
        const pixels=GbcSpriteCodec.decodeTile(source,tile*16),tileX=tile%picture.width,tileY=Math.floor(tile/picture.width);
        for(let pixel=0;pixel<64;pixel++){const color=colors[pixels[pixel]],x=originX+tileX*8+pixel%8,y=originY+tileY*8+Math.floor(pixel/8),at=(y*56+x)*4;image.data.set(color,at);}
      }
      context.putImageData(image,0,0);return Object.freeze({canvas,offset:picture.offset,bytes:picture.bytes,title:`${species.name} · native Gen I front sprite`});
    }
    levelLabel(slot){return String(slot.level);}
    probabilityLabel(slot){return Number.isInteger(slot.probabilityWeight)?`${slot.probabilityWeight}/256 (${slot.probability.toFixed(1)}%)`:`${slot.probability.toFixed(1)}%`;}
    rateLabel(rate){return Number.isInteger(rate?.native)?`Native encounter rate ${rate.native}/256 (${(rate.native/256*100).toFixed(1)}%)`:rate?.label||"Engine-defined encounter rate";}
    editMessage(document){
      const owners=this.data.owners(document);
      if(document.method==="static")return"This changes the exact Species and level operands used by one static battle. Event flags, map object position, battle flow and disappearance logic remain unchanged.";
      if(document.method==="fishing")return document.rod==="super"&&owners.length>1
        ?`This Super Rod group is shared by ${owners.length} maps. Species and level change in every owner; bite chance and group width remain engine-defined.`
        :"This changes one existing fishing Species/level pair. Bite chance, selection probability and native group width remain engine-defined.";
      return owners.length>1
        ?`This native wild-data record is shared by ${owners.length} maps. Applying the edit changes the same ${document.method} table in every owner map. Slot weights remain engine-defined.`
        :"This changes one existing Gen I wild slot and its native encounter rate. The ten engine-defined slot weights remain unchanged.";
    }
    editFields(_document,slot,rate){const fields=[
      {name:"species",label:"Internal species ID",type:"number",value:slot.species,min:1,max:190},
      {name:"level",label:"Level",type:"number",value:slot.level,min:1,max:100}
    ];if(rate?.editable!==false&&Number.isInteger(rate?.native))fields.push({name:"rate",label:"Native rate (1–255)",type:"number",value:rate.native,min:1,max:255});return fields;}
    edit(document,values,stack){
      const plan=this.data.editPlan(document,values);
      if(plan.writes.every(write=>write.before.every((value,index)=>value===write.after[index])))return false;
      const apply=reverse=>{
        const writes=reverse?[...plan.writes].reverse():plan.writes;
        MemoryUtils.replaceAll(this.memory,writes.map(write=>({offset:write.offset,expected:reverse?write.after:write.before,next:reverse?write.before:write.after})),{message:"Gen I encounter changed after this command"});
        this.data.invalidate();this.refreshGraph();
      };
      stack.execute({label:`Edit ${document.label} slot ${Number(values.slot)+1}`,description:`Internal species ${values.species} · Lv ${values.level}`,do:()=>apply(false),undo:()=>apply(true)});
      return true;
    }
    refreshGraph(){
      const base=this.trainers.resourceGraph(this.progression.resourceGraph(this.speciesData.resourceGraph()));
      this.reader.resourceGraph=this.data.resourceGraph(base);
      ProjectEvents.resources(this.reader.resourceGraph);
      return this.reader.resourceGraph;
    }
  }
  PokemonViewer.encounters.registry.register("gbc",context=>new Gen1EncounterDriver(context));
})(globalThis);
