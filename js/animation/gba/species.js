(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  const KNOWN_FRONT_ANIM_NAMES=[
    "Vertical squash and bounce","Circular stretch twice","Horizontal vibrate","Horizontal slide","Vertical slide","Bounce and rotate",
    "Vertical/horizontal jumps","Rotate sideways","Rotate sideways twice","Grow and vibrate","Fast zigzag","Concave swing",
    "Fast concave swing","Convex swing","Fast convex swing","Horizontal shake","Vertical shake","Circular vibrate","Twist",
    "Shrink and grow","Counter-clockwise circle","Black glow","Horizontal stretch","Vertical stretch","Rising wobble",
    "Double vertical shake","Tip forward","Horizontal pivot","Vertical slide wobble","Horizontal slide wobble","Large vertical jumps",
    "Long spin","Orange glow","Red glow","Blue glow","Yellow glow","Purple glow","Back and lunge","Back flip","Flicker",
    "Large back flip","Front flip","Tumbling front flip","Figure eight","Yellow flash","Short fast concave swing",
    "Short fast convex swing","Rotate up and slam","Deep squash and bounce","Horizontal jumps","Horizontal jumps with stretch"
  ];
  // Emerald assigns callbacks through an 83-entry table. Keep every native
  // numeric identity selectable even when a callback has no friendly UI name.
  const FRONT_ANIM_NAMES=Object.freeze(Array.from(
    {length:83},
    (_,id)=>KNOWN_FRONT_ANIM_NAMES[id]||`Native movement ${id}`
  ));
  const colors=bytes=>Array.from({length:16},(_,index)=>{
    const value=bytes[index*2]|bytes[index*2+1]<<8,[r,g,b]=CoreUtils.bgr555ToRgb(value);
    return`#${[r,g,b].map(value=>value.toString(16).padStart(2,"0")).join("")}`;
  });
  const image=(bytes,palette,frame)=>{
    const packed=bytes.slice(frame*0x800,(frame+1)*0x800);if(packed.length!==0x800)return null;
    const pixels=GbaSpriteCodec.decodeImage(packed,{width:64,height:64}),canvas=document.createElement("canvas");
    canvas.width=canvas.height=64;const context=canvas.getContext("2d"),output=context.createImageData(64,64);
    for(let index=0;index<pixels.length;index++){
      const ink=pixels[index],rgb=Number.parseInt((palette[ink]||"#000000").slice(1),16),at=index*4;
      output.data.set([rgb>>16&255,rgb>>8&255,rgb&255,ink===0?0:255],at);
    }
    context.putImageData(output,0,0);return canvas;
  };
  class GbaSpeciesAnimationCatalog{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      this.data=reader.gbaSpeciesData||=new root.gba.GbaSpeciesData(reader);
      const assets=root.gba.assets.profile(reader);
      this.profile=reader.type==="emerald"&&Number.isInteger(assets?.monFrontAnims)&&Number.isInteger(assets?.monFrontAnimIds)
        ?Object.freeze({frontAnims:assets.monFrontAnims,frontMotion:assets.monFrontAnimIds}):null;
    }
    list(){return this.profile?this.data.pokedexSpecies().map(item=>this.document(item.id)).filter(Boolean):[];}
    script(species){
      const list=this.memory.pointer(this.profile.frontAnims+species*4);
      return list===null?null:this.memory.pointer(list+4);
    }
    commands(offset){
      if(offset===null)return[];const commands=[];
      for(let index=0;index<64;index++){
        const at=offset+index*4;this.memory.assertRange(at,4);const frame=this.memory.u16(at);
        if(frame===0xffff){commands.push(Object.freeze({label:"End",source:"ANIMCMD_END",offset:at,end:true}));break;}
        if(frame>=0xfffd){commands.push(Object.freeze({label:"Control",source:`Native control 0x${frame.toString(16)} is not writable yet`,offset:at,unsupported:true}));break;}
        const flags=this.memory.u16(at+2),duration=flags&63,hFlip=Boolean(flags&64),vFlip=Boolean(flags&128);
        commands.push(Object.freeze({label:`Frame ${frame}`,source:`ANIMCMD_FRAME(${frame}, ${duration}${hFlip?", H_FLIP":""}${vFlip?", V_FLIP":""})`,offset:at,image:frame,duration:Math.max(1,duration),hFlip,vFlip}));
      }
      return commands;
    }
    document(species){
      try{
        const offset=this.script(species),commands=this.commands(offset);
        if(!commands.length)return null;
        let images=null;
        const pictures=()=>{
          if(images)return images;
          const graphic=this.data.front(species),palette=this.data.palette(species);
          if(graphic.bytes.length<0x1000)throw new Error(`Animated front picture ${species} has fewer than two native frames.`);
          const inks=colors(palette.bytes);return images=[image(graphic.bytes,inks,0),image(graphic.bytes,inks,1)];
        };
        const motionOffset=this.profile.frontMotion+species-1,motionId=this.memory.u8(motionOffset);
        const frames=commands.filter(command=>!command.end&&!command.unsupported).map((command,index)=>Object.freeze({
          command:index,label:`Frame ${command.image}`,duration:command.duration,get image(){const values=pictures();return values[command.image]||values[0];},
          hFlip:command.hFlip,vFlip:command.vFlip
        }));
        return new ns.AnimationDocument({
          id:`pokemon:${species}`,name:this.data.name(species),type:"sprite",domain:"pokemon",fps:60,offset,commands,frames,
          accuracy:"verified",editable:commands.every(command=>!command.unsupported),
          references:Object.freeze({speciesId:species}),
          source:Object.freeze({repository:"pret/pokeemerald",file:"src/data/pokemon_graphics/front_pic_anims.h"}),
          editor:Object.freeze({kind:"gba-pokemon",species,motionOffset,motionId,motionNames:FRONT_ANIM_NAMES}),
          properties:[
            {label:"Species",value:`#${species} · ${this.data.name(species)}`},{label:"Image sequence",value:MemoryUtils.hex(offset,6)},
            {label:"Movement",value:FRONT_ANIM_NAMES[motionId]||`Native callback #${motionId}`},{label:"Frames",value:"Two native 64×64 pictures"},
            {label:"Timing",value:"Native 60 Hz ticks"}
          ]
        });
      }catch(error){console.warn("Unable to decode native Emerald species animation",{species,error});return null;}
    }
    patch(document,{motionId,frames}){
      if(document?.editor?.kind!=="gba-pokemon")throw new TypeError("This is not an editable Emerald Pokémon animation.");
      const writes=[];
      if(Number.isInteger(motionId)&&motionId!==document.editor.motionId)writes.push({offset:document.editor.motionOffset,expected:[document.editor.motionId],next:[motionId]});
      (frames||[]).forEach((next,index)=>{
        const command=document.commands[index];if(!command||command.end||command.unsupported)return;
        const frame=Math.max(0,Math.min(1,Number(next.image))),duration=Math.max(1,Math.min(63,Number(next.duration)));
        const flags=duration|(next.hFlip?64:0)|(next.vFlip?128:0);
        writes.push({offset:command.offset,expected:Array.from(this.memory.slice(command.offset,4)),next:[frame&255,frame>>8,flags&255,flags>>8]});
      });
      return writes;
    }
  }
  ns.GbaSpeciesAnimationCatalog=GbaSpeciesAnimationCatalog;
})(globalThis);
