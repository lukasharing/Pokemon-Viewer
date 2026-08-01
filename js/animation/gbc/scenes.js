(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  const PROFILES=Object.freeze({
    ea9bcae617fdf159b045185467ae58b2e4a48b9a:Object.freeze({name:"Nidorino"}),
    d7037c83e1ae5b39bde3c30787637ba1d4c48ce2:Object.freeze({name:"Jigglypuff"})
  });
  // rBGP receives BLACK,DARK,LIGHT,WHITE through RGBDS `ldpal`, whose
  // arguments are packed for color numbers 3..0. Raw color 0 is therefore
  // white and raw color 3 is black.
  const PALETTE=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);
  const banked=(bank,address)=>bank*0x4000+(address-0x4000);
  const OFFSETS=Object.freeze({
    gengar:banked(0x10,0x5a99),
    front:Object.freeze([0x6099,0x62d9,0x6519].map(address=>banked(0x10,address))),
    tilemaps:Object.freeze([0x5b8d,0x5bbe,0x5bef].map(address=>banked(0x1e,address))),
    motion:Object.freeze([0x5910,0x591b,0x5926,0x5931,0x593c,0x5947,0x5950].map(address=>banked(0x10,address)))
  });
  const color=value=>Number.parseInt(PALETTE[value].slice(1),16);
  const signed=value=>value>127?value-256:value;
  const paintTile=(image,pixels,originX,originY,{transparent=false,inks=null}={})=>{
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const ink=pixels[y*8+x],px=originX+x,py=originY+y;
      if(px<0||py<0||px>=image.width||py>=image.height||(transparent&&ink===0))continue;
      const rgb=color(ink),at=(py*image.width+px)*4;
      image.data.set([rgb>>16&255,rgb>>8&255,rgb&255,255],at);
      if(inks)inks[py*image.width+px]=ink;
    }
  };
  class Gen1IntroScene{
    constructor(reader,profile){this.reader=reader;this.memory=reader.memory;this.profile=profile;}
    tile(offset,id){return GbcSpriteCodec.decodeTile(this.memory,offset+id*16);}
    motion(id){
      const values=[],offset=OFFSETS.motion[id];let cursor=offset;
      for(let count=0;count<16;count++){
        const y=this.memory.u8(cursor++);if(y===80)break;
        values.push(Object.freeze({y:signed(y),x:signed(this.memory.u8(cursor++))}));
      }
      return Object.freeze(values);
    }
    image({gengarFrame=0,scrollX=0,frontFrame=0,x=-8,y=72},isolation=null){
      const canvas=document.createElement("canvas");canvas.width=160;canvas.height=144;
      const context=canvas.getContext("2d"),image=context.createImageData(canvas.width,canvas.height),
        background=context.createImageData(canvas.width,canvas.height),front=context.createImageData(canvas.width,canvas.height),
        inks=new Uint8Array(canvas.width*canvas.height),
        tilemap=Array.from({length:32*18},(_,index)=>Math.floor(index/32)<4||Math.floor(index/32)>=14?1:0),
        showBackground=!isolation||isolation==="background",showGengar=!isolation||isolation==="gengar",showFront=!isolation||isolation==="front";
      this.memory.assertRange(OFFSETS.tilemaps[gengarFrame],49);
      if(showGengar)for(let row=0;row<7;row++)for(let column=0;column<7;column++)
        tilemap[(7+row)*32+13+column]=this.memory.u8(OFFSETS.tilemaps[gengarFrame]+row*7+column);
      const nativeScroll=((scrollX%256)+256)%256;
      if(showBackground||showGengar)for(let row=0;row<18;row++)for(let column=0;column<32;column++){
        const isGengar=row>=7&&row<14&&column>=13&&column<20;
        if((isGengar&&!showGengar)||(!isGengar&&!showBackground))continue;
        const screenX=column*8-nativeScroll;
        for(const wrappedX of[screenX-256,screenX,screenX+256])
          paintTile(background,this.tile(OFFSETS.gengar,tilemap[row*32+column]),wrappedX,row*8,{transparent:Boolean(isolation),inks});
      }
      if(showFront)for(let column=0;column<6;column++)for(let row=0;row<6;row++)
        paintTile(front,this.tile(OFFSETS.front[frontFrame],column*6+row),x+column*8,y+row*8,{transparent:true});
      for(let pixel=0;pixel<inks.length;pixel++){
        const at=pixel*4,frontVisible=front.data[at+3]&&(!background.data[at+3]||inks[pixel]===0);
        const source=frontVisible?front:background;
        image.data.set(source.data.subarray(at,at+4),at);
      }
      context.putImageData(image,0,0);return canvas;
    }
    document(){
      const commands=[],frames=[],state={gengarFrame:0,scrollX:0,frontFrame:0,x:-8,y:72};
      const add=(kind,duration=1,source=kind)=>{
        const label=`Step ${commands.length+1} · ${kind}`,
          snapshot=Object.freeze({...state}),command=Object.freeze({label,source,duration});
        const cache=new Map();
        commands.push(command);frames.push(Object.freeze({
          command:commands.length-1,label,duration,
          regions:Object.freeze([
            Object.freeze({id:"background",label:"Background",x:0,y:0,width:160,height:144}),
            Object.freeze({id:"gengar",label:"Sprite 1",x:104-snapshot.scrollX,y:56,width:56,height:56}),
            Object.freeze({id:"front",label:"Sprite 2",x:snapshot.x,y:snapshot.y,width:48,height:48})
          ]),
          imageFor:isolation=>{
            const key=isolation||"all";
            if(!cache.has(key))cache.set(key,this.image(snapshot,isolation));
            return cache.get(key);
          }
        }));
      };
      const pause=duration=>add("Delay",duration,`DelayFrames ${duration}`);
      const moveFront=steps=>{
        for(let step=0;step<steps;step++){state.x+=2;add("Translate sprite 2",2,"IntroMoveMon MOVE_NIDORINO_RIGHT · 2 px");}
      };
      const animate=id=>{
        for(const delta of this.motion(id)){state.x+=delta.x;state.y+=delta.y;add(`Motion sequence ${id+1}`,5,`AnimateIntroNidorino ${id} · (${delta.x}, ${delta.y})`);}
      };
      const moveSprite1=(steps,direction)=>{
        for(let step=0;step<steps;step++){state.scrollX+=direction*2;add("Translate sprite 1",2,`IntroMoveMon ${direction>0?"MOVE_GENGAR_LEFT":"MOVE_GENGAR_RIGHT"} · 2 px`);}
      };
      add("Initialize scene",1,"TILEMAP_GENGAR_INTRO_1 + InitIntroNidorinoOAM");
      moveFront(40);
      animate(0);animate(1);pause(10);
      animate(0);animate(1);pause(30);
      state.gengarFrame=1;moveSprite1(4,1);pause(30);
      state.gengarFrame=2;moveSprite1(8,-1);
      state.frontFrame=1;animate(2);pause(30);
      moveSprite1(4,1);state.gengarFrame=0;pause(60);
      state.frontFrame=0;animate(3);animate(4);pause(20);
      state.frontFrame=1;animate(5);pause(30);
      state.frontFrame=2;animate(6);
      return new ns.AnimationDocument({
        id:"scene:intro-battle",name:`Gengar vs ${this.profile.name}`,domain:"scene",type:"scene",
        fps:ns.GBC_ANIMATION_TIMING?.refreshHz,offset:OFFSETS.gengar,commands:Object.freeze(commands),
        frames:Object.freeze(frames),accuracy:"partial",
        layers:Object.freeze([
          Object.freeze({id:"background",label:"Background and bars",icon:"fa-panorama"}),
          Object.freeze({id:"gengar",label:"Sprite 1",icon:"fa-ghost"}),
          Object.freeze({id:"front",label:"Sprite 2",icon:"fa-paw"})
        ]),
        source:{repository:"pret/pokered",file:"engine/movie/intro.asm + data/tilemaps.asm + gfx/intro"},
        properties:[
          {label:"Scene",value:"Complete opening battle composition"},
          {label:"Layers",value:"Background + sprite 1 + sprite 2"},
          {label:"Playback",value:"Verified visual delays, scroll steps, picture changes and movement lists; audio is not executed"},
          {label:"Graphics",value:MemoryUtils.hex(OFFSETS.gengar,5),complexity:"advanced"}
        ]
      });
    }
  }
  class Gen1SceneAnimationCatalog{
    constructor(reader){this.reader=reader;this.profile=PROFILES[reader.capabilities?.fingerprint]||null;}
    list(){return this.profile?[new Gen1IntroScene(this.reader,this.profile).document()]:[];}
  }
  ns.Gen1IntroScene=Gen1IntroScene;
  ns.Gen1SceneAnimationCatalog=Gen1SceneAnimationCatalog;
})(globalThis);
