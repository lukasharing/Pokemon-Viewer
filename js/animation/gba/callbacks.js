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
  const petalDance=({big=false}={})=>({values})=>{
    const [initialX=0,initialY=0,targetY=0,rawDuration=1]=values.map(signed16),
      duration=Math.max(1,rawDuration),transforms=[];
    let angle=0x40;
    for(let tick=1;tick<=duration;tick++,angle=(angle+5)&0xff){
      transforms.push(freeze({
        toAnchor:"userPic",progress:tick/duration,
        targetX:initialX,targetY,
        x:sine(angle,big?32:8),
        y:big?cosine(angle,-5):0,
        hFlip:!big&&(((angle-59)&0xffff)<5||((angle-187)&0xffff)<5)
      }));
    }
    return freeze({
      // The big flower starts from BATTLER_COORD_Y while the small flower
      // starts from BATTLER_COORD_Y_PIC_OFFSET (pret/pokeemerald
      // AnimPetalDanceBig/SmallFlower).
      anchor:big?"userBase":"userPic",x:initialX,y:initialY,
      transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy:"partial",
      diagnostic:"Coordinates and per-tick motion are native; battler subpriority switching still requires split battle-field layers."
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
      anchor:"userPic",x:0,y:0,spriteAnimationIndex:0,
      transforms:freeze(transforms),lifetime:transforms.length,
      transient:true,accuracy:"verified"
    });
  };
  const arcTranslation=({from="target",to="user",accuracy="verified"}={})=>({values})=>{
    const [initialX=0,initialY=0,waveAmplitude=0,rawDuration=1]=values.map(signed16),
      duration=Math.max(1,rawDuration),phaseStep=Math.trunc(0x8000/duration),
      transforms=Array.from({length:duration},(_,index)=>{
        const tick=index+1,phase=(phaseStep*tick)>>8;
        return freeze({toAnchor:`${to}Pic`,progress:tick/duration,targetX:0,targetY:0,x:0,y:sine(phase,waveAmplitude)});
      });
    return freeze({
      anchor:`${from}Pic`,x:initialX,y:initialY,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy
    });
  };
  const linearToAnchor=({from="user",to="user"}={})=>({values})=>{
    const [initialX=0,initialY=0,rawDuration=1]=values.map(signed16),duration=Math.max(1,rawDuration),
      transforms=Array.from({length:duration},(_,index)=>freeze({
        toAnchor:`${to}Pic`,progress:(index+1)/duration,targetX:0,targetY:0,x:0,y:0
      }));
    return freeze({
      anchor:`${from}Pic`,x:initialX,y:initialY,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy:"verified"
    });
  };
  const linearSingleSine=({values})=>{
    const [initialX=0,initialY=0,targetX=0,targetY=0,rawDuration=1,waveAmplitude=0,targetBoth=0]=values.map(signed16),
      duration=Math.max(1,rawDuration),phaseStep=Math.trunc(0x8000/duration),
      transforms=Array.from({length:duration},(_,index)=>{
        const tick=index+1,phase=(phaseStep*tick)>>8;
        return freeze({toAnchor:"targetPic",progress:tick/duration,targetX,targetY,x:0,y:sine(phase,waveAmplitude)});
      });
    return freeze({
      anchor:"userPic",x:initialX,y:initialY,transforms:freeze(transforms),lifetime:duration,
      transient:true,accuracy:targetBoth?"partial":"verified",
      ...(targetBoth?{diagnostic:"Double-battle target averaging requires the live battler layout."}:{})
    });
  };
  const bulletSeed=({values,random2})=>{
    const [rawInitialX=0,rawInitialY=0]=values.map(signed16),duration=20;
    // pret/pokeemerald AnimBulletSeed:
    // 1. translate to BATTLER_COORD_X_2/Y_PIC_OFFSET for exactly 20 ticks;
    // 2. consume two values from the engine's shared Random2 stream;
    // 3. bounce for 16 ticks using the native Q8.8 Sin helper, then destroy.
    // The preview owns a deterministic instance of that same stream so
    // repeated seeds do not collapse onto one another or invent coordinates.
    const transforms=Array.from({length:duration},(_,index)=>freeze({
      toAnchor:"targetPic",progress:(index+1)/duration,targetX:0,targetY:0,x:0,y:0
    }));
    const amplitude=signed16(0xfff4-(random2()&7)),speed=random2()%0xa0+0xa0;
    let xAccumulator=0,angle=0;
    for(let tick=0;tick<16;tick++){
      xAccumulator+=speed;
      let x=xAccumulator>>8;
      if(speed&1)x=-x;
      transforms.push(freeze({
        toAnchor:"targetPic",progress:1,targetX:0,targetY:0,
        x,y:sine(angle,amplitude)
      }));
      angle=(angle+8)&0xff;
    }
    return freeze({
      anchor:"userPic",x:rawInitialX,y:rawInitialY,
      transforms:freeze(transforms),lifetime:transforms.length,transient:true,
      accuracy:"verified",
      diagnostic:"Native 20-tick flight and 16-tick Random2 rebound; preview uses the engine's deterministic secondary RNG stream."
    });
  };

  const hitSplat=({persistent=false,attackerSideDependent=false}={})=>({values,context={}})=>{
    const [x=0,rawY=0,relativeTo=1,affineAnimationIndex=0,duration=0]=values;
    const invertY=attackerSideDependent&&context.attackerSide==="rival";
    return freeze({
      anchor:relativeTo===0?"user":"target",
      x:signed16(x),
      // AnimHitSplatHandleInvert negates Y only when the attacker is on the
      // opponent side. Direction is a battle context, not a sprite-template
      // property.
      y:invertY?-signed16(rawY):signed16(rawY),
      affineAnimationIndex,
      lifetime:persistent?Math.max(1,signed16(duration)):null,
      transient:true,
      accuracy:"verified"
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
    gRazorLeafCutterSpriteTemplate:linearSingleSine,
    gBulletSeedSpriteTemplate:bulletSeed
  });
  Object.freeze(ADAPTERS);

  class GbaAnimationCallbackRegistry{
    constructor(reader){
      this.reader=reader;
      // gRng2Value is zero-initialized by the engine. A live emulator may
      // replace this seed; the standalone editor deliberately starts from the
      // same deterministic state and shares it across every created sprite.
      this.rng2=0;
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
    random2(){
      this.rng2=(Math.imul(1103515245,this.rng2)+24691)>>>0;
      return this.rng2>>>16;
    }
    symbol(offset){return this.namesByOffset.get(offset)||null;}
    resolve(template,native={},context={}){
      const callbackSymbol=this.symbol(template?.callback),templateSymbol=this.symbol(template?.offset);
      const adapter=ADAPTERS[callbackSymbol]||ADAPTERS[templateSymbol];
      const values=Array.isArray(native.values)?native.values:[];
      if(adapter){
        return freeze({
          ...adapter({values,context,random2:()=>this.random2()}),
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
