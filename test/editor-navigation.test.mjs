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
  toggle(value,force){const active=force===undefined?!this.contains(value):Boolean(force);active?this.add(value):this.remove(value);return active;}
}

class Element extends EventTarget{
  constructor(tag,document){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.classList=new ClassList();this.children=[];this.parentElement=null;this.attributes=new Map();this.dataset={};this.style={setProperty(){}};this.hidden=false;this.disabled=false;this.tabIndex=-1;this.id="";this._text="";}
  set className(value){this.classList=new ClassList(value);}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join("");}
  set textContent(value){this._text=String(value??"");this.replaceChildren();}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==="id")this.id=String(value);if(name==="disabled")this.disabled=true;if(name==="tabindex")this.tabIndex=Number(value);}
  getAttribute(name){return this.attributes.get(name)??null;}
  hasAttribute(name){return this.attributes.has(name);}
  removeAttribute(name){this.attributes.delete(name);}
  append(...children){for(const child of children.filter(Boolean)){child.parentElement?.removeChild(child);child.parentElement=this;this.children.push(child);}}
  prepend(...children){for(const child of [...children].reverse().filter(Boolean)){child.parentElement?.removeChild(child);child.parentElement=this;this.children.unshift(child);}}
  removeChild(child){const index=this.children.indexOf(child);if(index>=0)this.children.splice(index,1);child.parentElement=null;}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this._text="";this.append(...children);}
  remove(){this.parentElement?.removeChild(this);}
  matches(selector){return selector==="button"?this.tagName==="BUTTON":selector.startsWith(".")?selector.slice(1).split(".").every(name=>this.classList.contains(name)):false;}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  contains(target){return this===target||this.children.some(child=>child.contains(target));}
  querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children){if(selector===".editor-menu.is-open"&&child.classList.contains("editor-menu")&&child.classList.contains("is-open"))found.push(child);visit(child);}};visit(this);return found;}
  querySelector(selector){if(selector===":focus")return this.contains(this.ownerDocument.activeElement)?this.ownerDocument.activeElement:null;return null;}
  focus(){this.ownerDocument.activeElement=this;}
  blur(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=null;}
}

class KeyboardAction extends Event{
  constructor(key){super("keydown",{bubbles:true,cancelable:true});this.key=key;this.altKey=false;this.ctrlKey=false;this.metaKey=false;}
}

const load=async()=>{
  const document=new EventTarget();document.activeElement=null;document.querySelector=()=>null;
  const create=(tag,options={},children=[])=>{
    const element=new Element(tag,document);if(options.className)element.className=options.className;
    for(const [name,value] of Object.entries(options.attributes||{}))if(value!==undefined&&value!==null)element.setAttribute(name,value);
    Object.assign(element.dataset,options.dataset||{});for(const [type,listener] of Object.entries(options.events||{}))element.addEventListener(type,listener);
    if(options.text!==undefined)element.textContent=options.text;element.append(...(Array.isArray(children)?children:[children]).filter(Boolean));return element;
  };
  const context=vm.createContext({globalThis:null,document,Dom:{create},setTimeout,clearTimeout,TypeError,Boolean,String,Math,innerWidth:1024,innerHeight:768});context.globalThis=context;
  vm.runInContext(await read("js/core/editor-header.js"),context);
  vm.runInContext(await read("js/core/ui-window.js"),context);
  return {...context,create,document};
};

test("EditorHeader implements roving menubar and submenu keyboard navigation",async()=>{
  const {EditorHeader,create,document}=await load(),root=create("section");let activated=0;
  const header=new EditorHeader(root,{title:"Test",menus:[
    {label:"File",children:[{label:"Open",action:()=>activated++},{label:"Save"}]},
    {label:"Edit",children:[{label:"Undo"},{label:"Paste"}]},
    {label:"View",children:[{label:"Windows",children:[{label:"Blocks"},{label:"History"}]}]}
  ]});
  const [file,edit,view]=header.topEntries(),fileButton=header.directButton(file),editButton=header.directButton(edit);
  assert.equal(fileButton.tabIndex,0);assert.equal(editButton.tabIndex,-1);
  fileButton.focus();fileButton.dispatchEvent(new KeyboardAction("ArrowRight"));assert.equal(document.activeElement,editButton);
  editButton.dispatchEvent(new KeyboardAction("ArrowDown"));assert.equal(edit.classList.contains("is-open"),true);assert.equal(document.activeElement,header.directButton(header.childEntries(edit)[0]));
  document.activeElement.dispatchEvent(new KeyboardAction("p"));assert.equal(header.childEntries(edit).findIndex(entry=>header.directButton(entry)===document.activeElement),1);
  document.activeElement.dispatchEvent(new KeyboardAction("Escape"));assert.equal(edit.classList.contains("is-open"),false);assert.equal(document.activeElement,editButton);
  fileButton.dispatchEvent(new KeyboardAction("ArrowDown"));document.activeElement.dispatchEvent(new KeyboardAction("Enter"));assert.equal(activated,1);
  header.directButton(view).focus();header.directButton(view).dispatchEvent(new KeyboardAction("ArrowDown"));const windows=header.childEntries(view)[0];document.activeElement.dispatchEvent(new KeyboardAction("ArrowRight"));assert.equal(document.activeElement,header.directButton(header.childEntries(windows)[0]));
});

test("UiPanelTabs follows orientation, Home/End and typeahead",async()=>{
  const {UiPanelTabs,create,document}=await load(),panels=[create("section"),create("section"),create("section")];
  const tabs=new UiPanelTabs({label:"Details",orientation:"vertical",items:[
    {id:"details",label:"Details",panel:panels[0]},{id:"encounters",label:"Encounters",panel:panels[1]},{id:"history",label:"History",panel:panels[2]}
  ]});
  assert.equal(tabs.element.getAttribute("aria-orientation"),"vertical");
  tabs.items[0].button.dispatchEvent(new KeyboardAction("ArrowDown"));assert.equal(tabs.selected,"encounters");assert.equal(document.activeElement,tabs.items[1].button);
  tabs.items[1].button.dispatchEvent(new KeyboardAction("End"));assert.equal(tabs.selected,"history");
  tabs.items[2].button.dispatchEvent(new KeyboardAction("d"));assert.equal(tabs.selected,"details");
  assert.deepEqual(panels.map(panel=>panel.hidden),[false,true,true]);
});
