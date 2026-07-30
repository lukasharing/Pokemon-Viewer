(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});
  const TYPE=/^[a-z][a-z0-9-]*$/;
  const KEY=/^[A-Za-z0-9._~-]+$/;
  const EDGE_KINDS=new Set(["id","pointer","banked-pointer","offset","contains","derived","symbol"]);
  const CONFIDENCE=new Set(["verified","partial","heuristic","unknown"]);
  const REWRITE_POLICIES=new Set(["immutable","in-place","rewrite-id","rewrite-pointer","repoint","manual"]);
  const WRITABLE_POLICIES=new Set(["in-place","rewrite-id","rewrite-pointer","repoint"]);

  const cloneFrozen=value=>{
    if(!value||typeof value!=="object")return value;
    if(ArrayBuffer.isView(value))return Object.freeze(Array.from(value));
    if(Array.isArray(value))return Object.freeze(value.map(cloneFrozen));
    const clone={};
    for(const key of Object.keys(value))clone[key]=cloneFrozen(value[key]);
    return Object.freeze(clone);
  };

  class ResourceId{
    static create(family,type,key){
      if(!TYPE.test(String(family)))throw new TypeError(`Invalid resource family: ${family}.`);
      if(!TYPE.test(String(type)))throw new TypeError(`Invalid resource type: ${type}.`);
      if(!KEY.test(String(key)))throw new TypeError(`Invalid resource key: ${key}.`);
      return `${family}:${type}:${key}`;
    }
    static parse(id){
      const parts=String(id).split(":");
      if(parts.length!==3)return null;
      try{return Object.freeze({family:parts[0],type:parts[1],key:parts[2],id:this.create(...parts)});}
      catch{return null;}
    }
    static assert(id,name="resource ID"){
      const parsed=this.parse(id);
      if(!parsed)throw new TypeError(`Invalid ${name}: ${id}.`);
      return parsed.id;
    }
  }

  const normalizeRange=(range,name)=>{
    if(range==null)return null;
    const offset=Number(range.offset),length=Number(range.length);
    if(!Number.isInteger(offset)||offset<0||!Number.isInteger(length)||length<1){
      throw new RangeError(`${name} must have a non-negative offset and positive length.`);
    }
    return Object.freeze({offset,length});
  };
  const clippedRanges=(ranges,romSize)=>{
    const limit=Number(romSize);
    if(!Number.isSafeInteger(limit)||limit<1)throw new RangeError("ROM coverage requires a positive ROM size.");
    return ranges.flatMap(range=>{
      if(!range)return[];
      const start=Math.max(0,range.offset),end=Math.min(limit,range.offset+range.length);
      return end>start?[{offset:start,length:end-start}]:[];
    }).sort((a,b)=>a.offset-b.offset||a.length-b.length);
  };
  const unionRanges=(ranges,romSize)=>{
    const sorted=clippedRanges(ranges,romSize),merged=[];
    for(const range of sorted){
      const previous=merged.at(-1),end=range.offset+range.length;
      if(previous&&range.offset<=previous.offset+previous.length){
        previous.length=Math.max(previous.offset+previous.length,end)-previous.offset;
      }else merged.push({...range});
    }
    return Object.freeze(merged.map(Object.freeze));
  };
  const rangeBytes=ranges=>ranges.reduce((total,range)=>total+range.length,0);

  class ResourceNode{
    constructor({id,family,type,key,label="",accuracy="unknown",provenance=null,ranges=[],writeRanges=[],data={}}={}){
      const parsed=ResourceId.parse(ResourceId.assert(id));
      if(family&&family!==parsed.family)throw new Error(`Resource family disagrees with ${id}.`);
      if(type&&type!==parsed.type)throw new Error(`Resource type disagrees with ${id}.`);
      if(key!=null&&String(key)!==parsed.key)throw new Error(`Resource key disagrees with ${id}.`);
      if(!CONFIDENCE.has(accuracy))throw new TypeError(`Invalid resource accuracy: ${accuracy}.`);
      this.id=parsed.id;this.family=parsed.family;this.type=parsed.type;this.key=parsed.key;
      this.label=String(label||parsed.key);this.accuracy=accuracy;
      this.provenance=cloneFrozen(provenance||{});
      this.ranges=Object.freeze(ranges.map((range,index)=>normalizeRange(range,`${id} range ${index}`)));
      this.writeRanges=Object.freeze(writeRanges.map((range,index)=>normalizeRange(range,`${id} writable range ${index}`)));
      for(const writable of this.writeRanges){
        const owned=this.ranges.some(range=>writable.offset>=range.offset&&
          writable.offset+writable.length<=range.offset+range.length);
        if(!owned)throw new RangeError(`${id} writable ranges must be contained by a declared resource range.`);
      }
      this.data=cloneFrozen(data||{});
      Object.freeze(this);
    }
  }

  class ResourceEdge{
    constructor({
      id,source,target=null,field="",range=null,kind="id",confidence="unknown",
      provenance=null,rewritePolicy="manual",unresolved=null,data={}
    }={}){
      this.id=String(id||"");
      if(!this.id)throw new TypeError("A resource edge requires a stable ID.");
      this.source=ResourceId.assert(source,"edge source");
      this.target=target==null?null:ResourceId.assert(target,"edge target");
      if(!EDGE_KINDS.has(kind))throw new TypeError(`Invalid reference kind: ${kind}.`);
      if(!CONFIDENCE.has(confidence))throw new TypeError(`Invalid reference confidence: ${confidence}.`);
      if(!REWRITE_POLICIES.has(rewritePolicy))throw new TypeError(`Invalid rewrite policy: ${rewritePolicy}.`);
      if(this.target==null&&!unresolved)throw new Error(`Unresolved edge ${this.id} requires a reason.`);
      this.field=String(field);this.range=normalizeRange(range,`${this.id} source range`);
      this.kind=kind;this.confidence=confidence;this.provenance=cloneFrozen(provenance||{});
      this.rewritePolicy=rewritePolicy;this.unresolved=this.target==null?String(unresolved):null;
      this.data=cloneFrozen(data||{});
      Object.freeze(this);
    }
  }

  class ResourceGraph{
    #nodes;
    #edges;
    #outbound;
    #inbound;
    #unresolved;
    constructor(nodes=[],edges=[]){
      this.#nodes=new Map();
      for(const value of nodes){
        const node=value instanceof ResourceNode?value:new ResourceNode(value);
        if(this.#nodes.has(node.id))throw new Error(`Duplicate resource node ${node.id}.`);
        this.#nodes.set(node.id,node);
      }
      this.#edges=new Map();this.#outbound=new Map();this.#inbound=new Map();this.#unresolved=[];
      for(const value of edges){
        const edge=value instanceof ResourceEdge?value:new ResourceEdge(value);
        if(this.#edges.has(edge.id))throw new Error(`Duplicate resource edge ${edge.id}.`);
        if(!this.#nodes.has(edge.source))throw new Error(`Edge ${edge.id} has missing source ${edge.source}.`);
        if(edge.target&&!this.#nodes.has(edge.target))throw new Error(`Edge ${edge.id} has missing target ${edge.target}.`);
        this.#edges.set(edge.id,edge);
        const outbound=this.#outbound.get(edge.source)||[];outbound.push(edge);this.#outbound.set(edge.source,outbound);
        if(edge.target){
          const inbound=this.#inbound.get(edge.target)||[];inbound.push(edge);this.#inbound.set(edge.target,inbound);
        }else this.#unresolved.push(edge);
      }
      for(const index of [this.#outbound,this.#inbound])for(const [id,list] of index)index.set(id,Object.freeze(list));
      Object.freeze(this.#unresolved);Object.freeze(this);
    }
    get size(){return this.#nodes.size;}
    get edgeCount(){return this.#edges.size;}
    has(id){return this.#nodes.has(id);}
    node(id){return this.#nodes.get(id)||null;}
    edge(id){return this.#edges.get(id)||null;}
    nodes({family=null,type=null}={}){
      return Object.freeze(Array.from(this.#nodes.values()).filter(node=>
        (!family||node.family===family)&&(!type||node.type===type)
      ));
    }
    edges(){return Object.freeze(Array.from(this.#edges.values()));}
    outbound(id){return this.#outbound.get(ResourceId.assert(id))||Object.freeze([]);}
    inbound(id){return this.#inbound.get(ResourceId.assert(id))||Object.freeze([]);}
    unresolved(){return this.#unresolved;}
    references(id){return Object.freeze({inbound:this.inbound(id),outbound:this.outbound(id)});}
    validate(){
      return Object.freeze({
        valid:this.#unresolved.length===0,
        nodeCount:this.size,edgeCount:this.edgeCount,
        unresolved:Object.freeze(this.#unresolved.map(edge=>Object.freeze({edgeId:edge.id,source:edge.source,field:edge.field,reason:edge.unresolved})))
      });
    }
    coverage(romSize){
      const verifiedNodes=this.nodes().filter(node=>node.accuracy==="verified");
      const verifiedEdges=this.edges().filter(edge=>edge.confidence==="verified");
      const writableEdges=verifiedEdges.filter(edge=>edge.range&&WRITABLE_POLICIES.has(edge.rewritePolicy));
      const modeledRanges=unionRanges([
        ...verifiedNodes.flatMap(node=>node.ranges),
        ...verifiedEdges.map(edge=>edge.range).filter(Boolean)
      ],romSize);
      const writableRanges=unionRanges([
        ...verifiedNodes.flatMap(node=>node.writeRanges),
        ...writableEdges.map(edge=>edge.range)
      ],romSize);
      const writableNodeIds=new Set([
        ...verifiedNodes.filter(node=>node.writeRanges.length).map(node=>node.id),
        ...writableEdges.map(edge=>edge.source)
      ]);
      const modeledBytes=rangeBytes(modeledRanges),writableBytes=rangeBytes(writableRanges);
      return Object.freeze({
        romBytes:romSize,
        modeledBytes,writableBytes,
        modeledPercent:modeledBytes/romSize*100,
        writablePercent:writableBytes/romSize*100,
        verifiedNodes:verifiedNodes.length,
        writableNodes:writableNodeIds.size,
        verifiedEdges:verifiedEdges.length,
        writableEdges:writableEdges.length,
        modeledRanges,writableRanges
      });
    }
  }

  class ResourceGraphBuilder{
    constructor(){this.nodes=new Map();this.edges=new Map();}
    addNode(node){
      const value=node instanceof ResourceNode?node:new ResourceNode(node);
      const existing=this.nodes.get(value.id);
      if(existing&&existing!==value)throw new Error(`Duplicate resource node ${value.id}.`);
      this.nodes.set(value.id,value);return value;
    }
    addEdge(edge){
      const value=edge instanceof ResourceEdge?edge:new ResourceEdge(edge);
      if(this.edges.has(value.id))throw new Error(`Duplicate resource edge ${value.id}.`);
      this.edges.set(value.id,value);return value;
    }
    addGraph(graph){
      if(!(graph instanceof ResourceGraph))throw new TypeError("Expected a ResourceGraph.");
      for(const node of graph.nodes())this.addNode(node);
      for(const edge of graph.edges())this.addEdge(edge);
      return this;
    }
    build(){return new ResourceGraph(this.nodes.values(),this.edges.values());}
  }

  class ManifestResourceGraph{
    static key(name){return String(name).replaceAll("$","~");}
    static build(memoryProfile){
      if(!memoryProfile?.symbols)return new ResourceGraph();
      const family=String(memoryProfile.family||"");
      if(!TYPE.test(family))throw new TypeError(`Invalid manifest resource family: ${family}.`);
      const memberships=new Map();
      for(const [resourceId,resource] of Object.entries(memoryProfile.resources||{})){
        for(const name of resource.symbols||[]){
          const list=memberships.get(name)||[];list.push(resourceId);memberships.set(name,list);
        }
      }
      const builder=new ResourceGraphBuilder();
      for(const [name,symbol] of Object.entries(memoryProfile.symbols)){
        if(!Number.isSafeInteger(symbol.offset)||!Number.isSafeInteger(symbol.extent)||symbol.extent<1)continue;
        builder.addNode({
          id:ResourceId.create(family,"manifest-symbol",this.key(name)),
          label:name,
          accuracy:memoryProfile.verified?"verified":memoryProfile.exact?"partial":"unknown",
          provenance:{
            fingerprint:memoryProfile.fingerprint,
            origin:memoryProfile.manifestOrigin,
            engineProfile:memoryProfile.engineProfile,
            symbol:name
          },
          ranges:[{offset:symbol.offset,length:symbol.extent}],
          data:{
            kind:symbol.kind||"unknown",
            count:symbol.count??null,
            stride:symbol.stride??null,
            pointerKind:symbol.pointerKind||"unknown",
            ownership:symbol.ownership||"unknown",
            resources:memberships.get(name)||[]
          }
        });
      }
      return builder.build();
    }
  }

  root.resources=Object.freeze({
    ResourceId,ResourceNode,ResourceEdge,ResourceGraph,ResourceGraphBuilder,ManifestResourceGraph,
    kinds:Object.freeze(Array.from(EDGE_KINDS)),
    confidence:Object.freeze(Array.from(CONFIDENCE)),
    rewritePolicies:Object.freeze(Array.from(REWRITE_POLICIES)),
    writablePolicies:Object.freeze(Array.from(WRITABLE_POLICIES))
  });
})(globalThis);
