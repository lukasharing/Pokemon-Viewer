import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const load=async()=>{
  const context=vm.createContext({globalThis:null,Map,Set,Object,Array,String,TypeError,Error});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/editor-descriptor-registry.js",import.meta.url),"utf8"),context);
  return context.EditorDescriptorRegistry;
};

const descriptor=overrides=>({
  id:"map_editor",file:"map.html",instance:"map_editor",label:"map",title:"Map editor",icon:"map",families:["gba","gb"],help:{file:"MAP_EDITOR.md"},
  activate:(project,options)=>project.map_editor.activate(options),
  open:(project,request)=>project.map_editor.open(request),
  bookmark:{capture:project=>project.map_editor.bookmark(),restore:(project,target)=>project.map_editor.restore(target)},
  refreshEvents:["mapviewchange"],...overrides
});

test("editor descriptors fail closed and own activation, links, and bookmarks",async()=>{
  const Registry=await load();
  assert.throws(()=>new Registry([descriptor({id:"Bad id"})]),/Invalid editor id/);
  assert.throws(()=>new Registry([descriptor({help:null})]),/Markdown help document/);
  assert.throws(()=>new Registry([descriptor({refreshEvents:[null]})]),/invalid refresh event/);
  assert.throws(()=>new Registry([descriptor({}),descriptor({id:"map_copy",file:"copy.html"})]),/instance 'map_editor' is already registered/);

  const calls=[],project={map_editor:{
    activate:options=>calls.push(["activate",options]),open:request=>calls.push(["open",request]),
    bookmark:()=>({bank:3,map:4,title:"Route"}),restore:target=>calls.push(["restore",target])
  }};
  const registry=new Registry([descriptor({})]);
  assert.equal(Object.isFrozen(registry.require("map_editor")),true);
  assert.deepEqual(Array.from(registry.files()),["map.html"]);
  assert.equal(registry.instance(project,"map_editor"),project.map_editor);
  assert.deepEqual({...registry.capture("map_editor",project)},{bank:3,map:4,title:"Route"});
  registry.activate("map_editor",project,{initial:true});registry.open("map_editor",project,{map:2});registry.restore("map_editor",project,{map:4});
  assert.deepEqual(calls,[["activate",{initial:true}],["open",{map:2}],["restore",{map:4}]]);
});

class ClassList{
  constructor(value=""){this.values=new Set(value.split(/\s+/).filter(Boolean));}
  add(...values){values.forEach(value=>this.values.add(value));}
  remove(...values){values.forEach(value=>this.values.delete(value));}
  contains(value){return this.values.has(value);}
  toggle(value,force){const enabled=force===undefined?!this.contains(value):Boolean(force);enabled?this.add(value):this.remove(value);return enabled;}
}
class Element extends EventTarget{
  constructor(tag,{className="",attributes={},dataset={},events={},text=""}={},children=[]){
    super();this.tag=tag;this.classList=new ClassList(className);this.dataset={...dataset};this.attributes=new Map();this.children=children;this.textContent=text;
    for(const [key,value] of Object.entries(attributes))if(value!==undefined)this.setAttribute(key,value);
    for(const [type,listener] of Object.entries(events))this.addEventListener(type,listener);
  }
  setAttribute(key,value){this.attributes.set(key,String(value));}
  removeAttribute(key){this.attributes.delete(key);}
  querySelector(selector){if(selector===".workspace-capability")return this.children.find(child=>child.classList?.contains("workspace-capability"))||null;return null;}
}
class Container{
  constructor(){this.links=[];}
  replaceChildren(fragment){this.links=[...fragment];}
  querySelector(selector){const id=selector.match(/data-workspace='([^']+)'/)?.[1];return this.links.find(link=>link.dataset.workspace===id)||null;}
  querySelectorAll(){return this.links;}
}

test("descriptor registry generates navigation, capability state, and header refresh",async()=>{
  const Registry=await load(),registry=new Registry([descriptor({})]),container=new Container();let opened=0;
  const Dom={create:(tag,options={},children=[])=>new Element(tag,options,children),fragment:values=>values};
  const links=registry.renderNavigation(container,{Dom,onOpen:()=>opened++});
  assert.equal(links.length,1);assert.equal(links[0].dataset.workspace,"map_editor");assert.equal(links[0].querySelector(".workspace-capability").textContent,"");
  links[0].dispatchEvent(new Event("click",{cancelable:true}));assert.equal(opened,1);
  registry.updateNavigation(container,{family:"gba",workspaces:["map_editor"],platform:"GBA",capabilities:{get:()=>({state:"partial",label:"Partial",reason:"Pinned subset"})}});
  assert.equal(links[0].classList.contains("disabled"),false);assert.equal(links[0].classList.contains("is-partial"),true);assert.equal(links[0].dataset.capability,"partial");assert.equal(links[0].querySelector(".workspace-capability").textContent,"Partial");
  registry.resetNavigation(container);assert.equal(links[0].classList.contains("disabled"),true);assert.equal(links[0].attributes.get("aria-disabled"),"true");

  const area=new EventTarget(),headers=[];area.id="map_editor";
  registry.attachHeaders({
    root:{getElementById:id=>id==="map_editor"?area:null},menus:{map_editor:[{label:"Map"}]},
    composeMenus:(entry,items)=>[...items,{label:`Help ${entry.help.file}`}],
    Header:{attach:(element,options)=>{const header={element,options,renders:0,render(){this.renders++;}};headers.push(header);return header;}}
  });
  assert.equal(headers[0].options.title,"Map editor");assert.deepEqual(headers[0].options.menus.map(item=>item.label),["Map","Help MAP_EDITOR.md"]);
  area.dispatchEvent(new Event("mapviewchange"));assert.equal(headers[0].renders,1);
});
