(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  class SoundEditor {
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("sound_editor");this.scope=new EventScope();this.commands=reader.history("sound_editor",{label:"Sound Editor"});this.driver=ns.registry.create(driverId,{reader,family:driverId});
      this.elements={group:Dom.byId("sound_group"),filter:Dom.byId("sound_filter"),cue:Dom.byId("sound_cue"),title:Dom.byId("sound_title"),properties:Dom.byId("sound_properties"),status:Dom.byId("sound_status"),edit:Dom.byId("sound_edit"),play:Dom.byId("sound_play"),scrubber:Dom.byId("sound_scrubber"),time:Dom.byId("sound_time"),timeline:Dom.byId("sound_timeline"),tracks:Dom.byId("sound_tracks"),commands:Dom.byId("sound_commands"),references:Dom.byId("sound_references")};
      this.documents=this.driver.list();this.filtered=this.visibleDocuments();this.bind();this.renderGroups();this.renderList();this.select(0);
    }
    bind(){this.scope.listen(this.elements.group,"change",()=>this.filter());this.scope.listen(this.elements.filter,"input",()=>this.filter());this.scope.listen(this.elements.cue,"change",()=>this.select(Number(this.elements.cue.value)));this.scope.listen(this.elements.edit,"click",()=>this.edit());this.scope.listen(this.elements.play,"click",()=>this.play());this.scope.listen(document,"editorpreferencechange",()=>{this.renderGroups();this.filter();});}
    visibleDocuments(){const group=this.elements?.group?.value||"all";return this.documents.filter(document=>(globalThis.editorPreferences?.experience==="nerd"||!document.metadata?.isGlitch)&&(group==="all"||(document.metadata?.group||"unclassified")===group));}
    renderGroups(){const counts=new Map();for(const document of this.documents){if(globalThis.editorPreferences?.experience!=="nerd"&&document.metadata?.isGlitch)continue;const group=document.metadata?.group||"unclassified";counts.set(group,(counts.get(group)||0)+1);}const selected=this.elements.group.value||"all",options=[Dom.create("option",{text:`All sound documents · ${[...counts.values()].reduce((total,value)=>total+value,0)}`,attributes:{value:"all"}}),...Object.keys(ns.groups).filter(group=>group!=="all"&&counts.has(group)).map(group=>Dom.create("option",{text:`${ns.groupLabel(group)} · ${counts.get(group)}`,attributes:{value:group}}))];this.elements.group.replaceChildren(...options);this.elements.group.value=options.some(option=>option.value===selected)?selected:"all";}
    filter(){const term=this.elements.filter.value.trim().toLowerCase();this.filtered=this.visibleDocuments().filter(document=>!term||`${document.name} ${document.kind} ${document.source} ${document.metadata?.group||""} ${Object.values(document.metadata).join(" ")}`.toLowerCase().includes(term));this.renderList();this.select(0);}
    renderList(){this.elements.cue.replaceChildren(...this.filtered.map((document,index)=>Dom.create("option",{text:`${ns.kindLabel(document.kind)} · ${document.name}`,attributes:{value:index}})));}
    select(index){this.active=this.filtered[index]||null;if(!this.active){this.clear();return;}this.detail=this.driver.describe(this.active);this.elements.title.textContent=this.active.name;this.renderProperties();this.renderTracks();this.renderCommands();this.renderReferences();this.renderTimeline();this.elements.edit.disabled=!this.active.editable||typeof this.driver.edit!=="function";this.elements.play.disabled=!this.canAudition();this.elements.play.title=this.canAudition()?"Play parameter audition":"Native playback is unavailable for this decoded document";this.elements.status.textContent=`${ns.kindLabel(this.active.kind)} · ${this.detail.summary}`;}
    clear(){for(const key of ["properties","tracks","commands","references"])this.elements[key].replaceChildren();this.elements.title.textContent="Sound";this.elements.edit.disabled=true;this.elements.play.disabled=true;this.elements.status.textContent="No matching sound.";this.renderTimeline();}
    rows(values){return values.flatMap(([key,value])=>[Dom.create("dt",{text:key}),Dom.create("dd",{text:String(value)})]);}
    renderProperties(){const d=this.active;const species=d.metadata?.speciesId?[
      ["Pokémon",d.metadata.speciesName],
      [d.family==="gbc"?"Internal ID":"Species ID",`#${d.metadata.speciesId}`],
      ...(d.metadata.dexNumber?[["Pokédex",`#${d.metadata.dexNumber}`]]:[]),
      ...(d.metadata.isGlitch?[["Identity","Glitch / MissingNo. slot"]]:[]),
      ["Cry table",d.metadata.cryTable],
      ...(Number.isInteger(d.metadata.baseCry)?[
        ["Base cry",ns.hex(d.metadata.baseCry,d.family==="gen2"?4:2)],
        ["Pitch",ns.hex(d.metadata.pitch,d.family==="gen2"?4:2)],
        ["Length",ns.hex(d.metadata.length,d.family==="gen2"?4:2)]
      ]:[]),
      ...(Number.isInteger(d.metadata.cryId)?[["Cry ID",`#${d.metadata.cryId}`],["Tone type",ns.hex(d.metadata.type,2)],["Root key",String(d.metadata.key)],["Length",String(d.metadata.length)],["ADSR",`${d.metadata.attack}/${d.metadata.decay}/${d.metadata.sustain}/${d.metadata.release}`],["WaveData",ns.hex(d.metadata.waveOffset)]]:[])
    ]:[];this.elements.properties.replaceChildren(...this.rows([["Group",ns.groupLabel(d.metadata?.group)],["Type",ns.kindLabel(d.kind)],["Family",d.family.toUpperCase()],["Accuracy",d.accuracy],...species,["ROM offset",ns.hex(d.offset)],["Source",d.source],["Editable",d.editable?"Yes":"Read-only"]]));}
    renderTracks(){const tracks=this.detail.tracks||[];this.elements.tracks.replaceChildren(...(tracks.length?tracks.map(track=>Dom.create("li",{text:`Track ${track.index} · ${ns.hex(track.offset)} · ${track.commands.length} commands`})):[Dom.create("li",{text:"No verified track layout is available for this document."})]));}
    canAudition(){const metadata=this.active?.metadata||{};return this.active?.kind==="cry"&&(Number.isInteger(metadata.baseCry)||Number.isInteger(metadata.key));}
    play(){
      if(!this.canAudition())return false;
      try{
        const duration=PokemonViewer.pokedex.CryAudition.play({...this.active.metadata,family:this.active.family});
        this.elements.scrubber.max=String(Math.max(1,Math.round(duration*100)));this.elements.scrubber.value="0";this.elements.time.textContent=`0:${String(duration.toFixed(1)).padStart(4,"0")}`;
        const started=performance.now(),advance=now=>{const progress=Math.min(1,(now-started)/(duration*1000));this.elements.scrubber.value=String(Math.round(progress*Number(this.elements.scrubber.max)));if(progress<1)requestAnimationFrame(advance);};requestAnimationFrame(advance);
        return true;
      }catch(error){NotificationHandler.pop("Sound audition",error.message||String(error),NotificationType.ERROR);return false;}
    }
    renderTimeline(){
      const canvas=this.elements.timeline,context=canvas.getContext("2d"),tracks=this.detail?.tracks||[],commands=this.detail?.commands||[];
      context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle="#f8fafb";context.fillRect(0,0,canvas.width,canvas.height);
      context.font="700 20px Inter, system-ui, sans-serif";context.fillStyle="#6a7680";
      const lanes=Math.max(1,tracks.length||1),top=34,bottom=24,laneHeight=(canvas.height-top-bottom)/lanes,maxTick=Math.max(1,...commands.map(command=>Number(command.tick)||0));
      for(let lane=0;lane<lanes;lane++){const y=top+lane*laneHeight;context.fillStyle=lane%2?"#f2f6f8":"#ffffff";context.fillRect(0,y,canvas.width,laneHeight);context.strokeStyle="#d8e0e6";context.beginPath();context.moveTo(0,y+laneHeight);context.lineTo(canvas.width,y+laneHeight);context.stroke();context.fillStyle="#6a7680";context.fillText(tracks.length?`CH ${tracks[lane]?.index||lane+1}`:"PARAMETERS",16,y+28);}
      const source=tracks.length?tracks.flatMap((track,lane)=>track.commands.map(command=>({command,lane}))):commands.map(command=>({command,lane:0}));
      for(const {command,lane} of source){const x=150+(canvas.width-180)*(Number(command.tick)||0)/maxTick,y=top+lane*laneHeight+10,w=Math.max(14,Math.min(110,22+String(command.name).length*7));context.fillStyle=command.accuracy==="verified"?"#287fc5":"#9dce3c";context.fillRect(x,y,w,Math.max(22,laneHeight-20));context.fillStyle="#ffffff";context.font="700 15px ui-monospace, monospace";context.fillText(String(command.name).slice(0,12),x+7,y+20);}
      context.fillStyle="#24313d";context.font="800 17px Inter, system-ui, sans-serif";context.fillText(tracks.length?`${tracks.length} native channel${tracks.length===1?"":"s"}`:this.canAudition()?"Verified cry parameters":"No decoded channel timeline",16,23);
    }
    renderCommands(){const commands=this.detail.commands||[];this.elements.commands.replaceChildren(...(commands.length?commands.map(command=>Dom.create("tr",{},[Dom.create("td",{text:ns.hex(command.offset)}),Dom.create("td",{text:command.name}),Dom.create("td",{text:command.arguments.join(", ")||"—"}),Dom.create("td",{text:String(command.tick)})])):[Dom.create("tr",{},[Dom.create("td",{text:"No decoded commands",attributes:{colspan:"4"}})])]));}
    renderReferences(){this.elements.references.replaceChildren(...(this.active.references.length?this.active.references.map(ref=>Dom.create("li",{text:`${ref.type}: ${ref.label||ref.id}`})):[Dom.create("li",{text:"No linked game data recorded."})]));}
    async edit(){
      if(!this.active?.editable||typeof this.driver.edit!=="function")return;
      const resourceId=this.active.metadata?.resourceId,id=this.active.id;
      const values=await AppDialog.form({
        title:`Edit ${this.active.name}`,
        message:"This writes the exact three-byte CryData record. It does not modify or simulate the underlying audio channel streams.",
        fields:this.driver.editFields(this.active),submitLabel:"Apply cry"
      });
      if(!values||this.driver.edit(this.active,values,this.commands)===false)return;
      this.documents=this.driver.list();this.renderGroups();this.filtered=this.visibleDocuments();
      const index=this.filtered.findIndex(document=>document.metadata?.resourceId===resourceId||document.id===id);
      this.renderList();this.elements.cue.value=String(Math.max(0,index));this.select(Math.max(0,index));
    }
    open(request={}){this.elements.group.value="cry";const source=this.visibleDocuments(),species=Number(request.species),index=source.findIndex(document=>document.kind==="cry"&&(Number(document.metadata?.dexNumber)===species||Number(document.id)===species));this.filtered=source;this.elements.filter.value="";this.renderList();this.select(index<0?0:index);this.elements.cue.value=String(Math.max(0,index));return index>=0;}
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Sound history"});if(changed)this.reloadActive();return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Sound history"});if(changed)this.reloadActive();return changed;}
    reloadActive(){const resourceId=this.active?.metadata?.resourceId,id=this.active?.id;this.documents=this.driver.list();this.renderGroups();this.filtered=this.visibleDocuments();const index=this.filtered.findIndex(document=>document.metadata?.resourceId===resourceId||document.id===id);this.renderList();this.elements.cue.value=String(Math.max(0,index));this.select(Math.max(0,index));}
    destroy(){this.commands.destroy();this.scope.destroy();}
  }
  global.SoundEditor=SoundEditor;
})(globalThis);
