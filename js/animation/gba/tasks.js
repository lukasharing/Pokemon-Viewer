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
  const blendFrames=([rawDelay,rawInitial,rawTarget,rawColor],{selector=0,targets}={})=>{
    const delay=Math.max(0,Math.min(1200,signed16(rawDelay))),
      target=Math.max(0,Math.min(16,signed16(rawTarget))),
      color=rawColor&0x7fff;
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
  const blendBattlePaletteFrames=values=>{
    const selector=Number(values[0])&0xffff;
    return blendFrames(values.slice(1),{selector,targets:paletteTargets(selector)});
  };
  const excludedPaletteTargets=selector=>{
    const contracts={
      0:{background:true,user:false,target:true,effects:false},
      1:{background:true,user:true,target:false,effects:false},
      2:{background:false,user:false,target:true,effects:false},
      3:{background:false,user:true,target:false,effects:false},
      4:{background:true,user:false,target:false,effects:false},
      5:{background:true,user:true,target:true,effects:false}
    };
    return contracts[selector]?Object.freeze(contracts[selector]):null;
  };
  const blendBattlePaletteExcludeFrames=values=>{
    const selector=Number(values[0]),targets=excludedPaletteTargets(selector);
    return targets?blendFrames(values.slice(1),{selector,targets}):Object.freeze([]);
  };
  const battlerTarget=value=>Number(value)===0?"user":Number(value)===1?"target":null;
  const blendMonInAndOutFrames=values=>{
    const [rawBattler,rawColor,rawCoefficient,rawDelay,rawCycles]=values.map(Number),
      target=battlerTarget(rawBattler),color=rawColor&0x7fff,
      coefficient=signed16(rawCoefficient),delay=signed16(rawDelay),cycles=signed16(rawCycles);
    if(!target||coefficient<=0||coefficient>16||delay<0||delay>1200||cycles<=0||cycles>1200)return Object.freeze([]);
    const targets=Object.freeze({background:false,user:target==="user",target:target==="target",effects:false}),
      paletteBlend=value=>Object.freeze({
        paletteBlend:Object.freeze({selector:Number(rawBattler),targets,coefficient:value,color}),
        duration:1
      }),
      frames=[paletteBlend(0)];
    let timer=0,current=0,blendingOut=false,remaining=cycles,destroyed=false;
    for(let tick=1;tick<1200&&!destroyed;tick++){
      if(++timer>=delay){
        timer=0;
        if(!blendingOut){
          current++;
          if(current===coefficient)blendingOut=true;
        }else{
          current--;
          if(current===0){
            if(--remaining)blendingOut=false;
            else destroyed=true;
          }
        }
      }
      frames.push(paletteBlend(current));
    }
    return Object.freeze(frames);
  };
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
  const swayMonFrames=values=>{
    const [rawDirection,rawAmplitude,rawPeriod,rawSways,rawBattler]=values.map(Number),
      direction=signed16(rawDirection),amplitude=signed16(rawAmplitude),
      period=signed16(rawPeriod),sways=signed16(rawSways),target=battlerTarget(rawBattler);
    if(!target||![0,1].includes(direction)||period<=0||sways<=0||sways>1200)return Object.freeze([]);
    let accumulator=0,remaining=sways,upperHalf=0,lowerHalf=1,destroyed=false;
    const frames=[Object.freeze({x:0,y:0,duration:1})];
    for(let tick=1;tick<1200&&!destroyed;tick++){
      const sineIndex=(accumulator+period)&0xffff;
      accumulator=signed16(sineIndex);
      const waveIndex=sineIndex>>>8,sineValue=nativeSin(waveIndex,amplitude),
        frame=direction===0
          ?{x:sineValue,y:0}
          :{x:0,y:target==="user"?Math.abs(sineValue):-Math.abs(sineValue)};
      if(
        (waveIndex>=0x80&&upperHalf===0&&lowerHalf===1)||
        (waveIndex<0x7f&&upperHalf===1&&lowerHalf===0)
      ){
        upperHalf^=1;lowerHalf^=1;
        if(--remaining===0)destroyed=true;
      }
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
    AnimTask_BlendBattleAnimPalExclude:Object.freeze({
      source:"src/battle_anim_utility_funcs.c::AnimTask_BlendBattleAnimPalExclude",
      simulate:blendBattlePaletteExcludeFrames,
      channel:values=>`palette:exclude:${Number(values[0])}`,
      target:()=>"scene",
      persistFinal:true
    }),
    AnimTask_BlendMonInAndOut:Object.freeze({
      source:"src/battle_anim_mons.c::AnimTask_BlendMonInAndOut",
      simulate:blendMonInAndOutFrames,
      target:values=>battlerTarget(values[0]),
      channel:values=>`palette:mon:${battlerTarget(values[0])}`
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
    }),
    AnimTask_TranslateMonElliptical:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_TranslateMonElliptical",
      simulate:translateMonEllipticalFrames,
      target:values=>battlerTarget(values[0]),
      channel:values=>`transform:${battlerTarget(values[0])}:ellipse`
    }),
    AnimTask_SwayMon:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_SwayMon",
      simulate:swayMonFrames,
      target:values=>battlerTarget(values[4]),
      channel:values=>`transform:${battlerTarget(values[4])}:sway`
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
