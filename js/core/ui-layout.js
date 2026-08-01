(function(global){
  "use strict";

  let panelSequence=0;

  const directChild=(element,predicate)=>[...element.children].find(predicate)||null;
  const hasClass=(element,name)=>element.classList?.contains(name);
  const hasAttribute=(element,name)=>element.hasAttribute?.(name);
  const titleChild=header=>directChild(header,child=>["STRONG","H1","H2","H3","H4"].includes(child.tagName));
  const normalizedRatio=value=>{
    const ratio=typeof value==="string"&&value.trim().endsWith("%")
      ?Number.parseFloat(value)/100
      :Number(value);
    if(!Number.isFinite(ratio))throw new TypeError(`Split size '${value}' is not a finite ratio.`);
    return ratio;
  };
  const percent=value=>`${Number((value*100).toFixed(3))}%`;

  /**
   * Persistent editor information or controls. Unlike UiWindow, a UiPanel
   * remains in document flow and gives its body sole ownership of scrolling.
   */
  class UiPanel{
    static enhance(element,options={}){
      if(element.uiPanel)return element.uiPanel;
      return new UiPanel({...options,element});
    }
    static enhanceAll(root=document){
      return [...root.querySelectorAll("[data-ui-panel]")].map(element=>UiPanel.enhance(element,{
        title:element.dataset.uiPanel||"",
        icon:element.dataset.uiPanelIcon||"",
        orientation:element.dataset.uiPanelOrientation||"horizontal",
        collapsible:element.dataset.uiPanelCollapsible==="true",
        collapsed:element.dataset.uiPanelCollapsed==="true"
      }));
    }
    constructor({element,title="",icon="",orientation="horizontal",collapsible=false,collapsed=false}={}){
      this.element=element||Dom.create("section");
      if(this.element.uiPanel)return this.element.uiPanel;
      this.element.uiPanel=this;
      this.element.classList.add("ui-panel");
      this.element.classList.toggle("ui-panel--vertical",orientation==="vertical");
      this.element.dataset.uiOverflow="contained";

      const children=[...this.element.children];
      this.header=children.find(child=>hasClass(child,"ui-panel__header")||hasAttribute(child,"data-ui-panel-header"))
        ||Dom.create("header",{className:"ui-panel__header"});
      this.body=children.find(child=>hasClass(child,"ui-panel__body")||hasAttribute(child,"data-ui-panel-body"))
        ||Dom.create("div",{className:"ui-panel__body"});
      this.footer=children.find(child=>hasClass(child,"ui-panel__footer")||hasAttribute(child,"data-ui-panel-footer"))
        ||Dom.create("footer",{className:"ui-panel__footer"});

      this.header.classList.add("ui-panel__header");
      this.body.classList.add("ui-panel__body");
      this.footer.classList.add("ui-panel__footer");
      this.body.dataset.uiScrollOwner="panel-body";
      this.body.tabIndex=this.body.hasAttribute("tabindex")?this.body.tabIndex:0;

      const retained=children.filter(child=>child!==this.header&&child!==this.body&&child!==this.footer);
      if(retained.length)this.body.append(...retained);

      this.titleElement=titleChild(this.header);
      const resolvedTitle=title||this.titleElement?.textContent?.trim()||"Panel";
      this.title=resolvedTitle;
      if(!this.titleElement){
        this.titleElement=Dom.create("strong",{},[
          icon?UiWindow.icon(icon):null,
          Dom.create("span",{text:resolvedTitle})
        ].filter(Boolean));
        this.header.prepend(this.titleElement);
      }
      if(!this.titleElement.id)this.titleElement.id=`ui-panel-title-${++panelSequence}`;
      this.element.setAttribute("role",this.element.getAttribute("role")||"region");
      this.element.setAttribute("aria-labelledby",this.titleElement.id);
      this.body.setAttribute("role",this.body.getAttribute("role")||"region");
      this.body.setAttribute("aria-label",`${resolvedTitle} content`);

      this.controls=directChild(this.header,child=>hasClass(child,"ui-panel__controls"));
      if(!this.controls){
        this.controls=Dom.create("div",{className:"ui-panel__controls"});
        this.header.append(this.controls);
      }
      this.collapsible=Boolean(collapsible);
      if(this.collapsible){
        this.collapseControl=UiWindow.iconButton(`Collapse ${resolvedTitle}`,{
          icon:"fa-chevron-up",
          className:"ui-panel__collapse",
          onClick:()=>this.toggleCollapsed()
        });
        this.collapseControl.setAttribute("aria-controls",this.body.id||(this.body.id=`ui-panel-body-${panelSequence}`));
        this.controls.append(this.collapseControl);
      }

      this.element.replaceChildren(this.header,this.body,this.footer);
      this.footer.hidden=!this.footer.childElementCount&&!this.footer.textContent.trim();
      this.setCollapsed(collapsed,{notify:false});
    }
    setCollapsed(collapsed,{notify=true}={}){
      this.collapsed=Boolean(collapsed);
      this.element.classList.toggle("is-collapsed",this.collapsed);
      this.element.dataset.uiPanelCollapsed=String(this.collapsed);
      this.body.setAttribute("aria-hidden",String(this.collapsed));
      this.footer.setAttribute("aria-hidden",String(this.collapsed));
      if(this.collapseControl){
        const action=this.collapsed?"Expand":"Collapse";
        this.collapseControl.setAttribute("aria-label",`${action} ${this.title}`);
        this.collapseControl.setAttribute("title",`${action} ${this.title}`);
        this.collapseControl.setAttribute("aria-expanded",String(!this.collapsed));
        const icon=this.collapseControl.querySelector("i");
        if(icon)icon.className=`fa-solid ${this.collapsed?"fa-chevron-down":"fa-chevron-up"} ui-icon`;
      }
      if(notify)this.element.dispatchEvent(new CustomEvent("uipanelchange",{
        bubbles:true,
        detail:{action:"collapse",collapsed:this.collapsed,panel:this}
      }));
      return this;
    }
    toggleCollapsed(){return this.setCollapsed(!this.collapsed);}
    setFooter(content){
      this.footer.replaceChildren(...(Array.isArray(content)?content:[content]).filter(Boolean));
      this.footer.hidden=!this.footer.childElementCount&&!this.footer.textContent.trim();
      return this;
    }
  }

  /**
   * Two-pane editor geometry. The primary pane keeps a configurable minimum
   * share while the split root and panes contain overflow for their children.
   */
  class UiSplitView{
    static enhance(element,options={}){
      if(element.uiSplitView)return element.uiSplitView;
      return new UiSplitView({...options,element});
    }
    static enhanceAll(root=document){
      return [...root.querySelectorAll("[data-ui-split-view]")].map(element=>UiSplitView.enhance(element,{
        orientation:element.dataset.uiSplitOrientation||element.dataset.uiSplitView||"horizontal",
        primarySize:element.dataset.uiSplitPrimary||0.5,
        minPrimary:element.dataset.uiSplitMinPrimary||0.5,
        maxPrimary:element.dataset.uiSplitMaxPrimary||0.85,
        label:element.dataset.uiSplitLabel||"Editor workspace"
      }));
    }
    constructor({element,orientation="horizontal",primarySize=0.5,minPrimary=0.5,maxPrimary=0.85,label="Editor workspace"}={}){
      if(!element)throw new TypeError("UiSplitView requires an element.");
      if(element.uiSplitView)return element.uiSplitView;
      this.element=element;
      this.element.uiSplitView=this;
      this.minPrimary=normalizedRatio(minPrimary);
      this.maxPrimary=normalizedRatio(maxPrimary);
      if(this.minPrimary<0||this.maxPrimary>1||this.minPrimary>this.maxPrimary)throw new RangeError("UiSplitView limits must satisfy 0 ≤ minPrimary ≤ maxPrimary ≤ 1.");

      const panes=[...this.element.children].filter(child=>child.dataset?.uiSplitPane);
      this.primary=panes.find(pane=>pane.dataset.uiSplitPane==="primary");
      this.secondary=panes.find(pane=>pane.dataset.uiSplitPane==="secondary");
      if(!this.primary||!this.secondary||panes.length!==2)throw new Error("UiSplitView requires exactly one primary and one secondary direct pane.");

      this.element.classList.add("ui-split-view");
      this.element.dataset.uiOverflow="contained";
      this.element.setAttribute("role",this.element.getAttribute("role")||"group");
      this.element.setAttribute("aria-label",label);
      for(const [role,pane] of [["primary",this.primary],["secondary",this.secondary]]){
        pane.classList.add("ui-split-view__pane",`ui-split-view__pane--${role}`);
        pane.dataset.uiOverflow="contained";
        pane.setAttribute("role",pane.getAttribute("role")||"region");
        pane.setAttribute("aria-label",pane.getAttribute("aria-label")||`${label} ${role} pane`);
      }
      this.activePane="primary";
      this.setOrientation(orientation,{notify:false});
      this.setPrimarySize(primarySize,{notify:false});
      this.setActivePane("primary",{notify:false});
    }
    notify(action){
      this.element.dispatchEvent(new CustomEvent("uisplitviewchange",{
        bubbles:true,
        detail:{action,orientation:this.orientation,primarySize:this.primarySize,activePane:this.activePane,compact:this.compact,splitView:this}
      }));
      return this;
    }
    setOrientation(orientation,{notify=true}={}){
      if(!["horizontal","vertical"].includes(orientation))throw new TypeError(`Unsupported split orientation '${orientation}'.`);
      this.orientation=orientation;
      this.element.classList.toggle("ui-split-view--horizontal",orientation==="horizontal");
      this.element.classList.toggle("ui-split-view--vertical",orientation==="vertical");
      this.element.dataset.uiSplitOrientation=orientation;
      if(notify)this.notify("orientation");
      return this;
    }
    setPrimarySize(value,{notify=true}={}){
      this.primarySize=Math.max(this.minPrimary,Math.min(this.maxPrimary,normalizedRatio(value)));
      this.element.style.setProperty("--ui-split-primary",percent(this.primarySize));
      this.element.dataset.uiSplitPrimary=String(this.primarySize);
      if(notify)this.notify("resize");
      return this;
    }
    setActivePane(role,{notify=true}={}){
      if(!["primary","secondary"].includes(role))throw new TypeError(`Unsupported active pane '${role}'.`);
      this.activePane=role;
      for(const [name,pane] of [["primary",this.primary],["secondary",this.secondary]]){
        const active=name===role;
        pane.classList.toggle("is-active",active);
        pane.setAttribute("aria-hidden",String(Boolean(this.compact&&!active)));
      }
      this.element.dataset.uiSplitActive=role;
      if(notify)this.notify("active-pane");
      return this;
    }
    setCompact(compact,{activePane=this.activePane,notify=true}={}){
      this.compact=Boolean(compact);
      this.element.classList.toggle("is-compact",this.compact);
      this.element.dataset.uiSplitCompact=String(this.compact);
      this.setActivePane(activePane,{notify:false});
      if(notify)this.notify("compact");
      return this;
    }
  }

  /**
   * Shared editor-shell contract.
   *
   * Responsive editor decisions must be based on the space assigned to the
   * editor, not on the browser viewport (the project rail consumes part of
   * it).  This controller exposes that real size to CSS and keeps one primary
   * surface plus any supporting panels measurable and accessible.
   */
  class UiEditorWorkspace{
    static enhance(element,options={}){
      if(element.uiEditorWorkspace)return element.uiEditorWorkspace;
      return new UiEditorWorkspace({...options,element});
    }
    static enhanceAll(root=document){
      return [...root.querySelectorAll(".editor_area")].map(element=>UiEditorWorkspace.enhance(element));
    }
    constructor({element}={}){
      if(!element)throw new TypeError("UiEditorWorkspace requires an element.");
      if(element.uiEditorWorkspace)return element.uiEditorWorkspace;
      this.element=element;
      this.element.uiEditorWorkspace=this;
      this.element.classList.add("ui-editor-workspace");
      this.element.dataset.uiOverflow="contained";
      this.primary=element.querySelector('[data-editor-region="main"],.editor-primary-visual,.editor-view');
      this.panels=[...element.querySelectorAll('[data-editor-region="panels"],.editor-panel-row,.ui-panel')];
      if(this.primary){
        this.primary.classList.add("ui-editor-workspace__main");
        this.primary.setAttribute("role",this.primary.getAttribute("role")||"region");
        this.primary.setAttribute("aria-label",this.primary.getAttribute("aria-label")||"Primary editor view");
      }
      for(const panel of this.panels)panel.classList.add("ui-editor-workspace__panels");
      this.observer=new ResizeObserver(entries=>{
        const width=entries[0]?.contentRect?.width||element.clientWidth;
        this.setWidth(width);
      });
      this.observer.observe(element);
      this.setWidth(element.clientWidth);
    }
    setWidth(width){
      const previous=this.mode;
      this.mode=width<620?"narrow":width<900?"medium":"wide";
      for(const mode of ["narrow","medium","wide"]){
        this.element.classList.toggle(`is-editor-${mode}`,mode===this.mode);
      }
      this.element.style.setProperty("--editor-workspace-width",`${Math.max(0,Math.round(width))}px`);
      if(previous&&previous!==this.mode){
        this.element.dispatchEvent(new CustomEvent("uieditorresize",{
          bubbles:true,
          detail:{mode:this.mode,width,workspace:this}
        }));
      }
      return this;
    }
  }

  global.UiPanel=UiPanel;
  global.UiSplitView=UiSplitView;
  global.UiEditorWorkspace=UiEditorWorkspace;
})(globalThis);
