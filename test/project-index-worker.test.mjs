import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

test("project index worker scans family-described records and applies ordered ROM revisions",async()=>{
  const source=await readFile(new URL("../js/workers/project-index-worker.js",import.meta.url),"utf8"),messages=[];
  let receive=null;
  const context=vm.createContext({Uint8Array,TypeError,RangeError,Object,Array,self:{
    addEventListener(type,listener){if(type==="message")receive=listener;},
    postMessage(message){messages.push(message);}
  }});
  vm.runInContext(source,context);
  const bytes=Uint8Array.of(1,4,10,11,2,0,20,21,3,2,30,31);
  receive({data:{requestId:1,projectGeneration:7,romRevision:0,operation:"init",payload:{bytes:bytes.buffer}}});
  receive({data:{requestId:2,projectGeneration:7,romRevision:0,operation:"scan-fixed-records",payload:{
    offset:0,count:3,stride:4,fields:{kind:{type:"u8",byte:0},count:{type:"u8",byte:1},name:{type:"bytes",byte:2,count:2}},
    filter:{field:"count",equals:0}
  }}});
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).result)),[
    {id:0,kind:1,count:4,name:[10,11]},{id:2,kind:3,count:2,name:[30,31]}
  ]);
  receive({data:{requestId:0,projectGeneration:7,romRevision:1,operation:"patch",payload:{patches:[{offset:5,bytes:Uint8Array.of(5)}]}}});
  receive({data:{requestId:3,projectGeneration:7,romRevision:1,operation:"scan-fixed-records",payload:{
    offset:0,count:3,stride:4,fields:{count:{type:"u8",byte:1}}
  }}});
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).result)),[{id:0,count:4},{id:1,count:5},{id:2,count:2}]);
});
