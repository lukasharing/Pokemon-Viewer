(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const signed16=value=>value&0x8000?value-0x10000:value;
  const freeze=value=>Object.freeze(value);

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
    gFlashingHitSplatSpriteTemplate:ADAPTERS.AnimFlashingHitSplat
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
