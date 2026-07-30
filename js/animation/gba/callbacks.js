(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const signed16=value=>value&0x8000?value-0x10000:value;
  const freeze=value=>Object.freeze(value);
  // pret/pokeemerald's Sin/Cos helpers use a Q8.8, 256-step sine table and an
  // arithmetic right shift. Recreate that integer contract without coupling
  // engine behavior to one stock ROM address.
  const sine=(angle,amplitude)=>{
    const q8=Math.trunc(Math.sin((angle&0xff)*Math.PI/128)*256);
    return Math.floor(amplitude*q8/256);
  };
  const cosine=(angle,amplitude)=>sine((angle+64)&0xff,amplitude);
  const linear=(start,end,duration,tick)=>{
    if(duration<=0)return end;
    const delta=Math.trunc(Math.abs(end-start)*256/duration),signed=start>end;
    return start+(signed?-1:1)*Math.trunc(delta*tick/256);
  };
  const petalDance=({big=false}={})=>({values})=>{
    const [initialX=0,initialY=0,targetY=0,rawDuration=1]=values.map(signed16),
      duration=Math.max(1,rawDuration),transforms=[];
    let angle=0x40;
    for(let tick=1;tick<=duration;tick++,angle=(angle+5)&0xff){
      const y=linear(initialY,targetY,duration,tick);
      transforms.push(freeze({
        x:initialX+sine(angle,big?32:8),
        y:y+(big?cosine(angle,-5):0),
        hFlip:!big&&(((angle-59)&0xffff)<5||((angle-187)&0xffff)<5)
      }));
    }
    return freeze({
      anchor:"user",x:0,y:0,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy:"verified"
    });
  };
  const razorLeafParticle=({values})=>{
    const [deltaX=0,deltaY=0,rawDuration=0]=values.map(signed16),
      upwardDuration=Math.max(0,rawDuration),transforms=[];
    let x=0,y=0;
    for(let tick=0;tick<upwardDuration;tick++){
      x+=deltaX;y+=deltaY;transforms.push(freeze({x,y}));
    }
    let angle=upwardDuration?(deltaY&1?0x80:0):0;
    for(let tick=1;tick<=81;tick++,angle=(angle+2)&0xff){
      transforms.push(freeze({x:x+sine(angle,25),y:y+Math.floor(tick/2)}));
    }
    return freeze({
      anchor:"user",x:0,y:0,spriteAnimationIndex:0,
      transforms:freeze(transforms),lifetime:transforms.length,
      transient:true,accuracy:"verified"
    });
  };
  const arcTranslation=({from="target",to="user",accuracy="verified"}={})=>({values})=>{
    const [initialX=0,initialY=0,waveAmplitude=0,rawDuration=1]=values.map(signed16),
      duration=Math.max(1,rawDuration),phaseStep=Math.trunc(0x8000/duration),
      transforms=Array.from({length:duration},(_,index)=>{
        const tick=index+1,phase=(phaseStep*tick)>>8;
        return freeze({toAnchor:to,progress:tick/duration,targetX:0,targetY:0,x:0,y:sine(phase,waveAmplitude)});
      });
    return freeze({
      anchor:from,x:initialX,y:initialY,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy
    });
  };
  const linearToAnchor=({from="user",to="user"}={})=>({values})=>{
    const [initialX=0,initialY=0,rawDuration=1]=values.map(signed16),duration=Math.max(1,rawDuration),
      transforms=Array.from({length:duration},(_,index)=>freeze({
        toAnchor:to,progress:(index+1)/duration,targetX:0,targetY:0,x:0,y:0
      }));
    return freeze({
      anchor:from,x:initialX,y:initialY,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy:"verified"
    });
  };
  const linearSingleSine=({values})=>{
    const [initialX=0,initialY=0,targetX=0,targetY=0,rawDuration=1,waveAmplitude=0,targetBoth=0]=values.map(signed16),
      duration=Math.max(1,rawDuration),phaseStep=Math.trunc(0x8000/duration),
      transforms=Array.from({length:duration},(_,index)=>{
        const tick=index+1,phase=(phaseStep*tick)>>8;
        return freeze({toAnchor:"target",progress:tick/duration,targetX,targetY,x:0,y:sine(phase,waveAmplitude)});
      });
    return freeze({
      anchor:"user",x:initialX,y:initialY,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy:targetBoth?"partial":"verified",
      ...(targetBoth?{diagnostic:"Double-battle target averaging requires the live battler layout."}:{})
    });
  };

  const hitSplat=({persistent=false,attackerSideDependent=false}={})=>({values})=>{
    const [x=0,rawY=0,relativeTo=1,affineAnimationIndex=0,duration=0]=values;
    return freeze({
      anchor:relativeTo===0?"user":"target",
      x:signed16(x),
      // HandleInvert depends on the live attacker's side, not the
      // createsprite anim_battler bit. Preserve the script coordinate until
      // the preview has an explicit battle-side context.
      y:signed16(rawY),
      affineAnimationIndex,
      lifetime:persistent?Math.max(1,signed16(duration)):null,
      transient:true,
      accuracy:attackerSideDependent?"partial":"verified",
      ...(attackerSideDependent
        ?{diagnostic:"Vertical inversion requires the live attacker side and contest state."}
        :{})
    });
  };
  const ADAPTERS={
    AnimHitSplatBasic:hitSplat(),
    AnimHitSplatHandleInvert:hitSplat({attackerSideDependent:true}),
    AnimHitSplatPersistent:hitSplat({persistent:true}),
    AnimHitSplatRandom:({values})=>freeze({
      anchor:values[0]===0?"user":"target",x:0,y:0,
      affineAnimationIndex:signed16(values[1]??0),
      transient:true,accuracy:"partial",
      diagnostic:"Native random displacement requires the live battle RNG state."
    }),
    AnimHitSplatOnMonEdge:({values})=>freeze({
      anchor:values[0]===0?"user":"target",x:signed16(values[1]??0),y:signed16(values[2]??0),
      affineAnimationIndex:signed16(values[3]??0),transient:true,accuracy:"verified"
    }),
    AnimCrossImpact:({values})=>freeze({
      anchor:values[2]===0?"user":"target",x:signed16(values[0]??0),y:signed16(values[1]??0),
      lifetime:Math.max(1,signed16(values[3]??1)),transient:true,accuracy:"verified"
    }),
    AnimFlashingHitSplat:({values})=>freeze({
      anchor:values[2]===0?"user":"target",x:signed16(values[0]??0),y:signed16(values[1]??0),
      affineAnimationIndex:signed16(values[3]??0),lifetime:14,transient:true,accuracy:"partial",
      diagnostic:"Native alternate-frame visibility is not represented by the current frame document."
    })
  };
  Object.assign(ADAPTERS,{
    gBasicHitSplatSpriteTemplate:ADAPTERS.AnimHitSplatBasic,
    gWaterHitSplatSpriteTemplate:ADAPTERS.AnimHitSplatBasic,
    gHandleInvertHitSplatSpriteTemplate:ADAPTERS.AnimHitSplatHandleInvert,
    gPersistHitSplatSpriteTemplate:ADAPTERS.AnimHitSplatPersistent,
    gRandomPosHitSplatSpriteTemplate:ADAPTERS.AnimHitSplatRandom,
    gMonEdgeHitSplatSpriteTemplate:ADAPTERS.AnimHitSplatOnMonEdge,
    gCrossImpactSpriteTemplate:ADAPTERS.AnimCrossImpact,
    gFlashingHitSplatSpriteTemplate:ADAPTERS.AnimFlashingHitSplat,
    // Exact callback contracts from pret/pokeemerald
    // src/battle_anim_effects_1.c. They are keyed by template because the
    // generated ROM manifest intentionally exposes data symbols, not every
    // private static C callback.
    gPetalDanceBigFlowerSpriteTemplate:petalDance({big:true}),
    gPetalDanceSmallFlowerSpriteTemplate:petalDance(),
    gRazorLeafParticleSpriteTemplate:razorLeafParticle,
    gAbsorptionOrbSpriteTemplate:arcTranslation(),
    gPowerAbsorptionOrbSpriteTemplate:linearToAnchor(),
    gRazorLeafCutterSpriteTemplate:linearSingleSine
  });
  Object.freeze(ADAPTERS);

  class GbaAnimationCallbackRegistry{
    constructor(reader){
      this.reader=reader;
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      this.namesByOffset=new Map();
      for(const [name,symbol] of Object.entries(this.symbols)){
        if(!Number.isInteger(symbol?.offset))continue;
        this.namesByOffset.set(symbol.offset,name);
        // GBA SpriteTemplate function pointers carry the THUMB bit while GNU
        // symbols point at the aligned first instruction.
        if(symbol.kind==="code")this.namesByOffset.set(symbol.offset|1,name);
      }
    }
    symbol(offset){return this.namesByOffset.get(offset)||null;}
    resolve(template,native={}){
      const callbackSymbol=this.symbol(template?.callback),templateSymbol=this.symbol(template?.offset);
      const adapter=ADAPTERS[callbackSymbol]||ADAPTERS[templateSymbol];
      const values=Array.isArray(native.values)?native.values:[];
      if(adapter){
        return freeze({
          ...adapter({values}),
          callbackSymbol,templateSymbol,verifiedCallback:true
        });
      }
      return freeze({
        // Cmd_createsprite always creates at the target coordinate. A native
        // callback may move it afterwards; unknown arguments are never guessed
        // as x/y coordinates.
        anchor:"target",x:0,y:0,affineAnimationIndex:null,transient:false,
        accuracy:"unresolved",callbackSymbol,templateSymbol,verifiedCallback:false,
        diagnostic:callbackSymbol
          ?`No visual adapter is registered for ${callbackSymbol}.`
          :"The sprite callback has no exact source symbol for this ROM."
      });
    }
  }

  ns.GbaAnimationCallbackRegistry=GbaAnimationCallbackRegistry;
})(globalThis);
