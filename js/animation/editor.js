(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  class AnimationEditor{
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("animation_editor");this.scope=new EventScope();
      this.driver=ns.registry.create(driverId,{reader});this.renderer=new AnimationRenderer(Dom.byId("animation_canvas"));
      this.timeline=new AnimationTimeline({scrubber:Dom.byId("animation_scrubber"),list:Dom.byId("animation_commands"),onFrame:(frame,index)=>this.render(frame,index)});
      this.elements={
        domain:Dom.byId("animation_domain"),select:Dom.byId("animation_select"),play:Dom.byId("animation_play"),pause:Dom.byId("animation_pause"),
        prev:Dom.byId("animation_prev"),next:Dom.byId("animation_next"),props:Dom.byId("animation_properties"),
        status:Dom.byId("animation_status"),form:Dom.byId("animation_edit_form"),undo:Dom.byId("animation_undo"),redo:Dom.byId("animation_redo"),
        domainTabs:Dom.byId("animation_domain_tabs"),search:Dom.byId("animation_search"),count:Dom.byId("animation_count"),
        detailTabs:Dom.byId("animation_detail_tabs"),commandsPanel:Dom.byId("animation_commands_panel"),editPanel:Dom.byId("animation_edit_panel"),logic:Dom.byId("animation_logic")
      };
      this.logicGraph=new ScriptLogicGraph(this.elements.logic,{onSelect:node=>this.selectProgramNode(node)});
      this.documents=this.driver.list();
      this.commands=reader.history?.("animation_editor",{label:"Animation Editor",onChange:()=>this.updateActions()})||new CommandStack({onChange:()=>this.updateActions()});
      const domains=[...new Set(this.documents.map(document=>document.domain))];
      this.elements.domain.replaceChildren(...domains.map(domain=>Dom.create("option",{text:ns.DOMAINS[domain]?.label||domain,attributes:{value:domain}})));
      this.elements.domainTabs.replaceChildren(...domains.map(domain=>Dom.create("button",{
        text:ns.DOMAINS[domain]?.label||domain,
        attributes:{type:"button",role:"tab","aria-selected":"false","data-animation-domain":domain}
      })));
      this.scope.listen(this.elements.domain,"change",()=>this.showDomain(this.elements.domain.value));
      this.scope.listen(this.elements.domainTabs,"click",event=>{const button=event.target.closest("[data-animation-domain]");if(button)this.showDomain(button.dataset.animationDomain);});
      this.scope.listen(this.elements.search,"input",()=>this.showDomain(this.activeDomain,this.active?.id));
      this.scope.listen(this.elements.select,"change",()=>this.select(Number(this.elements.select.value)));
      this.scope.listen(this.elements.detailTabs,"click",event=>{const button=event.target.closest("[data-animation-detail]");if(button)this.showDetail(button.dataset.animationDetail);});
      this.scope.listen(this.elements.play,"click",()=>this.play());this.scope.listen(this.elements.pause,"click",()=>this.pause());
      this.scope.listen(this.elements.prev,"click",()=>this.step(-1));this.scope.listen(this.elements.next,"click",()=>this.step(1));
      this.scope.listen(this.elements.undo,"click",()=>{this.commands.undo();this.reloadActive();});
      this.scope.listen(this.elements.redo,"click",()=>{this.commands.redo();this.reloadActive();});
      this.scope.listen(this.elements.form,"submit",event=>{event.preventDefault();this.save();});
      this.showDomain(domains[0]);this.updateActions();
    }
    showDomain(domain,requestedId=null){
      this.activeDomain=domain;this.elements.domain.value=domain;
      this.elements.domainTabs.querySelectorAll("[data-animation-domain]").forEach(button=>{
        const active=button.dataset.animationDomain===domain;
        button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
      });
      const query=this.elements.search.value.trim().toLocaleLowerCase();
      const options=this.documents.map((document,index)=>({document,index})).filter(item=>item.document.domain===domain&&(!query||item.document.name.toLocaleLowerCase().includes(query)));
      this.elements.select.replaceChildren(...options.map(({document,index})=>Dom.create("option",{text:document.name,attributes:{value:index}})));
      this.elements.count.textContent=`${options.length} ${options.length===1?"animation":"animations"}`;
      const match=options.find(item=>item.document.id===requestedId)||options.find(item=>item.document.id===this.active?.id)||options[0];
      if(match){this.elements.select.value=String(match.index);this.select(match.index);}else this.select(-1);
    }
    showDetail(detail){
      const selected=detail==="edit"?"edit":"commands";
      this.elements.detailTabs.querySelectorAll("[data-animation-detail]").forEach(button=>{
        const active=button.dataset.animationDetail===selected;
        button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
      });
      for(const panel of [this.elements.commandsPanel,this.elements.editPanel]){
        const active=panel.dataset.animationPage===selected;panel.hidden=!active;panel.classList.toggle("is-active",active);
      }
    }
    select(index){
      this.pause();this.active=this.documents[index];
      if(!this.active){this.elements.props.replaceChildren();this.elements.form.replaceChildren();this.elements.status.textContent="No matching animations.";return false;}
      this.timeline.set(this.active);this.renderProgram();
      const simple=[["Type",this.active.type],["Rate",`${this.active.fps} Hz`],...this.active.properties.filter(item=>item.complexity!=="advanced").map(item=>[item.label,item.value])],advanced=[["Accuracy",this.active.accuracy],["Commands",this.active.commands.length],...this.active.properties.filter(item=>item.complexity==="advanced").map(item=>[item.label,item.value])];
      this.elements.props.replaceChildren(...this.rows(simple),...this.rows(advanced,{"data-complexity":"advanced"}));
      this.renderForm();this.root.dispatchEvent(new CustomEvent("animationviewchange"));return true;
    }
    rows(values,attributes={}){return values.flatMap(([key,value])=>[Dom.create("dt",{text:key,attributes}),Dom.create("dd",{text:String(value),attributes})]);}
    renderProgram(){
      const records=this.active.commands.map((command,index)=>({offset:command.offset??index,size:1,name:command.label||command.source?.split(/\s+/)[0]||"animation_step",args:command.args||[],summary:command.source}));
      const document=ScriptLogicGraph.document(records,{family:this.reader.family,language:`${this.active.source?.repository||this.reader.family} animation program`});
      this.logicGraph.render(document);return this;
    }
    selectProgramNode(node){this.timeline.go(Math.max(0,Math.min(this.timeline.frames.length-1,node.index)));this.elements.status.textContent=`${node.title} · ${node.summary}`;}
    renderForm(){
      const editor=this.active?.editor;
      if(editor?.kind!=="gba-pokemon"||!this.active.editable){
        this.elements.form.replaceChildren(Dom.create("p",{className:"ui-empty",text:"This native command stream is read-only."}));return;
      }
      const motion=Dom.create("select",{attributes:{name:"motion"}},editor.motionNames.map((name,index)=>Dom.create("option",{text:name,attributes:{value:index},properties:{selected:index===editor.motionId}})));
      const frameRows=this.active.commands.filter(command=>!command.end).map((command,index)=>Dom.create("div",{className:"animation-edit-row"},[
        Dom.create("strong",{text:`Step ${index+1}`}),
        Dom.create("label",{text:"Picture"},[Dom.create("select",{attributes:{name:`frame-${index}`}},[0,1].map(value=>Dom.create("option",{text:`Frame ${value}`,attributes:{value},properties:{selected:value===command.image}})))]),
        Dom.create("label",{text:"Ticks"},[Dom.create("input",{attributes:{name:`duration-${index}`,type:"number",min:1,max:63,value:command.duration}})])
      ]));
      this.elements.form.replaceChildren(Dom.create("label",{text:"Movement"},[motion]),...frameRows,Dom.create("button",{className:"ui-button ui-button--primary",text:"Apply animation",attributes:{type:"submit"}}));
    }
    save(){
      if(!this.active?.editable)return;const form=new FormData(this.elements.form),commands=this.active.commands.filter(command=>!command.end);
      const changes={motionId:Number(form.get("motion")),frames:commands.map((command,index)=>({image:Number(form.get(`frame-${index}`)),duration:Number(form.get(`duration-${index}`)),hFlip:command.hFlip,vFlip:command.vFlip}))};
      const writes=this.driver.patch(this.active,changes);if(!writes.length)return;
      this.commands.execute({label:`Edit ${this.active.name} animation`,do:()=>MemoryUtils.replaceAll(this.reader.memory,writes),undo:()=>MemoryUtils.replaceAll(this.reader.memory,[...writes].reverse().map(write=>({offset:write.offset,expected:write.next,next:write.expected})))});
      this.reloadActive();
    }
    reloadActive(){
      const id=this.active?.id,index=this.documents.findIndex(document=>document.id===id),next=this.driver.list().find(document=>document.id===id);
      if(next&&index>=0)this.documents[index]=next;if(index>=0)this.select(index);
    }
    open(request={}){
      const id=Number.isInteger(request.species)?`pokemon:${request.species}`:Number.isInteger(request.move)?`move:${request.move}`:Number.isInteger(request.animation)?`move:${request.animation}`:null;
      const document=this.documents.find(item=>item.id===id)||this.documents.find(item=>item.domain==="move")||this.documents[0];
      if(!document)return false;this.elements.search.value="";this.showDomain(document.domain,document.id);return true;
    }
    render(frame,index){if(!this.active)return;this.renderer.render(this.active,frame);this.elements.logic.querySelector(".logic-node.selected")?.classList.remove("selected");const commandIndex=frame?.command??index;this.elements.logic.querySelector(`[data-logic-index="${commandIndex}"]`)?.classList.add("selected");this.elements.status.textContent=`${this.active.name} · step ${index+1}/${this.timeline.frames.length} · ${frame?.duration||1} ticks`;}
    updateActions(){this.elements.undo.disabled=!this.commands.canUndo;this.elements.redo.disabled=!this.commands.canRedo;}
    play(){this.timeline.play();this.root.dispatchEvent(new CustomEvent("animationviewchange"));}
    pause(){this.timeline.pause();this.root.dispatchEvent(new CustomEvent("animationviewchange"));}
    step(delta){this.timeline.step(delta);}
    canPlay(){return (this.timeline.frames?.length||0)>1;}
    activate(){this.root.editorHeader?.render();if(this.active)this.render(this.timeline.frames[this.timeline.index],this.timeline.index);}
    destroy(){this.scope.destroy();this.timeline.destroy();this.commands.destroy?.();}
  }
  global.AnimationEditor=AnimationEditor;
})(globalThis);
