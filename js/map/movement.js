(function(global){
  "use strict";
  const root=global.PokemonViewer ||= {},maps=root.maps ||= {};
  const DIRECTIONS=Object.freeze({south:{dx:0,dy:1},north:{dx:0,dy:-1},west:{dx:-1,dy:0},east:{dx:1,dy:0}});
  const gbaInitial=["south","south","south","north","south","west","east","north","south","west","east","south","south","south","west","north","north","south","south","south","south","north","south","south","south","north","south","west","east","north","east","south","west","north","west","south","east","west","north","east","south","east","north","west","south","north","south","west","east","north","south","west","east","north","south","west","east","south","south","north","west","east","south","south","north","west","east","south","north","west","east","south","north","west","east","south","south","north","west","east"];
  const gbaWalking=new Set([2,3,4,5,6,0x19,0x1a,0x1b,0x1c,0x35,0x36,0x37,0x38,0x40,0x41,0x42,0x43]);
  const gbaTurning=new Set([1,0x17,0x18]);
  const value=(event,...keys)=>{for(const key of keys){const candidate=typeof event?.[key]==="function"?event[key]():event?.[key];if(candidate!==undefined&&candidate!==null)return candidate;}return undefined;};
  const direction=(event,family)=>{
    if(family==="gba"){const movement=Number(value(event,"getMovement","movementType","movement_type")||0);return gbaInitial[movement]||"south";}
    const movement=Number(value(event,"movement")??0xff),packed=Number(value(event,"rangeOrDirection")||0);
    if(movement===0xff)return({0:"south",4:"north",8:"west",12:"east"})[packed&0x0c]||"south";
    // WALK ($FE) chooses directions at runtime and does not encode EAST in
    // its high bits. The engine begins from the neutral/down pose.
    if(movement===0xfe)return"south";
    return({0x00:"south",0x40:"north",0x80:"west",0xc0:"east"})[movement&0xc0]||"south";
  };
  const STEP_TICKS=16,IDLE_TICKS=32,PREVIEW_CELLS=7,CELL=16,CENTER=3*CELL;
  const frame=(facing,walking=false,tick=0,family="gba")=>{
    const face={south:0,north:1,west:2,east:2}[facing]??0;
    // Gen I/II overworld records contain three directional poses (south,
    // north and side). Walking is produced by the engine around that pose;
    // requesting GBA-style frame indices makes every moving actor resolve to
    // the final, lateral frame.
    if(family!=="gba")return{index:face,flipX:facing==="east",duration:4};
    if(!walking)return{index:face,flipX:facing==="east",duration:16};
    const duration=8,phase=Math.floor(tick/duration)%4,index=({south:[3,0,4,0],north:[5,1,6,1],west:[7,2,8,2],east:[7,2,8,2]})[facing][phase];
    return{index,flipX:facing==="east",duration};
  };
  const describe=(event,family)=>{
    const movement=Number(value(event,"getMovement","movementType","movement_type","movement")||0),initial=direction(event,family),packed=Number(value(event,"getMovementRadius","movement_radius")||0);
    const rangeX=Number(value(event,"movementRangeX")??(packed&15)),rangeY=Number(value(event,"movementRangeY")??(packed>>4));
    const trainer=Number(value(event,"getTrainer","trainerType","trainer")||0),sight=trainer?Number(value(event,"getRangeVision","trainerRange","trainerRangeOrBerryTreeId","range_vision")||0):0;
    return{family,movement,initial,rangeX,rangeY,sight,fps:59.73,walking:family==="gba"?gbaWalking.has(movement):movement!==0xff,turning:family==="gba"?gbaTurning.has(movement):false};
  };
  const route=(model,canEnter=()=>true)=>{if(!model.walking)return[{x:0,y:0,facing:model.initial}];const horizontal=["west","east"].includes(model.initial),radius=Math.max(1,horizontal?model.rangeX:model.rangeY),forward=horizontal?"east":"south",back=horizontal?"west":"north",result=[{x:0,y:0,facing:model.initial}];let x=0,y=0;for(const facing of [forward,back,back,forward])for(let n=0;n<radius;n++){const vector=DIRECTIONS[facing],next={x:x+vector.dx,y:y+vector.dy,facing};if(!canEnter(next.x,next.y))break;x=next.x;y=next.y;result.push(next);}return result.length>1?result:[{x:0,y:0,facing:model.initial}];};
  const simulation=(model,tick,path=route(model))=>{
    let facing=model.initial,x=0,y=0,walking=false,movementTick=0;
    if(model.turning){const order=["south","west","north","east"],step=Math.floor(tick/32);facing=order[step%order.length];}
    if(model.walking&&path.length>1){const period=STEP_TICKS+IDLE_TICKS,leg=Math.floor(tick/period)%(path.length-1),local=tick%period,from=path[leg],to=path[leg+1];walking=local<STEP_TICKS;movementTick=Math.min(local,STEP_TICKS);const progress=movementTick/STEP_TICKS;x=(from.x+(to.x-from.x)*progress)*CELL;y=(from.y+(to.y-from.y)*progress)*CELL;facing=to.facing;}
    return{x,y,facing,walking,...frame(facing,walking,movementTick,model.family)};
  };
  const collisionReader=(editor,event,family)=>{const eventX=Number(value(event,"getX","x")||0),eventY=Number(value(event,"getY","y")||0);if(family==="gba"){const map=editor.current_map,originWord=map?.structure?.[eventY]?.[eventX],originElevation=originWord===undefined?0:(originWord>>>12)&15;return(dx,dy)=>{const x=eventX+dx,y=eventY+dy,word=map?.structure?.[y]?.[x];if(word===undefined||((word>>>10)&3)!==0)return false;const elevation=(word>>>12)&15;if(originElevation&&elevation&&originElevation!==15&&elevation!==15&&originElevation!==elevation)return false;return !(map?.entities?.[0]||[]).some(other=>other!==event&&Number(value(other,"getX","x"))===x&&Number(value(other,"getY","y"))===y);};}const header=editor.current?.header||editor.header,blocks=editor.current?.blocks||editor.blocks,tileset=editor.current?.tileset||editor.tileset,passable=tileset&&editor.collisionTiles?.(tileset);return(dx,dy)=>{const x=eventX+dx,y=eventY+dy;if(!header||!blocks||!tileset||!passable||x<0||y<0||x>=header.width*2||y>=header.height*2)return false;const blockX=Math.floor(x/2),blockY=Math.floor(y/2),cellX=x&1,cellY=y&1,block=blocks[blockY*header.width+blockX];try{const metatile=editor.memory.slice(tileset.blocks+block*16,16),start=cellY*8+cellX*2;return[start,start+1,start+4,start+5].every(index=>passable.has(metatile[index]));}catch{return false;}};};
  const createPreview=(editor,event,family)=>{
    const model=describe(event,family),box=document.createElement("div"),canvas=document.createElement("canvas"),meta=document.createElement("div");
    box.className="map-movement-preview";canvas.width=canvas.height=PREVIEW_CELLS*CELL;meta.className="map-movement-preview__meta";meta.textContent=`7×7 · ${model.fps.toFixed(2)} Hz · 1 px/tick · collision-aware${model.sight?` · sight ${model.sight}`:""}`;box.append(canvas,meta);
    const context=canvas.getContext("2d"),environment=document.createElement("canvas"),started=performance.now(),spriteId=value(event,"getSpriteIndex","spriteId","sprite"),eventX=Number(value(event,"getX","x")||0),eventY=Number(value(event,"getY","y")||0),canEnter=collisionReader(editor,event,family),path=route(model,canEnter),size=PREVIEW_CELLS*CELL;environment.width=environment.height=size;
    const rendered=editor.renderMovementEnvironment?.(event,environment,{cells:PREVIEW_CELLS,cell:CELL,center:CENTER});
    const source=family==="gba"?editor.current_map?.preview:null;
    if(!rendered&&source)environment.getContext("2d").drawImage(source,eventX*CELL-CENTER,eventY*CELL-CENTER,size,size,0,0,size,size);
    const paint=(now)=>{if(!box.isConnected)return;const tick=Math.floor((now-started)*model.fps/1000),state=simulation(model,tick,path);context.imageSmoothingEnabled=false;context.clearRect(0,0,size,size);if(rendered||source)context.drawImage(environment,0,0);else{context.fillStyle="#eef4ea";context.fillRect(0,0,size,size);}
      const px=CENTER+state.x,py=CENTER+state.y;maps.overlays?.vision(context,{x:px,y:py,direction:state.facing,range:model.sight});
      let sprite=null;try{sprite=editor.getOverworldSprite?.(spriteId,state.facing,state.index,state.flipX);}catch{}if(sprite)context.drawImage(sprite,px+(16-sprite.width)/2,py+16-sprite.height);
      requestAnimationFrame(paint);
    };requestAnimationFrame(paint);return box;
  };
  maps.movement=Object.freeze({DIRECTIONS,STEP_TICKS,IDLE_TICKS,direction,frame,describe,route,simulation,collisionReader,createPreview});
})(globalThis);
