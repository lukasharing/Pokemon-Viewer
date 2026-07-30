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
  const shakeTargetByPowerFrames=(values,context={})=>{
    if(values.length!==5)return Object.freeze([]);
    const [source,rawDelay,rawShakes,rawHorizontal,rawVertical]=values.map(Number),
      input=source===0?context.movePower:source===1?context.moveDamage:null,
      delay=signed16(rawDelay),shakes=signed16(rawShakes),
      horizontal=Boolean(rawHorizontal),vertical=Boolean(rawVertical);
    if(!Number.isInteger(input)||input<0||delay<0||delay>1200||
      shakes<=0||shakes>1200||!horizontal&&!vertical)return Object.freeze([]);
    const amplitude=Math.max(1,Math.min(16,Math.trunc(input/12))),
      negative=Math.trunc(amplitude/2),positive=negative+(amplitude&1);
    let x=0,y=0,timer=0,phase=0,remaining=shakes,destroyed=false;
    const step=()=>{
      if(++timer<=delay)return;
      timer=0;phase=(phase+1)&1;
      if(horizontal)x=phase?positive:(negative?-negative:0);
      if(vertical)y=phase?amplitude:0;
      if(--remaining===0){x=0;y=0;destroyed=true;}
    },frames=[];
    // The constructor installs the step callback but does not execute it.
    // Preserve the initial native x2/y2 state before the first task tick.
    for(let tick=0;tick<2400&&!destroyed;tick++){
      frames.push(Object.freeze({x,y,duration:1}));
      step();
    }
    return Object.freeze(frames);
  };
  const shakeBattlePlatformsFrames=values=>{
    if(values.length!==4)return Object.freeze([]);
    const [rawX,rawY,rawShakes,rawDelay]=values.map(Number),
      xOffset=signed16(rawX),yOffset=signed16(rawY),
      shakes=signed16(rawShakes),delay=signed16(rawDelay);
    if(shakes<=0||shakes>1200||delay<0||delay>1200)return Object.freeze([]);
    let x=xOffset,y=yOffset,remaining=shakes,timer=delay,destroyed=false;
    const step=()=>{
      if(timer===0){
        x=(x===xOffset?-xOffset:xOffset)||0;
        y=(y===-yOffset?0:-yOffset)||0;
        timer=delay;
        if(--remaining===0){x=0;y=0;destroyed=true;}
      }else timer--;
    };
    // Cmd_createvisualtask invokes the constructor immediately. The
    // constructor writes BG3HOFS/VOFS and then invokes its step once.
    step();
    const frames=[];
    for(let tick=0;tick<2400&&!destroyed;tick++){
      frames.push(Object.freeze({x,y,duration:1}));
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
  const invertScreenColorFrames=values=>{
    if(values.length!==3)return Object.freeze([]);
    const [scenery,attacker,target]=values.map(value=>Number(value)&0xffff),
      targets=Object.freeze({
        background:Boolean(scenery&0x100),
        user:Boolean(attacker&0x100),
        target:Boolean(target&0x100),
        effects:false
      });
    if(!targets.background&&!targets.user&&!targets.target)return Object.freeze([]);
    return Object.freeze([Object.freeze({
      paletteEffect:Object.freeze({operation:"invert",targets}),
      duration:1
    })]);
  };
  const grayscaleOrOriginalFrames=values=>{
    if(values.length!==2)return Object.freeze([]);
    const [battler,restore]=values.map(value=>Number(value)&0xffff),
      target=battler===0?"user":battler===1?"target":null;
    if(!target||![0,1].includes(restore))return Object.freeze([]);
    return Object.freeze([Object.freeze({
      paletteEffect:Object.freeze({
        operation:restore?"identity":"grayscale",
        targets:Object.freeze({
          background:false,
          user:target==="user",
          target:target==="target",
          effects:false
        })
      }),
      duration:1
    })]);
  };
  const paletteCycleTargets=selector=>{
    // Bits 5/6 select isolated animation BG palettes, not animation OBJs.
    // The current mounted scene cannot address those subpalettes separately.
    if(selector&0x60)return null;
    const targets=paletteTargets(selector);
    return targets.background||targets.user||targets.target
      ?Object.freeze({...targets,effects:false})
      :null;
  };
  // Exact software-fade clock from palette.c::BeginNormalPaletteFade and
  // UpdateNormalPaletteFade. BG and OBJ palettes update on alternating calls;
  // the native coefficient advances by two only after the OBJ half.
  const normalPaletteFadeFrames=(start,target,delay,delta,blend,coefficients)=>{
    let y=start,objPhase=false,delayCounter=delay,finishing=false,
      finishingCounter=0,active=true;
    const apply=(phase,coefficient)=>{
        if(phase==="background"){
          if(blend.targets.background)coefficients.background=coefficient;
        }else{
          if(blend.targets.user)coefficients.user=coefficient;
          if(blend.targets.target)coefficients.target=coefficient;
          if(blend.targets.effects)coefficients.effects=coefficient;
        }
      },
      frame=()=>Object.freeze({
        paletteBlend:Object.freeze({
          ...blend,
          coefficient:Math.max(...Object.values(coefficients)),
          coefficients:Object.freeze({...coefficients})
        }),
        duration:1
      }),
      frames=[];
    // BeginNormalPaletteFade performs the first background-half update
    // immediately and leaves the object half for the next engine update.
    apply("background",y);objPhase=true;frames.push(frame());
    for(let tick=0;tick<2400&&active;tick++){
      if(finishing){
        if(finishingCounter===4){active=false;break;}
        finishingCounter++;
      }else{
        if(!objPhase&&delayCounter<delay){
          delayCounter++;frames.push(frame());continue;
        }
        if(!objPhase)delayCounter=0;
        apply(objPhase?"objects":"background",y);
        objPhase=!objPhase;
        if(!objPhase){
          if(y===target)finishing=true;
          else{
            y+=start<target?delta:-delta;
            if(start<target&&y>target||start>target&&y<target)y=target;
          }
        }
      }
      frames.push(frame());
    }
    return Object.freeze(frames);
  };
  const blendColorCycleFrames=values=>{
    const [rawSelector,rawDelay,rawNumBlends,rawInitial,rawTarget,rawColor]=values.map(Number),
      selector=rawSelector&0xffff,targets=paletteCycleTargets(selector),
      signedDelay=signed16(rawDelay),delay=Math.max(0,signedDelay),
      delta=signedDelay<0?2-signedDelay:2,numBlends=signed16(rawNumBlends),
      initial=signed16(rawInitial),target=signed16(rawTarget),color=rawColor&0x7fff;
    if(!targets||signedDelay< -1200||delay>1200||delta>1202||numBlends<=0||numBlends>64||
      initial<0||initial>16||target<0||target>16)return Object.freeze([]);
    const blend=Object.freeze({selector,targets,color}),
      coefficients={background:0,user:0,target:0,effects:0},frames=[],
      segments=[{start:0,target}];
    let remaining=numBlends-1,restore=true;
    while(remaining>0){
      const start=restore?target:initial,
        destination=remaining===1?0:(restore?initial:target);
      segments.push({start,target:destination});
      restore=!restore;remaining--;
    }
    for(const segment of segments){
      frames.push(...normalPaletteFadeFrames(segment.start,segment.target,delay,delta,blend,coefficients));
    }
    return Object.freeze(frames);
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
  const horizontalShakeFrames=values=>{
    const [rawBattler,rawIntensity,rawMaxTime]=values.map(Number),
      target=battlerTarget(rawBattler),intensity=signed16(rawIntensity),maxTime=signed16(rawMaxTime);
    // Intensity 0 reads gAnimMovePower. All-battler and platform targets need
    // scene state not present in the standalone two-battler document.
    if(!target||intensity<=0||intensity>1200||maxTime<=0||maxTime>1200)return Object.freeze([]);
    let state=0,delay=0,timer=0,horizontalOffset=intensity+3,x=0,destroyed=false;
    const frames=[Object.freeze({x:0,y:0,duration:1})],
      shakeOffset=()=>{
        const value=timer&1?-(Math.trunc(horizontalOffset/2)):Math.trunc(horizontalOffset/2)+(horizontalOffset&1);
        return value||0;
      };
    for(let tick=1;tick<2400&&!destroyed;tick++){
      if(state===0){
        if(++delay>1){
          delay=0;x=shakeOffset();
          if(++timer===maxTime){
            timer=0;horizontalOffset--;state=1;
          }
        }
      }else if(state===1){
        if(++delay>1){
          delay=0;x=shakeOffset();
          if(++timer===4){
            timer=0;
            if(--horizontalOffset===0)state=2;
          }
        }
      }else{
        x=0;destroyed=true;
      }
      if(!destroyed)frames.push(Object.freeze({x,y:0,duration:1}));
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
    AnimTask_ShakeTargetBasedOnMovePowerOrDmg:Object.freeze({
      source:"src/battle_anim_mon_movement.c::AnimTask_ShakeTargetBasedOnMovePowerOrDmg",
      simulate:shakeTargetByPowerFrames,
      target:()=>"target",
      channel:()=>`transform:target:power-shake`
    }),
    AnimTask_ShakeBattlePlatforms:Object.freeze({
      source:"src/battle_anim_normal.c::AnimTask_ShakeBattlePlatforms",
      simulate:shakeBattlePlatformsFrames,
      target:()=>"background",
      channel:()=>`camera:background:bg3`
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
    AnimTask_BlendColorCycle:Object.freeze({
      source:"src/battle_anim_normal.c::AnimTask_BlendColorCycle + src/palette.c::UpdateNormalPaletteFade",
      simulate:blendColorCycleFrames,
      target:()=>"scene",
      channel:values=>`palette:cycle:${Number(values[0])&0xffff}`
    }),
    AnimTask_InvertScreenColor:Object.freeze({
      source:"src/battle_anim_normal.c::AnimTask_InvertScreenColor + src/palette.c::InvertPlttBuffer",
      simulate:invertScreenColorFrames,
      target:()=>"scene",
      // Every command toggles the selected native palettes. Keeping a
      // distinct persistent operation per script address preserves XOR:
      // applying the same inversion twice restores the original pixels.
      channel:(_values,command)=>`palette:invert:${Number(command.offset)}`,
      persistFinal:true
    }),
    AnimTask_SetGrayscaleOrOriginalPal:Object.freeze({
      source:"src/battle_anim_dark.c::AnimTask_SetGrayscaleOrOriginalPal + src/battle_anim_mons.c::SetGrayscaleOrOriginalPalette",
      simulate:grayscaleOrOriginalFrames,
      target:()=>"scene",
      // The native restore copies the unfaded source palette back over the
      // selected battler palette. Reusing one channel makes restore replace
      // the persistent grayscale operation instead of stacking a fake filter.
      channel:values=>`palette:grayscale:${Number(values[0])===0?"user":"target"}`,
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
    }),
    AnimTask_HorizontalShake:Object.freeze({
      source:"src/battle_anim_ground.c::AnimTask_HorizontalShake",
      simulate:horizontalShakeFrames,
      target:values=>battlerTarget(values[0]),
      channel:values=>`transform:${battlerTarget(values[0])}:horizontal-shake`
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
        const pointers=new Set(matches.map(command=>Number(command.native?.pointer)).filter(Number.isInteger));
        // An exact macro may occur more than once in one script (Thunder
        // Punch toggles the same inversion twice). It remains an unambiguous
        // semantic anchor only when every occurrence calls the same function.
        if(pointers.size!==1)continue;
        this.symbols.set([...pointers][0],locator.symbol);
      }
      return this;
    }
    resolve(command,context={}){
      const pointer=Number(command?.native?.pointer),symbol=this.symbols.get(pointer),adapter=ADAPTERS[symbol];
      if(!adapter)return null;
      const values=Array.from(command.native?.values||[],Number),frames=adapter.simulate(values,context);
      if(!frames.length)return null;
      const target=typeof adapter.target==="function"?adapter.target(values):(Number(values[0])===1?"target":"user");
      if(!target)return null;
      return Object.freeze({
        id:`task-${command.offset}`,
        label:symbol,
        target,
        frames,
        channel:typeof adapter.channel==="function"?adapter.channel(values,command):null,
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
