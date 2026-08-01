(function(global){
  "use strict";

  class MapScene{
    constructor(cellSize=16){this.cellSize=cellSize;this.nodes=[];this.ids=new Set();}
    add(node){if(this.ids.has(node.id))return false;this.ids.add(node.id);this.nodes.push(node);return true;}
    layout({currentId,maxNodes=64,maxDimension=8192,maxPixels=12*1024*1024}={}){
      if(!this.nodes.length)throw new Error("A map scene requires at least one map.");
      const current=this.nodes.find(node=>node.id===currentId||node.current)||this.nodes[0],center={x:current.x+current.width/2,y:current.y+current.height/2};
      const candidates=[...this.nodes].sort((a,b)=>{
        if(a===current)return-1;if(b===current)return 1;
        const da=(a.x+a.width/2-center.x)**2+(a.y+a.height/2-center.y)**2,db=(b.x+b.width/2-center.x)**2+(b.y+b.height/2-center.y)**2;
        return da-db;
      });
      const accepted=[];let bounds=null;
      for(const node of candidates){
        const next=bounds?{minX:Math.min(bounds.minX,node.x),minY:Math.min(bounds.minY,node.y),maxX:Math.max(bounds.maxX,node.x+node.width),maxY:Math.max(bounds.maxY,node.y+node.height)}:{minX:node.x,minY:node.y,maxX:node.x+node.width,maxY:node.y+node.height};
        const width=(next.maxX-next.minX)*this.cellSize,height=(next.maxY-next.minY)*this.cellSize;
        if(accepted.length&&((accepted.length>=maxNodes)||width>maxDimension||height>maxDimension||width*height>maxPixels))continue;
        if(!accepted.length&&(width>maxDimension||height>maxDimension||width*height>maxPixels))throw new RangeError(`Map ${node.id} requires an unsafe ${width} × ${height} canvas.`);
        accepted.push(node);bounds=next;
      }
      this.allNodes=this.nodes;this.nodes=accepted;this.omitted=this.allNodes.length-accepted.length;
      this.origin={x:-bounds.minX,y:-bounds.minY};this.width=(bounds.maxX-bounds.minX)*this.cellSize;this.height=(bounds.maxY-bounds.minY)*this.cellSize;
      return this;
    }
    resize(canvas){canvas.width=this.width;canvas.height=this.height;return this;}
    ordered(currentId){return[...this.nodes].sort((a,b)=>Number(a.id===currentId)-Number(b.id===currentId));}
    visibleBounds(canvas,viewport,overscan=96){
      if(!viewport)return{x:0,y:0,width:canvas.width,height:canvas.height};
      const zoom=Math.max(.01,Number(canvas.dataset.zoom)||canvas.getBoundingClientRect().width/canvas.width||1);
      return{x:Math.max(0,viewport.scrollLeft/zoom-overscan),y:Math.max(0,viewport.scrollTop/zoom-overscan),width:viewport.clientWidth/zoom+overscan*2,height:viewport.clientHeight/zoom+overscan*2};
    }
    intersects(node,bounds){const x=(node.x+this.origin.x)*this.cellSize,y=(node.y+this.origin.y)*this.cellSize,w=node.width*this.cellSize,h=node.height*this.cellSize;return x<bounds.x+bounds.width&&x+w>bounds.x&&y<bounds.y+bounds.height&&y+h>bounds.y;}
    static blockRange(width,height,originX,originY,bounds,blockSize=32){
      return{
        left:Math.max(0,Math.floor((bounds.x-originX)/blockSize)),
        top:Math.max(0,Math.floor((bounds.y-originY)/blockSize)),
        right:Math.min(width,Math.ceil((bounds.x+bounds.width-originX)/blockSize)),
        bottom:Math.min(height,Math.ceil((bounds.y+bounds.height-originY)/blockSize))
      };
    }
    render(canvas,draw,{before,viewport}={}){
      const context=canvas.getContext("2d"),bounds=this.visibleBounds(canvas,viewport);
      context.clearRect(bounds.x,bounds.y,bounds.width,bounds.height);before?.(context,this,bounds);
      for(const node of this.ordered(this.nodes.find(item=>item.current)?.id))if(this.intersects(node,bounds))draw(context,node,(node.x+this.origin.x)*this.cellSize,(node.y+this.origin.y)*this.cellSize,bounds);
      return this;
    }
    drawBounds(canvas,{currentId,label,viewport}={}){
      const context=canvas.getContext("2d"),bounds=this.visibleBounds(canvas,viewport);
      for(const node of this.ordered(currentId)){if(!this.intersects(node,bounds))continue;const x=(node.x+this.origin.x)*this.cellSize,y=(node.y+this.origin.y)*this.cellSize,w=node.width*this.cellSize,h=node.height*this.cellSize;MapUtils.drawMapFrame(context,{x,y,width:w,height:h},{current:node.id===currentId,label:label?.(node)||""});}
      return this;
    }
  }

  class MapWorkspace{
    static wheelDelta(event){return GestureZoom.delta(event);}
    static wheelFactor(event){return GestureZoom.factor(event);}
    constructor(root,family){
      this.root=typeof root==="string"?document.querySelector(root):root;
      this.family=family;
      this.visualization=this.root.querySelector("#map_visualization");
      this.canvas=this.root.querySelector("#canvas_map");
      this.viewport=this.visualization.querySelector(":scope > .map-viewport");
      if(!this.viewport){this.viewport=Dom.create("div",{className:"map-viewport"});this.canvas.replaceWith(this.viewport);this.viewport.append(this.canvas);}
      this.regionCanvas=Dom.create("canvas",{className:"region-map-canvas hide",attributes:{width:"240",height:"160",tabindex:"0","aria-label":"Minimap"}});
      this.viewport.append(this.regionCanvas);
      this.regionZoom=3;
      this.regionShowGrid=false;this.regionShowLocations=true;
      this.regionTool="select";this.regionLayer="locations";this.regionCell=null;this.regionTile=null;this.regionDocument=null;
      this.bindRegionGestures();
      this.onRegionGraphicsChange=event=>{
        if(!this.regionMap)return;const source=this.regionMap.tileEditorSource?.(),offsets=event.detail?.offsets||[],touchesTiles=source&&offsets.some(offset=>offset>=source.offset&&offset<source.offset+source.bytes.length);
        if(!event.detail?.regionMap&&!touchesTiles)return;this.regionMap.reload?.();this.regionDocument=null;this.refreshRegionDocument();if(this.viewMode==="region")this.renderRegionMap();
      };
      document.addEventListener("romgraphicschange",this.onRegionGraphicsChange);
      if(typeof ResizeObserver==="function"){
        this.regionResizeObserver=new ResizeObserver(()=>{if(this.viewMode==="region")this.setRegionZoom(this.regionZoom);});
        this.regionResizeObserver.observe(this.viewport);
      }
      this.sidebar=this.root.querySelector("#map_banks");
      this.tilesetCanvas=this.root.querySelector("#blocks_map");
      this.root.dataset.mapFamily=family;
      this.visualization.querySelectorAll(":scope > *").forEach(element=>element.classList.remove("family-unavailable"));
      this.root.querySelectorAll("[data-map-families]").forEach(element=>element.classList.toggle("family-unavailable",!element.dataset.mapFamilies.split(/\s+/).includes(family)));
      this.sidebar.classList.add("ui-panel","ui-panel--vertical","ui-panel-stack");
      this.navigation=Dom.create("div",{className:"map-navigation map-sidebar-panel ui-panel ui-panel--fill",attributes:{"data-panel":"maps","data-map-context":"map"}});
      this.history=Dom.create("section",{className:"map-history map-sidebar-panel ui-panel",attributes:{"data-panel":"history","data-map-context":"map"}});
      this.encounters=Dom.create("section",{className:"map-encounters ui-panel hide",attributes:{"aria-label":"Map encounters","data-map-context":"map"}});
      this.properties=Dom.create("aside",{className:"map-properties map-sidebar-panel ui-panel ui-panel--bounded",attributes:{"data-panel":"properties","data-map-context":"adaptive"}});
      this.sidebarTabs=new UiPanelTabs({label:"Map information",selected:"maps",items:[
        {id:"maps",label:"Maps",icon:"fa-map",panel:this.navigation},
        {id:"properties",label:"Details",icon:"fa-sliders",panel:this.properties},
        {id:"encounters",label:"Encounters",icon:"fa-paw",panel:this.encounters,disabled:true},
        {id:"history",label:"History",icon:"fa-clock-rotate-left",panel:this.history}
      ]});
      this.sidebar.replaceChildren(this.sidebarTabs.element,this.navigation,this.properties,this.encounters,this.history);
      this.sidebarTabs.setDisabled("encounters",true);
      this.onEncounterPanelChange=event=>this.sidebarTabs.setDisabled("encounters",!event.detail?.count);
      this.root.addEventListener("encounterpanelchange",this.onEncounterPanelChange);
      this.consolidateMapToolboxes();
      this.createRegionToolbar();
      this.windowManager=MapWindowManager.for(this.root,family);
      this.createViewToggle();
    }
    consolidateMapToolboxes(){
      const tools=this.visualization.querySelector('[data-window-title="Tools"],.editor-toolbox[data-toolbox="Map tools"],.editor-toolbox[data-toolbox="Minimap tools"]'),navigation=this.visualization.querySelector('[data-window-title="Navigation"]');
      if(tools?.classList.contains("editor-toolbox--vertical")){
        this.mapToolbox=tools;this.mapToolsContent=tools.querySelector(":scope > .editor-toolbox__content:not(.region-tools__content)");return this;
      }
      const target=tools?.querySelector(":scope > .window_content"),source=navigation?.querySelector(":scope > .window_content");
      if(!target||!source)return this;
      target.append(Dom.create("span",{className:"map-tools__separator","aria-hidden":"true"}),...source.childNodes);
      navigation.remove();tools.querySelector(":scope > .window_menu")?.remove();target.classList.remove("window_content","hide");target.classList.add("editor-toolbox__content");
      tools.classList.remove("window");tools.classList.add("editor-toolbox--vertical","editor-toolbox--floating");tools.dataset.toolbox="Map tools";delete tools.dataset.windowTitle;tools.setAttribute("role","toolbar");tools.setAttribute("aria-label","Map tools");tools.style.removeProperty("left");tools.style.removeProperty("width");
      this.mapToolbox=tools;this.mapToolsContent=target;return this;
    }

    createViewToggle(){
      this.viewToggle=Dom.create("div",{className:"map-view-toggle",attributes:{role:"group","aria-label":"Map view"}},[
        Dom.create("button",{text:"Map",attributes:{type:"button","aria-pressed":"true"},dataset:{mapView:"map"},events:{click:()=>this.setViewMode("map")}}),
        Dom.create("button",{text:"Minimap",attributes:{type:"button","aria-pressed":"false",disabled:""},dataset:{mapView:"region"},events:{click:()=>this.setViewMode("region")}})
      ]);
      this.visualization.append(this.viewToggle);this.setViewMode("map",{notify:false});
    }
    createRegionToolbar(){
      if(!this.mapToolbox)throw new Error("Map toolbox is unavailable for Minimap tools.");
      const button=(id,label,icon,action)=>Dom.create("button",{className:"region-tool",attributes:{type:"button",title:label,"aria-label":label},dataset:{regionTool:id},events:{click:action}},[UiWindow.icon(icon),Dom.create("span",{text:label})]);
      this.regionToolbar=Dom.create("div",{className:"region-tools__content editor-toolbox__content hide"},[
        button("select","Select cell","fa-arrow-pointer",()=>this.setRegionTool("select")),
        button("paint","Paint tile","fa-paintbrush",()=>this.setRegionTool("paint")),
        button("pick","Pick tile","fa-eye-dropper",()=>this.setRegionTool("pick")),
        Dom.create("span",{className:"region-tools__separator"}),
        button("tiles","Tile layer","fa-table-cells-large",()=>this.setRegionLayer("tiles")),
        button("locations","Fly locations","fa-location-dot",()=>this.setRegionLayer("locations")),
        button("grid","Tile grid","fa-border-all",()=>{this.regionShowGrid=!this.regionShowGrid;this.renderRegionMap();this.updateRegionActions();}),
        Dom.create("span",{className:"region-tools__separator"}),
        button("zoom-out","Zoom out","fa-magnifying-glass-minus",()=>this.setRegionZoom(this.regionZoom-1)),
        button("actual","Native size","fa-expand",()=>this.setRegionZoom(1)),
        button("zoom-in","Zoom in","fa-magnifying-glass-plus",()=>this.setRegionZoom(this.regionZoom+1))
      ]);
      this.mapToolbox.append(this.regionToolbar);
    }
    setRegionTool(tool){
      if(!["select","paint","pick"].includes(tool))return false;
      if(tool==="paint"&&!this.regionMap?.canEditCells?.()){NotificationHandler.pop("Minimap tiles","This ROM can inspect these cells, but its compressed tilemap has no verified writable encoder.",NotificationType.ERROR);return false;}
      this.regionTool=tool;if(tool!=="select")this.setRegionLayer("tiles",{render:false});this.updateRegionActions();return true;
    }
    setRegionLayer(layer,{render=true}={}){
      if(!["tiles","locations"].includes(layer))return false;this.regionLayer=layer;this.regionShowLocations=layer==="locations";
      if(layer==="locations"&&this.regionTool!=="select")this.regionTool="select";
      if(layer==="tiles")this.renderRegionCellProperties(this.regionCell);else if(this.regionSelection)this.renderRegionProperties(this.regionSelection);else this.renderRegionCellProperties(null);
      if(render)this.renderRegionMap();else this.updateRegionActions();return true;
    }
    bindRegionGestures(){
      this.regionCanvas.addEventListener("wheel",event=>{event.preventDefault();this.setRegionZoom(this.regionZoom*GestureZoom.factor(event),event);},{passive:false});
      this.regionPinchCleanup=GestureZoom.bindPinch(this.regionCanvas,gesture=>this.setRegionZoom(this.regionZoom*gesture.factor,gesture));
    }
    openRegionTiles(){
      const source=this.regionMap?.tileEditorSource?.();
      if(!source){NotificationHandler.pop("Minimap tiles","This ROM stores the Minimap graphics in a compressed format without a verified writable encoder.",NotificationType.ERROR);return false;}
      EditorLinks.sprite(source);return true;
    }
    ensureRegionTilesWindow(){
      if(!this.regionTilesWindow){
        this.regionTilesCanvas=Dom.create("canvas",{className:"region-used-tiles",attributes:{tabindex:"0","aria-label":"Minimap tile palette"}});
        this.regionTilesCanvas.addEventListener("click",event=>{const tile=MinimapUtils.paletteTileAt(this.regionTilesCanvas,event,this.regionDocument);if(tile)this.selectRegionTile(tile.id);});
        this.regionTileNote=Dom.create("p",{className:"region-used-tiles__note"});
        const element=Dom.create("section",{className:"region-tiles-panel"});this.visualization.append(element);
        this.regionTilesWindow=new UiWindow({element,title:"Minimap tiles",icon:"▦",maximizable:false,closable:true}).setContent([this.regionTilesCanvas,this.regionTileNote]);
        this.regionTilesWindow.setFooter(UiWindow.button("Edit tile graphics",{icon:"fa-image",size:"sm",onClick:()=>this.openRegionTiles()}));
        const selectionElement=Dom.create("section",{className:"region-selection-panel"});this.visualization.append(selectionElement);
        this.regionDetails=Dom.create("div",{className:"region-details"});
        this.regionSelectionWindow=new UiWindow({element:selectionElement,title:"Minimap selection",icon:"fa-arrow-pointer",maximizable:false,closable:true}).setContent(this.regionDetails);
        if(this.viewMode!=="region"){this.regionTilesWindow.hide();this.regionSelectionWindow.hide();}
      }
      this.refreshRegionDocument();return this.regionTilesWindow;
    }
    refreshRegionDocument(){
      if(!this.regionMap||!this.regionTilesCanvas)return null;
      this.regionDocument=this.regionMap.cellDocument?.()||MinimapUtils.documentFromCanvas(this.regionMap.base,{tileSize:8,editable:false});
      if(this.regionTile===null||!this.regionDocument.palette.some(tile=>tile.id===this.regionTile))this.regionTile=this.regionDocument.palette[0]?.id??null;
      MinimapUtils.renderTilePalette(this.regionDocument,this.regionTilesCanvas,{selected:this.regionTile});
      const writable=this.writeAccess?.writable&&this.regionMap.canEditCells?.();
      this.regionTileNote.textContent=writable?"Select a native tile, then paint full 8 × 8 cells.":"Native cells are selectable. Tilemap writing is locked because this ROM uses a compressed format without a verified encoder.";
      return this.regionDocument;
    }
    selectRegionTile(tile){
      if(!this.regionDocument?.palette.some(item=>item.id===tile))return false;this.regionTile=tile;MinimapUtils.renderTilePalette(this.regionDocument,this.regionTilesCanvas,{selected:tile});this.renderRegionCellProperties(this.regionCell);this.updateRegionActions();return true;
    }
    setViewMode(mode,{notify=true}={}){
      if(mode==="region"&&!this.regionMap){
        if(notify)NotificationHandler.pop("Minimap","This ROM has no verified in-ROM Minimap decoder.",NotificationType.ERROR);
        return false;
      }
      this.viewMode=mode;this.root.dataset.mapView=mode;
      this.canvas.classList.toggle("hide",mode!=="map");this.regionCanvas.classList.toggle("hide",mode!=="region");
      this.mapToolsContent?.classList.toggle("hide",mode!=="map");
      this.regionToolbar.classList.toggle("hide",mode!=="region");
      if(this.mapToolbox){const label=mode==="region"?"Minimap tools":"Map tools";this.mapToolbox.dataset.toolbox=label;this.mapToolbox.setAttribute("aria-label",label);}
      if(mode==="region"){this.ensureRegionTilesWindow().show();this.regionSelectionWindow?.show();}else{this.regionTilesWindow?.hide();this.regionSelectionWindow?.hide();}
      this.sidebar.hidden=mode!=="map";
      this.windowManager?.setContext(mode);
      this.viewport.classList.toggle("is-region-view",mode==="region");
      this.viewToggle.querySelectorAll("button").forEach(button=>{const active=button.dataset.mapView===mode;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
      if(mode==="region"){
        const entry=this.regionMap?.entry?.(this.regionSectionId);
        if(entry)this.regionSelection=entry;
        if(this.regionLayer==="locations"&&entry)this.renderRegionProperties(entry);else this.renderRegionCellProperties(this.regionCell);
        this.renderRegionMap();
      }
      this.root.dispatchEvent(new CustomEvent("mapviewchange",{detail:{mode}}));return true;
    }
    setRegionMap(regionMap,{onSelect,onOpen=onSelect}={}){
      this.regionMap=regionMap;this.onRegionSelect=onSelect;this.onRegionOpen=onOpen;this.ensureRegionTilesWindow();
      const button=this.viewToggle.querySelector("[data-map-view='region']");
      button.disabled=false;button.title=regionMap.profile.label;
      this.regionCanvas.onclick=event=>this.handleRegionPointer(event);
      this.regionCanvas.ondblclick=event=>{event.preventDefault();if(this.regionLayer==="locations"&&this.regionSelection)this.openRegionEntry();};
      this.renderRegionMap();return this;
    }
    handleRegionPointer(event){
      const document=this.regionDocument||this.refreshRegionDocument(),cell=MinimapUtils.cellAt(this.regionCanvas,event,document);if(!cell)return false;
      if(this.regionLayer==="locations"){
        const entry=this.regionMap.hitTest(cell.x,cell.y);this.regionCell={...cell,tileSize:document.tileSize};
        if(entry){this.regionSelection=entry;this.regionSectionId=entry.id;this.renderRegionMap({sectionId:entry.id});this.renderRegionProperties(entry);this.onRegionSelect?.(entry);}else{this.regionSelection=null;this.renderRegionMap({sectionId:null});this.renderRegionCellProperties(this.regionCell);}
        return true;
      }
      this.regionCell={...cell,tileSize:document.tileSize};
      if(this.regionTool==="pick")this.selectRegionTile(cell.tile);
      else if(this.regionTool==="paint")this.paintRegionCell(cell);
      else this.renderRegionCellProperties(this.regionCell);
      this.renderRegionMap();return true;
    }
    paintRegionCell(cell){
      if(!this.regionMap?.canEditCells?.()||this.regionTile===null)return false;this.requireWritable("Painting a Minimap tile");
      const previous=cell.tile,next=this.regionTile;if(previous===next)return false;
      const apply=tile=>{const result=this.regionMap.updateCell(cell.index,tile);this.refreshRegionDocument();this.regionCell={...cell,tile, tileSize:this.regionDocument.tileSize};this.renderRegionMap();this.renderRegionCellProperties(this.regionCell);ProjectEvents.graphics([result.offset],{regionMap:true});};
      try{this.commands.execute({label:`Paint Minimap cell (${cell.x}, ${cell.y})`,description:`Tile ${previous} → ${next}`,do:()=>apply(next),undo:()=>apply(previous)});return true;}
      catch(error){NotificationHandler.pop("Minimap tile",error.message||String(error),NotificationType.ERROR);return false;}
    }
    setRegionZoom(value,event=null){
      const oldZoom=this.regionZoom||1,bounds=this.viewport.getBoundingClientRect(),anchored=event&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY),local=anchored?{x:event.clientX-bounds.left,y:event.clientY-bounds.top}:null,world=anchored?{x:(this.viewport.scrollLeft+local.x)/oldZoom,y:(this.viewport.scrollTop+local.y)/oldZoom}:null;
      const limits=this.regionZoomBounds();
      this.regionZoom=Math.round(Math.max(limits.min,Math.min(limits.max,Number(value)||1))*1000)/1000;
      this.regionCanvas.style.width=`${this.regionCanvas.width*this.regionZoom}px`;this.regionCanvas.style.height=`${this.regionCanvas.height*this.regionZoom}px`;this.regionCanvas.style.maxWidth="none";
      if(world){this.viewport.scrollLeft=world.x*this.regionZoom-local.x;this.viewport.scrollTop=world.y*this.regionZoom-local.y;}
      this.updateRegionActions();
      return this;
    }
    regionZoomBounds(){
      const width=Math.max(1,this.viewport.clientWidth-48),height=Math.max(1,this.viewport.clientHeight-48),canvasWidth=Math.max(1,this.regionCanvas.width),canvasHeight=Math.max(1,this.regionCanvas.height),fit=Math.min(width/canvasWidth,height/canvasHeight);
      return{min:Math.round(Math.max(.75,Math.min(4,fit*.72))*1000)/1000,max:8};
    }
    renderRegionProperties(entry){
      this.ensureRegionTilesWindow();this.regionSelectionWindow.setTitle(entry.name);this.regionDetails.replaceChildren(UiWindow.table({Layer:"Fly locations","Section ID":entry.id,"Tile X":entry.x,"Tile Y":entry.y,Width:entry.width,Height:entry.height},{},{columns:2,layout:[["Tile X","Tile Y"],["Width","Height"]]}));
      const edit=UiWindow.button("Edit location",{icon:"fa-pen",size:"sm",onClick:()=>this.editRegionEntry()});
      edit.disabled=!this.writeAccess?.writable||!this.regionMap?.canEdit?.(entry);
      this.regionSelectionWindow.setFooter([edit,UiWindow.button("Open map",{icon:"fa-arrow-up-right-from-square",size:"sm",onClick:()=>this.openRegionEntry()})]);
      this.updateRegionActions();return this;
    }
    renderRegionCellProperties(cell){
      this.ensureRegionTilesWindow();if(!cell){this.regionSelectionWindow.setTitle("Minimap selection");this.regionDetails.replaceChildren(Dom.create("p",{className:"region-selection-empty",text:"Select a tile cell or a fly location."}));this.regionSelectionWindow.setFooter(null);return this;}
      this.regionSelectionWindow.setTitle(`Cell ${cell.x}, ${cell.y}`);this.regionDetails.replaceChildren(UiWindow.table({Layer:"Tiles",Cell:`${cell.x}, ${cell.y}`,"Tile ID":cell.tile,"Paint tile":this.regionTile??"None"},{},{columns:2,layout:[["Cell","Tile ID"]]}));
      const paint=UiWindow.button("Paint selected tile",{icon:"fa-paintbrush",size:"sm",onClick:()=>this.paintRegionCell(cell)});paint.disabled=!this.writeAccess?.writable||!this.regionMap?.canEditCells?.();
      this.regionSelectionWindow.setFooter([UiWindow.button("Pick this tile",{icon:"fa-eye-dropper",size:"sm",onClick:()=>this.selectRegionTile(cell.tile)}),paint]);return this;
    }
    requireWritable(operation){return EditorCapabilityGuard.requireWritable(this.reader,"map_editor",operation);}
    updateRegionActions(){
      if(!this.regionToolbar)return this;
      const cellWritable=this.writeAccess?.writable&&this.regionMap?.canEditCells?.();
      this.regionToolbar.querySelector("[data-region-tool='paint']").disabled=!cellWritable;
      for(const tool of ["select","paint","pick"])this.regionToolbar.querySelector(`[data-region-tool='${tool}']`)?.classList.toggle("is-active",this.regionTool===tool);
      for(const layer of ["tiles","locations"])this.regionToolbar.querySelector(`[data-region-tool='${layer}']`)?.classList.toggle("is-active",this.regionLayer===layer);
      this.regionToolbar.querySelector("[data-region-tool='grid']")?.classList.toggle("is-active",this.regionShowGrid);
      this.regionCanvas.dataset.tool=this.regionTool;this.regionCanvas.dataset.layer=this.regionLayer;
      const limits=this.regionZoomBounds();
      this.regionToolbar.querySelector("[data-region-tool='zoom-out']").disabled=this.regionZoom<=limits.min+.001;
      this.regionToolbar.querySelector("[data-region-tool='zoom-in']").disabled=this.regionZoom>=limits.max-.001;
      return this;
    }
    async openRegionEntry(){
      if(!this.regionSelection)return false;
      const result=await this.onRegionOpen?.(this.regionSelection);
      if(result===false)return false;
      this.setViewMode("map");
      this.root.dispatchEvent(new CustomEvent("mapdestinationfocus",{detail:{entry:this.regionSelection}}));
      return true;
    }
    async editRegionEntry(){
      const entry=this.regionSelection;if(!this.regionMap?.canEdit?.(entry))return false;
      this.requireWritable("Editing a Minimap location");
      const profile=this.regionMap.profile,supportsSize=profile.supportsSize!==false,fields=[
        {name:"x",label:"X",type:"number",value:entry.x,min:0,max:(profile.coordinateWidth||profile.mapWidth)-1,fullWidth:false},
        {name:"y",label:"Y",type:"number",value:entry.y,min:0,max:(profile.coordinateHeight||profile.mapHeight)-1,fullWidth:false},
        supportsSize?{name:"width",label:"Width",type:"number",value:entry.width,min:1,max:profile.mapWidth,fullWidth:false}:null,
        supportsSize?{name:"height",label:"Height",type:"number",value:entry.height,min:1,max:profile.mapHeight,fullWidth:false}:null
      ].filter(Boolean);
      const values=await AppDialog.form({title:`Edit ${entry.name}`,message:"Change the native Minimap destination rectangle.",detail:"Coordinates use native 8 × 8 minimap tiles.",fields,submitLabel:"Apply location"});
      if(!values)return false;
      const before=Object.fromEntries(fields.map(field=>[field.name,entry[field.name]])),after=values;
      const apply=data=>{const result=this.regionMap.updateEntry(this.regionMap.entry(entry.id),data);this.regionSelection=result.entry;this.renderRegionMap({sectionId:entry.id});this.renderRegionProperties(result.entry);ProjectEvents.graphics([entry.offset],{regionMap:true});};
      this.commands.execute({label:`Move Minimap location: ${entry.name}`,description:`Section ${entry.id}`,do:()=>apply(after),undo:()=>apply(before)});return true;
    }
    renderRegionMap({sectionId=this.regionSectionId}={}){
      this.regionSectionId=sectionId;
      if(!this.regionMap)return false;
      const entry=this.regionMap.entry?.(sectionId);
      if(entry?.region&&entry.region!==this.regionMap.activeRegion){this.regionMap.activeRegion=entry.region;this.regionDocument=null;this.regionCell=null;}
      if(!this.regionDocument||this.regionDocument.key&&this.regionDocument.key!==this.regionMap.activeRegion)this.refreshRegionDocument();
      if(entry){this.regionSelection=entry;if(this.viewMode==="region"&&this.regionLayer==="locations")this.renderRegionProperties(entry);}
      this.regionMap.render(this.regionCanvas,{sectionId,showLocations:this.regionShowLocations,showGrid:this.regionShowGrid});
      if(this.regionLayer==="tiles"&&this.regionCell)MinimapUtils.drawCellSelection(this.regionCanvas,this.regionCell);
      this.regionCanvas.dataset.rendered="true";this.setRegionZoom(this.regionZoom);this.updateRegionActions();return true;
    }
    refreshRegionMap({sectionId=this.regionSectionId}={}){
      if(sectionId===this.regionSectionId&&this.regionCanvas.dataset.rendered==="true")return true;
      const rendered=this.renderRegionMap({sectionId});if(rendered)this.regionCanvas.dataset.rendered="true";return rendered;
    }

    setNavigation(content){this.navigation.replaceChildren(...(Array.isArray(content)?content:[content]));return this;}
    setProperties(content){this.properties.replaceChildren(...(Array.isArray(content)?content:[content]));return this;}
    renderNavigation(items,{title="Maps",onSelect}={}){
      return this.setNavigation([Dom.create("header",{className:"map-navigation__title",text:`${title} · ${items.length}`}),...items.map(item=>Dom.create("button",{className:"map-navigation__item",text:item.label,attributes:{type:"button"},dataset:{map:String(item.id)},events:{click:()=>onSelect?.(item)}}))]);
    }
    renderProperties({title,values={},descriptions={},complexity={},actions=[],scripts=[],onScript,events=[],onEvent}={}){
      const header=Dom.create("header",{className:"map-sidebar-panel__header map-properties__header"},[
        Dom.create("strong",{},[UiWindow.icon("fa-map-location-dot"),Dom.create("span",{text:title})]),
        Dom.create("span",{className:"map-sidebar-panel__badge",text:String(Object.keys(values).length),attributes:{title:"Visible map attributes"}})
      ]);
      const attributes=UiWindow.table(values,descriptions,{columns:1,complexity});
      const scriptList=Dom.create("section",{className:"map-properties__scripts"},[
        Dom.create("header",{},[Dom.create("strong",{text:"Map scripts"}),Dom.create("span",{text:String(scripts.length)})]),
        ...(scripts.length?scripts.map(item=>Dom.create("button",{className:"map-script",attributes:{type:"button",title:`Open ${item.name} in Code Editor`},events:{click:()=>onScript?.(item)}},[
          UiWindow.icon(item.kind==="controller"?"fa-microchip":item.kind==="scene"?"fa-clapperboard":"fa-code-branch"),
          Dom.create("span",{},[Dom.create("strong",{text:item.name}),Dom.create("small",{text:item.phase||"Map lifecycle script"})]),
          Dom.create("code",{text:Number.isInteger(item.script)?CoreUtils.hex(item.script,6):"—"})
        ])):[Dom.create("p",{className:"map-properties__empty",text:"No map lifecycle scripts."})])
      ]);
      const eventList=Dom.create("section",{className:"map-properties__events"},[
        Dom.create("header",{},[Dom.create("strong",{text:"Events"}),Dom.create("span",{text:String(events.length)})]),
        ...(events.length?events.map(item=>Dom.create("button",{className:"map-event",attributes:{type:"button"},events:{click:()=>onEvent?.(item)}},[
          UiWindow.icon(({Object:"fa-person",Warp:"fa-door-open",Script:"fa-code",Signpost:"fa-signs-post"})[item.type]||"fa-diamond"),
          Dom.create("span",{text:`${item.type} ${item.index}`}),
          Dom.create("small",{text:`${item.event.x??"?"}, ${item.event.y??"?"}`})
        ])):[Dom.create("p",{className:"map-properties__empty",text:"No events on this map."})])
      ]);
      return this.setProperties([
        header,
        Dom.create("div",{className:"map-sidebar-panel__body map-properties__body"},[attributes,scriptList,eventList]),
        actions.length?Dom.create("footer",{className:"ui-panel__footer map-properties__actions"},actions):null
      ].filter(Boolean));
    }
    async editLayout({title="Resize map",width,height,onApply}={}){
      this.requireWritable("Resizing a map");
      const values=await AppDialog.form({
        title,icon:"↔",message:"Existing blocks are preserved from the top-left. New cells use block 0.",
        fields:[
          {name:"width",label:"Width",type:"number",value:width,min:1,max:255,step:1,fullWidth:false},
          {name:"height",label:"Height",type:"number",value:height,min:1,max:255,step:1,fullWidth:false}
        ],
        submitLabel:"Resize map"
      });
      if(!values)return false;
      try{onApply?.(values.width,values.height);return true;}
      catch(error){NotificationHandler.pop("Resize map",error.message||String(error),NotificationType.ERROR);return false;}
    }
    editConnections({title="Connections",connections=[],newConnection=null,onApply,onAdd,onRemove}={}){
      this.requireWritable("Editing map connections");
      let index=connections.length?0:-1,fieldControls,form;const dialog=Dom.create("dialog",{className:"app-dialog map-connection-dialog"}),selector=Dom.create("select",{attributes:{"aria-label":"Connection"}},connections.map((connection,position)=>Dom.create("option",{text:connection.label,attributes:{value:String(position)}}))),fields=Dom.create("div",{className:"map-event-edit__grid"}),description=Dom.create("p"),applyButton=UiWindow.button("",{className:"ui-button--primary"}),removeButton=UiWindow.button("Delete",{className:"ui-button--danger"}),newButton=newConnection?UiWindow.button("New connection",{icon:"+",onClick:()=>{index=-1;render();}}):null;
      const active=()=>index<0?newConnection:connections[index];
      const render=()=>{const definition=active(),schema=(definition?.fields||[]).map(field=>({name:field.key,label:field.label,type:field.options?undefined:"number",valueType:"number",value:field.value,min:field.min,max:field.max,step:1,options:field.options,fullWidth:false}));fieldControls=AppDialog.controls(schema,{className:"map-event-edit__grid"});description.textContent=index<0?"Create a new connection. The table/header will be relocated safely.":"Edit the selected connection. Changes immediately rebuild the composed world.";selector.classList.toggle("hide",index<0||!connections.length);removeButton.classList.toggle("hide",index<0);applyButton.textContent=index<0?"Create connection":"Apply connection";fields.replaceChildren(...fieldControls.element.childNodes);};
      const close=()=>{dialog.close();dialog.remove();},apply=()=>{try{if(!form.checkValidity()){form.reportValidity();return;}const values=fieldControls.values();if(index<0)onAdd?.(values);else onApply?.(index,values);close();}catch(error){NotificationHandler.pop(index<0?"Add connection":"Edit connection",error.message||String(error),NotificationType.ERROR);}};
      applyButton.addEventListener("click",apply);removeButton.addEventListener("click",async()=>{if(index<0)return;const confirmed=await AppDialog.confirm({title:"Delete connection?",message:"The connection table/header will be rebuilt without this neighbour.",detail:"The operation can be undone from History.",confirmLabel:"Delete connection",cancelLabel:"Keep connection",danger:true});if(confirmed){onRemove?.(index);close();}});
      selector.addEventListener("change",()=>{index=Number(selector.value)||0;render();});
      form=Dom.create("form",{className:"app-dialog__card",attributes:{method:"dialog"}},[
        Dom.create("div",{className:"app-dialog__icon",text:"⇄"}),
        Dom.create("div",{className:"app-dialog__body"},[Dom.create("h2",{text:title}),description,selector,fields]),
        Dom.create("footer",{className:"app-dialog__actions"},[newButton,removeButton,UiWindow.button("Cancel",{onClick:close}),applyButton].filter(Boolean))
      ]);dialog.append(form);render();dialog.addEventListener("cancel",close,{once:true});document.body.append(dialog);dialog.showModal();return dialog;
    }
    renderHistory(stack){
      const entries=[...stack.done].reverse(),blocked=stack.blockingUndo;
      const buttons=entries.map((command,index)=>{
        const button=Dom.create("button",{
          className:index===0&&stack.canUndo?"current":"",
          text:command.label,
          attributes:{type:"button",title:command.description||command.label}
        });
        button.disabled=Boolean(blocked);
        button.addEventListener("click",()=>{
          try{while(stack.done.length>entries.length-index)stack.undo();}
          catch(error){NotificationHandler.pop("Map history",error.message||String(error),NotificationType.ERROR);}
        });
        return button;
      });
      this.history.replaceChildren(
        Dom.create("header",{},[Dom.create("strong",{text:"Map history"}),Dom.create("span",{text:`${entries.length} changes`})]),
        ...(blocked?[Dom.create("p",{className:"history-blocked",text:`Undo ${blocked.label} in ${blocked.ownerLabel||blocked.owner} before changing Map history.`})]:[]),
        ...(buttons.length?buttons:[Dom.create("p",{text:"No map changes yet."})])
      );return this;
    }
    setMapReference(reference){
      this.mapReference=reference;
      this.encounterPanel?.setMap(reference);
      this.root.dispatchEvent(new CustomEvent("mapselectionchange",{detail:{reference}}));
      return this;
    }
    setSupportedTools(supported){
      const writeModes=new Set([0,1,6]),allowed=new Set(supported.filter(mode=>this.writeAccess?.writable||!writeModes.has(mode)));
      this.root.querySelectorAll(".map_tool").forEach(tool=>{
        tool.dataset.allModes ||= tool.dataset.type;
        const modes=tool.dataset.allModes.split("-").map(Number).filter(mode=>allowed.has(mode));
        tool.classList.toggle("family-unavailable",modes.length===0);
        if(modes.length){tool.dataset.type=modes.join("-");tool.dataset.current=String(modes[0]);}
      });
      const selected=this.root.querySelector(".map_tool.selected");
      if(selected?.classList.contains("family-unavailable")){selected.classList.remove("selected");this.root.querySelector(".map_tool:not(.family-unavailable)")?.classList.add("selected");}
      return this;
    }
    center(){
      this.viewport.scrollLeft=Math.max(0,(this.canvas.offsetWidth-this.viewport.clientWidth)/2);
      this.viewport.scrollTop=Math.max(0,(this.canvas.offsetHeight-this.viewport.clientHeight)/2);
      return this;
    }
    canvasPoint(clientX,clientY){
      return MapUtils.canvasPoint(this.canvas,clientX,clientY);
    }
    setCanvasZoom(value,{clientX,clientY}={}){
      const anchored=clientX!==undefined&&clientY!==undefined,oldZoom=Number(this.canvas.dataset.zoom||1);
      value=Math.round(Math.max(.125,Math.min(4,Number(value)||1))*1000)/1000;
      const bounds=anchored?this.viewport.getBoundingClientRect():null;
      const local=anchored?{x:clientX-bounds.left,y:clientY-bounds.top}:null;
      const world=anchored?{x:(this.viewport.scrollLeft+local.x)/oldZoom,y:(this.viewport.scrollTop+local.y)/oldZoom}:null;
      this.canvas.dataset.zoom=String(value);
      this.canvas.style.width=`${this.canvas.width*value}px`;
      this.canvas.style.height=`${this.canvas.height*value}px`;
      if(world){
        this.viewport.scrollLeft=world.x*value-local.x;
        this.viewport.scrollTop=world.y*value-local.y;
      }
      return this;
    }
    centerOnCanvas(x,y){
      const zoom=Number(this.canvas.dataset.zoom||1);
      this.viewport.scrollLeft=Math.max(0,x*zoom-this.viewport.clientWidth/2);
      this.viewport.scrollTop=Math.max(0,y*zoom-this.viewport.clientHeight/2);
      return this;
    }
    bindViewport({zoom,canPan}={}){
      this.viewport.onwheel=event=>{event.preventDefault();const delta=MapWorkspace.wheelDelta(event);if(!delta)return;zoom?.({factor:MapWorkspace.wheelFactor(event),delta},event);};
      this.viewportPinchCleanup?.();this.viewportPinchCleanup=GestureZoom.bindPinch(this.viewport,gesture=>zoom?.({factor:gesture.factor,delta:0},gesture),{signal:this.scope?.signal});
      this.viewport.onpointerdown=event=>{if(event.button!==1&&!event.shiftKey&&!canPan?.())return;event.preventDefault();this.viewport.classList.add("grabbing");const start={x:event.clientX,y:event.clientY,left:this.viewport.scrollLeft,top:this.viewport.scrollTop};this.viewport.setPointerCapture(event.pointerId);const move=next=>{this.viewport.scrollLeft=start.left-GestureZoom.dragDelta(next.clientX,start.x);this.viewport.scrollTop=start.top-GestureZoom.dragDelta(next.clientY,start.y);};const stop=()=>{this.viewport.classList.remove("grabbing");this.viewport.removeEventListener("pointermove",move);this.viewport.removeEventListener("pointerup",stop);};this.viewport.addEventListener("pointermove",move);this.viewport.addEventListener("pointerup",stop);};
      return this;
    }
    destroy(){this.viewport.onwheel=null;this.viewport.onpointerdown=null;this.viewportPinchCleanup?.();this.viewportPinchCleanup=null;this.regionPinchCleanup?.();this.regionPinchCleanup=null;this.regionResizeObserver?.disconnect();this.regionResizeObserver=null;this.regionCanvas.onclick=null;this.regionCanvas.ondblclick=null;document.removeEventListener("romgraphicschange",this.onRegionGraphicsChange);this.root.removeEventListener("encounterpanelchange",this.onEncounterPanelChange);this.encounterPanel?.destroy?.();this.encounterPanel=null;this.windowManager?.destroy();this.viewToggle?.remove();this.viewToggle=null;this.regionToolbar?.remove();this.regionToolbar=null;this.mapToolsContent?.classList.remove("hide");if(this.mapToolbox){this.mapToolbox.dataset.toolbox="Map tools";this.mapToolbox.setAttribute("aria-label","Map tools");}this.mapToolbox=null;this.mapToolsContent=null;this.regionTilesWindow?.element.remove();this.regionTilesWindow=null;this.regionSelectionWindow?.element.remove();this.regionSelectionWindow=null;this.regionCanvas?.remove();this.regionCanvas=null;this.regionMap=null;this.sidebar.replaceChildren();delete this.root.dataset.mapFamily;delete this.root.dataset.mapView;}
  }

  global.MapWorkspace=MapWorkspace;
  global.MapScene=MapScene;
  const maps=(global.PokemonViewer ||= {}).maps ||= {};maps.Workspace=MapWorkspace;maps.Scene=MapScene;
})(globalThis);
