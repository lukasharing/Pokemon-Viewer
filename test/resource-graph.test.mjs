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

test("resource graph reports unique modeled and safely writable ROM byte coverage",async()=>{
  const {ResourceGraphBuilder}=await load(),builder=new ResourceGraphBuilder();
  builder.addNode({
    id:"gen1:base-stats:1",accuracy:"verified",
    ranges:[{offset:10,length:20}],
    writeRanges:[{offset:12,length:4}]
  });
  builder.addNode({
    id:"gen1:cry:1",accuracy:"verified",
    ranges:[{offset:25,length:10}]
  });
  builder.addEdge({
    id:"gen1:base-stats:1/cry",source:"gen1:base-stats:1",target:"gen1:cry:1",
    range:{offset:20,length:10},kind:"pointer",confidence:"verified",rewritePolicy:"repoint"
  });
  builder.addEdge({
    id:"gen1:cry:1/readonly",source:"gen1:cry:1",target:"gen1:base-stats:1",
    range:{offset:34,length:1},kind:"id",confidence:"verified",rewritePolicy:"immutable"
  });
  const coverage=builder.build().coverage(100);
  assert.equal(coverage.modeledBytes,25,"overlapping verified ranges are counted once");
  assert.equal(coverage.writableBytes,14,"node and edge write ranges are unioned");
  assert.equal(coverage.writableNodes,1);
  assert.equal(coverage.writableEdges,1);
  assert.ok(Math.abs(coverage.writablePercent-14)<Number.EPSILON*100);
  assert.throws(()=>builder.addNode({
    id:"gen1:move:1",ranges:[{offset:50,length:2}],writeRanges:[{offset:51,length:2}]
  }),/contained/);
});

test("typed manifest symbols seed exact read-only resource coverage",async()=>{
  const {ManifestResourceGraph}=await load();
  const graph=ManifestResourceGraph.build({
    family:"gba",
    verified:true,
    exact:true,
    fingerprint:"f".repeat(40),
    manifestOrigin:"bundled",
    engineProfile:"gen3-emerald-en",
    symbols:{
      gBattleMoves:{
        offset:100,extent:24,kind:"table",count:2,stride:12,
        pointerKind:"unknown",ownership:"exclusive"
      },
      "g$MovePointers":{
        offset:200,extent:8,kind:"pointer-table",count:2,stride:4,
        pointerKind:"gba32",ownership:"shared"
      }
    },
    resources:{
      moves:{symbols:["gBattleMoves","g$MovePointers"]}
    }
  });
  const moves=graph.node("gba:manifest-symbol:gBattleMoves");
  const pointers=graph.node("gba:manifest-symbol:g~MovePointers");
  assert.equal(graph.size,2);
  assert.deepEqual(JSON.parse(JSON.stringify(moves.ranges)),[{offset:100,length:24}]);
  assert.equal(moves.data.count,2);
  assert.equal(moves.data.stride,12);
  assert.equal(moves.data.ownership,"exclusive");
  assert.deepEqual(Array.from(pointers.data.resources),["moves"]);
  assert.equal(pointers.data.pointerKind,"gba32");
  const coverage=graph.coverage(512);
  assert.equal(coverage.modeledBytes,32);
  assert.equal(coverage.writableBytes,0,"manifest evidence never grants write authority");
  assert.equal(coverage.verifiedNodes,2);
  assert.equal(coverage.writableNodes,0);
});

test("project manifest extents remain inspectable but do not claim verified coverage",async()=>{
  const {ManifestResourceGraph}=await load();
  const graph=ManifestResourceGraph.build({
    family:"gen1",
    verified:false,
    exact:true,
    fingerprint:"a".repeat(40),
    manifestOrigin:"project",
    engineProfile:"gen1-red-blue-intl",
    symbols:{
      Moves:{offset:50,extent:12,kind:"table",count:2,stride:6}
    }
  });
  assert.equal(graph.node("gen1:manifest-symbol:Moves").accuracy,"partial");
  assert.equal(graph.coverage(256).modeledBytes,0);
  assert.equal(graph.coverage(256).writableBytes,0);
});
