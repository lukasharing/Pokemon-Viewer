(function(global){
  "use strict";
  class CodeEditor{
    constructor(reader,codec,ScriptCodec,{defaultScriptKind="event",scriptLabel="Event script"}={}){
      if(typeof ScriptCodec!=="function")throw new Error(`The ${reader.family} script codec module was not loaded.`);
      const scriptCodec=new ScriptCodec(reader);
      if(typeof scriptCodec.decompile!=="function"||typeof scriptCodec.compile!=="function")throw new TypeError("Script codecs must implement decompile() and compile().");
      this.reader=reader;this.codec=codec;this.scriptCodec=scriptCodec;this.defaultScriptKind=defaultScriptKind;this.patcher=new RelocatablePatch(reader.memory);this.tabs=[];this.scope=new EventScope();this.commands=reader.history?.("code_editor",{label:"Code Editor",onChange:()=>this.updateHistoryStatus()})||new CommandStack({onChange:()=>this.updateHistoryStatus()});
      this.unregisterDrafts=reader.drafts.register("code_editor",()=>this.pendingChanges());
      this.root=Dom.byId("code_workspace");
      this.elements={view:Dom.byId("code_view"),offset:Dom.byId("code_offset"),length:Dom.byId("code_length"),mode:Dom.byId("code_mode"),modeLabel:Dom.byId("code_mode_label"),button:Dom.byId("code_disassemble"),apply:Dom.byId("code_apply"),revert:Dom.byId("code_revert"),tabs:Dom.byId("code_tabs"),links:Dom.byId("code_links"),logic:Dom.byId("code_logic"),output:Dom.byId("code_output"),language:Dom.byId("code_language"),source:Dom.byId("code_source"),properties:Dom.byId("code_properties"),status:Dom.byId("code_status")};
      this.logicGraph=new ScriptLogicGraph(this.elements.logic,{onSelect:node=>this.selectLogicNode(node)});
      this.elements.view.options[0].textContent=scriptLabel;
      this.elements.mode.replaceChildren(...codec.modes.map(mode=>Dom.create("option",{text:mode.label,attributes:{value:mode.id}})));
      this.elements.modeLabel.classList.toggle("hide",codec.modes.length<2);
      this.enhanceSource();this.bind();
      // Offset zero is a ROM header/vector table, not an event or text script.
      // Semantic script mode is entered explicitly or through a typed reference
      // from Map/Battle/etc.; a bare Code Editor always starts in CPU view.
      this.elements.view.value="original";
      this.open(0,false,{view:"original",scriptKind:this.defaultScriptKind});
      this.renderExperience();
    }
    enhanceSource(){
      if(typeof globalThis.CodeMirror?.fromTextArea!=="function")throw new Error("Code Editor requires CodeMirror, but the library did not initialize.");
      if(!globalThis.CodeMirror.modes?.["push-rom"])throw new Error("Code Editor requires the PUSH CodeMirror language mode, but it did not initialize.");
      this.sourceEditor=globalThis.CodeMirror.fromTextArea(this.elements.source,{mode:"text/x-push-rom",lineNumbers:true,lineWrapping:false,indentUnit:2,tabSize:2,viewportMargin:40});
      this.sourceEditor.getInputField()?.setAttribute("aria-label","Editable game source");
      this.sourceEditor.on("change",()=>{if(!this.settingSource)this.updateDraft();});
    }
    sourceValue(){return this.sourceEditor.getValue();}
    setSourceValue(value){this.settingSource=true;this.sourceEditor.setValue(value);this.settingSource=false;}
    bind(){
      const options=this.scope.options;
      this.elements.button.addEventListener("click",()=>this.open(this.parseOffset()),options);
      this.elements.offset.addEventListener("keydown",event=>{if(event.key==="Enter")this.open(this.parseOffset());},options);
      this.elements.mode.addEventListener("change",()=>this.open(this.parseOffset(),true),options);
      this.elements.view.addEventListener("change",()=>this.open(this.parseOffset(),true,{view:this.elements.view.value}),options);
      this.elements.apply.addEventListener("click",()=>this.applySource(),options);
      this.elements.revert.addEventListener("click",()=>this.revertDraft(),options);
      this.elements.source.addEventListener("input",()=>this.updateDraft(),options);
      document.addEventListener("keydown",event=>{if(document.getElementById("code_workspace")?.classList.contains("hide"))return;const command=KeyboardUtils.command(event);if(command){event.preventDefault();this[command]();}},options);
      document.addEventListener("editorpreferencechange",()=>this.renderExperience(),options);
    }
    parseOffset(){return CoreUtils.parseOffset(this.elements.offset.value,this.reader.size);}
    isView(view){return this.active?.viewer===view;}
    setView(view){
      if(!["script","original"].includes(view))throw new TypeError(`Unknown code view '${view}'.`);
      const active=this.active,offset=active?.offset??this.parseOffset();
      this.open(offset,false,{view,reference:view==="script"?active?.reference:undefined,scriptKind:active?.scriptKind||this.defaultScriptKind});
      return this;
    }
    open(offset,replace=false,{view,reference,scriptKind}={}){
      try{
        if(view)this.elements.view.value=view;
        offset-=offset%this.codec.alignment;const length=Math.min(Math.max(16,Number(this.elements.length.value)||256),16384),mode=this.elements.mode.value;
        const viewer=this.elements.view.value,kind=scriptKind||this.defaultScriptKind;let tab={id:`${viewer}-${kind}-${mode}-${offset}`,offset,origin:offset,length,mode,viewer,reference,scriptKind:kind,label:`${viewer==="script"?kind.toUpperCase():mode.toUpperCase()} · ${this.address(offset)}`};
        const existing=this.tabs.findIndex(item=>item.id===tab.id);
        if(existing>=0){const saved=this.tabs[existing];Object.assign(saved,{length,reference:reference||saved.reference,scriptKind:scriptKind||saved.scriptKind});tab=saved;}
        else if(replace&&this.tabs.length&&!this.tabs[this.tabs.length-1].dirty)this.tabs[this.tabs.length-1]=tab;
        else this.tabs.push(tab);
        this.active=tab;this.renderTabs();this.disassemble(tab);
        document.getElementById("code_workspace")?.dispatchEvent(new CustomEvent("codeviewchange",{bubbles:true,detail:{view:tab.viewer,scriptKind:tab.scriptKind}}));
      }catch(error){this.elements.status.textContent=error.message;NotificationHandler.pop("Code editor",error.message,NotificationType.ERROR);}
    }
    disassemble(tab,{resetSource=false}={}){
      this.elements.view.value=tab.viewer||"original";this.elements.modeLabel.classList.toggle("hide",tab.viewer==="script"||this.codec.modes.length<2);
      if(tab.viewer==="script")return this.decompileScript(tab,{resetSource});
      this.renderScriptLinks([]);
      const end=Math.min(this.reader.size,tab.offset+tab.length),lines=[],records=[];let offset=tab.offset;
      while(offset<end){
        const instruction=this.codec.decode(this.reader.memory,offset,{mode:tab.mode});
        if(offset+instruction.size>this.reader.size)break;
        const bytes=Array.from(this.reader.ReadOnlyMemory.slice(offset,offset+instruction.size),byte=>byte.toString(16).toUpperCase().padStart(2,"0")).join(" ");
        lines.push(`${this.address(offset)}  ${bytes.padEnd(12)}  ${instruction.mnemonic.padEnd(9)} ${instruction.operands||""}`.trimEnd());records.push({offset,size:instruction.size,name:instruction.mnemonic,mnemonic:instruction.mnemonic,operands:instruction.operands});offset+=instruction.size;
      }
      this.renderLogic(records,{language:this.codec.label});
      this.elements.output.textContent=lines.join("\n");this.setGeneratedSource(tab,this.sourceFor(tab.offset,end),resetSource);this.elements.offset.value=this.address(tab.offset);this.elements.status.textContent=`${lines.length} instructions · ${this.codec.label} · ${end-tab.offset} bytes`;
      this.showProperties({Architecture:this.codec.label,Language:this.codec.id==="gba-arm"?"PUSH ARM/Thumb directives":"RGBDS-style LR35902 directives",Mode:tab.mode.toUpperCase(),Start:this.address(tab.offset),End:this.address(end),Instructions:lines.length},{Architecture:"advanced",Mode:"advanced",Start:"advanced",End:"advanced",Instructions:"advanced"});
    }
    decompileScript(tab,{resetSource=false}={}){
      const result=this.scriptCodec.decompile(tab.offset,{limit:tab.length,kind:tab.scriptKind});
      this.renderLogic(result.records,{language:result.language});
      this.renderScriptLinks(result.links||[]);
      tab.compiledRegion=result.bytes;this.elements.output.textContent=result.records.map(record=>`${this.address(record.offset)}  ${Array.from(this.reader.ReadOnlyMemory.slice(record.offset,record.offset+record.size),byte=>byte.toString(16).toUpperCase().padStart(2,"0")).join(" ").padEnd(17)} ${record.name}`).join("\n");
      this.setGeneratedSource(tab,result.source,resetSource);this.elements.offset.value=this.address(tab.offset);this.elements.status.textContent=`${result.records.length} commands · ${result.language} · ${result.bytes} bytes`;
      this.showProperties({View:"Event/text script",Language:result.language,Start:this.address(tab.offset),Bytes:result.bytes,Commands:result.records.length,Compiler:tab.reference?"Safe relocation enabled":"Safe in-place subset"},{Start:"advanced",Bytes:"advanced"});
    }
    renderScriptLinks(links){
      this.elements.links.replaceChildren(...links.map(link=>{
        const button=UiWindow.button(link.label||`Open ${link.kind||"resource"}`,{
        icon:link.kind==="text"?"T":"↗",
        onClick:()=>this.open(link.offset,false,{view:"script",reference:link.reference,scriptKind:link.kind})
        });
        button.title=`${this.address(link.offset)} · editable referenced resource`;return button;
      }));
      this.elements.links.classList.toggle("hide",!links.length);
    }
    renderLogic(records,{language=""}={}){
      const family=/crystal|gen\s*ii/i.test(language)?"gen2":this.reader.family;
      this.logicGraph.render(ScriptLogicGraph.document(records,{family,language}));
      this.elements.language.textContent=language||"Game language";
      this.elements.language.dataset.family=family;
      return this;
    }
    selectLogicNode(node){
      const line=Array.from(this.elements.output.textContent.split("\n")).findIndex(value=>value.startsWith(this.address(node.offset)));
      if(line>=0&&!this.elements.output.classList.contains("hide")){
        const before=this.elements.output.textContent.split("\n").slice(0,line).join("\n");
        this.elements.output.scrollTop=Math.max(0,before.split("\n").length*19-this.elements.output.clientHeight/3);
      }
      this.elements.status.textContent=`${node.title} · ${node.summary}`;
    }
    renderExperience(){
      const simple=globalThis.editorPreferences?.experience!=="nerd";
      this.root.dataset.codeExperience=simple?"simple":"nerd";
      this.elements.view.options[0].textContent=simple?"Visual event logic":this.reader.family==="gb"?"Text script (RGBDS)":"Event script";
      this.elements.view.options[1].textContent=simple?"Engine logic":"Original CPU code";
      this.elements.button.querySelector("span").textContent=simple?"Read logic":"Disassemble";
      if(this.active)this.disassemble(this.active);
      return this;
    }
    sourceFor(start,end){
      if(typeof this.codec.source==="function")return this.codec.source(this.reader.memory,start,end,{mode:this.active.mode});
      const width=this.codec.id==="gba-arm"?(this.active.mode==="arm"?4:2):1,directive=width===4?".word":width===2?".hword":".byte",lines=[];for(let offset=start;offset<end;offset+=width){if(offset+width>this.reader.size)break;const value=width===4?this.reader.memory.u32(offset):width===2?this.reader.memory.u16(offset):this.reader.memory.u8(offset),decoded=this.codec.decode(this.reader.memory,offset,{mode:this.active.mode});lines.push(`${directive} 0x${value.toString(16).toUpperCase().padStart(width*2,"0")} ; ${decoded.mnemonic} ${decoded.operands||""}`.trimEnd());}return lines.join("\n");
    }
    assembleSource(){
      const bytes=[];
      for(const [index,source] of this.sourceValue().split(/\r?\n/).entries()){
        const line=source.replace(/;.*/,"").trim();if(!line||line.endsWith(":"))continue;
        const match=line.match(/^(\.(?:byte|hword|word)|d[bdlw])\s+(.+)$/i);
        if(!match)throw new SyntaxError(`Line ${index+1}: use db/dw/dl or .byte/.hword/.word.`);
        const name=match[1].toLowerCase(),width={".byte":1,".hword":2,".word":4,db:1,dw:2,dl:4,dd:4}[name];
        for(const token of match[2].split(",").map(value=>value.trim()).filter(Boolean)){
          const normalized=token.replace(/^\$/,"0x"),value=Number(normalized);
          if(!Number.isInteger(value)||value<0||value>=2**(width*8))throw new RangeError(`Line ${index+1}: '${token}' does not fit ${width} byte(s).`);
          for(let byte=0;byte<width;byte++)bytes.push(value>>>(byte*8)&255);
        }
      }
      return Uint8Array.from(bytes);
    }
    applySource(){
      try{
        const tab=this.active,next=tab.viewer==="script"?this.scriptCodec.compile(this.sourceValue(),{kind:tab.scriptKind}):this.assembleSource(),limit=tab.viewer==="script"?tab.compiledRegion:tab.length;
        const plan=this.patcher.plan({offset:tab.offset,previousLength:limit,nextBytes:next,reference:tab.viewer==="script"?tab.reference:null});
        const refresh=offset=>{tab.offset=offset;tab.id=`${tab.viewer}-${tab.scriptKind}-${tab.mode}-${offset}`;tab.label=`${tab.viewer==="script"?tab.scriptKind.toUpperCase():tab.mode.toUpperCase()} · ${this.address(offset)}`;this.disassemble(tab,{resetSource:true});};
        this.commands.execute({
          label:`${plan.relocated?"Relocate":"Patch"} ${this.address(tab.offset)}`,
          description:`${next.length} bytes${plan.relocated?` · pointer → ${this.address(plan.target)}`:""}`,
          do:()=>refresh(this.patcher.apply(plan)),
          undo:()=>refresh(this.patcher.restore(plan))
        });
      }catch(error){this.elements.status.textContent=error.message;NotificationHandler.pop("Code patch",error.message,NotificationType.ERROR);}
    }
    undo(){return EditUtils.history(this.commands,"undo",{title:"Code history"});}
    redo(){return EditUtils.history(this.commands,"redo",{title:"Code history"});}
    setGeneratedSource(tab,source,reset=false){
      const wasDirty=Boolean(tab.dirty);
      tab.generated=source;
      if(reset||tab.draft===undefined||!wasDirty){tab.draft=source;tab.dirty=false;}
      else tab.dirty=tab.draft!==source;
      this.setSourceValue(tab.draft);this.updateSourceActions();this.sourceEditor?.refresh();
    }
    updateDraft(){if(!this.active)return;this.active.draft=this.sourceValue();this.active.dirty=this.active.draft!==this.active.generated;this.updateSourceActions();}
    revertDraft(){if(!this.active?.dirty)return false;this.active.draft=this.active.generated;this.active.dirty=false;this.setSourceValue(this.active.generated);this.updateSourceActions();(this.sourceEditor||this.elements.source).focus();return true;}
    updateSourceActions(){
      const dirty=Boolean(this.active?.dirty);this.elements.apply.disabled=!dirty;this.elements.revert.disabled=!dirty;
      this.elements.apply.querySelector("span").textContent=`Apply · ${this.commands.done.length}`;this.renderTabs();
      this.reader.drafts.changed("code_editor");
    }
    pendingChanges(){return this.tabs.filter(tab=>tab.dirty).map(tab=>Object.freeze({kind:"source-draft",label:tab.label,offset:tab.offset}));}
    updateHistoryStatus(){this.updateSourceActions();}
    renderTabs(){this.elements.tabs.replaceChildren(...this.tabs.map(tab=>Dom.create("button",{className:tab===this.active?"active":"",text:`${tab.dirty?"● ":""}${tab.label}`,attributes:{type:"button",role:"tab","aria-label":`${tab.label}${tab.dirty?" (modified draft)":""}`},events:{click:()=>{this.active=tab;this.elements.mode.value=tab.mode;this.elements.view.value=tab.viewer;this.disassemble(tab);}}})));}
    showProperties(values,complexity={}){
      const next=UiWindow.properties(values,{},complexity);
      next.id=this.elements.properties.id;
      next.classList.add("code-properties");
      this.elements.properties.replaceWith(next);this.elements.properties=next;
    }
    address(offset){return`0x${offset.toString(16).toUpperCase().padStart(6,"0")}`;}
    refresh(){if(this.active)this.disassemble(this.active);this.sourceEditor?.refresh();return this;}
    destroy(){this.unregisterDrafts?.();this.commands.destroy?.();this.sourceEditor?.toTextArea();this.scope.destroy();}
  }
  global.CodeEditor=CodeEditor;
})(globalThis);
