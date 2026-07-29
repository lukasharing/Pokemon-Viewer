(function(global){
  "use strict";

  class CommandStackScope{
    constructor(journal,owner,{label=owner,onChange}={}){
      this.journal=journal;this.owner=String(owner);this.label=String(label);
      this.unsubscribe=typeof onChange==="function"?journal.subscribe(()=>onChange(this)):null;
    }
    get done(){return this.journal.done.filter(command=>command.owner===this.owner);}
    get undone(){return this.journal.undone.filter(command=>command.owner===this.owner);}
    get canUndo(){return this.journal.done.at(-1)?.owner===this.owner;}
    get canRedo(){return this.journal.undone.at(-1)?.owner===this.owner;}
    get blockingUndo(){const command=this.journal.done.at(-1);return command&&command.owner!==this.owner?command:null;}
    execute(command){return this.journal.execute({...command,owner:this.owner,ownerLabel:command.ownerLabel||this.label});}
    undo(){
      const command=this.journal.done.at(-1);
      if(!command)return false;
      if(command.owner!==this.owner)throw new Error(`Undo ${command.label} first; it is the latest project change (${command.ownerLabel||command.owner}).`);
      return this.journal.undo();
    }
    redo(){
      const command=this.journal.undone.at(-1);
      if(!command)return false;
      if(command.owner!==this.owner)throw new Error(`Redo ${command.label} first; it is the next project change (${command.ownerLabel||command.owner}).`);
      return this.journal.redo();
    }
    discardRedo(){this.journal.discardRedo(this.owner);return this;}
    changed(){this.journal.changed(null,"scope-refresh");return this;}
    destroy(){this.unsubscribe?.();this.unsubscribe=null;}
  }

  class CommandStack{
    constructor({limit=100,onChange}={}){
      this.limit=limit;this.done=[];this.undone=[];this.listeners=new Set();
      if(typeof onChange==="function")this.listeners.add(onChange);
    }
    execute(command){
      if(typeof command?.do!=="function"||typeof command?.undo!=="function")throw new TypeError("Commands require do() and undo().");
      command.do();
      const entry={...command,owner:command.owner||"project",ownerLabel:command.ownerLabel||"Project",label:command.label||"Change",time:new Date()};
      this.done.push(entry);if(this.done.length>this.limit)this.done.shift();this.undone=[];
      this.changed(entry,"execute");return entry;
    }
    undo(){
      const command=this.done.at(-1);if(!command)return false;
      command.undo();this.done.pop();this.undone.push(command);this.changed(command,"undo");return true;
    }
    redo(){
      const command=this.undone.at(-1);if(!command)return false;
      command.do();this.undone.pop();this.done.push(command);this.changed(command,"redo");return true;
    }
    scope(owner,options){if(!owner)throw new TypeError("A command scope requires an owner.");return new CommandStackScope(this,owner,options);}
    subscribe(listener){if(typeof listener!=="function")throw new TypeError("History listener must be a function.");this.listeners.add(listener);return()=>this.listeners.delete(listener);}
    discardRedo(owner=null){
      if(owner===null)this.undone=[];
      else this.undone=this.undone.filter(command=>command.owner!==owner);
      this.changed(null,"discard-redo");return this;
    }
    clear(){this.done=[];this.undone=[];this.changed(null,"clear");}
    changed(command=null,action="refresh"){
      for(const listener of this.listeners)listener(this,{command,action});
      if(typeof global.CustomEvent==="function")global.document?.dispatchEvent?.(new CustomEvent("editorhistorychange",{detail:{stack:this,command,action}}));
    }
  }
  global.CommandStackScope=CommandStackScope;
  global.CommandStack=CommandStack;
  ((global.PokemonViewer ||= {}).core ||= {}).CommandStack=CommandStack;
})(globalThis);
