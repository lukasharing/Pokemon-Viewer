import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

class FocusTarget{
  constructor(document){this.ownerDocument=document;this.isConnected=true;this.id="";}
  focus(){this.ownerDocument.activeElement=this;}
}

class Dialog extends EventTarget{
  constructor(document){super();this.ownerDocument=document;this.attributes=new Map();this.open=false;this.isConnected=false;this.tabIndex=0;this.heading=new FocusTarget(document);this.description=new FocusTarget(document);this.control=new FocusTarget(document);}
  querySelector(selector){
    if(selector.includes("app-dialog__header"))return this.heading;
    if(selector===".app-dialog__body > p")return this.description;
    if(selector==="input")return this.control;
    if(selector.includes("app-dialog__close"))return this.control;
    return null;
  }
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  hasAttribute(name){return this.attributes.has(name);}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event("close"));}
  remove(){this.isConnected=false;}
  focus(){this.ownerDocument.activeElement=this;}
}

test("AppDialog names modals, chooses initial focus and restores the trigger",async()=>{
  const document={activeElement:null,body:{append(dialog){dialog.isConnected=true;}}},trigger=new FocusTarget(null);trigger.ownerDocument=document;document.activeElement=trigger;
  const context=vm.createContext({globalThis:null,document,queueMicrotask,Event,Dom:{},UiWindow:{},Promise,TypeError,String,Object});context.globalThis=context;
  vm.runInContext(await read("js/core/dialog.js"),context);
  const dialog=new Dialog(document);context.AppDialog.mount(dialog,{focus:"input"});
  assert.equal(dialog.getAttribute("aria-modal"),"true");
  assert.equal(dialog.getAttribute("aria-labelledby"),dialog.heading.id);
  assert.equal(dialog.getAttribute("aria-describedby"),dialog.description.id);
  assert.equal(document.activeElement,dialog.control);
  context.AppDialog.unmount(dialog);await Promise.resolve();
  assert.equal(document.activeElement,trigger);
});

test("shared form dialogs guard dirty cancellation instead of silently discarding",async()=>{
  const source=await read("js/core/dialog.js");
  assert.match(source,/protectDirty=true/);
  assert.match(source,/Discard changes\?/);
  assert.match(source,/if\(!protectDirty\|\|!dirty\)/);
  assert.match(source,/events:\{submit,input:/);
});
