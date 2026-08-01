(function(global){
  "use strict";
  class GbaEncounterDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;
      this.speciesData=reader.gbaSpeciesData||=new PokemonViewer.gba.GbaSpeciesData(reader);
      this.data=reader.gbaEncounterData||=new PokemonViewer.gba.GbaEncounterData(reader,{speciesData:this.speciesData});
    }
    list(){return this.data.list();}
    read(reference){return this.data.find(reference);}
    timeLabel(){return"All day";}
    tableLabel(document){return document.methodLabel;}
    properties(document){return[
      ["Method",document.methodLabel],["Map",`${document.group}:${document.map}`],
      ["Rate",document.rates[0].native],["Record",MemoryUtils.hex(document.offset,6)]
    ];}
    mapLink(document){return{workspace:"map_editor",bank:document.group,map:document.map,label:`Map ${document.group}:${document.map}`};}
    mapLinks(document){return[this.mapLink(document)];}
    battleLink(document,slot){return{workspace:"battle_editor",encounter:{species:slot.species,level:slot.level,label:`${document.label} encounter`,mapReference:this.mapLink(document)}};}
    icon(slot){return this.speciesData.iconSource(slot.species);}
    levelLabel(slot){return slot.level===slot.maxLevel?String(slot.level):`${slot.level}–${slot.maxLevel}`;}
    probabilityLabel(slot){return`${slot.probability}%`;}
    rateLabel(rate){return`Encounter rate ${rate.native}`;}
    editFields(_document,slot,rate){return[
      {name:"species",label:"Species ID",type:"number",value:slot.species,min:1,max:this.speciesData.profile.speciesCount},
      {name:"level",label:"Minimum level",type:"number",value:slot.level,min:1,max:100},
      {name:"maxLevel",label:"Maximum level",type:"number",value:slot.maxLevel,min:1,max:100},
      {name:"rate",label:"Encounter rate",type:"number",value:rate.native,min:1,max:255}
    ];}
    editMessage(){return`Edits the existing ${this.data.contract.label} wild Pokémon record. Native slot weights and table size remain unchanged.`;}
    edit(document,values,stack){
      const plan=this.data.editPlan(document,values);
      if(plan.writes.every(write=>write.before.every((value,index)=>value===write.after[index])))return false;
      const apply=reverse=>MemoryUtils.replaceAll(this.memory,(reverse?[...plan.writes].reverse():plan.writes).map(write=>({
        offset:write.offset,expected:reverse?write.after:write.before,next:reverse?write.before:write.after
      })),{message:`${this.data.contract.label} encounter changed after this command`});
      stack.execute({label:`Edit ${document.label} slot ${Number(values.slot)+1}`,description:`Species ${values.species}`,do:()=>{apply(false);this.data.invalidate();},undo:()=>{apply(true);this.data.invalidate();}});
      return true;
    }
  }
  PokemonViewer.encounters.registry.register("gba",context=>new GbaEncounterDriver(context));
})(globalThis);
