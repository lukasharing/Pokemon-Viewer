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
