class MapEventInspector {
  static descriptions={
    offset:"Position of this structure inside the ROM file.",
    sourceOffset:"ROM position from which this event structure was decoded.",
    scriptOffset:"ROM position of the event script executed by this event.",
    scriptPointer:"Pointer to the event script after converting its console address.",
    textId:"Index into the current map's table of text pointers.",
    textAddress:"Original 16-bit banked address stored in the map text table.",
    textPointer:"Resolved ROM position containing this event's text.",
    spriteId:"Graphics identifier used to select the overworld sprite.",
    movement:"Movement behavior executed by an overworld object.",
    rangeOrDirection:"Packed Gen I field describing movement range or fixed direction.",
    kind:"High bits of the Gen I text identifier; they distinguish normal objects, trainers, and items.",
    trainerClassOrItem:"Trainer-class identifier or item identifier, depending on the event kind.",
    trainerNumberOrLevel:"Trainer number or item level/value, depending on the event kind.",
    trainerClass:"Trainer class identifier used to select the opponent data.",
    trainerNumber:"Trainer index inside the selected trainer class.",
    itemId:"Item identifier awarded when this object is collected.",
    destinationWarpId:"Warp index used at the destination map.",
    destinationMap:"Map identifier reached by this warp.",
    localId:"Identifier used by scripts to address this object inside the map.",
    elevation:"Map elevation/layer on which the event can be activated.",
    movementType:"GBA movement behavior assigned to the object.",
    movementRangeX:"Horizontal distance the object may move from its origin.",
    movementRangeY:"Vertical distance the object may move from its origin.",
    trainerType:"Determines whether and how this object starts a trainer battle.",
    trainerRange:"Distance at which a trainer detects the player.",
    flagId:"Persistent flag controlling whether this event is visible or active."
  };
  constructor(editor, container) {
    this.editor = editor;
    this.container = container;
    this.element = Dom.create("aside", {className: "map-event-inspector hide", attributes:{"aria-live":"polite"}});
    container.append(this.element);
    this.window=new UiWindow({element:this.element,title:"Event properties",icon:"◆",onClose:()=>this.close()});
  }

  show(event, point, clientX, clientY) {
    this.current=event||null;
    const title = event ? event.eventType||event.constructor.name : "No event";
    const values = event ? this.values(event) : {x:point.x, y:point.y, message:"This block has no object, warp, script, or signpost."};
    const formatted=Object.fromEntries(Object.entries(values).map(([key,value])=>[this.label(key),this.format(key,value)]));
    const groups=[
      ["eventType","eventIndex"],["offset","size"],["sourceOffset","localId"],
      ["x","y"],["spriteId","movement"],["movementType","rangeOrDirection"],
      ["movementRangeX","movementRangeY"],["elevation","flagId"],
      ["destinationMap","destinationWarpId"],["trainerType","trainerRange"],
      ["trainerClass","trainerNumber"],["itemId","kind"],"textId",
      ["scriptOffset","scriptPointer"],["textAddress","textPointer"],
      "textPreview","message"
    ].map(group=>Array.isArray(group)?group.map(key=>this.label(key)):this.label(group));
    const script=values.scriptOffset??values.script??values.scriptPointer,text=values.textPointer,sprite=values.spriteOffset??values.spritePointer;
    const scriptReference=this.editor.codeReference?.(event,"script",values)??event?.$codeReference;
    const textReference=this.editor.codeReference?.(event,"text",values)??event?.$textReference;
    const typed=(this.editor.eventActions?.(event)||[]).map(action=>UiWindow.button(action.label,{icon:action.icon,onClick:()=>{action.run();if(action.close!==false)this.close();}})),editable=this.editor.eventFields?.(event)||[];
    const actions=[
      ...typed,
      editable.length?UiWindow.button("Edit properties",{icon:"✎",onClick:()=>this.edit(event,editable)}):null,
      script!==undefined?UiWindow.button("Open script",{icon:"⌘",onClick:()=>EditorLinks.code(script,{view:event?.$codeView||"script",reference:scriptReference,scriptKind:event?.$codeKind||"event"})}):null,
      text!==undefined?UiWindow.button("Open text",{icon:"T",onClick:()=>EditorLinks.code(text,{view:"script",reference:textReference,scriptKind:event?.$textKind||"text"})}):null,
      sprite!==undefined?UiWindow.button("Open sprite",{icon:"fa-image",onClick:()=>EditorLinks.sprite({offset:sprite})}):null
    ].filter(Boolean);
    let preview=null,spriteId=values.sprite??values.spriteId;
    if(spriteId!==undefined&&this.editor.getOverworldSprite)try{preview=PokemonViewer.maps.movement?.createPreview(this.editor,event,this.editor.family||this.editor.options?.family||(/movement_type/.test(Object.keys(values).join(" "))?"gba":"gbc"));}catch{}
    const descriptions=Object.fromEntries(Object.keys(values).map(key=>[this.label(key),MapEventInspector.descriptions[key]]).filter(([,description])=>description));
    const technical=["offset","size","sourceOffset","scriptOffset","scriptPointer","textAddress","textPointer"],complexity=Object.fromEntries(technical.filter(key=>values[key]!==undefined).map(key=>[this.label(key),"advanced"]));
    this.window.setTitle(title).setContent([preview,UiWindow.table(formatted,descriptions,{columns:2,layout:groups,complexity})].filter(Boolean)).setFooter(actions).show();
    const bounds=this.container.getBoundingClientRect();
    const left=Math.max(8,Math.min(clientX-bounds.left+12,bounds.width-this.element.offsetWidth-8));
    const top=Math.max(8,Math.min(clientY-bounds.top+12,bounds.height-this.element.offsetHeight-8));
    Object.assign(this.element.style,{left:`${left}px`,top:`${top}px`});
  }

  values(event) {
    const primitives=(source)=>Object.entries(source||{}).filter(([key,value]) => !key.startsWith("$")&&["string","number","boolean"].includes(typeof value));
    const hidden=event.properties?.hiddenItem;
    return Object.fromEntries([...primitives(event.properties),...primitives(event),...(hidden?[["hiddenItemId",hidden.hiddenItemId],["hiddenItem",hidden.item]]:[])]);
  }
  label(key) { return key.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2"); }
  format(key,value) { return typeof value === "number" && /offset|script|special|status/i.test(key) ? `0x${value.toString(16).toUpperCase()}` : String(value); }
  async edit(event,fields){
    const values=await AppDialog.form({
      title:`Edit ${event.constructor.name}`,
      message:"Changes are written to the ROM event structure and can be undone.",
      fields:fields.map(field=>({name:field.key,label:field.label,type:"number",value:field.value,min:field.min,max:field.max,step:1,fullWidth:false})),
      submitLabel:"Apply changes"
    });
    if(!values)return false;
    try{this.editor.updateEventFields(event,values);this.close();return true;}
    catch(error){NotificationHandler.pop("Event edit",error.message||String(error),NotificationType.ERROR);return false;}
  }
  close() { this.current=null;this.window.hide(); }
}
((globalThis.PokemonViewer ||= {}).maps ||= {}).EventInspector=MapEventInspector;
