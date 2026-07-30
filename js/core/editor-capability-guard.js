(function(global){
  "use strict";

  class EditorCapabilityError extends Error{
    constructor(workspace,operation,reason){
      super(`${operation} is not allowed because '${workspace}' is read-only. ${reason}`);
      this.name="EditorCapabilityError";
      this.code="EDITOR_CAPABILITY_READ_ONLY";
      this.workspace=workspace;
      this.operation=operation;
    }
  }

  class EditorCapabilityGuard{
    static inspect(reader,workspace){
      if(typeof workspace!=="string"||!workspace.trim())throw new TypeError("A workspace id is required.");
      let capability=null,failure=null;
      try{capability=reader?.capabilities?.get?.(workspace)||null;}
      catch(error){failure=error;}
      const writable=capability?.writable===true;
      const reason=capability?.reason
        ||(failure?`The capability manifest could not be read: ${failure.message}`:"No writable capability is registered for this project.");
      return Object.freeze({
        workspace,
        writable,
        state:capability?.state||"unavailable",
        reason,
        capability
      });
    }

    static canWrite(reader,workspace){
      return this.inspect(reader,workspace).writable;
    }

    static requireWritable(reader,workspace,operation="This write"){
      const access=this.inspect(reader,workspace);
      if(!access.writable)throw new EditorCapabilityError(workspace,operation,access.reason);
      return access.capability;
    }

    static configureControl(control,reader,workspace,{operation="This write"}={}){
      const access=this.inspect(reader,workspace);
      if(!control)return access;
      control.disabled=!access.writable;
      control.dataset.capabilityWritable=String(access.writable);
      control.setAttribute?.("aria-disabled",String(!access.writable));
      if(!access.writable)control.title=`${operation} is unavailable. ${access.reason}`;
      return access;
    }

    static protectCommands(reader,workspace,commands,{operation="Writing project data"}={}){
      if(!commands||typeof commands.execute!=="function")throw new TypeError("A command stack is required.");
      const guard=this,writeMethods=new Set(["execute","undo","redo"]);
      return new Proxy(commands,{
        get(target,key){
          const value=Reflect.get(target,key,target);
          if(typeof value!=="function")return value;
          if(!writeMethods.has(key))return value.bind(target);
          return(...args)=>{
            guard.requireWritable(reader,workspace,`${operation} (${key})`);
            return value.apply(target,args);
          };
        },
        set(target,key,value){return Reflect.set(target,key,value,target);}
      });
    }
  }

  global.EditorCapabilityError=EditorCapabilityError;
  global.EditorCapabilityGuard=EditorCapabilityGuard;
  ((global.PokemonViewer||={}).core||={}).EditorCapabilityGuard=EditorCapabilityGuard;
})(globalThis);
