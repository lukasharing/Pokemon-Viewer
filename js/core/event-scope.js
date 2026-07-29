(function(global){
  "use strict";

  class EventScope {
    constructor(){
      this.controller=new AbortController();
      this.cleanups=[];
      this.frames=new Set();
      this.destroyed=false;
    }

    get signal(){return this.controller.signal;}
    get options(){return{signal:this.signal};}

    listen(target,type,listener,options={}){
      target?.addEventListener(type,listener,{...options,signal:this.signal});
      return listener;
    }

    cleanup(callback){
      if(typeof callback==="function")this.cleanups.push(callback);
      return callback;
    }

    frame(callback){
      if(this.destroyed)return null;
      const id=requestAnimationFrame(time=>{this.frames.delete(id);if(!this.destroyed)callback(time);});
      this.frames.add(id);
      return id;
    }

    cancelFrame(id){
      if(id===null||id===undefined)return;
      cancelAnimationFrame(id);
      this.frames.delete(id);
    }

    destroy(){
      if(this.destroyed)return;
      this.destroyed=true;
      this.controller.abort();
      for(const id of this.frames)cancelAnimationFrame(id);
      this.frames.clear();
      for(const callback of this.cleanups.splice(0).reverse())callback();
    }
  }

  global.EventScope=EventScope;
  ((global.PokemonViewer ||= {}).core ||= {}).EventScope=EventScope;
})(globalThis);
