import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";

const require=createRequire(import.meta.url);

test("UiGraphLayout uses Dagre to place typed inputs before operations without overlap",async()=>{
  const context=vm.createContext({globalThis:null,dagre:require("@dagrejs/dagre")});context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/ui-graph-layout.js",import.meta.url),"utf8"),context);
  const result=context.UiGraphLayout.directed({
    nodes:[
      {id:"value",width:180,height:80},{id:"load",width:300,height:100},{id:"play",width:300,height:100}
    ],
    edges:[
      {id:"data",from:"value",to:"load",kind:"data"},{id:"flow",from:"load",to:"play",kind:"flow"}
    ]
  });
  const value=result.positions.get("value"),load=result.positions.get("load"),play=result.positions.get("play");
  assert.ok(value.x+value.width<load.x);
  assert.ok(load.x+load.width<play.x);
  assert.ok(result.routes.get("data").length>=2);
  assert.ok(result.width>780&&result.height>=180);
});
