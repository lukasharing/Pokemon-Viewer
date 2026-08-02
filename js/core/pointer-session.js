(function(global){
  "use strict";

  class PointerSession{
    constructor(element,handlers={},options={}){
      if(!element?.addEventListener)throw new TypeError("PointerSession requires an event target.");
      this.element=element;
      this.handlers=handlers;
      this.threshold=Math.max(0,Number(options.threshold??4));
      this.signal=options.signal;
      this.active=null;
      this.suppressedClick=null;
      this.bind();
    }

    bind(){
      const options=this.signal?{signal:this.signal}:undefined;
      this.element.addEventListener("pointerdown",event=>this.begin(event),options);
      this.element.addEventListener("pointermove",event=>this.move(event),options);
      this.element.addEventListener("pointerup",event=>this.finish(event,"up"),options);
      this.element.addEventListener("pointercancel",event=>this.finish(event,"cancel"),options);
      this.element.addEventListener("lostpointercapture",event=>this.finish(event,"capture-lost"),options);
      this.element.addEventListener("click",event=>this.tap(event),options);
      global.addEventListener?.("blur",()=>this.cancel("blur"),options);
    }

    begin(event){
      if(this.active||event.isPrimary===false)return false;
      const directive=this.handlers.onStart?.(event);
      if(!directive)return false;
      const config=directive===true?{}:directive;
      this.active={
        pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
        lastX:event.clientX,lastY:event.clientY,moved:false,
        capture:config.capture!==false,consumeClick:config.consumeClick!==false,
        data:config.data??null,lastEvent:event
      };
      if(config.preventDefault!==false)event.preventDefault?.();
      if(config.stopPropagation!==false)event.stopPropagation?.();
      if(this.active.capture)this.element.setPointerCapture?.(event.pointerId);
      return true;
    }

    move(event){
      const state=this.active;
      if(!state){this.handlers.onHover?.(event);return false;}
      if(event.pointerId!==state.pointerId)return false;
      const dx=event.clientX-state.startX,dy=event.clientY-state.startY;
      if(!state.moved&&Math.hypot(dx,dy)>=this.threshold)state.moved=true;
      state.lastEvent=event;
      this.handlers.onMove?.(event,state);
      state.lastX=event.clientX;state.lastY=event.clientY;
      return true;
    }

    finish(event,reason="up"){
      const state=this.active;
      if(!state||event?.pointerId!==undefined&&event.pointerId!==state.pointerId)return false;
      this.active=null;
      state.lastEvent=event||state.lastEvent;
      this.handlers.onEnd?.(state.lastEvent,state,reason);
      if(state.consumeClick&&reason==="up")this.suppressedClick={x:state.lastEvent.clientX,y:state.lastEvent.clientY,time:state.lastEvent.timeStamp??0};
      if(state.capture&&this.element.hasPointerCapture?.(state.pointerId))this.element.releasePointerCapture?.(state.pointerId);
      return true;
    }

    tap(event){
      const suppressed=this.suppressedClick;
      this.suppressedClick=null;
      if(suppressed){
        const elapsed=Math.abs((event.timeStamp??0)-suppressed.time),distance=Math.hypot(event.clientX-suppressed.x,event.clientY-suppressed.y);
        if(elapsed<800&&distance<=this.threshold*2+1){event.preventDefault?.();event.stopImmediatePropagation?.();return false;}
      }
      this.handlers.onTap?.(event);
      return true;
    }

    cancel(reason="cancel"){
      if(!this.active)return false;
      return this.finish(this.active.lastEvent,reason);
    }

    destroy(){this.cancel("destroy");this.handlers={};this.element=null;}
  }

  global.PointerSession=PointerSession;
  global.MapPointerSession=PointerSession;
  ((global.PokemonViewer||={}).core||={}).PointerSession=PointerSession;
  ((global.PokemonViewer||={}).maps||={}).PointerSession=PointerSession;
})(globalThis);
