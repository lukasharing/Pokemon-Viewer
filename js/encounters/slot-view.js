(function(global){
  "use strict";
  const ns=((global.PokemonViewer||={}).encounters||={});
  class EncounterSlotView{
    constructor({element,driver,onEdit}){this.element=element;this.driver=driver;this.onEdit=onEdit;}
    render(document,rate,time){
      const slots=document.slots.filter(slot=>slot.time===time);
      this.element.replaceChildren(...slots.map(slot=>this.row(document,slot,rate)));
      return slots;
    }
    row(document,slot,rate){
      const battle=this.driver.battleLink?.(document,slot),probability=this.driver.probabilityLabel?.(slot)||`${slot.probability}%`;
      let canvas=PixelCanvas.create(56,56,{className:"encounter-slot__sprite"});
      try{
        const source=this.driver.icon?.(slot)||this.driver.sprite?.(slot);
        if(source?.canvas)PixelCanvas.draw(canvas,source.canvas);
        else canvas.hidden=true;
      }catch(error){canvas.hidden=true;}
      return Dom.create("article",{className:"encounter-slot",attributes:{role:"listitem"}},[
        canvas,
        Dom.create("button",{className:"encounter-slot__species",attributes:{type:"button",title:`Open ${slot.speciesName} in Pokédex`},events:{click:()=>EditorLinks.species(slot.species)}},[
          Dom.create("strong",{text:slot.speciesName}),Dom.create("small",{text:`#${slot.species}`})
        ]),
        Dom.create("div",{className:"encounter-slot__chance"},[
          Dom.create("meter",{attributes:{min:"0",max:"100",value:String(Math.max(0,Math.min(100,Number.parseFloat(probability)||0))),title:probability}}),
          Dom.create("span",{text:probability})
        ]),
        Dom.create("div",{className:"encounter-slot__level"},[
          Dom.create("small",{text:"Lv"}),Dom.create("strong",{text:this.driver.levelLabel?.(slot)||String(slot.level)})
        ]),
        Dom.create("div",{className:"encounter-slot__actions"},[
          battle?UiWindow.iconButton("Preview battle",{icon:"fa-shield-halved",size:"sm",onClick:()=>EditorLinks.open(battle)}):null,
          UiWindow.iconButton("Edit encounter",{icon:"fa-pen",size:"sm",onClick:()=>this.onEdit(slot,rate)})
        ].filter(Boolean))
      ]);
    }
  }
  ns.EncounterSlotView=EncounterSlotView;
})(globalThis);
