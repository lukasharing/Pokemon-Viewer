(function(global){
  "use strict";
  class UiToolbar{
    static enhanceAll(root=document){return[...root.querySelectorAll("[data-ui-toolbar]")].map(element=>{element.classList.add("ui-toolbar","ui-toolbar--embedded");element.setAttribute("role","toolbar");element.setAttribute("aria-label",element.dataset.uiToolbar||"Actions");element.querySelectorAll(":scope > button, :scope > label.ui-button").forEach(button=>button.classList.add("ui-toolbar__tool"));return element;});}
    static mount(root,definitions=[]){
      if(typeof root==="string")root=document.querySelector(root);if(!root)return null;
      root.uiToolbars?.destroy?.();
      const bars=(definitions||[]).filter(Boolean).map(definition=>new UiToolbar(definition));
      const host=Dom.create("div",{className:"ui-toolbars"},bars.map(bar=>bar.element));
      const collection={host,bars,refresh(){bars.forEach(bar=>bar.refresh());return collection;},destroy(){host.remove();root.classList.remove("has-ui-toolbars");delete root.uiToolbars;}};
      if(bars.length){root.classList.add("has-ui-toolbars");root.style.setProperty("--ui-toolbar-count",bars.length);root.querySelector(":scope > .editor-header")?.after(host);}
      root.uiToolbars=collection;collection.refresh();return collection;
    }
    constructor({label="Tools",groups=[]}={}){
      this.element=Dom.create("div",{className:"ui-toolbar",attributes:{role:"toolbar","aria-label":label}});this.buttons=[];
      for(const [index,group] of groups.entries()){
        const groupElement=Dom.create("div",{className:"ui-toolbar__group",attributes:{role:"group","aria-label":group.label||`Tool group ${index+1}`}});
        for(const item of (group.items||[]).filter(item=>typeof item.visible==="function"?item.visible():item.visible!==false)){
          const button=UiWindow.button(item.label,{icon:item.icon,onClick:()=>{item.action?.();this.refresh();}});button.classList.add("ui-toolbar__tool");button.dataset.tool=item.id||"";button.title=item.hint||item.label;button._uiTool=item;groupElement.append(button);this.buttons.push(button);
        }
        this.element.append(groupElement);
      }
    }
    refresh(){for(const button of this.buttons){const item=button._uiTool,disabled=typeof item.disabled==="function"?item.disabled():Boolean(item.disabled),active=typeof item.active==="function"?item.active():Boolean(item.active);button.disabled=disabled;button.classList.toggle("is-active",active);if(item.toggle)button.setAttribute("aria-pressed",String(active));}return this;}
  }
  class UiPanelTabs{
    static mount(container,options={}){
      if(!container)throw new TypeError("UiPanelTabs.mount requires a container.");
      container.uiPanelTabs?.destroy?.();
      const tabs=new UiPanelTabs(options);
      tabs.container=container;
      container.classList.add("editor-tabbed-panels");
      container.prepend(tabs.element);
      container.uiPanelTabs=tabs;
      return tabs;
    }
    constructor({label="Panels",items=[],selected}={}){
      this.items=items.filter(Boolean);this.selected=selected||this.items[0]?.id;
      this.element=Dom.create("div",{className:"ui-panel-tabs",attributes:{role:"tablist","aria-label":label}});
      this.element.style.setProperty("--ui-panel-tab-count",String(Math.max(1,this.items.length)));
      for(const item of this.items){
        item.panel.classList.add("ui-panel-tabpanel");
        item.panel.id||=`ui-panel-${item.id}`;
        item.panel.setAttribute("role","tabpanel");
        const button=Dom.create("button",{className:"ui-panel-tabs__tab",attributes:{type:"button",role:"tab","aria-controls":item.panel.id,title:item.label,"data-complexity":item.complexity||undefined},events:{click:()=>this.select(item.id),keydown:event=>this.onKeydown(event,item)}},[UiWindow.icon(item.icon),Dom.create("span",{text:item.label}),item.badge||null].filter(Boolean));
        button.id=`${item.panel.id}-tab`;item.panel.setAttribute("aria-labelledby",button.id);
        item.button=button;this.element.append(button);
      }
      this.select(this.selected,{focus:false});
    }
    onKeydown(event,item){
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      const enabled=this.items.filter(entry=>!entry.disabled);if(!enabled.length)return;
      const current=Math.max(0,enabled.indexOf(item));
      const index=event.key==="Home"?0:event.key==="End"?enabled.length-1:(current+(event.key==="ArrowRight"?1:-1)+enabled.length)%enabled.length;
      event.preventDefault();this.select(enabled[index].id);
    }
    select(id,{focus=true}={}){
      const target=this.items.find(item=>item.id===id&&!item.disabled);if(!target)return false;
      this.selected=id;
      for(const item of this.items){const active=item===target;item.panel.hidden=!active;item.button.classList.toggle("is-active",active);item.button.setAttribute("aria-selected",String(active));item.button.tabIndex=active?0:-1;}
      if(focus)target.button.focus();return true;
    }
    setDisabled(id,disabled=true){const item=this.items.find(entry=>entry.id===id);if(!item)return this;item.disabled=Boolean(disabled);item.button.disabled=item.disabled;item.button.hidden=item.disabled;if(item.disabled&&this.selected===id)this.select(this.items.find(entry=>!entry.disabled)?.id,{focus:false});return this;}
    destroy(){
      for(const item of this.items){item.panel.hidden=false;item.panel.classList.remove("ui-panel-tabpanel");item.panel.removeAttribute("role");item.panel.removeAttribute("aria-labelledby");}
      this.element.remove();
      if(this.container){this.container.classList.remove("editor-tabbed-panels");delete this.container.uiPanelTabs;}
    }
  }
  class UiToolFlyout{
    constructor(tool,{items=[],onSelect}={}){
      this.tool=tool;this.items=items;this.onSelect=onSelect;tool.classList.toggle("ui-tool--has-flyout",items.length>1);tool.setAttribute("aria-haspopup",items.length>1?"menu":"false");
      if(items.length>1)tool.addEventListener("contextmenu",event=>{event.preventDefault();this.open();});
    }
    open(){
      this.close();const bounds=this.tool.getBoundingClientRect(),spaceRight=innerWidth-bounds.right,openLeft=spaceRight<180;
      this.menu=Dom.create("div",{className:`ui-tool-flyout${openLeft?" opens-left":""}`,attributes:{role:"menu","aria-label":this.tool.getAttribute("aria-label")||"Tool states"}},this.items.map(item=>Dom.create("button",{className:item.active?"is-active":"",attributes:{type:"button",role:"menuitem",title:item.label},events:{click:()=>{this.onSelect?.(item);this.close();}}},[item.icon?UiWindow.icon(item.icon):null,Dom.create("span",{text:item.label})].filter(Boolean))));
      document.body.append(this.menu);const menuBounds=this.menu.getBoundingClientRect(),left=openLeft?bounds.left-menuBounds.width-6:bounds.right+6,top=Math.max(8,Math.min(innerHeight-menuBounds.height-8,bounds.top));Object.assign(this.menu.style,{left:`${Math.max(8,left)}px`,top:`${top}px`});
      this.outside=event=>{if(!this.menu?.contains(event.target)&&event.target!==this.tool)this.close();};queueMicrotask(()=>document.addEventListener("pointerdown",this.outside,{once:true}));return this;
    }
    close(){this.menu?.remove();this.menu=null;return this;}
  }
  class UiWindow {
    static iconNames=Object.freeze({"+":"fa-plus","−":"fa-minus","□":"fa-expand","×":"fa-xmark","↔":"fa-up-down-left-right","⇄":"fa-right-left","✎":"fa-pen","↪":"fa-right-to-bracket","⚔":"fa-shield-halved","▧":"fa-image","⌫":"fa-trash-can","⌘":"fa-code","T":"fa-font","↗":"fa-arrow-up-right-from-square","◆":"fa-diamond","▦":"fa-table-cells"});
    static actionIcons=Object.freeze([[/\b(sprite|graphic|image)\b/,"fa-image"],[/\b(open|browse|load)\b.*\b(rom|file|description|text)\b|^open /,"fa-folder-open"],[/\bsettings?\b/,"fa-gear"],[/\b(edit|properties)\b/,"fa-pen"],[/\b(delete|remove)\b/,"fa-trash-can"],[/\b(apply|confirm|save)\b/,"fa-check"],[/\b(revert|undo)\b/,"fa-rotate-left"],[/\bredo\b/,"fa-rotate-right"],[/\b(render|tiles?)\b/,"fa-wand-magic-sparkles"],[/\b(disassemble|code|script)\b/,"fa-code"],[/\b(cry|sound|audio)\b/,"fa-volume-high"],[/\bplay\b/,"fa-play"],[/\bpause\b/,"fa-pause"],[/\b(prev|previous)\b/,"fa-backward-step"],[/\bnext\b/,"fa-forward-step"],[/\bconnections?\b/,"fa-link"],[/\b(resize|fullscreen|focus)\b/,"fa-expand"],[/\b(cancel|close)\b/,"fa-xmark"],[/\b(new|add)\b/,"fa-plus"],[/\b(find|search)\b/,"fa-magnifying-glass"],[/\bbookmark\b/,"fa-bookmark"]]);
    static icon(icon,{style="solid"}={}) { const name=this.iconNames[icon]||icon;return Dom.create("i",{className:`fa-${style} ${name.startsWith("fa-")?name:"fa-circle"} ui-icon`,attributes:{"aria-hidden":"true"}}); }
    static iconFor(label="",id="") { const text=`${id} ${label}`.toLowerCase();return this.actionIcons.find(([pattern])=>pattern.test(text))?.[1]||""; }
    static decorateButtons(root=document) { root.querySelectorAll?.("button, label.ui-button").forEach(button=>{
      if(button.classList.contains("ui-button")&&!["ui-button--sm","ui-button--md","ui-button--lg"].some(name=>button.classList.contains(name)))button.classList.add(button.classList.contains("ui-button--compact")?"ui-button--sm":"ui-button--md");
      if(button.classList.contains("ui-icon-button"))button.classList.add("ui-button","ui-button--sm","ui-button--icon");
      if(button.dataset.iconEnhanced||button.querySelector("i,svg,.ui-icon")||button.classList.contains("map_tool"))return;
      const label=(button.getAttribute("aria-label")||button.title||button.textContent||"").trim(),icon=this.iconFor(label,button.id);if(!icon)return;button.prepend(this.icon(icon));button.dataset.iconEnhanced="true";
    });return root; }
    static enhance(element, options={}) {
      if(element.uiWindow) return element.uiWindow;
      return new UiWindow({...options,element});
    }
    static enhanceAll(root=document){return[...root.querySelectorAll("[data-ui-window]")].map(element=>UiWindow.enhance(element,{title:element.dataset.uiWindow||"Panel",icon:element.dataset.uiWindowIcon||"",docked:true,minimizable:element.dataset.uiWindowMinimizable!=="false",maximizable:element.dataset.uiWindowMaximizable==="true",closable:element.dataset.uiWindowClosable==="true"}));}
    static button(label,{icon="",onClick,className="",size="md",title="",disabled=false}={}) {
      const spriteAction=/\b(sprite|graphic|image)\b/i.test(label),resolvedIcon=spriteAction?"fa-image":icon||this.iconFor(label),button=Dom.create("button",{className:`ui-button ui-button--${size} ${spriteAction?"ui-button--edit-sprite":""} ${className}`.trim(),attributes:{type:"button","aria-label":label||undefined,title:title||undefined},events:{click:onClick}},[resolvedIcon?this.icon(resolvedIcon):null,label?Dom.create("span",{text:label}):null].filter(Boolean));
      button.disabled=Boolean(disabled);return button;
    }
    static iconButton(label,{icon="",onClick,className="",size="sm",title="",disabled=false}={}) {
      const button=this.button("",{icon:icon||this.iconFor(label),onClick,className:`ui-button--icon ${className}`.trim(),size,title:title||label,disabled});
      button.setAttribute("aria-label",label);return button;
    }
    static checkbox(label,{checked=false,onChange}={}) { const input=Dom.create("input",{attributes:{type:"checkbox"}});input.checked=checked;input.addEventListener("change",()=>onChange?.(input.checked));return Dom.create("label",{className:"ui-checkbox"},[input,Dom.create("span",{text:label})]); }
    static key(key,description) { return Dom.create("span",{className:"ui-key"},[Dom.create("span",{className:"ui-key__label",text:key}),description?UiWindow.info(description):null].filter(Boolean)); }
    static complexityAttributes(key,complexity={}){
      const explicit=complexity[key];
      const inferred=/\b(offset|pointer|address|bytes?|bank|opcode|instruction|architecture|header|layout|record|checksum|raw|mask|bitfield)\b/i.test(key)?"advanced":"";
      return explicit||inferred?{"data-complexity":explicit||inferred}:{};
    }
    static properties(values={},descriptions={},complexity={}) { return Dom.create("dl",{className:"ui-properties"},Object.entries(values).flatMap(([key,value])=>{const attributes=UiWindow.complexityAttributes(key,complexity);return[Dom.create("dt",{attributes},UiWindow.key(key,descriptions[key])),Dom.create("dd",{text:String(value),attributes})];})); }
    static table(values={},descriptions={},{columns=1,layout=[],complexity={}}={}) {
      const entries=new Map(Object.entries(values)),ordered=[];
      for(const group of layout){
        const keys=(Array.isArray(group)?group:[group]).filter(key=>entries.has(key));
        for(const key of keys){ordered.push({key,value:entries.get(key),span:Array.isArray(group)?1:columns});entries.delete(key);}
      }
      for(const [key,value] of entries)ordered.push({key,value,span:columns});
      return Dom.create("table",{className:`ui-table${columns===2?" ui-table--two":""}`},Dom.create("tbody",{},ordered.map(({key,value,span})=>Dom.create("tr",{className:span>1?"ui-table__wide":"",attributes:{"data-span":String(span),...UiWindow.complexityAttributes(key,complexity)}},[Dom.create("th",{attributes:{scope:"row"}},UiWindow.key(key,descriptions[key])),Dom.create("td",{text:String(value)})]))));
    }
    static info(text) { return Dom.create("button",{className:"ui-info",text:"i",attributes:{type:"button","aria-label":`Information: ${text}`,"data-tooltip":text,title:text}}); }
    static tabs(items,onSelect) { const bar=Dom.create("div",{className:"ui-tabs",attributes:{role:"tablist"}});items.forEach((item,index)=>bar.append(Dom.create("button",{className:index===0?"active":"",text:item.label,attributes:{type:"button",role:"tab","aria-selected":String(index===0)},dataset:{tab:item.id},events:{click:(event)=>{bar.querySelectorAll("button").forEach(button=>{const active=button===event.currentTarget;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});onSelect?.(item.id);}}})));return bar; }
    constructor({element,title="Window",icon="",minimizable=true,maximizable=true,closable=true,docked=false,onClose}={}) {
      this.element=element || Dom.create("section",{className:"ui-window"});
      this.closable=Boolean(closable);
      this.element.classList.add("ui-window");this.element.classList.toggle("ui-window--docked",docked);this.element.classList.remove("window");this.element.uiWindow=this;
      const oldHeader=this.element.querySelector(":scope > .window_menu, :scope > .ui-window__header, :scope > [data-ui-window-header]");
      const oldTitle=oldHeader?.querySelector(":scope > [data-ui-window-title], :scope > .ui-window__title, :scope > strong, :scope > h1, :scope > h2, :scope > h3, :scope > h4");
      const headerExtras=oldHeader?[...oldHeader.children].filter(child=>child!==oldTitle&&!child.matches(".ui-window__icon, .ui-window__controls")):[];
      this.content=this.element.querySelector(":scope > .window_content, :scope > .ui-window__content, :scope > [data-ui-window-content]") || Dom.create("div");
      this.content.classList.add("ui-window__content");this.content.classList.remove("window_content");
      this.footer=this.element.querySelector(":scope > .ui-window__footer, :scope > [data-ui-window-footer]") || Dom.create("footer",{className:"ui-window__footer hide"});
      this.footer.classList.add("ui-window__footer");if(this.footer.hasAttribute("data-ui-window-footer"))this.footer.classList.remove("hide");
      const retained=[...this.element.children].filter(child=>child!==oldHeader&&child!==this.content&&child!==this.footer);
      if(retained.length)this.content.append(...retained);
      const titleId=oldTitle?.id||oldHeader?.id;
      this.header=Dom.create("header",{className:"ui-window__header"},[Dom.create("span",{className:"ui-window__icon"},icon?[UiWindow.icon(icon)]:[]),Dom.create("strong",{className:"ui-window__title",text:title,attributes:{id:titleId||null}}),...headerExtras,Dom.create("div",{className:"ui-window__controls"})]);
      const controls=this.header.querySelector(".ui-window__controls");
      if(minimizable)controls.append(this.control("−","Minimize",()=>this.toggleMinimize()));
      if(maximizable)controls.append(this.control("□","Maximize",()=>this.toggleMaximize()));
      if(closable)controls.append(this.control("×","Close",()=>{this.hide();onClose?.();}));
      oldHeader?.remove();this.element.replaceChildren(this.header,this.content,this.footer);this.removeRedundantCloseActions();if(!docked)this.bindDrag();
    }
    control(text,label,handler){return Dom.create("button",{attributes:{type:"button","aria-label":label,title:label},events:{click:(event)=>{event.stopPropagation();handler();}}},[UiWindow.icon(text),Dom.create("span",{className:"sr-only",text:label})]);}
    setTitle(title){this.header.querySelector(".ui-window__title").textContent=title;return this;}
    isCloseAction(element){
      if(!(element instanceof HTMLElement))return false;
      const label=(element.getAttribute("aria-label")||element.textContent||"").trim().replace(/^[×✕✖\s]+/,"").trim().toLowerCase();
      return element.dataset.windowAction==="close"||label==="close"||label==="cerrar";
    }
    removeRedundantCloseActions(){
      if(!this.closable)return this;
      for(const action of this.element.querySelectorAll(".ui-window__content button, .ui-window__footer button, .ui-window__content .ui-button, .ui-window__footer .ui-button"))if(this.isCloseAction(action))action.remove();
      this.footer.classList.toggle("hide",!this.footer.childElementCount&&!this.footer.textContent.trim());
      return this;
    }
    setContent(content){this.content.replaceChildren(...(Array.isArray(content)?content:[content]));return this.removeRedundantCloseActions();}
    setFooter(content){this.footer.replaceChildren(...(Array.isArray(content)?content:[content]));this.footer.classList.toggle("hide",!content);return this.removeRedundantCloseActions();}
    notify(action){this.element.dispatchEvent(new CustomEvent("uiwindowchange",{bubbles:true,detail:{action,window:this}}));return this;}
    toggleMinimize(){this.element.classList.toggle("is-minimized");return this.notify("minimize");}
    toggleMaximize(){this.element.classList.toggle("is-maximized");return this.notify("maximize");}
    show(){this.element.classList.remove("hide");return this.notify("show");}
    hide(){this.element.classList.add("hide");return this.notify("hide");}
    bindDrag(){this.header.addEventListener("pointerdown",event=>{if(event.target.closest("button")||this.element.classList.contains("is-maximized"))return;const parent=this.element.offsetParent,bounds=this.element.getBoundingClientRect(),pb=parent.getBoundingClientRect(),origin={x:event.clientX,y:event.clientY,left:bounds.left-pb.left,top:bounds.top-pb.top};this.header.setPointerCapture(event.pointerId);const move=next=>{this.element.style.left=`${Math.max(0,Math.min(pb.width-bounds.width,origin.left+next.clientX-origin.x))}px`;this.element.style.top=`${Math.max(0,Math.min(pb.height-bounds.height,origin.top+next.clientY-origin.y))}px`;};const stop=()=>{this.header.removeEventListener("pointermove",move);this.header.removeEventListener("pointerup",stop);};this.header.addEventListener("pointermove",move);this.header.addEventListener("pointerup",stop);});}
  }
  class UiTable {
    constructor({columns=[],rows=[],sortable=false,label="Data table",initialSort=null,className=""}={}){
      this.columns=columns;this.rows=rows;this.sortable=sortable;this.sort=initialSort;this.element=Dom.create("table",{className:`ui-data-table ${className}`.trim(),attributes:{"aria-label":label}});
      this.head=Dom.create("thead");this.body=Dom.create("tbody");this.element.append(this.head,this.body);this.renderHead();this.render();
    }
    canSort(column){return Boolean(this.sortable&&column.sortable!==false);}
    renderHead(){
      this.head.replaceChildren(Dom.create("tr",{},this.columns.map(column=>{
        const sortable=this.canSort(column),active=this.sort?.id===column.id;
        const content=sortable
          ?Dom.create("button",{className:"ui-data-table__sort",attributes:{type:"button","aria-label":`Sort by ${column.label}`},events:{click:()=>this.toggleSort(column.id)}},[Dom.create("span",{text:column.label}),UiWindow.icon("fa-sort")])
          :Dom.create("span",{text:column.label});
        return Dom.create("th",{className:column.align?`is-${column.align}`:"",attributes:{scope:"col","aria-sort":sortable?(active?(this.sort.direction==="asc"?"ascending":"descending"):"none"):undefined}},[content]);
      })));
    }
    toggleSort(id){
      this.sort=this.sort?.id===id?{id,direction:this.sort.direction==="asc"?"desc":"asc"}:{id,direction:"asc"};
      this.renderHead();this.render();
    }
    orderedRows(){
      if(!this.sort)return this.rows;
      const column=this.columns.find(item=>item.id===this.sort.id);if(!column)return this.rows;
      const value=row=>column.sortValue?column.sortValue(row):row[column.id],direction=this.sort.direction==="asc"?1:-1;
      return this.rows.map((row,index)=>({row,index})).sort((left,right)=>{
        const a=value(left.row),b=value(right.row),result=typeof a==="number"&&typeof b==="number"?a-b:String(a??"").localeCompare(String(b??""),undefined,{numeric:true,sensitivity:"base"});
        return(result||left.index-right.index)*direction;
      }).map(item=>item.row);
    }
    render(){
      this.body.replaceChildren(...this.orderedRows().map(row=>Dom.create("tr",{},this.columns.map(column=>{
        const value=column.render?column.render(row):row[column.id],children=value instanceof Node?[value]:Array.isArray(value)?value:[Dom.create("span",{text:String(value??"")})];
        return Dom.create("td",{className:column.align?`is-${column.align}`:""},children);
      }))));
      for(const [index,column] of this.columns.entries()){
        const button=this.head.querySelector(`th:nth-child(${index+1}) button`);if(!button)continue;
        const active=this.sort?.id===column.id;button.classList.toggle("is-active",active);
        const icon=button.querySelector("i");if(icon)icon.className=`fa-solid ${active?(this.sort.direction==="asc"?"fa-sort-up":"fa-sort-down"):"fa-sort"} ui-icon`;
      }
      return this;
    }
    setRows(rows=[]){this.rows=rows;return this.render();}
  }
  global.UiToolbar=UiToolbar;global.UiPanelTabs=UiPanelTabs;global.UiToolFlyout=UiToolFlyout;global.UiWindow=UiWindow;global.UiTable=UiTable;
})(globalThis);
