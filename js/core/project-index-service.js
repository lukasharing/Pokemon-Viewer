(function(global){
  "use strict";
  const root=(global.PokemonViewer||={}),core=root.core||(root.core={});
  const services=new WeakMap();

  class ProjectIndexService{
    static forReader(reader){
      if(!reader?.memory)throw new Error("A loaded ROM is required to create the project index.");
      let service=services.get(reader.memory);
      if(!service){service=new ProjectIndexService(reader);services.set(reader.memory,service);}
      return service;
    }
    static patchMemory(memory,patches){services.get(memory)?.patch(patches);}
    static destroyMemory(memory){const service=services.get(memory);service?.destroy();services.delete(memory);}
    constructor(reader){
      this.reader=reader;this.generation=reader.projectGeneration;this.revision=0;this.sequence=0;
      this.pending=new Map();this.worker=null;this.readyPromise=null;this.initialized=false;this.queuedPatches=[];
    }
    start(){
      if(this.readyPromise)return this.readyPromise;
      if(typeof Worker!=="function")return this.readyPromise=Promise.resolve(false);
      this.worker=new Worker("js/workers/project-index-worker.js?v=1");
      this.worker.addEventListener("message",event=>this.receive(event.data));
      this.worker.addEventListener("error",error=>this.failAll(error));
      const bytes=this.reader.memory.bytes.slice();
      this.readyPromise=this.request("init",{bytes:bytes.buffer},[bytes.buffer]).then(()=>{
        this.initialized=true;
        if(this.queuedPatches.length){const queued=this.queuedPatches.splice(0);this.patch(queued.flat());}
        return true;
      });
      return this.readyPromise;
    }
    request(operation,payload={},transfer=[]){
      if(!this.worker&&operation!=="init")return this.start().then(started=>{
        if(!started)throw new Error("Background project indexing is unavailable in this browser.");
        return this.request(operation,payload,transfer);
      });
      const requestId=++this.sequence,message={requestId,projectGeneration:this.generation,romRevision:this.revision,operation,payload};
      return new Promise((resolve,reject)=>{this.pending.set(requestId,{resolve,reject,revision:this.revision,operation});this.worker.postMessage(message,transfer);});
    }
    receive(message){
      const pending=this.pending.get(message?.requestId);if(!pending)return;
      this.pending.delete(message.requestId);
      if(message.projectGeneration!==this.generation||message.romRevision!==pending.revision){pending.reject(new DOMException("Stale project index response","AbortError"));return;}
      if(message.error)pending.reject(new Error(message.error));else pending.resolve(message.result);
    }
    patch(patches){
      if(!this.worker)return;
      const normalized=Array.from(patches||[]).map(({offset,bytes})=>({offset,bytes:Uint8Array.from(bytes)}));
      if(!normalized.length)return;
      if(!this.initialized){this.queuedPatches.push(normalized);return;}
      this.revision++;
      for(const pending of this.pending.values())pending.reject(new DOMException("ROM changed while indexing","AbortError"));
      this.pending.clear();
      this.worker.postMessage({requestId:0,projectGeneration:this.generation,romRevision:this.revision,operation:"patch",payload:{patches:normalized}});
    }
    async scanFixedRecords(schema){await this.start();return this.request("scan-fixed-records",schema);}
    failAll(error){for(const pending of this.pending.values())pending.reject(error);this.pending.clear();}
    destroy(){this.failAll(new DOMException("Project closed","AbortError"));this.worker?.terminate();this.worker=null;this.readyPromise=null;this.initialized=false;this.queuedPatches=[];}
  }
  core.ProjectIndexService=ProjectIndexService;global.ProjectIndexService=ProjectIndexService;
})(globalThis);
