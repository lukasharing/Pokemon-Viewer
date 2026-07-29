(function(global){
  "use strict";
  const ns=((global.PokemonViewer||={}).battle||={});
  class BattlePartyView{
    constructor({element,section,count,canPlayCry=()=>false,onSelect,onEdit}){
      Object.assign(this,{element,section,count,canPlayCry,onSelect,onEdit});
    }
    render(trainer,selected=0,{editable=false}={}){
      if(!trainer){
        this.section.hidden=true;this.count.textContent="0";this.element.replaceChildren();return;
      }
      this.section.hidden=false;this.count.textContent=String(trainer.party.length);
      const portrait=this.portrait(trainer);
      const rows=trainer.party.map((mon,index)=>this.member(mon,index,{selected:index===selected,editable}));
      this.element.replaceChildren(...[portrait,...(rows.length?rows:[Dom.create("p",{text:"No Pokémon were found in this trainer party."})])].filter(Boolean));
    }
    portrait(trainer){
      if(!trainer.sprite?.canvas)return null;
      const canvas=PixelCanvas.copy(trainer.sprite.canvas,{width:64,height:64,label:`${trainer.name} battle picture`});
      return Dom.create("figure",{className:"battle-trainer-portrait"},[canvas,Dom.create("figcaption",{text:trainer.name})]);
    }
    member(mon,index,{selected,editable}){
      const name=mon.speciesName||`Species ${mon.species}`,graphic=mon.icon?.canvas||mon.sprite?.canvas,size=mon.icon?.canvas?32:64;
      const sprite=graphic?PixelCanvas.copy(graphic,{width:size,height:size,className:`battle-mon-sprite${mon.icon?.canvas?" battle-mon-icon":""}`,label:`${name} native game icon`}):null;
      const actions=[
        Dom.create("button",{className:"ui-button",attributes:{type:"button",title:`Open ${name} in Pokédex`},events:{click:()=>EditorLinks.species(mon.species)}},[UiWindow.icon("fa-book-open"),Dom.create("span",{text:"Pokédex"})]),
        editable?Dom.create("button",{className:"ui-button",attributes:{type:"button",title:"Edit party member"},events:{click:()=>this.onEdit(mon,index)}},[UiWindow.icon("fa-pen"),Dom.create("span",{text:"Edit"})]):null,
        this.canPlayCry()?Dom.create("button",{className:"ui-button",attributes:{type:"button",title:"Open Pokémon cry"},events:{click:()=>EditorLinks.sound(mon.species)}},[UiWindow.icon("fa-volume-high"),Dom.create("span",{text:"Cry"})]):null
      ].filter(Boolean);
      return Dom.create("article",{className:`battle-mon${selected?" is-selected":""}`,attributes:{tabindex:"0",role:"button","aria-label":`Preview ${name}`},events:{
        click:event=>{if(!event.target.closest("button"))this.onSelect(index);},
        keydown:event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();this.onSelect(index);}}
      }},[
        sprite,Dom.create("strong",{text:`#${index+1} ${name} · Lv ${mon.level}`}),
        Dom.create("small",{text:mon.moves?.length?`Moves: ${mon.moves.join(", ")}`:"Default moves"}),
        Dom.create("div",{className:"battle-mon__actions"},actions)
      ].filter(Boolean));
    }
  }
  ns.BattlePartyView=BattlePartyView;
})(globalThis);
