(function(global){
  "use strict";
  class EditorLinks{
    static open(detail){
      if(!detail||typeof detail!=="object"||typeof detail.workspace!=="string"||!detail.workspace)throw new TypeError("Editor link requires a workspace.");
      document.dispatchEvent(new CustomEvent("editorlink",{detail}));
      return detail;
    }
    static optional(detail){return detail?this.open(detail):null;}
    static species(species){return this.open({workspace:"pokedex_editor",species:Number(species)});}
    static move(move){return this.open({workspace:"move_editor",move:Number(move)});}
    static sound(reference){
      return this.open(typeof reference==="object"&&reference!==null
        ?{workspace:"sound_editor",...reference}
        :{workspace:"sound_editor",species:Number(reference)});
    }
    static sprite(source={}){return this.open({workspace:"sprite_editor",...source});}
    static code(offset,options={}){return this.open({workspace:"code_workspace",offset,...options});}
    static hex(offset,options={}){return this.open({workspace:"hex_editor",offset,...options});}
    static map(reference={}){return this.open({workspace:"map_editor",...reference});}
    static battle(reference){return this.open({workspace:"battle_editor",...reference});}
    static animation(reference={}){return this.open({workspace:"animation_editor",...reference});}
  }
  global.EditorLinks=EditorLinks;
})(globalThis);
