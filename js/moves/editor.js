(function(global){
  "use strict";

  class MoveEditor{
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("move_editor");this.scope=new EventScope();
      this.pipeline=new EditorRenderPipeline({name:"moves",onError:error=>NotificationHandler.error("Move related data",error)});
      this.commands=EditorCapabilityGuard.protectCommands(reader,"move_editor",reader.history("move_editor",{label:"Move Editor"}),{operation:"Editing moves"});
      this.driver=PokemonViewer.moves.registry.create(driverId,{reader});
      this.elements={
        filter:Dom.byId("move_filter"),list:Dom.byId("move_list"),title:Dom.byId("move_title"),
        summary:Dom.byId("move_summary"),properties:Dom.byId("move_properties"),profile:Dom.byId("move_profile"),
        references:Dom.byId("move_references"),status:Dom.byId("move_status"),
        edit:Dom.byId("move_edit"),data:Dom.byId("move_data"),
        animationOpen:Dom.byId("move_animation_open"),animationTitle:Dom.byId("move_animation_title"),animationDetail:Dom.byId("move_animation_detail"),
        animationPlay:Dom.byId("move_animation_play"),animationPause:Dom.byId("move_animation_pause"),
        animationPrevious:Dom.byId("move_animation_previous"),animationNext:Dom.byId("move_animation_next"),animationReset:Dom.byId("move_animation_reset")
      };
      this.writeAccess=EditorCapabilityGuard.configureControl(this.elements.edit,reader,"move_editor",{operation:"Editing moves"});
      this.animationPreview=new MoveAnimationPreview({
        reader,driverId,canvas:Dom.byId("move_animation_canvas"),scrubber:Dom.byId("move_animation_scrubber"),
        list:Dom.byId("move_animation_commands"),current:Dom.byId("move_animation_current"),accuracy:Dom.byId("move_animation_accuracy"),
        onState:state=>this.updateAnimationControls(state)
      });
      this.referenceTable=new UiTable({
        label:"Move references",sortable:true,initialSort:{id:"label",direction:"asc"},
        columns:[
          {id:"kindLabel",label:"Source",render:reference=>this.renderReferenceSource(reference)},
          {id:"label",label:"Reference",render:reference=>Dom.create("strong",{className:"move-reference__label",text:reference.label})},
          {id:"action",label:"Open",align:"right",sortable:false,render:reference=>reference.link
            ?Dom.create("button",{className:"ui-icon-button",attributes:{type:"button",title:`Open ${reference.label}`},events:{click:()=>this.openReference(reference)}},[UiWindow.icon("fa-arrow-up-right-from-square")])
            :Dom.create("span",{className:"move-reference__none",text:"—"})}
        ]
      });
      const panels=this.root.querySelector(".move-secondary");
      this.panelTabs=UiPanelTabs.mount(panels,{label:"Move information",selected:"details",items:[
        {id:"details",label:"Move details",icon:"fa-sliders",panel:panels.querySelector(".move-properties-panel")},
        {id:"references",label:"Used by",icon:"fa-link",panel:panels.querySelector(".move-reference-panel")}
      ]});
      this.entries=this.driver.list();
      this.renderList();
      this.scope.listen(this.elements.filter,"input",()=>this.renderList());
      this.scope.listen(this.elements.list,"change",()=>this.open(Number(this.elements.list.value)));
      this.scope.listen(this.elements.edit,"click",()=>this.edit());
      this.scope.listen(this.elements.data,"click",()=>this.openData());
      this.scope.listen(this.elements.animationOpen,"click",()=>this.openAnimation());
      this.scope.listen(this.elements.animationPlay,"click",()=>this.animationPreview.play());
      this.scope.listen(this.elements.animationPause,"click",()=>this.animationPreview.pause());
      this.scope.listen(this.elements.animationReset,"click",()=>this.animationPreview.restart());
      this.scope.listen(this.elements.animationPrevious,"click",()=>this.animationPreview.step(-1));
      this.scope.listen(this.elements.animationNext,"click",()=>this.animationPreview.step(1));
      if(this.entries.length)this.open(this.entries[0].id);
    }

    renderList(){
      const query=this.elements.filter.value.trim().toLowerCase(),selected=this.current?.id;
      const entries=this.entries.filter(entry=>!query||entry.name.toLowerCase().includes(query)||String(entry.id)===query);
      this.elements.list.replaceChildren(...entries.map(entry=>Dom.create("option",{
        text:`${String(entry.id).padStart(3,"0")} · ${entry.name}`,attributes:{value:entry.id}
      })));
      if(selected&&entries.some(entry=>entry.id===selected))this.elements.list.value=String(selected);
    }

    open(id){
      const ticket=this.pipeline.begin(`move:${id}`);this.animationPreview.pause();
      const document=this.driver.read(id);if(!document)return false;
      this.current=document;this.elements.list.value=String(id);
      this.elements.title.textContent=document.name;
      this.elements.summary.textContent=this.driver.summary(document);
      const profile=this.profileItems(document);this.renderProfile(document,profile);
      const profileLabels=new Set(profile.map(item=>String(item.label).toLowerCase()));
      const rows=this.driver.properties(document);
      this.elements.properties.replaceChildren(...rows.flatMap(([key,value])=>{
        const attributes=profileLabels.has(String(key).toLowerCase())?{"data-complexity":"advanced"}:this.technicalAttributes(key);
        return [Dom.create("dt",{attributes},UiWindow.key(key)),Dom.create("dd",{text:String(value),attributes})];
      }));
      const animation=this.driver.animationLink?.(document);
      this.elements.animationOpen.disabled=!animation;
      this.elements.animationTitle.textContent=animation?"Animation":"Animation unavailable";
      this.elements.animationDetail.textContent=animation
        ?"Native battle preview"
        :"No verified native animation source exists for this move.";
      this.updateAnimationControls({canPlay:false,playing:false,ready:false});
      this.elements.references.replaceChildren(UiLoading.create("Finding uses in this ROM"));
      this.elements.edit.disabled=this.driver.editable===false||!this.writeAccess.writable;
      this.elements.status.textContent=`Verified fixed record at ${MemoryUtils.hex(document.offset,6)}`;
      this.root.dispatchEvent(new CustomEvent("moveviewchange"));
      if(animation)this.pipeline.run(ticket,()=>{
        this.animationPreview.set(document);
      },{schedule:"paint",phase:"animation"});
      this.pipeline.run(ticket,async signal=>{
        const references=await (this.driver.referencesAsync?.(document,{signal})??this.driver.references(document));
        this.renderReferences(references);
        this.elements.status.textContent=`Verified fixed record at ${MemoryUtils.hex(document.offset,6)} · ${references.length} canonical reference${references.length===1?"":"s"}`;
      },{schedule:"idle",phase:"references"});
      return true;
    }

    updateAnimationControls({canPlay=false,playing=false,ready=true}={}){
      this.elements.animationPlay.disabled=!ready||!canPlay||playing;
      this.elements.animationPause.disabled=!ready||!playing;
      this.elements.animationPrevious.disabled=!ready;
      this.elements.animationNext.disabled=!ready;
      this.elements.animationReset.disabled=!ready;
    }

    renderReferenceSource(reference){
      const content=[];
      if(reference.previewCanvas){
        const preview=PixelCanvas.copy(reference.previewCanvas);
        preview.className="move-reference__preview";
        content.push(preview);
      }else content.push(UiWindow.icon(reference.icon||"fa-link"));
      content.push(Dom.create("span",{text:reference.kindLabel||"Reference"}));
      return Dom.create("span",{className:"move-reference__source"},content);
    }
    renderReferences(references){
      this.referenceTable.setRows(references);
      this.elements.references.replaceChildren(
        references.length
          ?this.referenceTable.element
          :Dom.create("p",{className:"move-empty",text:"No verified trainer, species or machine uses this move."})
      );
    }
    technicalAttributes(key){
      return /\b(id|offset|pointer|address|flags|record|resource|handler|script)\b/i.test(key)?{"data-complexity":"advanced"}:{};
    }
    profileItems(document){return this.driver.profile?.(document)||[
        {label:"Type",value:document.typeName||document.type,icon:"fa-circle"},
        {label:"Power",value:document.power||"Status",icon:"fa-burst"},
        {label:"Accuracy",value:document.accuracyPercent??document.accuracy,icon:"fa-bullseye"},
        {label:"PP",value:document.pp,icon:"fa-battery-three-quarters"}
      ];}
    renderProfile(document,items=this.profileItems(document)){
      this.elements.profile.replaceChildren(...items.map(item=>Dom.create("article",{className:"move-stat"},[
        UiWindow.icon(item.icon||"fa-circle"),Dom.create("span",{className:"move-stat__label",text:item.label}),Dom.create("strong",{text:String(item.value)})
      ])));
    }

    async edit(){
      if(!this.current||this.driver.editable===false)return;
      EditorCapabilityGuard.requireWritable(this.reader,"move_editor","Editing moves");
      const values=await AppDialog.form({
        title:`Edit ${this.current.name}`,
        message:this.driver.editMessage?.(this.current)||"These fields occupy the existing fixed move record. This operation never resizes or repoints data.",
        fields:this.driver.editFields(this.current),submitLabel:"Apply move"
      });
      if(values&&this.driver.edit(this.current,values,this.commands)!==false)this.open(this.current.id);
    }

    openData(){
      if(!this.current)return;
      EditorLinks.hex(this.current.offset,{reference:this.current.resourceId});
    }
    openAnimation(){
      const detail=this.current&&this.driver.animationLink?.(this.current);
      EditorLinks.optional(detail);
    }
    openReference(reference){
      EditorLinks.open(reference.link);
    }
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Move history"});if(changed&&this.current)this.open(this.current.id);return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Move history"});if(changed&&this.current)this.open(this.current.id);return changed;}
    destroy(){this.panelTabs.destroy();this.pipeline.destroy();this.animationPreview.destroy();this.commands.destroy();this.scope.destroy();}
  }

  global.MoveEditor=MoveEditor;
})(globalThis);
