(function(){
  "use strict";

  const EDITORS=new EditorDescriptorRegistry([
    {
      file:"hex.html",id:"hex_editor",instance:"hex_editor",label:"hex",title:"Hex editor",icon:"hex",families:["gba","gb"],help:{file:"HEX_EDITOR.md"},refreshEvents:["hexviewchange"],
      activate:project=>project.hex_editor?.go?.(project.hex_editor.current),
      open:(project,request)=>project.hex_editor?.go?.(request.offset||0),
      bookmark:{capture:project=>({offset:project.hex_editor?.current||0,title:`Offset ${(project.hex_editor?.current||0).toString(16).toUpperCase()}`}),restore:(project,target)=>project.hex_editor?.go?.(target.offset||0)}
    },
    {
      file:"code.html",id:"code_workspace",instance:"code_editor",label:"code",title:"Code editor",icon:"code",families:["gba","gb"],help:{file:"CODE_EDITOR.md",extras:[{label:"Script language reference",file:"SCRIPT_LANGUAGE.md"}]},refreshEvents:["codeviewchange"],
      open:(project,request)=>project.code_editor?.open?.(request.offset||0,false,{view:request.view||"original",reference:request.reference,scriptKind:request.scriptKind}),
      bookmark:{
        capture:project=>{const active=project.code_editor?.active,offset=active?.offset||0;return{offset,view:active?.viewer,scriptKind:active?.scriptKind,mode:active?.mode,title:`${active?.viewer==="script"?(active.scriptKind||"script"):"code"} ${offset.toString(16).toUpperCase()}`};},
        restore:(project,target)=>{if(target.mode&&project.code_editor?.elements?.mode)project.code_editor.elements.mode.value=target.mode;return project.code_editor?.open?.(target.offset||0,false,{view:target.view,scriptKind:target.scriptKind});}
      }
    },
    {
      file:"map.html",id:"map_editor",instance:"map_editor",label:"map",title:"Map editor",icon:"map",families:["gba","gb"],help:{file:"MAP_EDITOR.md"},refreshEvents:["uiwindowchange"],
      activate:(project,options)=>project.map_editor?.activate?.(options),
      open:(project,request)=>{if(Number.isInteger(request.bank)&&Number.isInteger(request.map))return project.map_editor?.navigateToMap?.(request.bank,request.map);if(Number.isInteger(request.group)&&Number.isInteger(request.map))return project.map_editor?.select?.(`${request.group}:${request.map}`);if(Number.isInteger(request.mapId))return project.map_editor?.select?.(request.mapId);},
      bookmark:{capture:project=>project.map_editor?.bookmark?.()||{title:"Map"},restore:(project,target)=>project.map_editor?.restoreBookmark?.(target)}
    },
    {
      file:"sprite.html",id:"sprite_editor",instance:"sprite_editor",label:"sprite",title:"Sprite editor",icon:"sprite",families:["gba","gb"],help:{file:"SPRITE_EDITOR.md"},refreshEvents:["spriteviewchange"],
      open:(project,request)=>project.sprite_editor?.open?.(request),bookmark:{capture:project=>project.sprite_editor?.bookmark?.()||{title:"Sprite"},restore:(project,target)=>project.sprite_editor?.restoreBookmark?.(target)}
    },
    {
      file:"battle.html",id:"battle_editor",instance:"battle_editor",label:"battle",title:"Battle editor",icon:"code",families:["gba","gb"],help:{file:"BATTLE_EDITOR.md"},refreshEvents:["battleviewchange"],
      activate:(project,options)=>project.battle_editor?.activate?.(options),open:(project,request)=>request.encounter?project.battle_editor?.openEncounter?.(request.encounter):project.battle_editor?.openTrainer?.(request.trainer)
    },
    {
      file:"pokedex.html",id:"pokedex_editor",instance:"pokedex_editor",label:"pokedex",title:"Pokédex editor",icon:"code",families:["gba","gb"],help:{file:"POKEDEX_EDITOR.md"},refreshEvents:["pokedexviewchange"],
      activate:(project,options)=>project.pokedex_editor?.activate?.(options),open:(project,request)=>Number.isInteger(request.species)&&request.species>0?project.pokedex_editor?.open?.(request.species):undefined
    },
    {
      file:"moves.html",id:"move_editor",instance:"move_editor",label:"moves",title:"Move editor",icon:"code",families:["gba","gb"],help:{file:"MOVE_EDITOR.md"},refreshEvents:["moveviewchange"],
      activate:(project,options)=>project.move_editor?.activate?.(options),open:(project,request)=>Number.isInteger(request.move)?project.move_editor?.open?.(request.move):undefined
    },
    {
      file:"sound.html",id:"sound_editor",instance:"sound_editor",label:"sound",title:"Sound editor",icon:"code",families:["gba","gb"],help:{file:"SOUND_EDITOR.md"},
      activate:(project,options)=>project.sound_editor?.activate?.(options),open:(project,request)=>project.sound_editor?.open?.(request)
    },
    {
      file:"animation.html",id:"animation_editor",instance:"animation_editor",label:"animation",title:"Animation editor",icon:"code",families:["gba","gb"],help:{file:"ANIMATION_EDITOR.md"},refreshEvents:["animationviewchange"],
      activate:(project,options)=>project.animation_editor?.activate?.(options),open:(project,request)=>project.animation_editor?.open?.(request)
    },
    {
      file:"encounters.html",id:"encounter_editor",instance:"encounter_editor",label:"encounters",title:"Encounter editor",icon:"map",families:["gba","gb"],navigation:false,help:{file:"ENCOUNTER_EDITOR.md"},
      activate:(project,options)=>project.encounter_editor?.activate?.(options),open:(project,request)=>project.encounter_editor?.open?.(request.encounter||request)
    },
    {
      file:"items.html",id:"item_editor",instance:"item_editor",label:"items",title:"Item editor",icon:"sprite",families:["gba","gb"],help:{file:"ITEM_EDITOR.md"},
      activate:(project,options)=>project.item_editor?.activate?.(options),open:(project,request)=>Number.isInteger(request.item)?project.item_editor?.open?.(request.item):undefined
    }
  ]);

  const elements = {};
  let romEditor = null;
  let bookmarkStore = null;
  let workspaceTransition = 0;
  let bootstrapInProgress = false;
  let bootstrapComplete = false;
  const importReport = () => {
    const input=document.createElement("input");
    input.type="file";input.accept="application/json,.json";
    input.addEventListener("change",async()=>{
      try{if(input.files?.[0])await RomExport.importReport(romEditor,input.files[0]);}
      catch(error){notifyError("Change report",error);}
    },{once:true});
    input.click();
  };
  const projectHistory = command => {
    try{return romEditor?.project_commands?.[command]?.();}
    catch(error){notifyError("Project history",error);return false;}
  };
  const projectHistoryLabel = direction => {
    const stack=romEditor?.project_commands;
    const command=direction==="undo"?stack?.done.at(-1):stack?.undone.at(-1);
    const action=`${direction==="undo"?"Undo":"Redo"} ${command?.label||"project change"}`;
    return command?.ownerLabel?`${action} · ${command.ownerLabel}`:action;
  };
  const projectEditMenu = () => ({label:"Edit",children:[
    {label:()=>projectHistoryLabel("undo"),shortcut:"⌘Z",action:()=>projectHistory("undo"),disabled:()=>!romEditor?.project_commands?.done.length},
    {label:()=>projectHistoryLabel("redo"),shortcut:"⇧⌘Z",action:()=>projectHistory("redo"),disabled:()=>!romEditor?.project_commands?.undone.length}
  ]});

  const toggleMapWindow = (title) => {
    document.getElementById("map_editor")?.mapWindowManager?.toggle(title);
  };

  const mapWindowItem = (title) => ({
    label:title,
    checked:()=>{
      const panel=document.querySelector(`#map_editor [data-window-title='${title}']`);
      return Boolean(panel&&!panel.classList.contains("hide"));
    },
    action:()=>toggleMapWindow(title)
  });

  const currentMapWindows = () => {
    const titles=document.getElementById("map_editor")?.mapWindowManager?.titles() || ["Blocks","Tools"];
    return titles.map(mapWindowItem);
  };
  const openGuide = file => MarkdownViewer.open(`doc/${file}`).catch(error=>notifyError("Documentation",error));
  const experienceMenu = () => ({label:"Settings",children:[
    {label:"Simple experience",checked:()=>editorPreferences.experience==="simple",action:()=>editorPreferences.setExperience("simple")},
    {label:"Nerd experience",checked:()=>editorPreferences.experience==="nerd",action:()=>editorPreferences.setExperience("nerd")},
    {separator:true},
    {label:"Experience settings…",action:()=>editorPreferences.open()}
  ]});
  const helpMenu = descriptor => ({label:"Help",children:[
    {label:`${descriptor.title} guide`,action:()=>openGuide(descriptor.help.file)},
    ...descriptor.help.extras.map(item=>({label:item.label,action:()=>openGuide(item.file)})),
    {label:"ROM compatibility",action:()=>openGuide("COMPATIBILITY.md")},
    {label:"All editor guides",action:()=>openGuide("USAGE.md")}
  ]});
  const fileMenu = () => ({label:"File",children:[
    {label:"Download edited ROM…",shortcut:"⌘S",action:()=>RomExport.rom(romEditor).catch(error=>notifyError("ROM export",error)),disabled:()=>!romEditor?.ReadOnlyMemory},
    {label:"Export change report…",action:()=>RomExport.report(romEditor).catch(error=>notifyError("Change report",error)),disabled:()=>!romEditor?.ReadOnlyMemory},
    {label:"Import change report…",action:importReport,disabled:()=>!romEditor?.ReadOnlyMemory},
    {separator:true},
    {label:()=>projectHistoryLabel("undo"),action:()=>projectHistory("undo"),disabled:()=>!romEditor?.project_commands?.done.length},
    {label:()=>projectHistoryLabel("redo"),action:()=>projectHistory("redo"),disabled:()=>!romEditor?.project_commands?.undone.length}
  ]});

  const configureEditorHeaders = () => {
    const menus={
      hex_editor:[
        {label:"Edit",children:[
          {label:"Undo",shortcut:"⌘Z",action:()=>romEditor?.hex_editor?.undo?.()},
          {label:"Redo",shortcut:"⇧⌘Z",action:()=>romEditor?.hex_editor?.redo?.()},
          {label:"Copy",shortcut:"⌘C",action:()=>romEditor?.hex_editor?.copy?.()},
          {label:"Paste",shortcut:"⌘V",action:()=>romEditor?.hex_editor?.pasteClipboard?.()}
        ]},
        {label:"View",children:[
          {label:"Text translation",checked:()=>romEditor?.hex_editor?.isTranslationVisible?.(),action:()=>romEditor?.hex_editor?.toggleTranslation?.()},
          {label:"Mirror layout",checked:()=>romEditor?.hex_editor?.isMirrored?.(),action:()=>romEditor?.hex_editor?.toggleMirror?.()}
        ]},
        {label:"Go",complexity:"advanced",children:[{label:"Memory offset…",action:()=>document.getElementById("memory_search")?.querySelector("input")?.focus()}]}
      ],
      code_workspace:[
        {label:"Edit",children:[{label:"Undo",shortcut:"⌘Z",action:()=>romEditor?.code_editor?.undo?.()},{label:"Redo",shortcut:"⇧⌘Z",action:()=>romEditor?.code_editor?.redo?.()}]},
        {label:"Go",complexity:"advanced",children:[{label:"ROM offset…",action:()=>document.getElementById("code_offset")?.focus()}]},
        {label:"View",children:[
          {label:"Event / text source",checked:()=>romEditor?.code_editor?.isView?.("script"),action:()=>romEditor?.code_editor?.setView?.("script")},
          {label:"Original CPU code",checked:()=>romEditor?.code_editor?.isView?.("original"),action:()=>romEditor?.code_editor?.setView?.("original")}
        ]}
      ],
      sprite_editor:[
        {label:"Edit",children:[{label:"Undo",shortcut:"⌘Z",action:()=>romEditor?.sprite_editor?.undo?.()},{label:"Redo",shortcut:"⇧⌘Z",action:()=>romEditor?.sprite_editor?.redo?.()}]},
        {label:"View",children:[
          {label:"Zoom in",shortcut:"+",action:()=>romEditor?.sprite_editor?.zoomBy?.(1),disabled:()=>romEditor?.sprite_editor?.canZoom?.(1)===false},
          {label:"Zoom out",shortcut:"−",action:()=>romEditor?.sprite_editor?.zoomBy?.(-1),disabled:()=>romEditor?.sprite_editor?.canZoom?.(-1)===false},
          {label:"Actual pixels",action:()=>romEditor?.sprite_editor?.setZoom?.(1)},
          {separator:true},
          {label:"Pixel / tile grid",checked:()=>romEditor?.sprite_editor?.isGridVisible?.(),action:()=>romEditor?.sprite_editor?.toggleGrid?.()}
        ]}
      ],
      battle_editor:[
        {label:"View",children:[
          {label:"Pixel grid",checked:()=>romEditor?.battle_editor?.isGridVisible?.(),action:()=>romEditor?.battle_editor?.toggleGrid?.()}
        ]},
        {label:"Go",children:[
          {label:"Open animation code",action:()=>romEditor?.battle_editor?.openCode?.(),disabled:()=>!romEditor?.battle_editor?.activeAnimation?.()},
          {label:"Open battle sprite",action:()=>romEditor?.battle_editor?.openSprite?.(),disabled:()=>!romEditor?.battle_editor?.activeSprite?.()}
        ]}
      ],
      pokedex_editor:[
        projectEditMenu(),
        {label:"View",children:[
          {label:"Open description",action:()=>romEditor?.pokedex_editor?.openText?.(),disabled:()=>!Number.isInteger(romEditor?.pokedex_editor?.current?.descriptionOffset)},
          {label:"Open sprite data",action:()=>romEditor?.pokedex_editor?.openSprite?.(),disabled:()=>!romEditor?.pokedex_editor?.current},
          {label:"Open cry",action:()=>romEditor?.pokedex_editor?.openSound?.(),disabled:()=>!romEditor?.pokedex_editor?.current||!romEditor?.capabilities?.get("sound_editor")?.ordinary}
        ]}
      ],
      move_editor:[
        projectEditMenu(),
        {label:"Go",children:[
          {label:"Find move…",action:()=>document.getElementById("move_filter")?.focus()},
          {label:"Open raw record",action:()=>romEditor?.move_editor?.openData?.(),disabled:()=>!romEditor?.move_editor?.current}
        ]}
      ],
      sound_editor:[{label:"Go",children:[{label:"Find sound…",action:()=>document.getElementById("sound_filter")?.focus()}]}],
      animation_editor:[
        {label:"View",children:[
          {label:"Play timeline",action:()=>romEditor?.animation_editor?.play?.(),disabled:()=>!romEditor?.animation_editor?.canPlay?.()},
          {label:"Pause timeline",action:()=>romEditor?.animation_editor?.pause?.()},
          {label:"Previous frame",action:()=>romEditor?.animation_editor?.step?.(-1)},
          {label:"Next frame",action:()=>romEditor?.animation_editor?.step?.(1)}
        ]}
      ],
      encounter_editor:[projectEditMenu(),
        {label:"Go",children:[
          {label:"Find map…",action:()=>document.getElementById("encounter_filter")?.focus()},
          {label:"Open map",action:()=>romEditor?.encounter_editor?.openMap?.(),disabled:()=>!romEditor?.encounter_editor?.current},
          {label:"Open raw table",action:()=>romEditor?.encounter_editor?.openData?.(),disabled:()=>!romEditor?.encounter_editor?.current}
        ]}
      ],
      item_editor:[projectEditMenu(),
        {label:"Go",children:[
          {label:"Find item…",action:()=>document.getElementById("item_filter")?.focus()},
          {label:"Open graphic",action:()=>romEditor?.item_editor?.current&&EditorLinks.optional(romEditor.item_editor.driver.spriteLink?.(romEditor.item_editor.current))}
        ]}
      ],
      map_editor:[
      {label:"Edit",children:[{label:"Undo",shortcut:"⌘Z",action:()=>romEditor?.map_editor?.undo?.()},{label:"Redo",shortcut:"⇧⌘Z",action:()=>romEditor?.map_editor?.redo?.()}]},
      {label:"Map",visible:()=>typeof romEditor?.map_editor?.editLayout==="function"||typeof romEditor?.map_editor?.editConnections==="function",children:[
        {label:"Resize…",action:()=>romEditor?.map_editor?.editLayout?.(),visible:()=>typeof romEditor?.map_editor?.editLayout==="function"},
        {label:"Connections…",action:()=>romEditor?.map_editor?.editConnections?.(),visible:()=>typeof romEditor?.map_editor?.editConnections==="function"}
      ]},
      {label:"Event",visible:()=>typeof romEditor?.map_editor?.createEvent==="function",children:[
        {label:"New object",action:()=>romEditor?.map_editor?.createEvent?.(0),visible:()=>typeof romEditor?.map_editor?.createEvent==="function"&&romEditor.map_editor.canCreateEvent?.(0)!==false},
        {label:"New warp",action:()=>romEditor?.map_editor?.createEvent?.(1),visible:()=>typeof romEditor?.map_editor?.createEvent==="function"&&romEditor.map_editor.canCreateEvent?.(1)!==false},
        {label:"New script trigger",action:()=>romEditor?.map_editor?.createEvent?.(2),visible:()=>typeof romEditor?.map_editor?.createEvent==="function"&&romEditor.map_editor.canCreateEvent?.(2)!==false},
        {label:"New signpost",action:()=>romEditor?.map_editor?.createEvent?.(3),visible:()=>typeof romEditor?.map_editor?.createEvent==="function"&&romEditor.map_editor.canCreateEvent?.(3)!==false}
      ]},
      {label:"View",children:[
        {label:"Windows",children:currentMapWindows},
        {separator:true},
        {label:"Center map",action:()=>{
          if(typeof romEditor?.map_editor?.center==="function")romEditor.map_editor.center();
          else document.getElementById("canvas_map")?.dispatchEvent(new CustomEvent("centermap"));
        }}
      ]}
    ]};
    EDITORS.attachHeaders({menus,composeMenus:(descriptor,items)=>[fileMenu(),...items,experienceMenu(),helpMenu(descriptor)]});
  };

  const installFocusControls = () => {
    document.querySelectorAll(".editor_area").forEach(editor=>{
      if(editor.id==="battle_editor")return;
      if(editor.querySelector(".editor-focus-toggle"))return;
      const toggle=Dom.create("button",{className:"editor-focus-toggle",attributes:{type:"button",title:"Focus this editor (⌘⇧F)"},events:{click:()=>toggleFocus(editor)}},[UiWindow.icon("fa-expand"),Dom.create("span",{className:"sr-only",text:"Focus this editor"})]);
      editor.append(toggle);
    });
    document.addEventListener("keydown",event=>{
      if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==="f"){event.preventDefault();toggleFocus(document.querySelector(".editor_area:not(.hide)"));}
      if(event.key==="Escape"&&document.body.classList.contains("editor-focus"))toggleFocus();
    });
  };
  const toggleFocus = editor => {
    const active=editor||document.querySelector(".editor_area.focused");
    const enable=Boolean(active&&!active.classList.contains("focused"));
    document.querySelectorAll(".editor_area.focused").forEach(item=>item.classList.remove("focused"));
    document.body.classList.toggle("editor-focus",enable);
    if(enable)active.classList.add("focused");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const visible=document.querySelector(".editor_area:not(.hide)");
      visible?.dispatchEvent(new CustomEvent("editorlayoutchange",{detail:{focused:enable}}));
      document.getElementById("map_editor")?.mapWindowManager?.clamp();
      if(visible&&EDITORS.get(visible.id))EDITORS.activate(visible.id,romEditor,{initial:false});
    }));
  };

  const loadResources = paths => FileHandler.load(paths);

  const notifyError = (title, error) => {
    NotificationHandler.error(title,error);
  };

  const showUploader = () => {
    Dom.setVisible(elements.lightbox, true);
    Dom.setVisible(elements.upload, true);
    Dom.setVisible(elements.loader, false);
    elements.input.value = "";
  };

  const currentBookmark = () => {
    const workspace=document.querySelector("#navigation .viewer_in")?.dataset.workspace||EDITORS.first().id;
    return{workspace,family:romEditor?.family,project:ProjectIdentity.capture(romEditor),...EDITORS.capture(workspace,romEditor)};
  };

  const openBookmark = async target => {
    ProjectIdentity.assertCompatible(target.project||(target.family?{family:target.family}:null),romEditor);
    const workspace=EDITORS.get(target.workspace);if(!workspace)return;const link=elements.navigation.querySelector(`[data-workspace='${workspace.id}']`);await switchWorkspace(workspace,link);
    return EDITORS.restore(workspace.id,romEditor,target);
  };

  const openEditorLink = async (request={}) => {
    const {workspace:workspaceId,offset=0,view,reference,scriptKind}=request;
    const workspace=EDITORS.get(workspaceId),link=elements.navigation.querySelector(`[data-workspace='${workspaceId}']`);if(!workspace||!link)return;
    if(link.classList.contains("disabled")){
      const capability=romEditor?.capabilities?.get?.(workspaceId);
      throw new Error(capability?`${capability.label}: ${capability.reason}`:"This editor is not available for the loaded ROM.");
    }
    await switchWorkspace(workspace,link);
    return EDITORS.open(workspaceId,romEditor,{...request,offset,view,reference,scriptKind});
  };

  const switchWorkspace = async (workspace, link) => {
    if(!romEditor?.ReadOnlyMemory || link.classList.contains("disabled")) return;
    const transition=++workspaceTransition;
    const firstOpen=!EDITORS.instance(romEditor,workspace.id);
    const previousLink=document.querySelector("#navigation .viewer_in"),previousWorkspace=previousLink?.dataset.workspace;
    previousLink?.classList.remove("viewer_in");
    document.querySelectorAll(".editor_area").forEach((editor) => editor.classList.add("hide"));
    document.getElementById(workspace.id)?.classList.remove("hide");
    document.scrollingElement?.scrollTo?.({top:0,left:0});
    link.classList.add("viewer_in");
    try{
      await romEditor.ensureWorkspace(workspace.id);
      if(transition!==workspaceTransition)return;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(transition!==workspaceTransition)return;

      EDITORS.activate(workspace.id,romEditor,{initial:firstOpen});
    }catch(error){
      if(transition!==workspaceTransition)return false;
      link.classList.remove("viewer_in");document.getElementById(workspace.id)?.classList.add("hide");
      if(previousLink&&previousWorkspace){previousLink.classList.add("viewer_in");document.getElementById(previousWorkspace)?.classList.remove("hide");}
      throw error;
    }
  };

  const renderNavigation = () => {
    EDITORS.renderNavigation(elements.navigation,{onOpen:(workspace,link)=>switchWorkspace(workspace,link).catch(error=>notifyError("Editor error",error))});
  };

  const handleFile = async (files) => {
    try{
      if(files.length !== 1 || !/\.(gba|gbc|gb)$/i.test(files[0].name)){
        throw new Error("Choose one .gba, .gbc, or .gb file.");
      }
      if(!await RomExport.confirmDiscard(romEditor))return;
      await romEditor.loadROM(files[0]);
    }catch(error){
      notifyError("File error", error);
    }finally{
      elements.input.value = "";
    }
  };

  const bindUploader = () => {
    elements.open.addEventListener("click", showUploader);
    elements.browse.addEventListener("click", () => elements.input.click());
    elements.input.addEventListener("change", (event) => handleFile(event.target.files));
    elements.drag.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.drag.classList.add("hover");
    });
    elements.drag.addEventListener("dragleave", () => elements.drag.classList.remove("hover"));
    elements.drag.addEventListener("drop", (event) => {
      event.preventDefault();
      elements.drag.classList.remove("hover");
      handleFile(event.dataTransfer.files);
    });

    window.addEventListener("romreset", () => {
      workspaceTransition++;
      elements.open.textContent="Open ROM";
      elements.navigation.querySelector(".viewer_in")?.classList.remove("viewer_in");
      EDITORS.resetNavigation(elements.navigation);
      document.querySelectorAll(".editor_area").forEach(editor=>editor.classList.add("hide"));
      document.querySelectorAll(".editor_area").forEach(editor=>editor.editorHeader?.render());
      document.getElementById("emulator_dock")?.classList.remove("is-supported","is-user-hidden");
      if(elements.emulatorToggle){elements.emulatorToggle.disabled=true;elements.emulatorToggle.setAttribute("aria-pressed","false");}
      document.body.dataset.romLoaded="false";
      updateDirtyUi();
    });

    window.addEventListener("romloaded", ({detail}) => {
      document.body.dataset.romLoaded="true";
      document.querySelectorAll(".editor_area").forEach(editor=>editor.editorHeader?.render());
      EDITORS.updateNavigation(elements.navigation,detail);
	  const initial=EDITORS.first(),hexLink=elements.navigation.querySelector(`[data-workspace='${initial.id}']`);
	  switchWorkspace(initial,hexLink).catch((error) => notifyError("Editor error", error));
      const emulatorSupported=Boolean(detail.capabilities?.get?.("emulator_editor")?.ordinary);
      const dock=document.getElementById("emulator_dock");
      dock?.classList.toggle("is-supported",emulatorSupported);
      dock?.classList.add("is-user-hidden");
      if(elements.emulatorToggle){elements.emulatorToggle.disabled=!emulatorSupported;elements.emulatorToggle.setAttribute("aria-pressed","false");}
      updateDirtyUi();
    });
  };

  const updateDirtyUi = () => {
    const summary=RomExport.summary(romEditor),parts=[];
    if(summary.byteDirty)parts.push(`${summary.bytes} changed ${summary.bytes===1?"byte":"bytes"}`);
    if(summary.pending.length)parts.push(`${summary.pending.length} unapplied ${summary.pending.length===1?"draft":"drafts"}`);
    const label=summary.dirty?`Unsaved: ${parts.join(" · ")}`:"No unsaved changes";
    elements.open?.classList.toggle("has-unsaved",summary.dirty);
    if(elements.open)elements.open.title=label;
    document.documentElement.dataset.dirty=String(summary.dirty);
  };

  const bootstrap = async () => {
    if(bootstrapInProgress||bootstrapComplete)return;
    bootstrapInProgress=true;
    Object.assign(elements, {
      lightbox: Dom.byId("selectLightboxRom"),
      upload: Dom.byId("upload_game"),
      loader: Dom.byId("loader_file_container"),
      input: Dom.byId("upload_input"),
      drag: Dom.byId("upload_drag"),
      browse: Dom.byId("upload_mini"),
      open: Dom.byId("new_upload"),
      emulatorToggle: Dom.byId("emulator_dock_toggle"),
      navigation: Dom.byId("navigation"),
      main: Dom.byId("main_result")
    });

    elements.browse.disabled = true;
    try{
      const [fragments, emulatorFragment, metadataFiles] = await Promise.all([
        loadResources(EDITORS.files()),
        loadResources(["emulator.html"]),
        loadResources(["json/games.json"])
      ]);
      const metadata=JSON.parse(metadataFiles[0].result);

      elements.main.replaceChildren();
      document.getElementById("emulator_dock")?.remove();
      elements.main.insertAdjacentHTML("beforeend", fragments.map(({result}) => result).join(""));
      document.body.insertAdjacentHTML("beforeend",emulatorFragment[0].result);
      UiPanel.enhanceAll(elements.main);
      UiSplitView.enhanceAll(elements.main);
      UiWindow.enhanceAll(elements.main);
      UiToolbar.enhanceAll(elements.main);
      UiWindow.decorateButtons(document);
      const mapContextMenu=document.getElementById("map_contextmenu");
      document.getElementById("map_editor")?.append(mapContextMenu);
      configureEditorHeaders();
      installFocusControls();
      renderNavigation();
      romEditor = new RomReader();
      romEditor.setGameBases(metadata.gba_roms);
      romEditor.setGbGameBases(metadata.gbc_roms);
      globalThis.RomEditor = romEditor;
      bookmarkStore=new BookmarkStore({element:Dom.byId("bookmarks"),onOpen:target=>openBookmark(target).catch(error=>notifyError("Bookmark",error))});
      Dom.byId("bookmark_add").addEventListener("click",()=>bookmarkStore.add(currentBookmark()));
      elements.emulatorToggle.addEventListener("click",()=>{
        const dock=document.getElementById("emulator_dock"),hidden=dock?.classList.toggle("is-user-hidden")??true;
        if(hidden)romEditor?.emulator_editor?.pause?.();
        else if(romEditor?.ReadOnlyMemory){
          if(romEditor.emulator_editor?.failed)romEditor.emulator_editor.retry().catch(error=>notifyError("Emulator",error));
          else if(!romEditor.emulator_editor){
            const status=document.getElementById("emulator_status");if(status)status.textContent="Starting mGBA with the loaded project ROM…";
            romEditor.ensureWorkspace("emulator").catch(error=>notifyError("Emulator",error));
          }
        }
        elements.emulatorToggle.setAttribute("aria-pressed",String(!hidden));
      });
      Dom.byId("settings_dock").addEventListener("click",()=>editorPreferences.open());
      elements.browse.textContent="Browse for a ROM";
      elements.browse.disabled = false;
      bindUploader();
      document.addEventListener("editorhistorychange",updateDirtyUi);
      document.addEventListener("editorpendingchange",updateDirtyUi);
      document.addEventListener("editorsaved",updateDirtyUi);
      window.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();RomExport.rom(romEditor).catch(error=>notifyError("ROM export",error));}});
      window.addEventListener("beforeunload",event=>{if(RomExport.summary(romEditor).dirty){event.preventDefault();event.returnValue="";}});
      document.addEventListener("editorlink",event=>openEditorLink(event.detail).catch(error=>notifyError("Editor link",error)));
      bootstrapComplete=true;
    }catch(error){
      notifyError("Startup error", error);
      Dom.setVisible(elements.lightbox,true);
      Dom.setVisible(elements.upload,true);
      Dom.setVisible(elements.loader,false);
      elements.browse.textContent="Retry startup";
      elements.browse.disabled=false;
      elements.browse.addEventListener("click",bootstrap,{once:true});
    }finally{
      bootstrapInProgress=false;
    }
  };

  document.addEventListener("DOMContentLoaded", bootstrap, {once: true});
})();
