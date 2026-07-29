(function(global){
  "use strict";

  let nextId=0;
  class UiAccordion{
    constructor({title="Section",icon="",badge="",content=[],open=false,className=""}={}){
      const id=`ui-accordion-${++nextId}`;
      this.element=Dom.create("section",{className:`ui-accordion ${className}`.trim()});
      this.trigger=Dom.create("button",{className:"ui-accordion__trigger",attributes:{type:"button","aria-expanded":String(open),"aria-controls":`${id}-panel`,id:`${id}-trigger`}},[
        Dom.create("span",{className:"ui-accordion__heading"},[
          icon?UiWindow.icon(icon):null,
          Dom.create("strong",{text:title})
        ].filter(Boolean)),
        badge!==""?Dom.create("span",{className:"ui-accordion__badge",text:String(badge)}):null,
        UiWindow.icon("fa-chevron-down")
      ].filter(Boolean));
      this.panel=Dom.create("div",{className:"ui-accordion__panel",attributes:{id:`${id}-panel`,role:"region","aria-labelledby":`${id}-trigger`}},content);
      this.element.append(this.trigger,this.panel);
      this.trigger.addEventListener("click",()=>this.toggle());
      this.setOpen(open,{emit:false});
    }
    setOpen(open,{emit=true}={}){
      open=Boolean(open);this.element.classList.toggle("is-open",open);this.trigger.setAttribute("aria-expanded",String(open));this.panel.hidden=!open;
      if(emit)this.element.dispatchEvent(new CustomEvent("uiaccordiontoggle",{bubbles:true,detail:{accordion:this,open}}));
      return this;
    }
    open(){return this.setOpen(true);}
    close(){return this.setOpen(false);}
    toggle(){return this.setOpen(!this.element.classList.contains("is-open"));}
    reveal(target){
      this.open();target?.scrollIntoView?.({block:"nearest"});return this;
    }
    static group(definitions=[],{exclusive=true,label="Sections"}={}){
      const items=definitions.map(definition=>definition instanceof UiAccordion?definition:new UiAccordion(definition));
      const element=Dom.create("div",{className:"ui-accordion-group",attributes:{"aria-label":label}},items.map(item=>item.element));
      if(exclusive)element.addEventListener("uiaccordiontoggle",event=>{
        if(!event.detail.open)return;
        for(const item of items)if(item!==event.detail.accordion)item.setOpen(false,{emit:false});
      });
      return{element,items,open(index){items[index]?.open();return this;},closeAll(){items.forEach(item=>item.setOpen(false,{emit:false}));return this;}};
    }
  }

  global.UiAccordion=UiAccordion;
})(globalThis);
