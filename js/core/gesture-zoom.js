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
    static captureViewportCenter(viewport,content){
      const viewportBounds=viewport?.getBoundingClientRect?.(),contentBounds=content?.getBoundingClientRect?.();
      if(!viewportBounds?.width||!viewportBounds.height||!contentBounds?.width||!contentBounds.height)return null;
      return{x:(viewportBounds.left+viewportBounds.width/2-contentBounds.left)/contentBounds.width,y:(viewportBounds.top+viewportBounds.height/2-contentBounds.top)/contentBounds.height};
    }
    static restoreViewportCenter(viewport,content,anchor){
      const viewportBounds=viewport?.getBoundingClientRect?.(),contentBounds=content?.getBoundingClientRect?.();
      if(!anchor||!viewportBounds?.width||!viewportBounds.height||!contentBounds?.width||!contentBounds.height)return false;
      viewport.scrollLeft+=(contentBounds.left+anchor.x*contentBounds.width)-(viewportBounds.left+viewportBounds.width/2);
      viewport.scrollTop+=(contentBounds.top+anchor.y*contentBounds.height)-(viewportBounds.top+viewportBounds.height/2);
      return true;
    }
    static observeResize(viewport,content,onResize,{signal}={}){
      if(!viewport)throw new TypeError("GestureZoom.observeResize requires a viewport.");
      const resolveContent=()=>typeof content==="function"?content():content;
      let anchor=this.captureViewportCenter(viewport,resolveContent()),size={width:viewport?.clientWidth||0,height:viewport?.clientHeight||0},destroyed=false;
      let controller;
      const refresh=()=>{anchor=this.captureViewportCenter(viewport,resolveContent())||anchor;return controller;};
      const observer=typeof ResizeObserver==="function"?new ResizeObserver(entries=>{
        if(destroyed)return;const rect=entries[0]?.contentRect||{},width=Math.max(0,Number(rect.width)||viewport.clientWidth||0),height=Math.max(0,Number(rect.height)||viewport.clientHeight||0);
        if(width===size.width&&height===size.height){refresh();return;}
        const previous={...size};size={width,height};onResize?.({width,height,previousWidth:previous.width,previousHeight:previous.height});
        this.restoreViewportCenter(viewport,resolveContent(),anchor);refresh();
      }):null;
      const remember=()=>refresh();viewport?.addEventListener?.("scroll",remember,{passive:true,signal});observer?.observe(viewport);
      const destroy=()=>{if(destroyed)return;destroyed=true;observer?.disconnect();viewport?.removeEventListener?.("scroll",remember);};
      controller={refresh,destroy};signal?.addEventListener?.("abort",destroy,{once:true});return controller;
    }
    static consumeSteps(owner,event,{threshold=64}={}){const delta=this.delta(event);owner.__gestureZoomRemainder=(owner.__gestureZoomRemainder||0)+delta;const steps=Math.trunc(owner.__gestureZoomRemainder/threshold);owner.__gestureZoomRemainder-=steps*threshold;return -steps;}
    static dragDelta(current,start,{sensitivity=.72}={}){return(current-start)*sensitivity;}
    static bindPinch(element,onZoom,{signal,onStart,onEnd}={}){
      const pointers=new Map();let previous=null;
      const point=event=>({x:event.clientX,y:event.clientY});
      const distance=values=>Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);
      const center=values=>({clientX:(values[0].x+values[1].x)/2,clientY:(values[0].y+values[1].y)/2});
      const down=event=>{if(event.pointerType!=="touch")return;pointers.set(event.pointerId,point(event));if(pointers.size===2){const values=[...pointers.values()];previous=distance(values);onStart?.({...center(values),event});}};
      const move=event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,point(event));if(pointers.size!==2)return;event.preventDefault();const values=[...pointers.values()],next=distance(values);if(previous>0&&next>0)onZoom?.({factor:Math.max(.92,Math.min(1.087,next/previous)),clientX:(values[0].x+values[1].x)/2,clientY:(values[0].y+values[1].y)/2,event});previous=next;};
      const up=event=>{const wasPinching=pointers.size===2;pointers.delete(event.pointerId);previous=pointers.size===2?distance([...pointers.values()]):null;if(wasPinching)onEnd?.({event});};
      const cancel=event=>{const wasPinching=pointers.size>=2;pointers.clear();previous=null;if(wasPinching)onEnd?.({event});};
      element.addEventListener("pointerdown",down,{signal});element.addEventListener("pointermove",move,{passive:false,signal});element.addEventListener("pointerup",up,{signal});element.addEventListener("pointercancel",up,{signal});global.addEventListener?.("blur",cancel,{signal});
      return()=>{element.removeEventListener("pointerdown",down);element.removeEventListener("pointermove",move);element.removeEventListener("pointerup",up);element.removeEventListener("pointercancel",up);global.removeEventListener?.("blur",cancel);cancel();};
    }
  }
  global.GestureZoom=GestureZoom;((global.PokemonViewer ||= {}).core ||= {}).GestureZoom=GestureZoom;
})(globalThis);
