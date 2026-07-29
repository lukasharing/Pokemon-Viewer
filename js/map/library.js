(function(global){
  "use strict";

  const root=global.PokemonViewer ||= {};
  const maps=root.maps ||= {};
  const drivers=new Map();
  const layerModes=Object.freeze({
    ALL:9,
    MAP:10,
    EVENTS:11,
    COLLISION:12,
    is(value){return value>=this.ALL&&value<=this.COLLISION;},
    showsEvents(value){return value===this.ALL||value===this.EVENTS;},
    dimsMap(value){return value===this.EVENTS;}
  });
  const capabilities=Object.freeze({
    full:Object.freeze(Array.from({length:16},(_,mode)=>mode)),
    readOnly:Object.freeze([2,3,4,7,8,...Array.from({length:4},(_,index)=>layerModes.ALL+index),14,15]),
    fixedEditing:Object.freeze([0,1,2,3,4,5,6,7,8,...Array.from({length:4},(_,index)=>layerModes.ALL+index),13,14,15])
  });
  const overlayRenderer=Object.freeze({
    colors:Object.freeze({Object:"#16a34a",Trainer:"#ea580c",Item:"#0891b2",Warp:"#7c3aed",Script:"#ea580c",Coordinate:"#ea580c",Sign:"#db2777",Background:"#db2777"}),
    prepare(context){context.imageSmoothingEnabled=false;context.lineCap="butt";context.lineJoin="miter";return context;},
    marker(context,{x,y,type="Event",sprite=null,size=16}={}){
      this.prepare(context);context.save();
      if(sprite){context.drawImage(sprite,Math.round(x+(size-sprite.width)/2),Math.round(y+size-sprite.height));context.restore();return true;}
      const color=this.colors[type]||"#2563eb",glyph=({Warp:"W",Script:"S",Coordinate:"C",Sign:"!",Background:"!",Trainer:"T",Item:"I",Object:"O"})[type]||"E";
      context.fillStyle=color;context.fillRect(Math.round(x)+1,Math.round(y)+1,size-2,size-2);context.strokeStyle="#fff";context.lineWidth=1;context.strokeRect(Math.round(x)+.5,Math.round(y)+.5,size-1,size-1);
      context.fillStyle="#fff";context.font="800 9px system-ui,sans-serif";context.textAlign="center";context.textBaseline="middle";context.fillText(glyph,Math.round(x)+size/2,Math.round(y)+size/2+.5);context.restore();return true;
    },
    vision(context,{x,y,direction="south",range=0,size=16}={}){
      const vector=maps.movement?.DIRECTIONS?.[direction];if(!vector||range<1)return false;this.prepare(context);context.save();
      for(let distance=1;distance<=range;distance++){const cx=x+vector.dx*distance*size,cy=y+vector.dy*distance*size;
        context.fillStyle="rgba(234,88,12,.16)";context.fillRect(cx+1,cy+1,size-2,size-2);context.strokeStyle="rgba(234,88,12,.62)";context.strokeRect(cx+.5,cy+.5,size-1,size-1);
        context.beginPath();context.ellipse(cx+size/2,cy+size/2,size*.28,size*.17,0,0,Math.PI*2);context.strokeStyle="#9a3412";context.lineWidth=1.25;context.stroke();context.beginPath();context.arc(cx+size/2,cy+size/2,size*.07,0,Math.PI*2);context.fillStyle="#9a3412";context.fill();
      }context.restore();return true;
    },
    grid(context,{x=0,y=0,width,height,cell=16,scale=1,color="rgba(24,84,128,.34)"}={}){
      if(width<=0||height<=0)return false;this.prepare(context);const line=1/Math.max(.01,scale),offset=line/2;context.save();context.beginPath();context.strokeStyle=color;context.lineWidth=line;
      for(let gx=0;gx<=width;gx+=cell){context.moveTo(x+gx+offset,y);context.lineTo(x+gx+offset,y+height);}
      for(let gy=0;gy<=height;gy+=cell){context.moveTo(x,y+gy+offset);context.lineTo(x+width,y+gy+offset);}
      context.stroke();context.restore();return true;
    },
    selection(context,{x,y,width,height,scale=1}={}){this.prepare(context);const line=2/Math.max(.01,scale);context.save();context.fillStyle="rgba(40,127,197,.22)";context.fillRect(x,y,width,height);context.strokeStyle="#287fc5";context.lineWidth=line;context.strokeRect(x+line/2,y+line/2,Math.max(0,width-line),Math.max(0,height-line));context.restore();},
    picker(context,{x,y,width,height,scale=1}={}){
      if(width<=0||height<=0)return false;
      this.prepare(context);const ratio=Math.max(.01,Number(scale)||1),outer=4/ratio,inner=2/ratio,handle=Math.min(width,height,6/ratio);
      context.save();
      context.fillStyle="rgba(40,127,197,.14)";
      context.fillRect(x,y,width,height);
      context.strokeStyle="rgba(255,255,255,.96)";
      context.lineWidth=outer;
      context.strokeRect(x+outer/2,y+outer/2,Math.max(0,width-outer),Math.max(0,height-outer));
      context.strokeStyle="#1767a6";
      context.lineWidth=inner;
      context.strokeRect(x+inner/2,y+inner/2,Math.max(0,width-inner),Math.max(0,height-inner));
      context.fillStyle="#1767a6";
      for(const [hx,hy] of [[x,y],[x+width-handle,y],[x,y+height-handle],[x+width-handle,y+height-handle]])context.fillRect(hx,hy,handle,handle);
      context.restore();
      return true;
    }
  });
  const utils=Object.freeze({
    pointInRect(point,{x=0,y=0,width=0,height=0}){return point.x>=x&&point.y>=y&&point.x<x+width&&point.y<y+height;},
    canvasPoint(canvas,clientX,clientY){
      const bounds=canvas?.getBoundingClientRect();if(!bounds?.width||!bounds.height)return null;
      return{x:(clientX-bounds.left)*canvas.width/bounds.width,y:(clientY-bounds.top)*canvas.height/bounds.height};
    },
    localPoint(element,clientX,clientY){const bounds=element?.getBoundingClientRect();return bounds?{x:clientX-bounds.left,y:clientY-bounds.top}:null;},
    gridPoint(canvas,clientX,clientY,cellSize){const point=this.canvasPoint(canvas,clientX,clientY);return point?{x:Math.floor(point.x/cellSize),y:Math.floor(point.y/cellSize)}:null;},
    screenToWorld(point,camera){return{x:(point.x-camera.x)/camera.zoom,y:(point.y-camera.y)/camera.zoom};},
    drawMapFrame(context,{x=0,y=0,width=0,height=0},{label="",current=false,scale=1}={}){
      if(!context||width<=0||height<=0)return false;
      const ratio=Math.max(.01,Number(scale)||1),line=(current?3:2)/ratio,color=current?"#1767a6":"#6f8292";
      context.save();
      context.strokeStyle=color;
      context.lineWidth=line;
      context.strokeRect(x+line/2,y+line/2,Math.max(0,width-line),Math.max(0,height-line));
      if(label){
        const fontSize=11/ratio,padX=5/ratio,padY=3/ratio,maxWidth=Math.max(0,width-padX*2);
        context.font=`700 ${fontSize}px system-ui, sans-serif`;
        context.textBaseline="top";
        const textWidth=Math.min(context.measureText(label).width,maxWidth);
        context.fillStyle="rgba(255,255,255,.9)";
        context.fillRect(x+line,y+line,textWidth+padX*2,fontSize+padY*2);
        context.fillStyle=color;
        context.fillText(label,x+line+padX,y+line+padY,maxWidth);
      }
      context.restore();
      return true;
    },
    async resolveNavigation(stack,checkpoint=null){
      const position=checkpoint?stack?.done?.indexOf(checkpoint):-1,baseline=position>=0?position+1:0,count=(stack?.done?.length||0)-baseline;
      if(!count)return{proceed:true,checkpoint:stack?.done?.at(-1)||null};
      const choice=await AppDialog.choose({
        title:"Open another map?",
        message:`You made ${count} ${count===1?"change":"changes"} on this map. Choose whether those applied ROM changes should be kept.`,
        detail:"Keeping changes preserves them in History and ROM export. Discard only undoes changes made since this map was opened.",
        danger:true,
        choices:[
          {value:"cancel",label:"Keep editing"},
          {value:"keep",label:"Open and keep changes",className:"ui-button--primary"},
          {value:"discard",label:"Discard and open",className:"ui-button--danger"}
        ]
      });
      if(choice==="cancel"||choice===null)return{proceed:false,checkpoint};
      if(choice==="discard"){
        while(stack.done.length>baseline)stack.undo();
        stack.discardRedo?.();stack.changed();
      }
      return{proceed:true,checkpoint:stack.done.at(-1)||null};
    }
  });

  const normalize=(definition)=>{
    if(typeof definition?.create!=="function")throw new TypeError("A map driver requires a create(reader) factory.");
    return Object.freeze({create:definition.create,tools:Object.freeze([...(definition.tools||[])])});
  };

  Object.assign(maps,{
    version:"1.0.0",
    layerModes,
    capabilities,
    overlays:overlayRenderer,
    utils,
    registerDriver(name,definition){if(!name)throw new TypeError("A map driver name is required.");drivers.set(name,normalize(definition));return maps;},
    hasDriver(name){return drivers.has(name);},
    createEditor(reader,name){const definition=drivers.get(name);if(!definition)throw new Error(`Map driver '${name}' is not registered.`);return new maps.Editor(reader,definition.create(reader),{family:name,tools:definition.tools});},
    unregisterDriver(name){drivers.delete(name);return maps;}
  });
  global.MapLayerModes=layerModes;
  global.MapUtils=utils;
})(globalThis);
