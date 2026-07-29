class MapContextMenu {
  constructor(editor, canvas, {signal}={}) {
    this.editor = editor;
    this.canvas = canvas;
    this.element = document.getElementById("map_contextmenu");
    this.element.className = "map-block-menu";
    this.element.replaceChildren(this.build());
    canvas.addEventListener("contextmenu", (event) => this.open(event),{signal});
    document.addEventListener("pointerdown", (event) => {
      if(!this.element.contains(event.target) && event.target !== canvas) this.close();
    },{signal});
    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape") this.close();
    },{signal});
  }

  build() {
    const action = (label, name) => Dom.create("button", {
      className: "map_context_action",
      attributes: {type: "button", "data-action": name},
      text: label,
      events: {click: () => this.run(name)}
    });
    return Dom.create("div", {className: "map-block-menu__surface"}, [
      Dom.create("button", {className:"map-block-menu__close", text: "×", attributes: {type: "button", "aria-label": "Close"}, events: {click: () => this.close()}}),
      Dom.create("h3", {text: "Map block"}),
      Dom.create("div", {className: "map_context_details", attributes: {"aria-live": "polite"}}),
      Dom.create("div", {className: "map_context_event"}),
      action("Pick this block", "pick"),
      action("Fill region here", "fill"),
      action("Fill selected areas", "fill-selection"),
      action("Edit block properties", "properties"),
      action("Center view here", "center"),
      action("Copy coordinates", "copy")
    ]);
  }

  open(event) {
    event.preventDefault();
    const context=this.editor.contextAt?.(event)??null;
    const point=context?.point??this.editor.mouseToMapCoordinates?.(this.canvas,event.clientX,event.clientY);
    if(!point) return this.close();
    this.point=point;
    this.block=context?.block??this.editor.current_map?.getBlockIndex(point.x,point.y);
    if(this.block===undefined)return this.close();
    this.element.querySelector(".map_context_details").textContent = `X ${point.x} · Y ${point.y} · Block 0x${this.block.toString(16).toUpperCase()}`;
    const events=context?.events??this.editor.current_map?.findEvents(point.x,point.y,[0,1,2,3])??[];
    this.element.querySelector(".map_context_event").textContent = events.length
      ? `${events.length} event${events.length === 1 ? "" : "s"}: ${events.map(item=>item.eventType||item.constructor.name).join(", ")}`
      : "No event on this block";
    this.element.querySelectorAll("[data-action]").forEach(button=>{
      const name=button.dataset.action,enabled=this.editor.contextActionEnabled?.(name);
      button.classList.toggle("hide",name==="properties"?enabled!==true:enabled===false);
    });
    this.element.style.display = "block";
    const width = this.element.offsetWidth;
    const height = this.element.offsetHeight;
    this.element.style.left = `${Math.max(8, Math.min(event.clientX + 10, window.innerWidth - width - 8))}px`;
    this.element.style.top = `${Math.max(8, Math.min(event.clientY + 10, window.innerHeight - height - 8))}px`;
  }

  run(name) {
    if(!this.point) return;
    if(this.editor.runContextAction){this.editor.runContextAction(name,{point:this.point,block:this.block});this.close();return;}
    if(name === "pick") this.editor.selectInWindowBlock(this.block);
    if(name === "fill") {
      this.editor.fillRegionWith(this.editor.current_map, this.point.x, this.point.y, this.editor.selected_block);
      this.editor.render(this.editor.getMapContext(), true);
    }
    if(name === "fill-selection") {
      this.editor.selections.flatMap((selection)=>selection.cells()).forEach(({x,y})=>this.editor.setBlock(x,y,this.editor.current_map,this.editor.selected_block,false));
      this.editor.render(this.editor.getMapContext(),true);
    }
    if(name === "center") {
      const zoom = this.editor.camera.zoom;
      this.editor.camera.set(this.editor.camera.width / 2 - this.point.x * 16 * zoom, this.editor.camera.height / 2 - this.point.y * 16 * zoom);
      this.editor.render(this.editor.getMapContext(), true);
    }
    if(name === "copy") navigator.clipboard?.writeText(`${this.point.x},${this.point.y}`);
    this.close();
  }

  close() {
    this.element.style.display = "none";
  }
}
