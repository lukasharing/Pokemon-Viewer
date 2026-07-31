(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  const PROFILES=Object.freeze({
    ea9bcae617fdf159b045185467ae58b2e4a48b9a:Object.freeze({name:"Nidorino",bank:0x10,address:0x6099}),
    d7037c83e1ae5b39bde3c30787637ba1d4c48ce2:Object.freeze({name:"Jigglypuff",bank:0x10,address:0x6099})
  });
  const PALETTE=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);
  class Gen1SceneAnimationCatalog{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.profile=PROFILES[reader.capabilities?.fingerprint]||null;}
    list(){return this.profile?[this.introPokemon()]:[];}
    offset(frame){const {bank,address}=this.profile;return bank*0x4000+(address-0x4000)+frame*36*16;}
    image(frame){
      const canvas=document.createElement("canvas");canvas.width=canvas.height=48;const context=canvas.getContext("2d"),image=context.createImageData(48,48),start=this.offset(frame);
      const pixels=GbcSpriteCodec.decodeImage(this.memory,start,{width:48,height:48,order:"columns"});
      for(let index=0;index<pixels.length;index++){const ink=pixels[index],rgb=Number.parseInt(PALETTE[ink].slice(1),16),at=index*4;image.data.set([rgb>>16&255,rgb>>8&255,rgb&255,ink===0?0:255],at);}
      context.putImageData(image,0,0);return canvas;
    }
    introPokemon(){
      const commands=Array.from({length:3},(_,frame)=>Object.freeze({label:`Show picture ${frame+1}`,source:`Native ${this.profile.name} intro picture ${frame+1}`,offset:this.offset(frame),duration:1}));
      const frames=commands.map((command,index)=>Object.freeze({command:index,label:command.label,duration:1,get image(){return this.owner.image(index);},owner:this}));
      return new ns.AnimationDocument({id:"scene:intro-pokemon",name:`${this.profile.name} intro pictures`,domain:"scene",type:"scene",fps:ns.GBC_ANIMATION_TIMING?.refreshHz,offset:this.offset(0),commands,frames,accuracy:"partial",source:{repository:"pret/pokered",file:"engine/movie/intro.asm + gfx/intro"},properties:[
        {label:"Scene",value:"Opening battle"},{label:"Pictures",value:"Three exact 48×48 ROM pictures · native column-major tiles"},{label:"Timing",value:"Not decoded; one-step inspection only"},{label:"Graphics",value:MemoryUtils.hex(this.offset(0),5),complexity:"advanced"}
      ]});
    }
  }
  ns.Gen1SceneAnimationCatalog=Gen1SceneAnimationCatalog;
})(globalThis);
