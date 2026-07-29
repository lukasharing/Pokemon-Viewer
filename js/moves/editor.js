(function(global){
  "use strict";

  class MoveEditor{
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("move_editor");this.scope=new EventScope();this.commands=reader.history("move_editor",{label:"Move Editor"});
      this.driver=PokemonViewer.moves.registry.create(driverId,{reader});
      this.elements={
        filter:Dom.byId("move_filter"),list:Dom.byId("move_list"),title:Dom.byId("move_title"),
        summary:Dom.byId("move_summary"),properties:Dom.byId("move_properties"),profile:Dom.byId("move_profile"),
        references:Dom.byId("move_references"),status:Dom.byId("move_status"),
        edit:Dom.byId("move_edit"),data:Dom.byId("move_data"),animation:Dom.byId("move_animation"),
        animationOpen:Dom.byId("move_animation_open"),animationTitle:Dom.byId("move_animation_title"),animationDetail:Dom.byId("move_animation_detail")
      };
      this.entries=this.driver.list();
      this.renderList();
      this.scope.listen(this.elements.filter,"input",()=>this.renderList());
      this.scope.listen(this.elements.list,"change",()=>this.open(Number(this.elements.list.value)));
      this.scope.listen(this.elements.edit,"click",()=>this.edit());
      this.scope.listen(this.elements.data,"click",()=>this.openData());
      this.scope.listen(this.elements.animation,"click",()=>this.openAnimation());
      this.scope.listen(this.elements.animationOpen,"click",()=>this.openAnimation());
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
      const document=this.driver.read(id);if(!document)return false;
      this.current=document;this.elements.list.value=String(id);
      this.elements.title.textContent=document.name;
      this.elements.summary.textContent=this.driver.summary(document);
      this.renderProfile(document);
      const rows=this.driver.properties(document);
      this.elements.properties.replaceChildren(...rows.flatMap(([key,value])=>{
        const attributes=this.technicalAttributes(key);
        return [Dom.create("dt",{attributes},UiWindow.key(key)),Dom.create("dd",{text:String(value),attributes})];
      }));
      const animation=this.driver.animationLink?.(document);
      this.elements.animation.disabled=!animation;
      this.elements.animationOpen.disabled=!animation;
      this.elements.animationTitle.textContent=animation?"Native animation reference":"No verified animation decoder";
      this.elements.animationDetail.textContent=animation
        ?this.driver.animationSummary?.(document,animation)||"Open the Animation Editor to inspect this move’s family-specific animation source."
        :"This family has no verified animation source available for this move yet.";
      const references=this.driver.references(document);
      this.elements.references.replaceChildren(...(references.length?references.map(reference=>Dom.create("li",{},
        reference.link?[Dom.create("button",{className:"ui-button move-reference",attributes:{type:"button"},events:{click:()=>this.openReference(reference)}},[
          UiWindow.icon("fa-arrow-up-right-from-square"),Dom.create("span",{text:reference.label})
        ])]:[Dom.create("span",{className:"move-reference-label",text:reference.label})]
      )):[Dom.create("li",{text:"No canonical learnset or machine references this move."})]));
      this.elements.edit.disabled=this.driver.editable===false;
      this.elements.status.textContent=`Verified fixed record at ${MemoryUtils.hex(document.offset,6)} · ${references.length} canonical reference${references.length===1?"":"s"}`;
      this.root.dispatchEvent(new CustomEvent("moveviewchange"));
      return true;
    }

    technicalAttributes(key){
      return /\b(id|offset|pointer|address|flags|record|resource|handler|script)\b/i.test(key)?{"data-complexity":"advanced"}:{};
    }
    renderProfile(document){
      const items=this.driver.profile?.(document)||[
        {label:"Type",value:document.typeName||document.type,icon:"fa-circle"},
        {label:"Power",value:document.power||"Status",icon:"fa-burst"},
        {label:"Accuracy",value:document.accuracyPercent??document.accuracy,icon:"fa-bullseye"},
        {label:"PP",value:document.pp,icon:"fa-battery-three-quarters"}
      ];
      this.elements.profile.replaceChildren(...items.map(item=>Dom.create("article",{className:"move-stat"},[
        UiWindow.icon(item.icon||"fa-circle"),Dom.create("span",{className:"move-stat__label",text:item.label}),Dom.create("strong",{text:String(item.value)})
      ])));
    }

    async edit(){
      if(!this.current||this.driver.editable===false)return;
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
    destroy(){this.commands.destroy();this.scope.destroy();}
  }

  global.MoveEditor=MoveEditor;
})(globalThis);
