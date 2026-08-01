(function(global){
  "use strict";
  class PokedexEditor{
    constructor(reader,driverId){
      this.reader=reader;
      this.root=Dom.byId("pokedex_editor");
      this.scope=new EventScope();
      this.pipeline=new EditorRenderPipeline({name:"pokedex",onError:error=>NotificationHandler.error("Pokédex related data",error)});
      this.cryCache=new Map();
      this.writeAccess=EditorCapabilityGuard.inspect(reader,"pokedex_editor");
      this.commands=EditorCapabilityGuard.protectCommands(reader,"pokedex_editor",reader.history("pokedex_editor",{label:"Pokédex Editor"}),{operation:"Editing Pokédex data"});
      this.driver=PokemonViewer.pokedex.registry.create(driverId,{reader});
      this.elements={
        species:Dom.byId("pokedex_species"),side:Dom.byId("pokedex_sprite_side"),sideField:Dom.byId("pokedex_sprite_side_field"),canvas:Dom.byId("pokedex_canvas"),miniature:Dom.byId("pokedex_miniature"),miniatureWrap:Dom.byId("pokedex_miniature_wrap"),footprint:Dom.byId("pokedex_footprint"),footprintWrap:Dom.byId("pokedex_footprint_wrap"),properties:Dom.byId("pokedex_properties"),
        title:Dom.byId("pokedex_title"),description:Dom.byId("pokedex_description"),status:Dom.byId("pokedex_status"),cryTitle:Dom.byId("pokedex_cry_title"),cryDetail:Dom.byId("pokedex_cry_detail"),cryPlay:Dom.byId("pokedex_cry_play"),
        evolution:Dom.byId("pokedex_evolution_line"),machineList:Dom.byId("pokedex_machine_list"),learnsetList:Dom.byId("pokedex_learnset_list"),machineInlineEdit:Dom.byId("pokedex_machine_inline_edit"),
        edit:Dom.byId("pokedex_edit"),base:Dom.byId("pokedex_base"),progression:Dom.byId("pokedex_progression"),cry:Dom.byId("pokedex_cry"),text:Dom.byId("pokedex_text"),sprite:Dom.byId("pokedex_sprite"),animation:Dom.byId("pokedex_animation"),sound:Dom.byId("pokedex_sound")
      };
      const entries=this.driver.list();
      this.elements.species.replaceChildren(...entries.map(item=>Dom.create("option",{text:item.label||item.name,attributes:{value:item.id}})));
      const sides=this.driver.spriteSides?.()||[{id:"front",label:"Front sprite"}];
      this.elements.side.replaceChildren(...sides.map(item=>Dom.create("option",{text:item.label,attributes:{value:item.id}})));
      this.elements.sideField.hidden=sides.length<2;
      this.scope.listen(this.elements.species,"change",()=>this.open(Number(this.elements.species.value)));
      this.scope.listen(this.elements.side,"change",()=>this.open(this.current?.id));
      this.scope.listen(this.elements.edit,"click",()=>this.edit());
      this.scope.listen(this.elements.base,"click",()=>this.editBase());
      this.scope.listen(this.elements.machineInlineEdit,"click",()=>this.editMachines());
      this.scope.listen(this.elements.evolution,"click",event=>{const button=event.target.closest("[data-species-id]");if(button)this.open(Number(button.dataset.speciesId));});
      this.scope.listen(this.elements.machineList,"click",event=>{
        const remove=event.target.closest("[data-machine-remove]");
        if(remove){this.removeMachine(Number(remove.dataset.machineRemove),remove.dataset.machineLabel);return;}
        const sprite=event.target.closest("[data-machine-sprite]");
        if(sprite){EditorLinks.optional({workspace:"sprite_editor",group:"items",sprite:Number(sprite.dataset.machineSprite)});return;}
        const button=event.target.closest("[data-move-id]");if(button)this.openMove(Number(button.dataset.moveId));
      });
      this.scope.listen(this.elements.learnsetList,"click",event=>{const button=event.target.closest("[data-move-id]");if(button)EditorLinks.move(button.dataset.moveId);});
      this.scope.listen(this.elements.miniatureWrap,"click",()=>this.openAsset(this.driver.icon?.(this.current?.id),`${this.current?.name} icon`));
      this.scope.listen(this.elements.footprintWrap,"click",()=>this.openAsset(this.driver.footprint?.(this.current?.id),`${this.current?.name} footprint`));
      this.scope.listen(this.elements.progression,"click",()=>this.editProgression());
      this.scope.listen(this.elements.cry,"click",()=>this.editCry());
      this.scope.listen(this.elements.cryPlay,"click",()=>this.auditionCry());
      this.scope.listen(this.elements.text,"click",()=>this.openText());
      this.scope.listen(this.elements.sprite,"click",()=>this.openSprite());
      this.scope.listen(this.elements.animation,"click",()=>EditorLinks.animation({species:this.current?.id}));
      this.scope.listen(this.elements.sound,"click",()=>this.openSound());
      if(entries.length)this.open(entries[0].id);
      else this.elements.status.textContent="No Pokédex entries are available for this ROM profile.";
    }
    open(id){
      const ticket=this.pipeline.begin(`species:${id}`);
      const document=this.driver.read(Number(id));
      if(!document){
        NotificationHandler.pop("Pokédex",`Species ${String(id)} is not valid for this ROM profile.`,NotificationType.ERROR);
        return false;
      }
      this.current=document;
      this.elements.species.value=String(id);
      this.elements.title.textContent=this.current.name;
      this.elements.description.textContent=this.current.description||"No description could be decoded.";
      const offset=Number.isInteger(this.current.offset)?`0x${this.current.offset.toString(16).toUpperCase()}`:"Unavailable";
      const rows=this.driver.properties?.(this.current)||[
        ["Category",this.current.category||"Unavailable"],
        ["Height",Number.isFinite(this.current.height)?`${this.current.height/10} m`:"Unavailable"],
        ["Weight",Number.isFinite(this.current.weight)?`${this.current.weight/10} kg`:"Unavailable"],
        ["Entry offset",offset]
      ];
      this.elements.properties.replaceChildren(...rows.flatMap(([key,value])=>{
        const attributes=this.technicalAttributes(key);return[Dom.create("dt",{attributes},UiWindow.key(key)),Dom.create("dd",{text:String(value),attributes})];
      }));
      const hasSprite=this.renderSprite({accessories:false});
      this.renderRelatedLoading();
      this.elements.edit.disabled=!this.writeAccess.writable||this.driver.editable===false||this.driver.canEditEntry?.(this.current)===false;
      this.elements.base.disabled=!this.writeAccess.writable||typeof this.driver.baseFields!=="function"||this.driver.editable===false;
      this.elements.progression.disabled=!this.writeAccess.writable||typeof this.driver.progressionFields!=="function"||this.driver.editable===false;
      this.elements.cry.disabled=!this.writeAccess.writable||typeof this.driver.cryFields!=="function"||this.driver.editable===false;
      this.elements.cryPlay.disabled=true;
      this.elements.text.disabled=!Number.isInteger(this.current.descriptionOffset);
      this.elements.sprite.disabled=!hasSprite;
      this.elements.animation.disabled=this.reader.type!=="emerald";
      this.elements.sound.disabled=!Number.isInteger(this.current.id)||!this.reader.capabilities?.get("sound_editor")?.ordinary;
      this.elements.status.textContent=hasSprite
        ?`${this.current.name} · native ${this.elements.side.value==="back"?"back":"front"} sprite preview`
        :`${this.current.name} · sprite table unavailable for this profile`;
      this.root.dispatchEvent(new CustomEvent("pokedexviewchange"));
      this.pipeline.run(ticket,()=>{
        this.renderAccessories();this.renderCry();this.elements.cryPlay.disabled=!this.cryAudition();
      },{schedule:"paint",phase:"cry"});
      this.pipeline.run(ticket,()=>this.renderEvolutionLine(),{schedule:"idle",phase:"evolutions"});
      this.pipeline.run(ticket,()=>{this.renderMachines();this.renderLearnset();},{schedule:"idle",phase:"moves"});
      return true;
    }
    renderRelatedLoading(){
      const loading=()=>UiLoading.create("Loading related data");
      this.elements.evolution.replaceChildren(loading());this.elements.machineList.replaceChildren(loading());this.elements.learnsetList.replaceChildren(loading());
      this.elements.cryTitle.replaceChildren(UiLoading.create("Loading cry",{compact:true}));this.elements.cryDetail.textContent="";
    }
    technicalAttributes(key){return /\b(id|offset|pointer|address|record|resource|internal|cry table)\b/i.test(key)?{"data-complexity":"advanced"}:{};}
    requireWritable(operation){return EditorCapabilityGuard.requireWritable(this.reader,"pokedex_editor",operation);}
    cryAudition(){
      const id=this.current?.id;if(!Number.isInteger(id))return null;
      if(!this.cryCache.has(id))this.cryCache.set(id,this.driver.cryAudition?.(this.current)||this.current?.cry||null);
      return this.cryCache.get(id);
    }
    renderCry(){
      const cry=this.cryAudition();
      const native=Boolean(cry?.waveform?.native);
      this.elements.cryTitle.textContent=native?"Native ROM cry":cry?"Cry parameter audition":"No verified cry parameters";
      this.elements.cryDetail.textContent=cry
        ?native
          ?"Plays this species’ signed WaveData samples with its ROM key and envelope. It is the native waveform, without the complete console mixer."
          :"Audition uses this ROM record’s base, pitch and length parameters. It is an audible parameter cue, not a replacement for the console audio engine."
        :"This ROM profile has no verified cry-parameter record available for this species.";
    }
    auditionCry(){
      const cry=this.cryAudition();if(!cry)return;
      try{const duration=PokemonViewer.pokedex.CryAudition.play({...cry,family:this.reader.family});this.elements.status.textContent=`${this.current.name} · ${cry.waveform?.native?"native ROM cry":"cry parameter audition"} (${duration.toFixed(2)} s)`;}
      catch(error){NotificationHandler.error("Cry audition",error);}
    }
    evolutionComponent(id){
      const edges=this.driver.evolutionEdges?.()||[],adjacent=new Map(),add=(a,b)=>{if(!adjacent.has(a))adjacent.set(a,new Set());adjacent.get(a).add(b);};
      for(const edge of edges){add(edge.from,edge.to);add(edge.to,edge.from);}
      const ids=new Set([id]),queue=[id];
      while(queue.length){const current=queue.shift();for(const next of adjacent.get(current)||[])if(!ids.has(next)){ids.add(next);queue.push(next);}}
      const familyEdges=edges.filter(edge=>ids.has(edge.from)&&ids.has(edge.to)),incoming=new Map([...ids].map(value=>[value,0]));
      familyEdges.forEach(edge=>incoming.set(edge.to,(incoming.get(edge.to)||0)+1));
      const ranks=new Map(),roots=[...ids].filter(value=>incoming.get(value)===0);
      const work=(roots.length?roots:[id]).map(value=>(ranks.set(value,0),value));
      while(work.length){const from=work.shift(),rank=ranks.get(from);for(const edge of familyEdges.filter(value=>value.from===from)){if(!ranks.has(edge.to)||ranks.get(edge.to)<rank+1){ranks.set(edge.to,rank+1);work.push(edge.to);}}}
      for(const value of ids)if(!ranks.has(value))ranks.set(value,0);
      return{edges:familyEdges,tiers:[...new Set(ranks.values())].sort((a,b)=>a-b).map(rank=>[...ids].filter(value=>ranks.get(value)===rank)),ranks};
    }
    renderEvolutionLine(){
      const target=this.elements.evolution;if(!target)return;
      const family=this.evolutionComponent(this.current.id),entries=new Map(this.driver.list().map(item=>[item.id,item]));
      const nodes=[];
      family.tiers.forEach((tier,index)=>{
        if(index){
          const previous=new Set(family.tiers[index-1]),current=new Set(tier),labels=[...new Set(family.edges.filter(edge=>previous.has(edge.from)&&current.has(edge.to)).map(edge=>edge.label))];
          nodes.push(Dom.create("div",{className:"pokedex-evolution-arrow"},[Dom.create("span",{text:"→"}),Dom.create("small",{text:labels.join(" · ")||"Evolves"})]));
        }
        const group=Dom.create("div",{className:"pokedex-evolution-tier"});
        for(const id of tier){
          const item=entries.get(id),name=item?.name?.replace(/^\d+\s*·\s*/,"")||`Species ${id}`;
          let source=null;try{source=this.driver.icon?.(id)||this.driver.sprite(id,"front");}catch(error){console.warn("Evolution sprite preview failed",{id,error});}
          const preview=source?.canvas?PixelCanvas.copy(source.canvas,{label:`${name} native icon`}):UiWindow.icon("fa-paw");
          group.append(UiResourceCard.create({
            className:"pokedex-evolution-card",preview,title:name,current:id===this.current.id,
            actions:[{
              label:`View ${name} in Pokédex`,icon:"fa-eye",className:"ui-resource-card__action--view",
              disabled:id===this.current.id,attributes:{"data-species-id":id}
            }]
          }));
        }
        nodes.push(group);
      });
      target.replaceChildren(...nodes);
    }
    renderMachines(){
      const target=this.elements.machineList;if(!target)return;
      const machines=this.driver.machineDocuments?.(this.current)||this.current.machines||[];
      const editable=this.writeAccess.writable&&typeof this.driver.machineFields==="function"&&this.driver.editable!==false;
      target.replaceChildren(...(machines.length?machines.map(machine=>{
        const moveName=machine.name||machine.move?.name||`Move ${machine.moveId}`;
        const graphic=machine.previewCanvas
          ?PixelCanvas.copy(machine.previewCanvas,{className:"pokedex-machine__art",label:`${machine.label} native item icon`})
          :UiWindow.icon("fa-compact-disc");
        return UiResourceCard.create({
          className:"pokedex-machine",preview:graphic,eyebrow:machine.label,title:moveName,
          actions:[
            {label:`View ${moveName} in Move Editor`,icon:"fa-eye",className:"ui-resource-card__action--view",attributes:{"data-move-id":machine.moveId}},
            ...(Number.isInteger(machine.itemId)?[{label:`Edit ${machine.label} item sprite`,icon:"fa-pen",attributes:{"data-machine-sprite":machine.itemId}}]:[]),
            {label:`Remove ${machine.label} compatibility`,icon:"fa-trash-can",className:"ui-resource-card__action--danger",disabled:!editable,attributes:{"data-machine-remove":machine.index,"data-machine-label":machine.label}}
          ]
        });
      }):[Dom.create("p",{className:"pokedex-empty",text:"This species cannot learn any TM/HM moves in the loaded ROM."})]));
      this.elements.machineInlineEdit.disabled=!this.writeAccess.writable||typeof this.driver.machineFields!=="function"||this.driver.editable===false;
    }
    renderLearnset(){
      const target=this.elements.learnsetList;if(!target)return;
      const moves=this.driver.levelUpMoves?.(this.current)||this.current?.learnset||[];
      target.replaceChildren(...(moves.length?moves.map(move=>Dom.create("button",{className:"pokedex-learnset",attributes:{type:"button","data-move-id":move.moveId,title:`Open ${move.name||`move ${move.moveId}`} in Move Editor`}},[
        Dom.create("small",{text:`Lv ${move.level}`}),Dom.create("strong",{text:move.name||`Move ${move.moveId}`}),UiWindow.icon("fa-arrow-up-right-from-square")
      ])):[Dom.create("p",{className:"pokedex-empty",text:"No verified level-up moves are available for this species in the loaded ROM."})]));
    }
    renderSprite({accessories=true}={}){
      const ctx=PixelCanvas.context(this.elements.canvas);
      ctx.clearRect(0,0,this.elements.canvas.width,this.elements.canvas.height);
      const source=this.driver.sprite(this.current.id,this.elements.side.value);
      if(!source?.canvas){this.renderMiniature(null);this.renderFootprint(null);return false;}
      const width=source.width||source.canvas.width,height=source.height||source.canvas.height;
      this.elements.canvas.width=width;this.elements.canvas.height=height;
      PixelCanvas.draw(this.elements.canvas,source.canvas,{width,height});
      if(accessories)this.renderAccessories();else{this.elements.miniatureWrap.hidden=true;this.elements.footprintWrap.hidden=true;}
      return true;
    }
    renderAccessories(){
      this.renderMiniature(this.driver.icon?.(this.current.id)||null);
      this.renderFootprint(this.driver.footprint?.(this.current.id)||null);
    }
    renderMiniature(icon){
      const miniature=this.elements.miniature,context=PixelCanvas.context(miniature);
      context.clearRect(0,0,miniature.width,miniature.height);
      this.elements.miniatureWrap.hidden=!icon?.canvas;
      if(!icon?.canvas)return;
      miniature.width=icon.width;miniature.height=icon.height;PixelCanvas.draw(miniature,icon.canvas);
    }
    renderFootprint(footprint){
      const canvas=this.elements.footprint,wrap=this.elements.footprintWrap;if(!canvas||!wrap)return;
      const context=PixelCanvas.context(canvas);context.clearRect(0,0,canvas.width,canvas.height);wrap.hidden=!footprint?.canvas;
      if(!footprint?.canvas)return;
      canvas.width=footprint.width;canvas.height=footprint.height;PixelCanvas.draw(canvas,footprint.canvas);
    }
    async edit(){
      if(this.driver.editable===false){this.elements.status.textContent="This ROM profile is currently read-only.";return;}
      this.requireWritable("Editing a Pokédex entry");
      const fields=this.driver.editFields?.(this.current)||[
        {name:"height",label:"Height (dm)",type:"number",value:this.current.height,min:0,max:65535},
        {name:"weight",label:"Weight (hg)",type:"number",value:this.current.weight,min:0,max:65535}
      ];
      const values=await AppDialog.form({
        title:`Edit ${this.current.name}`,
        message:this.driver.editMessage?.(this.current)||"Height and weight use the ROM's native decimetre and hectogram units.",
        fields,submitLabel:"Apply entry"
      });
      if(values&&this.driver.edit(this.current,values,this.commands)!==false)this.open(this.current.id);
    }
    async editMachines(){
      if(!this.current||typeof this.driver.machineFields!=="function"||this.driver.editable===false)return;
      this.requireWritable("Editing TM/HM compatibility");
      const values=await AppDialog.form({
        title:`TM/HM compatibility · ${this.current.name}`,
        message:this.driver.machineMessage?.(this.current)||"Select the machines this species may learn. Bits outside the verified compatibility range are preserved exactly.",
        fields:this.driver.machineFields(this.current),submitLabel:"Apply compatibility"
      });
      if(values&&this.driver.editMachines(this.current,values,this.commands)!==false)this.open(this.current.id);
    }
    async removeMachine(index,label="this machine"){
      if(!this.current||!Number.isInteger(index)||typeof this.driver.machineFields!=="function"||this.driver.editable===false)return;
      this.requireWritable("Removing TM/HM compatibility");
      const confirmed=await AppDialog.confirm({
        title:`Remove ${label}?`,
        message:`${this.current.name} will no longer be compatible with ${label}.`,
        detail:"The change only updates this species’ verified TM/HM compatibility bits and can be undone.",
        confirmLabel:"Remove compatibility",cancelLabel:"Keep",danger:true
      });
      if(!confirmed)return;
      const values=Object.fromEntries(this.driver.machineFields(this.current).map(field=>[field.name,field.value]));
      values[`machine_${index}`]=false;
      if(this.driver.editMachines(this.current,values,this.commands)!==false)this.open(this.current.id);
    }
    async editBase(){
      if(!this.current||typeof this.driver.baseFields!=="function"||this.driver.editable===false)return;
      this.requireWritable("Editing Pokémon base data");
      const values=await AppDialog.form({
        title:`Base data · ${this.current.name}`,
        message:this.driver.baseMessage?.(this.current)||"Only verified semantic fields are exposed; opaque bytes and unmodeled references are preserved.",
        fields:this.driver.baseFields(this.current),submitLabel:"Apply base data"
      });
      if(values&&this.driver.editBase(this.current,values,this.commands)!==false)this.open(this.current.id);
    }
    async editProgression(){
      if(!this.current||typeof this.driver.progressionFields!=="function"||this.driver.editable===false)return;
      this.requireWritable("Editing Pokémon progression");
      const values=await AppDialog.form({
        title:`Progression · ${this.current.name}`,
        message:this.driver.progressionMessage?.(this.current)||"Edit evolutions and learned moves using one entry per line.",
        fields:this.driver.progressionFields(this.current),submitLabel:"Apply progression"
      });
      if(values&&this.driver.editProgression(this.current,values,this.commands)!==false)this.open(this.current.id);
    }
    async editCry(){
      if(!this.current||typeof this.driver.cryFields!=="function"||this.driver.editable===false)return;
      this.requireWritable("Editing Pokémon cry data");
      const values=await AppDialog.form({
        title:`Cry parameters · ${this.current.name}`,
        message:"This writes the exact CryData base, pitch and length bytes. Audio channel streams are unchanged.",
        fields:this.driver.cryFields(this.current),submitLabel:"Apply cry"
      });
      if(values&&this.driver.editCry(this.current,values,this.commands)!==false){this.cryCache.delete(this.current.id);this.open(this.current.id);}
    }
    openText(){if(Number.isInteger(this.current?.descriptionOffset))EditorLinks.code(this.current.descriptionOffset,{view:"script",scriptKind:"text"});}
    openMove(move){if(Number.isInteger(move)&&move>0)EditorLinks.move(move);}
    openAsset(source,title){
      if(!source)return;
      EditorLinks.open({
        workspace:"sprite_editor",...source,
        offset:source.offset??source.graphicOffset??0,
        editable:source.bytes instanceof Uint8Array,
        previewCanvas:source.canvas,
        title:source.title||title
      });
    }
    openSprite(){
      const source=this.driver.sprite(this.current.id,this.elements.side.value);if(!source)return;
      const detail=source.bytes instanceof Uint8Array
        ?{workspace:"sprite_editor",...source}
        :{workspace:"sprite_editor",offset:source.graphic,title:`${this.current.name} front sprite (LZ77)`};
      EditorLinks.open(detail);
    }
    openSound(){EditorLinks.sound(this.current?.id);}
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Pokédex history"});if(changed&&this.current)this.open(this.current.id);return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Pokédex history"});if(changed&&this.current)this.open(this.current.id);return changed;}
    destroy(){this.pipeline.destroy();this.commands.destroy();this.scope.destroy();}
  }
  global.PokedexEditor=PokedexEditor;
})(globalThis);
