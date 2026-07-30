(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={});ns.animation||={};
  ns.animation.registry=ns.animation.registry||new DriverRegistry("Animation");
  const DOMAINS=Object.freeze({
    pokemon:Object.freeze({label:"Pokémon",icon:"fa-paw"}),
    trainer:Object.freeze({label:"Trainer & Poké Ball",icon:"fa-person-running"}),
    move:Object.freeze({label:"Moves",icon:"fa-wand-magic-sparkles"}),
    status:Object.freeze({label:"Battle status",icon:"fa-heart-pulse"}),
    transition:Object.freeze({label:"Transitions",icon:"fa-right-left"}),
    scene:Object.freeze({label:"Scenes",icon:"fa-film"}),
    tile:Object.freeze({label:"Tiles",icon:"fa-table-cells"}),
    interface:Object.freeze({label:"Interface",icon:"fa-window-maximize"}),
    palette:Object.freeze({label:"Palette & camera",icon:"fa-palette"})
  });
  const cloneState=state=>Object.freeze({
    resources:Object.freeze([...state.resources]),
    sprites:Object.freeze([...state.sprites]),
    tasks:Object.freeze([...state.tasks]),
    sceneTransforms:Object.freeze([...(state.sceneTransforms||[])]),
    sounds:Object.freeze([...state.sounds]),
    background:state.background,
    palette:state.palette,
    blend:state.blend,
    visibility:state.visibility,
    note:state.note
  });
  class AnimationProgram{
    static frames(commands=[]){
      const state={resources:[],sprites:[],tasks:[],sceneTransforms:[],sounds:[],background:null,palette:null,blend:null,visibility:"visible",note:""};
      const frames=[];
      commands.forEach((command,index)=>{
        const event=command.event||{},value=event.value??command.label;
        if(event.kind==="resource"){
          const identity=item=>(item?.tag??item?.id??item),values=Array.isArray(value)?value:[value],keys=new Set(values.map(identity));
          state.resources=event.remove?state.resources.filter(item=>!keys.has(identity(item))):[...state.resources.filter(item=>!keys.has(identity(item))),...values].slice(-8);
        }
        if(event.kind==="sprite")state.sprites=[...state.sprites,value].slice(-10);
        if(event.kind==="clear-sprites")state.sprites=[];
        if(event.kind==="task")state.tasks=[...state.tasks,value].slice(-5);
        if(event.kind==="clear-tasks")state.tasks=[];
        if(event.kind==="wait-visuals"){
          // In the native engine this command advances only after every
          // animation sprite/task has destroyed itself. Resolved callbacks
          // already emitted their frames; the next state begins cleanly.
          state.sprites=[];
          state.tasks=[];
        }
        if(event.kind==="sound")state.sounds=[...state.sounds,value].slice(-4);
        if(event.sound)state.sounds=[...state.sounds,event.sound].slice(-4);
        if(event.kind==="background")state.background=value;
        if(event.kind==="palette")state.palette=value;
        if(event.kind==="blend")state.blend=value;
        if(event.kind==="visibility")state.visibility=value;
        state.note=event.note||command.source||command.label||"";
        const sequence=value?.asset?.frames;
        if(Array.isArray(sequence)&&sequence.length&&event.kind==="sprite"){
          const spriteIndex=state.sprites.length-1,base=state.sprites[spriteIndex];
          sequence.forEach((nativeFrame,frameIndex)=>{
            const sequenceState={...state,sprites:[...state.sprites]};
            sequenceState.sprites[spriteIndex]=Object.freeze({...base,asset:Object.freeze({...base.asset,canvas:nativeFrame.canvas,nativeFrame})});
            frames.push(Object.freeze({command:index,label:`${command.label} · frame ${frameIndex+1}`,duration:Math.max(1,Number(nativeFrame.duration)||Number(command.duration)||1),state:cloneState(sequenceState)}));
          });
          if(event.transient)state.sprites=state.sprites.filter((_,index)=>index!==spriteIndex);
          else{
            const nativeFrame=sequence.at(-1);
            state.sprites[spriteIndex]=Object.freeze({...base,asset:Object.freeze({...base.asset,canvas:nativeFrame.canvas,nativeFrame})});
          }
        }else frames.push(Object.freeze({command:index,label:command.label,duration:Math.max(1,Number(command.duration)||1),state:cloneState(state)}));
      });
      return frames;
    }
  }
  class NativeAnimationProgram{
    static frames(commands=[]){
      const state={resources:[],sprites:[],tasks:[],sceneTransforms:[],sounds:[],background:null,palette:null,blend:null,visibility:"visible",note:""};
      const actors=[],taskActors=[],frames=[];
      const identity=item=>(item?.tag??item?.id??item);
      const snapshot=(command,label)=>{
        const sprites=actors.map(actor=>{
          const nativeFrame=actor.ticks[Math.min(actor.age,actor.ticks.length-1)]||null;
          return nativeFrame?Object.freeze({...actor.value,asset:Object.freeze({...actor.value.asset,canvas:nativeFrame.canvas,nativeFrame})}):actor.value;
        });
        const sceneTransforms=taskActors.map(actor=>Object.freeze({
          id:actor.value.id,label:actor.value.label,target:actor.value.target,
          ...(actor.ticks[Math.min(actor.age,actor.ticks.length-1)]||{})
        }));
        frames.push(Object.freeze({command,label,duration:1,state:cloneState({...state,sprites,sceneTransforms})}));
      };
      const advance=(count,command,label)=>{
        for(let tick=0;tick<count;tick++){
          snapshot(command,label);
          for(let index=actors.length-1;index>=0;index--){
            const actor=actors[index];actor.age++;
            if(actor.transient&&actor.age>=actor.ticks.length)actors.splice(index,1);
          }
          for(let index=taskActors.length-1;index>=0;index--){
            const actor=taskActors[index];actor.age++;
            if(actor.transient&&actor.age>=actor.ticks.length)taskActors.splice(index,1);
          }
        }
      };
      const addTaskActor=(value,event)=>{
        if(!value||!Array.isArray(value.frames)||!value.frames.length)return;
        const ticks=value.frames.flatMap(frame=>Array.from({length:Math.max(1,Number(frame.duration)||1)},()=>frame));
        taskActors.push({value,transient:event.transient!==false,ticks,age:0});
      };
      const addActor=(value,event)=>{
        const sequence=value?.asset?.frames;
        if(!Array.isArray(sequence)||!sequence.length){actors.push({value,transient:false,ticks:[],age:0});return;}
        const ticks=sequence.flatMap(frame=>Array.from({length:Math.max(1,Number(frame.duration)||1)},()=>frame));
        actors.push({value,transient:Boolean(event.transient),ticks,age:0});
      };
      commands.forEach((command,index)=>{
        const event=command.event||{},value=event.value??command.label;
        if(event.kind==="resource"){
          const values=Array.isArray(value)?value:[value],keys=new Set(values.map(identity));
          state.resources=event.remove?state.resources.filter(item=>!keys.has(identity(item))):[...state.resources.filter(item=>!keys.has(identity(item))),...values].slice(-8);
        }
        if(event.kind==="sprite")addActor(value,event);
        if(event.kind==="clear-sprites"){actors.length=0;}
        if(event.kind==="task"){
          state.tasks=[...state.tasks,value].slice(-5);
          addTaskActor(value,event);
        }
        if(event.kind==="clear-tasks"){state.tasks=[];taskActors.length=0;}
        if(event.kind==="sound")state.sounds=[...state.sounds,value].slice(-4);
        if(event.sound)state.sounds=[...state.sounds,event.sound].slice(-4);
        if(event.kind==="background")state.background=value;
        if(event.kind==="palette")state.palette=value;
        if(event.kind==="blend")state.blend=value;
        if(event.kind==="visibility")state.visibility=value;
        state.note=event.note||command.source||command.label||"";

        if(event.kind==="wait-visuals"){
          const visualActors=[...actors,...taskActors],
            remaining=visualActors.reduce((maximum,actor)=>Math.max(maximum,actor.ticks.length-actor.age),0);
          if(remaining)advance(Math.min(1200,remaining),index,command.label);
          actors.length=0;taskActors.length=0;state.tasks=[];state.sceneTransforms=[];
        }else if(command.track==="wait"){
          advance(Math.max(1,Number(command.duration)||1),index,command.label);
        }else if(command.track==="sprite"&&command.opcode<0xc0){
          // Gen I embeds the display duration in its subanimation record.
          advance(Math.max(1,Number(command.duration)||1),index,command.label);
        }
      });
      if(!frames.length)snapshot(Math.max(0,commands.length-1),commands.at(-1)?.label||"Animation");
      return Object.freeze(frames);
    }
  }
  class AnimationDocument{
    constructor({id,name,type="sprite",domain="scene",fps=60,offset=null,commands=[],frames=null,accuracy="partial",properties=[],editable=false,editor=null,source=null,references={},diagnostic=null,scene=null}={}){
      Object.assign(this,{id,name,type,domain,fps,offset,commands,frames:frames||AnimationProgram.frames(commands),accuracy,properties,editable,editor,source,references,diagnostic,scene});
    }
  }
  class AnimationCatalog{
    constructor(){this.providers=[];this.diagnostics=[];}
    add(provider){if(provider&&typeof provider.list==="function")this.providers.push(provider);return this;}
    list(){
      this.diagnostics=[];
      return this.providers.flatMap((provider,index)=>{
        try{return provider.list()||[];}
        catch(error){this.diagnostics.push(Object.freeze({provider:index,error}));return[];}
      }).filter(Boolean);
    }
  }
  ns.animation.DOMAINS=DOMAINS;
  ns.animation.AnimationDocument=AnimationDocument;
  ns.animation.AnimationCatalog=AnimationCatalog;
  ns.animation.AnimationProgram=AnimationProgram;
  ns.animation.NativeAnimationProgram=NativeAnimationProgram;
})(globalThis);
