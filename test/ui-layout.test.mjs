import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

class ClassList{
  constructor(value=""){this.values=new Set(value.split(/\s+/).filter(Boolean));}
  add(...values){values.forEach(value=>this.values.add(value));}
  remove(...values){values.forEach(value=>this.values.delete(value));}
  contains(value){return this.values.has(value);}
  toggle(value,force){
    const enabled=force===undefined?!this.contains(value):Boolean(force);
    enabled?this.add(value):this.remove(value);
    return enabled;
  }
}

class Style{
  constructor(){this.values=new Map();}
  setProperty(name,value){this.values.set(name,String(value));}
  getPropertyValue(name){return this.values.get(name)||"";}
}

class Element extends EventTarget{
  constructor(tag){
    super();
    this.tagName=tag.toUpperCase();
    this.classList=new ClassList();
    this.dataset={};
    this.attributes=new Map();
    this.style=new Style();
    this.children=[];
    this.parentElement=null;
    this.hidden=false;
    this.id="";
    this.tabIndex=-1;
    this._text="";
  }
  set className(value){this.classList=new ClassList(value);}
  get className(){return [...this.classList.values].join(" ");}
  set textContent(value){this._text=String(value??"");this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent||"").join("");}
  get childElementCount(){return this.children.length;}
  setAttribute(name,value){
    this.attributes.set(name,String(value));
    if(name==="id")this.id=String(value);
    if(name==="tabindex")this.tabIndex=Number(value);
  }
  getAttribute(name){return this.attributes.get(name)??null;}
  hasAttribute(name){return this.attributes.has(name);}
  append(...children){
    for(const child of children.filter(Boolean)){
      child.parentElement?.removeChild(child);
      child.parentElement=this;
      this.children.push(child);
    }
  }
  prepend(...children){
    for(const child of [...children].reverse().filter(Boolean)){
      child.parentElement?.removeChild(child);
      child.parentElement=this;
      this.children.unshift(child);
    }
  }
  removeChild(child){
    const index=this.children.indexOf(child);
    if(index>=0)this.children.splice(index,1);
    child.parentElement=null;
  }
  replaceChildren(...children){
    for(const child of this.children)child.parentElement=null;
    this.children=[];
    this._text="";
    this.append(...children);
  }
  querySelector(selector){
    if(selector==="i")return this.find(child=>child.tagName==="I");
    return null;
  }
  find(predicate){
    for(const child of this.children){
      if(predicate(child))return child;
      const nested=child.find(predicate);
      if(nested)return nested;
    }
    return null;
  }
}

class LayoutEvent extends Event{
  constructor(type,options={}){
    super(type,{bubbles:Boolean(options.bubbles)});
    this.detail=options.detail;
  }
}

const create=(tag,options={},children=[])=>{
  const element=new Element(tag);
  if(options.className)element.className=options.className;
  if(options.classes?.length)element.classList.add(...options.classes.filter(Boolean));
  for(const [name,value] of Object.entries(options.attributes||{}))if(value!==undefined&&value!==null)element.setAttribute(name,value);
  Object.assign(element.dataset,options.dataset||{});
  for(const [type,listener] of Object.entries(options.events||{}))element.addEventListener(type,listener);
  if(options.text!==undefined)element.textContent=options.text;
  element.append(...(Array.isArray(children)?children:[children]).filter(Boolean));
  return element;
};

const load=async()=>{
  const Dom={create};
  const UiWindow={
    icon:name=>create("i",{className:`fa-solid ${name} ui-icon`}),
    iconButton:(label,{icon,onClick,className=""}={})=>create("button",{
      className:`ui-button ui-button--icon ${className}`,
      attributes:{type:"button","aria-label":label},
      events:{click:onClick}
    },[UiWindow.icon(icon)])
  };
  class TestResizeObserver{
    constructor(callback){this.callback=callback;TestResizeObserver.instances.push(this);}
    observe(element){this.element=element;}
    disconnect(){}
    emit(width){this.callback([{contentRect:{width},target:this.element}]);}
  }
  TestResizeObserver.instances=[];
  const context=vm.createContext({globalThis:null,Dom,UiWindow,CustomEvent:LayoutEvent,ResizeObserver:TestResizeObserver,TypeError,RangeError});
  context.globalThis=context;
  vm.runInContext(await read("js/core/ui-layout.js"),context);
  return context;
};

test("UiPanel preserves structural regions, owns overflow in its body, and exposes collapse state",async()=>{
  const {UiPanel}=await load();
  const root=create("section"),title=create("strong",{},[create("span",{text:"Library"})]);
  const header=create("header",{className:"ui-panel__header"},[title]);
  const body=create("div",{className:"ui-panel__body"},[create("p",{text:"Resources"})]);
  const footer=create("footer",{className:"ui-panel__footer"},[create("button",{text:"Apply"})]);
  root.append(header,body,footer);
  let change=null;
  root.addEventListener("uipanelchange",event=>change=event.detail);

  const panel=new UiPanel({element:root,title:"Library",collapsible:true});
  assert.deepEqual(root.children,[header,body,footer]);
  assert.equal(root.classList.contains("ui-panel"),true);
  assert.equal(root.dataset.uiOverflow,"contained");
  assert.equal(root.getAttribute("role"),"region");
  assert.equal(root.getAttribute("aria-labelledby"),title.id);
  assert.equal(body.dataset.uiScrollOwner,"panel-body");
  assert.equal(body.getAttribute("role"),"region");
  assert.equal(body.tabIndex,0);
  assert.equal(footer.hidden,false);
  assert.equal(panel.collapseControl.getAttribute("aria-expanded"),"true");

  panel.toggleCollapsed();
  assert.equal(panel.collapsed,true);
  assert.equal(root.classList.contains("is-collapsed"),true);
  assert.equal(body.getAttribute("aria-hidden"),"true");
  assert.equal(panel.collapseControl.getAttribute("aria-expanded"),"false");
  assert.equal(panel.collapseControl.getAttribute("aria-label"),"Expand Library");
  assert.equal(change.action,"collapse");
  assert.equal(change.collapsed,true);
});

test("UiSplitView validates panes, clamps primary geometry, and keeps compact state explicit",async()=>{
  const {UiSplitView}=await load();
  const invalid=create("main");
  invalid.append(Object.assign(create("section"),{dataset:{uiSplitPane:"primary"}}));
  assert.throws(()=>new UiSplitView({element:invalid}),/exactly one primary and one secondary/);

  const root=create("main"),primary=create("section"),secondary=create("aside");
  primary.dataset.uiSplitPane="primary";
  secondary.dataset.uiSplitPane="secondary";
  root.append(primary,secondary);
  const actions=[];
  root.addEventListener("uisplitviewchange",event=>actions.push(event.detail.action));
  const split=new UiSplitView({element:root,orientation:"vertical",primarySize:0.4,minPrimary:0.52,maxPrimary:0.8,label:"Animation"});

  assert.equal(root.classList.contains("ui-split-view--vertical"),true);
  assert.equal(root.dataset.uiOverflow,"contained");
  assert.equal(primary.dataset.uiOverflow,"contained");
  assert.equal(secondary.dataset.uiOverflow,"contained");
  assert.equal(primary.getAttribute("aria-label"),"Animation primary pane");
  assert.equal(root.style.getPropertyValue("--ui-split-primary"),"52%");
  assert.equal(split.primarySize,0.52);

  split.setPrimarySize("75%").setOrientation("horizontal").setCompact(true,{activePane:"secondary"});
  assert.equal(root.style.getPropertyValue("--ui-split-primary"),"75%");
  assert.equal(root.classList.contains("ui-split-view--horizontal"),true);
  assert.equal(root.classList.contains("is-compact"),true);
  assert.equal(primary.getAttribute("aria-hidden"),"true");
  assert.equal(secondary.getAttribute("aria-hidden"),"false");
  assert.deepEqual(actions,["resize","orientation","compact"]);
});

test("UiEditorWorkspace responds to assigned editor width and identifies structural regions",async()=>{
  const {UiEditorWorkspace,ResizeObserver}=await load();
  const root=create("section"),main=create("main"),panels=create("aside");
  root.clientWidth=760;
  root.querySelectorAll=selector=>selector==='[data-editor-region="main"]'?[main]:selector==='[data-editor-region="panels"]'?[panels]:[];
  const events=[];
  root.addEventListener("uieditorresize",event=>events.push(event.detail));

  const workspace=new UiEditorWorkspace({element:root});
  assert.equal(root.classList.contains("ui-editor-workspace"),true);
  assert.equal(root.classList.contains("is-editor-medium"),true);
  assert.equal(main.classList.contains("ui-editor-workspace__main"),true);
  assert.equal(panels.classList.contains("ui-editor-workspace__panels"),true);
  assert.equal(root.dataset.uiOverflow,"contained");
  assert.equal(root.style.getPropertyValue("--editor-workspace-width"),"760px");

  ResizeObserver.instances[0].emit(580);
  assert.equal(root.classList.contains("is-editor-medium"),false);
  assert.equal(root.classList.contains("is-editor-narrow"),true);
  assert.equal(root.style.getPropertyValue("--editor-workspace-width"),"580px");
  assert.equal(events.length,1);
  assert.equal(events[0].previousMode,"medium");
  assert.equal(events[0].mode,"narrow");
  assert.equal(events[0].reason,"observer");
});

test("UiEditorWorkspace fails fast when markup has no unique primary surface",async()=>{
  const {UiEditorWorkspace}=await load();
  const root=create("section");
  root.id="broken_editor";
  root.querySelectorAll=()=>[];
  assert.throws(()=>new UiEditorWorkspace({element:root}),/requires exactly one/);
  assert.equal(root.uiEditorWorkspace,undefined);
  assert.equal(root.classList.contains("ui-editor-workspace"),false);
  assert.throws(()=>new UiEditorWorkspace({element:root,narrow:0}),/0 < narrow < medium/);
});

test("layout SCSS assigns scrolling to panel bodies and contains split overflow",async()=>{
  const panel=await read("scss/components/_panel.scss");
  const split=await read("scss/components/_split-view.scss");
  assert.match(panel,/\.ui-panel__body\{[^}]*overflow:auto/);
  assert.match(split,/\.ui-split-view\{[^}]*overflow:hidden/);
  assert.match(split,/\.ui-split-view__pane\{[^}]*overflow:hidden/);
  assert.match(split,/grid-template-rows:minmax\(0,var\(--ui-split-primary\)\) minmax\(0,1fr\)/);
  const contract=await read("scss/components/_editor-contract.scss");
  assert.match(contract,/\.ui-editor-workspace\.is-editor-medium\.editor-document/);
  assert.match(contract,/\.ui-editor-workspace\.is-editor-narrow\{overflow:auto\}/);
});
