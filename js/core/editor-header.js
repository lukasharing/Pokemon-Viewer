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
      this.menuBar=Dom.create("nav",{className:"editor-header__menus",attributes:{"aria-label":`${title} menu`}});
      this.status=Dom.create("span",{className:"editor-header__capability"});
      this.element.append(Dom.create("strong",{className:"editor-header__title",text:title}),this.status,this.menuBar);
      this.root.classList.add("has-editor-header");
      this.root.prepend(this.element);
      this.root.editorHeader=this;
      this.render();
      document.addEventListener("pointerdown",event=>{if(!this.element.contains(event.target))this.close();});
      this.element.addEventListener("keydown",event=>{if(event.key==="Escape"){this.close();this.element.querySelector(":focus")?.blur();}});
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
    }

    createMenu(item,depth) {
      if(item.separator) return Dom.create("li",{className:"editor-menu__separator",attributes:{role:"separator"}});
      const source=typeof item.children === "function" ? item.children() : item.children;
      const children=source?.filter(child=>this.isVisible(child));
      const entry=Dom.create(depth ? "li" : "div",{className:`editor-menu${depth ? " editor-menu--nested" : ""}`});
      const button=Dom.create("button",{
        className:"editor-menu__button",
        attributes:{type:"button",role:"menuitem",disabled:this.isDisabled(item) ? "" : null,"aria-haspopup":children?.length ? "menu" : null,"aria-expanded":children?.length ? "false" : null},
        events:{click:event=>this.activate(event,item,entry,children)}
      },[
        Dom.create("span",{className:"editor-menu__check",text:this.isChecked(item) ? "✓" : ""}),
        Dom.create("span",{className:"editor-menu__label",text:this.label(item)}),
        item.shortcut ? Dom.create("kbd",{text:item.shortcut}) : null,
        children?.length ? Dom.create("span",{className:"editor-menu__arrow",text:depth ? "›" : "⌄"}) : null
      ].filter(Boolean));
      entry.append(button);
      if(children?.length) entry.append(Dom.create("ul",{className:"editor-menu__list",attributes:{role:"menu"}},children.map(child=>this.createMenu(child,depth+1))));
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
        if(!entry.classList.contains("editor-menu--nested"))this.close();
        entry.classList.toggle("is-open",opening);
        entry.querySelector(":scope > button")?.setAttribute("aria-expanded",String(opening));
        return;
      }
      if(!this.isDisabled(item))item.action?.(item);
      this.close();
      this.render();
    }

    close() {
      this.element.querySelectorAll(".editor-menu.is-open").forEach(menu=>menu.classList.remove("is-open"));
      this.element.querySelectorAll("[aria-expanded='true']").forEach(button=>button.setAttribute("aria-expanded","false"));
    }
  }

  global.EditorHeader=EditorHeader;
})(globalThis);
