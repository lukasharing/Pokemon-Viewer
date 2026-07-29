(function(global){
  "use strict";

  class MapEditor{
    constructor(reader,driver,{family,tools=[]}={}){
      this.reader=reader;
      this.driver=driver;
      this.family=family;
      this.workspace=new MapWorkspace("#map_editor",family);
      this.commands=reader.history?.("map_editor",{label:"Map Editor",onChange:stack=>this.workspace.renderHistory(stack)})||new CommandStack({onChange:stack=>this.workspace.renderHistory(stack)});this.workspace.renderHistory(this.commands);
      this.workspace.commands=this.commands;
      this.navigationCheckpoint=null;
      this.workspace.setSupportedTools(tools);
      driver.editor=this;
      driver.workspace=this.workspace;
      driver.commands=this.commands;
      this.onKeyDown=event=>{if(this.workspace.root.classList.contains("hide"))return;const command=KeyboardUtils.command(event);if(command){event.preventDefault();this[command]();}};document.addEventListener("keydown",this.onKeyDown);
      return new Proxy(this,{
        get:(target,key)=>{
          if(key in target){const value=target[key];return typeof value==="function"?value.bind(target):value;}
          const value=driver[key];return typeof value==="function"?value.bind(driver):value;
        },
        set:(target,key,value)=>{if(key in target)target[key]=value;else driver[key]=value;return true;}
      });
    }
    init(...args){
      this.driver.init(...args);
      if(typeof global.EncounterMapPanel==="function"&&["gb","gen2","gba"].includes(this.family)){
        const encounterDriver=this.family==="gb"?"gbc":this.family;
        this.workspace.encounterPanel=new global.EncounterMapPanel(this.reader,encounterDriver,{
          root:this.workspace.encounters,commands:this.commands
        });
        this.workspace.setMapReference(this.driver.bookmark?.()||null);
      }
      this.workspace.root.editorHeader?.render();return this;
    }
    activate(options={}){this.driver.activate?.(options);this.workspace.windowManager?.clamp();return this;}
    refresh(){this.driver.refresh?.();return this;}
    execute(command){return this.commands.execute(command);}
    async navigate(action){
      if(typeof action!=="function")return false;
      const result=await MapUtils.resolveNavigation(this.commands,this.navigationCheckpoint);
      if(!result.proceed)return false;
      this.navigationCheckpoint=result.checkpoint;
      action();return true;
    }
    undo(){return EditUtils.history(this.commands,"undo",{title:"Map history"});}
    redo(){return EditUtils.history(this.commands,"redo",{title:"Map history"});}
    bookmark(){return this.driver.bookmark?.()||{};}
    restoreBookmark(target){this.driver.restoreBookmark?.(target);return this;}
    center(){if(this.driver.center)this.driver.center();else this.workspace.center();return this;}
    destroy(){document.removeEventListener("keydown",this.onKeyDown);this.commands.destroy?.();this.driver.destroy?.();this.workspace.destroy();}
  }

  global.MapEditor=MapEditor;
  ((global.PokemonViewer ||= {}).maps ||= {}).Editor=MapEditor;
})(globalThis);
