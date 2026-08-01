(function(global){
  "use strict";
  const core=((global.PokemonViewer||={}).core||={});

  class EditorRenderPipeline{
    constructor({name="editor",onError=null}={}){
      this.name=name;this.onError=onError;this.revision=0;this.controller=null;this.timings=[];
    }
    begin(label="selection"){
      this.controller?.abort(new DOMException("Superseded editor render","AbortError"));
      this.controller=new AbortController();
      const ticket=Object.freeze({revision:++this.revision,label,signal:this.controller.signal,started:performance.now()});
      performance.mark?.(`${this.name}:${ticket.revision}:start`);
      return ticket;
    }
    current(ticket){return Boolean(ticket)&&ticket.revision===this.revision&&!ticket.signal.aborted;}
    async run(ticket,task,{schedule="paint",phase="related"}={}){
      try{
        if(schedule==="paint")await ProjectScheduler.afterPaint(1);
        else if(schedule==="idle")await ProjectScheduler.idle();
        if(!this.current(ticket))return false;
        const started=performance.now();await task(ticket.signal);
        if(!this.current(ticket))return false;
        this.timings.push(Object.freeze({label:ticket.label,phase,duration:performance.now()-started}));
        if(this.timings.length>40)this.timings.shift();
        return true;
      }catch(error){
        if(error?.name==="AbortError"||!this.current(ticket))return false;
        if(this.onError)this.onError(error,phase);else console.error(`${this.name} ${phase} render failed`,error);
        return false;
      }
    }
    report(){return Object.freeze(this.timings.slice());}
    destroy(){this.controller?.abort(new DOMException("Editor closed","AbortError"));this.controller=null;}
  }

  core.EditorRenderPipeline=EditorRenderPipeline;global.EditorRenderPipeline=EditorRenderPipeline;
})(globalThis);
