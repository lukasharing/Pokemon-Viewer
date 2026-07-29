(function(global){
  "use strict";
  const MODULE_PATH="/node_modules/@thenick775/mgba-wasm/dist/mgba.js";
  const DIST_PATH="/node_modules/@thenick775/mgba-wasm/dist/";
  const KEY_MAP=Object.freeze(new Map([
    ["ArrowUp","Up"],["ArrowDown","Down"],["ArrowLeft","Left"],["ArrowRight","Right"],
    ["KeyZ","A"],["KeyX","B"],["KeyA","L"],["KeyS","R"],["Enter","Start"],["Backspace","Select"]
  ]));

  class ProjectEmulator{
    constructor(reader){
      this.reader=reader;this.root=Dom.byId("emulator_dock");this.canvas=Dom.byId("emulator");this.scope=new EventScope();this.destroyed=false;this.inputActive=false;this.windowState="normal";this.windowPosition=null;
      this.elements={
        header:this.root.querySelector(".emulator-header"),play:Dom.byId("emulator_play"),pause:Dom.byId("emulator_pause"),restart:Dom.byId("emulator_restart"),
        save:Dom.byId("emulator_save"),input:Dom.byId("emulator_save_input"),props:Dom.byId("emulator_properties"),status:Dom.byId("emulator_status"),
        minimize:Dom.byId("emulator_minimize"),fullscreen:Dom.byId("emulator_fullscreen"),info:Dom.byId("emulator_info"),gamepad:Dom.byId("emulator_gamepad"),
        speed:[...this.root.querySelectorAll("[data-emulator-speed]")]
      };
      this.activePointers=new Map();
      this.setNativeScreenSize();
      this.elements.status.textContent="Starting mGBA with the loaded project ROM…";
      this.setReadyControls(false);
      this.bind();this.bindDrag();this.ready=this.initialize();
    }
    bind(){
      this.scope.listen(this.elements.play,"click",()=>this.play());
      this.scope.listen(this.elements.pause,"click",()=>this.pause());
      this.scope.listen(this.elements.restart,"click",()=>this.reloadProject());
      this.scope.listen(this.elements.save,"click",()=>this.downloadSave());
      this.scope.listen(this.elements.input,"change",event=>this.importSave(event.target.files?.[0]));
      this.scope.listen(this.elements.minimize,"click",()=>this.toggleMinimize());
      this.scope.listen(this.elements.fullscreen,"click",()=>this.toggleFullscreen());
      this.scope.listen(this.elements.info,"click",()=>this.showInfo());
      for(const control of this.elements.speed)this.scope.listen(control,"click",()=>this.setSpeed(Number(control.dataset.emulatorSpeed)));
      // Input is intentionally handled by the application rather than by mGBA's
      // SDL keyboard listener.  This gives the dock the same behaviour for GB,
      // GBC and GBA, and lets a touch button hold an input while another button
      // is pressed. Pointer capture moves the terminal event to the button, so
      // listen on the document as well as the HUD (Safari is particularly strict
      // about where it delivers pointerup after a captured touch).
      this.scope.listen(this.elements.gamepad,"pointerdown",event=>this.gamepadDown(event));
      for(const type of ["pointerup","pointercancel","lostpointercapture"])this.scope.listen(document,type,event=>this.gamepadUp(event));
      this.scope.listen(this.elements.gamepad,"contextmenu",event=>event.preventDefault());
      this.scope.listen(this.canvas,"pointerdown",()=>{this.setInputActive(true);this.resumeFromInput();});
      this.scope.listen(document,"pointerdown",event=>{if(!this.root.contains(event.target))this.setInputActive(false);});
      this.scope.listen(document,"keydown",event=>this.key(event,true));
      this.scope.listen(document,"keyup",event=>this.key(event,false));
      this.scope.listen(window,"blur",()=>this.releaseGamepad());
      this.scope.listen(document,"visibilitychange",()=>{if(document.hidden)this.releaseGamepad();});
      this.scope.listen(document,"editorhistorychange",()=>this.queueReload());
      this.scope.listen(window,"resize",()=>this.clampPosition());
    }
    bindDrag(){
      this.scope.listen(this.elements.header,"pointerdown",event=>{
        if(event.target.closest("button")||this.root.classList.contains("is-fullscreen"))return;
        const bounds=this.root.getBoundingClientRect(),origin={x:event.clientX,y:event.clientY,left:bounds.left,top:bounds.top};
        this.root.classList.add("is-dragging");this.elements.header.setPointerCapture(event.pointerId);
        const move=next=>{
          const width=this.root.offsetWidth,height=this.root.offsetHeight,left=Math.max(8,Math.min(innerWidth-width-8,origin.left+next.clientX-origin.x)),top=Math.max(8,Math.min(innerHeight-height-8,origin.top+next.clientY-origin.y));
          Object.assign(this.root.style,{left:`${left}px`,top:`${top}px`,right:"auto",bottom:"auto"});
        };
        const stop=()=>{this.root.classList.remove("is-dragging");this.elements.header.removeEventListener("pointermove",move);this.elements.header.removeEventListener("pointerup",stop);};
        this.elements.header.addEventListener("pointermove",move);this.elements.header.addEventListener("pointerup",stop);
      });
    }
    setReadyControls(enabled){
      for(const control of [this.elements.play,this.elements.pause,this.elements.restart,this.elements.save,this.elements.input,...this.elements.gamepad.querySelectorAll("button"),...this.elements.speed])control.disabled=!enabled;
    }
    setNativeScreenSize(){
      // mGBA selects the GB/GBC core from the extension, but it does not own
      // our DOM canvas dimensions. Keep the presentation surface native too:
      // 160×144 for Game Boy Color, 240×160 for Game Boy Advance.
      const size=this.reader.family==="gba"?{width:240,height:160}:{width:160,height:144};
      this.canvas.width=size.width;this.canvas.height=size.height;
      this.canvas.style.aspectRatio=`${size.width} / ${size.height}`;
    }
    clampPosition(){
      if(this.root.classList.contains("is-fullscreen")||!this.root.style.left)return;
      const bounds=this.root.getBoundingClientRect(),left=Math.max(8,Math.min(innerWidth-bounds.width-8,bounds.left)),top=Math.max(8,Math.min(innerHeight-bounds.height-8,bounds.top));
      Object.assign(this.root.style,{left:`${left}px`,top:`${top}px`,right:"auto",bottom:"auto"});
    }
    async initialize(){
      try{
        this.failed=false;
        if(!global.crossOriginIsolated)throw new Error("The emulator requires the PUSH server with cross-origin isolation enabled.");
        const module=(await import(MODULE_PATH)).default;
        if(this.destroyed)return false;
        this.core=await module({canvas:this.canvas,locateFile:path=>`${DIST_PATH}${path}`});
        await this.core.FSInit();
        if(this.destroyed)return false;
        this.paths=this.core.filePaths();this.romName=this.safeRomName();this.romPath=`${this.paths.gamePath}/${this.romName}`;
        this.core.FS.writeFile(this.romPath,this.reader.ReadOnlyMemory.slice());
        this.core.setCoreSettings(EmulatorPerformance.settings());
        this.core.addCoreCallbacks({
          coreCrashedCallback:()=>this.fail(new Error("mGBA stopped because the emulated game crashed.")),
          saveDataUpdatedCallback:()=>this.queueSaveSync()
        });
        if(!this.core.loadGame(this.romPath))throw new Error(`mGBA could not load the current ${this.reader.family==="gba"?"GBA":"GB/GBC"} project ROM.`);
        this.setSpeed(1);
        this.core.toggleInput(false);this.core.pauseGame();this.playing=false;this.renderProperties();
        this.setReadyControls(true);
        this.elements.status.textContent=`${this.reader.family==="gba"?"GBA":"GB/GBC"} project ROM ready. Click the screen for keyboard input.`;
        this.root.classList.add("is-ready");return true;
      }catch(error){this.fail(error);return false;}
    }
    safeRomName(){
      const extension=["emerald","fire_red","leaf_green"].includes(this.reader.type)?"gba":this.reader.type==="crystal"?"gbc":"gb";
      const base=(this.reader.gamePath||`project.${extension}`).replace(/[^a-z0-9._-]+/gi,"_").replace(/\.(gba|gbc|gb)$/i,"");
      return`${base}.${extension}`;
    }
    renderProperties(){
      const version=this.core?.version?`${this.core.version.projectName} ${this.core.version.projectVersion}`:"mGBA";
      this.elements.props.replaceChildren(...[
        ["Core",version],["ROM","Live project memory"],["Save data","IndexedDB + .sav import/export"],["Refresh","Automatic after editor writes"],["Controls","Arrows · Z/X · A/S · Enter/Backspace"]
      ].flatMap(([key,value])=>[Dom.create("dt",{text:key}),Dom.create("dd",{text:value})]));
    }
    pressButton(button){
      if(!this.core||this.failed)return false;
      if(typeof this.core.buttonPress!=="function"||typeof this.core.buttonUnpress!=="function")throw new Error("The loaded mGBA runtime does not expose its required button input API.");
      this.core.buttonPress(button);return true;
    }
    releaseButton(button){
      if(!this.core||this.failed)return false;
      if(typeof this.core.buttonUnpress!=="function")throw new Error("The loaded mGBA runtime does not expose its required button input API.");
      this.core.buttonUnpress(button);return true;
    }
    resumeFromInput(){
      if(!this.core||this.failed||this.playing)return;
      EmulatorPerformance.resumeAudio(this.core).catch(error=>this.fail(error));
      this.core.resumeGame();this.playing=true;
      this.elements.status.textContent="Running live project ROM.";
    }
    key(event,down){
      if(!this.inputActive||!this.core||event.repeat&&down)return;
      const button=KEY_MAP.get(event.code);if(!button)return;
      event.preventDefault();event.stopPropagation();
      try{
        if(down){this.resumeFromInput();this.pressButton(button);}else this.releaseButton(button);
      }catch(error){this.fail(error);}
    }
    gamepadDown(event){
      const control=event.target.closest("[data-emulator-button]");if(!control||!this.core||this.failed)return;
      const button=control.dataset.emulatorButton;if(this.activePointers.has(event.pointerId))return;
      event.preventDefault();control.setPointerCapture?.(event.pointerId);this.activePointers.set(event.pointerId,{button,control});
      control.classList.add("is-pressed");control.setAttribute("aria-pressed","true");
      try{this.setInputActive(true);this.resumeFromInput();this.pressButton(button);}catch(error){this.activePointers.delete(event.pointerId);control.classList.remove("is-pressed");control.setAttribute("aria-pressed","false");this.fail(error);}
    }
    gamepadUp(event){
      const active=this.activePointers.get(event.pointerId);if(!active)return;
      this.activePointers.delete(event.pointerId);active.control.classList.remove("is-pressed");active.control.setAttribute("aria-pressed","false");
      try{this.releaseButton(active.button);}catch(error){this.fail(error);}event.preventDefault();
    }
    releaseGamepad(){
      for(const {button,control} of this.activePointers.values()){try{this.releaseButton(button);}catch(error){this.fail(error);}control.classList.remove("is-pressed");control.setAttribute("aria-pressed","false");}
      this.activePointers.clear();
    }
    setSpeed(multiplier){
      if(![1,2,5,10].includes(multiplier))throw new RangeError(`Unsupported emulator speed '${multiplier}'.`);
      if(!this.core||this.failed)return false;
      this.core.setFastForwardMultiplier(multiplier);this.speed=multiplier;
      for(const control of this.elements.speed){
        const active=Number(control.dataset.emulatorSpeed)===multiplier;
        control.classList.toggle("is-active",active);control.setAttribute("aria-pressed",String(active));
      }
      this.elements.status.textContent=multiplier===1?"Normal emulation speed.":`Emulation speed: ${multiplier}×.`;
      return true;
    }
    showInfo(){
      const dialog=Dom.create("dialog",{className:"app-dialog emulator-help"}),close=()=>{dialog.close();dialog.remove();};
      const row=(icon,title,text)=>Dom.create("li",{},[UiWindow.icon(icon),Dom.create("span",{},[Dom.create("strong",{text:title}),Dom.create("small",{text})])]);
      dialog.append(AppDialog.card({title:"Using the emulator",icon:"fa-gamepad",onClose:close,body:[
        Dom.create("p",{text:"The emulator runs the current in-memory project ROM. Use the touch HUD, or click the screen before using the keyboard."}),
        Dom.create("ul",{className:"emulator-help__list"},[
          row("fa-keyboard","Keyboard","Arrows: D-pad · Z/X: A/B · A/S: L/R · Enter/Backspace: Start/Select"),
          row("fa-hand-pointer","Touch controls","Buttons support simultaneous pointers, so a direction and A/B can be held together."),
          row("fa-forward","Speed","Use 1×, 2×, 5× or 10× above the screen. Select 1× to restore native timing and audio."),
          row("fa-floppy-disk","Save data","Save downloads the current .sav. Load imports a .sav and restarts the game."),
          row("fa-rotate","Project refresh","Applied editor changes reload the current project ROM; a full reset may be required."),
          row("fa-expand","Window modes","Drag the header, minimize the player, or use fullscreen to focus on gameplay.")
        ])
      ]}));
      dialog.addEventListener("cancel",event=>{event.preventDefault();close();},{once:true});dialog.addEventListener("click",event=>{if(event.target===dialog)close();});AppDialog.mount(dialog,{focus:".app-dialog__close"});
    }
    setInputActive(active){
      this.inputActive=Boolean(active);this.root.classList.toggle("is-input-active",this.inputActive);
      this.core?.toggleInput(false);
      if(active)this.canvas.focus({preventScroll:true});
    }
    play(){this.ready.then(async ready=>{if(!ready||this.destroyed)return;await EmulatorPerformance.resumeAudio(this.core);this.core.resumeGame();this.playing=true;this.elements.status.textContent="Running live project ROM.";this.setInputActive(true);}).catch(error=>this.fail(error));}
    pause(){if(!this.core)return;this.releaseGamepad();this.core.pauseGame();this.playing=false;this.elements.status.textContent="Paused.";}
    queueSaveSync(){
      if(this.destroyed)return;
      clearTimeout(this.saveSyncTimer);
      this.saveSyncTimer=setTimeout(()=>this.flushSaveSync(),750);
    }
    flushSaveSync(){
      clearTimeout(this.saveSyncTimer);
      if(this.destroyed||!this.core)return Promise.resolve(false);
      if(this.saveSyncPromise){this.saveSyncPending=true;return this.saveSyncPromise;}
      this.saveSyncPromise=this.core.FSSync()
        .then(()=>true)
        .catch(error=>{this.fail(error);return false;})
        .finally(()=>{
          this.saveSyncPromise=null;
          if(this.saveSyncPending){this.saveSyncPending=false;this.queueSaveSync();}
        });
      return this.saveSyncPromise;
    }
    queueReload(){
      if(this.destroyed)return;
      clearTimeout(this.reloadTimer);this.pendingReload=true;this.elements.status.textContent="Project memory changed; refreshing emulator…";
      this.reloadTimer=setTimeout(()=>this.reloadProject(),250);
    }
    reloadProject(){
      return this.ready.then(async ready=>{
        if(!ready||this.destroyed)return false;
        clearTimeout(this.reloadTimer);const resume=this.playing;this.core.pauseGame();
        this.core.FS.writeFile(this.romPath,this.reader.ReadOnlyMemory.slice());
        this.core.quickReload();this.pendingReload=false;
        this.elements.status.textContent="Emulator refreshed from current project memory.";
        if(resume){this.core.resumeGame();this.playing=true;}
        return true;
      }).catch(error=>(this.fail(error),false));
    }
    async downloadSave(){
      await this.ready;const save=this.core?.getSave();
      if(!save?.length){this.fail(new Error("The running game has not created save data yet."));return false;}
      const link=document.createElement("a"),name=this.romName.replace(/\.(gba|gbc|gb)$/i,".sav");
      link.href=URL.createObjectURL(new Blob([save],{type:"application/octet-stream"}));link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
      this.elements.status.textContent=`Downloaded ${name}.`;return true;
    }
    async importSave(file){
      if(!file)return false;await this.ready;
      const bytes=new Uint8Array(await file.arrayBuffer()),savePath=this.core.saveName||`${this.paths.savePath}/${this.romName.replace(/\.(gba|gbc|gb)$/i,".sav")}`;
      this.core.FS.writeFile(savePath,bytes);await this.core.FSSync();this.core.quickReload();this.elements.input.value="";
      this.elements.status.textContent=`Loaded ${file.name} and restarted the game.`;return true;
    }
    toggleMinimize(){
      const minimize=this.windowState!=="minimized";
      if(minimize&&this.windowState==="fullscreen")this.applyWindowState("normal");
      return this.applyWindowState(minimize?"minimized":"normal");
    }
    toggleFullscreen(){
      const fullscreen=this.windowState!=="fullscreen";
      return this.applyWindowState(fullscreen?"fullscreen":"normal");
    }
    applyWindowState(next){
      if(!["normal","minimized","fullscreen"].includes(next))throw new RangeError(`Unknown emulator window state '${next}'.`);
      const enteringFullscreen=next==="fullscreen"&&this.windowState!=="fullscreen";
      if(enteringFullscreen)this.windowPosition={left:this.root.style.left,top:this.root.style.top,right:this.root.style.right,bottom:this.root.style.bottom};
      this.windowState=next;
      this.root.classList.toggle("is-minimized",next==="minimized");this.root.classList.toggle("is-fullscreen",next==="fullscreen");
      this.elements.minimize.setAttribute("aria-expanded",String(next!=="minimized"));this.elements.minimize.setAttribute("aria-label",next==="minimized"?"Restore emulator":"Minimize emulator");
      const minimizeIcon=this.elements.minimize.querySelector("i");if(minimizeIcon)minimizeIcon.className=`fa-solid ${next==="minimized"?"fa-window-restore":"fa-minus"}`;
      this.elements.fullscreen.setAttribute("aria-pressed",String(next==="fullscreen"));
      const fullscreenIcon=this.elements.fullscreen.querySelector("i");if(fullscreenIcon)fullscreenIcon.className=`fa-solid ${next==="fullscreen"?"fa-compress":"fa-expand"} ui-icon`;
      if(next!=="fullscreen"&&this.windowPosition){Object.assign(this.root.style,this.windowPosition);this.windowPosition=null;}
      requestAnimationFrame(()=>{this.clampPosition();this.resizeCanvasSurface();});
      return next;
    }
    resizeCanvasSurface(){
      // The emulation framebuffer stays native; CSS owns only the viewport.
      // Calling the core resize hook when supplied keeps the GBC WebGL surface
      // in sync after PiP minimize/fullscreen transitions.
      this.core?.resizeCanvas?.();
    }
    retry(){
      if(this.destroyed||!this.failed)return this.ready;
      try{this.core?.quitGame?.();this.core?.quitMgba?.();}catch{}
      this.core=null;this.elements.status.textContent="Retrying mGBA with the loaded project ROM…";
      this.ready=this.initialize();return this.ready;
    }
    activate(){if(this.pendingReload)this.reloadProject();}
    fail(error){
      if(this.destroyed)return;this.failed=true;const message=error?.message||String(error);this.elements.status.textContent=message;
      this.setReadyControls(false);
      NotificationHandler.error("Emulator",error);
    }
    destroy(){
      if(this.destroyed)return;this.destroyed=true;clearTimeout(this.reloadTimer);clearTimeout(this.saveSyncTimer);this.releaseGamepad();this.scope.destroy();
      try{this.core?.quitGame?.();this.core?.quitMgba?.();}catch(error){console.warn("mGBA cleanup failed.",error);}
      this.core=null;
    }
  }

  global.ProjectEmulator=ProjectEmulator;
})(globalThis);
