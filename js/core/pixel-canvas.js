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
    static fit(canvas,{container=canvas?.parentElement,target=canvas?.parentElement,maxScale=8}={}){
      if(!canvas||!container||!target)throw new TypeError("PixelCanvas.fit requires a canvas, container and target.");
      const refresh=()=>{
        const style=getComputedStyle(container),horizontal=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),vertical=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
        const availableWidth=Math.max(0,container.clientWidth-horizontal),availableHeight=Math.max(0,container.clientHeight-vertical);
        if(!availableWidth||!availableHeight||!canvas.width||!canvas.height)return;
        const raw=Math.min(availableWidth/canvas.width,availableHeight/canvas.height,maxScale),scale=raw>=1?Math.max(1,Math.floor(raw)):raw;
        target.style.width=`${Math.max(1,canvas.width*scale)}px`;
        target.style.height=`${Math.max(1,canvas.height*scale)}px`;
      };
      const observer=typeof ResizeObserver==="function"?new ResizeObserver(refresh):null;
      observer?.observe(container);refresh();
      return{refresh,destroy(){observer?.disconnect();target.style.removeProperty("width");target.style.removeProperty("height");}};
    }
  }
  global.PixelCanvas=PixelCanvas;
})(globalThis);
