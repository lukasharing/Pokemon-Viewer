(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const signed16=value=>value&0x8000?value-0x10000:value;
  const sameValues=(left=[],right=[])=>left.length===right.length&&left.every((value,index)=>Number(value)===Number(right[index]));
  // Exact first quadrant of pret/pokeemerald src/trig.c::gSineTable.
  // The native table is Q8.8 and extends to index 319 so Cos can address
  // index + 64. Symmetry reconstructs every value without floating point.
  const SINE_Q8_QUADRANT=Object.freeze([
    0,6,12,18,25,31,37,43,49,56,62,68,74,80,86,92,97,103,109,115,120,126,
    131,136,142,147,152,157,162,167,171,176,181,185,189,193,197,201,205,209,
    212,216,219,222,225,228,231,234,236,238,241,243,244,246,248,249,251,252,
    253,254,254,255,255,255,256
  ]);
  const sineQ8=index=>{
    const normalized=((Number(index)%256)+256)%256;
    if(normalized<=64)return SINE_Q8_QUADRANT[normalized];
    if(normalized<=128)return SINE_Q8_QUADRANT[128-normalized];
    if(normalized<=192)return-SINE_Q8_QUADRANT[normalized-128];
    return-SINE_Q8_QUADRANT[256-normalized];
  };
  const nativeSin=(index,amplitude)=>(signed16(amplitude)*sineQ8(index))>>8;
  const nativeCos=(index,amplitude)=>(signed16(amplitude)*sineQ8(Number(index)+64))>>8;

  // Source-faithful adapter for pret/pokeemerald and pret/pokefirered
  // battle_anim_mon_movement.c::AnimTask_ShakeMon. The task function is
  // called immediately by Cmd_createvisualtask; every returned record is the
  // x2/y2 position visible for one subsequent native video tick.
  const shakeMonFrames=values=>{
    const [battler,rawX,rawY,rawShakes,rawDelay]=values.map(Number),
      x=signed16(rawX),y=signed16(rawY),
      shakes=Math.max(0,Math.min(1200,signed16(rawShakes))),
      delay=Math.max(0,Math.min(1200,signed16(rawDelay)));
    if(![0,1].includes(battler)||!shakes)return Object.freeze([]);
    let currentX=x,currentY=y,remaining=shakes,counter=delay,destroyed=false;
    const step=()=>{
      if(counter===0){
        currentX=currentX===0?x:0;
        currentY=currentY===0?y:0;
        counter=delay;
        if(--remaining===0){currentX=0;currentY=0;destroyed=true;}
      }else counter--;
    };
    // AnimTask_ShakeMon invokes its step once during construction.
    step();
    const frames=[];
    for(let tick=0;tick<1200&&!destroyed;tick++){
      frames.push(Object.freeze({x:currentX,y:currentY,duration:1}));
      step();
    }
    return Object.freeze(frames);
  };
  const shakeMon2Frames=values=>{
    const [battler,rawX,rawY,rawShakes,rawDelay]=values.map(Number),
      x=signed16(rawX),y=signed16(rawY),
      shakes=Math.max(0,Math.min(1200,signed16(rawShakes))),
      delay=Math.max(0,Math.min(1200,signed16(rawDelay)));
    if(![0,1].includes(battler)||!shakes)return Object.freeze([]);
    let currentX=x,currentY=y,remaining=shakes,counter=delay,destroyed=false;
    const step=()=>{
      if(counter===0){
        currentX=currentX===x?-x:x;
        currentY=currentY===y?-y:y;
        counter=delay;
        if(--remaining===0){currentX=0;currentY=0;destroyed=true;}
      }else counter--;
    };
    step();
    const frames=[];
    for(let tick=0;tick<1200&&!destroyed;tick++){
      frames.push(Object.freeze({x:currentX,y:currentY,duration:1}));
      step();
    }
    return Object.freeze(frames);
  };
  const shakeMonInPlaceFrames=values=>{
    const [battler,rawX,rawY,rawShakes,rawDelay]=values.map(Number),
      x=signed16(rawX),y=signed16(rawY),
      shakes=Math.max(0,Math.min(1200,signed16(rawShakes))),
      delay=Math.max(0,Math.min(1200,signed16(rawDelay)));
    if(![0,1].includes(battler)||!shakes)return Object.freeze([]);
    let currentX=x,currentY=y,iteration=0,counter=0,destroyed=false;
    const step=()=>{
      if(counter===0){
        const direction=iteration&1?1:-1;
        currentX+=direction*x*2;currentY+=direction*y*2;
        counter=delay;
        if(++iteration>=shakes){
          const correction=iteration&1?1:-1;
          currentX+=correction*x;currentY+=correction*y;destroyed=true;
        }
      }else counter--;
    };
    step();
    const frames=[];
    for(let tick=0;tick<1200&&!destroyed;tick++){
      frames.push(Object.freeze({x:currentX,y:currentY,duration:1}));
      step();
    }
    return Object.freeze(frames);
  };
  const paletteTargets=selector=>Object.freeze({
    background:Boolean(selector&0x01),
    user:Boolean(selector&0x02||selector&0x0180),
    target:Boolean(selector&0x04||selector&0x0600),
    effects:Boolean(selector&0x60)
  });
  const blendBattlePaletteFrames=values=>{
    const [rawSelector,rawDelay,rawInitial,rawTarget,rawColor]=values.map(Number),
      selector=rawSelector&0xffff,delay=Math.max(0,Math.min(1200,signed16(rawDelay))),
      target=Math.max(0,Math.min(16,signed16(rawTarget))),
      color=rawColor&0x7fff,targets=paletteTargets(selector);
    let nextCoefficient=Math.max(0,Math.min(16,signed16(rawInitial))),
      appliedCoefficient=nextCoefficient,timer=0,destroyed=false;
    const frames=[];
    for(let tick=0;tick<1200&&!destroyed;tick++){
      if(timer===delay){
        timer=0;
        appliedCoefficient=nextCoefficient;
        if(nextCoefficient<target)nextCoefficient++;
        else if(nextCoefficient>target)nextCoefficient--;
        else destroyed=true;
        frames.push(Object.freeze({paletteBlend:Object.freeze({selector,targets,coefficient:appliedCoefficient,color}),duration:1}));
      }else{
        timer++;
        frames.push(Object.freeze({paletteBlend:Object.freeze({selector,targets,coefficient:appliedCoefficient,color}),duration:1}));
      }
    }
    return Object.freeze(frames);
  };
  const battlerTarget=value=>Number(value)===0?"user":Number(value)===1?"target":null;
  const scaleMonAndRestoreFrames=values=>{
    const [rawXDelta,rawYDelta,rawDuration,rawBattler]=values.map(Number),
      xDelta=signed16(rawXDelta),yDelta=signed16(rawYDelta),
      duration=signed16(rawDuration),target=battlerTarget(rawBattler);
    if(!target||duration<=0||duration>600)return Object.freeze([]);
    let xScale=0x100,yScale=0x100,phase=duration,restoreDuration=duration,
      currentXDelta=xDelta,currentYDelta=yDelta,destroyed=false;
    const frames=[Object.freeze({scaleX:1,scaleY:1,duration:1})];
    for(let tick=1;tick<1200&&!destroyed;tick++){
      xScale+=currentXDelta;yScale+=currentYDelta;
      if(xScale<=0||yScale<=0)return Object.freeze([]);
      if(--phase===0){
        if(restoreDuration>0){
          currentXDelta=-currentXDelta;currentYDelta=-currentYDelta;
          phase=restoreDuration;restoreDuration=0;
        }else{
          destroyed=true;
          continue;
        }
      }
      frames.push(Object.freeze({scaleX:0x100/xScale,scaleY:0x100/yScale,duration:1}));
    }
    return Object.freeze(frames);
  };
  const translateMonEllipticalFrames=values=>{
    const [rawBattler,rawWidth,rawHeight,rawLoops,rawSpeed]=values.map(Number),
      target=battlerTarget(rawBattler),width=signed16(rawWidth),height=signed16(rawHeight),
      loops=signed16(rawLoops),nativeSpeed=signed16(rawSpeed),speed=Math.min(5,nativeSpeed);
    if(!target||loops<=0||loops>1200||nativeSpeed<0)return Object.freeze([]);
    const wavePeriod=1<<speed,frames=[];
    let angle=0,remaining=loops,destroyed=false;
    const step=()=>{
      let x=nativeSin(angle,width),y=-nativeCos(angle,height)+height;
      angle=(angle+wavePeriod)&0xff;
      if(angle===0)remaining--;
      if(remaining===0){x=0;y=0;destroyed=true;}
      return{x,y};
    };
    // AnimTask_TranslateMonElliptical invokes its step during construction.
    for(let tick=0;tick<1200&&!destroyed;tick++){
      const frame=step();
      if(!destroyed)frames.push(Object.freeze({...frame,duration:1}));
    }
    return Object.freeze(frames);
  };

  const ADAPTERS=Object.freeze({
    AnimTask_ShakeMon:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_ShakeMon",
      simulate:shakeMonFrames
    }),
    AnimTask_ShakeMon2:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_ShakeMon2",
      simulate:shakeMon2Frames
    }),
    AnimTask_ShakeMonInPlace:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_ShakeMonInPlace",
      simulate:shakeMonInPlaceFrames
    }),
    AnimTask_BlendBattleAnimPal:Object.freeze({
      source:"src/battle_anim_utility_funcs.c::AnimTask_BlendBattleAnimPal",
      simulate:blendBattlePaletteFrames,
      channel:values=>`palette:${Number(values[0])&0xffff}`,
      target:()=>"scene",
      persistFinal:true
    }),
    AnimTask_ScaleMonAndRestore:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_ScaleMonAndRestore",
      simulate:scaleMonAndRestoreFrames,
      target:values=>battlerTarget(values[3]),
      channel:values=>`transform:${battlerTarget(values[3])}:scale`
    }),
    AnimTask_TranslateMonEllipticalRespectSide:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_TranslateMonEllipticalRespectSide",
      simulate:translateMonEllipticalFrames,
      target:values=>battlerTarget(values[0]),
      channel:values=>`transform:${battlerTarget(values[0])}:ellipse`
    })
  });

  class GbaAnimationTaskRegistry{
    constructor(reader){
      this.reader=reader;
      this.contract=reader.memoryProfile?.structure?.("GbaBattleAnimationTasks")||{};
      this.symbols=new Map();
    }
    learn(commands,{domain,id}={}){
      for(const locator of this.contract.locators||[]){
        if(locator.domain!==domain||Number(locator.id)!==Number(id)||!ADAPTERS[locator.symbol])continue;
        const matches=commands.filter(command=>
          command.opcode===Number(locator.opcode)&&
          sameValues(command.native?.values||[],locator.values||[])
        );
        if(matches.length!==1)continue;
        const pointer=Number(matches[0].native?.pointer);
        if(Number.isInteger(pointer))this.symbols.set(pointer,locator.symbol);
      }
      return this;
    }
    resolve(command){
      const pointer=Number(command?.native?.pointer),symbol=this.symbols.get(pointer),adapter=ADAPTERS[symbol];
      if(!adapter)return null;
      const values=Array.from(command.native?.values||[],Number),frames=adapter.simulate(values);
      if(!frames.length)return null;
      const target=typeof adapter.target==="function"?adapter.target(values):(Number(values[0])===1?"target":"user");
      if(!target)return null;
      return Object.freeze({
        id:`task-${command.offset}`,
        label:symbol,
        target,
        frames,
        channel:typeof adapter.channel==="function"?adapter.channel(values):null,
        persistFinal:Boolean(adapter.persistFinal),
        accuracy:"verified",
        source:adapter.source
      });
    }
  }

  ns.GBA_ANIMATION_TASK_ADAPTERS=ADAPTERS;
  ns.GBA_SINE_Q8=sineQ8;
  ns.GbaAnimationTaskRegistry=GbaAnimationTaskRegistry;
})(globalThis);
