(function(global){
  "use strict";
  class EditorPreferences{
    static STORAGE_KEY="push.editor.preferences";
    constructor(){
      this.values={experience:"simple"};
      try{Object.assign(this.values,JSON.parse(localStorage.getItem(EditorPreferences.STORAGE_KEY)||"{}"));}catch{}
      if(!["simple","nerd"].includes(this.values.experience))this.values.experience="simple";
      this.apply();
    }
    get experience(){return this.values.experience;}
    setExperience(value){
      if(!["simple","nerd"].includes(value))throw new TypeError(`Unknown editor experience '${value}'.`);
      this.values.experience=value;
      try{localStorage.setItem(EditorPreferences.STORAGE_KEY,JSON.stringify(this.values));}catch{}
      this.apply();document.dispatchEvent(new CustomEvent("editorpreferencechange",{detail:{...this.values}}));return this;
    }
    apply(){document.documentElement.dataset.experience=this.experience;return this;}
    open(){
      document.querySelector(".editor-settings")?.remove();
      const dialog=Dom.create("dialog",{className:"app-dialog editor-settings"});
      const choices=[
        {id:"simple",title:"Simple",description:"Friendly labels and the tools needed for common map, event, code, and sprite tasks."},
        {id:"nerd",title:"Nerd",description:"Also show raw offsets, byte counts, CPU modes, structure identifiers, and low-level controls."}
      ];
      const close=()=>AppDialog.unmount(dialog);
      dialog.append(AppDialog.card({title:"Editor experience",icon:"fa-gear",onClose:close,body:[
        Dom.create("p",{text:"Choose how much technical detail the interface shows. This never changes the ROM data or available editor engines."}),
        Dom.create("div",{className:"editor-settings__choices"},choices.map(choice=>{
          const input=Dom.create("input",{attributes:{type:"radio",name:"experience",value:choice.id}});
          input.checked=this.experience===choice.id;
          input.addEventListener("change",()=>this.setExperience(choice.id));
          return Dom.create("label",{className:"editor-settings__choice"},[input,Dom.create("span",{},[Dom.create("strong",{text:choice.title}),Dom.create("small",{text:choice.description})])]);
        }))
      ]}));
      dialog.addEventListener("cancel",event=>{event.preventDefault();close();},{once:true});
      return AppDialog.mount(dialog,{focus:"input:checked, input"});
    }
  }
  global.EditorPreferences=EditorPreferences;
  global.editorPreferences=new EditorPreferences();
  // Compatibility for stale lazy-loaded editor modules. AppSettings used to be
  // the public settings singleton; keep the alias at the application boundary
  // so feature modules can depend on editorPreferences without load-order bugs.
  global.AppSettings=global.editorPreferences;
  ((global.PokemonViewer ||= {}).core ||= {}).preferences=global.editorPreferences;
})(globalThis);
