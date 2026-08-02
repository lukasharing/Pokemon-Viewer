(function(global){
  "use strict";
  const MAP_NAMES=["Pallet Town","Viridian City","Pewter City","Cerulean City","Lavender Town","Vermilion City","Celadon City","Fuchsia City","Cinnabar Island","Indigo Plateau","Saffron City","Unused 0B","Route 1","Route 2","Route 3","Route 4","Route 5","Route 6","Route 7","Route 8","Route 9","Route 10","Route 11","Route 12","Route 13","Route 14","Route 15","Route 16","Route 17","Route 18","Route 19","Route 20","Route 21","Route 22","Route 23","Route 24","Route 25"];
  const COLORS=[[224,248,208],[136,192,112],[52,104,86],[8,24,32]];
  class GbcMapDriver{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.scope=new EventScope();this.structureWriter=new StructureWriter(this.memory);this.layoutWriter=new MapLayoutWriter(this.memory);this.eventBlockWriter=new GbcEventBlockWriter(this.memory);this.connectionHeaderWriter=new GbcConnectionHeaderWriter(this.memory);this.collisionTableWriter=new GbcCollisionTableWriter(this.memory);this.selected_block=0;this.selections=[];this.collisionSelection=null;
      document.addEventListener("romgraphicschange",()=>{this.spriteCache?.clear();if(this.current)this.redraw();},this.scope.options);
    }
    init(){
      this.root=this.workspace.root;this.visualization=this.workspace.visualization;this.navigation=this.workspace.navigation;
      this.canvas=this.workspace.canvas;this.tilesetCanvas=this.workspace.tilesetCanvas;this.details=this.workspace.properties;
      this.mount();this.createWindows();this.maps=this.discoverMaps();
      try{
        this.regionMap=new PokemonViewer.maps.gbc.RegionMap(this.reader);
        this.workspace.setRegionMap(this.regionMap,{onOpen:entry=>{const destination=this.maps[entry.id];if(destination?.valid){if(destination.id===this.current?.id){this.focusCurrent();return true;}return this.editor.navigate(()=>this.select(destination.id,{focus:true}));}NotificationHandler.pop("Minimap",`${entry.name} has no resolved outdoor map.`,NotificationType.ERROR);return false;}});
      }catch(error){this.regionMap=null;console.info("Gen I Minimap unavailable.",error);}
      this.renderNavigation();this.select(this.maps.find(map=>map.valid)?.id??0);
      return this;
    }
    mount(){
      const options=this.scope.options;
      this.canvas.className="map-canvas";this.canvas.setAttribute("aria-label","Block map");
      this.workspace.bindViewport({zoom:(change,event)=>this.zoom(change,event),canPan:()=>this.controls?.active===2});
      let pendingScrollFrame=null;
      this.scope.listen(this.workspace.viewport,"scroll",()=>{if(pendingScrollFrame!==null)return;pendingScrollFrame=this.scope.frame(()=>{pendingScrollFrame=null;if(this.current)this.redraw();});},{passive:true});
      this.pointerSession=new PointerSession(this.canvas,{
        onHover:event=>this.inspectBlock(event),
        onStart:event=>this.beginEdit(event),
        onMove:event=>this.continueEdit(event),
        onEnd:(event,_state,reason)=>this.endEdit(event,{cancelled:reason!=="up"}),
        onTap:event=>this.tapEdit(event)
      },{signal:this.scope.signal});
      this.canvas.addEventListener("dblclick",event=>this.openSceneMap(event),options);
      this.tilesetCanvas.addEventListener("click",event=>this.pickTilesetBlock(event),options);
      this.tilesetCanvas.addEventListener("dblclick",event=>this.openTilesetBlock(event),options);
      this.tilesetCanvas.title="Click to select a block · double-click to open it in Sprite Editor";
      this.contextMenu=new MapContextMenu(this,this.canvas,options);
    }
    createWindows(){
      this.windowManager=this.workspace.windowManager;
      this.controls=new MapControls(this.root,mode=>this.setMode(mode),{family:"gb",signal:this.scope.signal});
      this.eventInspector=new MapEventInspector(this,this.visualization);
      this.createPatternWindow();
      this.root.editorHeader?.render();
    }
    createPatternWindow(){
      this.patternCanvas=Dom.create("canvas",{className:"map-pattern-canvas",attributes:{width:"32",height:"32","aria-label":"Gen I 4 by 4 tile border block"}});
      this.patternSummary=Dom.create("p",{className:"map-pattern-summary"});
      this.patternCanvas.addEventListener("click",()=>{const block=this.events?.border;if(Number.isInteger(block)){this.patternCanvas.classList.add("is-selected");this.patternSummary.textContent=`Selected border cell uses block ${CoreUtils.hex(block)}. Choose another block in Blocks and press Use selected block to replace it.`;}},this.scope.options);
      this.patternApply=UiWindow.button("Use selected block",{icon:"fa-stamp",size:"sm",onClick:()=>this.setBorderPattern(this.selected_block)});
      this.patternOpen=UiWindow.button("Open block",{icon:"fa-table-cells-large",size:"sm",onClick:()=>{const block=this.events?.border;if(Number.isInteger(block)){this.selectBlock(block);this.windowManager?.reveal("Blocks",{target:this.tilesetCanvas,top:Math.floor(block/8)*32});}}});
      const entry=this.windowManager.register({id:"pattern",title:"Border pattern",icon:"▦",position:{left:310,top:54,width:210},families:["gb"],content:[
        Dom.create("div",{className:"map-pattern-preview map-pattern-preview--tiles"},this.patternCanvas),
        Dom.create("div",{className:"map-pattern-actions"},[this.patternApply,this.patternOpen]),
        this.patternSummary
      ]});
      entry.window.hide();
    }
    setMode(mode){
      this.pointerSession?.cancel("toolchange");
      this.workspace.viewport.classList.toggle("grab",mode===2);
      if(mode===7||mode===8)return this.zoom(mode===8?1:-1);
      if(mode===14||mode===15){this.showGrid=mode===14;return this.redraw();}
      if(MapLayerModes.is(mode)){this.layerMode=mode;return this.redraw();}
    }
    beginEdit(event){
      if(event.button!==0||!this.current)return false;
      const mode=this.controls.active;
      if(event.shiftKey&&mode!==13)return false;
      if(this.layerMode===MapLayerModes.COLLISION)return false;
      if(mode===0){this.painting=true;this.lastPaintIndex=-1;this.paintAt(event);return{capture:true,consumeClick:true,data:{mode}};}
      else if(mode===1){
        const record=this.eventAt(event);if(!record)return;
        this.eventDrag={record,start:{x:record.event.x,y:record.event.y},preview:{x:record.event.x,y:record.event.y}};
        return{capture:true,consumeClick:true,data:{mode}};
      }
      else if(mode===13){
        const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(!point)return;
        event.stopPropagation();if(!event.shiftKey)this.selections=[];this.activeSelection=new MapSelection(point);this.selections.push(this.activeSelection);this.redraw();
        return{capture:true,consumeClick:true,data:{mode}};
      }
      return false;
    }
    continueEdit(event){
      if(this.painting)this.paintAt(event);
      if(this.eventDrag){
        const point=this.eventPoint(event);if(!point)return;
        this.eventDrag.preview=point;this.redraw();
      }
      if(this.activeSelection){const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(point){this.activeSelection.update(point);this.redraw();}}
    }
    endEdit(_event,{cancelled=false}={}){
      if(this.painting){this.painting=false;this.lastPaintIndex=-1;}
      if(this.eventDrag){
        const {record,start,preview}=this.eventDrag;this.eventDrag=null;
        if(!cancelled&&(preview.x!==start.x||preview.y!==start.y))this.moveEvent(record.event,preview.x,preview.y);
        else this.redraw();
      }
      if(cancelled&&this.activeSelection)this.selections=this.selections.filter(selection=>selection!==this.activeSelection);
      this.activeSelection=null;
    }
    tapEdit(event){
      if(event.button!==0||!this.current)return false;
      if(this.layerMode===MapLayerModes.COLLISION){const cell=this.collisionCellAt(event);if(cell)this.selectCollisionCell(cell);return Boolean(cell);}
      const mode=this.controls.active;
      if(mode===3){this.inspectEvent(event);return true;}
      if(mode===4){const node=this.sceneMapAt(event.clientX,event.clientY);if(node&&node.id!==this.current.id){this.editor.navigate(()=>this.select(node.id,{focus:true}));return true;}return false;}
      const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(!point)return false;
      if(mode===5){this.selectBlock(this.blocks[point.y*this.current.header.width+point.x]);return true;}
      if(mode===6){this.fillRegion(point.x,point.y,this.selected_block);return true;}
      return false;
    }
    paintAt(event){
      const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(!point)return;
      const index=point.y*this.current.header.width+point.x;if(index===this.lastPaintIndex)return;
      this.lastPaintIndex=index;this.setBlock(point.x,point.y,this.selected_block);
    }
    selectBlock(block){
      this.selected_block=Math.max(0,Math.min(255,Number(block)||0));this.renderTileset(this.tileset);this.windowManager?.reveal("Blocks",{top:Math.floor(this.selected_block/8)*32});return this.selected_block;
    }
    pickTilesetBlock(event){
      const point=MapUtils.gridPoint(this.tilesetCanvas,event.clientX,event.clientY,32);
      if(point&&point.x>=0&&point.x<8&&point.y>=0&&point.y<16)this.selectBlock(point.y*8+point.x);
    }
    setBlock(x,y,block,{record=true,redraw=true}={}){
      if(!this.current||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.current.header.width||y>=this.current.header.height)return false;
      this.structureWriter.encode("u8",block);
      const index=y*this.current.header.width+x,previous=this.blocks[index];if(previous===block)return false;
      const offset=this.current.header.blocks+index,previousBytes=this.structureWriter.encode("u8",previous),nextBytes=this.structureWriter.encode("u8",block);
      const update=value=>{this.blocks[index]=value;if(redraw)this.redraw();};
      if(record)this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Paint block (${x}, ${y})`,description:`0x${previous.toString(16).padStart(2,"0")} → 0x${block.toString(16).padStart(2,"0")}`,
        patches:[{offset,previous:previousBytes,next:nextBytes}],afterApply:()=>update(block),afterUndo:()=>update(previous)
      });
      else{MemoryUtils.replace(this.memory,offset,previousBytes,nextBytes);update(block);}
      return true;
    }
    fillRegion(x,y,block){
      this.structureWriter.encode("u8",block);const width=this.current.header.width,height=this.current.header.height,start=y*width+x,target=this.blocks[start];
      if(target===block)return false;
      const pending=[start],seen=new Set(),indices=[];
      while(pending.length){const index=pending.pop();if(seen.has(index)||this.blocks[index]!==target)continue;seen.add(index);indices.push(index);const px=index%width,py=Math.floor(index/width);if(px>0)pending.push(index-1);if(px+1<width)pending.push(index+1);if(py>0)pending.push(index-width);if(py+1<height)pending.push(index+width);}
      const previous=this.structureWriter.encode("u8",target),next=this.structureWriter.encode("u8",block),base=this.current.header.blocks;
      const update=value=>{for(const index of indices)this.blocks[index]=value;this.redraw();};
      this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Fill ${indices.length} blocks`,description:`0x${target.toString(16).padStart(2,"0")} → 0x${block.toString(16).padStart(2,"0")}`,
        patches:indices.map(index=>({offset:base+index,previous,next})),afterApply:()=>update(block),afterUndo:()=>update(target)
      });
      return true;
    }
    fillSelections(block=this.selected_block){
      this.structureWriter.encode("u8",block);const width=this.current.header.width;
      const indices=[...new Set(this.selections.flatMap(selection=>selection.cells()).map(({x,y})=>y*width+x))].filter(index=>index>=0&&index<this.blocks.length&&this.blocks[index]!==block);
      if(!indices.length)return false;const previous=new Map(indices.map(index=>[index,this.blocks[index]])),next=this.structureWriter.encode("u8",block),base=this.current.header.blocks;
      const update=valueMap=>{for(const index of indices)this.blocks[index]=valueMap?.get(index)??block;this.redraw();};
      this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Fill ${indices.length} selected blocks`,description:`Use block 0x${block.toString(16).padStart(2,"0")}`,
        patches:indices.map(index=>({offset:base+index,previous:this.structureWriter.encode("u8",previous.get(index)),next})),
        afterApply:()=>update(null),afterUndo:()=>update(previous)
      });
      return true;
    }
    zoom(change,event){const current=Number(this.canvas.dataset.zoom||1),minimum=Math.max(.18,(this.focusZoom?.()??.36)*.5),factor=typeof change==="object"?change.factor:change>0?1.2:1/1.2;this.setZoom(Math.max(minimum,Math.min(4,current*factor)),event);}
    setZoom(value,event){this.workspace.setCanvasZoom(value,event?{clientX:event.clientX,clientY:event.clientY}:{});if(!event)this.center();}
    focusZoom(map=this.current){if(!map?.header)return 1;const width=Math.max(1,this.workspace.viewport.clientWidth*.82),height=Math.max(1,this.workspace.viewport.clientHeight*.82);return Math.max(.22,Math.min(2,width/(map.header.width*this.blockPixels),height/(map.header.height*this.blockPixels)));}
    focusCurrent({zoom=true}={}){if(!this.current)return this;const rect={x:this.currentOrigin.x*this.blockPixels,y:this.currentOrigin.y*this.blockPixels,width:this.current.header.width*this.blockPixels,height:this.current.header.height*this.blockPixels};if(zoom)this.workspace.focusCanvasRect(rect);else this.workspace.centerOnCanvas(rect.x+rect.width/2,rect.y+rect.height/2);return this;}
    fit(){return this.focusCurrent();}
    center(){this.workspace.center();return this;}
    activate({initial=false}={}){if(initial)this.focusCurrent();else this.redraw();this.workspace.windowManager?.clamp();return this;}
    mouseToMapCoordinates(_canvas,clientX,clientY){
      const point=this.workspace.canvasPoint(clientX,clientY);if(!point||!this.current)return false;
      const x=Math.floor(point.x/this.blockPixels)-this.currentOrigin.x,y=Math.floor(point.y/this.blockPixels)-this.currentOrigin.y;
      return x>=0&&y>=0&&x<this.current.header.width&&y<this.current.header.height?{x,y}:false;
    }
    contextAt(event){const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(!point)return null;return{point,block:this.blocks[point.y*this.current.header.width+point.x],events:this.eventRecords().filter(item=>Math.floor(item.event.x/2)===point.x&&Math.floor(item.event.y/2)===point.y).map(item=>item.event)};}
    sceneMapAt(clientX,clientY){
      const point=this.workspace.canvasPoint(clientX,clientY);if(!point||!this.mapScene)return null;
      return [...this.mapScene.nodes].reverse().find(node=>MapUtils.pointInRect(point,{x:(node.x+this.mapScene.origin.x)*this.blockPixels,y:(node.y+this.mapScene.origin.y)*this.blockPixels,width:node.width*this.blockPixels,height:node.height*this.blockPixels}))||null;
    }
    openSceneMap(event){
      const node=this.sceneMapAt(event.clientX,event.clientY);if(!node||node.id===this.current.id)return;
      event.preventDefault();this.editor.navigate(()=>this.select(node.id,{focus:true}));
    }
    contextActionEnabled(name){
      if(name==="fill-selection")return this.selections.length>0;
      return["pick","fill","properties","center","copy"].includes(name);
    }
    runContextAction(name,{point,block}){
      if(name==="pick"){this.selectBlock(block);return true;}
      if(name==="fill"){this.fillRegion(point.x,point.y,this.selected_block);return true;}
      if(name==="fill-selection"){this.fillSelections();return true;}
      if(name==="properties"){this.editBlockProperties(block);return true;}
      if(name==="center"){this.workspace.centerOnCanvas((this.currentOrigin.x+point.x+.5)*this.blockPixels,(this.currentOrigin.y+point.y+.5)*this.blockPixels);return true;}
      if(name==="copy"){CoreUtils.copyText(`${point.x},${point.y}`);return true;}
      return false;
    }
    async editBlockProperties(block){
      if(!this.tileset)return false;
      const metatile=this.memory.slice(this.tileset.blocks+block*16,16),tileIds=[...new Set(metatile)].filter(id=>id!==GbcCollisionTableWriter.TERMINATOR).sort((a,b)=>a-b),passable=this.collisionTiles(this.tileset);
      const values=await AppDialog.form({
        title:`Passable tiles · block ${CoreUtils.hex(block)}`,icon:"▦",
        message:"Red/Blue collision is a shared tileset list. Checked 8×8 tiles are passable everywhere this tileset reuses them.",
        detail:"The map samples groups of four tiles for each 16×16 movement cell. Changes may affect other blocks and maps using the same tileset.",
        fields:tileIds.map(id=>({name:`tile${id}`,label:`Tile ${CoreUtils.hex(id)}`,type:"checkbox",value:passable.has(id),fullWidth:false})),
        submitLabel:"Apply collision"
      });
      if(!values)return false;
      const next=new Set(this.collisionTableWriter.read(this.tileset.collision).tiles);
      for(const id of tileIds)values[`tile${id}`]?next.add(id):next.delete(id);
      return this.setCollisionTiles(next);
    }
    setCollisionTiles(tiles){
      if(!this.tileset)return false;
      try{
        const plan=this.collisionTableWriter.plan({tileset:this.tileset,tiles}),previous=plan.previous.tiles;
        if(previous.length===plan.nextTiles.length&&previous.every((value,index)=>value===plan.nextTiles[index]))return false;
        const refresh=()=>{
          this.collisionCache?.delete(this.tileset.offset);
          const id=this.tileset.id,refreshed=this.readTileset(id);this.tileset=refreshed;
          for(const node of this.mapScene?.nodes||[])if(node.tileset?.id===id)node.tileset=refreshed;
          this.renderDetails(this.current,this.events,this.tileset);this.redraw();
        };
        this.structureWriter.command(this.editor.commands,{
          label:`Edit tileset ${this.tileset.id} collision`,
          description:`${previous.length} → ${plan.nextTiles.length} passable tiles`,
          apply:()=>{this.collisionTableWriter.apply(plan);refresh();},
          undo:()=>{this.collisionTableWriter.restore(plan);refresh();}
        });
        return true;
      }catch(error){NotificationHandler.pop("Edit collision",error.message||String(error),NotificationType.ERROR);return false;}
    }
    spriteTable(){
      this.spriteCatalog||=new GbcOverworldSpriteCatalog(this.memory);
      return this.spriteCatalog.tableOffset;
    }
    getOverworldSprite(spriteId,direction="south",frameIndex=null,forceFlip=null){
      const movement=PokemonViewer.maps.movement,pose=movement.frame(direction,false,0,"gbc"),face=frameIndex??pose.index,flip=forceFlip??pose.flipX,key=`${spriteId}:${face}:${flip}`;
      this.spriteCache||=new Map();if(this.spriteCache.has(key))return this.spriteCache.get(key);
      const data=this.overworldSpriteData(spriteId);if(!data)return null;
      try{
        const offset=data.offset+Math.min(2,face)*64,canvas=document.createElement("canvas");canvas.width=canvas.height=16;
        const context=canvas.getContext("2d"),image=context.createImageData(16,16);
        for(let tile=0;tile<4;tile++){const pixels=GbcSpriteCodec.decodeTile(this.memory,offset+tile*16),tileX=(tile&1)*8,tileY=(tile>>1)*8;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const color=COLORS[pixels[y*8+x]],target=((tileY+y)*16+tileX+x)*4;image.data.set([color[0],color[1],color[2],pixels[y*8+x]===0?0:255],target);}}
        context.putImageData(image,0,0);if(flip){const copy=document.createElement("canvas");copy.width=copy.height=16;copy.getContext("2d").drawImage(canvas,16,0,-16,16);this.spriteCache.set(key,copy);return copy;}this.spriteCache.set(key,canvas);return canvas;
      }catch{return null;}
    }
    overworldSpriteData(spriteId){
      this.spriteTable();try{return this.spriteCatalog.source(spriteId);}catch{return null;}
    }
    eventActions(event){
      const actions=[];
      if(event.eventType==="Warp"&&this.maps[event.destinationMap]?.valid)actions.push({label:"Enter warp",icon:"↪",run:()=>this.enterWarp(event)});
      if(event.eventType==="Trainer")actions.push({label:"Open battle team",icon:"⚔",run:()=>EditorLinks.battle({trainer:{trainerClass:event.trainerClass,trainerNumber:event.trainerNumber,mapReference:this.bookmark()}})});
      if(["Object","Trainer","Item"].includes(event.eventType)){const data=this.overworldSpriteData(event.spriteId);if(data)actions.push({label:"Open sprite",icon:"fa-image",run:()=>this.openSprite(data)});}
      if(["Warp","Sign","Object","Trainer","Item"].includes(event.eventType))actions.push({label:"Delete event",icon:"⌫",run:()=>this.confirmDeleteEvent(event)});
      return actions;
    }
    openSprite(data){EditorLinks.sprite(data);}
    enterWarp(event){
      this.editor.navigate(()=>{
        this.select(event.destinationMap,{focus:true});
        const destination=this.events?.warps?.[Math.max(0,event.destinationWarpId-1)];
        if(destination)this.workspace.centerOnCanvas((this.currentOrigin.x+destination.x/2+.5)*this.blockPixels,(this.currentOrigin.y+destination.y/2+.5)*this.blockPixels);
      });
      return this;
    }
    sourceSymbol(name){return this.reader.capabilities?.provenance?.symbols?.[name]||null;}
    requireSourceSymbol(name){
      const symbol=this.sourceSymbol(name);
      if(!symbol)throw new Error(`Generation I Map Editor requires verified source symbol '${name}'.`);
      return symbol;
    }
    pointerTable(){return this.requireSourceSymbol("MapHeaderPointers").offset;}
    plausibleHeader(bank,address){return GbcMapDiscovery.plausibleHeader(this.memory,bank,address);}
    bankTable(){
      if(this._bankTable!==undefined)return this._bankTable;
      return(this._bankTable=this.requireSourceSymbol("MapHeaderBanks").offset);
    }
    tilesetTable(){
      if(this._tilesetTable!==undefined)return this._tilesetTable;
      const bytes=this.memory.bytes;
      for(let offset=7;offset<bytes.length-5;offset++){
        if(bytes[offset]===0xff&&bytes[offset+1]===0xff&&bytes[offset+2]===0xff&&bytes[offset+3]===0x52&&bytes[offset+4]===0x02){
          const table=offset-7,bank=bytes[table],blocks=this.memory.u16(table+1),graphics=this.memory.u16(table+3);
          if(bank>0&&blocks>=0x4000&&blocks<=0x7fff&&graphics>=0x4000&&graphics<=0x7fff)return(this._tilesetTable=table);
        }
      }
      return(this._tilesetTable=null);
    }
    readTileset(id){
      const table=this.tilesetTable();if(table===null)throw new Error("Gen I tileset table was not found.");
      const offset=table+id*12;this.memory.assertRange(offset,12);const bank=this.memory.u8(offset);
      return Object.freeze({id,offset,bank,blocks:this.memory.pointer16(offset+1,bank),graphics:this.memory.pointer16(offset+3,bank),collision:this.memory.pointer16(offset+5,bank)});
    }
    discoverMaps(){
      const table=this.pointerTable(),banks=this.bankTable(),limit=Math.min(0xf8,Math.floor((this.memory.size-table)/2));
      return Array.from({length:limit},(_,id)=>{const address=this.memory.u16(table+id*2),bank=banks===null?null:this.memory.u8(banks+id);let candidate;
        if(bank!==null&&this.plausibleHeader(bank,address))try{const offset=this.memory.banked(bank,address);candidate={valid:true,bank,offset,header:GbcMapHeader.read(this.memory,offset,bank)};}catch{}
        candidate||=this.findHeader(address);
        return{id,name:MAP_NAMES[id]||`Map ${id.toString(16).toUpperCase().padStart(2,"0")}`,address,...candidate};
      });
    }
    findHeader(address){
      if(address<0x4000||address>0x7fff)return{valid:false};let best=null;
      const banks=Math.min(0x40,Math.floor(this.memory.size/0x4000));
      for(let bank=1;bank<banks;bank++)try{
        const offset=this.memory.banked(bank,address),tileset=this.memory.u8(offset),height=this.memory.u8(offset+1),width=this.memory.u8(offset+2),blocksAddress=this.memory.u16(offset+3),text=this.memory.u16(offset+5),script=this.memory.u16(offset+7),flags=this.memory.u8(offset+9);
        let score=0;if(tileset<0x30)score+=2;if(width>0&&width<=80)score+=3;if(height>0&&height<=80)score+=3;if(blocksAddress>=0x4000&&blocksAddress<=0x7fff)score+=3;if(text>=0x4000&&text<=0x7fff)score++;if(script>=0x4000&&script<=0x7fff)score++;if((flags&0xf0)===0)score++;
        const header=GbcMapHeader.read(this.memory,offset,bank);score+=header.connections.reduce((total,connection)=>total+this.connectionValidity(connection),0);
        try{const objects=GbcMapObjectBlock.read(this.memory,header.objects);if(objects.warpCount<32&&objects.bgCount<64&&objects.objectCount<64)score+=3;}catch{score-=4;}
        if(!best||score>best.score)best={bank,offset,score,header};
      }catch{}
      if(!best||best.score<13)return{valid:false};
      return{valid:true,header:best.header};
    }
    connectionValidity(connection){if(connection.mapId>=0xf8||connection.width===0||connection.width>80||connection.length===0||connection.length>80)return-6;if(connection.direction==="north")return connection.y>0&&(connection.y&1)===1&&(connection.x&1)===0?4:-4;if(connection.direction==="south")return connection.y===0&&(connection.x&1)===0?4:-4;if(connection.direction==="west")return connection.x>0&&(connection.x&1)===1&&(connection.y&1)===0?4:-4;return connection.x===0&&(connection.y&1)===0?4:-4;}
    renderNavigation(){
      const valid=this.maps.filter(map=>map.valid);
      this.workspace.renderNavigation(valid.map(map=>({id:map.id,label:map.name})),{onSelect:item=>{
        if(item.id===this.current?.id){this.focusCurrent();this.redraw();return;}
        this.editor.navigate(()=>this.select(item.id,{focus:true}));
      }});
    }
    select(id,{focus=true}={}){
      const map=this.maps[id];if(!map?.valid)return;this.current=map;
      this.selections=[];this.activeSelection=null;
      this.navigation.querySelector(".current")?.classList.remove("current");this.navigation.querySelector(`[data-map='${id}']`)?.classList.add("current");
      const {header}=map,count=header.width*header.height,blocks=this.memory.slice(header.blocks,count);
      this.blockPixels=32;this.layerMode??=MapLayerModes.ALL;this.blocks=blocks;let tileset=null;try{tileset=this.readTileset(header.tileset);}catch{}this.tileset=tileset;
      this.objectsOffset=header.objects;
      this.buildScene(map);this.renderScene();
      let events=null;try{events=GbcMapObjectBlock.read(this.memory,header.objects);}catch{}
      this.events=events;this.eventsVisible=this.eventsVisible!==false;this.redraw();this.renderDetails(map,events,tileset);this.renderTileset(tileset);this.renderPatternWindow();if(focus)this.focusCurrent();
      this.workspace.setMapReference({mapId:map.id,title:map.name});
      if(this.regionMap)this.workspace.refreshRegionMap({sectionId:this.regionMap.sectionForMap(map)});
      return true;
    }
    buildScene(map){
      const main={id:map.id,map,header:map.header,x:0,y:0,width:map.header.width,height:map.header.height,blocks:this.blocks,tileset:this.tileset,current:true},scene=new MapScene(this.blockPixels);scene.add(main);
      const queue=[main],maximum=Math.min(this.maps.length,0xf8);
      while(queue.length&&scene.nodes.length<maximum){
        const source=queue.shift();
        for(const connection of source.header.connections||[]){
          if(scene.ids.has(connection.mapId))continue;
          const target=this.maps[connection.mapId];if(!target?.valid)continue;const h=target.header;let x=source.x,y=source.y;
          // pokered stores -2 * the declared perpendicular block offset.
          if(connection.direction==="north"){x-=connection.x/2;y-=h.height;}
          else if(connection.direction==="south"){x-=connection.x/2;y+=source.header.height;}
          else if(connection.direction==="west"){x-=h.width;y-=connection.y/2;}
          else{x+=source.header.width;y-=connection.y/2;}
          try{
            const node={id:target.id,map:target,header:h,x,y,width:h.width,height:h.height,blocks:this.memory.slice(h.blocks,h.width*h.height),tileset:this.readTileset(h.tileset),connection};
            if(scene.add(node))queue.push(node);
          }catch{}
        }
      }
      scene.layout({currentId:map.id}).resize(this.canvas);this.mapScene=scene;this.scene=scene.nodes;this.sceneOrigin=scene.origin;this.currentOrigin={x:scene.origin.x,y:scene.origin.y};this.connectedMapCount=scene.nodes.length-1;
    }
    renderScene(){
      const viewport=this.workspace.viewport;
      this.mapScene.render(this.canvas,(context,item,x,y,bounds)=>this.renderNode(context,item,x,y,bounds),{viewport,before:(context,scene,bounds)=>this.drawBorderPattern(context,bounds)})
        .drawBounds(this.canvas,{currentId:this.current.id,label:item=>item.map.name,viewport});
    }
    drawBorderPattern(context,bounds={x:0,y:0,width:this.canvas.width,height:this.canvas.height}){
      const border=this.events?.border,tileset=this.tileset;
      if(!Number.isInteger(border)||!tileset||!this.canvas.width||!this.canvas.height)return;
      const tile=document.createElement("canvas");tile.width=tile.height=this.blockPixels;
      try{this.renderGraphics(tile.getContext("2d"),{width:1,height:1},Uint8Array.of(border),tileset);}catch{return;}
      const pattern=context.createPattern(tile,"repeat");if(!pattern)return;
      context.save();context.imageSmoothingEnabled=false;context.fillStyle=pattern;context.fillRect(bounds.x,bounds.y,bounds.width,bounds.height);context.restore();
    }
    renderNode(context,item,x,y,bounds){
      context.save();
      if(MapLayerModes.dimsMap(this.layerMode))context.globalAlpha=.24;
      try{this.renderGraphics(context,item.header,item.blocks,item.tileset,x,y,bounds);}
      catch{this.renderFallback(context,item.header,item.blocks,x,y,bounds);}
      context.restore();
      if(this.layerMode===MapLayerModes.COLLISION)this.drawCollisionOverlay(context,item,x,y,bounds);
    }
    renderGraphics(context,header,blocks,tileset,originX=0,originY=0,bounds={x:originX,y:originY,width:header.width*this.blockPixels,height:header.height*this.blockPixels}){
      const range=MapScene.blockRange(header.width,header.height,originX,originY,bounds,this.blockPixels),width=range.right-range.left,height=range.bottom-range.top;
      if(width<=0||height<=0)return;
      const image=context.createImageData(width*this.blockPixels,height*this.blockPixels),tileCache=new Map();
      const tilePixels=id=>{if(!tileCache.has(id))tileCache.set(id,GbcSpriteCodec.decodeTile(this.memory,tileset.graphics+id*16));return tileCache.get(id);};
      for(let blockY=range.top;blockY<range.bottom;blockY++)for(let blockX=range.left;blockX<range.right;blockX++){
        const block=blocks[blockY*header.width+blockX],metatile=this.memory.slice(tileset.blocks+block*16,16);
        for(let tileY=0;tileY<4;tileY++)for(let tileX=0;tileX<4;tileX++){
          const pixels=tilePixels(metatile[tileY*4+tileX]);
          for(let y=0;y<8;y++)for(let x=0;x<8;x++){
            const color=COLORS[pixels[y*8+x]],px=(blockX-range.left)*32+tileX*8+x,py=(blockY-range.top)*32+tileY*8+y,target=py*image.width*4+px*4;
            image.data.set([color[0],color[1],color[2],255],target);
          }
        }
      }
      context.putImageData(image,originX+range.left*this.blockPixels,originY+range.top*this.blockPixels);
    }
    renderMovementEnvironment(event,canvas,{center=48}={}){
      if(!this.current||!this.tileset||!canvas)return false;
      const context=canvas.getContext("2d"),border=this.events?.border,eventX=Number(event?.x||0),eventY=Number(event?.y||0);
      context.imageSmoothingEnabled=false;context.clearRect(0,0,canvas.width,canvas.height);
      if(Number.isInteger(border)){
        const tile=document.createElement("canvas");tile.width=tile.height=this.blockPixels;
        try{
          this.renderGraphics(tile.getContext("2d"),{width:1,height:1},Uint8Array.of(border),this.tileset);
          const pattern=context.createPattern(tile,"repeat");if(pattern){context.fillStyle=pattern;context.fillRect(0,0,canvas.width,canvas.height);}
        }catch{}
      }
      const originX=center-eventX*16,originY=center-eventY*16;
      try{this.renderGraphics(context,this.current.header,this.blocks,this.tileset,originX,originY,{x:0,y:0,width:canvas.width,height:canvas.height});return true;}
      catch{return false;}
    }
    renderFallback(context,header,blocks,originX=0,originY=0,bounds={x:originX,y:originY,width:header.width*32,height:header.height*32}){const range=MapScene.blockRange(header.width,header.height,originX,originY,bounds,32);for(let y=range.top;y<range.bottom;y++)for(let x=range.left;x<range.right;x++){const block=blocks[y*header.width+x],hue=(block*47)%360;context.fillStyle=`hsl(${hue} 42% ${35+(block%4)*10}%)`;context.fillRect(originX+x*32,originY+y*32,32,32);}}
    collisionTiles(tileset){
      this.collisionCache||=new Map();if(this.collisionCache.has(tileset.offset))return this.collisionCache.get(tileset.offset);
      const result=new Set();for(let cursor=tileset.collision,count=0;count<256&&this.memory.contains(cursor);cursor++,count++){const tile=this.memory.u8(cursor);if(tile===0xff)break;result.add(tile);}
      this.collisionCache.set(tileset.offset,result);return result;
    }
    drawCollisionOverlay(context,item,originX,originY,bounds={x:originX,y:originY,width:item.header.width*32,height:item.header.height*32}){
      if(!item.tileset)return;const passable=this.collisionTiles(item.tileset),range=MapScene.blockRange(item.header.width,item.header.height,originX,originY,bounds,32);context.save();
      for(let blockY=range.top;blockY<range.bottom;blockY++)for(let blockX=range.left;blockX<range.right;blockX++){
        const block=item.blocks[blockY*item.header.width+blockX];let metatile;try{metatile=this.memory.slice(item.tileset.blocks+block*16,16);}catch{continue;}
        // Gen I moves on a 16px grid, but samples a different 8px subtile
        // depending on the entry direction. A cell is fully open only when
        // every directional sample in its 2x2 tile quadrant is passable.
        for(let cellY=0;cellY<2;cellY++)for(let cellX=0;cellX<2;cellX++){
          const start=cellY*8+cellX*2;
          const open=[start,start+1,start+4,start+5].every(index=>passable.has(metatile[index]));
          // Gen I has no elevation bits. Keep traversable cells clear and mark
          // only collision cells; a green square falsely suggests GBA-style
          // elevation/passability metadata that does not exist in this format.
          if(!open){
            const x=originX+blockX*32+cellX*16,y=originY+blockY*32+cellY*16;
            context.fillStyle="rgba(220,38,38,.42)";context.fillRect(x,y,16,16);
            context.strokeStyle="rgba(127,29,29,.8)";context.strokeRect(x+.5,y+.5,15,15);
          }
          const selected=this.collisionSelection;
          if(item.current&&selected?.blockX===blockX&&selected?.blockY===blockY&&selected?.cellX===cellX&&selected?.cellY===cellY){const x=originX+blockX*32+cellX*16,y=originY+blockY*32+cellY*16;context.lineWidth=2;context.strokeStyle="#fff";context.strokeRect(x+1,y+1,14,14);}
        }
      }
      context.restore();
    }
    eventRecords(events=this.events){
      const colors={Object:"#16a34a",Trainer:"#ea580c",Item:"#0891b2"};
      const typed=(event,type)=>{const value={eventType:type,...event};return this.eventDrag?.record.event.offset===event.offset?{...value,...this.eventDrag.preview}:value;};
      return events?[...events.warps.map((event,index)=>({type:"Warp",index,event:typed(event,"Warp"),color:"#7c3aed"})),...events.backgrounds.map((event,index)=>({type:"Sign",index,event:typed(event,"Sign"),color:"#db2777"})),...events.objects.map((event,index)=>({type:event.eventType,index,event:typed(event,event.eventType),color:colors[event.eventType]||colors.Object}))]:[];
    }
    drawEventOverlays(events){
      if(!events||!this.eventsVisible)return;const context=this.canvas.getContext("2d");
      for(const {type,event} of this.eventRecords(events)){const x=this.currentOrigin.x*32+event.x*16,y=this.currentOrigin.y*32+event.y*16,model=PokemonViewer.maps.movement.describe(event,"gbc"),sprite=event.spriteId?this.getOverworldSprite(event.spriteId,model.initial):null;PokemonViewer.maps.overlays.vision(context,{x,y,direction:model.initial,range:model.sight});PokemonViewer.maps.overlays.marker(context,{x,y,type,sprite});}
    }
    drawGrid(){if(!this.showGrid)return;const bounds=this.mapScene.visibleBounds(this.canvas,this.workspace.viewport,0),x=Math.floor(bounds.x/32)*32,y=Math.floor(bounds.y/32)*32;PokemonViewer.maps.overlays.grid(this.canvas.getContext("2d"),{x,y,width:Math.ceil((bounds.x+bounds.width-x)/32)*32,height:Math.ceil((bounds.y+bounds.height-y)/32)*32,cell:32,scale:Number(this.canvas.dataset.zoom||1),color:"rgba(24,84,128,.34)"});}
    drawSelections(){
      if(!this.selections.length)return;const context=this.canvas.getContext("2d"),scale=Number(this.canvas.dataset.zoom||1);
      for(const selection of this.selections){const bounds=selection.bounds,x=(this.currentOrigin.x+bounds.left)*32,y=(this.currentOrigin.y+bounds.top)*32,width=selection.width*32,height=selection.height*32;PokemonViewer.maps.overlays.selection(context,{x,y,width,height,scale});}
    }
    redraw(){if(!this.current)return;this.renderScene();/* Event sprites are an editor layer, never part of the composed Gen I world. */const showEvents=MapLayerModes.showsEvents(this.layerMode)&&this.layerMode===MapLayerModes.EVENTS;if(showEvents)this.drawEventOverlays(this.events);this.drawGrid();this.drawSelections();}
    renderTileset(tileset){
      if(!tileset){this.tilesetCanvas.width=1;this.tilesetCanvas.height=1;return;}
      const columns=8,count=128;this.tilesetCanvas.width=columns*32;this.tilesetCanvas.height=Math.ceil(count/columns)*32;const context=this.tilesetCanvas.getContext("2d");context.clearRect(0,0,this.tilesetCanvas.width,this.tilesetCanvas.height);
      for(let block=0;block<count;block++)try{this.renderGraphics(context,{width:1,height:1},Uint8Array.of(block),tileset,(block%columns)*32,Math.floor(block/columns)*32);}catch{break;}
      if(this.selected_block<count){const x=this.selected_block%columns*32,y=Math.floor(this.selected_block/columns)*32;PokemonViewer.maps.overlays.picker(context,{x,y,width:32,height:32});}
    }
    renderPatternWindow(){
      if(!this.patternCanvas)return;
      const canvas=this.patternCanvas,context=canvas.getContext("2d"),tileset=this.tileset,border=this.events?.border;
      canvas.classList.remove("is-selected");
      context.clearRect(0,0,canvas.width,canvas.height);
      if(!tileset){this.patternApply.disabled=true;this.patternOpen.disabled=true;this.patternSummary.textContent="Load a map with a verified tileset to inspect its border pattern.";return;}
      const valid=Number.isInteger(border)&&border>=0&&border<128;this.patternApply.disabled=!valid;this.patternOpen.disabled=!valid;
      if(valid){
        this.renderGraphics(context,{width:1,height:1},Uint8Array.of(border),tileset);
        this.patternSummary.textContent=`Block 0x${border.toString(16).toUpperCase().padStart(2,"0")} · choose another block in Blocks and apply it here.`;
      }else this.patternSummary.textContent="This map has no readable border block.";
    }
    setBorderPattern(block){
      if(!this.events||!Number.isInteger(block)||block<0||block>0x7f)return false;
      return this.structureWriter.edit(this.editor.commands,{base:this.events.offset,schema:{border:{offset:0,type:"u8",min:0,max:127}},current:this.events,values:{border:block},label:"Edit map border pattern",description:`Set Gen I repeated border metatile to 0x${block.toString(16).toUpperCase().padStart(2,"0")}.`,afterWrite:()=>{this.reloadEvents();this.renderPatternWindow();this.redraw();}});
    }
    openTilesetBlock(event){
      if(!this.tileset)return;const point=MapUtils.gridPoint(this.tilesetCanvas,event.clientX,event.clientY,32);if(!point)return;const block=point.y*8+point.x;
      try{
        const ids=this.memory.slice(this.tileset.blocks+block*16,16),bytes=new Uint8Array(16*16),segments=[];
        ids.forEach((tile,index)=>{const offset=this.tileset.graphics+tile*16;bytes.set(this.memory.slice(offset,16),index*16);segments.push({offset,length:16});});
        this.openSprite({offset:this.tileset.graphics+ids[0]*16,bytes,segments,count:16,columns:4,editable:true,title:`Tileset ${this.current.header.tileset} · block 0x${block.toString(16).toUpperCase()}`});
      }catch{}
    }
    renderDetails(map,events,tileset){
      const h=map.header,scripts=this.mapScriptRecords(map),properties={Map:map.name,ID:`0x${map.id.toString(16).toUpperCase().padStart(2,"0")}`,Bank:`0x${h.bank.toString(16).toUpperCase()}`,Header:`0x${h.offset.toString(16).toUpperCase().padStart(6,"0")}`,"Bank table":this.bankTable()===null?"Fallback scan":`0x${this.bankTable().toString(16).toUpperCase().padStart(6,"0")}`,Tileset:h.tileset,Size:`${h.width} × ${h.height}`,Blocks:`0x${h.blocks.toString(16).toUpperCase().padStart(6,"0")}`,"Map controller":CoreUtils.hex(h.script,6),Blockset:tileset?`0x${tileset.blocks.toString(16).toUpperCase().padStart(6,"0")}`:"—",Graphics:tileset?`0x${tileset.graphics.toString(16).toUpperCase().padStart(6,"0")}`:"—",Connections:h.connectionCount,Warps:events?.warpCount??"—",Signs:events?.bgCount??"—",Objects:events?.objectCount??"—"};
      const descriptions={Bank:"ROM bank containing this map header.",Header:"Resolved file offset of the map header.","Bank table":"ROM offset of MapHeaderBanks. Fallback scan means no parallel bank table was found.",Blocks:"Resolved ROM position of the map's block layout.","Map controller":"LR35902 code selected by this header. It dispatches the map's state machine and is not a GBA-style event script table.",Blockset:"Resolved ROM position of the tileset metatile definitions.",Graphics:"Resolved ROM position of the tileset 2bpp graphics.",Connections:"Immediate north, south, west, or east neighbours declared by this header."};
      const actions=[UiWindow.button("Resize map",{icon:"↔",onClick:()=>this.editLayout()}),UiWindow.button("Connections",{icon:"⇄",onClick:()=>this.editConnections()})];
      const complexity=Object.fromEntries(["ID","Bank","Header","Bank table","Tileset","Blocks","Map controller","Blockset","Graphics"].map(key=>[key,"advanced"]));
      this.workspace.renderProperties({title:map.name,values:properties,descriptions,complexity,actions,scripts,onScript:item=>this.openMapScript(item),events:this.eventRecords(events),onEvent:record=>this.showEvent(record.type,record.index,record.event)});
    }
    mapScriptRecords(map=this.current){
      const header=map?.header;if(!header||!Number.isInteger(header.script))return[];
      return[{kind:"controller",name:"Map controller",phase:"Native LR35902 map state controller.",script:header.script,reference:{kind:"gbc16",pointerOffset:header.offset+7,bank:header.bank},view:"original",scriptKind:"map-controller"}];
    }
    openMapScript(item){if(!Number.isInteger(item?.script))return false;EditorLinks.code(item.script,{view:item.view||"original",reference:item.reference,scriptKind:item.scriptKind||"map-controller"});return true;}
    editLayout(){const h=this.current?.header;if(h)this.workspace.editLayout({title:`Resize ${this.current.name}`,width:h.width,height:h.height,onApply:(width,height)=>this.resizeMap(width,height)});}
    resizeMap(width,height){
      const map=this.current,h=map?.header;if(!h||width===h.width&&height===h.height)return false;
      const plan=this.layoutWriter.plan({offset:h.blocks,width:h.width,height:h.height,nextWidth:width,nextHeight:height,stride:1,reference:{kind:"gbc16",pointerOffset:h.offset+3,bank:h.bank},dimensions:[{offset:h.offset+2,type:"u8"},{offset:h.offset+1,type:"u8"}]});
      const update=(target,nextWidth,nextHeight,bytes)=>{map.header=Object.freeze({...map.header,width:nextWidth,height:nextHeight,blocks:target});this.blocks=bytes.slice();this.select(map.id,{focus:true});};
      this.editor.execute({label:`Resize ${map.name}`,description:`${h.width} × ${h.height} → ${width} × ${height}`,do:()=>update(this.layoutWriter.apply(plan),width,height,plan.nextBytes),undo:()=>update(this.layoutWriter.restore(plan),h.width,h.height,plan.sourceBytes)});
      return true;
    }
    connectionFields(connection){
      return[
        {key:"mapId",label:"Destination map",value:connection.mapId,min:0,max:247},
        {key:"length",label:"Connection length",value:connection.length,min:1,max:255},
        {key:"width",label:"Connected width",value:connection.width,min:1,max:255},
        {key:"x",label:"Horizontal offset",value:connection.x,min:-128,max:127},
        {key:"y",label:"Vertical offset",value:connection.y,min:-128,max:127}
      ];
    }
    editConnections(){
      const current=this.current;if(!current)return false;const connections=current.header.connections||[],available=[["north",0],["south",1],["west",2],["east",3]].filter(([direction])=>!connections.some(item=>item.direction===direction));
      this.workspace.editConnections({
        title:`Connections · ${current.name}`,
        connections:connections.map(connection=>({label:`${connection.direction} → ${this.maps[connection.mapId]?.name||`Map ${connection.mapId}`}`,fields:this.connectionFields(connection)})),
        newConnection:available.length?{fields:[
          {key:"direction",label:"Direction",value:available[0][1],options:available.map(([label,value])=>({label,value}))},
          {key:"mapId",label:"Destination map",value:0,min:0,max:247},
          {key:"offset",label:"Perpendicular offset",value:0,min:-63,max:63}
        ]}:null,
        onApply:(index,values)=>this.updateConnection(index,values),
        onAdd:values=>this.addConnection(values),
        onRemove:index=>this.removeConnection(index)
      });
      return true;
    }
    updateConnection(index,values){
      const map=this.current,connection=map?.header?.connections?.[index];if(!connection)return false;
      const schema={mapId:{offset:0,type:"u8"},length:{offset:5,type:"u8"},width:{offset:6,type:"u8"},y:{offset:7,type:"s8"},x:{offset:8,type:"s8"}};
      return this.structureWriter.edit(this.editor.commands,{base:connection.offset,schema,current:connection,values,label:`Edit ${connection.direction} connection`,description:"Update Gen I map connection",afterWrite:()=>{map.header=GbcMapHeader.read(this.memory,map.header.offset,map.header.bank);this.select(map.id,{focus:true});}});
    }
    worldMapBase(){
      for(const source of this.maps)if(source?.valid)for(const connection of source.header.connections||[]){
        const target=this.maps[connection.mapId];if(!target?.valid)continue;const width=target.header.width,height=target.header.height;
        const delta=connection.direction==="north"?(width+6)*height+1:connection.direction==="west"?(width+6)*2-6:width+7;
        return(connection.windowAddress-delta)&0xffff;
      }
      throw new RangeError("No existing Gen I connection is available to resolve wOverworldMap.");
    }
    createConnectionValues(directionIndex,mapId,offset){
      const direction=["north","south","west","east"][directionIndex],source=this.current?.header,target=this.maps[mapId]?.header;
      if(!direction||!source||!target)throw new RangeError("Choose a valid direction and destination map.");
      if(!Number.isInteger(offset)||offset<-63||offset>63)throw new RangeError("Connection offset must be -63..63.");
      let sourceSkip=0,targetStart=offset+3;if(targetStart<2){sourceSkip=-targetStart;targetStart=0;}
      const targetBlocks=this.memory.u16(target.offset+3),base=this.worldMapBase();let blockDelta,mapDelta,windowDelta,y,x,length;
      if(direction==="north"){blockDelta=target.width*(target.height-3)+sourceSkip;mapDelta=targetStart;windowDelta=(target.width+6)*target.height+1;y=target.height*2-1;x=offset*-2;length=Math.min(source.width+3-offset,target.width)-sourceSkip;}
      else if(direction==="south"){blockDelta=sourceSkip;mapDelta=(source.width+6)*(source.height+3)+targetStart;windowDelta=target.width+7;y=0;x=offset*-2;length=Math.min(source.width+3-offset,target.width)-sourceSkip;}
      else if(direction==="west"){blockDelta=target.width*sourceSkip+target.width-3;mapDelta=(source.width+6)*targetStart;windowDelta=(target.width+6)*2-6;y=offset*-2;x=target.width*2-1;length=Math.min(source.height+3-offset,target.height)-sourceSkip;}
      else{blockDelta=target.width*sourceSkip;mapDelta=(source.width+6)*targetStart+source.width+3;windowDelta=target.width+7;y=offset*-2;x=0;length=Math.min(source.height+3-offset,target.height)-sourceSkip;}
      return{direction,mapId,blocksAddress:(targetBlocks+blockDelta)&0xffff,mapAddress:(base+mapDelta)&0xffff,length,width:target.width,y,x,windowAddress:(base+windowDelta)&0xffff};
    }
    refreshConnectionHeader(){
      const map=this.current,pointerOffset=this.pointerTable()+map.id*2,address=this.memory.u16(pointerOffset),offset=this.memory.banked(map.header.bank,address);
      map.address=address;map.offset=offset;map.header=GbcMapHeader.read(this.memory,offset,map.header.bank);this.select(map.id,{focus:true});return map.header;
    }
    addConnection(values){
      const map=this.current;if(!map)return false;const connection=this.createConnectionValues(values.direction,values.mapId,values.offset),plan=this.connectionHeaderWriter.insert({header:map.header,pointerOffset:this.pointerTable()+map.id*2},connection);
      this.editor.execute({label:`Add ${connection.direction} connection`,description:`Connect ${map.name} → ${this.maps[connection.mapId].name}`,do:()=>{this.connectionHeaderWriter.apply(plan);this.refreshConnectionHeader();},undo:()=>{this.connectionHeaderWriter.restore(plan);this.refreshConnectionHeader();}});return true;
    }
    removeConnection(index){
      const map=this.current;if(!map)return false;const connection=map.header.connections[index],plan=this.connectionHeaderWriter.remove({header:map.header,pointerOffset:this.pointerTable()+map.id*2},index);
      this.editor.execute({label:`Delete ${connection.direction} connection`,description:`Disconnect ${map.name} from ${this.maps[connection.mapId]?.name||connection.mapId}`,do:()=>{this.connectionHeaderWriter.apply(plan);this.refreshConnectionHeader();},undo:()=>{this.connectionHeaderWriter.restore(plan);this.refreshConnectionHeader();}});return true;
    }
    showEvent(type,index,event){this.eventInspector.show({eventType:type,eventIndex:index,...event,...this.eventAssociations(event)},{x:event.x,y:event.y},this.visualization.clientWidth-320,80);}
    eventReference(event=this.eventInspector?.current){return EventBookmarkUtils.create(event);}
    bookmark(){return this.current?{mapId:this.current.id,title:this.current.name,event:this.eventReference()}:{};}
    restoreBookmark(target){
      this.select(target.mapId,{focus:true});
      if(!target.event)return this;
      const record=EventBookmarkUtils.resolve(this.eventRecords(),target.event);
      if(!record)throw new Error("The bookmarked map event no longer exists or is ambiguous.");
      this.workspace.centerOnCanvas((this.currentOrigin.x+record.event.x/2+.5)*32,(this.currentOrigin.y+record.event.y/2+.5)*32);
      this.showEvent(record.type,record.index,record.event);return this;
    }
    canCreateEvent(type){return type===0||type===1||type===3;}
    setObjectsOffset(offset){
      this.objectsOffset=offset;const header=Object.freeze({...this.current.header,objects:offset});this.current.header=header;
      const node=this.mapScene?.nodes.find(item=>item.id===this.current.id);if(node)node.header=header;
      return offset;
    }
    createEvent(type){
      if(!this.canCreateEvent(type)||!this.current||!this.events)return false;
      const kind=type===0?"Object":type===1?"Warp":"Sign",point=this.hoverBlock||{x:0,y:0};
      try{
        const entry=this.eventBlockWriter.entry(kind,{x:point.x*2,y:point.y*2}),plan=this.eventBlockWriter.insert(this.current.header,this.events,kind,entry);
        this.editor.execute({
          label:`Add ${kind.toLowerCase()}`,description:`Relocate ${plan.nextBytes.length}-byte Gen I object block`,
          do:()=>{this.eventBlockWriter.apply(plan);this.setObjectsOffset(plan.allocation);this.reloadEvents();},
          undo:()=>{this.eventBlockWriter.restore(plan);this.setObjectsOffset(plan.previousOffset);this.reloadEvents();}
        });return true;
      }catch(error){NotificationHandler.pop("Add event",error.message||String(error),NotificationType.ERROR);return false;}
    }
    deleteEvent(event){
      if(!this.current||!this.events)return false;const kind=event.eventType==="Warp"?"Warp":event.eventType==="Sign"?"Sign":"Object",index=Number(event.eventIndex);
      try{
        const plan=this.eventBlockWriter.remove(this.current.header,this.events,kind,index);
        this.editor.execute({
          label:`Delete ${event.eventType.toLowerCase()}`,description:`Relocate ${plan.nextBytes.length}-byte Gen I object block`,
          do:()=>{this.eventBlockWriter.apply(plan);this.setObjectsOffset(plan.allocation);this.reloadEvents();},
          undo:()=>{this.eventBlockWriter.restore(plan);this.setObjectsOffset(plan.previousOffset);this.reloadEvents();}
        });return true;
      }catch(error){NotificationHandler.pop("Delete event",error.message||String(error),NotificationType.ERROR);return false;}
    }
    async confirmDeleteEvent(event){
      const remove=await AppDialog.confirm({title:`Delete ${event.eventType}?`,message:"The Gen I object block will be rebuilt inside the same ROM bank.",detail:"This change can be undone from History.",confirmLabel:"Delete event",cancelLabel:"Keep event",danger:true});
      return remove?this.deleteEvent(event):false;
    }
    eventFieldSchema(event){
      const position=event.eventType==="Warp"||event.eventType==="Sign"
        ?{x:{label:"X",offset:1,type:"u8",min:0,max:255},y:{label:"Y",offset:0,type:"u8",min:0,max:255}}
        :{x:{label:"X",offset:2,type:"u8",min:0,max:251,serialize:value=>value+4},y:{label:"Y",offset:1,type:"u8",min:0,max:251,serialize:value=>value+4}};
      if(event.eventType==="Warp")return{...position,destinationWarpId:{label:"Destination warp",offset:2,type:"u8",min:0,max:255},destinationMap:{label:"Destination map",offset:3,type:"u8",min:0,max:255}};
      if(event.eventType==="Sign")return{...position,textId:{label:"Text ID",offset:2,type:"u8",min:0,max:255}};
      const object={spriteId:{label:"Sprite",offset:0,type:"u8",min:0,max:255},...position,movement:{label:"Movement",offset:3,type:"u8",min:0,max:255},rangeOrDirection:{label:"Range or direction",offset:4,type:"u8",min:0,max:255}};
      if(event.eventType==="Trainer")return{...object,trainerClass:{label:"Trainer class",offset:6,type:"u8",min:0,max:255},trainerNumber:{label:"Trainer number",offset:7,type:"u8",min:0,max:255}};
      if(event.eventType==="Item")return{...object,itemId:{label:"Item",offset:6,type:"u8",min:0,max:255}};
      return{...object,textId:{label:"Text ID",offset:5,type:"u8",min:0,max:63,serialize:value=>event.kind|(value&0x3f)}};
    }
    eventFields(event){return Object.entries(this.eventFieldSchema(event)).map(([key,field])=>({key,...field,value:Number(event[key])}));}
    updateEventFields(event,values,{label}={}){
      if(!Number.isInteger(event?.offset))return false;
      const schema=this.eventFieldSchema(event);
      return this.structureWriter.edit(this.editor.commands,{
        base:event.offset,schema,current:event,values,
        label:label||`Edit ${event.eventType}`,description:"Update Gen I event properties",
        afterWrite:()=>this.reloadEvents()
      });
    }
    moveEvent(event,x,y){return this.updateEventFields(event,{x,y},{label:`Move ${event.eventType}`});}
    reloadEvents(){
      try{this.events=GbcMapObjectBlock.read(this.memory,this.objectsOffset);}catch{this.events=null;}
      this.redraw();this.renderDetails(this.current,this.events,this.tileset);return this.events;
    }
    eventAssociations(event){
      if(!event.textId||!this.current?.header)return{};
      try{
        const header=this.current.header,textAddress=this.memory.u16(header.textPointers+(event.textId-1)*2);
        const entryPointer=this.memory.pointer16(header.textPointers+(event.textId-1)*2,header.bank);
        const analysis=(this.textCodec||=new GbcTextCodec(this.memory,this.reader.getDictionary(this.reader.textDictionary))).analyze(entryPointer);
        const nearReference={kind:"gbc16",pointerOffset:header.textPointers+(event.textId-1)*2,bank:header.bank};
        if(analysis.kind==="text"){
          const reference=analysis.command==="text_far"?{kind:"gbcFar",addressOffset:entryPointer+1,bankOffset:entryPointer+3}:nearReference;
          return{textAddress,textPointer:analysis.textOffset,textCommand:analysis.command,textPreview:analysis.preview,$textReference:reference};
        }
        return{textAddress,textScriptPointer:entryPointer,textCommand:analysis.command,scriptOffset:analysis.scriptOffset,$codeView:analysis.view,$codeReference:analysis.view==="script"?nearReference:null};
      }catch{return{};}
    }
    codeReference(event,target){return target==="text"?event?.$textReference:event?.$codeReference;}
    decodeText(offset,limit=512){return(this.textCodec||=new GbcTextCodec(this.memory,this.reader.getDictionary(this.reader.textDictionary))).decode(offset,{limit});}
    inspectEvent(event){if(!this.eventsVisible||this.controls.active!==3)return;const point=this.mapPoint(event,16);if(!point)return;const tileX=point.x-this.currentOrigin.x*2,tileY=point.y-this.currentOrigin.y*2,record=this.eventRecords().find(item=>item.event.x===tileX&&item.event.y===tileY);if(record)this.showEvent(record.type,record.index,record.event);}
    eventPoint(event){const point=this.mapPoint(event,16);if(!point)return null;const x=point.x-this.currentOrigin.x*2,y=point.y-this.currentOrigin.y*2;return x>=0&&y>=0&&x<this.current.header.width*2&&y<this.current.header.height*2?{x,y}:null;}
    eventAt(event){const point=this.eventPoint(event);return point?this.eventRecords().find(item=>item.event.x===point.x&&item.event.y===point.y)||null:null;}
    mapPoint(event,size){return MapUtils.gridPoint(this.canvas,event.clientX,event.clientY,size);}
    inspectBlock(event){if(!this.current)return;const point=this.mapPoint(event,this.blockPixels);if(!point)return;const x=point.x-this.currentOrigin.x,y=point.y-this.currentOrigin.y;if(x>=0&&y>=0&&x<this.current.header.width&&y<this.current.header.height){this.hoverBlock={x,y};this.canvas.title=`X ${x} · Y ${y} · Block 0x${this.blocks[y*this.current.header.width+x].toString(16).toUpperCase().padStart(2,"0")}`;}}
    collisionCellAt(event){const point=this.mapPoint(event,16);if(!point||!this.current)return null;const x=point.x-this.currentOrigin.x*2,y=point.y-this.currentOrigin.y*2;if(x<0||y<0||x>=this.current.header.width*2||y>=this.current.header.height*2)return null;const blockX=Math.floor(x/2),blockY=Math.floor(y/2),cellX=x%2,cellY=y%2,block=this.blocks[blockY*this.current.header.width+blockX];let tiles=[];try{const metatile=this.memory.slice(this.tileset.blocks+block*16,16),start=cellY*8+cellX*2;tiles=[start,start+1,start+4,start+5].map(index=>metatile[index]);}catch{}return{blockX,blockY,cellX,cellY,block,tiles};}
    selectCollisionCell(cell){this.collisionSelection=cell;const passable=this.collisionTiles(this.tileset),open=cell.tiles.length===4&&cell.tiles.every(tile=>passable.has(tile));this.workspace.renderProperties({title:"Gen I collision cell",values:{Cell:`${cell.blockX * 2 + cell.cellX}, ${cell.blockY * 2 + cell.cellY}`,Metatile:CoreUtils.hex(cell.block),State:open?"Passable":"Blocked","Sampled tiles":cell.tiles.map(tile=>CoreUtils.hex(tile)).join(" ")||"Unavailable"},actions:[UiWindow.button("Edit tileset collision",{icon:"✎",onClick:()=>this.editBlockProperties(cell.block)})],events:[]});this.redraw();return true;}
    refresh(){if(this.current)this.select(this.current.id);return this;}
    destroy(){this.pointerSession?.destroy();this.pointerSession=null;this.scope.destroy();this.contextMenu?.close();this.eventInspector?.element.remove();}
  }
  global.GbcMapDriver=GbcMapDriver;
  ((global.PokemonViewer ||= {}).maps ||= {}).GbcDriver=GbcMapDriver;
})(globalThis);
