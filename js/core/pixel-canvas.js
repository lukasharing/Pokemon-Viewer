(function(global){
  "use strict";
  class PixelCanvas{
    static create(width,height,{className="",label=null,hidden=false}={}){
      if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1)throw new RangeError("Pixel canvas dimensions must be positive integers.");
      const canvas=document.createElement("canvas");
      canvas.width=width;canvas.height=height;canvas.className=className;canvas.hidden=hidden;
      if(label===null)canvas.setAttribute("aria-hidden","true");
      else canvas.setAttribute("aria-label",label);
      this.context(canvas);
      return canvas;
    }
    static context(canvas){
      const context=canvas?.getContext?.("2d");
      if(!context)throw new TypeError("PixelCanvas requires a 2D canvas.");
      context.imageSmoothingEnabled=false;
      return context;
    }
    static draw(target,source,{x=0,y=0,width=target?.width,height=target?.height,clear=true}={}){
      if(!source)throw new TypeError("PixelCanvas.draw requires an image source.");
      const context=this.context(target);
      if(clear)context.clearRect(0,0,target.width,target.height);
      context.drawImage(source,x,y,width,height);
      return target;
    }
    static copy(source,{width=source?.width,height=source?.height,...options}={}){
      const canvas=this.create(width,height,options);
      return this.draw(canvas,source,{width,height});
    }
  }
  global.PixelCanvas=PixelCanvas;
})(globalThis);
