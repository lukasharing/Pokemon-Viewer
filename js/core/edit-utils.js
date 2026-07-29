(function(global){
  "use strict";

  class EditUtils{
    static values(schema,source={},overrides={}){
      const previous={},next={};
      for(const key of Object.keys(schema||{})){
        previous[key]=source[key];
        next[key]=overrides[key]===undefined?previous[key]:overrides[key];
      }
      return Object.freeze({
        previous:Object.freeze(previous),
        next:Object.freeze(next),
        changed:Object.keys(previous).some(key=>previous[key]!==next[key])
      });
    }

    static binarySchema(schema={}){
      return Object.fromEntries(Object.entries(schema).map(([key,{offset=0,type}])=>[key,{offset,type}]));
    }

    static command(stack,{label="Change",description="",apply,undo}={}){
      if(typeof apply!=="function"||typeof undo!=="function")throw new TypeError("An edit requires apply() and undo().");
      if(stack?.execute)return stack.execute({label,description,do:apply,undo});
      apply();
      return true;
    }

    static history(stack,action,{title="Editor history"}={}){
      if(!["undo","redo"].includes(action)||typeof stack?.[action]!=="function")throw new TypeError("History action must be undo or redo.");
      try{return stack[action]();}
      catch(error){
        if(global.NotificationHandler?.pop)global.NotificationHandler.pop(title,error.message||String(error),global.NotificationType?.ERROR);
        return false;
      }
    }
  }

  global.EditUtils=EditUtils;
  ((global.PokemonViewer ||= {}).core ||= {}).EditUtils=EditUtils;
})(globalThis);
