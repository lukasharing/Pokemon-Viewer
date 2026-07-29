(function(global){
  "use strict";

  class DraftRegistry{
    constructor(){this.providers=new Map();}

    register(editor,provider){
      const id=String(editor||"").trim();
      if(!id)throw new TypeError("A draft provider requires a stable editor ID.");
      if(typeof provider!=="function")throw new TypeError(`Draft provider '${id}' must be a function.`);
      if(this.providers.has(id))throw new Error(`Draft provider '${id}' is already registered.`);
      this.providers.set(id,provider);
      this.changed(id);
      let active=true;
      return()=>{
        if(!active)return false;
        active=false;
        const removed=this.providers.delete(id);
        if(removed)this.changed(id);
        return removed;
      };
    }

    pending(){
      const result=[];
      for(const [editor,provider] of this.providers){
        try{
          const values=provider();
          if(values==null)continue;
          if(!Array.isArray(values))throw new TypeError(`Draft provider '${editor}' must return an array.`);
          for(const value of values){
            if(!value||typeof value!=="object")throw new TypeError(`Draft provider '${editor}' returned an invalid item.`);
            const kind=String(value.kind||"draft"),label=String(value.label||kind);
            result.push(Object.freeze({...value,editor,kind,label}));
          }
        }
        catch(error){
          result.push(Object.freeze({editor,kind:"draft-provider-error",label:`${editor} could not enumerate its drafts`,error:error?.message||String(error)}));
        }
      }
      return Object.freeze(result);
    }

    changed(editor=null){
      if(typeof global.CustomEvent==="function")global.document?.dispatchEvent?.(new CustomEvent("editorpendingchange",{detail:{editor,pending:this.pending()}}));
    }

    clear(){
      if(!this.providers.size)return false;
      this.providers.clear();
      this.changed(null);
      return true;
    }

    has(editor){return this.providers.has(String(editor));}
    get size(){return this.providers.size;}
  }

  global.DraftRegistry=DraftRegistry;
  ((global.PokemonViewer ||= {}).core ||= {}).DraftRegistry=DraftRegistry;
})(globalThis);
