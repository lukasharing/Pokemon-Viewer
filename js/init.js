(function(){
  "use strict";

  const WORKSPACES = [
    {file: "hex.html", id: "hex_editor", label: "hex", icon: "hex", families:["gba","gb"]},
    {file: "code.html", id: "code_workspace", label: "code", icon: "code", families:["gba","gb"]},
    {file: "map.html", id: "map_editor", label: "map", icon: "map", families:["gba","gb"]},
    {file: "sprite.html", id: "sprite_editor", label: "sprite", icon: "sprite", families:["gba","gb"]},
    {file: "battle.html", id: "battle_editor", label: "battle", icon: "code", families:["gba","gb"]}
    ,{file: "pokedex.html", id: "pokedex_editor", label: "pokedex", icon: "code", families:["gba","gb"]}
    ,{file: "moves.html", id: "move_editor", label: "moves", icon: "code", families:["gba","gb"]}
    ,{file: "sound.html", id: "sound_editor", label: "sound", icon: "code", families:["gba","gb"]}
    ,{file: "animation.html", id: "animation_editor", label: "animation", icon: "code", families:["gba","gb"]}
    ,{file: "encounters.html", id: "encounter_editor", label: "encounters", icon: "map", families:["gba","gb"]}
    ,{file: "items.html", id: "item_editor", label: "items", icon: "sprite", families:["gba","gb"]}
  ];

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
  const helpMenu = (label,file,extras=[]) => ({label:"Help",children:[
    {label:`${label} guide`,action:()=>openGuide(file)},
    ...extras.map(item=>({label:item.label,action:()=>openGuide(item.file)})),
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
    const configurations={
      hex_editor:{title:"Hex editor",menus:[
        fileMenu(),
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
        {label:"Go",complexity:"advanced",children:[{label:"Memory offset…",action:()=>document.getElementById("memory_search")?.querySelector("input")?.focus()}]},
        experienceMenu(),helpMenu("Hex editor","HEX_EDITOR.md")
      ]},
      code_workspace:{title:"Code editor",menus:[
        fileMenu(),
        {label:"Edit",children:[{label:"Undo",shortcut:"⌘Z",action:()=>romEditor?.code_editor?.undo?.()},{label:"Redo",shortcut:"⇧⌘Z",action:()=>romEditor?.code_editor?.redo?.()}]},
        {label:"Go",complexity:"advanced",children:[{label:"ROM offset…",action:()=>document.getElementById("code_offset")?.focus()}]},
        {label:"View",children:[
          {label:"Event / text source",checked:()=>romEditor?.code_editor?.isView?.("script"),action:()=>romEditor?.code_editor?.setView?.("script")},
          {label:"Original CPU code",checked:()=>romEditor?.code_editor?.isView?.("original"),action:()=>romEditor?.code_editor?.setView?.("original")}
        ]},
        experienceMenu(),helpMenu("Code editor","CODE_EDITOR.md",[{label:"Script language reference",file:"SCRIPT_LANGUAGE.md"}])
      ]},
      sprite_editor:{title:"Sprite editor",menus:[
        fileMenu(),
        {label:"Edit",children:[{label:"Undo",shortcut:"⌘Z",action:()=>romEditor?.sprite_editor?.undo?.()},{label:"Redo",shortcut:"⇧⌘Z",action:()=>romEditor?.sprite_editor?.redo?.()}]},
        {label:"View",children:[
          {label:"Zoom in",shortcut:"+",action:()=>romEditor?.sprite_editor?.zoomBy?.(1),disabled:()=>romEditor?.sprite_editor?.canZoom?.(1)===false},
          {label:"Zoom out",shortcut:"−",action:()=>romEditor?.sprite_editor?.zoomBy?.(-1),disabled:()=>romEditor?.sprite_editor?.canZoom?.(-1)===false},
          {label:"Actual pixels",action:()=>romEditor?.sprite_editor?.setZoom?.(1)},
          {separator:true},
          {label:"Pixel / tile grid",checked:()=>romEditor?.sprite_editor?.isGridVisible?.(),action:()=>romEditor?.sprite_editor?.toggleGrid?.()}
        ]},
        experienceMenu(),helpMenu("Sprite editor","SPRITE_EDITOR.md")
      ]},
      battle_editor:{title:"Battle editor",menus:[
        fileMenu(),
        {label:"View",children:[
          {label:"Pixel grid",checked:()=>romEditor?.battle_editor?.isGridVisible?.(),action:()=>romEditor?.battle_editor?.toggleGrid?.()}
        ]},
        {label:"Go",children:[
          {label:"Open animation code",action:()=>romEditor?.battle_editor?.openCode?.(),disabled:()=>!romEditor?.battle_editor?.activeAnimation?.()},
          {label:"Open battle sprite",action:()=>romEditor?.battle_editor?.openSprite?.(),disabled:()=>!romEditor?.battle_editor?.activeSprite?.()}
        ]},
        experienceMenu()
      ]},
      pokedex_editor:{title:"Pokédex editor",menus:[
        fileMenu(),
        projectEditMenu(),
        {label:"View",children:[
          {label:"Open description",action:()=>romEditor?.pokedex_editor?.openText?.(),disabled:()=>!Number.isInteger(romEditor?.pokedex_editor?.current?.descriptionOffset)},
          {label:"Open sprite data",action:()=>romEditor?.pokedex_editor?.openSprite?.(),disabled:()=>!romEditor?.pokedex_editor?.current},
          {label:"Open cry",action:()=>romEditor?.pokedex_editor?.openSound?.(),disabled:()=>!romEditor?.pokedex_editor?.current||!romEditor?.capabilities?.get("sound_editor")?.ordinary}
        ]},
        experienceMenu(),helpMenu("Pokédex editor","POKEDEX_EDITOR.md")
      ]},
      move_editor:{title:"Move editor",menus:[
        fileMenu(),
        projectEditMenu(),
        {label:"Go",children:[
          {label:"Find move…",action:()=>document.getElementById("move_filter")?.focus()},
          {label:"Open raw record",action:()=>romEditor?.move_editor?.openData?.(),disabled:()=>!romEditor?.move_editor?.current}
        ]},
        experienceMenu(),helpMenu("Move editor","MOVE_EDITOR.md")
      ]},
      sound_editor:{title:"Sound editor",menus:[
        fileMenu(),
        {label:"Go",children:[{label:"Find sound…",action:()=>document.getElementById("sound_filter")?.focus()}]},
        experienceMenu(),helpMenu("Sound editor","SOUND_EDITOR.md")
      ]},
      animation_editor:{title:"Animation editor",menus:[
        fileMenu(),
        {label:"View",children:[
          {label:"Play timeline",action:()=>romEditor?.animation_editor?.play?.(),disabled:()=>!romEditor?.animation_editor?.canPlay?.()},
          {label:"Pause timeline",action:()=>romEditor?.animation_editor?.pause?.()},
          {label:"Previous frame",action:()=>romEditor?.animation_editor?.step?.(-1)},
          {label:"Next frame",action:()=>romEditor?.animation_editor?.step?.(1)}
        ]},
        experienceMenu(),helpMenu("Animation editor","ANIMATION_EDITOR.md")
      ]},
      encounter_editor:{title:"Encounter editor",menus:[
        fileMenu(),projectEditMenu(),
        {label:"Go",children:[
          {label:"Find map…",action:()=>document.getElementById("encounter_filter")?.focus()},
          {label:"Open map",action:()=>romEditor?.encounter_editor?.openMap?.(),disabled:()=>!romEditor?.encounter_editor?.current},
          {label:"Open raw table",action:()=>romEditor?.encounter_editor?.openData?.(),disabled:()=>!romEditor?.encounter_editor?.current}
        ]},
        experienceMenu(),helpMenu("Encounter editor","ENCOUNTER_EDITOR.md")
      ]},
      item_editor:{title:"Item editor",menus:[
        fileMenu(),projectEditMenu(),
        {label:"Go",children:[
          {label:"Find item…",action:()=>document.getElementById("item_filter")?.focus()},
          {label:"Open graphic",action:()=>romEditor?.item_editor?.current&&EditorLinks.optional(romEditor.item_editor.driver.spriteLink?.(romEditor.item_editor.current))}
        ]},
        experienceMenu(),helpMenu("Item editor","ITEM_EDITOR.md")
      ]}
    };
    Object.entries(configurations).forEach(([id,configuration])=>EditorHeader.attach(`#${id}`,configuration));
    EditorHeader.attach("#map_editor",{title:"Map editor",menus:[
      fileMenu(),
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
      ]},
      experienceMenu(),
      helpMenu("Map editor","MAP_EDITOR.md")
    ]});
    const mapEditor=document.getElementById("map_editor");
    mapEditor.addEventListener("uiwindowchange",()=>mapEditor.editorHeader?.render());
    const codeEditor=document.getElementById("code_workspace");
    codeEditor.addEventListener("codeviewchange",()=>codeEditor.editorHeader?.render());
    const spriteEditor=document.getElementById("sprite_editor");
    spriteEditor.addEventListener("spriteviewchange",()=>spriteEditor.editorHeader?.render());
    const battleEditor=document.getElementById("battle_editor");
    battleEditor.addEventListener("battleviewchange",()=>battleEditor.editorHeader?.render());
    const pokedexEditor=document.getElementById("pokedex_editor");
    pokedexEditor.addEventListener("pokedexviewchange",()=>pokedexEditor.editorHeader?.render());
    const moveEditor=document.getElementById("move_editor");
    moveEditor.addEventListener("moveviewchange",()=>moveEditor.editorHeader?.render());
    const animationEditor=document.getElementById("animation_editor");
    animationEditor.addEventListener("animationviewchange",()=>animationEditor.editorHeader?.render());
    const hexEditor=document.getElementById("hex_editor");
    hexEditor.addEventListener("hexviewchange",()=>hexEditor.editorHeader?.render());
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
      if(visible?.id==="map_editor")romEditor?.map_editor?.activate?.({initial:false});
      else if(visible?.id==="battle_editor")romEditor?.battle_editor?.activate?.({initial:false});
      else if(visible?.id==="animation_editor")romEditor?.animation_editor?.activate?.({initial:false});
      else if(visible?.id==="hex_editor")romEditor?.hex_editor?.go?.(romEditor.hex_editor.current);
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
    const workspace=document.querySelector("#navigation .viewer_in")?.dataset.workspace||"hex_editor",target={workspace,family:romEditor?.family,project:ProjectIdentity.capture(romEditor)};
    if(workspace==="map_editor"){
      Object.assign(target,romEditor?.map_editor?.bookmark?.()||{title:"Map"});
    }else if(workspace==="code_workspace"){
      const active=romEditor?.code_editor?.active;target.offset=active?.offset||0;target.view=active?.viewer;target.scriptKind=active?.scriptKind;target.mode=active?.mode;
      target.title=`${active?.viewer==="script"?(active.scriptKind||"script"):"code"} ${target.offset.toString(16).toUpperCase()}`;
    }
    else if(workspace==="hex_editor"){target.offset=romEditor?.hex_editor?.current||0;target.title=`Offset ${target.offset.toString(16).toUpperCase()}`;}
    else if(workspace==="sprite_editor")Object.assign(target,romEditor?.sprite_editor?.bookmark?.()||{title:"Sprite"});
    return target;
  };

  const openBookmark = async target => {
    ProjectIdentity.assertCompatible(target.project||(target.family?{family:target.family}:null),romEditor);
    const workspace=WORKSPACES.find(item=>item.id===target.workspace);if(!workspace)return;const link=elements.navigation.querySelector(`[data-workspace='${workspace.id}']`);await switchWorkspace(workspace,link);
    if(workspace.id==="map_editor")romEditor.map_editor?.restoreBookmark?.(target);
    else if(workspace.id==="code_workspace"){
      if(target.mode)romEditor.code_editor.elements.mode.value=target.mode;
      romEditor.code_editor?.open(target.offset||0,false,{view:target.view,scriptKind:target.scriptKind});
    }
    else if(workspace.id==="hex_editor")romEditor.hex_editor?.go(target.offset||0);
    else if(workspace.id==="sprite_editor")romEditor.sprite_editor?.restoreBookmark?.(target);
  };

  const openEditorLink = async (request={}) => {
    const {workspace:workspaceId,offset=0,view,reference,scriptKind}=request;
    const workspace=WORKSPACES.find(item=>item.id===workspaceId),link=elements.navigation.querySelector(`[data-workspace='${workspaceId}']`);if(!workspace||!link)return;
    if(link.classList.contains("disabled")){
      const capability=romEditor?.capabilities?.get?.(workspaceId);
      throw new Error(capability?`${capability.label}: ${capability.reason}`:"This editor is not available for the loaded ROM.");
    }
    await switchWorkspace(workspace,link);
    if(workspaceId==="code_workspace")romEditor.code_editor?.open(offset,false,{view:view||"original",reference,scriptKind});
    if(workspaceId==="hex_editor")romEditor.hex_editor?.go?.(offset);
    if(workspaceId==="sprite_editor")romEditor.sprite_editor.open(request);
    if(workspaceId==="battle_editor"){if(request.encounter)romEditor.battle_editor?.openEncounter?.(request.encounter);else romEditor.battle_editor?.openTrainer?.(request.trainer);}
    if(workspaceId==="pokedex_editor"&&Number.isInteger(request.species)&&request.species>0)romEditor.pokedex_editor?.open?.(request.species);
    if(workspaceId==="move_editor"&&Number.isInteger(request.move))romEditor.move_editor?.open?.(request.move);
    if(workspaceId==="sound_editor")romEditor.sound_editor?.open?.(request);
    if(workspaceId==="animation_editor")romEditor.animation_editor?.open?.(request);
    if(workspaceId==="encounter_editor")romEditor.encounter_editor?.open?.(request.encounter||request);
    if(workspaceId==="item_editor"&&Number.isInteger(request.item))romEditor.item_editor?.open?.(request.item);
    if(workspaceId==="map_editor"&&Number.isInteger(request.bank)&&Number.isInteger(request.map))romEditor.map_editor?.navigateToMap?.(request.bank,request.map);
    else if(workspaceId==="map_editor"&&Number.isInteger(request.group)&&Number.isInteger(request.map))romEditor.map_editor?.select?.(`${request.group}:${request.map}`);
    if(workspaceId==="map_editor"&&Number.isInteger(request.mapId))romEditor.map_editor?.select?.(request.mapId);
  };

  const switchWorkspace = async (workspace, link) => {
    if(!romEditor?.ReadOnlyMemory || link.classList.contains("disabled")) return;
    const transition=++workspaceTransition;
    const instances={map_editor:"map_editor",code_workspace:"code_editor",sprite_editor:"sprite_editor",battle_editor:"battle_editor",pokedex_editor:"pokedex_editor",move_editor:"move_editor",sound_editor:"sound_editor",animation_editor:"animation_editor",encounter_editor:"encounter_editor",item_editor:"item_editor",hex_editor:"hex_editor"};
    const firstOpen=!romEditor[instances[workspace.id]];
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

      if(workspace.id === "hex_editor" && romEditor.hex_editor){
        romEditor.hex_editor.go(romEditor.hex_editor.current);
      }
      if(workspace.id==="map_editor")romEditor.map_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="battle_editor")romEditor.battle_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="pokedex_editor")romEditor.pokedex_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="move_editor")romEditor.move_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="sound_editor")romEditor.sound_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="animation_editor")romEditor.animation_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="encounter_editor")romEditor.encounter_editor?.activate?.({initial:firstOpen});
      if(workspace.id==="item_editor")romEditor.item_editor?.activate?.({initial:firstOpen});
    }catch(error){
      if(transition!==workspaceTransition)return false;
      link.classList.remove("viewer_in");document.getElementById(workspace.id)?.classList.add("hide");
      if(previousLink&&previousWorkspace){previousLink.classList.add("viewer_in");document.getElementById(previousWorkspace)?.classList.remove("hide");}
      throw error;
    }
  };

  const renderNavigation = () => {
    const links = WORKSPACES.map((workspace) => {
      let link;
      link = Dom.create("a", {
        className: `icon-${workspace.icon} disabled`,
        attributes: {href: "#","aria-disabled":"true",title:"Load a ROM to open this editor."},
        dataset: {workspace: workspace.id, families: workspace.families.join(",")},
        events: {click: (event) => {
          event.preventDefault();
          switchWorkspace(workspace, link).catch((error) => notifyError("Editor error", error));
        }}
      }, [
        Dom.create("span", {text: `${workspace.label} editor`}),
        Dom.create("small",{className:"workspace-capability",text:""})
      ]);
      return link;
    });
    elements.navigation.replaceChildren(Dom.fragment(links));
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
      elements.navigation.querySelectorAll("[data-workspace]").forEach(link=>{
        link.classList.add("disabled");link.classList.remove("is-partial");
        link.removeAttribute("data-capability");
        link.setAttribute("aria-disabled","true");link.title="Load a ROM to open this editor.";
        const badge=link.querySelector(".workspace-capability");if(badge)badge.textContent="";
      });
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
      document.querySelectorAll("#navigation [data-families]").forEach((link) => {
        const capability=detail.capabilities?.get?.(link.dataset.workspace);
        const supported=link.dataset.families.split(",").includes(detail.family)&&(detail.workspaces?.includes(link.dataset.workspace)??true);
        link.classList.toggle("disabled",!supported);
        link.classList.toggle("is-partial",capability?.state==="partial");
        link.dataset.capability=capability?.state||"unavailable";
        link.setAttribute("aria-disabled",String(!supported));
        const badge=link.querySelector(".workspace-capability");
        if(badge)badge.textContent=capability?.label||"Unavailable";
        link.title=capability?.reason||`Not available for ${detail.platform}.`;
      });
	  const hexLink = elements.navigation.querySelector("[data-workspace='hex_editor']");
	  switchWorkspace(WORKSPACES[0], hexLink).catch((error) => notifyError("Editor error", error));
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
        loadResources(WORKSPACES.map(({file}) => file)),
        loadResources(["emulator.html"]),
        loadResources(["json/games.json"])
      ]);
      const metadata=JSON.parse(metadataFiles[0].result);

      elements.main.replaceChildren();
      document.getElementById("emulator_dock")?.remove();
      elements.main.insertAdjacentHTML("beforeend", fragments.map(({result}) => result).join(""));
      document.body.insertAdjacentHTML("beforeend",emulatorFragment[0].result);
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
