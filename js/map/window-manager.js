(function(global){
  "use strict";
  class MapWindowManager{
    static for(root,family){
      if(root.mapWindowManager?.family===family)return root.mapWindowManager;
      root.mapWindowManager?.destroy();
      root.mapWindowManager=new MapWindowManager(root,family);
      return root.mapWindowManager;
    }
    constructor(root,family){this.root=root;this.family=family;this.container=root.querySelector("#map_visualization");this.entries=new Map();this.onResize=()=>this.clamp();window.addEventListener("resize",this.onResize);this.resizeObserver=typeof ResizeObserver==="function"?new ResizeObserver(()=>this.clamp()):null;this.resizeObserver?.observe(this.container);}
    register({id,title,icon="",content,element,position={},families=["gba","gb","gen2"]}){
      const available=families.includes(this.family);let created=false;
      if(!element){element=Dom.create("section",{className:"ui-window map-managed-window"});created=true;this.container.append(element);}
      element.dataset.windowId=id;element.dataset.windowTitle=title;element.classList.toggle("hide",!available);
      Object.assign(element.style,Object.fromEntries(Object.entries(position).map(([key,value])=>[key,typeof value==="number"?`${value}px`:value])));
      const windowInstance=UiWindow.enhance(element,{title,icon,closable:true});if(content)windowInstance.setContent(content);
      const entry={id,title,available,created,element,window:windowInstance};this.entries.set(id,entry);requestAnimationFrame(()=>this.clamp());this.root.editorHeader?.render();return entry;
    }
    enhance(selector=".window",families=["gba"]){this.root.querySelectorAll(selector).forEach(element=>{element.querySelector(":scope > .window_content")?.classList.remove("hide");this.register({id:element.dataset.windowTitle.toLowerCase().replace(/\s+/g,"-"),title:element.dataset.windowTitle,icon:element.dataset.windowIcon,element,families});});return this;}
    available(){return[...this.entries.values()].filter(entry=>entry.available);}
    titles(){return this.available().map(entry=>entry.title);}
    get(titleOrId){return[...this.entries.values()].find(entry=>entry.id===titleOrId||entry.title===titleOrId);}
    setContext(context){
      for(const entry of this.entries.values()){
        if(!entry.available)continue;
        const outsideMap=context!=="map";
        entry.element.toggleAttribute("hidden",outsideMap);
        entry.element.setAttribute("aria-hidden",String(outsideMap));
      }
      return this;
    }
    toggle(titleOrId){const entry=this.get(titleOrId);if(!entry?.available)return false;if(entry.element.classList.contains("hide"))entry.window.show();else entry.window.hide();return true;}
    reveal(titleOrId,{target=null,top=null,behavior="smooth"}={}){
      const entry=this.get(titleOrId);if(!entry?.available)return false;
      entry.window.show();entry.element.classList.remove("is-minimized");
      const content=entry.window.content;
      requestAnimationFrame(()=>{this.clamp();if(target?.scrollIntoView)target.scrollIntoView({block:"center",inline:"nearest",behavior});else if(Number.isFinite(top))content.scrollTo({top:Math.max(0,top-content.clientHeight/2),behavior});});
      return true;
    }
    clamp(){const bounds=this.container?.getBoundingClientRect();if(!bounds)return;for(const {element,available} of this.entries.values()){if(!available||element.hidden||element.classList.contains("hide"))continue;element.style.left=`${Math.max(8,Math.min(parseFloat(element.style.left)||8,bounds.width-element.offsetWidth-8))}px`;element.style.top=`${Math.max(8,Math.min(parseFloat(element.style.top)||8,bounds.height-element.offsetHeight-8))}px`;}}
    destroy(){window.removeEventListener("resize",this.onResize);this.resizeObserver?.disconnect();for(const entry of this.entries.values())if(entry.created)entry.element.remove();this.entries.clear();if(this.root.mapWindowManager===this)this.root.mapWindowManager=null;}
  }
  global.MapWindowManager=MapWindowManager;
  ((global.PokemonViewer ||= {}).maps ||= {}).WindowManager=MapWindowManager;
})(globalThis);
