(function(global){
  "use strict";

  class EncounterMapPanel{
    static matches(link,reference){
      if(!link||!reference)return false;
      if(Number.isInteger(link.mapId)&&Number.isInteger(reference.mapId))return link.mapId===reference.mapId;
      if(Number.isInteger(link.bank)&&Number.isInteger(reference.bank))return link.bank===reference.bank&&link.map===reference.map;
      return Number.isInteger(link.group)&&Number.isInteger(link.map)&&link.group===reference.group&&link.map===reference.map;
    }

    constructor(reader,driverId,{root,commands}={}){
      this.reader=reader;this.root=root;this.commands=commands;
      this.writeAccess=EditorCapabilityGuard.inspect(reader,"encounter_editor");
      this.driver=PokemonViewer.encounters.registry.create(driverId,{reader});
      this.scope=new EventScope();this.documents=[];this.current=null;this.build();
    }

    build(){
      this.title=Dom.create("strong",{},[UiWindow.icon("fa-paw"),Dom.create("span",{text:"Encounters"})]);
      this.count=Dom.create("span",{className:"map-sidebar-panel__badge"});
      this.toggle=Dom.create("button",{className:"map-sidebar-panel__toggle",attributes:{type:"button","aria-label":"Collapse encounters","aria-expanded":"true"}},[UiWindow.icon("fa-chevron-up")]);
      this.context=Dom.create("p",{className:"map-encounters__context"});
      this.groups=Dom.create("div",{className:"map-encounters__groups"});
      this.subtables=new Map();
      this.body=Dom.create("div",{className:"map-sidebar-panel__body"},[
        this.context,this.groups
      ]);
      this.root.classList.add("map-sidebar-panel","ui-panel");this.root.dataset.panel="encounters";this.root.dataset.mapContext="map";
      this.root.replaceChildren(Dom.create("header",{className:"map-sidebar-panel__header"},[
        this.title,Dom.create("div",{className:"map-sidebar-panel__meta"},[this.count,this.toggle])
      ]),this.body);
      this.scope.listen(this.toggle,"click",()=>this.setCollapsed(!this.root.classList.contains("is-collapsed")));
    }

    setCollapsed(collapsed){
      this.root.classList.toggle("is-collapsed",collapsed);this.toggle.setAttribute("aria-expanded",String(!collapsed));
      this.toggle.setAttribute("aria-label",collapsed?"Expand encounters":"Collapse encounters");
      this.toggle.replaceChildren(UiWindow.icon(collapsed?"fa-chevron-down":"fa-chevron-up"));return this;
    }
    isGlobal(document){
      if(document.method!=="fishing")return false;
      const links=this.driver.mapLinks?.(document)||[this.driver.mapLink?.(document)].filter(Boolean);
      return links.length===0&&!Number.isInteger(document.mapId)&&!Number.isInteger(document.group)&&!Number.isInteger(document.map);
    }
    optionLabel(document){
      if(document.method==="fishing"){
        const label=this.driver.tableLabel?.(document)||document.rodLabel||document.methodLabel||document.label||"Fishing";
        return`${label}${this.isGlobal(document)&&!String(label).includes("Global")?" · Global":""}`;
      }
      if(document.method==="grass")return"Grass / walking";if(document.method==="water")return"Water / surfing";return document.label;
    }

    setMap(reference,periods=new Map()){
      this.reference=reference;const all=this.driver.list();
      this.documents=all.filter(document=>{
        const links=this.driver.mapLinks?.(document)||[this.driver.mapLink?.(document)].filter(Boolean);
        return links.some(link=>EncounterMapPanel.matches(link,reference))||(links.length===0&&this.isGlobal(document));
      }).sort((a,b)=>Number(this.isGlobal(a))-Number(this.isGlobal(b))||a.label.localeCompare(b.label));
      this.root.classList.toggle("hide",!this.documents.length);this.count.textContent=String(this.documents.length);this.count.title=`${this.documents.length} encounter sources`;
      this.root.dispatchEvent(new CustomEvent("encounterpanelchange",{bubbles:true,detail:{count:this.documents.length}}));
      this.context.textContent=this.documents.some(document=>this.isGlobal(document))
        ?"This map also uses global fishing tables."
        :"Encounter data owned by this map.";
      this.renderGroups(periods);
      return this;
    }

    methodLabel(method){
      return{grass:"Grass",water:"Water",fishing:"Fishing",headbutt:"Headbutt",rock:"Rock smash",contest:"Contest",static:"Static"}[method]||method;
    }

    columns(document,state){
      return[
        {id:"chance",label:"Chance",sortValue:slot=>Number(slot.probabilityWeight??slot.probability??0),render:slot=>Dom.create("span",{text:this.driver.probabilityLabel?.(slot)||`${slot.probability}%`})},
        {id:"species",label:"Pokémon",sortValue:slot=>slot.speciesName,render:slot=>this.speciesCell(slot)},
        {id:"level",label:"Level",sortValue:slot=>Number(slot.level),render:slot=>Dom.create("span",{text:this.driver.levelLabel?.(slot)||String(slot.level)})},
        {id:"actions",label:"Actions",sortable:false,align:"right",render:slot=>this.actionsCell(document,state,slot)}
      ];
    }

    renderGroups(periods=new Map()){
      this.subtables.clear();
      const grouped=new Map();
      for(const document of this.documents){
        if(!grouped.has(document.method))grouped.set(document.method,[]);
        grouped.get(document.method).push(document);
      }
      this.groups.replaceChildren(...[...grouped].map(([method,documents])=>Dom.create("section",{className:"map-encounter-method",attributes:{"data-method":method}},[
        Dom.create("header",{className:"map-encounter-method__header"},[
          Dom.create("strong",{text:this.methodLabel(method)}),
          Dom.create("span",{text:String(documents.length),attributes:{"aria-label":`${documents.length} ${this.methodLabel(method)} tables`}})
        ]),
        ...documents.map(document=>this.createSubtable(document,periods.get(document.id)))
      ])));
    }

    createSubtable(document,preferredTime){
      if(!Array.isArray(document.rates)||!document.rates.length){
        return Dom.create("section",{className:"map-encounter-subtable"},[Dom.create("p",{className:"map-encounters__error",text:`${this.optionLabel(document)} has no native encounter-rate record.`})]);
      }
      const time=Dom.create("select",{attributes:{"aria-label":`${this.optionLabel(document)} period`}});
      time.replaceChildren(...document.rates.map(rate=>Dom.create("option",{text:this.driver.timeLabel(rate.time),attributes:{value:rate.time}})));
      if(preferredTime&&[...time.options].some(option=>option.value===preferredTime))time.value=preferredTime;
      const state={document,time,table:null,status:Dom.create("p",{className:"map-encounters__status"}),activeRate:null};
      state.table=new UiTable({label:`${this.optionLabel(document)} encounters`,sortable:true,initialSort:{id:"chance",direction:"desc"},columns:this.columns(document,state)});
      const period=Dom.create("label",{className:"map-encounters__period"},[Dom.create("span",{text:"Period"}),time]);
      period.hidden=document.rates.length<2;
      const element=Dom.create("section",{className:"map-encounter-subtable",attributes:{"data-encounter-id":document.id}},[
        Dom.create("header",{className:"map-encounter-subtable__header"},[
          Dom.create("strong",{text:this.optionLabel(document)}),period
        ]),
        Dom.create("div",{className:"map-encounters__table"},[state.table.element]),state.status
      ]);
      this.subtables.set(document.id,state);
      time.addEventListener("change",()=>this.renderSubtable(state));
      this.renderSubtable(state);
      return element;
    }

    renderSubtable(state){
      const {document,time,table,status}=state;
      const period=time.value||document.rates[0]?.time,rate=document.rates.find(item=>item.time===period)||document.rates[0],slots=document.slots.filter(slot=>slot.time===period);
      state.activeRate=rate;table.setRows(slots);
      const links=this.driver.mapLinks?.(document)||[],ownership=links.length>1?`Shared by ${links.length} maps`:this.isGlobal(document)?"Global source":"Map-owned source";
      const rateText=this.driver.rateLabel?.(rate)||rate?.label||"Engine-defined encounter rate";
      status.replaceChildren(Dom.create("strong",{text:rateText}),Dom.create("span",{text:`${slots.length} ${slots.length===1?"slot":"slots"} · ${ownership}`}));
    }

    open(reference){
      const state=this.subtables.get(reference);if(!state)return false;
      state.table.element.scrollIntoView({block:"nearest",inline:"nearest"});return true;
    }
    speciesCell(slot){
      const source=this.driver.icon?.(slot)||this.driver.sprite?.(slot),canvas=source?.canvas?PixelCanvas.copy(source.canvas,{className:"map-encounters__sprite",label:`${slot.speciesName} miniature`}):null;
      return Dom.create("button",{className:"map-encounters__species",attributes:{type:"button",title:`Open ${slot.speciesName} in Pokédex`},events:{click:()=>this.openSpecies(slot.species)}},[canvas,Dom.create("span",{text:slot.speciesName})].filter(Boolean));
    }
    actionsCell(encounter,state,slot){
      const battle=this.driver.battleLink?.(encounter,slot);
      return Dom.create("div",{className:"map-encounters__actions"},[
        battle?UiWindow.iconButton(`Preview battle with ${slot.speciesName}`,{icon:"fa-shield-halved",size:"sm",onClick:()=>EditorLinks.open(battle)}):null,
        this.writeAccess.writable?UiWindow.iconButton(`Edit ${slot.speciesName}`,{icon:"fa-pen",size:"sm",onClick:()=>this.editSlot(encounter,slot,state.activeRate)}):null
      ].filter(Boolean));
    }

    async editSlot(document,slot,rate){
      EditorCapabilityGuard.requireWritable(this.reader,"encounter_editor","Editing an encounter slot");
      const values=await AppDialog.form({title:`Edit ${slot.speciesName} encounter`,icon:"✎",message:this.driver.editMessage?.(document,slot,rate)||"Edit the selected encounter slot.",fields:this.driver.editFields?.(document,slot,rate)||[],submitLabel:"Apply encounter"});
      if(!values||this.driver.edit(document,{time:slot.time,slot:slot.slot,...values},this.commands)===false)return false;
      const periods=new Map([...this.subtables].map(([id,state])=>[id,state.time.value]));
      this.driver.data?.invalidate?.();this.setMap(this.reference,periods);this.open(document.id);return true;
    }
    openSpecies(species){EditorLinks.species(species);}
    destroy(){this.scope.destroy();this.root.replaceChildren();this.root.classList.add("hide");}
  }

  global.EncounterMapPanel=EncounterMapPanel;((global.PokemonViewer||={}).encounters||={}).MapPanel=EncounterMapPanel;
})(globalThis);
