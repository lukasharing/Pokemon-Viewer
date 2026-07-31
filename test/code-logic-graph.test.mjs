import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function graph(){
  const context=vm.createContext({globalThis:null});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/code/logic-graph.js",import.meta.url),"utf8"),context);
  return context.ScriptLogicGraph;
}

test("Simple logic translates verified GBA commands without exposing hexadecimal",async()=>{
  const Logic=await graph();
  const document=Logic.document([
    {offset:0x120,name:"message",size:5,args:[0x8123456]},
    {offset:0x125,name:"setwildbattle",size:4,args:[25,12]},
    {offset:0x129,name:"end",size:1,args:[]}
  ],{family:"gba",language:"Generation III event macros"});
  assert.deepEqual(Array.from(document.nodes,node=>node.title),["Show dialogue","Prepare wild encounter","Finish"]);
  assert.equal(document.nodes[1].summary,"Pokémon 25 at level 12");
  assert.doesNotMatch(JSON.stringify(document.nodes),/0x[0-9a-f]+|\$[0-9a-f]+/i);
  assert.equal(document.nodes[2].terminal,true);
});

test("GB CPU logic stays an honest RGBDS engine view",async()=>{
  const Logic=await graph();
  const document=Logic.document([
    {offset:0x200,name:"ld",mnemonic:"ld",size:2,operands:"a, $2A"},
    {offset:0x202,name:"jr",mnemonic:"jr",size:2,operands:"nz, $0208"}
  ],{family:"gb",language:"RGBDS LR35902"});
  assert.equal(document.nodes[0].summary,"Low-level engine operation");
  assert.equal(document.language,"RGBDS LR35902");
  assert.doesNotMatch(document.nodes.map(node=>node.title).join(" "),/trainer|dialogue|warp/i);
});

test("Animation conditions, calls, jumps, and loops produce real graph edges",async()=>{
  const Logic=await graph();
  const document=Logic.document([
    {offset:0x100,name:"jumpargeq",control:{kind:"branch",conditional:true,targets:[0x130],unresolved:true}},
    {offset:0x110,name:"anim_call",control:{kind:"call",targets:[0x140]}},
    {offset:0x120,name:"anim_jump",control:{kind:"jump",targets:[0x150]}},
    {offset:0x130,name:"delay"},
    {offset:0x140,name:"anim_ret",control:{kind:"return",targets:[]}},
    {offset:0x150,name:"anim_loop",control:{kind:"loop",targets:[0x130]}},
    {offset:0x160,name:"end"}
  ],{family:"gba",language:"GBA animation program"});
  assert.equal(document.nodes[0].kind,"condition");
  assert.equal(document.nodes[0].control.unresolved,true);
  assert.ok(document.edges.some(edge=>edge.from===0&&edge.to===3&&edge.port==="branch"));
  assert.ok(document.edges.some(edge=>edge.from===1&&edge.to===4&&edge.label==="Call"));
  assert.deepEqual(Array.from(document.edges.filter(edge=>edge.from===2),edge=>edge.to),[5]);
  assert.ok(document.edges.some(edge=>edge.from===5&&edge.to===3&&edge.label==="Repeat"));
});
