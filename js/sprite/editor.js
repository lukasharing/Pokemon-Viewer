(function(global){
  "use strict";

  const PALETTES={
    classic:["#ffffff","#aaaaaa","#555555","#111111"],
    grayscale:["#ffffff","#dddddd","#bbbbbb","#999999","#777777","#555555","#333333","#111111","#eeeeee","#cccccc","#aaaaaa","#888888","#666666","#444444","#222222","#000000"],
    green:["#e0f8cf","#86c06c","#306850","#071821"]
  };

  class SpriteEditor{
    constructor(reader,codec,catalog=null,pokemonCatalog=null,resourceCatalogs={}){
      this.reader=reader;
      this.scope=new EventScope();
      this.baseCodec=codec;
      this.codec=codec;
      this.catalog=catalog;
      this.catalogs=Object.freeze({overworld:catalog,pokemon:pokemonCatalog,...resourceCatalogs});
      this.showGrid=false;
      this.root=document.getElementById("sprite_editor");
      if(!this.root)throw new Error("Sprite Editor markup is missing #sprite_editor.");
      const element=id=>this.root.querySelector(`#${id}`);
      this.canvas=element("sprite_canvas");
      if(!this.canvas)throw new Error("Sprite Editor markup is missing #sprite_canvas.");
      this.context=this.canvas.getContext("2d",{alpha:false});
      const catalogElement=element("sprite_catalog"),variantElement=element("sprite_variant");
      this.elements={
        catalog:catalogElement,catalogField:element("sprite_catalog_field")||catalogElement?.closest("label"),
        compositionItem:element("sprite_composition_item"),compositionItemField:element("sprite_composition_item_field"),
        group:element("sprite_group"),variant:variantElement,variantField:element("sprite_variant_field")||variantElement?.closest("label"),liveCanvas:element("sprite_live_canvas"),liveStatus:element("sprite_live_status"),
        offset:element("sprite_offset"),count:element("sprite_count"),
        columns:element("sprite_columns"),zoom:element("sprite_zoom"),
        palette:element("sprite_palette"),paletteField:element("sprite_palette_field"),color:element("sprite_color"),render:element("sprite_render"),
        paletteSwatches:element("sprite_palette_swatches"),paletteColor:element("sprite_palette_color"),paletteApply:element("sprite_palette_apply"),
        undo:element("sprite_undo"),redo:element("sprite_redo"),
        zoomOut:element("sprite_zoom_out"),actualSize:element("sprite_actual_size"),zoomIn:element("sprite_zoom_in"),grid:element("sprite_grid"),paint:element("sprite_paint"),
        properties:element("sprite_properties"),status:element("sprite_status"),views:element("sprite_views")
      };
      const missing=Object.entries(this.elements).filter(([,value])=>!value).map(([name])=>name);
      if(missing.length)throw new Error(`Sprite Editor markup is missing required controls: ${missing.join(", ")}.`);
      this.commands=reader.history?.("sprite_editor",{label:"Sprite Editor",onChange:()=>this.updateActions()})||new CommandStack({onChange:()=>this.updateActions()});
      this.populateColors();
      this.bind();
      this.group=this.elements.group.value||"overworld";
      const first=this.populateCatalog();
      if(first!==null)this.openCatalog(first);else this.render();
    }

    bind(){
      const options=this.scope.options;
      const listen=(target,type,listener,extra={})=>this.scope.listen(target,type,listener,{...options,...extra});
      listen(this.elements.render,"click",()=>this.renderRom());
      listen(this.elements.catalog,"change",()=>this.openCatalog(Number(this.elements.catalog.value)));
      listen(this.elements.compositionItem,"change",()=>this.selectCompositionItem(Number(this.elements.compositionItem.value)));
      listen(this.elements.group,"change",()=>this.selectGroup(this.elements.group.value));
      listen(this.elements.variant,"change",()=>this.renderComposition());
      listen(this.elements.zoom,"input",()=>{this.render();this.notifyViewChange();});
      listen(this.elements.palette,"change",()=>{this.populateColors();this.render();});
      listen(this.elements.paletteSwatches,"click",event=>{const button=event.target.closest("[data-color-index]");if(!button)return;this.elements.color.value=button.dataset.colorIndex;this.syncColorSelection();});
      listen(this.elements.paletteApply,"click",()=>this.applyPaletteColor());
      listen(this.elements.undo,"click",()=>this.undo());listen(this.elements.redo,"click",()=>this.redo());
      listen(this.elements.zoomOut,"click",()=>this.zoomBy(-1));listen(this.elements.actualSize,"click",()=>this.setZoom(1));listen(this.elements.zoomIn,"click",()=>this.zoomBy(1));
      listen(this.elements.grid,"click",()=>this.toggleGrid());listen(this.elements.paint,"click",()=>this.canvas.focus());
      listen(this.elements.views,"click",event=>{const button=event.target.closest("[data-sprite-view]");if(button)this.selectView(Number(button.dataset.spriteView));});
      for(const input of [this.elements.offset,this.elements.count,this.elements.columns])listen(input,"keydown",event=>{if(event.key==="Enter")this.renderRom();});
      listen(this.canvas,"pointermove",event=>this.inspect(event));
      listen(this.canvas,"wheel",event=>{event.preventDefault();const steps=GestureZoom.consumeSteps(this,event);if(steps)this.zoomBy(steps);},{passive:false});
      listen(this.canvas,"pointerdown",event=>this.beginStroke(event));listen(this.canvas,"pointermove",event=>this.continueStroke(event));listen(this.canvas,"pointerup",event=>this.endStroke(event));listen(this.canvas,"pointercancel",event=>this.endStroke(event));
      this.onKeyDown=event=>{if(this.root.classList.contains("hide"))return;const command=KeyboardUtils.command(event);if(command){event.preventDefault();this[command]();}};
      listen(document,"keydown",this.onKeyDown);
      listen(document,"romgraphicschange",()=>this.refreshComposition());
      listen(this.root?.querySelector(".sprite-workspace"),"pointerdown",event=>{
        const pane=event.target.closest(".sprite-panel,.sprite-stage");if(pane)this.focusPane(pane);
      },options);
    }

    parseOffset(){return CoreUtils.parseOffset(this.elements.offset.value,this.reader.size);}

    setZoom(value){
      const minimum=Number(this.elements.zoom.min)||1,maximum=Number(this.elements.zoom.max)||8;
      this.elements.zoom.value=String(Math.min(maximum,Math.max(minimum,Math.round(Number(value)||minimum))));
      this.render();this.notifyViewChange();return this;
    }

    zoomBy(delta){return this.setZoom((Number(this.elements.zoom.value)||1)+delta);}
    canZoom(delta){const value=Number(this.elements.zoom.value)||1,minimum=Number(this.elements.zoom.min)||1,maximum=Number(this.elements.zoom.max)||8;return delta<0?value>minimum:value<maximum;}
    toggleGrid(force=!this.showGrid){this.showGrid=Boolean(force);this.render();this.notifyViewChange();return this.showGrid;}
    isGridVisible(){return this.showGrid;}
    notifyViewChange(){this.root.dispatchEvent(new CustomEvent("spriteviewchange",{bubbles:true,detail:{zoom:Number(this.elements.zoom.value)||1,grid:this.showGrid}}));}

    populateCatalog(catalog=this.catalog){
      this.catalog=catalog;
      const items=catalog?.available?.()===false?[]:catalog?.list?.()||[];
      this.elements.catalogField.classList.toggle("hide",!items.length);
      this.elements.catalog.replaceChildren(...items.map(item=>Dom.create("option",{text:item.label,attributes:{value:String(item.id)}})));
      return items.length?items[0].id:null;
    }

    selectGroup(group){
      this.group=group;const composition=["speechbox","battle","minimap"].includes(group);
      this.elements.variantField.classList.toggle("hide",group!=="speechbox");
      this.elements.catalogField.classList.toggle("hide",composition);
      this.elements.compositionItemField.classList.toggle("hide",group!=="battle");
      if(this.catalogs[group]){
        this.compositionState=null;
        const first=this.populateCatalog(this.catalogs[group]);
        if(first===null){
          this.clearLive(`${group[0].toUpperCase()+group.slice(1)} graphics are unavailable for this ROM.`);
          return false;
        }
        return this.openCatalog(first);
      }
      if(group==="speechbox")return this.renderComposition();
      if(group==="battle")return this.openBattleComposition();
      if(group==="minimap")return this.openMinimapComposition();
      this.compositionState=null;this.clearLive();return this.render();
    }
    clearLive(message="Select a grouped composition to mount it here."){const canvas=this.elements.liveCanvas,ctx=canvas.getContext("2d");canvas.width=canvas.height=1;ctx.clearRect(0,0,1,1);this.elements.liveStatus.textContent=message;}
    async openBattleComposition(){
      if(!this.reader.battle_editor) {
        try{await this.reader.ensureWorkspace("battle_editor");}
        catch(error){this.elements.compositionItem.replaceChildren();this.clearLive(error.message||"Battle Editor is unavailable for this ROM.");return false;}
      }
      const editor=this.reader.battle_editor;
      if(!editor?.scene||!editor?.previews?.pokemon) {
        this.elements.compositionItem.replaceChildren();
        this.clearLive("Battle scene data is unavailable for this ROM.");
        return false;
      }
      editor.render();
      const scene=editor.scene("battle"),sourceCanvas=editor.previews.pokemon.canvas;
      return this.renderComposition({kind:"battle",scene,sourceCanvas,elements:scene.elements||[]});
    }
    async openMinimapComposition(){
      try{
        if(!this.reader.map_editor)await this.reader.ensureWorkspace("map_editor");
        const regionMap=this.reader.map_editor?.regionMap;
        if(!regionMap?.render)throw new Error("This ROM has no decoded native Minimap resource.");
        const canvas=document.createElement("canvas");
        regionMap.render(canvas,{showLocations:false,showGrid:false});
        return this.renderComposition({kind:"minimap",sourceCanvas:canvas});
      }catch(error){
        this.compositionState=null;
        this.clearLive(error.message||"The native Minimap could not be decoded.");
        return false;
      }
    }
    renderComposition({kind="speechbox",layers=[],scene=null,sourceCanvas=null,elements=[]}={}){
      if(!this.compositor)this.compositor=PokemonViewer.sprites.Compositors.create(this.reader.spriteCompositorId||this.reader.family,this.reader);
      let result;
      if(kind==="speechbox")result=this.compositor.speechbox({variant:this.elements.variant.value,text:"HELLO! THIS IS THE LIVE DIALOGUE WINDOW."});
      else if(sourceCanvas?.width&&sourceCanvas?.height){
        const mounted=PixelCanvas.copy(sourceCanvas);
        result=Object.freeze({canvas:mounted,width:mounted.width,height:mounted.height,status:kind==="minimap"?"Native in-game Minimap mounted from this ROM.":"Current native battle scene · select an item to inspect or edit its ROM source."});
      }else result=this.compositor.composition({kind:"battle",layers});
      this.compositionState={kind,layers,scene,sourceCanvas,elements};
      if(kind==="battle")this.populateCompositionItems(elements);
      const canvas=this.elements.liveCanvas;canvas.width=result.width;canvas.height=result.height;PixelCanvas.draw(canvas,result.canvas);
      this.elements.liveStatus.textContent=result.status;
      if(kind==="minimap"){
        const zoom=Math.max(1,Math.min(4,Math.floor(480/result.width)));
        this.canvas.width=result.width*zoom;this.canvas.height=result.height*zoom;
        this.context.imageSmoothingEnabled=false;this.context.clearRect(0,0,this.canvas.width,this.canvas.height);
        this.context.drawImage(result.canvas,0,0,this.canvas.width,this.canvas.height);
        this.elements.status.textContent=`Native Minimap · ${result.width}×${result.height} pixels · ${zoom}× preview`;
        this.showProperties({Source:"In-game Minimap",Format:"Native tilemap",Width:result.width,Height:result.height,Editable:"Open Map Editor"});
      }
      return result;
    }
    populateCompositionItems(elements=[]){
      const items=elements.filter(item=>item?.resource);
      this.compositionItems=items;
      const previous=Math.min(Number(this.elements.compositionItem.value)||0,Math.max(0,items.length-1));
      this.elements.compositionItem.replaceChildren(...items.map((item,index)=>Dom.create("option",{text:item.label||`Scene item ${index+1}`,attributes:{value:String(index)}})));
      this.elements.compositionItem.disabled=!items.length;
      if(items.length)this.elements.compositionItem.value=String(previous);
      else this.elements.liveStatus.textContent="The current battle scene has no inspectable ROM items.";
      return items;
    }
    selectCompositionItem(index){
      const item=this.compositionItems?.[index];if(!item?.resource)return false;
      this.open({...item.resource,title:item.label||item.resource.title,preserveViewSet:true});
      this.redrawComposition();
      return true;
    }
    redrawComposition(){
      if(this.group!=="battle"||!this.compositionState)return false;
      const editor=this.reader.battle_editor;
      if(editor?.render&&editor?.scene){editor.render();return this.renderComposition({kind:"battle",scene:editor.scene("battle"),sourceCanvas:editor.previews.pokemon.canvas,elements:editor.scene("battle").elements||[]});}
      return this.renderComposition(this.compositionState);
    }
    refreshComposition(){if(this.group==="battle")this.redrawComposition();}

    openCatalog(id){
      try{
        const source=this.catalog.source(id);this.elements.catalog.value=String(id);return this.open({...source,catalogId:id});
      }catch(error){
        NotificationHandler.pop("Sprite catalog",error.message||String(error),NotificationType.ERROR);return false;
      }
    }

    selectSource(catalogId,title){
      this.elements.catalog.querySelector("[data-linked-source]")?.remove();
      if(Number.isInteger(catalogId)){this.elements.catalog.value=String(catalogId);return;}
      if(!this.elements.catalogField.classList.contains("hide")){
        const option=Dom.create("option",{text:`Linked · ${title||"sprite"}`,attributes:{value:"linked-source","data-linked-source":"true"}});
        this.elements.catalog.prepend(option);this.elements.catalog.value="linked-source";
      }
    }

    getPalette(){
      const selected=this.elements.palette.value==="linked"&&this.linkedPalette?this.linkedPalette:PALETTES[this.elements.palette.value]||PALETTES.classic;
      return Array.from({length:this.codec.colors},(_,index)=>selected[index%selected.length]);
    }

    open(request={}){
      if(request.group&&Number.isInteger(request.sprite)){
        this.elements.group.value=request.group;
        this.selectGroup(request.group);
        return this.openCatalog(request.sprite);
      }
      if(request.composition){this.elements.group.value=request.composition.kind||"speechbox";this.selectGroup(this.elements.group.value);return this.renderComposition(request.composition);}
      if(Array.isArray(request.views))return this.openViews(request.views,{active:request.activeView,title:request.title,catalogId:request.catalogId});
      if(!request.preserveViewSet)this.clearViews();
      this.codec=request.codec||this.baseCodec;
      const {offset=0,count,columns,bytes,segments,title,editable=false,palette,paletteOffset,paletteOffsets,catalogId,previewCanvas=null}=request;
      if(bytes!==undefined&&!(bytes instanceof Uint8Array))throw new TypeError("Linked sprite bytes must be a Uint8Array.");
      if(bytes instanceof Uint8Array&&bytes.length<this.codec.bytesPerTile)throw new RangeError("Linked sprite data does not contain one complete native tile.");
      const source=GraphicSource.resolve(this.reader.memory,{offset,bytes,segments,editable,title:title||"Linked graphics",palette,colorCount:this.codec.colors,paletteOffset,paletteOffsets});
      this.external=source.external;
      this.linkedSource=source.linked?source:null;
      this.linkedPreview=previewCanvas?.getContext&&previewCanvas.width>0&&previewCanvas.height>0?previewCanvas:null;
      this.catalogId=Number.isInteger(catalogId)?catalogId:null;
      this.linkedPalette=source.palette;
      this.paletteReference=source.paletteReference;
      this.configureLinkedPalette();
      this.sourceTitle=title||null;
      this.selectSource(this.catalogId,this.sourceTitle);
      this.elements.offset.value=`0x${Number(offset).toString(16).toUpperCase()}`;
      if(count)this.elements.count.value=String(count);
      if(columns)this.elements.columns.value=String(columns);
      this.render();
      return this;
    }

    openViews(views,{active=0,title="Linked sprite",catalogId=null}={}){
      const sources=views.filter(view=>view&&typeof view==="object").map((view,index)=>Object.freeze({
        ...view,
        catalogId:Number.isInteger(view.catalogId)?view.catalogId:catalogId,
        label:view.label||`State ${index+1}`
      }));
      if(!sources.length)throw new Error("The linked sprite does not contain any renderable views.");
      this.viewSet=Object.freeze(sources);this.viewSetTitle=title;
      this.elements.views.classList.remove("hide");
      this.elements.views.replaceChildren(...sources.map((view,index)=>Dom.create("button",{className:"sprite-view-tab",text:view.label,attributes:{type:"button",role:"tab","data-sprite-view":index}})));
      return this.selectView(Math.max(0,Math.min(sources.length-1,Number(active)||0)));
    }

    selectView(index){
      const source=this.viewSet?.[index];if(!source)return false;
      this.activeView=index;
      this.elements.views.querySelectorAll("[data-sprite-view]").forEach((button,at)=>{const selected=at===index;button.classList.toggle("is-active",selected);button.setAttribute("aria-selected",String(selected));button.tabIndex=selected?0:-1;});
      return this.open({...source,title:source.title||`${this.viewSetTitle} · ${source.label}`,preserveViewSet:true});
    }

    clearViews(){this.viewSet=null;this.activeView=0;this.elements.views.classList.add("hide");this.elements.views.replaceChildren();}
    focusPane(pane){this.root.querySelectorAll(".sprite-panel,.sprite-stage").forEach(item=>item.classList.toggle("is-focused",item===pane));return pane;}

    renderRom(){this.codec=this.baseCodec;this.clearViews();this.external=null;this.linkedSource=null;this.linkedPreview=null;this.catalogId=null;this.linkedPalette=null;this.paletteReference=null;this.configureLinkedPalette();this.sourceTitle=null;this.clearLive();this.render();return this;}

    bookmark(){
      const state=this.state||{},segments=this.linkedSource?.verified&&this.linkedSource?.segments
        ?this.linkedSource.segments.map(({offset,length})=>({offset,length}))
        :null;
      return Object.freeze({
        catalogId:this.catalogId,
        activeView:this.viewSet?this.activeView:null,
        offset:state.offset??this.parseOffset(),
        count:state.count??Number(this.elements.count.value),
        columns:state.columns??Number(this.elements.columns.value),
        zoom:state.zoom??Number(this.elements.zoom.value),
        grid:this.showGrid,
        paletteMode:this.elements.palette.value,
        palette:this.linkedPalette?[...this.linkedPalette]:null,
        paletteOffset:this.paletteReference?.offset,
        paletteOffsets:this.paletteReference?.offsets?[...this.paletteReference.offsets]:null,
        segments,
        title:this.sourceTitle||this.elements.catalog.selectedOptions[0]?.textContent||"Sprite",
        restorable:Number.isInteger(this.catalogId)||!this.external||Boolean(segments)
      });
    }

    restoreBookmark(target={}){
      if(target.restorable===false)throw new Error("This assembled sprite preview has no stable ROM reference. Open its map or event again.");
      this.elements.zoom.value=String(target.zoom||this.elements.zoom.value);
      this.showGrid=Boolean(target.grid);
      if(Number.isInteger(target.catalogId)){
        if(this.openCatalog(target.catalogId)===false)throw new Error("The bookmarked sprite catalog entry is no longer available.");
        if(Number.isInteger(target.activeView)&&this.viewSet)this.selectView(target.activeView);
      }
      else if(Array.isArray(target.segments)&&target.segments.length){
        const count=CoreUtils.integer(target.count,{name:"Sprite tile count",min:1,max:1024}),expected=count*this.codec.bytesPerTile;
        const segments=GraphicSource.segments(target.segments,expected),bytes=new Uint8Array(expected);let cursor=0;
        for(const segment of segments){const part=MemoryUtils.bytes(this.reader.memory,segment.offset,segment.length);bytes.set(part,cursor);cursor+=part.length;}
        this.open({...target,count,segments,bytes,editable:true});
      }else this.open(target);
      if(target.paletteMode&&[...this.elements.palette.options].some(option=>option.value===target.paletteMode))this.elements.palette.value=target.paletteMode;
      this.populateColors();this.render();this.notifyViewChange();return this;
    }

    configureLinkedPalette(){
      let option=this.elements.palette.querySelector('option[value="linked"]');
      if(this.linkedPalette){if(!option){option=Dom.create("option",{text:"Linked palette",attributes:{value:"linked"}});this.elements.palette.prepend(option);}this.elements.palette.value="linked";}
      else if(option){if(this.elements.palette.value==="linked")this.elements.palette.value=this.codec.colors===4?"green":"grayscale";option.remove();}
      this.elements.paletteField.classList.add("hide");
      const writable=Boolean(this.paletteReference&&typeof this.codec.encodeColor==="function"&&typeof this.codec.decodeColor==="function");
      this.root.querySelectorAll(".sprite-palette-write").forEach(element=>element.classList.toggle("hide",!writable));
      this.populateColors();
    }

    render(){
      try{
        const offset=this.parseOffset(),columns=Math.max(1,Number(this.elements.columns.value)||8);
        const memory=this.external?new RomMemory(this.external.bytes):this.reader.memory,sourceOffset=this.external?0:offset;
        const available=Math.floor((memory.size-sourceOffset)/this.codec.bytesPerTile);
        const count=Math.min(Math.max(1,Number(this.elements.count.value)||1),1024,available);
        if(count<1)throw new RangeError("The offset is outside the loaded ROM.");
        const rows=Math.ceil(count/columns),zoom=Number(this.elements.zoom.value)||3,palette=this.getPalette();
        const image=document.createElement("canvas");image.width=columns*8;image.height=rows*8;
        const context=image.getContext("2d"),data=context.createImageData(image.width,image.height);
        for(let tile=0;tile<count;tile++){
          const pixels=this.codec.decodeTile(memory,sourceOffset+tile*this.codec.bytesPerTile);
          const tileX=(tile%columns)*8,tileY=Math.floor(tile/columns)*8;
          for(let pixel=0;pixel<64;pixel++){
            const color=this.hexToRgb(palette[pixels[pixel]]),x=tileX+pixel%8,y=tileY+Math.floor(pixel/8),target=(y*image.width+x)*4;
            data.data.set([color.r,color.g,color.b,255],target);
          }
        }
        context.putImageData(data,0,0);
        this.renderLinkedPreview(this.linkedPreview||image);
        this.canvas.width=image.width*zoom;this.canvas.height=image.height*zoom;
        this.context.imageSmoothingEnabled=false;this.context.drawImage(image,0,0,this.canvas.width,this.canvas.height);
        if(this.showGrid)this.renderGrid(image.width,image.height,zoom);
        this.state={offset,count,columns,rows,zoom,editable:!this.external||Boolean(this.linkedSource?.verified)};
        this.canvas.classList.toggle("is-readonly",!this.state.editable);
        const storage=this.linkedSource?.segmented&&this.linkedSource.verified?"Verified segmented ROM tiles":this.external?"Assembled preview":this.linkedSource?.verified?"Verified contiguous ROM bytes":"ROM";
        const paletteStorage=this.paletteReference?"Editable ROM palette":this.linkedPalette?"Linked display palette":"Preview palette";
        const properties={Source:this.sourceTitle||this.external?.title||"ROM",Storage:storage,Palette:paletteStorage,Format:this.codec.label,Offset:MemoryUtils.hex(offset,6),Tiles:count,"Bytes/tile":this.codec.bytesPerTile,Colors:this.codec.colors,Editable:this.state.editable?"Yes":"Preview only"};
        if(this.paletteReference)properties["Palette offset"]=MemoryUtils.hex(this.paletteReference.offset,6);
        this.showProperties(properties,{Offset:"advanced","Bytes/tile":"advanced","Palette offset":"advanced"});
        this.elements.status.textContent=`Rendered ${count} tiles · ${columns} columns · ${zoom}× zoom${this.showGrid?" · grid":""}${this.state.editable?" · click and drag to paint":" · linked preview is read-only"}`;
        this.updateActions();
        if(this.group==="battle")this.scheduleCompositionRefresh();
        if(this.group==="overworld"&&!this.linkedSource)this.clearLive("Overworld source selected. Open a Speech box or Battle scene group to mount layers live.");
      }catch(error){
        this.elements.status.textContent=error.message;
        NotificationHandler.pop("Sprite editor",error.message,NotificationType.ERROR);
      }
    }

    renderLinkedPreview(source){
      if(!source?.width||!source?.height)return;
      const canvas=this.elements.liveCanvas,context=PixelCanvas.context(canvas);
      canvas.width=source.width;canvas.height=source.height;
      PixelCanvas.draw(canvas,source);
      const contextual=source===this.linkedPreview;
      this.elements.liveStatus.textContent=contextual
        ?`${this.sourceTitle||"Linked graphic"} · mounted in its native ${source.width}×${source.height} scene.`
        :`${this.sourceTitle||"Linked graphic"} · native ${source.width}×${source.height} preview.`;
    }

    inspect(event){
      if(!this.state)return;
      const point=this.pixelAt(event),tile=point?Math.floor(point.y/8)*this.state.columns+Math.floor(point.x/8):-1;
      if(tile>=0&&tile<this.state.count){const position=`Tile ${tile} · pixel ${point.x%8}, ${point.y%8}`,technical=` · ROM 0x${(this.state.offset+tile*this.codec.bytesPerTile).toString(16).toUpperCase().padStart(6,"0")}`;this.elements.status.textContent=position+(editorPreferences.experience==="nerd"?technical:"");}
    }

    renderGrid(width,height,zoom){
      const context=this.context;
      context.save();context.lineWidth=1;
      if(zoom>=3){
        context.beginPath();
        for(let x=1;x<width;x++){const position=x*zoom+.5;context.moveTo(position,0);context.lineTo(position,this.canvas.height);}
        for(let y=1;y<height;y++){const position=y*zoom+.5;context.moveTo(0,position);context.lineTo(this.canvas.width,position);}
        context.strokeStyle="rgba(21,45,63,.14)";context.stroke();
      }
      context.beginPath();
      for(let x=8;x<width;x+=8){const position=x*zoom+.5;context.moveTo(position,0);context.lineTo(position,this.canvas.height);}
      for(let y=8;y<height;y+=8){const position=y*zoom+.5;context.moveTo(0,position);context.lineTo(this.canvas.width,position);}
      context.strokeStyle="rgba(21,45,63,.55)";context.stroke();context.restore();
    }

    populateColors(){
      const palette=this.getPalette(),selected=Math.min(Number(this.elements.color.value)||0,this.codec.colors-1);
      this.elements.color.value=String(selected);
      const columns=Math.ceil(Math.sqrt(this.codec.colors));
      this.elements.paletteSwatches.style.setProperty("--palette-columns",String(columns));
      this.elements.paletteSwatches.replaceChildren(...palette.map((color,index)=>Dom.create("button",{classes:["sprite-palette-swatch"],attributes:{type:"button",role:"option","data-color-index":index,"aria-label":`Paint with ${color}`,title:color,style:`--swatch-color:${color}`}})));
      this.syncColorSelection();
    }

    syncColorSelection(){
      const index=Number(this.elements.color.value),color=this.getPalette()[index];
      this.elements.color.style.setProperty("--sprite-ink",color);this.elements.paletteColor.value=color;
      const mappedOffset=this.paletteReference?.offsets?this.paletteReference.offsets[index]:this.paletteReference?this.paletteReference.offset+index*this.paletteReference.stride:null;
      this.elements.paletteColor.disabled=!Number.isInteger(mappedOffset);
      this.elements.paletteApply.disabled=!Number.isInteger(mappedOffset);
      this.elements.paletteSwatches.querySelectorAll("[data-color-index]").forEach(button=>{const selected=Number(button.dataset.colorIndex)===index;button.classList.toggle("is-selected",selected);button.setAttribute("aria-selected",String(selected));});
    }

    applyPaletteColor(){
      if(!this.paletteReference||typeof this.codec.encodeColor!=="function")return false;
      try{
        const index=Number(this.elements.color.value),offset=this.paletteReference.offsets?this.paletteReference.offsets[index]:this.paletteReference.offset+index*this.paletteReference.stride;
        if(!Number.isInteger(offset))return false;
        const value=this.codec.encodeColor(this.elements.paletteColor.value),next=Uint8Array.of(value&0xff,value>>8&0xff),previous=MemoryUtils.bytes(this.reader.memory,offset,2);
        if(previous[0]===next[0]&&previous[1]===next[1])return false;
        const write=(expected,bytes)=>{MemoryUtils.replace(this.reader.memory,offset,expected,bytes);const palette=[...this.linkedPalette];palette[index]=this.codec.decodeColor(this.reader.memory.u16(offset));this.linkedPalette=Object.freeze(palette);ProjectEvents.graphics([offset],{palette:true});this.populateColors();this.render();};
        this.commands.execute({label:`Edit palette color ${index}`,description:`Palette ${MemoryUtils.hex(offset,6)}`,do:()=>write(previous,next),undo:()=>write(next,previous)});return true;
      }catch(error){NotificationHandler.pop("Palette edit",error.message||String(error),NotificationType.ERROR);return false;}
    }

    pixelAt(event){
      if(!this.state)return null;const bounds=this.canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return null;
      const x=Math.floor((event.clientX-bounds.left)*this.canvas.width/bounds.width/this.state.zoom),y=Math.floor((event.clientY-bounds.top)*this.canvas.height/bounds.height/this.state.zoom);
      return x>=0&&y>=0&&x<this.state.columns*8&&y<this.state.rows*8?{x,y}:null;
    }

    beginStroke(event){
      if(event.button!==0||!this.state?.editable)return;
      this.stroke={before:new Map(),after:new Map(),pixels:new Set()};this.canvas.setPointerCapture(event.pointerId);this.paintPixel(event);event.preventDefault();
    }

    continueStroke(event){if(this.stroke&&(event.buttons&1))this.paintPixel(event);}

    paintPixel(event){
      const point=this.pixelAt(event);if(!point)return;const tileX=Math.floor(point.x/8),tileY=Math.floor(point.y/8),tile=tileY*this.state.columns+tileX;
      if(tile<0||tile>=this.state.count)return;const pixel=(point.y%8)*8+point.x%8,key=`${tile}:${pixel}`;if(this.stroke.pixels.has(key))return;
      const offset=this.external?tile*this.codec.bytesPerTile:this.state.offset+tile*this.codec.bytesPerTile,memory=this.external?new RomMemory(this.external.bytes):this.reader.memory,pixels=this.codec.decodeTile(memory,offset),color=Number(this.elements.color.value);
      if(pixels[pixel]===color)return;this.stroke.pixels.add(key);
      if(!this.stroke.before.has(offset))this.stroke.before.set(offset,MemoryUtils.bytes(memory,offset,this.codec.bytesPerTile));
      pixels[pixel]=color;const bytes=this.codec.encodeTile(pixels);this.writeGraphicBytes(offset,bytes);this.stroke.after.set(offset,bytes);this.render();
    }

    endStroke(event){
      const stroke=this.stroke;if(!stroke)return;this.stroke=null;
      if(event?.pointerId!==undefined&&this.canvas.hasPointerCapture?.(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
      if(!stroke.after.size)return;
      const write=(expected,snapshot)=>{
        const entries=[...snapshot].map(([offset,bytes])=>({offset,target:this.graphicTarget(offset,bytes.length),expected:expected.get(offset),next:bytes}));
        for(const entry of entries)if(!MemoryUtils.equals(this.reader.memory,entry.target,entry.expected))throw new Error(`Sprite bytes changed after this stroke at ${MemoryUtils.hex(entry.target,6)}.`);
        const offsets=[];for(const entry of entries)offsets.push(this.writeGraphicBytes(entry.offset,entry.next));
        ProjectEvents.graphics(offsets);this.render();
      };
      // Pointer painting updates the live preview immediately. Restore that
      // preview first so CommandStack can record one normal before → after
      // transition and apply the same preconditions on later Undo/Redo.
      write(stroke.after,stroke.before);
      this.commands.execute({label:`Paint ${stroke.pixels.size} sprite pixel${stroke.pixels.size===1?"":"s"}`,description:`${stroke.after.size} tile${stroke.after.size===1?"":"s"}`,do:()=>write(stroke.before,stroke.after),undo:()=>write(stroke.after,stroke.before)});
    }

    graphicTarget(offset,length){
      if(!this.external)return offset;
      const target=this.linkedSource?.locate?.(offset,length);
      if(target===null||target===undefined)throw new RangeError("This assembled graphic range has no verified ROM location.");
      return target;
    }

    writeGraphicBytes(offset,bytes){
      if(!this.external){MemoryUtils.writeBytes(this.reader.memory,offset,bytes);return offset;}
      const target=this.graphicTarget(offset,bytes.length);
      MemoryUtils.writeBytes(this.reader.memory,target,bytes);
      let mirrored=false;
      for(const segment of this.linkedSource.segments||[]){
        if(target<segment.offset||target+bytes.length>segment.offset+segment.length)continue;
        this.external.bytes.set(bytes,segment.start+target-segment.offset);mirrored=true;
      }
      if(!mirrored)this.external.bytes.set(bytes,offset);
      return target;
    }

    updateActions(){
      this.elements.undo.disabled=!this.commands.done.length;this.elements.redo.disabled=!this.commands.undone.length;
      this.elements.zoomOut.disabled=!this.canZoom(-1);this.elements.zoomIn.disabled=!this.canZoom(1);
      this.elements.grid.classList.toggle("is-active",this.showGrid);this.elements.grid.setAttribute("aria-pressed",String(this.showGrid));
      const readonly=Boolean(this.state&&!this.state.editable);this.elements.paint.disabled=readonly;this.elements.paint.classList.toggle("is-active",!readonly);
    }
    undo(){return EditUtils.history(this.commands,"undo",{title:"Sprite history"});}
    redo(){return EditUtils.history(this.commands,"redo",{title:"Sprite history"});}

    showProperties(values,complexity={}){const next=UiWindow.properties(values,{},complexity);next.id=this.elements.properties.id;this.elements.properties.replaceWith(next);this.elements.properties=next;}

    hexToRgb(hex){const value=Number.parseInt(hex.slice(1),16);return{r:value>>16,g:value>>8&255,b:value&255};}
    scheduleCompositionRefresh(){
      if(this.compositionFrame!==null&&this.compositionFrame!==undefined)return;
      this.compositionFrame=this.scope.frame(()=>{this.compositionFrame=null;this.redrawComposition();});
    }
    refresh(){this.render();return this;}
    destroy(){this.commands.destroy?.();this.scope.destroy();}
  }

  global.SpriteEditor=SpriteEditor;
})(globalThis);
