(function(global){
  "use strict";

  class EditorHeader {
    static attach(root, options={}) {
      if(typeof root === "string") root=document.querySelector(root);
      if(!root) return null;
      if(root.editorHeader) return root.editorHeader;
      return new EditorHeader(root,options);
    }

    constructor(root,{title="Editor",menus=[]}={}) {
      this.root=root;
      this.title=title;
      this.menus=menus;
      this.element=Dom.create("header",{className:"editor-header"});
      this.menuBar=Dom.create("nav",{className:"editor-header__menus",attributes:{role:"menubar","aria-label":`${title} menu`}});
      this.status=Dom.create("span",{className:"editor-header__capability"});
      this.element.append(Dom.create("strong",{className:"editor-header__title",text:title}),this.status,this.menuBar);
      this.root.classList.add("has-editor-header");
      this.root.prepend(this.element);
      this.root.editorHeader=this;
      this.render();
      document.addEventListener("pointerdown",event=>{if(!this.element.contains(event.target))this.close();});
      for(const event of ["editorpreferencechange","editorhistorychange","editorpendingchange"]){
        document.addEventListener(event,()=>this.render());
      }
    }

    setMenus(menus=[]) { this.menus=menus;this.render();return this; }

    render() {
      const capability=globalThis.RomEditor?.capabilities?.get?.(this.root.id);
      this.status.textContent=capability?.label||"";
      this.status.dataset.state=capability?.state||"";
      const provenance=globalThis.RomEditor?.capabilities?.provenance;
      const resources=capability?.resources?.length?` Resources: ${capability.resources.map(resource=>`${resource.id} (${resource.coverage})`).join(", ")}.`:"";
      const source=provenance?.repository?` Source: ${provenance.repository}${provenance.commit?` @ ${provenance.commit}`:" (commit not pinned)"}.${resources}`:"";
      this.status.title=capability?`${capability.reason}${source}`:"";
      this.menuBar.replaceChildren(...this.menus.filter(menu=>this.isVisible(menu)).map(menu=>this.createMenu(menu,0)));
      const first=this.topEntries().find(entry=>!this.directButton(entry)?.disabled);
      for(const entry of this.topEntries())this.directButton(entry).tabIndex=entry===first?0:-1;
    }

    createMenu(item,depth) {
      if(item.separator) return Dom.create("li",{className:"editor-menu__separator",attributes:{role:"separator"}});
      const source=typeof item.children === "function" ? item.children() : item.children;
      const children=source?.filter(child=>this.isVisible(child));
      const entry=Dom.create(depth ? "li" : "div",{className:`editor-menu${depth ? " editor-menu--nested" : ""}`});
      const button=Dom.create("button",{
        className:"editor-menu__button",
        attributes:{type:"button",role:"menuitem",disabled:this.isDisabled(item) ? "" : null,"aria-haspopup":children?.length ? "menu" : null,"aria-expanded":children?.length ? "false" : null},
        events:{click:event=>this.activate(event,item,entry,children),keydown:event=>this.onKeydown(event,item,entry,children)}
      },[
        Dom.create("span",{className:"editor-menu__check",text:this.isChecked(item) ? "✓" : ""}),
        Dom.create("span",{className:"editor-menu__label",text:this.label(item)}),
        item.shortcut ? Dom.create("kbd",{text:item.shortcut}) : null,
        children?.length ? Dom.create("span",{className:"editor-menu__arrow",text:depth ? "›" : "⌄"}) : null
      ].filter(Boolean));
      entry.append(button);
      if(children?.length) entry.append(Dom.create("ul",{className:"editor-menu__list",attributes:{role:"menu","aria-label":this.label(item)}},children.map(child=>this.createMenu(child,depth+1))));
      entry._editorMenuDepth=depth;
      entry._editorMenuItem=item;
      return entry;
    }

    isChecked(item) { return Boolean(typeof item.checked === "function" ? item.checked() : item.checked); }
    isDisabled(item) { return Boolean(typeof item.disabled === "function" ? item.disabled() : item.disabled); }
    label(item) { return String(typeof item.label==="function"?item.label():item.label||""); }
    isVisible(item) {
      const available=typeof item.visible==="function"?item.visible():item.visible!==false;
      return available&&(item.complexity!=="advanced"||globalThis.editorPreferences?.experience==="nerd");
    }

    activate(event,item,entry,children) {
      event.stopPropagation();
      if(children?.length){
        const opening=!entry.classList.contains("is-open");
        opening?this.open(entry):this.closeEntry(entry);
        return;
      }
      if(!this.isDisabled(item))item.action?.(item);
      this.close();
      this.render();
    }

    directButton(entry){return [...entry.children].find(child=>child.matches("button"));}
    childEntries(entry){const list=entry&&[...entry.children].find(child=>child.classList.contains("editor-menu__list"));return list?[...list.children].filter(child=>child.classList.contains("editor-menu")):[];}
    topEntries(){return [...this.menuBar.children].filter(child=>child.classList.contains("editor-menu"));}
    enabled(entries){return entries.filter(entry=>!this.directButton(entry)?.disabled);}
    parentEntry(entry){return entry.parentElement?.closest?.(".editor-menu")||null;}

    focusEntry(entry){
      const button=entry&&this.directButton(entry);if(!button||button.disabled)return false;
      if(entry._editorMenuDepth===0)for(const candidate of this.topEntries())this.directButton(candidate).tabIndex=candidate===entry?0:-1;
      button.focus();return true;
    }

    closeEntry(entry){
      for(const open of entry.querySelectorAll(".editor-menu.is-open")){open.classList.remove("is-open");this.directButton(open)?.setAttribute("aria-expanded","false");}
      entry.classList.remove("is-open");this.directButton(entry)?.setAttribute("aria-expanded","false");return this;
    }

    open(entry,{focus}={}){
      if(entry._editorMenuDepth===0){this.close();this.openTrigger=this.directButton(entry);}
      else for(const sibling of this.childEntries(this.parentEntry(entry)))if(sibling!==entry)this.closeEntry(sibling);
      entry.classList.add("is-open");this.directButton(entry)?.setAttribute("aria-expanded","true");
      if(focus){const children=this.enabled(this.childEntries(entry));this.focusEntry(focus==="last"?children.at(-1):children[0]);}
      return this;
    }

    move(entries,current,delta,{open=false}={}){
      const enabled=this.enabled(entries);if(!enabled.length)return;
      const currentIndex=Math.max(0,enabled.indexOf(current)),target=enabled[(currentIndex+delta+enabled.length)%enabled.length];
      this.focusEntry(target);if(open)this.open(target,{focus:"first"});
    }

    typeahead(entries,current,event){
      if(event.key.length!==1||/\s/.test(event.key)||event.altKey||event.ctrlKey||event.metaKey)return false;
      clearTimeout(this.typeaheadTimer);this.typeaheadBuffer=(this.typeaheadBuffer||"")+event.key.toLocaleLowerCase();
      const enabled=this.enabled(entries),start=Math.max(0,enabled.indexOf(current));
      const match=[...enabled.slice(start+1),...enabled.slice(0,start+1)].find(entry=>this.label(entry._editorMenuItem).toLocaleLowerCase().startsWith(this.typeaheadBuffer));
      if(match)this.focusEntry(match);
      this.typeaheadTimer=setTimeout(()=>this.typeaheadBuffer="",500);return true;
    }

    onKeydown(event,item,entry,children){
      const key=event.key,top=entry._editorMenuDepth===0,hasChildren=Boolean(children?.length);
      const entries=top?this.topEntries():this.childEntries(this.parentEntry(entry));
      if(key==="Tab"){this.close();return;}
      if(key==="Escape"){
        event.preventDefault();const trigger=this.openTrigger||this.directButton(this.topEntries().find(candidate=>candidate.classList.contains("is-open")));
        this.close();trigger?.focus();return;
      }
      if(top&&["ArrowLeft","ArrowRight","Home","End"].includes(key)){
        event.preventDefault();const wasOpen=entry.classList.contains("is-open");
        if(key==="Home"||key==="End"){const enabled=this.enabled(entries),target=key==="Home"?enabled[0]:enabled.at(-1);this.focusEntry(target);if(wasOpen)this.open(target,{focus:"first"});}
        else this.move(entries,entry,key==="ArrowRight"?1:-1,{open:wasOpen});
        return;
      }
      if(top&&(key==="ArrowDown"||key==="ArrowUp")){event.preventDefault();if(hasChildren)this.open(entry,{focus:key==="ArrowUp"?"last":"first"});return;}
      if(!top&&["ArrowUp","ArrowDown","Home","End"].includes(key)){
        event.preventDefault();if(key==="Home"||key==="End"){const enabled=this.enabled(entries);this.focusEntry(key==="Home"?enabled[0]:enabled.at(-1));}
        else this.move(entries,entry,key==="ArrowDown"?1:-1);return;
      }
      if(!top&&key==="ArrowRight"){
        event.preventDefault();if(hasChildren)this.open(entry,{focus:"first"});else{const owner=this.topEntries().find(candidate=>candidate.classList.contains("is-open"));if(owner)this.move(this.topEntries(),owner,1,{open:true});}return;
      }
      if(!top&&key==="ArrowLeft"){
        event.preventDefault();const parent=this.parentEntry(entry);
        if(parent?._editorMenuDepth>0){this.closeEntry(parent);this.focusEntry(parent);}
        else if(parent)this.move(this.topEntries(),parent,-1,{open:true});return;
      }
      if(key==="Enter"||key===" "){
        event.preventDefault();if(hasChildren)this.open(entry,{focus:"first"});else this.activate(event,item,entry,children);return;
      }
      if(this.typeahead(entries,entry,event))event.preventDefault();
    }

    close() {
      for(const menu of this.element.querySelectorAll(".editor-menu.is-open"))this.closeEntry(menu);
      this.openTrigger=null;
    }
  }

  global.EditorHeader=EditorHeader;
})(globalThis);
