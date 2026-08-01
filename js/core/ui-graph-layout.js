(function(global){
  "use strict";
  class UiGraphLayout{
    static directed({nodes=[],edges=[],direction="LR",nodeGap=34,rankGap=96,margin=56}={}){
      const dagre=global.dagre;
      if(typeof dagre?.layout!=="function"||typeof dagre?.graphlib?.Graph!=="function"){
        throw new Error("Directed graph layout is unavailable. Load @dagrejs/dagre before UiGraphLayout.");
      }
      const graph=new dagre.graphlib.Graph({multigraph:true});
      graph.setGraph({rankdir:direction,nodesep:nodeGap,ranksep:rankGap,edgesep:18,marginx:margin,marginy:margin,acyclicer:"greedy",ranker:"tight-tree",align:"UL"});
      graph.setDefaultEdgeLabel(()=>({}));
      for(const node of nodes)graph.setNode(String(node.id),{width:Number(node.width)||240,height:Number(node.height)||96});
      edges.forEach((edge,index)=>{
        const kind=edge.kind||"flow";
        graph.setEdge(String(edge.from),String(edge.to),{id:String(edge.id??index),kind,weight:kind==="flow"?12:kind==="data"?6:2,minlen:1},String(edge.id??index));
      });
      dagre.layout(graph);
      const positions=new Map(nodes.map(node=>{
        const result=graph.node(String(node.id));
        return [String(node.id),Object.freeze({x:result.x-result.width/2,y:result.y-result.height/2,width:result.width,height:result.height})];
      }));
      const routes=new Map(edges.map((edge,index)=>{
        const id=String(edge.id??index),result=graph.edge({v:String(edge.from),w:String(edge.to),name:id});
        return [id,Object.freeze((result?.points||[]).map(point=>Object.freeze({x:point.x,y:point.y})))];
      }));
      const meta=graph.graph();
      return Object.freeze({width:Math.ceil(meta.width||0),height:Math.ceil(meta.height||0),positions,routes});
    }
  }
  global.UiGraphLayout=UiGraphLayout;
  ((global.PokemonViewer||={}).ui||={}).GraphLayout=UiGraphLayout;
})(globalThis);
