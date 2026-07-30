(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const signed16=value=>value&0x8000?value-0x10000:value;
  const sameValues=(left=[],right=[])=>left.length===right.length&&left.every((value,index)=>Number(value)===Number(right[index]));

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
      return Object.freeze({
        id:`task-${command.offset}`,
        label:symbol,
        target:Number(values[0])===1?"target":"user",
        frames,
        accuracy:"verified",
        source:adapter.source
      });
    }
  }

  ns.GBA_ANIMATION_TASK_ADAPTERS=ADAPTERS;
  ns.GbaAnimationTaskRegistry=GbaAnimationTaskRegistry;
})(globalThis);
