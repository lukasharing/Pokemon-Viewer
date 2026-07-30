(function(global){
  "use strict";
  class EncounterEditor{
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("encounter_editor");this.scope=new EventScope();this.writeAccess=EditorCapabilityGuard.inspect(reader,"encounter_editor");
      this.commands=EditorCapabilityGuard.protectCommands(reader,"encounter_editor",reader.history("encounter_editor",{label:"Encounter Editor"}),{operation:"Editing encounters"});
      this.driver=PokemonViewer.encounters.registry.create(driverId,{reader});
      this.elements={
        filter:Dom.byId("encounter_filter"),table:Dom.byId("encounter_table"),time:Dom.byId("encounter_time"),
        title:Dom.byId("encounter_title"),properties:Dom.byId("encounter_properties"),slots:Dom.byId("encounter_slots"),
        status:Dom.byId("encounter_status"),map:Dom.byId("encounter_map"),code:Dom.byId("encounter_code"),data:Dom.byId("encounter_data")
      };
      this.browser=new PokemonViewer.encounters.EncounterBrowserModel(this.driver.list());
      this.slotView=new PokemonViewer.encounters.EncounterSlotView({element:this.elements.slots,driver:this.driver,onEdit:this.writeAccess.writable?(slot,rate)=>this.editSlot(slot,rate):null});
      this.scope.listen(this.elements.filter,"input",()=>this.filter());
      this.scope.listen(this.elements.time,"change",()=>this.renderSlots());
      this.scope.listen(this.elements.map,"click",()=>this.openMap());
      this.scope.listen(this.elements.code,"click",()=>this.openCode());
      this.scope.listen(this.elements.data,"click",()=>this.openData());
      this.renderList();if(this.browser.documents.length)this.open(this.browser.documents[0].id);
    }
    filter(){
      this.browser.search(this.elements.filter.value);
      this.renderList();if(this.browser.filtered.length)this.open(this.browser.filtered[0].id);
    }
    renderList(){
      if(this.current?.method&&this.browser.groups.has(this.current.method)&&!this.browser.groups.has(this.browser.activeMethod))this.browser.selectMethod(this.current.method);
      const methods=this.browser.methods(),selected=this.browser.selected();
      const tabs=Dom.create("div",{className:"encounter-method-tabs",attributes:{role:"tablist","aria-label":"Encounter methods"}},methods.map(({method,documents,label,icon})=>Dom.create("button",{
        className:`encounter-method-tab${method===this.browser.activeMethod?" is-active":""}`,
        attributes:{type:"button",role:"tab","aria-selected":String(method===this.browser.activeMethod)},
        events:{click:()=>{this.browser.selectMethod(method);this.renderList();if(documents.length)this.open(documents[0].id);}}
      },[UiWindow.icon(icon),Dom.create("span",{text:label}),Dom.create("small",{text:String(documents.length)})])));
      const rows=Dom.create("div",{className:"encounter-method-rows",attributes:{role:"listbox","aria-label":`${this.browser.label(this.browser.activeMethod)} encounter tables`}},selected.map(document=>Dom.create("button",{
        className:`encounter-method-row${document.id===this.current?.id?" is-active":""}`,
        text:document.label,
        attributes:{type:"button",role:"option","data-encounter-id":document.id,title:document.label,"aria-selected":String(document.id===this.current?.id)},
        events:{click:()=>this.open(document.id)}
      })));
      this.elements.table.replaceChildren(tabs,rows);
      if(!methods.length)this.elements.table.append(Dom.create("p",{className:"encounter-method-browser__empty",text:"No encounter tables match this search."}));
    }
    open(reference){
      const document=this.driver.read(reference);if(!document)return false;
      const methodChanged=this.browser.activeMethod!==(document.method||"other");
      this.current=document;this.browser.selectMethod(document.method||"other");
      if(methodChanged)this.renderList();
      this.elements.title.textContent=document.label;
      for(const row of this.elements.table.querySelectorAll(".encounter-method-row")){
        const active=row.dataset.encounterId===document.id;
        row.classList.toggle("is-active",active);
        row.setAttribute("aria-selected",String(active));
        if(active)row.scrollIntoView({block:"nearest",inline:"nearest"});
      }
      this.elements.time.replaceChildren(...document.rates.map(rate=>Dom.create("option",{text:this.driver.timeLabel(rate.time),attributes:{value:rate.time}})));
      const properties=Object.fromEntries(this.driver.properties(document));
      const propertyTable=UiWindow.properties(properties);
      propertyTable.id="encounter_properties";
      this.elements.properties.replaceWith(propertyTable);
      this.elements.properties=propertyTable;
      this.elements.map.hidden=!this.driver.mapLink?.(document);
      this.elements.code.hidden=!this.driver.codeLink?.(document);
      this.elements.data.hidden=!Number.isInteger(document.offset);
      this.renderSlots();return true;
    }
    renderSlots(){
      if(!this.current)return;
      const time=this.elements.time.value,rate=this.current.rates.find(item=>item.time===time)||this.current.rates[0];
      this.slotView.render(this.current,rate,time);
      this.elements.status.textContent=this.driver.rateLabel?.(rate)||`Encounter rate ${rate.native}/256 (${(rate.native/256*100).toFixed(1)}%)`;
      this.elements.time.closest("label")?.classList.toggle("is-single",this.current.rates.length<2);
    }
    async editSlot(slot,rate){
      EditorCapabilityGuard.requireWritable(this.reader,"encounter_editor","Editing an encounter slot");
      const sharedRate=this.current.method==="fishing";
      const sharedSlot=this.current.method==="fishing"&&slot.sharedAcrossTime;
      const values=await AppDialog.form({
        title:`Edit ${slot.speciesName} encounter`,
        message:this.driver.editMessage?.(this.current,slot,rate)||sharedRate
          ?`This changes an exact Crystal fishing slot. The bite rate is shared by every rod and map using fish group ${this.current.fishGroup}.${sharedSlot?" This species and level are also shared by day and night.":""}`
          :this.current.method==="roamer"
            ?"This patches the verified Crystal initialization routine. Level is shared by both configured roamers. Current location, HP and DVs belong to save/WRAM state and are not overwritten here."
          :this.current.method==="static"
            ?"This changes the exact species and level operands of one verified loadwildmon command. Battle type, flags, disappearance and surrounding script flow remain unchanged."
          :rate.editable===false
            ?"This changes one exact fixed slot. Encounter chance and weighted probabilities are defined by the engine and remain unchanged."
            :"This changes one existing fixed Crystal slot and the selected period's native encounter rate. Slot probabilities remain engine-defined.",
        fields:this.driver.editFields?.(this.current,slot,rate)||[
          {name:"species",label:"Species ID",type:"number",value:slot.species,min:1,max:251},
          {name:"level",label:"Level",type:"number",value:slot.level,min:1,max:100}
        ],submitLabel:"Apply encounter"
      });
      if(values&&this.driver.edit(this.current,{time:slot.time,slot:slot.slot,...values},this.commands)!==false)this.reload();
    }
    reload(){const id=this.current.id,time=this.elements.time.value,query=this.elements.filter.value;this.browser.replace(this.driver.list()).search(query);this.renderList();this.open(id);if([...this.elements.time.options].some(option=>option.value===time)){this.elements.time.value=time;this.renderSlots();}}
    openCode(){EditorLinks.optional(this.current&&this.driver.codeLink?.(this.current));}
    async openMap(){
      if(!this.current)return;
      const links=this.driver.mapLinks?.(this.current)||[this.driver.mapLink?.(this.current)].filter(Boolean);
      if(!links.length)return;
      let detail=links[0];
      if(links.length>1){
        const values=await AppDialog.form({
          title:"Open an owner map",
          message:`This encounter definition is shared by ${links.length} maps. Choose the owner map to open.`,
          fields:[{name:"map",label:"Map",value:"0",options:links.map((link,index)=>({value:String(index),label:link.label}))}],
          submitLabel:"Open map"
        });
        if(!values)return;
        detail=links[Number(values.map)];
      }
      EditorLinks.optional(detail);
    }
    openData(){if(this.current)EditorLinks.hex(this.current.offset,{reference:`encounter-table:${this.current.id}`});}
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Encounter history"});if(changed)this.reload();return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Encounter history"});if(changed)this.reload();return changed;}
    destroy(){this.commands.destroy();this.scope.destroy();}
  }
  global.EncounterEditor=EncounterEditor;
})(globalThis);
