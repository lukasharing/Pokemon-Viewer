import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const load=async()=>{
  const context=vm.createContext({globalThis:null,ArrayBuffer});
  context.globalThis=context;
  vm.runInContext(await readFile(new URL("../js/core/resource-graph.js",import.meta.url),"utf8"),context);
  return context.PokemonViewer.resources;
};

test("resource graph indexes stable typed inbound and outbound references",async()=>{
  const {ResourceId,ResourceGraphBuilder}=await load(),builder=new ResourceGraphBuilder();
  const species=ResourceId.create("gen1","species","25"),cry=ResourceId.create("gen1","cry","84");
  const provenance={source:{repository:"pret/pokered"}};
  builder.addNode({id:species,label:"PIKACHU",accuracy:"verified",provenance});
  builder.addNode({id:cry,label:"PIKACHU cry",accuracy:"verified",ranges:[{offset:0x1234,length:3}]});
  builder.addEdge({
    id:"gen1:species:25/cry",source:species,target:cry,field:"cry",
    kind:"id",confidence:"verified",rewritePolicy:"rewrite-id",range:{offset:0x2000,length:1}
  });
  const graph=builder.build();
  assert.equal(graph.size,2);
  assert.equal(graph.edgeCount,1);
  assert.equal(graph.outbound(species)[0].target,cry);
  assert.equal(graph.inbound(cry)[0].source,species);
  assert.deepEqual(JSON.parse(JSON.stringify(graph.validate())),{valid:true,nodeCount:2,edgeCount:1,unresolved:[]});
  assert.ok(Object.isFrozen(graph.node(species)));
  assert.ok(Object.isFrozen(graph.edge("gen1:species:25/cry")));
  assert.ok(Object.isFrozen(graph));
  assert.equal(Object.isFrozen(provenance.source),false,"constructing a graph must not freeze caller-owned metadata");
});

test("resource graph reports explicit unresolved edges and rejects dangling resolved targets",async()=>{
  const {ResourceGraphBuilder}=await load(),source="gba:trainer:1",missing="gba:species:25";
  const builder=new ResourceGraphBuilder();
  builder.addNode({id:source,label:"Trainer 1"});
  builder.addEdge({
    id:"gba:trainer:1/party-0",source,target:null,field:"party[0].species",
    unresolved:"Species table is not profiled",kind:"id",confidence:"unknown",rewritePolicy:"manual"
  });
  const graph=builder.build();
  assert.equal(graph.validate().valid,false);
  assert.equal(graph.unresolved()[0].unresolved,"Species table is not profiled");
  const dangling=new ResourceGraphBuilder();
  dangling.addNode({id:source});
  dangling.addEdge({id:"dangling",source,target:missing,kind:"id",confidence:"verified",rewritePolicy:"immutable"});
  assert.throws(()=>dangling.build(),/missing target/);
});

test("resource IDs, source ranges, confidence and rewrite policy fail closed",async()=>{
  const {ResourceId,ResourceNode,ResourceEdge}=await load();
  assert.equal(ResourceId.create("gen1","pokedex-entry","151"),"gen1:pokedex-entry:151");
  assert.equal(ResourceId.parse("not valid"),null);
  assert.throws(()=>new ResourceNode({id:"gen1:species:1",ranges:[{offset:-1,length:2}]}),/non-negative/);
  assert.throws(()=>new ResourceEdge({id:"x",source:"gen1:species:1",unresolved:"x",confidence:"certain"}),/confidence/);
  assert.throws(()=>new ResourceEdge({id:"x",source:"gen1:species:1",unresolved:"x",rewritePolicy:"guess"}),/rewrite policy/);
});
