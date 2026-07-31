(function(global){
  "use strict";
  const ns=((global.PokemonViewer||={}).battle||={});
  class BattleSourceState{
    constructor({root,select,picker=null,trainerScene}){
      this.root=root;this.select=select;this.picker=picker;this.trainerScene=trainerScene;this.mode="trainer";
    }
    trainer(){
      this.mode="trainer";this.root.classList.remove("battle-editor--wild");
      this.trainerScene?.setAttribute("aria-hidden","false");
      this.picker?.removeSpecial("__encounter__");
      this.select.querySelector('option[value="__encounter__"]')?.remove();
    }
    wild(label="encounter"){
      this.mode="wild";this.root.classList.add("battle-editor--wild");
      this.trainerScene?.setAttribute("aria-hidden","true");
      if(this.picker)this.picker.addSpecial("__encounter__",`Wild · ${label}`);
      else{this.select.querySelector('option[value="__encounter__"]')?.remove();this.select.prepend(Dom.create("option",{attributes:{value:"__encounter__"},text:`Wild · ${label}`}));this.select.value="__encounter__";}
    }
    get isWild(){return this.mode==="wild";}
  }
  ns.BattleSourceState=BattleSourceState;
})(globalThis);
