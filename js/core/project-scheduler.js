(function(global){
  "use strict";
  class ProjectScheduler{
    static afterPaint(frames=2){
      return new Promise(resolve=>{
        const frame=typeof requestAnimationFrame==="function"?requestAnimationFrame:callback=>setTimeout(callback,0);
        const step=remaining=>frame(()=>remaining>1?step(remaining-1):resolve());step(Math.max(1,frames));
      });
    }
    static idle({timeout=250}={}){
      return new Promise(resolve=>typeof requestIdleCallback==="function"
        ?requestIdleCallback(resolve,{timeout})
        :setTimeout(()=>resolve({didTimeout:true,timeRemaining:()=>0}),0));
    }
    static async *chunks(items,size=64,{signal=null}={}){
      const values=Array.from(items||[]);
      for(let index=0;index<values.length;index+=size){
        if(signal?.aborted)throw signal.reason||new DOMException("Cancelled","AbortError");
        yield values.slice(index,index+size);await this.idle();
      }
    }
  }
  global.ProjectScheduler=ProjectScheduler;
  (((global.PokemonViewer||={}).core||={}).ProjectScheduler)=ProjectScheduler;
})(globalThis);
