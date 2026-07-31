(function(global){
  "use strict";
  let sequence=0;
  class UiVirtualSelect{
    constructor(select,{placeholder="Choose an item",visibleRows=32,itemKey=item=>item.key,itemLabel=item=>item.label}={}){
      if(!select)throw new Error("UiVirtualSelect requires a native select.");
      this.select=select;this.itemKey=itemKey;this.itemLabel=itemLabel;this.items=[];this.filtered=[];this.visibleRows=visibleRows;this.activeIndex=-1;this.id=`ui-virtual-select-${++sequence}`;
      this.root=Dom.create("div",{className:"ui-virtual-select"});
      this.input=Dom.create("input",{className:"ui-virtual-select__search",attributes:{type:"search",placeholder,"aria-label":placeholder,"aria-autocomplete":"list","aria-expanded":"false"}});
      this.list=Dom.create("div",{className:"ui-virtual-select__list",attributes:{role:"listbox"}});
      select.classList.add("ui-virtual-select__native");select.before(this.root);this.root.append(this.input,this.list,select);
      this.input.addEventListener("focus",()=>{this.input.select();this.activeIndex=-1;this.open(true);});this.input.addEventListener("input",()=>{this.activeIndex=-1;this.filter();});
      this.input.addEventListener("keydown",event=>{
        if(event.key==="Escape"){this.close();return;}
        if(event.key==="ArrowDown"||event.key==="ArrowUp"){
          event.preventDefault();this.open();const direction=event.key==="ArrowDown"?1:-1;
          this.activeIndex=Math.max(0,Math.min(Math.min(this.visibleRows,this.filtered.length)-1,this.activeIndex+direction));this.renderOptions();return;
        }
        if(event.key==="Enter"&&this.root.classList.contains("is-open")){
          const item=this.filtered[this.activeIndex];if(item){event.preventDefault();this.choose(this.itemKey(item),this.itemLabel(item));}
        }
      });
      this.outside=event=>{if(!this.root.contains(event.target))this.close();};document.addEventListener("pointerdown",this.outside);
    }
    setItems(items,{preserve=true}={}){
      const selected=preserve?this.select.value:"",special=[...this.select.options].find(option=>option.value==="__encounter__"),selectedItem=this.items?.find?.(item=>String(this.itemKey(item))===selected);
      this.items=Array.from(items||[]);
      const nextSelected=this.items.find(item=>String(this.itemKey(item))===selected)||selectedItem;
      this.select.replaceChildren(Dom.create("option",{attributes:{value:""},text:"No trainer selected"}));
      if(special)this.select.append(special);
      if(nextSelected&&selected!=="__encounter__")this.select.append(Dom.create("option",{attributes:{value:selected},text:this.itemLabel(nextSelected)}));
      if(selected&&[...this.select.options].some(option=>option.value===selected))this.select.value=selected;
      this.filter();return this;
    }
    addSpecial(key,label){
      [...this.select.options].find(option=>option.value===String(key))?.remove();
      this.select.prepend(Dom.create("option",{attributes:{value:String(key)},text:label}));this.choose(String(key),label,false);
    }
    removeSpecial(key){[...this.select.options].find(option=>option.value===String(key))?.remove();}
    choose(key,label=null,emit=true){
      key=String(key);
      for(const option of [...this.select.options])if(option.value&&option.value!=="__encounter__"&&option.value!==key)option.remove();
      if(![...this.select.options].some(option=>option.value===key))this.select.append(Dom.create("option",{attributes:{value:key},text:label||key}));
      this.select.value=key;this.input.value=label??this.select.selectedOptions[0]?.textContent??"";this.close();
      if(emit)this.select.dispatchEvent(new Event("change",{bubbles:true}));return this;
    }
    open(showAll=false){this.root.classList.add("is-open");this.input.setAttribute("aria-expanded","true");this.filter(showAll);}
    close(){this.root.classList.remove("is-open");this.input.setAttribute("aria-expanded","false");}
    filter(showAll=false){
      const query=!showAll&&this.input===document.activeElement?this.input.value.trim().toLocaleLowerCase():"";
      this.filtered=query?this.items.filter(item=>this.itemLabel(item).toLocaleLowerCase().includes(query)):this.items;
      if(this.activeIndex>=this.filtered.length)this.activeIndex=this.filtered.length-1;this.renderOptions();
    }
    renderOptions(){
      const visible=this.filtered.slice(0,this.visibleRows);
      this.list.replaceChildren(...visible.map((item,index)=>{
        const key=String(this.itemKey(item)),id=`${this.id}-${index}`;return Dom.create("button",{className:`ui-virtual-select__option${index===this.activeIndex?" is-active":""}`,text:this.itemLabel(item),attributes:{id,type:"button",role:"option","aria-selected":String(this.select.value===key)},events:{pointermove:()=>{this.activeIndex=index;this.input.setAttribute("aria-activedescendant",id);},click:()=>this.choose(key,this.itemLabel(item))}});
      }),this.filtered.length>visible.length?Dom.create("p",{className:"ui-virtual-select__more",text:`${this.filtered.length-visible.length} more — type to filter`}):null);
      const active=this.list.querySelector(".is-active");if(active)this.input.setAttribute("aria-activedescendant",active.id);else this.input.removeAttribute("aria-activedescendant");
    }
    destroy(){document.removeEventListener("pointerdown",this.outside);this.select.classList.remove("ui-virtual-select__native");this.root.before(this.select);this.root.remove();}
  }
  global.UiVirtualSelect=UiVirtualSelect;
})(globalThis);
