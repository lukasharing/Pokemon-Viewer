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
  const normalizeInput=(input,index)=>Object.freeze({
    id:String(input?.id??input?.name??`arg-${index}`),
    label:String(input?.label??`Input ${index+1}`),
    type:["number","select","pointer","text"].includes(input?.type)?input.type:"text",
    value:input?.value??"",
    editable:Boolean(input?.editable),
    min:Number.isFinite(input?.min)?Number(input.min):null,
    max:Number.isFinite(input?.max)?Number(input.max):null,
    options:Object.freeze([...(input?.options||[])])
  });

  class ScriptLogicGraph{
    static document(records,{family="unknown",language=""}={}){
      const nodes=(records||[]).map((record,index)=>{
        const name=String(record.name||record.mnemonic||"operation").toLowerCase(),kind=group(name);
        return Object.freeze({
          id:`logic-${record.offset}-${index}`,index,offset:record.offset,size:record.size||1,name,kind,
          title:FRIENDLY[name]||humanize(name),
          summary:this.summary(record,{family,kind}),depth:Math.max(0,Number(record.depth)||0),
          terminal:["end","return","reloadend","endall","goto","sjump","farsjump"].includes(name),
          control:record.control||null,
          inputs:Object.freeze((record.inputs||[]).map(normalizeInput))
        });
      });
      const byOffset=new Map(nodes.map(node=>[node.offset,node.index])),edges=[];
      nodes.forEach((node,index)=>{
        const control=node.control,targets=(control?.targets||[]).map(value=>byOffset.get(Number(value))).filter(Number.isInteger);
        if(control?.kind==="jump"){
          targets.forEach(to=>edges.push(Object.freeze({from:index,to,label:"Jump",port:"output"})));return;
        }
        if(control?.kind==="return")return;
        if(control?.conditional||control?.kind==="branch"){
          if(index+1<nodes.length)edges.push(Object.freeze({from:index,to:index+1,label:"Continue",port:"output"}));
          targets.forEach(to=>edges.push(Object.freeze({from:index,to,label:"Condition",port:"branch"})));return;
        }
        if(control?.kind==="call"){
          targets.forEach(to=>edges.push(Object.freeze({from:index,to,label:"Call",port:"branch"})));
          if(index+1<nodes.length)edges.push(Object.freeze({from:index,to:index+1,label:"Return",port:"output"}));return;
        }
        if(control?.kind==="loop"){
          targets.forEach(to=>edges.push(Object.freeze({from:index,to,label:"Repeat",port:"branch"})));
          if(index+1<nodes.length)edges.push(Object.freeze({from:index,to:index+1,label:"Exit",port:"output"}));return;
        }
        if(index+1<nodes.length&&!node.terminal)edges.push(Object.freeze({from:index,to:index+1,label:"Next",port:"output"}));
      });
      const dataNodes=nodes.filter(node=>node.inputs.length).map(node=>Object.freeze({
        id:`${node.id}-controls`,owner:node.index,title:`${node.title} inputs`,inputs:node.inputs
      }));
      const dataEdges=dataNodes.map(node=>Object.freeze({from:node.id,to:nodes[node.owner].id,label:"Values",port:"data"}));
      return Object.freeze({family,language,nodes:Object.freeze(nodes),edges:Object.freeze(edges),dataNodes:Object.freeze(dataNodes),dataEdges:Object.freeze(dataEdges)});
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
    constructor(element,{onSelect,onInputChange}={}){
      this.element=element;this.onSelect=onSelect;this.onInputChange=onInputChange;
    }
    input(node,input){
      const attributes={
        "data-logic-input":input.id,
        "aria-label":`${node.title}: ${input.label}`
      };
      let control;
      if(input.editable&&input.type==="select"){
        control=Dom.create("select",{attributes,events:{click:event=>event.stopPropagation(),change:event=>this.changeInput(event,node,input)}},
          input.options.map(option=>{
            const value=typeof option==="object"?option.value:option,label=typeof option==="object"?option.label:option;
            return Dom.create("option",{text:String(label),attributes:{value},properties:{selected:String(value)===String(input.value)}});
          })
        );
      }else if(input.editable){
        const inputAttributes={...attributes,type:input.type==="number"?"number":"text",value:input.value};
        if(input.min!==null)inputAttributes.min=input.min;
        if(input.max!==null)inputAttributes.max=input.max;
        control=Dom.create("input",{attributes:inputAttributes,events:{click:event=>event.stopPropagation(),change:event=>this.changeInput(event,node,input)}});
      }else control=Dom.create("output",{text:String(input.value),attributes:{title:String(input.value)}});
      return Dom.create("label",{className:`logic-data-input logic-data-input--${input.type}`},[
        Dom.create("span",{},[Dom.create("i"),Dom.create("small",{text:input.label})]),
        control
      ]);
    }
    changeInput(event,node,input){
      event.stopPropagation();
      const value=input.type==="number"?Number(event.target.value):event.target.value;
      this.onInputChange?.(node,input,value,event.target);
    }
    render(document){
      this.document=document;
      const nodes=document.nodes.map((node,index)=>Dom.create("div",{className:`logic-node logic-node--${node.kind}`,dataset:{logicId:node.id,logicIndex:index},attributes:{style:`grid-row:${index+1}`},events:{click:()=>this.select(node)}},[
        document.edges.some(edge=>edge.to===index)?Dom.create("span",{className:"logic-port logic-port--input",attributes:{title:"Execution input","aria-label":"Execution input"}},[Dom.create("i"),Dom.create("small",{text:"In"})]):null,
        document.dataEdges?.some(edge=>edge.to===node.id)?Dom.create("span",{className:"logic-port logic-port--data",attributes:{title:"Typed values","aria-label":"Typed value inputs"}},[Dom.create("i"),Dom.create("small",{text:"Data"})]):null,
        Dom.create("span",{className:"logic-node__icon",text:this.icon(node.kind)}),
        Dom.create("div",{className:"logic-node__body"},[
          Dom.create("strong",{text:node.title}),
          Dom.create("small",{text:node.summary})
        ]),
        node.depth?Dom.create("span",{className:"logic-node__depth",text:`Call ${node.depth}`,attributes:{title:`Inside animation subroutine level ${node.depth}`}}):null,
        node.terminal?Dom.create("span",{className:"logic-node__terminal",text:"End"}):null,
        document.edges.some(edge=>edge.from===index&&edge.port==="output")?Dom.create("span",{className:"logic-port logic-port--output",attributes:{title:"Primary execution path","aria-label":"Primary execution path"}},[Dom.create("small",{text:node.control?.conditional?"Continue":"Out"}),Dom.create("i")]):null,
        document.edges.some(edge=>edge.from===index&&edge.port==="branch")||node.control?.unresolved?Dom.create("span",{className:"logic-port logic-port--branch",attributes:{title:node.control?.unresolved?"Runtime-dependent path; shown without guessing":"Alternate execution path","aria-label":"Alternate execution path"}},[Dom.create("small",{text:node.control?.unresolved?"Runtime":"Branch"}),Dom.create("i")]):null
      ].filter(Boolean)));
      const dataNodes=(document.dataNodes||[]).map(data=>{
        const owner=document.nodes[data.owner];
        return Dom.create("div",{className:"logic-data-node",dataset:{logicDataId:data.id},attributes:{style:`grid-row:${data.owner+1}`}},[
          Dom.create("header",{},[Dom.create("span",{text:"Control"}),Dom.create("small",{text:owner.title})]),
          Dom.create("div",{className:"logic-node__inputs"},data.inputs.map(input=>this.input(owner,input))),
          Dom.create("span",{className:"logic-port logic-port--data-output",attributes:{title:"Values supplied to operation","aria-label":"Value output"}},[Dom.create("small",{text:"Values"}),Dom.create("i")])
        ]);
      });
      const graph=global.document.createElementNS("http://www.w3.org/2000/svg","svg");graph.setAttribute("class","logic-graph__edges");graph.setAttribute("aria-hidden","true");
      const canvas=Dom.create("div",{className:"logic-graph__canvas"},nodes.length?[graph,...dataNodes,...nodes]:[Dom.create("p",{className:"logic-graph__empty",text:"No verified logic steps were decoded here."})]);
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
      const canvas=this.element.querySelector(".logic-graph__canvas"),svg=canvas?.querySelector(".logic-graph__edges"),nodes=[...(canvas?.querySelectorAll(".logic-node")||[])];if(!canvas||!svg||!nodes.length)return;
      const bounds=canvas.getBoundingClientRect();svg.setAttribute("viewBox",`0 0 ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`);svg.replaceChildren();
      for(const edge of this.document.edges||[]){
        const from=nodes[edge.from]?.querySelector(`.logic-port--${edge.port} i`),to=nodes[edge.to]?.querySelector(".logic-port--input i");if(!from||!to)continue;
        const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),x1=a.left+a.width/2-bounds.left,y1=a.top+a.height/2-bounds.top,x2=b.left+b.width/2-bounds.left,y2=b.top+b.height/2-bounds.top,bend=Math.max(32,Math.abs(x2-x1)*.46);
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`);path.setAttribute("class",`logic-edge${edge.port==="branch"?" logic-edge--branch":""}`);svg.append(path);
      }
      for(const edge of this.document.dataEdges||[]){
        const from=canvas.querySelector(`[data-logic-data-id="${edge.from}"] .logic-port--data-output i`),to=canvas.querySelector(`[data-logic-id="${edge.to}"] .logic-port--data i`);if(!from||!to)continue;
        const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),x1=a.left+a.width/2-bounds.left,y1=a.top+a.height/2-bounds.top,x2=b.left+b.width/2-bounds.left,y2=b.top+b.height/2-bounds.top,bend=Math.max(24,(x2-x1)*.42);
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`);path.setAttribute("class","logic-edge logic-edge--data");svg.append(path);
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
