import dagre from "../../node_modules/@dagrejs/dagre/dist/dagre.esm.js";

if(
  !dagre ||
  typeof dagre.layout !== "function" ||
  typeof dagre.graphlib?.Graph !== "function"
){
  throw new Error("The installed @dagrejs/dagre module is incompatible with UiGraphLayout.");
}

globalThis.dagre = dagre;
