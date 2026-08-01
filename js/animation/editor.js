(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  class AnimationEditor{
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("animation_editor");this.scope=new EventScope();
      if(!this.root)throw new Error("Animation Editor markup is missing #animation_editor.");
      const element=id=>this.root.querySelector(`#${id}`);
      this.elements={
        canvas:element("animation_canvas"),scrubber:element("animation_scrubber"),commands:element("animation_commands"),
        domain:element("animation_domain"),select:element("animation_select"),play:element("animation_play"),pause:element("animation_pause"),
        prev:element("animation_prev"),next:element("animation_next"),props:element("animation_properties"),
        status:element("animation_status"),form:element("animation_edit_form"),undo:element("animation_undo"),redo:element("animation_redo"),
        domainTabs:element("animation_domain_tabs"),search:element("animation_search"),count:element("animation_count"),
        viewTabs:element("animation_view_tabs"),previewPage:element("animation_preview_page"),programPage:element("animation_program_page"),
        logic:element("animation_logic"),direction:element("animation_direction"),directionField:element("animation_direction_field"),
        layers:element("animation_layers")
      };
      const missing=Object.entries(this.elements).filter(([,value])=>!value).map(([name])=>name);
      if(missing.length)throw new Error(`Animation Editor markup is missing required controls: ${missing.join(", ")}.`);
      this.driver=ns.registry.create(driverId,{reader});this.renderer=new AnimationRenderer(this.elements.canvas);
      this.timeline=new AnimationTimeline({scrubber:this.elements.scrubber,list:this.elements.commands,onFrame:(frame,index)=>this.render(frame,index),onState:state=>this.updatePlayback(state)});
      this.logicGraph=new ScriptLogicGraph(this.elements.logic,{
        onSelect:node=>this.selectProgramNode(node),
        onInputChange:(node,input,value,control)=>this.changeProgramInput(node,input,value,control)
      });
      this.documents=this.driver.list();
      this.writeAccess=EditorCapabilityGuard.inspect(reader,"animation_editor");
      const commands=reader.history?.("animation_editor",{label:"Animation Editor",onChange:()=>this.updateActions()})||new CommandStack({onChange:()=>this.updateActions()});
      this.commands=EditorCapabilityGuard.protectCommands(reader,"animation_editor",commands,{operation:"Editing animations"});
      const domains=[...new Set(this.documents.map(document=>document.domain))];
      this.elements.domain.replaceChildren(...domains.map(domain=>Dom.create("option",{text:ns.DOMAINS[domain]?.label||domain,attributes:{value:domain}})));
      this.elements.domainTabs.replaceChildren(...domains.map(domain=>Dom.create("button",{
        attributes:{type:"button",role:"tab","aria-selected":"false","data-animation-domain":domain},
      },[
        Dom.create("i",{className:`fa-solid ${ns.DOMAINS[domain]?.icon||"fa-film"}`,attributes:{"aria-hidden":"true"}}),
        Dom.create("span",{text:ns.DOMAINS[domain]?.label||domain})
      ])));
      this.scope.listen(this.elements.domain,"change",()=>this.showDomain(this.elements.domain.value));
      this.scope.listen(this.elements.domainTabs,"click",event=>{const button=event.target.closest("[data-animation-domain]");if(button)this.showDomain(button.dataset.animationDomain);});
      this.scope.listen(this.elements.search,"input",()=>this.showDomain(this.activeDomain,this.active?.id));
      this.scope.listen(this.elements.select,"change",()=>this.select(Number(this.elements.select.value)));
      this.scope.listen(this.elements.direction,"change",()=>this.setContext(this.elements.direction.value));
      this.scope.listen(this.elements.viewTabs,"click",event=>{const button=event.target.closest("[data-animation-view]");if(button)this.showView(button.dataset.animationView);});
      this.scope.listen(this.elements.play,"click",()=>this.play());this.scope.listen(this.elements.pause,"click",()=>this.pause());
      this.scope.listen(this.elements.prev,"click",()=>this.step(-1));this.scope.listen(this.elements.next,"click",()=>this.step(1));
      this.scope.listen(this.elements.layers,"click",event=>{
        const button=event.target.closest("[data-animation-layer]");if(button)this.setLayer(button.dataset.animationLayer||null);
      });
      this.scope.listen(this.elements.canvas,"click",event=>this.setLayer(this.renderer.pickLayer(event.clientX,event.clientY)));
      this.scope.listen(this.elements.undo,"click",()=>{this.commands.undo();this.reloadActive();});
      this.scope.listen(this.elements.redo,"click",()=>{this.commands.redo();this.reloadActive();});
      this.scope.listen(this.elements.form,"submit",event=>{event.preventDefault();this.save();});
      if(domains.length)this.showDomain(domains[0]);else this.empty();
      if(this.driver.diagnostics?.length)NotificationHandler.error("Animation catalog",new Error(`${this.driver.diagnostics.length} malformed animation resource${this.driver.diagnostics.length===1?" was":"s were"} rejected without stopping the editor.`),{persistent:false});
      this.updateActions();this.updatePlayback({playing:false,canPlay:this.canPlay()});
    }
    empty(){
      this.active=null;this.elements.domain.replaceChildren();this.elements.domainTabs.replaceChildren();this.elements.select.replaceChildren();
      this.elements.props.replaceChildren();this.elements.form.replaceChildren();this.elements.commands.replaceChildren();this.elements.logic.replaceChildren();this.elements.layers.replaceChildren();this.elements.layers.hidden=true;
      this.elements.count.textContent="0 animations";this.elements.status.textContent="No decoded animations are available for this ROM.";
      this.renderer.render(new ns.AnimationDocument({id:"empty",name:"No animation",commands:[],frames:[{label:"No animation"}],accuracy:"partial"}),{label:"No animation"});
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
    showView(view){
      const selected=view==="program"?"program":"preview";
      this.elements.viewTabs.querySelectorAll("[data-animation-view]").forEach(button=>{
        const active=button.dataset.animationView===selected;
        button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
      });
      for(const panel of [this.elements.previewPage,this.elements.programPage]){
        const active=panel.dataset.animationPage===selected;panel.hidden=!active;panel.classList.toggle("is-active",active);
      }
      if(selected==="program")requestAnimationFrame(()=>this.logicGraph.drawEdges());
      else if(this.active)requestAnimationFrame(()=>this.render(this.timeline.frames[this.timeline.index],this.timeline.index));
      this.root.dispatchEvent(new CustomEvent("animationviewchange"));
    }
    select(index){
      this.pause();this.active=this.documents[index];
      if(!this.active){
        this.elements.props.replaceChildren();this.elements.form.replaceChildren();this.elements.commands.replaceChildren();this.elements.logic.replaceChildren();
        this.elements.layers.replaceChildren();this.elements.layers.hidden=true;this.renderer.setIsolation(null);
        this.elements.status.textContent="No matching animations.";this.updatePlayback({playing:false,canPlay:false});return false;
      }
      this.renderer.setIsolation(null);this.timeline.set(this.active);this.renderProgram();this.renderLayers();
      const contexts=Array.isArray(this.active.contexts)?this.active.contexts:[];
      this.elements.directionField.hidden=contexts.length<2;
      this.elements.direction.replaceChildren(...contexts.map(item=>Dom.create("option",{text:item.label,attributes:{value:item.id}})));
      if(contexts.length)this.elements.direction.value=this.active.context||contexts[0].id;
      const rate=Number(this.active.fps);
      const simple=[["Type",this.active.type],["Rate",`${Number.isFinite(rate)?rate.toFixed(2):"—"} Hz`],...this.active.properties.filter(item=>item.complexity!=="advanced").map(item=>[item.label,item.value])],advanced=[["Accuracy",this.active.accuracy],["Commands",this.active.commands.length],...this.active.properties.filter(item=>item.complexity==="advanced").map(item=>[item.label,item.value])];
      this.elements.props.replaceChildren(...this.rows(simple),...this.rows(advanced,{"data-complexity":"advanced"}));
      this.renderForm();this.updatePlayback({playing:false,canPlay:this.canPlay()});this.root.dispatchEvent(new CustomEvent("animationviewchange"));return true;
    }
    renderLayers(){
      const layers=Array.isArray(this.active?.layers)?this.active.layers:[];
      this.elements.layers.hidden=!layers.length;
      this.elements.layers.replaceChildren(...(layers.length?[{id:"",label:"Whole scene",icon:"fa-layer-group"},...layers].map(layer=>
        Dom.create("button",{
          className:`ui-button ui-button--icon${(this.renderer.isolation||"")===(layer.id||"")?" active":""}`,
          attributes:{type:"button","data-animation-layer":layer.id||"",title:layer.label,"aria-label":layer.label,"aria-pressed":String((this.renderer.isolation||"")===(layer.id||""))}
        },[UiWindow.icon(layer.icon||"fa-eye")])
      ):[]));
    }
    setLayer(id){
      if(!this.active?.layers?.length)return false;
      this.renderer.setIsolation(id||null);this.renderLayers();
      this.render(this.timeline.frames[this.timeline.index],this.timeline.index);
      return true;
    }
    setContext(context){
      if(!this.active||typeof this.driver.contextualize!=="function")return false;
      const index=this.documents.indexOf(this.active),next=this.driver.contextualize(this.active,context);
      if(!next)return false;
      this.documents[index]=next;this.select(index);return true;
    }
    rows(values,attributes={}){return values.flatMap(([key,value])=>[Dom.create("dt",{text:key,attributes}),Dom.create("dd",{text:String(value),attributes})]);}
    renderProgram(){
      const records=this.active.commands.map((command,index)=>({
        offset:command.offset??index,size:command.size||1,
        name:command.opcodeName||command.mnemonic||command.source?.split(/\s+/)[0]||`${command.track||"step"}-${index+1}`,
        args:command.args||command.operands||[],summary:command.summary||command.event?.note||command.source||command.label,depth:command.callDepth||0,
        control:command.control||null,inputs:this.programInputs(command)
      }));
      const document=ScriptLogicGraph.document(records,{family:this.reader.family,language:`${this.active.source?.repository||this.reader.family} animation program`});
      this.logicGraph.render(document);return this;
    }
    programInputs(command){
      const native=this.driver.commandInputs?.(command);
      if(Array.isArray(native))return native;
      const values=Array.isArray(command.args)?command.args:[];
      return values.map((value,index)=>({
        id:`arg-${index}`,label:`Input ${index+1}`,
        type:typeof value==="number"?"number":/^0x[0-9a-f]+$/i.test(String(value))?"pointer":"text",
        value,editable:false
      }));
    }
    changeProgramInput(node,input,value,control){
      const command=this.active?.commands?.[node.index],writes=this.driver.patchCommand?.(this.active,command,input.id,value)||[];
      if(!writes.length){
        control.value=input.value;
        NotificationHandler.error("Animation input",new Error("This input is decoded for inspection but has no verified writer."),{persistent:false});
        return false;
      }
      EditorCapabilityGuard.requireWritable(this.reader,"animation_editor","Editing an animation command");
      this.commands.execute({
        label:`Edit ${this.active.name} · ${input.label}`,
        do:()=>MemoryUtils.replaceAll(this.reader.memory,writes),
        undo:()=>MemoryUtils.replaceAll(this.reader.memory,[...writes].reverse().map(write=>({offset:write.offset,expected:write.next,next:write.expected})))
      });
      this.reloadActive();return true;
    }
    selectProgramNode(node){this.timeline.go(Math.max(0,Math.min(this.timeline.frames.length-1,node.index)));this.elements.status.textContent=`${node.title} · ${node.summary}`;}
    formControl(field){
      const attributes={name:field.name};
      if(field.type==="select"){
        return Dom.create("select",{attributes},(field.options||[]).map(option=>{
          const value=typeof option==="object"?option.value:option,label=typeof option==="object"?option.label:option;
          return Dom.create("option",{text:String(label),attributes:{value},properties:{selected:String(value)===String(field.value)}});
        }));
      }
      Object.assign(attributes,{type:"number",value:field.value});
      if(Number.isFinite(field.min))attributes.min=field.min;
      if(Number.isFinite(field.max))attributes.max=field.max;
      return Dom.create("input",{attributes});
    }
    renderForm(){
      const editor=this.active?.editor;
      if(!Array.isArray(editor?.fields)||!this.active.editable||!this.writeAccess.writable){
        this.elements.form.hidden=true;this.elements.form.replaceChildren();return;
      }
      const fields=editor.fields.map(field=>Dom.create("label",{text:field.label},[this.formControl(field)]));
      const frameEditor=editor.frames,commands=frameEditor?this.active.commands.filter(command=>!command.end):[];
      const frameRows=commands.map((command,index)=>Dom.create("div",{className:"animation-edit-row"},[
        Dom.create("strong",{text:`Step ${index+1}`}),
        Dom.create("label",{text:frameEditor.imageLabel||"Picture"},[this.formControl({name:`frame-${index}`,type:"select",value:command.image,options:frameEditor.imageOptions})]),
        Dom.create("label",{text:frameEditor.durationLabel||"Ticks"},[this.formControl({name:`duration-${index}`,type:"number",value:command.duration,min:frameEditor.durationMin,max:frameEditor.durationMax})])
      ]));
      this.elements.form.hidden=false;
      this.elements.form.replaceChildren(
        Dom.create("header",{className:"animation-edit-form__header"},[
          Dom.create("strong",{text:"Program properties"}),
          Dom.create("small",{text:"Values not represented by an individual command node"})
        ]),
        ...fields,...frameRows,
        Dom.create("footer",{className:"animation-edit-form__footer"},[
          Dom.create("button",{className:"ui-button ui-button--primary",text:editor.submitLabel||"Apply animation",attributes:{type:"submit"}})
        ])
      );
    }
    save(){
      if(!this.active?.editable)return;
      EditorCapabilityGuard.requireWritable(this.reader,"animation_editor","Editing an animation");
      const form=new FormData(this.elements.form),editor=this.active.editor,
        changes=Object.fromEntries(editor.fields.map(field=>[field.name,field.type==="number"||field.type==="select"?Number(form.get(field.name)):form.get(field.name)])),
        commands=editor.frames?this.active.commands.filter(command=>!command.end):[];
      if(editor.frames)changes.frames=commands.map((command,index)=>({image:Number(form.get(`frame-${index}`)),duration:Number(form.get(`duration-${index}`)),hFlip:command.hFlip,vFlip:command.vFlip}));
      const writes=this.driver.patch(this.active,changes);if(!writes.length)return;
      this.commands.execute({label:`Edit ${this.active.name} animation`,do:()=>MemoryUtils.replaceAll(this.reader.memory,writes),undo:()=>MemoryUtils.replaceAll(this.reader.memory,[...writes].reverse().map(write=>({offset:write.offset,expected:write.next,next:write.expected})))});
      this.reloadActive();
    }
    reloadActive(){
      const id=this.active?.id,domain=this.active?.domain;this.documents=this.driver.list();
      const index=this.documents.findIndex(document=>document.id===id);
      if(index>=0)this.showDomain(domain,id);else if(this.documents.length)this.showDomain(this.documents[0].domain,this.documents[0].id);else this.empty();
    }
    open(request={}){
      const document=ns.AnimationDocumentResolver.resolve(this.documents,request);
      if(!document)return false;this.elements.search.value="";this.showDomain(document.domain,document.id);return true;
    }
    render(frame,index){
      if(!this.active)return;const result=this.renderer.render(this.active,frame);this.elements.logic.querySelector(".logic-node.selected")?.classList.remove("selected");
      const commandIndex=frame?.command??index;this.elements.logic.querySelector(`[data-logic-index="${commandIndex}"]`)?.classList.add("selected");
      const mode=result.native?"native picture":result.error?"picture unavailable · decoded program shown":"decoded engine state";
      this.elements.status.textContent=`${this.active.name} · ${index+1}/${this.timeline.frames.length} · ${frame?.duration||1} ticks · ${mode}`;
    }
    updateActions(){this.elements.undo.disabled=!this.writeAccess.writable||!this.commands.canUndo;this.elements.redo.disabled=!this.writeAccess.writable||!this.commands.canRedo;}
    updatePlayback({playing=false,canPlay=this.canPlay()}={}){this.elements.play.disabled=!canPlay||playing;this.elements.pause.disabled=!playing;this.elements.prev.disabled=!this.timeline.frames.length;this.elements.next.disabled=!this.timeline.frames.length;}
    play(){this.timeline.play();this.root.dispatchEvent(new CustomEvent("animationviewchange"));}
    pause(){this.timeline.pause();this.root.dispatchEvent(new CustomEvent("animationviewchange"));}
    step(delta){this.timeline.step(delta);}
    canPlay(){return (this.timeline.frames?.length||0)>1;}
    activate(){this.root.editorHeader?.render();if(this.active)this.render(this.timeline.frames[this.timeline.index],this.timeline.index);}
    destroy(){this.scope.destroy();this.timeline.destroy();this.commands.destroy?.();}
  }
  global.AnimationEditor=AnimationEditor;
})(globalThis);
