(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  class SoundEditor {
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("sound_editor");this.scope=new EventScope();this.pipeline=new EditorRenderPipeline({name:"sound",onError:error=>NotificationHandler.error("Sound decoding",error)});this.writeAccess=EditorCapabilityGuard.inspect(reader,"sound_editor");
      this.commands=EditorCapabilityGuard.protectCommands(reader,"sound_editor",reader.history("sound_editor",{label:"Sound Editor"}),{operation:"Editing sounds"});this.driver=ns.registry.create(driverId,{reader,family:driverId});
      const element=id=>this.root.querySelector(`#${id}`);
      this.elements={group:element("sound_group"),filter:element("sound_filter"),cue:element("sound_cue"),title:element("sound_title"),kind:element("sound_kind"),visualTitle:element("sound_visual_title")||this.root.querySelector(".sound-primary .ui-window__title"),accuracy:element("sound_accuracy"),playback:element("sound_playback"),properties:element("sound_properties"),status:element("sound_status"),edit:element("sound_edit"),reset:element("sound_reset"),editForm:element("sound_edit_form"),editFields:element("sound_edit_fields"),editActions:element("sound_edit_actions"),play:element("sound_play"),stop:element("sound_stop"),scrubber:element("sound_scrubber"),time:element("sound_time"),zoomOut:element("sound_zoom_out"),zoomFit:element("sound_zoom_fit"),zoomIn:element("sound_zoom_in"),timelineScroller:element("sound_timeline_scroller"),timeline:element("sound_timeline"),empty:element("sound_empty"),tracks:element("sound_tracks"),commands:element("sound_commands"),references:element("sound_references")};
      const missing=Object.entries(this.elements).filter(([,value])=>!value).map(([name])=>name);
      if(missing.length)throw new Error(`Sound Editor markup is missing required controls: ${missing.join(", ")}.`);
      this.timelineScale=1;this.selectedTrack=null;this.documents=this.driver.list();this.filtered=this.visibleDocuments();this.bind();this.renderGroups();this.renderList();this.select(0);
    }
    bind(){this.scope.listen(this.elements.group,"change",()=>this.filter());this.scope.listen(this.elements.filter,"input",()=>this.filter());this.scope.listen(this.elements.cue,"change",()=>this.select(Number(this.elements.cue.value)));this.scope.listen(this.elements.edit,"click",()=>this.edit());this.scope.listen(this.elements.reset,"click",()=>this.renderEditFields());this.scope.listen(this.elements.play,"click",()=>this.play());this.scope.listen(this.elements.stop,"click",()=>this.stop());this.scope.listen(this.elements.zoomOut,"click",()=>this.zoom(-1));this.scope.listen(this.elements.zoomFit,"click",()=>this.zoom(0));this.scope.listen(this.elements.zoomIn,"click",()=>this.zoom(1));this.scope.listen(window,"resize",()=>this.renderTimeline());this.scope.listen(document,"editorpreferencechange",()=>{this.renderGroups();this.filter();});}
    visibleDocuments(){const group=this.elements?.group?.value||"all";return this.documents.filter(document=>(globalThis.editorPreferences?.experience==="nerd"||!document.metadata?.isGlitch)&&(group==="all"||(document.metadata?.group||"unclassified")===group));}
    renderGroups(){const counts=new Map();for(const document of this.documents){if(globalThis.editorPreferences?.experience!=="nerd"&&document.metadata?.isGlitch)continue;const group=document.metadata?.group||"unclassified";counts.set(group,(counts.get(group)||0)+1);}const selected=this.elements.group.value||"all",options=[Dom.create("option",{text:`All sound documents · ${[...counts.values()].reduce((total,value)=>total+value,0)}`,attributes:{value:"all"}}),...Object.keys(ns.groups).filter(group=>group!=="all"&&counts.has(group)).map(group=>Dom.create("option",{text:`${ns.groupLabel(group)} · ${counts.get(group)}`,attributes:{value:group}}))];this.elements.group.replaceChildren(...options);this.elements.group.value=options.some(option=>option.value===selected)?selected:"all";}
    filter(){const term=this.elements.filter.value.trim().toLowerCase();this.filtered=this.visibleDocuments().filter(document=>!term||`${document.name} ${document.kind} ${document.source} ${document.metadata?.group||""} ${Object.values(document.metadata).join(" ")}`.toLowerCase().includes(term));this.renderList();this.select(0);}
    renderList(){this.elements.cue.replaceChildren(...this.filtered.map((document,index)=>Dom.create("option",{text:`${ns.kindLabel(document.kind)} · ${document.name}`,attributes:{value:index}})));}
    select(index){
      this.stop();const ticket=this.pipeline.begin(`sound:${index}`);this.active=this.filtered[index]||null;this.selectedTrack=null;this.timelineScale=1;if(!this.active){this.clear();return;}
      this.detail={tracks:[],commands:[],voices:[]};this.elements.title.textContent=this.active.name;this.elements.kind.textContent=ns.kindLabel(this.active.kind);
      this.elements.accuracy.textContent="Loading…";this.elements.accuracy.dataset.accuracy=this.active.accuracy;this.renderProperties();this.renderEditFields();this.renderReferences();
      this.elements.play.disabled=true;this.elements.stop.disabled=true;this.elements.status.replaceChildren(UiLoading.create("Loading native sound data",{compact:true}));this.renderPlaybackState();this.renderTracks();this.renderCommands();this.renderTimeline();
      this.pipeline.run(ticket,()=>{
        this.detail=this.driver.describe(this.active);this.elements.accuracy.textContent=this.accuracyLabel();this.renderPlaybackState();this.renderTracks();this.renderCommands();this.renderTimeline();
        this.elements.play.disabled=!this.canAudition();this.elements.play.title=this.canAudition()?this.auditionLabel():"Playback is unavailable because this document has no decoded audio source";
        this.elements.stop.disabled=!this.canAudition();this.elements.status.textContent=this.simpleSummary();
      },{schedule:"paint",phase:"decode"});
    }
    clear(){for(const key of ["properties","tracks","commands","references","editFields"])this.elements[key].replaceChildren();this.elements.title.textContent="Sound";this.elements.kind.textContent="Sound";this.elements.editForm.classList.add("hide");this.elements.editActions.classList.add("hide");this.elements.play.disabled=true;this.elements.stop.disabled=true;this.elements.status.textContent="No matching sound.";this.renderPlaybackState();this.renderTimeline();}
    rows(values,attributes={}){return values.flatMap(([key,value])=>[Dom.create("dt",{text:key,attributes}),Dom.create("dd",{text:String(value),attributes})]);}
    renderProperties(){const d=this.active;const species=d.metadata?.speciesId?[
      ["Pokémon",d.metadata.speciesName],
      ...(d.metadata.dexNumber?[["Pokédex",`#${d.metadata.dexNumber}`]]:[]),
      ...(Number.isInteger(d.metadata.cryId)?[["Cry",`#${d.metadata.cryId}`],["Root key",String(d.metadata.key)],["Envelope",`${d.metadata.attack}/${d.metadata.decay}/${d.metadata.sustain}/${d.metadata.release}`]]:[])
    ]:[];const mapMusic=d.metadata?.group==="map"?[
      ["Song",Number.isInteger(d.metadata.songId)?`#${d.metadata.songId}`:"—"],
      ["Used by",`${d.metadata.mapCount||0} map${d.metadata.mapCount===1?"":"s"}`]
    ]:[];const basic=[["Type",ns.kindLabel(d.kind)],...species,...mapMusic,["Editing",d.editable?"Available":"Read-only"]],advanced=[["Family",d.family.toUpperCase()],["Accuracy",d.accuracy],[d.family==="gbc"?"Internal ID":"Species ID",d.metadata?.speciesId?`#${d.metadata.speciesId}`:"—"],["Cry table",d.metadata?.cryTable||"—"],["ROM offset",ns.hex(d.offset)],["Source",d.source]];this.elements.properties.replaceChildren(...this.rows(basic),...this.rows(advanced,{"data-complexity":"advanced"}));}
    renderEditFields(){const fields=this.writeAccess.writable&&this.active?.editable&&typeof this.driver.editFields==="function"?this.driver.editFields(this.active):[];this.elements.editForm.classList.toggle("hide",!fields.length);this.elements.editActions.classList.toggle("hide",!fields.length);this.elements.edit.disabled=!fields.length;this.elements.editFields.replaceChildren(...fields.map(field=>Dom.create("label",{},[Dom.create("span",{text:field.label}),Dom.create("input",{attributes:{name:field.name,type:field.type||"number",value:field.value,min:field.min,max:field.max,step:field.step||1}})])));}
    renderTracks(){const tracks=this.detail.tracks||[];this.elements.tracks.replaceChildren(...(tracks.length?tracks.map(track=>Dom.create("li",{className:this.selectedTrack===track.index?"is-selected":""},[Dom.create("button",{attributes:{type:"button","aria-pressed":String(this.selectedTrack===track.index),title:`Focus channel ${track.index}`},events:{click:()=>{this.selectedTrack=this.selectedTrack===track.index?null:track.index;this.renderTracks();this.renderTimeline();}}},[Dom.create("span",{className:"sound-track-list__icon"},[UiWindow.icon("fa-wave-square")]),Dom.create("span",{},[Dom.create("strong",{text:`Channel ${track.index}`}),Dom.create("small",{text:`${track.commands.length} decoded events`})]),Dom.create("code",{text:ns.hex(track.offset),attributes:{"data-complexity":"advanced"}})])])):[Dom.create("li",{className:"is-empty",text:"No verified channel layout is available."})]));}
    canAudition(){return Boolean(this.detail?.waveform?.native&&this.detail.waveform.samples?.length);}
    playbackState(){if(this.canAudition())return{kind:"sample",label:"ROM sample",icon:"fa-volume-high"};if(this.detail?.tracks?.length)return{kind:"structure",label:"Structure only",icon:"fa-wave-square"};return{kind:"unavailable",label:"No playback",icon:"fa-volume-xmark"};}
    renderPlaybackState(){const state=this.playbackState(),icon=this.elements.playback.querySelector("i"),label=this.elements.playback.querySelector("span");this.elements.playback.dataset.state=state.kind;icon.className=`fa-solid ${state.icon}`;label.textContent=state.label;}
    auditionLabel(){return"Play decoded ROM sample audition";}
    accuracyLabel(){return this.canAudition()?"ROM sample":this.active?.accuracy==="verified"?"Structure verified":"Partial decoder";}
    simpleSummary(){if(this.canAudition())return`Native ROM sample · ${Math.round(this.detail.waveform.sampleRate).toLocaleString()} Hz · ${this.detail.waveform.size.toLocaleString()} samples.`;if(this.active?.metadata?.group==="map"){const maps=this.active.metadata.mapCount||0,channels=this.detail?.tracks?.length||0;return`${maps} map reference${maps===1?"":"s"}${channels?` · ${channels} decoded channel${channels===1?"":"s"}`:""} · native playback is not decoded yet.`;}if(this.detail?.tracks?.length)return`${this.detail.tracks.length} decoded channel${this.detail.tracks.length===1?"":"s"}.`;if(this.active?.kind==="cry")return"Native console cry playback is not decoded for this game yet.";return"No playable audio decoder is available for this resource.";}
    play(){
      if(!this.canAudition())return false;
      try{
        const duration=ns.SoundAudition.play({...this.active.metadata,family:this.active.family,waveform:this.detail.waveform});
        this.elements.scrubber.max=String(Math.max(1,Math.round(duration*100)));this.elements.scrubber.value="0";this.elements.time.textContent=this.timeLabel(0,duration);
        const started=performance.now(),advance=now=>{const progress=Math.min(1,(now-started)/(duration*1000));this.elements.scrubber.value=String(Math.round(progress*Number(this.elements.scrubber.max)));this.elements.time.textContent=this.timeLabel(duration*progress,duration);if(progress<1)this.animationFrame=requestAnimationFrame(advance);else this.animationFrame=null;};this.animationFrame=requestAnimationFrame(advance);
        return true;
      }catch(error){NotificationHandler.pop("Sound audition",error.message||String(error),NotificationType.ERROR);return false;}
    }
    timeLabel(current,total){const label=value=>`${Math.floor(value/60)}:${String((value%60).toFixed(1)).padStart(4,"0")}`;return`${label(current)} / ${label(total)}`;}
    stop(){ns.SoundAudition.stop();if(this.animationFrame)cancelAnimationFrame(this.animationFrame);this.animationFrame=null;if(this.elements?.scrubber){this.elements.scrubber.value="0";this.elements.time.textContent="0:00";}return true;}
    zoom(direction){this.timelineScale=direction===0?1:Math.max(1,Math.min(4,this.timelineScale+(direction<0?-.5:.5)));this.renderTimeline();if(direction===0)this.elements.timelineScroller.scrollLeft=0;}
    renderTimeline(){
      const canvas=this.elements.timeline,context=canvas.getContext("2d"),tracks=this.detail?.tracks||[],commands=this.detail?.commands||[],waveform=this.detail?.waveform,samples=waveform?.native?waveform.samples:null,label=waveform?.native?"Native ROM sample":`${tracks.length} decoded channel${tracks.length===1?"":"s"}`;
      const baseWidth=Math.max(960,Math.floor(this.elements.timelineScroller.clientWidth||960));canvas.width=Math.round(baseWidth*this.timelineScale);canvas.height=320;canvas.style.width=`${canvas.width}px`;this.elements.visualTitle.textContent=samples?"Waveform":"Arrangement";const rendered=ns.SoundWaveform.draw(context,canvas.width,canvas.height,{samples,tracks,commands,label,activeTrack:this.selectedTrack});canvas.classList.toggle("hide",!rendered);this.elements.empty.classList.toggle("hide",rendered);
    }
    renderCommands(){const commands=this.detail.commands||[];this.elements.commands.replaceChildren(...(commands.length?commands.map(command=>Dom.create("tr",{},[Dom.create("td",{text:ns.hex(command.offset)}),Dom.create("td",{text:command.name}),Dom.create("td",{text:command.arguments.join(", ")||"—"}),Dom.create("td",{text:String(command.tick)})])):[Dom.create("tr",{},[Dom.create("td",{text:"No decoded commands",attributes:{colspan:"4"}})])]));}
    renderReferences(){
      const references=this.active.references||[];
      const items=references.map(ref=>{
        const label=`${ref.type}: ${ref.label||ref.id}`;
        if(ref.type!=="map")return Dom.create("li",{text:label});
        const parsed=String(ref.id||"").split(":").map(Number),target=this.active.family==="gba"
          ?{bank:parsed[0],map:parsed[1]}
          :this.active.family==="gen2"?{group:parsed[0],map:parsed[1]}:{mapId:parsed[0]};
        return Dom.create("li",{},[Dom.create("button",{className:"sound-reference",attributes:{type:"button",title:`Open ${ref.label||"map"}`},events:{click:()=>EditorLinks.map(target)}},[UiWindow.icon("fa-map"),Dom.create("span",{text:label})])]);
      });
      this.elements.references.replaceChildren(...(items.length?items:[Dom.create("li",{text:"No linked game data recorded."})]));
    }
    async edit(){
      if(!this.active?.editable||typeof this.driver.edit!=="function")return;
      EditorCapabilityGuard.requireWritable(this.reader,"sound_editor","Editing sound data");
      const resourceId=this.active.metadata?.resourceId,id=this.active.id;
      const values=Object.fromEntries(new FormData(this.elements.editForm).entries());
      for(const field of this.driver.editFields(this.active))if(field.type==="number")values[field.name]=Number(values[field.name]);
      if(this.driver.edit(this.active,values,this.commands)===false)return;
      this.documents=this.driver.list();this.renderGroups();this.filtered=this.visibleDocuments();
      const index=this.filtered.findIndex(document=>document.metadata?.resourceId===resourceId||document.id===id);
      this.renderList();this.elements.cue.value=String(Math.max(0,index));this.select(Math.max(0,index));
    }
    open(request={}){
      const group=Number.isInteger(Number(request.species))?"cry":(request.group||(request.map?"map":"all"));
      this.elements.group.value=group;const source=this.visibleDocuments(),species=Number(request.species),songId=Number(request.songId);
      let index=source.findIndex(document=>document.kind==="cry"&&(Number(document.metadata?.dexNumber)===species||Number(document.id)===species));
      if(index<0&&Number.isInteger(songId))index=source.findIndex(document=>Number(document.metadata?.songId)===songId);
      if(index<0&&request.map){
        const mapId=typeof request.map==="string"?request.map:`${request.map.group}:${request.map.map}`;
        index=source.findIndex(document=>document.references.some(reference=>String(reference.id)===mapId));
      }
      this.filtered=source;this.elements.filter.value="";this.renderList();this.select(index<0?0:index);this.elements.cue.value=String(Math.max(0,index));return index>=0;
    }
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Sound history"});if(changed)this.reloadActive();return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Sound history"});if(changed)this.reloadActive();return changed;}
    reloadActive(){const resourceId=this.active?.metadata?.resourceId,id=this.active?.id;this.documents=this.driver.list();this.renderGroups();this.filtered=this.visibleDocuments();const index=this.filtered.findIndex(document=>document.metadata?.resourceId===resourceId||document.id===id);this.renderList();this.elements.cue.value=String(Math.max(0,index));this.select(Math.max(0,index));}
    destroy(){this.pipeline.destroy();this.stop();this.commands.destroy();this.scope.destroy();}
  }
  global.SoundEditor=SoundEditor;
})(globalThis);
