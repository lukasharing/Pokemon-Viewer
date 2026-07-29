(function(global){
  "use strict";
  const ns=((global.PokemonViewer||={}).encounters||={});
  const ORDER=Object.freeze(["grass","water","fishing","headbutt","rock","contest","roamer","static","other"]);
  const LABELS=Object.freeze({
    grass:"Grass",water:"Water",fishing:"Fishing",headbutt:"Headbutt",
    rock:"Rock smash",contest:"Bug-Catching Contest",roamer:"Roaming Pokémon",
    static:"Static battles",other:"Other"
  });
  const ICONS=Object.freeze({
    grass:"fa-seedling",water:"fa-water",fishing:"fa-fish",headbutt:"fa-tree",
    rock:"fa-hammer",contest:"fa-bug",roamer:"fa-route",static:"fa-location-dot"
  });

  class EncounterBrowserModel{
    constructor(documents=[]){this.replace(documents);}
    replace(documents=[]){this.documents=[...documents];this.query="";this.activeMethod=null;return this.refresh();}
    search(query=""){this.query=String(query).trim().toLowerCase();return this.refresh();}
    refresh(){
      this.filtered=this.documents.filter(document=>this.matches(document));
      this.groups=new Map();
      for(const document of this.filtered){
        const method=document.method||"other";
        if(!this.groups.has(method))this.groups.set(method,[]);
        this.groups.get(method).push(document);
      }
      if(!this.groups.has(this.activeMethod))this.activeMethod=this.methods()[0]?.method||null;
      return this;
    }
    matches(document){
      if(!this.query)return true;
      return document.label.toLowerCase().includes(this.query)
        ||document.method?.toLowerCase().includes(this.query)
        ||`${document.group}:${document.map}`===this.query;
    }
    methods(){
      return[...this.groups].map(([method,documents])=>({method,documents,label:this.label(method),icon:this.icon(method)})).sort((left,right)=>{
        const a=ORDER.indexOf(left.method),b=ORDER.indexOf(right.method);
        return(a<0?ORDER.length:a)-(b<0?ORDER.length:b)||left.method.localeCompare(right.method);
      });
    }
    selectMethod(method){if(this.groups.has(method))this.activeMethod=method;return this.selected();}
    selected(){return this.groups.get(this.activeMethod)||[];}
    label(method){return LABELS[method]||String(method||"other").replace(/(^|[-_])(\w)/g,(_match,space,letter)=>`${space?" ":""}${letter.toUpperCase()}`);}
    icon(method){return ICONS[method]||"fa-paw";}
  }
  ns.EncounterBrowserModel=EncounterBrowserModel;
})(globalThis);
