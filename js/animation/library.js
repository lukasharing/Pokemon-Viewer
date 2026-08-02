(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={});ns.animation||={};
  ns.animation.registry=ns.animation.registry||new DriverRegistry("Animation");
  const DOMAINS=Object.freeze({
    pokemon:Object.freeze({label:"Pokémon",icon:"fa-paw"}),
    trainer:Object.freeze({label:"Trainer & Poké Ball",icon:"fa-person-running"}),
    move:Object.freeze({label:"Moves",icon:"fa-wand-magic-sparkles"}),
    status:Object.freeze({label:"Battle status",icon:"fa-heart-pulse"}),
    effect:Object.freeze({label:"Visual effects",icon:"fa-sparkles"}),
    transition:Object.freeze({label:"Transitions",icon:"fa-right-left"}),
    scene:Object.freeze({label:"Scenes",icon:"fa-film"}),
    tile:Object.freeze({label:"Tiles",icon:"fa-table-cells"}),
    interface:Object.freeze({label:"Interface",icon:"fa-window-maximize"}),
    palette:Object.freeze({label:"Palette & camera",icon:"fa-palette"})
  });
  const BATTLE_DIRECTIONS=Object.freeze([
    Object.freeze({id:"player-to-rival",label:"Player → Rival",attackerSide:"player"}),
    Object.freeze({id:"rival-to-player",label:"Rival → Player",attackerSide:"rival"})
  ]);
  class AnimationBattleContext{
    static list(){return BATTLE_DIRECTIONS;}
    static get(id){
      const value=BATTLE_DIRECTIONS.find(item=>item.id===id);
      if(!value)throw new RangeError(`Unknown battle animation direction '${String(id)}'.`);
      return value;
    }
    static scene(scene,id="player-to-rival"){
      if(!scene)return null;
      const direction=this.get(id),anchors=scene.anchors||{};
      if(direction.attackerSide==="player")return Object.freeze({...scene,direction,roles:Object.freeze({player:"user",opponent:"target"})});
      return Object.freeze({
        ...scene,direction,
        roles:Object.freeze({player:"target",opponent:"user"}),
        anchors:Object.freeze({
          ...anchors,
          user:anchors.target??anchors.opponent,
          target:anchors.user??anchors.player,
          userBase:anchors.targetBase??anchors.opponentBase??anchors.target,
          targetBase:anchors.userBase??anchors.playerBase??anchors.user,
          userPic:anchors.targetPic??anchors.opponent,
          targetPic:anchors.userPic??anchors.player
        })
      });
    }
    static documentOptions(id="player-to-rival"){
      const direction=this.get(id);
      return Object.freeze({context:direction.id,contexts:BATTLE_DIRECTIONS,direction});
    }
  }
  const cloneState=state=>Object.freeze({
    resources:Object.freeze([...state.resources]),
    sprites:Object.freeze([...state.sprites]),
    tasks:Object.freeze([...state.tasks]),
    sceneTracks:Object.freeze([...(state.sceneTracks||[])]),
    sounds:Object.freeze([...state.sounds]),
    background:state.background,
    palette:state.palette,
    blend:state.blend,
    visibility:state.visibility,
    note:state.note
  });
  const applyVisibility=(state,value)=>{
    if(!value||typeof value!=="object"||!["user","target"].includes(value.target)){
      state.visibility=value;
      return;
    }
    const current=state.visibility&&typeof state.visibility==="object"
      ?state.visibility
      :{user:state.visibility!=="hidden",target:state.visibility!=="hidden"};
    state.visibility=Object.freeze({...current,[value.target]:Boolean(value.visible)});
  };
  class AnimationProgram{
    static frames(commands=[]){
      const state={resources:[],sprites:[],tasks:[],sceneTracks:[],sounds:[],background:null,palette:null,blend:null,visibility:"visible",note:""};
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
        if(event.kind==="background")state.background=Object.prototype.hasOwnProperty.call(event,"value")?event.value:value;
        if(event.kind==="palette")state.palette=value;
        if(event.kind==="blend")state.blend=value;
        if(event.kind==="visibility")applyVisibility(state,value);
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
  class AnimationProgramView{
    static opcode(command,index=0){
      const source=typeof command?.source==="string"?command.source:"";
      return command?.opcodeName||command?.mnemonic||source.match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1]||`${command?.track||"step"}-${index+1}`;
    }
    static records(document){
      return Object.freeze((document?.commands||[]).map((command,index)=>Object.freeze({
        offset:command.offset??index,size:command.size||1,name:this.opcode(command,index),
        args:command.args||command.operands||[],inputLabels:command.inputLabels||[],
        summary:command.summary||command.event?.note||null,depth:command.callDepth||0,
        control:command.control||null,command,index
      })));
    }
  }
  class NativeAnimationProgram{
    static frames(commands=[]){
      const state={resources:[],sprites:[],tasks:[],sceneTracks:[],sounds:[],background:null,palette:null,blend:null,visibility:"visible",note:""};
      const actors=[],taskActors=[],persistentTracks=new Map(),frames=[];
      const identity=item=>(item?.tag??item?.id??item);
      const snapshot=(command,label)=>{
        const sprites=actors.map(actor=>{
          const nativeFrame=actor.ticks[Math.min(actor.age,actor.ticks.length-1)]||null;
          return nativeFrame?Object.freeze({...actor.value,asset:Object.freeze({...actor.value.asset,canvas:nativeFrame.canvas,nativeFrame})}):actor.value;
        });
        const activeTracks=taskActors.map(actor=>Object.freeze({
          id:actor.value.id,label:actor.value.label,target:actor.value.target,
          channel:actor.value.channel,
          ...(actor.ticks[actor.loop?actor.age%actor.ticks.length:Math.min(actor.age,actor.ticks.length-1)]||{})
        })),activeChannels=new Set(activeTracks.map(track=>track.channel).filter(Boolean)),
          sceneTracks=[...persistentTracks.values()].filter(track=>!activeChannels.has(track.channel)).concat(activeTracks);
        frames.push(Object.freeze({command,label,duration:1,state:cloneState({...state,sprites,sceneTracks})}));
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
            if(!actor.independent&&actor.transient&&actor.age>=actor.ticks.length){
              if(actor.value.persistFinal&&actor.value.channel){
                persistentTracks.set(actor.value.channel,Object.freeze({
                  id:actor.value.id,label:actor.value.label,target:actor.value.target,
                  channel:actor.value.channel,...(actor.ticks.at(-1)||{})
                }));
              }
              taskActors.splice(index,1);
            }
          }
        }
      };
      const addTaskActor=(value,event)=>{
        if(!value||!Array.isArray(value.frames)||!value.frames.length)return;
        const ticks=value.frames.flatMap(frame=>Array.from({length:Math.max(1,Number(frame.duration)||1)},()=>frame));
        taskActors.push({
          value,transient:event.transient!==false,ticks,age:0,
          independent:Boolean(value.independent),loop:Boolean(value.loop)
        });
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
        if(event.kind==="clear-tasks"){state.tasks=[];taskActors.length=0; persistentTracks.clear();}
        if(event.kind==="sound")state.sounds=[...state.sounds,value].slice(-4);
        if(event.sound)state.sounds=[...state.sounds,event.sound].slice(-4);
        if(event.kind==="background")state.background=Object.prototype.hasOwnProperty.call(event,"value")?event.value:value;
        if(event.kind==="palette")state.palette=value;
        if(event.kind==="blend")state.blend=value;
        if(event.kind==="visibility")applyVisibility(state,value);
        state.note=event.note||command.source||command.label||"";
        if(command.opcode===0x10){
          const arg=Number(command.args?.[0]),signal=(Number(command.args?.[1])||0)|(Number(command.args?.[2])||0)<<8;
          for(let actorIndex=taskActors.length-1;actorIndex>=0;actorIndex--){
            const stop=taskActors[actorIndex].value.stopSignal;
            if(stop&&Number(stop.arg)===arg&&Number(stop.value)===signal)taskActors.splice(actorIndex,1);
          }
          state.tasks=taskActors.map(actor=>actor.value).slice(-5);
        }

        if(event.kind==="wait-visuals"){
          const visualActors=[...actors,...taskActors.filter(actor=>!actor.independent)],
            remaining=visualActors.reduce((maximum,actor)=>Math.max(maximum,actor.ticks.length-actor.age),0);
          if(remaining)advance(Math.min(1200,remaining),index,command.label);
          actors.length=0;
          for(let actorIndex=taskActors.length-1;actorIndex>=0;actorIndex--){
            if(!taskActors[actorIndex].independent)taskActors.splice(actorIndex,1);
          }
          state.tasks=taskActors.map(actor=>actor.value).slice(-5);
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
    constructor({id,name,type="sprite",domain="scene",fps=null,offset=null,commands=[],frames=null,accuracy="partial",properties=[],editable=false,editor=null,source=null,references={},diagnostic=null,scene=null,context=null,contexts=[],layers=[]}={}){
      const normalizedLayers=Object.freeze((layers||[]).map((layer,index)=>Object.freeze({
        ...layer,sourceLabel:layer.sourceLabel||layer.label||null,label:`Layer ${index+1}`,index
      })));
      Object.assign(this,{id,name,type,domain,fps,offset,commands,frames:frames||AnimationProgram.frames(commands),accuracy,properties,editable,editor,source,references,diagnostic,scene,context,contexts,layers:normalizedLayers});
    }
  }
  class AnimationCatalog{
    constructor(){this.providers=[];this.diagnostics=[];}
    add(provider){if(provider&&typeof provider.list==="function")this.providers.push(provider);return this;}
    list(){
      this.diagnostics=[];
      return this.providers.flatMap((provider,index)=>{
        try{
          const documents=provider.list()||[];
          for(const diagnostic of provider.diagnostics||[])this.diagnostics.push(Object.freeze({provider:index,...diagnostic}));
          return documents;
        }
        catch(error){this.diagnostics.push(Object.freeze({provider:index,error}));return[];}
      }).filter(Boolean);
    }
    async listAsync({signal=null,chunkSize=8}={}){
      this.diagnostics=[];const result=[];
      for(let index=0;index<this.providers.length;index++){
        if(signal?.aborted)throw signal.reason||new DOMException("Cancelled","AbortError");
        const provider=this.providers[index];
        try{
          const documents=typeof provider.listAsync==="function"
            ?await provider.listAsync({signal,chunkSize})
            :provider.list()||[];
          result.push(...documents);
          for(const diagnostic of provider.diagnostics||[])this.diagnostics.push(Object.freeze({provider:index,...diagnostic}));
          await ProjectScheduler.idle();
        }catch(error){
          if(error?.name==="AbortError")throw error;
          this.diagnostics.push(Object.freeze({provider:index,error}));
        }
      }
      return result.filter(Boolean);
    }
  }
  class AnimationEntryProvider{
    constructor({id="animations",entries,document}={}){
      if(typeof entries!=="function"||typeof document!=="function")throw new TypeError("AnimationEntryProvider requires entry and document factories.");
      this.id=id;this.entries=entries;this.createDocument=document;this.diagnostics=[];
    }
    list(){
      this.diagnostics=[];
      const entries=this.entries()||[];
      if(!Array.isArray(entries))throw new TypeError(`${this.id} entries must be an array.`);
      return entries.map((entry,index)=>{
        try{return this.createDocument(entry,index)||null;}
        catch(error){this.diagnostics.push(Object.freeze({id:entry?.id??`${this.id}:${index}`,error}));return null;}
      }).filter(Boolean);
    }
    async listAsync({signal=null,chunkSize=8}={}){
      this.diagnostics=[];const entries=this.entries()||[],documents=[];let index=0;
      if(!Array.isArray(entries))throw new TypeError(`${this.id} entries must be an array.`);
      for await(const chunk of ProjectScheduler.chunks(entries,chunkSize,{signal}))for(const entry of chunk){
        try{const document=this.createDocument(entry,index);if(document)documents.push(document);}
        catch(error){this.diagnostics.push(Object.freeze({id:entry?.id??`${this.id}:${index}`,error}));}
        index++;
      }
      return documents;
    }
  }
  class AnimationDocumentResolver{
    static referenceMatches(actual,expected){
      if(Array.isArray(actual))return actual.some(value=>this.referenceMatches(value,expected));
      if(Array.isArray(expected))return expected.every(value=>this.referenceMatches(actual,value));
      return actual!=null&&String(actual)===String(expected);
    }
    static resolve(documents=[],request={}){
      const source=documents.filter(Boolean),documentId=request.documentId??request.id;
      if(documentId!=null){
        const exact=source.find(document=>String(document.id)===String(documentId));
        if(exact)return exact;
      }
      const references={...(request.references||{})};
      if(Number.isInteger(request.species))references.speciesId=request.species;
      if(Number.isInteger(request.move))references.moveId=request.move;
      if(Number.isInteger(request.animation))references.animationId=request.animation;
      const entries=Object.entries(references).filter(([,value])=>value!=null),
        candidates=request.domain?source.filter(document=>document.domain===request.domain):source;
      if(entries.length){
        const match=candidates.find(document=>entries.every(([key,value])=>this.referenceMatches(document.references?.[key],value)));
        if(match)return match;
      }
      if(request.domain)return candidates[0]||null;
      return documentId!=null||entries.length?null:(source.find(document=>document.domain==="move")||source[0]||null);
    }
  }
  ns.animation.DOMAINS=DOMAINS;
  ns.animation.AnimationDocument=AnimationDocument;
  ns.animation.AnimationCatalog=AnimationCatalog;
  ns.animation.AnimationEntryProvider=AnimationEntryProvider;
  ns.animation.AnimationDocumentResolver=AnimationDocumentResolver;
  ns.animation.AnimationProgram=AnimationProgram;
  ns.animation.AnimationProgramView=AnimationProgramView;
  ns.animation.NativeAnimationProgram=NativeAnimationProgram;
  ns.animation.AnimationBattleContext=AnimationBattleContext;
})(globalThis);
