(function(global){
  "use strict";
  class GestureZoom {
    static delta(event,{limit=120}={}){const unit=event.deltaMode===1?16:event.deltaMode===2?Math.max(1,event.currentTarget?.clientHeight||800):1,value=Number(event.deltaY||0)*unit;return Math.max(-limit,Math.min(limit,value));}
    static factor(event,{sensitivity=.0009,min=.92,max=1.087}={}){return Math.max(min,Math.min(max,Math.exp(-this.delta(event)*sensitivity)));}
    static anchoredPoint(element,event,width=element?.width,height=element?.height){const bounds=element?.getBoundingClientRect();if(!bounds?.width||!bounds.height)return null;return{x:(event.clientX-bounds.left)*width/bounds.width,y:(event.clientY-bounds.top)*height/bounds.height};}
    static captureScrollAnchor(viewport,content,event=null){
      const viewportBounds=viewport?.getBoundingClientRect?.(),contentBounds=content?.getBoundingClientRect?.();
      if(!viewportBounds?.width||!viewportBounds.height||!contentBounds?.width||!contentBounds.height)return null;
      const clientX=Number.isFinite(event?.clientX)?event.clientX:viewportBounds.left+viewportBounds.width/2;
      const clientY=Number.isFinite(event?.clientY)?event.clientY:viewportBounds.top+viewportBounds.height/2;
      const clamp=value=>Math.max(0,Math.min(1,value));
      return{x:clamp((clientX-contentBounds.left)/contentBounds.width),y:clamp((clientY-contentBounds.top)/contentBounds.height),clientX,clientY};
    }
    static restoreScrollAnchor(viewport,content,anchor){
      if(!anchor)return false;const bounds=content?.getBoundingClientRect?.();if(!bounds?.width||!bounds.height)return false;
      viewport.scrollLeft+=(bounds.left+anchor.x*bounds.width)-anchor.clientX;
      viewport.scrollTop+=(bounds.top+anchor.y*bounds.height)-anchor.clientY;
      return true;
    }
    static consumeSteps(owner,event,{threshold=64}={}){const delta=this.delta(event);owner.__gestureZoomRemainder=(owner.__gestureZoomRemainder||0)+delta;const steps=Math.trunc(owner.__gestureZoomRemainder/threshold);owner.__gestureZoomRemainder-=steps*threshold;return -steps;}
    static dragDelta(current,start,{sensitivity=.72}={}){return(current-start)*sensitivity;}
    static bindPinch(element,onZoom,{signal}={}){
      const pointers=new Map();let previous=null;
      const point=event=>({x:event.clientX,y:event.clientY});
      const distance=values=>Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);
      const down=event=>{if(event.pointerType!=="touch")return;pointers.set(event.pointerId,point(event));if(pointers.size===2)previous=distance([...pointers.values()]);};
      const move=event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,point(event));if(pointers.size!==2)return;event.preventDefault();const values=[...pointers.values()],next=distance(values);if(previous>0&&next>0)onZoom?.({factor:Math.max(.92,Math.min(1.087,next/previous)),clientX:(values[0].x+values[1].x)/2,clientY:(values[0].y+values[1].y)/2,event});previous=next;};
      const up=event=>{pointers.delete(event.pointerId);previous=pointers.size===2?distance([...pointers.values()]):null;};
      element.addEventListener("pointerdown",down,{signal});element.addEventListener("pointermove",move,{passive:false,signal});element.addEventListener("pointerup",up,{signal});element.addEventListener("pointercancel",up,{signal});
      return()=>{element.removeEventListener("pointerdown",down);element.removeEventListener("pointermove",move);element.removeEventListener("pointerup",up);element.removeEventListener("pointercancel",up);};
    }
  }
  global.GestureZoom=GestureZoom;((global.PokemonViewer ||= {}).core ||= {}).GestureZoom=GestureZoom;
})(globalThis);
