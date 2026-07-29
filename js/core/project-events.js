(function(global){
  "use strict";
  class ProjectEvents{
    static emit(type,detail={}){
      if(typeof type!=="string"||!type)throw new TypeError("Project event requires a type.");
      if(!detail||typeof detail!=="object")throw new TypeError("Project event detail must be an object.");
      if(typeof document==="undefined")return detail;
      document.dispatchEvent(new CustomEvent(type,{detail}));
      return detail;
    }
    static resources(graph){return this.emit("resourcegraphchange",{graph});}
    static graphics(offsets=[],detail={}){
      const normalized=[...new Set(offsets.filter(offset=>Number.isInteger(offset)&&offset>=0))];
      return this.emit("romgraphicschange",{...detail,offsets:normalized});
    }
  }
  global.ProjectEvents=ProjectEvents;
})(globalThis);
