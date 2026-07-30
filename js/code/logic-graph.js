(function(global){
  "use strict";
  const FRIENDLY=Object.freeze({
    message:"Show dialogue",msgbox:"Show dialogue box",writetext:"Show dialogue",farwritetext:"Show dialogue",
    jumptext:"Show dialogue and finish",farjumptext:"Show dialogue and finish",jumptextfaceplayer:"Face player and talk",
    trainerbattle:"Start trainer encounter",loadtrainer:"Choose trainer",startbattle:"Start battle",setwildbattle:"Prepare wild encounter",
    dowildbattle:"Start wild encounter",loadwildmon:"Choose wild Pokémon",givepoke:"Give Pokémon",givemon:"Give Pokémon",
    giveitem:"Give item",takeitem:"Take item",additem:"Add item",removeitem:"Remove item",
    applymovement:"Move character",applymovementlasttalked:"Move selected character",faceplayer:"Face player",
    warp:"Move player to another map",warpsilent:"Move player silently",warpdoor:"Enter through a door",
    playmusic:"Play music",playbgm:"Play music",playsound:"Play sound",playse:"Play sound effect",cry:"Play Pokémon cry",
    checkflag:"Check a game flag",setflag:"Set a game flag",clearflag:"Clear a game flag",
    checkevent:"Check an event",setevent:"Set an event",clearevent:"Clear an event",
    compare:"Compare two values",ifequal:"If values are equal",ifnotequal:"If values differ",iftrue:"If true",iffalse:"If false",
    call:"Run another script",scall:"Run another script",farscall:"Run another script",
    goto:"Continue at another script",sjump:"Continue at another script",farsjump:"Continue at another script",
    end:"Finish",return:"Return",reloadend:"Reload map and finish",endall:"Finish all scripts",
    waitbuttonpress:"Wait for player",waitbutton:"Wait for player",pause:"Wait",delay:"Wait",
    loadspritegfx:"Load visual effect",unloadspritegfx:"Release visual effect",createsprite:"Create animated sprite",createvisualtask:"Run visual motion",waitforvisualfinish:"Wait for visual effects",
    monbg:"Place battler on effect layer",clearmonbg:"Restore battler layer",setalpha:"Blend layers",blendoff:"Stop blending",fadetobg:"Fade to battle background",restorebg:"Restore battle background",
    anim_obj:"Create battle object",anim_wait:"Wait",anim_sound:"Play animation sound",anim_cry:"Play Pokémon cry",anim_jump:"Continue at animation step",anim_loop:"Repeat animation steps",anim_call:"Run animation sequence",anim_ret:"Return from animation sequence",
    choosetwoturnanim:"Choose move phase",jumpifmoveturn:"Choose attacker turn",jumpargeq:"Check animation argument",jumpifcontest:"Check contest mode",
    anim_if_param_and:"Check animation parameter",anim_if_param_equal:"Compare animation parameter",anim_if_var_equal:"Compare animation variable"
  });
  const GROUPS=Object.freeze({
    dialogue:new Set(["message","msgbox","writetext","farwritetext","jumptext","farjumptext","jumptextfaceplayer","yesorno","multichoice"]),
    condition:new Set(["compare","compare_var_to_var","ifequal","ifnotequal","iftrue","iffalse","ifgreater","ifless","checkflag","checkevent","checkitem","checkmoney","choosetwoturnanim","jumpifmoveturn","jumpargeq","jumpifcontest","anim_if_param_and","anim_if_param_equal","anim_if_var_equal"]),
    battle:new Set(["trainerbattle","loadtrainer","startbattle","setwildbattle","dowildbattle","loadwildmon","givepoke","givemon"]),
    movement:new Set(["applymovement","applymovementlasttalked","faceplayer","turnobject","warp","warpsilent","warpdoor","moveobject"]),
    sound:new Set(["playmusic","playbgm","playsound","playse","cry","playmoncry"]),
    flow:new Set(["call","scall","farscall","goto","sjump","farsjump","return","end","reloadend","endall","anim_call","anim_ret","anim_jump","anim_loop"]),
    animation:new Set(["loadspritegfx","unloadspritegfx","createsprite","createvisualtask","waitforvisualfinish","anim_obj","anim_1gfx","anim_2gfx","anim_3gfx","anim_4gfx","anim_5gfx","anim_bgeffect"])
  });
  const humanize=value=>String(value||"operation").replace(/^_+/,"").replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\b\w/g,letter=>letter.toUpperCase());
  const group=name=>Object.entries(GROUPS).find(([,names])=>names.has(name))?.[0]||"action";

  class ScriptLogicGraph{
    static document(records,{family="unknown",language=""}={}){
      const nodes=(records||[]).map((record,index)=>{
        const name=String(record.name||record.mnemonic||"operation").toLowerCase(),kind=group(name);
        return Object.freeze({
          id:`logic-${record.offset}-${index}`,index,offset:record.offset,size:record.size||1,name,kind,
          title:FRIENDLY[name]||humanize(name),
          summary:this.summary(record,{family,kind}),depth:Math.max(0,Number(record.depth)||0),
          terminal:["end","return","reloadend","endall","goto","sjump","farsjump"].includes(name)
        });
      });
      return Object.freeze({family,language,nodes:Object.freeze(nodes)});
    }
    static summary(record,{family,kind}={}){
      const args=record.args||[],name=String(record.name||record.mnemonic||"").toLowerCase();
      if(record.summary)return record.summary;
      if(name==="loadwildmon"&&args.length>=2)return`Pokémon ${Number(args[0])} at level ${Number(args[1])}`;
      if(name==="setwildbattle"&&args.length>=2)return`Pokémon ${Number(args[0])} at level ${Number(args[1])}`;
      if(["giveitem","takeitem","additem","removeitem"].includes(name)&&args.length)return`Item ${Number(args[0])}${args[1]!==undefined?` · quantity ${Number(args[1])}`:""}`;
      if(kind==="condition")return"Choose the next path from a game condition";
      if(kind==="dialogue")return"Player-facing text";
      if(kind==="flow")return name==="return"||name==="end"?"End this path":"Connect to another logic path";
      if(family==="gb"&&record.mnemonic)return"Low-level engine operation";
      return args.length&&args.every(Number.isFinite)&&args.length<=3?args.map((value,index)=>`Value ${index+1}: ${Number(value)}`).join(" · "):"Game action";
    }
    constructor(element,{onSelect}={}){
      this.element=element;this.onSelect=onSelect;
    }
    render(document){
      this.document=document;
      const nodes=document.nodes.map((node,index)=>Dom.create("div",{className:`logic-node logic-node--${node.kind}`,dataset:{logicId:node.id,logicIndex:index},events:{click:()=>this.select(node)}},[
        index?Dom.create("span",{className:"logic-port logic-port--input",attributes:{title:"Execution input","aria-label":"Execution input"}},[Dom.create("i"),Dom.create("small",{text:"In"})]):null,
        Dom.create("span",{className:"logic-node__icon",text:this.icon(node.kind)}),
        Dom.create("div",{className:"logic-node__body"},[
          Dom.create("strong",{text:node.title}),
          Dom.create("small",{text:node.summary})
        ]),
        node.depth?Dom.create("span",{className:"logic-node__depth",text:`Call ${node.depth}`,attributes:{title:`Inside animation subroutine level ${node.depth}`}}):null,
        node.terminal?Dom.create("span",{className:"logic-node__terminal",text:"End"}):null,
        index<document.nodes.length-1&&!node.terminal?Dom.create("span",{className:"logic-port logic-port--output",attributes:{title:"Execution output","aria-label":"Execution output"}},[Dom.create("small",{text:node.kind==="condition"?"True":"Out"}),Dom.create("i")]):null,
        node.kind==="condition"&&!node.terminal?Dom.create("span",{className:"logic-port logic-port--branch",attributes:{title:"False branch","aria-label":"False branch"}},[Dom.create("small",{text:"False"}),Dom.create("i")]):null
      ].filter(Boolean)));
      const graph=global.document.createElementNS("http://www.w3.org/2000/svg","svg");graph.setAttribute("class","logic-graph__edges");graph.setAttribute("aria-hidden","true");
      const canvas=Dom.create("div",{className:"logic-graph__canvas"},nodes.length?[graph,...nodes]:[Dom.create("p",{className:"logic-graph__empty",text:"No verified logic steps were decoded here."})]);
      this.element.replaceChildren(
        Dom.create("header",{className:"logic-graph__header"},[
          Dom.create("div",{},[Dom.create("strong",{text:"Visual logic"}),Dom.create("small",{text:`${document.nodes.length} steps · ${document.language||"game engine"}`})]),
          Dom.create("span",{className:"logic-graph__mode",text:/animation/i.test(document.language)?`${document.family==="gba"?"GBA":document.family==="gen2"?"Crystal":"GB"} animation`:document.family==="gba"?"GBA events":document.family==="gen2"?"Crystal events":"GB engine"})
        ]),
        canvas
      );
      if(nodes.length)requestAnimationFrame(()=>this.drawEdges());
      return this;
    }
    drawEdges(){
      const canvas=this.element.querySelector(".logic-graph__canvas"),svg=canvas?.querySelector(".logic-graph__edges"),nodes=[...(canvas?.querySelectorAll(".logic-node")||[])];if(!canvas||!svg||nodes.length<2)return;
      const bounds=canvas.getBoundingClientRect();svg.setAttribute("viewBox",`0 0 ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`);svg.replaceChildren();
      for(let index=0;index<nodes.length-1;index++){
        const from=nodes[index].querySelector(".logic-port--output i"),to=nodes[index+1].querySelector(".logic-port--input i");if(!from||!to)continue;
        const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),x1=a.left+a.width/2-bounds.left,y1=a.top+a.height/2-bounds.top,x2=b.left+b.width/2-bounds.left,y2=b.top+b.height/2-bounds.top,bend=Math.max(32,Math.abs(x2-x1)*.46);
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`);path.setAttribute("class","logic-edge");svg.append(path);
      }
    }
    select(node){
      this.element.querySelector(".logic-node.selected")?.classList.remove("selected");
      this.element.querySelector(`[data-logic-id="${node.id}"]`)?.classList.add("selected");
      this.onSelect?.(node);return node;
    }
    icon(kind){return({dialogue:"T",condition:"?",battle:"⚔",movement:"➜",sound:"♪",flow:"↗",animation:"✦",action:"◆"})[kind]||"◆";}
  }
  global.ScriptLogicGraph=ScriptLogicGraph;
  ((global.PokemonViewer||={}).code||={}).ScriptLogicGraph=ScriptLogicGraph;
})(globalThis);
