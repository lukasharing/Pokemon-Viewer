(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const ns=root.battle||(root.battle={});
  class BattleEditor {
    constructor(reader,driverId){
      this.reader=reader;this.generation=reader.projectGeneration;this.root=Dom.byId("battle_editor");this.scope=new EventScope();this.writeAccess=EditorCapabilityGuard.inspect(reader,"battle_editor");
      this.commands=EditorCapabilityGuard.protectCommands(reader,"battle_editor",reader.history("battle_editor",{label:"Battle Editor"}),{operation:"Editing battles"});this.driver=ns.registry.create(driverId,{reader});
      this.previews={
        trainer:new BattlePreview(Dom.byId("battle_trainer_canvas")),
        pokemon:new BattlePreview(Dom.byId("battle_canvas"))
      };
      this.canvasFits=Object.values(this.previews).map(preview=>PixelCanvas.fit(preview.canvas,{container:preview.canvas.closest(".battle-scene"),target:preview.canvas.closest(".battle-screen")}));
      this.preview=this.previews.pokemon;
      this.timeline=new BattleTimeline({scrubber:Dom.byId("battle_scrubber"),list:Dom.byId("battle_commands"),onFrame:frame=>this.render(frame)});
      this.elements={select:Dom.byId("battle_animation_select"),side:Dom.byId("battle_side"),environment:Dom.byId("battle_environment"),trainer:Dom.byId("battle_trainer_select"),party:Dom.byId("battle_party"),partySection:Dom.byId("battle_party")?.closest(".battle-party"),partyCount:Dom.byId("battle_party_count"),origin:Dom.byId("battle_open_map"),offset:Dom.byId("battle_offset"),props:Dom.byId("battle_properties"),status:Dom.byId("battle_status"),pokemonTitle:Dom.byId("battle_pokemon_scene_title"),trainerScene:Dom.byId("battle_trainer_canvas")?.closest(".battle-scene"),grid:Dom.byId("battle_grid"),play:Dom.byId("battle_play"),pause:Dom.byId("battle_pause"),prev:Dom.byId("battle_prev"),next:Dom.byId("battle_next")};
      const sidebar=this.root.querySelector(".battle-sidebar");
      this.panelTabs=UiPanelTabs.mount(sidebar,{label:"Battle information",selected:"source",items:[
        {id:"source",label:"Opponent",icon:"fa-user-group",panel:sidebar.querySelector(".battle-source-panel")},
        {id:"party",label:"Team",icon:"fa-paw",badge:this.elements.partyCount,panel:this.elements.partySection},
        {id:"engine",label:"Engine",icon:"fa-code",complexity:"advanced",panel:sidebar.querySelector(".battle-technical")}
      ]});
      this.trainerPicker=new UiVirtualSelect(this.elements.trainer,{placeholder:"Find a trainer",itemKey:item=>item.key??item.id,itemLabel:item=>item.name});
      this.sourceState=new ns.BattleSourceState({root:this.root,select:this.elements.trainer,picker:this.trainerPicker,trainerScene:this.elements.trainerScene});
      this.trainerRepository=new ns.BattleTrainerRepository(this.driver,reader);
      this.partyView=new ns.BattlePartyView({element:this.elements.party,section:this.elements.partySection,count:this.elements.partyCount,canPlayCry:()=>Boolean(this.reader.capabilities?.get("sound_editor")?.ordinary),onSelect:index=>this.selectOpponent(index),onEdit:(mon,index)=>this.editPartyMon(mon,index)});
      this.animations=[];this.trainers=[];this.active=null;this.activeTrainer=null;this.currentPartyIndex=0;this.scenePhase="battle";this.bind();this.load();
    }
    bind(){
      this.scope.listen(this.elements.select,"change",()=>this.select(Number(this.elements.select.value)||0));
      this.scope.listen(this.elements.side,"change",()=>this.render());
      for(const preview of Object.values(this.previews))this.scope.listen(preview.canvas,"click",event=>this.inspectElement(preview.hitTest(event),preview));
      this.scope.listen(this.elements.trainer,"change",()=>this.selectTrainer(this.elements.trainer.value));
      this.scope.listen(this.elements.play,"click",()=>this.play());
      this.scope.listen(this.elements.pause,"click",()=>this.pause());
      this.scope.listen(this.elements.prev,"click",()=>this.step(-1));
      this.scope.listen(this.elements.next,"click",()=>this.step(1));
      this.scope.listen(this.elements.grid,"click",()=>this.toggleGrid());
      this.scope.listen(this.elements.origin,"click",()=>this.openOriginMap());
      this.scope.listen(document,"romgraphicschange",()=>{this.renderParty();this.render();});
    }
    load(){
      for(const preview of Object.values(this.previews)){
        preview.setSize(this.driver.screen.width,this.driver.screen.height);
        const screen=preview.canvas.closest(".battle-screen");
        screen?.style.setProperty("--battle-ratio",String(this.driver.screen.width/this.driver.screen.height));
        if(screen)screen.style.aspectRatio=`${this.driver.screen.width} / ${this.driver.screen.height}`;
      }
      this.animations=this.driver.listAnimations();
      this.backgrounds=this.driver.listBackgrounds?.()||[];
      this.elements.select.replaceChildren(...this.animations.map((item,index)=>Dom.create("option",{attributes:{value:String(index)},text:item.name})));
      this.root.classList.toggle("battle-editor--compact-static",Boolean(this.driver.compactStatic));this.select(0);
      this.elements.status.textContent="Battle scene ready · loading trainer index…";
      this.renderParty();this.loadTrainerCatalog();
    }
    async loadTrainerCatalog(){
      try{
        const trainers=await this.trainerRepository.load();
        if(!this.reader.isProjectGeneration(this.generation)||this.destroyed)return;
        this.trainers=trainers;this.trainerPicker.setItems(trainers);
        if(this.sourceState.isWild)return;
        if(this.activeTrainer){this.syncTrainerPicker(this.activeTrainer);return;}
        const first=trainers[0];
        if(first)this.trainerPicker.choose(first.key??first.id,first.name);
        else this.elements.status.textContent="No trainer records were found for this ROM profile.";
      }catch(error){if(error?.name!=="AbortError")this.elements.status.textContent=`Trainer index unavailable: ${error.message}`;}
    }
    trainerKey(trainer){return String(trainer?.key??trainer?.id??`${trainer?.classId}:${trainer?.number}`);}
    syncTrainerPicker(trainer){
      const key=this.trainerKey(trainer),known=this.trainers.some(item=>this.trainerKey(item)===key);
      if(!known){this.trainers.push({key,id:trainer.id,classId:trainer.classId,number:trainer.number,name:trainer.name});this.trainerPicker.setItems(this.trainers);}
      this.trainerPicker.choose(key,trainer.name,false);
    }
    activate(){this.canvasFits.forEach(fit=>fit.refresh());this.render();this.root.editorHeader?.render();}
    openTrainer(reference){
      const trainer=this.driver.resolveTrainer?.(reference);if(!trainer){this.elements.status.textContent="This event has no resolved trainer party in this ROM profile.";return false;}
      this.sourceState.trainer();
      this.activeTrainer=trainer;this.currentPartyIndex=0;this.scenePhase="intro";this.originMap=trainer.mapReference||reference?.mapReference||null;this.elements.origin.hidden=!this.originMap;this.syncTrainerPicker(trainer);
      this.renderParty();this.render();return true;
    }
    openEncounter(reference){
      const trainer=this.driver.encounter?.(reference);if(!trainer){this.elements.status.textContent="This encounter species has no verified battle sprite in this ROM.";return false;}
      this.sourceState.wild(trainer.party?.[0]?.speciesName||trainer.name);
      this.activeTrainer=trainer;this.currentPartyIndex=0;this.scenePhase="battle";this.originMap=reference?.mapReference||null;this.elements.origin.hidden=!this.originMap;
      this.renderParty();this.render();return true;
    }
    selectTrainer(value){
      if(value==="__encounter__")return;
      this.sourceState.trainer();
      let selected=null;
      try{selected=value===""?null:this.trainerRepository.resolve(value);}catch(error){this.elements.status.textContent=`Trainer could not be read: ${error.message}`;return;}
      this.activeTrainer=selected;this.currentPartyIndex=0;this.scenePhase=this.activeTrainer?.encounter?"battle":"intro";
      this.originMap=this.activeTrainer?.mapReference||null;this.elements.origin.hidden=!this.originMap;
      this.renderParty();this.render();
    }
    renderParty(){
      this.partyView.render(this.activeTrainer,this.currentPartyIndex,{editable:Boolean(this.writeAccess.writable&&this.activeTrainer?.editable&&this.driver.editPartyMon)});
    }
    selectOpponent(index){if(!this.activeTrainer?.party?.[index])return false;this.currentPartyIndex=index;this.scenePhase="battle";this.renderParty();this.render();return true;}
    openOriginMap(){
      if(!this.originMap)return false;
      EditorLinks.map(this.originMap);return true;
    }
    async editPartyMon(mon,index){
      EditorCapabilityGuard.requireWritable(this.reader,"battle_editor","Editing an opponent party");
      const species=this.driver.speciesField?.()||{label:"Species ID",max:1025};
      const fields=this.driver.partyEditFields?.(this.activeTrainer,mon,index)||[
        {name:"species",label:species.label,type:"number",value:mon.species,min:1,max:species.max},
        {name:"level",label:"Level",type:"number",value:mon.level,min:1,max:100}
      ];
      const values=await AppDialog.form({
        title:`Edit opponent #${index+1}`,
        message:this.driver.partyEditMessage?.(this.activeTrainer,mon,index)||"This writes only the existing party record and is undoable.",
        fields,submitLabel:"Apply changes"
      });
      if(!values)return;this.driver.editPartyMon(this.activeTrainer,index,values,this.commands);this.activeTrainer=this.driver.resolveTrainer(this.activeTrainer);this.renderParty();this.render();
    }
    select(index){
      this.active=this.animations[index]||null;
      if(!this.active){this.elements.status.textContent="No battle animation tables were detected.";return;}
      this.elements.offset.value=this.active.offset==null?"":"0x"+this.active.offset.toString(16).toUpperCase().padStart(6,"0");
      this.timeline.set(this.active);this.properties();this.render();this.root.dispatchEvent(new CustomEvent("battleviewchange"));
    }
    properties(){
      const rows=[["Profile",this.driver.label],["Screen",`${this.driver.screen.width}×${this.driver.screen.height}`],["Commands",String(this.active.commands.length)],["Frames",String(this.active.frames.length)]];
      if(this.active.offset!=null)rows.push(["Animation Offset",`0x${this.active.offset.toString(16).toUpperCase()}`]);
      for(const item of this.active.properties||[])rows.push([item.label,item.value]);
      this.elements.props.replaceChildren(...rows.flatMap(([key,value])=>[Dom.create("dt",{text:key}),Dom.create("dd",{text:String(value)})]));
    }
    scene(phase="battle"){return this.driver.scene({animation:this.active,side:this.elements.side.value,phase,trainer:this.activeTrainer,opponent:this.activeTrainer?.party?.[this.currentPartyIndex]||null});}
    render(frame=this.timeline.frames[this.timeline.index]||{}){
      const trainerScene=this.sourceState.isWild?null:this.scene("intro"),scene=this.scene("battle"),environment=this.activeTrainer?.environment||this.activeTrainer?.mapReference?.battleEnvironment;
      if(this.elements.environment){
        const resolved=environment||scene.environment;
        this.elements.environment.textContent=resolved?`${resolved.label} · ${resolved.reason}`:this.backgrounds.length===1?`${this.backgrounds[0].label} · native engine layout`:"Unresolved · open this battle from a map event";
      }
      if(trainerScene)this.previews.trainer.render(trainerScene,{});
      else this.previews.trainer.select(null);
      this.previews.pokemon.render(scene,frame);
      const trainer=this.activeTrainer?` · ${this.activeTrainer.name}`:"",background=scene.backgroundLabel?` · ${scene.backgroundLabel} background from ROM`:"",opponent=this.activeTrainer?.party?.[this.currentPartyIndex];
      if(this.elements.pokemonTitle)this.elements.pokemonTitle.textContent=opponent?.speciesName||"Pokémon";
      this.elements.status.textContent=scene.verified===false?(scene.reason||"Battle scene unavailable"):this.driver.compactStatic?`${opponent?.speciesName||"Pokémon"} · exact ROM front and back pictures${background}`:`${this.active?.name||"Battle"}${trainer}${background} · frame ${this.timeline.index+1}/${Math.max(1,this.timeline.frames.length)}`;
    }
    play(){this.timeline.play();this.root.dispatchEvent(new CustomEvent("battleviewchange"));}
    pause(){this.timeline.pause();this.root.dispatchEvent(new CustomEvent("battleviewchange"));}
    step(delta){this.timeline.step(delta);}
    canPlay(){return (this.timeline.frames?.length||0)>1;}
    toggleGrid(){const result=!this.previews.pokemon.grid;for(const preview of Object.values(this.previews))preview.grid=result;this.elements.grid?.classList.toggle("is-active",result);this.elements.grid?.setAttribute("aria-pressed",String(result));this.render();this.root.dispatchEvent(new CustomEvent("battleviewchange"));return result;}
    isGridVisible(){return this.preview.grid;}
    activeAnimation(){return this.active;}
    activeSprite(side="front"){const opponent=this.activeTrainer?.party?.[this.currentPartyIndex];return(opponent&&this.driver.battleSpriteSource?.(opponent.species,side))||this.active?.sprite||this.driver.defaultSprite?.();}
    spriteDetail(species,activeSide="front"){
      const front=this.driver.battleSpriteSource?.(species,"front"),back=this.driver.battleSpriteSource?.(species,"back"),opponent=this.activeTrainer?.party?.[this.currentPartyIndex];
      if(front&&back)return{workspace:"sprite_editor",title:opponent?.speciesName||`Species ${species}`,views:[{...front,label:"Front"},{...back,label:"Back"}],activeView:activeSide==="back"?1:0};
      const source=activeSide==="back"?back||front:front||back;return source?{workspace:"sprite_editor",...source}:null;
    }
    scenePreview(sourcePreview){
      if(!sourcePreview?.scene||!sourcePreview.canvas)return null;
      const canvas=PixelCanvas.create(sourcePreview.canvas.width,sourcePreview.canvas.height);
      const preview=new BattlePreview(canvas),frame=this.timeline.frames[this.timeline.index]||{};
      preview.setSize(canvas.width,canvas.height);preview.render(sourcePreview.scene,frame);
      return canvas;
    }
    spriteLinkDetail(element,sourcePreview=null){
      if(!element?.resource)return null;
      return element.kind==="pokemon"
        ?this.spriteDetail(element.species,element.side)
        :{workspace:"sprite_editor",...element.resource,previewCanvas:this.scenePreview(sourcePreview)||element.resource.previewCanvas||null};
    }
    openSpriteLink(element,sourcePreview=null){
      const detail=this.spriteLinkDetail(element,sourcePreview);
      if(!detail)throw new Error(`${element?.label||"This battle element"} has no renderable sprite source.`);
      EditorLinks.open(detail);return detail;
    }
    openCode(){if(this.active?.offset!=null)EditorLinks.code(this.active.offset,{view:"original"});}
    openSprite(){
      const opponent=this.activeTrainer?.party?.[this.currentPartyIndex],single=this.activeSprite(),detail=opponent?this.spriteDetail(opponent.species,"front"):single?{workspace:"sprite_editor",...single}:null;if(!detail)return;
      EditorLinks.open(detail);
    }
    inspectElement(element,sourcePreview=this.preview){
      if(!element)return;for(const preview of Object.values(this.previews))preview.select(preview===sourcePreview?element.id:null);this.render();
      if(!this.inspector){const host=Dom.create("section",{className:"battle-element-window hide"});this.root.querySelector(".battle-stage").append(host);this.inspector=new UiWindow({element:host,title:"Battle element",icon:"fa-crosshairs",minimizable:false,maximizable:false,closable:true});}
      const values={Type:element.kind,Name:element.label};if(element.species!=null)values.Species=element.species;if(element.side)values.Side=element.side;if(element.trainerClass!=null)values["Trainer class"]=element.trainerClass;if(element.trainerPic!=null)values["Trainer picture"]=element.trainerPic;if(Number.isInteger(element.resource?.offset))values["ROM offset"]=`0x${element.resource.offset.toString(16).toUpperCase()}`;if(Number.isInteger(element.resource?.paletteOffset))values["Palette offset"]=`0x${element.resource.paletteOffset.toString(16).toUpperCase()}`;if(element.resource?.sourceEncoding)values.Encoding=element.resource.sourceEncoding;
      const actions=[];
      if(element.resource)actions.push(UiWindow.button("Open in Sprite Editor",{icon:"fa-image",onClick:()=>this.openSpriteLink(element,sourcePreview)}));
      if(element.species!=null)actions.push(UiWindow.button("Open in Pokédex",{icon:"fa-book-open",onClick:()=>EditorLinks.species(element.species)}));
      this.inspector.setTitle(element.label).setContent([UiWindow.properties(values),Dom.create("div",{className:"battle-element-actions"},actions)]).show();
    }
    undo(){return EditUtils.history(this.commands,"undo",{title:"Battle history"});}
    redo(){return EditUtils.history(this.commands,"redo",{title:"Battle history"});}
    destroy(){this.destroyed=true;this.panelTabs.destroy();this.canvasFits.forEach(fit=>fit.destroy());this.trainerRepository.destroy();this.trainerPicker.destroy();this.commands.destroy();this.scope.destroy();this.timeline.destroy();}
  }
  global.BattleEditor=BattleEditor;
})(globalThis);
