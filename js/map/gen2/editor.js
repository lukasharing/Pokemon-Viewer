(function(global){
  "use strict";

  const GROUP_NAMES=Object.freeze([
    "Olivine","Mahogany","Dungeons","Ecruteak","Blackthorn","Cinnabar","Cerulean",
    "Azalea","Lake of Rage","Violet","Goldenrod","Vermilion","Pallet","Pewter",
    "Fast Ship","Indigo","Fuchsia","Lavender","Silver","Cable Club","Celadon",
    "Cianwood","Viridian","New Bark","Saffron","Cherrygrove"
  ]);
  // Day palettes from pret/pokecrystal gfx/tilesets/bg_tiles.pal.
  const RGB5=value=>Math.round(value*255/31);
  const palette=(...values)=>Object.freeze(values.map(color=>Object.freeze([...color.map(RGB5),255])));
  const DAY_PALETTES=Object.freeze([
    palette([27,31,27],[21,21,21],[13,13,13],[7,7,7]),
    palette([27,31,27],[31,19,24],[30,10,6],[7,7,7]),
    palette([22,31,10],[12,25,1],[5,14,0],[7,7,7]),
    palette([31,31,31],[8,12,31],[1,4,31],[7,7,7]),
    palette([27,31,27],[31,31,7],[31,16,1],[7,7,7]),
    palette([27,31,27],[24,18,7],[20,15,3],[7,7,7]),
    palette([27,31,27],[15,31,31],[5,17,31],[7,7,7]),
    palette([31,31,16],[31,31,16],[14,9,0],[0,0,0])
  ]);

  class Gen2MapDriver{
    static TILESET_TABLE=0x4d596;
    constructor(reader){
      this.reader=reader;
      this.memory=reader.memory;
      this.scope=new EventScope();
      this.structureWriter=new StructureWriter(this.memory);
      this.eventBlockWriter=new Gen2EventBlockWriter(this.memory);
      this.connectionWriter=new Gen2ConnectionWriter(this.memory);
      this.layoutWriter=new MapLayoutWriter(this.memory);
      this.spriteCatalog=new Gen2OverworldSpriteCatalog(this.memory);
      this.blockPixels=32;
      this.layerMode=MapLayerModes.ALL;
      this.tilesets=new Map();
      this.selected_block=0;
      this.selections=[];
      this.collisionSelection=null;
      document.addEventListener("romgraphicschange",()=>{this.spriteCache?.clear();if(this.current)this.redraw();},this.scope.options);
    }

    init(){
      this.root=this.workspace.root;
      this.visualization=this.workspace.visualization;
      this.canvas=this.workspace.canvas;
      this.tilesetCanvas=this.workspace.tilesetCanvas;
      this.navigation=this.workspace.navigation;
      const symbol=this.reader.capabilities?.provenance?.symbols?.MapGroupPointers;
      this.directory=this.reader.structureRegistry.createMapDirectory(this.memory,symbol?{tableOffset:symbol.offset,tableBank:symbol.bank}:undefined);
      this.maps=this.directory.list().map(({group,map,id})=>({
        id,group,map,name:`${GROUP_NAMES[group-1]} · Map ${map}`
      }));
      this.byId=new Map(this.maps.map(map=>[map.id,map]));
      try{
        this.regionMap=new PokemonViewer.maps.gen2.RegionMap(this.reader);
        this.workspace.setRegionMap(this.regionMap,{onOpen:entry=>{
          const destination=this.maps.find(summary=>{try{return this.directory.entry(summary.group,summary.map).landmark===entry.id;}catch{return false;}});
          if(destination){
            if(destination.id===this.current?.id){this.focusCurrent();return true;}
            return this.editor.navigate(()=>this.select(destination.id,{focus:true}));
          }
          else NotificationHandler.pop("Crystal Minimap",`${entry.name} has no resolved map header.`,NotificationType.ERROR);
          return false;
        }});
      }catch(error){this.regionMap=null;console.info("Crystal Minimap unavailable.",error);}
      this.mount();
      this.createWindows();
      this.renderNavigation();
      this.select("1:1");
      return this;
    }

    mount(){
      const options=this.scope.options;
      this.canvas.className="map-canvas";
      this.canvas.setAttribute("aria-label","Pokémon Crystal block map");
      this.workspace.bindViewport({zoom:(change,event)=>this.zoom(change,event),canPan:()=>this.controls?.active===2});
      let pendingScrollFrame=null;
      this.scope.listen(this.workspace.viewport,"scroll",()=>{if(pendingScrollFrame!==null)return;pendingScrollFrame=this.scope.frame(()=>{pendingScrollFrame=null;if(this.current)this.redraw();});},{passive:true});
      this.canvas.addEventListener("pointermove",event=>this.inspectBlock(event),options);
      this.canvas.addEventListener("click",event=>this.inspectEvent(event),options);
      this.canvas.addEventListener("dblclick",event=>this.openSceneMap(event),options);
      this.canvas.addEventListener("pointerdown",event=>this.beginEdit(event),options);
      this.canvas.addEventListener("pointermove",event=>this.continueEdit(event),options);
      this.canvas.addEventListener("pointerup",event=>this.endEdit(event),options);
      this.canvas.addEventListener("pointercancel",event=>this.endEdit(event),options);
      this.tilesetCanvas.addEventListener("click",event=>this.pickTilesetBlock(event),options);
      this.tilesetCanvas.addEventListener("dblclick",event=>this.openTilesetBlock(event),options);
      this.tilesetCanvas.title="Double-click a block to inspect its assembled graphics";
      this.contextMenu=new MapContextMenu(this,this.canvas,options);
    }

    createWindows(){
      this.controls=new MapControls(this.root,mode=>this.setMode(mode),{family:"gen2",signal:this.scope.signal});
      this.eventInspector=new MapEventInspector(this,this.visualization);
      this.createPatternWindow();
      this.root.editorHeader?.render();
    }

    createPatternWindow(){
      this.patternCanvas=Dom.create("canvas",{className:"map-pattern-canvas",attributes:{width:"32",height:"32","aria-label":"Generation II 4 by 4 tile border block"}});
      this.patternSummary=Dom.create("p",{className:"map-pattern-summary"});
      this.patternCanvas.addEventListener("click",()=>{const block=this.current?.data.attributes.borderBlock;if(Number.isInteger(block)){this.patternCanvas.classList.add("is-selected");this.patternSummary.textContent=`Selected border cell uses block ${CoreUtils.hex(block)}. Choose another block in Blocks and press Use selected block to replace it.`;}},this.scope.options);
      this.patternApply=UiWindow.button("Use selected block",{icon:"fa-stamp",size:"sm",onClick:()=>this.setBorderPattern(this.selected_block)});
      this.patternOpen=UiWindow.button("Open block",{icon:"fa-table-cells-large",size:"sm",onClick:()=>{const block=this.current?.data.attributes.borderBlock;if(Number.isInteger(block)){this.selectBlock(block);this.workspace.windowManager?.reveal("Blocks",{target:this.tilesetCanvas,top:Math.floor(block/8)*32});}}});
      const entry=this.workspace.windowManager.register({id:"pattern",title:"Border pattern",icon:"▦",position:{left:310,top:54,width:210},families:["gen2"],content:[
        Dom.create("div",{className:"map-pattern-preview map-pattern-preview--tiles"},this.patternCanvas),
        Dom.create("div",{className:"map-pattern-actions"},[this.patternApply,this.patternOpen]),this.patternSummary
      ]});
      entry.window.hide();
    }

    setMode(mode){
      this.workspace.viewport.classList.toggle("grab",mode===2);
      if(mode===7||mode===8)return this.zoom(mode===8?1:-1);
      if(mode===14||mode===15){this.showGrid=mode===14;return this.redraw();}
      if(MapLayerModes.is(mode)){this.layerMode=mode;return this.redraw();}
    }

    beginEdit(event){
      if(event.button!==0||!this.current)return;
      const mode=this.controls.active;
      if(this.layerMode===MapLayerModes.COLLISION){const cell=this.collisionCellAt(event);if(cell)this.selectCollisionCell(cell);return;}
      if(mode===0){
        this.painting=true;this.lastPaintIndex=-1;this.paintAt(event);this.canvas.setPointerCapture(event.pointerId);
      }else if(mode===1){
        const record=this.eventAt(event);if(!record)return;
        this.eventDrag={record,start:{x:record.event.x,y:record.event.y},preview:{x:record.event.x,y:record.event.y}};
        this.canvas.setPointerCapture(event.pointerId);event.preventDefault();
      }else if(mode===5){
        const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);
        if(point)this.selectBlock(this.blocks[point.y*this.current.data.attributes.width+point.x]);
      }else if(mode===6){
        const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);
        if(point)this.fillRegion(point.x,point.y,this.selected_block);
      }else if(mode===13){
        const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(!point)return;
        if(!event.shiftKey)this.selections=[];
        this.activeSelection=new MapSelection(point);this.selections.push(this.activeSelection);
        this.canvas.setPointerCapture(event.pointerId);this.redraw();
      }else if(mode===4){
        const node=this.sceneMapAt(event.clientX,event.clientY);
        if(node&&node.id!==this.current.id)this.editor.navigate(()=>this.select(node.id,{focus:true}));
      }
    }

    continueEdit(event){
      if(this.painting)this.paintAt(event);
      if(this.eventDrag){
        const point=this.eventPoint(event);if(point){this.eventDrag.preview=point;this.redraw();}
      }
      if(this.activeSelection){
        const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);
        if(point){this.activeSelection.update(point);this.redraw();}
      }
    }

    endEdit(event){
      if(this.painting){this.painting=false;this.lastPaintIndex=-1;}
      if(this.eventDrag){
        const {record,start,preview}=this.eventDrag;this.eventDrag=null;
        if(preview.x!==start.x||preview.y!==start.y)this.moveEvent(record.event,preview.x,preview.y);
        else this.redraw();
      }
      this.activeSelection=null;
      if(event?.pointerId!==undefined&&this.canvas.hasPointerCapture?.(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
    }

    paintAt(event){
      const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);if(!point)return;
      const index=point.y*this.current.data.attributes.width+point.x;if(index===this.lastPaintIndex)return;
      this.lastPaintIndex=index;this.setBlock(point.x,point.y,this.selected_block);
    }

    selectBlock(block){
      this.selected_block=Math.max(0,Math.min(127,Number(block)||0));
      this.renderTileset();this.workspace.windowManager?.reveal("Blocks",{top:Math.floor(this.selected_block/8)*32});return this.selected_block;
    }

    pickTilesetBlock(event){
      const point=MapUtils.gridPoint(this.tilesetCanvas,event.clientX,event.clientY,32);
      if(point&&point.x>=0&&point.x<8&&point.y>=0&&point.y<16)this.selectBlock(point.y*8+point.x);
    }

    setBlock(x,y,block,{record=true,redraw=true}={}){
      const a=this.current?.data.attributes;
      if(!a||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=a.width||y>=a.height)return false;
      this.structureWriter.encode("u8",block);
      if(block>127)throw new RangeError("Crystal metatile IDs must be 0–127.");
      const index=y*a.width+x,previous=this.blocks[index];if(previous===block)return false;
      const offset=a.blocksOffset+index,previousBytes=this.structureWriter.encode("u8",previous),nextBytes=this.structureWriter.encode("u8",block);
      const update=value=>{this.blocks[index]=value;if(redraw)this.redraw();};
      if(record)this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Paint block (${x}, ${y})`,description:`${CoreUtils.hex(previous)} → ${CoreUtils.hex(block)}`,
        patches:[{offset,previous:previousBytes,next:nextBytes}],afterApply:()=>update(block),afterUndo:()=>update(previous)
      });
      else{MemoryUtils.replace(this.memory,offset,previousBytes,nextBytes);update(block);}
      return true;
    }

    fillRegion(x,y,block){
      const a=this.current.data.attributes,width=a.width,height=a.height,start=y*width+x,target=this.blocks[start];
      if(target===block)return false;
      this.structureWriter.encode("u8",block);if(block>127)throw new RangeError("Crystal metatile IDs must be 0–127.");
      const pending=[start],seen=new Set(),indices=[];
      while(pending.length){
        const index=pending.pop();if(seen.has(index)||this.blocks[index]!==target)continue;
        seen.add(index);indices.push(index);const px=index%width,py=Math.floor(index/width);
        if(px>0)pending.push(index-1);if(px+1<width)pending.push(index+1);
        if(py>0)pending.push(index-width);if(py+1<height)pending.push(index+width);
      }
      const previous=this.structureWriter.encode("u8",target),next=this.structureWriter.encode("u8",block);
      const update=value=>{for(const index of indices)this.blocks[index]=value;this.redraw();};
      this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Fill ${indices.length} blocks`,description:`${CoreUtils.hex(target)} → ${CoreUtils.hex(block)}`,
        patches:indices.map(index=>({offset:a.blocksOffset+index,previous,next})),afterApply:()=>update(block),afterUndo:()=>update(target)
      });
      return true;
    }

    fillSelections(block=this.selected_block){
      const a=this.current.data.attributes,width=a.width;
      const indices=[...new Set(this.selections.flatMap(selection=>selection.cells()).map(({x,y})=>y*width+x))]
        .filter(index=>index>=0&&index<this.blocks.length&&this.blocks[index]!==block);
      if(!indices.length)return false;
      const previous=new Map(indices.map(index=>[index,this.blocks[index]])),next=this.structureWriter.encode("u8",block);
      const update=values=>{for(const index of indices)this.blocks[index]=values?.get(index)??block;this.redraw();};
      this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Fill ${indices.length} selected blocks`,description:`Use ${CoreUtils.hex(block)}`,
        patches:indices.map(index=>({offset:a.blocksOffset+index,previous:this.structureWriter.encode("u8",previous.get(index)),next})),
        afterApply:()=>update(null),afterUndo:()=>update(previous)
      });
      return true;
    }

    mapName(id){return this.byId.get(id)?.name||`Map ${id}`;}

    connectionGeometry(target,direction,offset=0){
      return Gen2ConnectionUtils.geometry(this.current.data.attributes,target.data.attributes,direction,offset);
    }

    readMap(id){
      const summary=this.byId.get(id);
      if(!summary)throw new RangeError(`Unknown Gen II map ${id}.`);
      if(!summary.data)summary.data=this.directory.map(summary.group,summary.map);
      return summary;
    }

    readTileset(id){
      if(this.tilesets.has(id))return this.tilesets.get(id);
      const header=Gen2TilesetHeader.read(this.memory,Gen2MapDriver.TILESET_TABLE+id*Gen2TilesetHeader.SIZE,{id});
      const codec=this.reader.structureRegistry.createTileset(this.memory,header);
      const value=Object.freeze({header,codec});
      this.tilesets.set(id,value);
      return value;
    }

    renderNavigation(){
      this.workspace.renderNavigation(this.maps.map(map=>({id:map.id,label:map.name})),{
        title:"Crystal maps",
        onSelect:item=>{
          if(item.id===this.current?.id){this.focusCurrent();this.redraw();return;}
          this.editor.navigate(()=>this.select(item.id,{focus:true}));
        }
      });
    }

    select(id,{focus=true}={}){
      let map;
      try{map=this.readMap(id);}catch(error){
        NotificationHandler.pop("Crystal map",error.message||String(error),NotificationType.ERROR);
        return false;
      }
      this.current=map;
      this.selections=[];this.activeSelection=null;
      this.navigation.querySelector(".current")?.classList.remove("current");
      this.navigation.querySelector(`[data-map='${id}']`)?.classList.add("current");
      this.navigation.querySelector(`[data-map='${id}']`)?.scrollIntoView({block:"nearest"});
      const {attributes,entry,events}=map.data;
      this.blocks=this.memory.slice(attributes.blocksOffset,attributes.width*attributes.height);
      try{this.tileset=this.readTileset(entry.tileset);}catch{this.tileset=null;}
      this.buildScene(map);
      this.events=events;
      this.redraw();
      this.renderTileset();
      this.renderPatternWindow();
      this.renderDetails();
      if(focus)this.focusCurrent();
      this.workspace.setMapReference({mapId:map.id,group:map.group,map:map.map,title:map.name});
      if(this.regionMap)this.workspace.renderRegionMap({sectionId:entry.landmark});
      return true;
    }

    renderPatternWindow(){
      if(!this.patternCanvas)return;
      const context=this.patternCanvas.getContext("2d"),border=this.current?.data.attributes.borderBlock;
      this.patternCanvas.classList.remove("is-selected");
      context.clearRect(0,0,this.patternCanvas.width,this.patternCanvas.height);
      const valid=Boolean(this.tileset)&&Number.isInteger(border)&&border>=0&&border<128;
      this.patternApply.disabled=!valid;this.patternOpen.disabled=!valid;
      if(!valid){this.patternSummary.textContent="This map has no verified border block.";return;}
      const rendered=this.tileset.codec.renderMetatile(border,DAY_PALETTES);
      context.putImageData(new ImageData(rendered.pixels,32,32),0,0);
      this.patternSummary.textContent=`Block 0x${border.toString(16).toUpperCase().padStart(2,"0")} · choose another block in Blocks and apply it here.`;
    }

    setBorderPattern(block){
      const map=this.current,attributes=map?.data.attributes;if(!map||!Number.isInteger(block)||block<0||block>0x7f)return false;
      const previous=attributes.borderBlock;if(previous===block)return false;
      const offset=attributes.offset,apply=(expected,next)=>{
        MemoryUtils.replace(this.memory,offset,Uint8Array.of(expected),Uint8Array.of(next),{message:"Map border changed after this command"});
        map.data=null;this.select(map.id,{focus:false});
      };
      this.editor.execute({label:"Edit map border pattern",description:`0x${previous.toString(16).toUpperCase().padStart(2,"0")} → 0x${block.toString(16).toUpperCase().padStart(2,"0")}`,do:()=>apply(previous,block),undo:()=>apply(block,previous)});
      return true;
    }

    buildScene(map){
      const data=map.data,a=data.attributes;
      const main={id:map.id,map,data,x:0,y:0,width:a.width,height:a.height,blocks:this.blocks,tileset:this.tileset,current:true};
      const scene=new MapScene(this.blockPixels);scene.add(main);
      const queue=[main];
      while(queue.length&&scene.nodes.length<128){
        const source=queue.shift();
        for(const connection of source.data.connections){
          if(scene.ids.has(connection.id))continue;
          let target;
          try{target=this.readMap(connection.id);}catch{continue;}
          const attributes=target.data.attributes;let x=source.x,y=source.y;
          if(connection.direction==="north"){x+=connection.perpendicularOffset;y-=attributes.height;}
          else if(connection.direction==="south"){x+=connection.perpendicularOffset;y+=source.height;}
          else if(connection.direction==="west"){x-=attributes.width;y+=connection.perpendicularOffset;}
          else{x+=source.width;y+=connection.perpendicularOffset;}
          try{
            const node={id:target.id,map:target,data:target.data,x,y,width:attributes.width,height:attributes.height,blocks:this.memory.slice(attributes.blocksOffset,attributes.width*attributes.height),tileset:this.readTileset(target.data.entry.tileset),connection};
            if(scene.add(node))queue.push(node);
          }catch{}
        }
      }
      scene.layout({currentId:map.id}).resize(this.canvas);
      this.mapScene=scene;
      this.currentOrigin={x:scene.origin.x,y:scene.origin.y};
      this.connectedMapCount=scene.nodes.length-1;
    }

    renderScene(){
      const viewport=this.workspace.viewport;
      this.mapScene.render(this.canvas,(context,node,x,y,bounds)=>this.renderNode(context,node,x,y,bounds),{viewport})
        .drawBounds(this.canvas,{currentId:this.current.id,label:node=>node.map.name,viewport});
    }

    renderNode(context,node,x,y,bounds){
      context.save();
      if(MapLayerModes.dimsMap(this.layerMode))context.globalAlpha=.24;
      if(node.tileset)this.renderGraphics(context,node.data.attributes,node.blocks,node.tileset.codec,x,y,bounds);
      else this.renderFallback(context,node.data.attributes,node.blocks,x,y,bounds);
      context.restore();
      if(this.layerMode===MapLayerModes.COLLISION&&node.tileset)this.drawCollision(context,node,x,y,bounds);
    }

    renderGraphics(context,attributes,blocks,codec,originX=0,originY=0,bounds={x:originX,y:originY,width:attributes.width*32,height:attributes.height*32}){
      const range=MapScene.blockRange(attributes.width,attributes.height,originX,originY,bounds,32),width=range.right-range.left,height=range.bottom-range.top;
      if(width<=0||height<=0)return;
      const image=context.createImageData(width*32,height*32),cache=new Map();
      const blockImage=id=>{
        if(!cache.has(id))cache.set(id,codec.renderMetatile(id,DAY_PALETTES).pixels);
        return cache.get(id);
      };
      for(let blockY=range.top;blockY<range.bottom;blockY++)for(let blockX=range.left;blockX<range.right;blockX++){
        const pixels=blockImage(blocks[blockY*attributes.width+blockX]);
        for(let y=0;y<32;y++){
          const source=y*32*4,target=(((blockY-range.top)*32+y)*image.width+(blockX-range.left)*32)*4;
          image.data.set(pixels.subarray(source,source+32*4),target);
        }
      }
      context.putImageData(image,originX+range.left*32,originY+range.top*32);
    }
    renderMovementEnvironment(event,canvas,{center=48}={}){
      if(!this.current||!this.tileset||!canvas)return false;
      const context=canvas.getContext("2d"),attributes=this.current.data.attributes,eventX=Number(event?.x||0),eventY=Number(event?.y||0);
      context.imageSmoothingEnabled=false;context.clearRect(0,0,canvas.width,canvas.height);
      const border=attributes.borderBlock;
      if(Number.isInteger(border)){
        const tile=document.createElement("canvas");tile.width=tile.height=32;
        try{
          this.renderGraphics(tile.getContext("2d"),{...attributes,width:1,height:1},Uint8Array.of(border),this.tileset.codec);
          const pattern=context.createPattern(tile,"repeat");if(pattern){context.fillStyle=pattern;context.fillRect(0,0,canvas.width,canvas.height);}
        }catch{}
      }
      try{this.renderGraphics(context,attributes,this.blocks,this.tileset.codec,center-eventX*16,center-eventY*16,{x:0,y:0,width:canvas.width,height:canvas.height});return true;}
      catch{return false;}
    }

    renderFallback(context,attributes,blocks,originX=0,originY=0,bounds={x:originX,y:originY,width:attributes.width*32,height:attributes.height*32}){
      const range=MapScene.blockRange(attributes.width,attributes.height,originX,originY,bounds,32);
      for(let y=range.top;y<range.bottom;y++)for(let x=range.left;x<range.right;x++){
        const block=blocks[y*attributes.width+x];
        context.fillStyle=`hsl(${block*43%360} 38% 48%)`;
        context.fillRect(originX+x*32,originY+y*32,32,32);
      }
    }

    drawCollision(context,node,originX,originY,bounds={x:originX,y:originY,width:node.width*32,height:node.height*32}){
      const range=MapScene.blockRange(node.width,node.height,originX,originY,bounds,32);context.save();
      for(let blockY=range.top;blockY<range.bottom;blockY++)for(let blockX=range.left;blockX<range.right;blockX++){
        const id=node.blocks[blockY*node.width+blockX];
        let values;try{values=node.tileset.codec.collision(id);}catch{continue;}
        for(let cellY=0;cellY<2;cellY++)for(let cellX=0;cellX<2;cellX++){
          const value=values[cellY*2+cellX],x=originX+blockX*32+cellX*16,y=originY+blockY*32+cellY*16;
          const hue=Math.round(205-(value/255)*175),lightness=42+(value%5)*5;
          context.fillStyle=`hsla(${hue} 76% ${lightness}% / .56)`;context.fillRect(x,y,16,16);
          context.strokeStyle="rgba(15,23,42,.36)";context.strokeRect(x+.5,y+.5,15,15);
          const selected=this.collisionSelection;
          if(node.current&&selected?.blockX===blockX&&selected?.blockY===blockY&&selected?.cellX===cellX&&selected?.cellY===cellY){context.lineWidth=2;context.strokeStyle="#fff";context.strokeRect(x+1,y+1,14,14);}
        }
      }
      context.restore();
    }

    eventRecords(events=this.events){
      if(!events)return[];
      const script=event=>event.scriptAddress?this.memory.banked(this.current.data.attributes.scriptsBank,event.scriptAddress):undefined;
      const wrap=(event,type,color)=>{
        const pointerOffset=type==="Coordinate"?event.offset+4:type==="Background"?event.offset+3:type==="Object"?event.offset+9:null;
        const value={...event,eventType:type,scriptOffset:script(event),$codeKind:"event",$codeReference:pointerOffset===null?null:{kind:"gen2Near",pointerOffset,bank:this.current.data.attributes.scriptsBank}};
        const preview=this.eventDrag?.record.event.offset===event.offset?this.eventDrag.preview:null;
        return{type,index:event.eventIndex,event:preview?{...value,...preview}:value,color};
      };
      return[
        ...events.warps.map(event=>wrap(event,"Warp","#7c3aed")),
        ...events.coordinates.map(event=>wrap(event,"Coordinate","#ea580c")),
        ...events.backgrounds.map(event=>wrap(event,"Background","#db2777")),
        ...events.objects.map(event=>wrap(event,"Object","#16a34a"))
      ];
    }

    drawEventOverlays(){
      const context=this.canvas.getContext("2d");
      for(const {type,event} of this.eventRecords()){
        const x=this.currentOrigin.x*32+event.x*16,y=this.currentOrigin.y*32+event.y*16;
        const model=type==="Object"?PokemonViewer.maps.movement.describe(event,"gen2"):null,sprite=model?this.getOverworldSprite(event.spriteId,model.initial):null;
        PokemonViewer.maps.overlays.marker(context,{x,y,type,sprite});
      }
    }

    getOverworldSprite(spriteId,direction="south",frameIndex=null,forceFlip=null){
      const pose=PokemonViewer.maps.movement.frame(direction,false,0,"gen2"),face=frameIndex??pose.index,flip=forceFlip??pose.flipX,key=`${spriteId}:${face}:${flip}`;
      this.spriteCache||=new Map();if(this.spriteCache.has(key))return this.spriteCache.get(key);
      const entry=this.spriteCatalog.entry(spriteId);if(!entry)return null;
      try{
        const availableFrames=Math.max(1,Math.floor(entry.tiles/4)),offset=entry.graphicsOffset+Math.min(availableFrames-1,face)*64,canvas=document.createElement("canvas");canvas.width=canvas.height=16;
        const context=canvas.getContext("2d"),image=context.createImageData(16,16);
        for(let tile=0;tile<4;tile++){
          const pixels=GbcSpriteCodec.decodeTile(this.memory,offset+tile*16),tileX=(tile&1)*8,tileY=(tile>>1)*8;
          for(let y=0;y<8;y++)for(let x=0;x<8;x++){
            const index=pixels[y*8+x],color=source.palette[index],value=Number.parseInt(color.slice(1),16),target=((tileY+y)*16+tileX+x)*4;
            image.data.set([value>>16,value>>8&255,value&255,index===0?0:255],target);
          }
        }
        context.putImageData(image,0,0);
        if(flip){const copy=document.createElement("canvas");copy.width=copy.height=16;const flipped=copy.getContext("2d");flipped.imageSmoothingEnabled=false;flipped.translate(16,0);flipped.scale(-1,1);flipped.drawImage(canvas,0,0);this.spriteCache.set(key,copy);return copy;}
        this.spriteCache.set(key,canvas);return canvas;
      }catch{return null;}
    }

    drawGrid(){
      if(!this.showGrid)return;
      const bounds=this.mapScene.visibleBounds(this.canvas,this.workspace.viewport,0),x=Math.floor(bounds.x/32)*32,y=Math.floor(bounds.y/32)*32;
      PokemonViewer.maps.overlays.grid(this.canvas.getContext("2d"),{x,y,width:Math.ceil((bounds.x+bounds.width-x)/32)*32,height:Math.ceil((bounds.y+bounds.height-y)/32)*32,cell:32,scale:Number(this.canvas.dataset.zoom||1),color:"rgba(24,84,128,.34)"});
    }

    redraw(){
      if(!this.current)return;
      this.renderScene();
      if(MapLayerModes.showsEvents(this.layerMode))this.drawEventOverlays();
      this.drawGrid();
      this.drawSelections();
    }

    renderTileset(){
      if(!this.tileset){this.tilesetCanvas.width=this.tilesetCanvas.height=1;return;}
      this.tilesetCanvas.width=8*32;this.tilesetCanvas.height=16*32;
      const context=this.tilesetCanvas.getContext("2d");
      for(let block=0;block<128;block++){
        const rendered=this.tileset.codec.renderMetatile(block,DAY_PALETTES);
        context.putImageData(new ImageData(rendered.pixels,32,32),(block%8)*32,Math.floor(block/8)*32);
      }
      const x=this.selected_block%8*32,y=Math.floor(this.selected_block/8)*32;
      PokemonViewer.maps.overlays.picker(context,{x,y,width:32,height:32});
    }

    openTilesetBlock(event){
      if(!this.tileset)return;
      const point=MapUtils.gridPoint(this.tilesetCanvas,event.clientX,event.clientY,32);
      if(!point)return;
      const block=point.y*8+point.x,ids=this.tileset.codec.metatile(block),bytes=new Uint8Array(ids.length*16);
      ids.forEach((id,index)=>bytes.set(this.tileset.codec.graphics.subarray(id*16,id*16+16),index*16));
      EditorLinks.sprite({bytes,count:16,columns:4,editable:false,title:`Crystal tileset ${this.current.data.entry.tileset} · block ${CoreUtils.hex(block)}`,palette:DAY_PALETTES[0].map(color=>`#${color.slice(0,3).map(value=>value.toString(16).padStart(2,"0")).join("")}`)});
    }

    renderDetails(){
      const {data}=this.current,{entry,attributes,events}=data;
      const values={
        Map:this.current.name,Group:this.current.group,Number:this.current.map,
        Size:`${attributes.width} × ${attributes.height}`,Tileset:entry.tileset,
        Environment:entry.environment,Connections:data.connections.length,
        Warps:events.warps.length,"Coordinate events":events.coordinates.length,
        "Background events":events.backgrounds.length,Objects:events.objects.length,
        Attributes:CoreUtils.hex(entry.attributesOffset,6),Blocks:CoreUtils.hex(attributes.blocksOffset,6),
        Scripts:CoreUtils.hex(attributes.scriptsOffset,6),Events:CoreUtils.hex(attributes.eventsOffset,6)
      };
      const descriptions={Environment:"Crystal map environment controlling indoor/outdoor behavior.","Coordinate events":"Scripts activated when the player reaches a coordinate.",Attributes:"Resolved ROM offset of this map's attribute structure.",Blocks:"Resolved ROM offset of the block layout.",Scripts:"Resolved ROM offset of map scripts.",Events:"Resolved ROM offset of typed map events."};
      const complexity=Object.fromEntries(["Group","Number","Environment","Attributes","Blocks","Scripts","Events"].map(key=>[key,"advanced"]));
      const actions=[
        UiWindow.button("Resize map",{icon:"↔",onClick:()=>this.editLayout()}),
        UiWindow.button("Connections",{icon:"⇄",onClick:()=>this.editConnections()})
      ];
      this.workspace.renderProperties({title:this.current.name,values,descriptions,complexity,actions,events:this.eventRecords(),onEvent:record=>this.showEvent(record.event)});
    }

    editLayout(){
      const a=this.current?.data.attributes;
      if(a)this.workspace.editLayout({title:`Resize ${this.current.name}`,width:a.width,height:a.height,onApply:(width,height)=>this.resizeMap(width,height)});
    }

    resizeMap(width,height){
      const map=this.current,a=map?.data.attributes;
      if(!a||width===a.width&&height===a.height)return false;
      const plan=this.layoutWriter.plan({
        offset:a.blocksOffset,width:a.width,height:a.height,nextWidth:width,nextHeight:height,stride:1,
        reference:{kind:"gen2Far",bankOffset:a.offset+3,addressOffset:a.offset+4},
        dimensions:[{offset:a.offset+2,type:"u8"},{offset:a.offset+1,type:"u8"}]
      });
      const update=()=>{
        map.data=null;this.select(map.id,{focus:true});
      };
      this.editor.execute({
        label:`Resize ${map.name}`,description:`${a.width} × ${a.height} → ${width} × ${height}`,
        do:()=>{this.layoutWriter.apply(plan);update();},
        undo:()=>{this.layoutWriter.restore(plan);update();}
      });
      return true;
    }

    connectionFields(connection){
      return[
        {key:"mapGroup",label:"Destination group",value:connection.mapGroup,min:1,max:Gen2MapDirectory.GROUPS},
        {key:"mapNumber",label:"Destination map",value:connection.mapNumber,min:1,max:91},
        {key:"offset",label:"Perpendicular offset",value:connection.perpendicularOffset,min:-63,max:63}
      ];
    }

    editConnections(){
      const map=this.current;if(!map)return false;
      const connections=map.data.connections,available=Gen2ConnectionUtils.NAMES
        .map((direction,index)=>[direction,index])
        .filter(([direction])=>!connections.some(connection=>connection.direction===direction));
      this.workspace.editConnections({
        title:`Connections · ${map.name}`,
        connections:connections.map(connection=>({
          label:`${connection.direction} → ${this.mapName(connection.id)}`,
          fields:this.connectionFields({...connection,offset:connection.perpendicularOffset})
        })),
        newConnection:available.length?{fields:[
          {key:"direction",label:"Direction",value:available[0][1],options:available.map(([label,value])=>({label,value}))},
          {key:"mapGroup",label:"Destination group",value:map.group,min:1,max:Gen2MapDirectory.GROUPS},
          {key:"mapNumber",label:"Destination map",value:1,min:1,max:91},
          {key:"offset",label:"Perpendicular offset",value:0,min:-63,max:63}
        ]}:null,
        onApply:(index,values)=>this.updateConnection(index,values),
        onAdd:values=>this.addConnection(values),
        onRemove:index=>this.removeConnection(index)
      });
      return true;
    }

    worldMapBase(){
      if(Number.isInteger(this._worldMapBase))return this._worldMapBase;
      for(const summary of [this.current,...this.maps]){
        let source;try{source=summary.data?summary:this.readMap(summary.id);}catch{continue;}
        for(const connection of source.data.connections){
          let target;try{target=this.readMap(connection.id);}catch{continue;}
          let geometry;try{geometry=Gen2ConnectionUtils.geometry(source.data.attributes,target.data.attributes,connection.direction,connection.perpendicularOffset);}catch{continue;}
          const base=(connection.mapAddress-geometry.mapDelta)&0xffff;
          if(((base+geometry.windowDelta)&0xffff)===connection.windowAddress)return(this._worldMapBase=base);
        }
      }
      throw new RangeError("No valid Crystal connection is available to resolve wOverworldMapBlocks.");
    }

    createConnectionValues(direction,mapGroup,mapNumber,offset){
      direction=Gen2ConnectionUtils.direction(direction);
      const target=this.readMap(`${mapGroup}:${mapNumber}`),geometry=this.connectionGeometry(target,direction,offset),base=this.worldMapBase();
      return{
        direction,mapGroup,mapNumber,
        blocksAddress:(target.data.attributes.blocksAddress+geometry.blockDelta)&0xffff,
        mapAddress:(base+geometry.mapDelta)&0xffff,length:geometry.length,width:geometry.width,
        y:geometry.y,x:geometry.x,windowAddress:(base+geometry.windowDelta)&0xffff,
        perpendicularOffset:offset
      };
    }

    reloadConnections(){
      const map=this.current;map.data=null;this.select(map.id,{focus:true});return this.current.data.connections;
    }

    updateConnection(index,values){
      const connection=this.current?.data.connections[index];if(!connection)return false;
      const next=this.createConnectionValues(connection.direction,values.mapGroup,values.mapNumber,values.offset);
      const previous=this.memory.slice(connection.offset,Gen2MapConnection.SIZE),bytes=Gen2ConnectionUtils.encode(next);
      this.editor.execute({
        label:`Edit ${connection.direction} connection`,description:`Connect ${this.current.name} → ${this.mapName(`${next.mapGroup}:${next.mapNumber}`)}`,
        do:()=>{MemoryUtils.replace(this.memory,connection.offset,previous,bytes);this.reloadConnections();},
        undo:()=>{MemoryUtils.replace(this.memory,connection.offset,bytes,previous);this.reloadConnections();}
      });return true;
    }

    addConnection(values){
      const direction=Gen2ConnectionUtils.direction(values.direction),connection=this.createConnectionValues(direction,values.mapGroup,values.mapNumber,values.offset);
      const map=this.current,plan=this.connectionWriter.insert(map.data,connection);
      this.editor.execute({
        label:`Add ${direction} connection`,description:`Connect ${map.name} → ${this.mapName(`${values.mapGroup}:${values.mapNumber}`)}`,
        do:()=>{this.connectionWriter.apply(plan);this.reloadConnections();},
        undo:()=>{this.connectionWriter.restore(plan);this.reloadConnections();}
      });return true;
    }

    removeConnection(index){
      const map=this.current,connection=map?.data.connections[index];if(!connection)return false;
      const plan=this.connectionWriter.remove(map.data,index);
      this.editor.execute({
        label:`Delete ${connection.direction} connection`,description:`Disconnect ${map.name} from ${this.mapName(connection.id)}`,
        do:()=>{this.connectionWriter.apply(plan);this.reloadConnections();},
        undo:()=>{this.connectionWriter.restore(plan);this.reloadConnections();}
      });return true;
    }

    showEvent(event){
      this.eventInspector.show(event,{x:event.x,y:event.y},this.visualization.clientWidth-320,80);
    }

    eventReference(event=this.eventInspector?.current){return EventBookmarkUtils.create(event);}
    bookmark(){return this.current?{mapId:this.current.id,title:this.current.name,event:this.eventReference()}:{};}
    restoreBookmark(target){
      this.select(target.mapId,{focus:true});
      if(!target.event)return this;
      const record=EventBookmarkUtils.resolve(this.eventRecords(),target.event);
      if(!record)throw new Error("The bookmarked map event no longer exists or is ambiguous.");
      this.workspace.centerOnCanvas((this.currentOrigin.x+record.event.x/2+.5)*32,(this.currentOrigin.y+record.event.y/2+.5)*32);
      this.showEvent(record.event);return this;
    }

    eventFieldSchema(event){
      const position=event.eventType==="Object"
        ?{x:{label:"X",offset:2,type:"u8",min:0,max:251,serialize:value=>value+4},y:{label:"Y",offset:1,type:"u8",min:0,max:251,serialize:value=>value+4}}
        :event.eventType==="Coordinate"
          ?{x:{label:"X",offset:2,type:"u8",min:0,max:255},y:{label:"Y",offset:1,type:"u8",min:0,max:255}}
          :{x:{label:"X",offset:1,type:"u8",min:0,max:255},y:{label:"Y",offset:0,type:"u8",min:0,max:255}};
      if(event.eventType==="Warp")return{...position,warp:{label:"Destination warp",offset:2,type:"u8",min:1,max:255},mapGroup:{label:"Destination group",offset:3,type:"u8",min:1,max:26},mapNumber:{label:"Destination map",offset:4,type:"u8",min:1,max:255}};
      if(event.eventType==="Coordinate")return{scene:{label:"Scene",offset:0,type:"u8",min:0,max:255},...position,scriptAddress:{label:"Script address",offset:4,type:"u16",min:0,max:65535}};
      if(event.eventType==="Background")return{...position,kind:{label:"Function",offset:2,type:"u8",min:0,max:255},scriptAddress:{label:"Script address",offset:3,type:"u16",min:0,max:65535}};
      return{
        spriteId:{label:"Sprite",offset:0,type:"u8",min:0,max:255},...position,
        movement:{label:"Movement",offset:3,type:"u8",min:0,max:255},radius:{label:"Radius",offset:4,type:"u8",min:0,max:255},
        hourStart:{label:"Start hour",offset:5,type:"u8",min:0,max:255},hourEnd:{label:"End hour",offset:6,type:"u8",min:0,max:255},
        palette:{label:"Palette",offset:7,type:"u8",min:0,max:15,serialize:(value,data)=>(value&15)<<4|(data.kind&15)},
        kind:{label:"Object type",offset:7,type:"u8",min:0,max:15,serialize:(value,data)=>(data.palette&15)<<4|(value&15)},
        range:{label:"Range",offset:8,type:"u8",min:0,max:255},scriptAddress:{label:"Script address",offset:9,type:"u16",min:0,max:65535},
        eventFlag:{label:"Event flag",offset:11,type:"u16",min:0,max:65535}
      };
    }

    eventFields(event){return Object.entries(this.eventFieldSchema(event)).map(([key,field])=>({key,...field,value:Number(event[key])}));}

    updateEventFields(event,values,{label}={}){
      if(!Number.isInteger(event?.offset))return false;
      return this.structureWriter.edit(this.editor.commands,{
        base:event.offset,schema:this.eventFieldSchema(event),current:event,values,
        label:label||`Edit ${event.eventType}`,description:"Update fixed-size Pokémon Crystal event fields",
        afterWrite:()=>this.reloadEvents()
      });
    }

    moveEvent(event,x,y){return this.updateEventFields(event,{x,y},{label:`Move ${event.eventType}`});}

    reloadEvents(){
      const summary=this.current;summary.data=null;
      this.select(summary.id,{focus:false});
      return this.events;
    }

    eventActions(event){
      const actions=[];
      if(event.eventType==="Warp"&&this.byId.has(`${event.mapGroup}:${event.mapNumber}`))actions.push({label:"Enter warp",icon:"↪",run:()=>this.enterWarp(event)});
      if(event.eventType==="Object"&&this.spriteCatalog.entry(event.spriteId))actions.push({label:"Open sprite",icon:"fa-image",run:()=>EditorLinks.sprite(this.spriteCatalog.source(event.spriteId))});
      const trainer=this.trainerReference(event);
      if(trainer)actions.push({label:"Open battle team",icon:"⚔",run:()=>EditorLinks.battle({trainer:{...trainer,mapReference:this.bookmark()}})});
      actions.push({label:"Delete event",icon:"⌫",run:()=>this.confirmDeleteEvent(event)});
      return actions;
    }

    trainerReference(event){
      if(event?.eventType!=="Object"||event.kind!==2||!Number.isInteger(event.scriptAddress))return null;
      try{
        const offset=this.memory.banked(this.current.data.attributes.scriptsBank,event.scriptAddress);
        this.memory.assertRange(offset,4);
        const trainerClass=this.memory.u8(offset+2),trainerNumber=this.memory.u8(offset+3);
        return trainerClass>=1&&trainerClass<=67&&trainerNumber>=1?Object.freeze({trainerClass,trainerNumber,sourceOffset:offset}):null;
      }catch{return null;}
    }

    eventKind(type){return["Object","Warp","Coordinate","Background"][type]||null;}
    canCreateEvent(type){return this.eventKind(type)!==null;}

    createEvent(type){
      const kind=this.eventKind(type);if(!kind||!this.current||!this.events)return false;
      const point=this.hoverBlock||{x:0,y:0},x=point.x*2,y=point.y*2;
      try{
        const entry=this.eventBlockWriter.entry(kind,{x,y,mapGroup:this.current.group,mapNumber:this.current.map});
        const plan=this.eventBlockWriter.insert(this.current.data.attributes,this.events,kind,entry);
        this.editor.execute({
          label:`Add ${kind.toLowerCase()} event`,description:`Relocate ${plan.nextBytes.length}-byte Crystal event block`,
          do:()=>{this.eventBlockWriter.apply(plan);this.reloadEvents();},
          undo:()=>{this.eventBlockWriter.restore(plan);this.reloadEvents();}
        });return true;
      }catch(error){NotificationHandler.pop("Add Crystal event",error.message||String(error),NotificationType.ERROR);return false;}
    }

    deleteEvent(event){
      if(!this.current||!this.events)return false;
      const kind=event.eventType,index=Number(event.eventIndex);
      try{
        const plan=this.eventBlockWriter.remove(this.current.data.attributes,this.events,kind,index);
        this.editor.execute({
          label:`Delete ${kind.toLowerCase()} event`,description:`Relocate ${plan.nextBytes.length}-byte Crystal event block`,
          do:()=>{this.eventBlockWriter.apply(plan);this.reloadEvents();},
          undo:()=>{this.eventBlockWriter.restore(plan);this.reloadEvents();}
        });return true;
      }catch(error){NotificationHandler.pop("Delete Crystal event",error.message||String(error),NotificationType.ERROR);return false;}
    }

    async confirmDeleteEvent(event){
      const remove=await AppDialog.confirm({
        title:`Delete ${event.eventType}?`,
        message:"The complete Crystal event block will be rebuilt inside its original ROM bank.",
        detail:"Counts and the owning near pointer are updated together. This operation can be undone.",
        confirmLabel:"Delete event",cancelLabel:"Keep event",danger:true
      });
      return remove?this.deleteEvent(event):false;
    }

    enterWarp(event){
      const id=`${event.mapGroup}:${event.mapNumber}`;
      this.editor.navigate(()=>{
        this.select(id,{focus:true});
        const destination=this.events.warps[Math.max(0,event.warp-1)];
        if(destination)this.workspace.centerOnCanvas((this.currentOrigin.x+destination.x/2+.5)*32,(this.currentOrigin.y+destination.y/2+.5)*32);
      });
    }

    inspectEvent(event){
      if(this.controls.active!==3)return;
      const record=this.eventAt(event);
      if(record)this.showEvent(record.event);
    }

    eventAt(event){
      const point=MapUtils.gridPoint(this.canvas,event.clientX,event.clientY,16);
      if(!point)return null;
      const x=point.x-this.currentOrigin.x*2,y=point.y-this.currentOrigin.y*2;
      return this.eventRecords().find(record=>record.event.x===x&&record.event.y===y)||null;
    }

    eventPoint(event){
      const point=MapUtils.gridPoint(this.canvas,event.clientX,event.clientY,16);
      if(!point)return null;
      const a=this.current.data.attributes,x=point.x-this.currentOrigin.x*2,y=point.y-this.currentOrigin.y*2;
      return x>=0&&y>=0&&x<a.width*2&&y<a.height*2?{x,y}:null;
    }

    drawSelections(){
      if(!this.selections.length)return;
      const context=this.canvas.getContext("2d"),scale=Number(this.canvas.dataset.zoom||1);
      for(const selection of this.selections){
        const b=selection.bounds,x=(this.currentOrigin.x+b.left)*32,y=(this.currentOrigin.y+b.top)*32,width=selection.width*32,height=selection.height*32;
        PokemonViewer.maps.overlays.selection(context,{x,y,width,height,scale});
      }
    }

    inspectBlock(event){
      const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);
      if(!point)return;
      this.hoverBlock=point;
      const block=this.blocks[point.y*this.current.data.attributes.width+point.x];
      this.canvas.title=`X ${point.x} · Y ${point.y} · Block ${CoreUtils.hex(block)}`;
    }
    collisionCellAt(event){const point=MapUtils.gridPoint(this.canvas,event.clientX,event.clientY,16);if(!point||!this.current)return null;const x=point.x-this.currentOrigin.x*2,y=point.y-this.currentOrigin.y*2,a=this.current.data.attributes;if(x<0||y<0||x>=a.width*2||y>=a.height*2)return null;const blockX=Math.floor(x/2),blockY=Math.floor(y/2),cellX=x%2,cellY=y%2,block=this.blocks[blockY*a.width+blockX];let value=null;try{value=this.tileset.codec.collision(block)[cellY*2+cellX];}catch{}return{blockX,blockY,cellX,cellY,block,value};}
    selectCollisionCell(cell){this.collisionSelection=cell;this.workspace.renderProperties({title:"Crystal collision cell",values:{Cell:`${cell.blockX * 2 + cell.cellX}, ${cell.blockY * 2 + cell.cellY}`,Metatile:CoreUtils.hex(cell.block),"Native value":cell.value===null?"Unavailable":CoreUtils.hex(cell.value)},actions:[UiWindow.button("Edit four collision values",{icon:"✎",onClick:()=>this.editBlockProperties(cell.block)})],events:[]});this.redraw();return true;}

    mouseToMapCoordinates(_canvas,clientX,clientY){
      const point=this.workspace.canvasPoint(clientX,clientY);
      if(!point||!this.current)return false;
      const a=this.current.data.attributes,x=Math.floor(point.x/32)-this.currentOrigin.x,y=Math.floor(point.y/32)-this.currentOrigin.y;
      return x>=0&&y>=0&&x<a.width&&y<a.height?{x,y}:false;
    }

    contextAt(event){
      const point=this.mouseToMapCoordinates(this.canvas,event.clientX,event.clientY);
      if(!point)return null;
      const block=this.blocks[point.y*this.current.data.attributes.width+point.x];
      return{point,block,events:this.eventRecords().filter(record=>Math.floor(record.event.x/2)===point.x&&Math.floor(record.event.y/2)===point.y).map(record=>record.event)};
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
      if(name==="center"){this.workspace.centerOnCanvas((this.currentOrigin.x+point.x+.5)*32,(this.currentOrigin.y+point.y+.5)*32);return true;}
      if(name==="copy"){CoreUtils.copyText(`${point.x},${point.y}`);return true;}
      return false;
    }

    async editBlockProperties(block){
      if(!this.tileset)return false;
      const previous=this.tileset.codec.collision(block),labels=["Northwest","Northeast","Southwest","Southeast"];
      const fields=labels.map((label,index)=>({name:`cell${index}`,label,type:"number",value:previous[index],min:0,max:255,step:1,fullWidth:false,description:"Native collision value for this 16×16 quadrant."}));
      const values=await AppDialog.form({
        title:`Collision · metatile ${CoreUtils.hex(block)}`,icon:"▦",
        message:"Crystal stores four native collision bytes for each 32×32 metatile.",
        fields,submitLabel:"Apply collision"
      });
      if(!values)return false;
      return this.setBlockCollision(block,labels.map((_,index)=>values[`cell${index}`]));
    }

    setBlockCollision(block,values){
      if(!this.tileset)return false;
      const next=MapBlockUtils.gen2Collision(values),offset=MapBlockUtils.gen2CollisionOffset(this.tileset.header.collision.offset,block),previous=MemoryUtils.bytes(this.memory,offset,4);
      if(previous.every((value,index)=>value===next[index]))return false;
      this.structureWriter.replaceCommand(this.editor.commands,{
        label:`Edit collision ${CoreUtils.hex(block)}`,
        description:`${Array.from(previous,value=>CoreUtils.hex(value)).join(" ")} → ${Array.from(next,value=>CoreUtils.hex(value)).join(" ")}`,
        patches:[{offset,previous,next}],afterApply:()=>this.redraw(),afterUndo:()=>this.redraw()
      });
      return true;
    }

    sceneMapAt(clientX,clientY){
      const point=this.workspace.canvasPoint(clientX,clientY);
      if(!point)return null;
      return[...this.mapScene.nodes].reverse().find(node=>MapUtils.pointInRect(point,{x:(node.x+this.mapScene.origin.x)*32,y:(node.y+this.mapScene.origin.y)*32,width:node.width*32,height:node.height*32}))||null;
    }

    openSceneMap(event){
      const node=this.sceneMapAt(event.clientX,event.clientY);
      if(!node||node.id===this.current.id)return;
      event.preventDefault();
      this.editor.navigate(()=>this.select(node.id,{focus:true}));
    }

    zoom(change,event){
      const current=Number(this.canvas.dataset.zoom||1),minimum=Math.max(.18,this.focusZoom()*.5);
      const factor=typeof change==="object"?change.factor:change>0?1.2:1/1.2;
      const value=Math.max(minimum,Math.min(4,current*factor));
      this.workspace.setCanvasZoom(value,event?{clientX:event.clientX,clientY:event.clientY}:{});
      if(!event)this.center();
    }
    focusZoom(){
      const a=this.current?.data.attributes;if(!a)return 1;
      return Math.max(.22,Math.min(2,this.workspace.viewport.clientWidth*.82/(a.width*32),this.workspace.viewport.clientHeight*.82/(a.height*32)));
    }
    focusCurrent(){
      if(!this.current)return this;
      this.workspace.setCanvasZoom(this.focusZoom());
      const a=this.current.data.attributes;
      this.workspace.centerOnCanvas((this.currentOrigin.x+a.width/2)*32,(this.currentOrigin.y+a.height/2)*32);
      return this;
    }
    fit(){return this.focusCurrent();}
    center(){this.workspace.center();return this;}
    activate({initial=false}={}){if(initial)this.focusCurrent();else this.redraw();this.workspace.windowManager?.clamp();return this;}
    refresh(){return this.current?this.select(this.current.id,{focus:false}):this;}
    destroy(){this.scope.destroy();this.contextMenu?.close();this.eventInspector?.element.remove();this.spriteCache?.clear();}
  }

  global.Gen2MapDriver=Gen2MapDriver;
  ((global.PokemonViewer ||= {}).maps ||= {}).Gen2Driver=Gen2MapDriver;
})(globalThis);
