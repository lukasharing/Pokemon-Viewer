(function(global){
  "use strict";
  class UiCanvasRegions{
    constructor(canvas){
      if(!canvas)throw new TypeError("UiCanvasRegions requires a canvas.");
      this.canvas=canvas;this.items=[];this.selectedId=null;
    }
    set(items=[],{offsetX=0,offsetY=0,scaleX=1,scaleY=scaleX}={}){
      this.items=(items||[]).map((source,index)=>{
        const bounds=source?.bounds||source||{},x=Number(bounds.x),y=Number(bounds.y),width=Number(bounds.width),height=Number(bounds.height);
        if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
        return Object.freeze({
          id:String(source.id??`region-${index+1}`),source,
          x:offsetX+x*scaleX,y:offsetY+y*scaleY,width:width*scaleX,height:height*scaleY
        });
      }).filter(Boolean);
      if(this.selectedId&&!this.items.some(item=>item.id===this.selectedId))this.selectedId=null;
      return this;
    }
    point(clientX,clientY){
      const bounds=this.canvas.getBoundingClientRect();
      return{x:(clientX-bounds.left)*this.canvas.width/bounds.width,y:(clientY-bounds.top)*this.canvas.height/bounds.height};
    }
    hit(clientX,clientY){
      const point=this.point(clientX,clientY);
      return[...this.items].reverse().find(item=>point.x>=item.x&&point.x<item.x+item.width&&point.y>=item.y&&point.y<item.y+item.height)?.source||null;
    }
    select(id){this.selectedId=id==null?null:String(id);return this;}
    selected(){return this.items.find(item=>item.id===this.selectedId)||null;}
    draw(context,{stroke="#ffca28",lineWidth=2,dash=[3,2]}={}){
      const item=this.selected();if(!item)return false;
      context.save();context.strokeStyle=stroke;context.lineWidth=lineWidth;context.setLineDash(dash);
      context.strokeRect(item.x+1,item.y+1,Math.max(0,item.width-2),Math.max(0,item.height-2));context.restore();return true;
    }
  }
  global.UiCanvasRegions=UiCanvasRegions;
})(globalThis);
