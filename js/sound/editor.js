(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  class SoundEditor {
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("sound_editor");this.scope=new EventScope();this.commands=reader.history("sound_editor",{label:"Sound Editor"});this.driver=ns.registry.create(driverId,{reader,family:driverId});
      const element=id=>this.root.querySelector(`#${id}`);
      this.elements={group:element("sound_group"),filter:element("sound_filter"),cue:element("sound_cue"),title:element("sound_title"),kind:element("sound_kind"),visualTitle:element("sound_visual_title")||this.root.querySelector(".sound-primary .ui-window__title"),accuracy:element("sound_accuracy"),properties:element("sound_properties"),status:element("sound_status"),edit:element("sound_edit"),reset:element("sound_reset"),editForm:element("sound_edit_form"),editFields:element("sound_edit_fields"),editActions:element("sound_edit_actions"),play:element("sound_play"),stop:element("sound_stop"),scrubber:element("sound_scrubber"),time:element("sound_time"),timeline:element("sound_timeline"),empty:element("sound_empty"),tracks:element("sound_tracks"),commands:element("sound_commands"),references:element("sound_references")};
      const missing=Object.entries(this.elements).filter(([,value])=>!value).map(([name])=>name);
      if(missing.length)throw new Error(`Sound Editor markup is missing required controls: ${missing.join(", ")}.`);
      this.documents=this.driver.list();this.filtered=this.visibleDocuments();this.bind();this.renderGroups();this.renderList();this.select(0);
    }
    bind(){this.scope.listen(this.elements.group,"change",()=>this.filter());this.scope.listen(this.elements.filter,"input",()=>this.filter());this.scope.listen(this.elements.cue,"change",()=>this.select(Number(this.elements.cue.value)));this.scope.listen(this.elements.edit,"click",()=>this.edit());this.scope.listen(this.elements.reset,"click",()=>this.renderEditFields());this.scope.listen(this.elements.play,"click",()=>this.play());this.scope.listen(this.elements.stop,"click",()=>this.stop());this.scope.listen(document,"editorpreferencechange",()=>{this.renderGroups();this.filter();});}
    visibleDocuments(){const group=this.elements?.group?.value||"all";return this.documents.filter(document=>(globalThis.editorPreferences?.experience==="nerd"||!document.metadata?.isGlitch)&&(group==="all"||(document.metadata?.group||"unclassified")===group));}
    renderGroups(){const counts=new Map();for(const document of this.documents){if(globalThis.editorPreferences?.experience!=="nerd"&&document.metadata?.isGlitch)continue;const group=document.metadata?.group||"unclassified";counts.set(group,(counts.get(group)||0)+1);}const selected=this.elements.group.value||"all",options=[Dom.create("option",{text:`All sound documents · ${[...counts.values()].reduce((total,value)=>total+value,0)}`,attributes:{value:"all"}}),...Object.keys(ns.groups).filter(group=>group!=="all"&&counts.has(group)).map(group=>Dom.create("option",{text:`${ns.groupLabel(group)} · ${counts.get(group)}`,attributes:{value:group}}))];this.elements.group.replaceChildren(...options);this.elements.group.value=options.some(option=>option.value===selected)?selected:"all";}
    filter(){const term=this.elements.filter.value.trim().toLowerCase();this.filtered=this.visibleDocuments().filter(document=>!term||`${document.name} ${document.kind} ${document.source} ${document.metadata?.group||""} ${Object.values(document.metadata).join(" ")}`.toLowerCase().includes(term));this.renderList();this.select(0);}
    renderList(){this.elements.cue.replaceChildren(...this.filtered.map((document,index)=>Dom.create("option",{text:`${ns.kindLabel(document.kind)} · ${document.name}`,attributes:{value:index}})));}
    select(index){this.stop();this.active=this.filtered[index]||null;if(!this.active){this.clear();return;}this.detail=this.driver.describe(this.active);this.elements.title.textContent=this.active.name;this.elements.kind.textContent=ns.kindLabel(this.active.kind);this.elements.accuracy.textContent=this.accuracyLabel();this.elements.accuracy.dataset.accuracy=this.active.accuracy;this.renderProperties();this.renderEditFields();this.renderTracks();this.renderCommands();this.renderReferences();this.renderTimeline();this.elements.play.disabled=!this.canAudition();this.elements.play.title=this.canAudition()?this.auditionLabel():"Playback is unavailable because this document has no decoded audio source";this.elements.stop.disabled=!this.canAudition();this.elements.status.textContent=this.simpleSummary();}
    clear(){for(const key of ["properties","tracks","commands","references","editFields"])this.elements[key].replaceChildren();this.elements.title.textContent="Sound";this.elements.kind.textContent="Sound";this.elements.editForm.classList.add("hide");this.elements.editActions.classList.add("hide");this.elements.play.disabled=true;this.elements.stop.disabled=true;this.elements.status.textContent="No matching sound.";this.renderTimeline();}
    rows(values,attributes={}){return values.flatMap(([key,value])=>[Dom.create("dt",{text:key,attributes}),Dom.create("dd",{text:String(value),attributes})]);}
    renderProperties(){const d=this.active;const species=d.metadata?.speciesId?[
      ["Pokémon",d.metadata.speciesName],
      ...(d.metadata.dexNumber?[["Pokédex",`#${d.metadata.dexNumber}`]]:[]),
      ...(Number.isInteger(d.metadata.cryId)?[["Cry",`#${d.metadata.cryId}`],["Root key",String(d.metadata.key)],["Envelope",`${d.metadata.attack}/${d.metadata.decay}/${d.metadata.sustain}/${d.metadata.release}`]]:[])
    ]:[];const basic=[["Type",ns.kindLabel(d.kind)],...species,["Editing",d.editable?"Available":"Read-only"]],advanced=[["Family",d.family.toUpperCase()],["Accuracy",d.accuracy],[d.family==="gbc"?"Internal ID":"Species ID",d.metadata?.speciesId?`#${d.metadata.speciesId}`:"—"],["Cry table",d.metadata?.cryTable||"—"],["ROM offset",ns.hex(d.offset)],["Source",d.source]];this.elements.properties.replaceChildren(...this.rows(basic),...this.rows(advanced,{"data-complexity":"advanced"}));}
    renderEditFields(){const fields=this.active?.editable&&typeof this.driver.editFields==="function"?this.driver.editFields(this.active):[];this.elements.editForm.classList.toggle("hide",!fields.length);this.elements.editActions.classList.toggle("hide",!fields.length);this.elements.edit.disabled=!fields.length;this.elements.editFields.replaceChildren(...fields.map(field=>Dom.create("label",{},[Dom.create("span",{text:field.label}),Dom.create("input",{attributes:{name:field.name,type:field.type||"number",value:field.value,min:field.min,max:field.max,step:field.step||1}})])));}
    renderTracks(){const tracks=this.detail.tracks||[];this.elements.tracks.replaceChildren(...(tracks.length?tracks.map(track=>Dom.create("li",{text:`Track ${track.index} · ${ns.hex(track.offset)} · ${track.commands.length} commands`})):[Dom.create("li",{text:"No verified track layout is available for this document."})]));}
    canAudition(){const metadata=this.active?.metadata||{};return this.active?.kind==="cry"&&(Number.isInteger(metadata.baseCry)||Number.isInteger(metadata.key));}
    auditionLabel(){return"Play parameter audition";}
    accuracyLabel(){return this.detail?.waveform?.native?"Native sample":this.canAudition()?"Parameter audition":this.active?.accuracy==="verified"?"Structure verified":"Partial decoder";}
    simpleSummary(){if(this.detail?.waveform?.native)return"Native waveform decoded from this ROM; playback remains a parameter audition.";if(this.canAudition())return"Editable cry parameters with an approximate audition.";if(this.detail?.tracks?.length)return`${this.detail.tracks.length} decoded channel${this.detail.tracks.length===1?"":"s"}.`;return"No playable audio decoder is available for this resource.";}
    play(){
      if(!this.canAudition())return false;
      try{
        const duration=ns.SoundAudition.play({...this.active.metadata,family:this.active.family});
        this.elements.scrubber.max=String(Math.max(1,Math.round(duration*100)));this.elements.scrubber.value="0";this.elements.time.textContent=`0:${String(duration.toFixed(1)).padStart(4,"0")}`;
        const started=performance.now(),advance=now=>{const progress=Math.min(1,(now-started)/(duration*1000));this.elements.scrubber.value=String(Math.round(progress*Number(this.elements.scrubber.max)));if(progress<1)this.animationFrame=requestAnimationFrame(advance);else this.animationFrame=null;};this.animationFrame=requestAnimationFrame(advance);
        return true;
      }catch(error){NotificationHandler.pop("Sound audition",error.message||String(error),NotificationType.ERROR);return false;}
    }
    stop(){ns.SoundAudition.stop();if(this.animationFrame)cancelAnimationFrame(this.animationFrame);this.animationFrame=null;this.elements?.scrubber&&(this.elements.scrubber.value="0");return true;}
    renderTimeline(){
      const canvas=this.elements.timeline,context=canvas.getContext("2d"),tracks=this.detail?.tracks||[],commands=this.detail?.commands||[],waveform=this.detail?.waveform,samples=waveform?.samples||ns.SoundWaveform.parameterSamples(this.active?.metadata,this.active?.family),label=waveform?.native?"Native ROM sample":samples?"Parameter audition · not native audio":`${tracks.length} decoded channel${tracks.length===1?"":"s"}`;
      this.elements.visualTitle.textContent=samples?"Waveform":"Arrangement";const rendered=ns.SoundWaveform.draw(context,canvas.width,canvas.height,{samples,tracks,commands,label});canvas.classList.toggle("hide",!rendered);this.elements.empty.classList.toggle("hide",rendered);
    }
    renderCommands(){const commands=this.detail.commands||[];this.elements.commands.replaceChildren(...(commands.length?commands.map(command=>Dom.create("tr",{},[Dom.create("td",{text:ns.hex(command.offset)}),Dom.create("td",{text:command.name}),Dom.create("td",{text:command.arguments.join(", ")||"—"}),Dom.create("td",{text:String(command.tick)})])):[Dom.create("tr",{},[Dom.create("td",{text:"No decoded commands",attributes:{colspan:"4"}})])]));}
    renderReferences(){this.elements.references.replaceChildren(...(this.active.references.length?this.active.references.map(ref=>Dom.create("li",{text:`${ref.type}: ${ref.label||ref.id}`})):[Dom.create("li",{text:"No linked game data recorded."})]));}
    async edit(){
      if(!this.active?.editable||typeof this.driver.edit!=="function")return;
      const resourceId=this.active.metadata?.resourceId,id=this.active.id;
      const values=Object.fromEntries(new FormData(this.elements.editForm).entries());
      for(const field of this.driver.editFields(this.active))if(field.type==="number")values[field.name]=Number(values[field.name]);
      if(this.driver.edit(this.active,values,this.commands)===false)return;
      this.documents=this.driver.list();this.renderGroups();this.filtered=this.visibleDocuments();
      const index=this.filtered.findIndex(document=>document.metadata?.resourceId===resourceId||document.id===id);
      this.renderList();this.elements.cue.value=String(Math.max(0,index));this.select(Math.max(0,index));
    }
    open(request={}){this.elements.group.value="cry";const source=this.visibleDocuments(),species=Number(request.species),index=source.findIndex(document=>document.kind==="cry"&&(Number(document.metadata?.dexNumber)===species||Number(document.id)===species));this.filtered=source;this.elements.filter.value="";this.renderList();this.select(index<0?0:index);this.elements.cue.value=String(Math.max(0,index));return index>=0;}
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Sound history"});if(changed)this.reloadActive();return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Sound history"});if(changed)this.reloadActive();return changed;}
    reloadActive(){const resourceId=this.active?.metadata?.resourceId,id=this.active?.id;this.documents=this.driver.list();this.renderGroups();this.filtered=this.visibleDocuments();const index=this.filtered.findIndex(document=>document.metadata?.resourceId===resourceId||document.id===id);this.renderList();this.elements.cue.value=String(Math.max(0,index));this.select(Math.max(0,index));}
    destroy(){this.stop();this.commands.destroy();this.scope.destroy();}
  }
  global.SoundEditor=SoundEditor;
})(globalThis);
