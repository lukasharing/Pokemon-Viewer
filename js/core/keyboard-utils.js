(function(global){
  "use strict";

  class KeyboardUtils{
    static isEditableTarget(target){
      if(!target)return false;
      const element=target.nodeType===1?target:target.parentElement;
      return Boolean(element?.closest?.("input,textarea,select,[contenteditable='true'],[contenteditable='plaintext-only']"));
    }

    static hasPrimaryModifier(event){
      return Boolean((event?.ctrlKey||event?.metaKey)&&!event?.altKey);
    }

    static command(event){
      if(!this.hasPrimaryModifier(event)||this.isEditableTarget(event.target))return null;
      const key=String(event.key||"").toLowerCase();
      if(key==="z")return event.shiftKey?"redo":"undo";
      if(key==="y")return"redo";
      return null;
    }
  }

  global.KeyboardUtils=KeyboardUtils;
  ((global.PokemonViewer||={}).core||={}).KeyboardUtils=KeyboardUtils;
})(globalThis);
