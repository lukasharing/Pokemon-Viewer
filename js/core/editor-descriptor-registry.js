(function(global){
  "use strict";

  const REQUIRED_TEXT=["id","file","label","title","icon","instance"];

  class EditorDescriptorRegistry{
    constructor(descriptors=[]){
      this.descriptors=new Map();
      for(const descriptor of descriptors)this.register(descriptor);
    }

    register(value){
      if(!value||typeof value!=="object")throw new TypeError("Editor descriptor must be an object.");
      for(const key of REQUIRED_TEXT)if(typeof value[key]!=="string"||!value[key].trim())throw new TypeError(`Editor descriptor requires ${key}.`);
      if(!/^[a-z][a-z0-9_]*$/.test(value.id))throw new TypeError(`Invalid editor id '${value.id}'.`);
      if(!/\.html$/i.test(value.file))throw new TypeError(`Editor '${value.id}' requires an HTML fragment.`);
      if(this.descriptors.has(value.id))throw new Error(`Editor '${value.id}' is already registered.`);
      if(this.list().some(descriptor=>descriptor.instance===value.instance))throw new Error(`Editor instance '${value.instance}' is already registered.`);
      const families=Object.freeze(Array.from(new Set(value.families||[])));
      if(!families.length||families.some(family=>typeof family!=="string"||!family))throw new TypeError(`Editor '${value.id}' requires at least one ROM family.`);
      const help=value.help&&Object.freeze({file:String(value.help.file||""),extras:Object.freeze([...(value.help.extras||[])].map(item=>Object.freeze({...item})))});
      if(!help?.file||!/\.md$/i.test(help.file))throw new TypeError(`Editor '${value.id}' requires a Markdown help document.`);
      const refreshEvents=[...(value.refreshEvents||[])];
      if(refreshEvents.some(event=>typeof event!=="string"||!event))throw new TypeError(`Editor '${value.id}' has an invalid refresh event.`);
      const descriptor=Object.freeze({
        ...value,
        families,
        help,
        refreshEvents:Object.freeze(refreshEvents)
      });
      this.descriptors.set(descriptor.id,descriptor);
      return descriptor;
    }

    get(id){return this.descriptors.get(id)||null;}
    require(id){const descriptor=this.get(id);if(!descriptor)throw new Error(`Unknown editor '${id}'.`);return descriptor;}
    list(){return Object.freeze([...this.descriptors.values()]);}
    first(){return this.list()[0]||null;}
    files(){return Object.freeze(this.list().map(descriptor=>descriptor.file));}
    instance(project,id){const descriptor=this.require(id);return project?.[descriptor.instance]||null;}

    capture(id,project){
      const descriptor=this.require(id),value=descriptor.bookmark?.capture?.(project);
      return value&&typeof value==="object"?{...value}:{};
    }
    restore(id,project,target){return this.require(id).bookmark?.restore?.(project,target);}
    open(id,project,request={}){return this.require(id).open?.(project,request);}
    activate(id,project,options={}){return this.require(id).activate?.(project,options);}

    attachHeaders({menus={},composeMenus=(descriptor,items)=>items,Header=global.EditorHeader,root=global.document}={}){
      if(typeof Header?.attach!=="function")throw new Error("EditorHeader is not available.");
      for(const descriptor of this.list()){
        const element=root?.getElementById?.(descriptor.id);
        if(!element)throw new Error(`Editor fragment is missing #${descriptor.id}.`);
        const source=typeof menus[descriptor.id]==="function"?menus[descriptor.id](descriptor):menus[descriptor.id]||[];
        const header=Header.attach(element,{title:descriptor.title,menus:composeMenus(descriptor,[...source])});
        for(const event of descriptor.refreshEvents)element.addEventListener(event,()=>header.render());
      }
      return this;
    }

    renderNavigation(container,{onOpen,Dom=global.Dom}={}){
      if(!container)throw new Error("Navigation container is required.");
      const links=this.list().filter(descriptor=>descriptor.navigation!==false).map(descriptor=>{
        let link;
        link=Dom.create("a",{
          className:`icon-${descriptor.icon} disabled`,
          attributes:{href:"#","aria-disabled":"true",title:"Load a ROM to open this editor."},
          dataset:{workspace:descriptor.id,families:descriptor.families.join(",")},
          events:{click:event=>{event.preventDefault();onOpen?.(descriptor,link);}}
        },[
          Dom.create("span",{text:descriptor.title}),
          Dom.create("small",{className:"workspace-capability",text:""})
        ]);
        return link;
      });
      container.replaceChildren(Dom.fragment(links));
      return links;
    }

    resetNavigation(container){
      for(const link of container?.querySelectorAll?.("[data-workspace]")||[]){
        link.classList.add("disabled");link.classList.remove("is-partial");
        link.removeAttribute("data-capability");link.setAttribute("aria-disabled","true");
        link.title="Load a ROM to open this editor.";
        const badge=link.querySelector(".workspace-capability");if(badge)badge.textContent="";
      }
      return this;
    }

    updateNavigation(container,{family,workspaces,capabilities,platform="this game"}={}){
      for(const descriptor of this.list()){
        const link=container?.querySelector?.(`[data-workspace='${descriptor.id}']`);if(!link)continue;
        const capability=capabilities?.get?.(descriptor.id);
        const supported=descriptor.families.includes(family)&&(workspaces?.includes(descriptor.id)??true);
        link.classList.toggle("disabled",!supported);link.classList.toggle("is-partial",capability?.state==="partial");
        link.dataset.capability=capability?.state||"unavailable";link.setAttribute("aria-disabled",String(!supported));
        const badge=link.querySelector(".workspace-capability");if(badge)badge.textContent=capability?.label||"Unavailable";
        link.title=capability?.reason||`Not available for ${platform}.`;
      }
      return this;
    }
  }

  global.EditorDescriptorRegistry=EditorDescriptorRegistry;
})(globalThis);
