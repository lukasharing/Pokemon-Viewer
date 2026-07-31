(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation,align4=value=>(value+3)&~3;
  const DEFINITIONS=Object.freeze({
    legends:Object.freeze([
      ["groudonGfx",0x4000],["groudonMap",0x2000],["kyogreGfx",0x4000],["kyogreMap",0x2000],
      ["legendBgGfx",0x4000],["groudonBgMap",0x800],["kyogreBgMap",0x800],
      ["cloudsGfx",0x2000],["cloudsLeftMap",0x1000],["cloudsRightMap",0x1000],["cloudsSunMap",0x800]
    ]),
    rayquazaMaps:Object.freeze([["rayquazaMap",0x800],["unusedMap1",0x800],["unusedMap2",0x800]]),
    rayquazaCloudMap:Object.freeze([["rayquazaCloudMap",0x800]])
  });
  const blank=()=>{const canvas=document.createElement("canvas");canvas.width=240;canvas.height=160;return canvas;};
  const command=(label,source,duration,control=null,args=[])=>Object.freeze({label,source,duration,control,args});

  class GbaIntroAssetLocator{
    constructor(reader){this.reader=reader;this.memory=reader.memory;this.profile=reader.memoryProfile;}
    required(name){const value=this.profile?.require?.(name);if(!Number.isInteger(value?.offset))throw new Error(`Emerald intro requires verified symbol ${name}.`);return value;}
    decoded(name){const symbol=this.required(name);return Object.freeze({...root.gba.GbaLz77.decode(this.memory,symbol.offset),name});}
    sequence(after,before,definitions){
      const anchor=this.decoded(after),end=this.required(before).offset,result={};let cursor=align4(anchor.offset+anchor.consumed);
      for(const [name,size] of definitions){
        const decoded=root.gba.GbaLz77.decode(this.memory,cursor,{maxOutput:0x10000,maxInput:0x10000});
        if(decoded.bytes.length!==size)throw new Error(`${name} has ${decoded.bytes.length} decoded bytes; pret/pokeemerald declares ${size}.`);
        result[name]=Object.freeze({...decoded,name});cursor=align4(cursor+decoded.consumed);
      }
      if(cursor!==end)throw new Error(`Emerald intro declaration block ends at ${MemoryUtils.hex(cursor,6)}, not verified anchor ${MemoryUtils.hex(end,6)}.`);
      return result;
    }
    locate(){
      const paletteSymbol=this.required("gIntro3Bg_Pal");this.memory.assertRange(paletteSymbol.offset,0x200);
      return Object.freeze({
        paletteOffset:paletteSymbol.offset,palette:this.memory.slice(paletteSymbol.offset,0x200),
        ...this.sequence("gIntroMay_Gfx","gIntroLightning_Gfx",DEFINITIONS.legends),
        lightning:this.decoded("gIntroLightning_Gfx"),
        rayquaza:this.decoded("gIntroRayquaza_Gfx"),
        ...this.sequence("gIntroRayquaza_Gfx","gIntroRayquazaClouds_Gfx",DEFINITIONS.rayquazaMaps),
        rayquazaClouds:this.decoded("gIntroRayquazaClouds_Gfx"),
        ...this.sequence("gIntroRayquazaClouds_Gfx","gIntroBubbles_Gfx",DEFINITIONS.rayquazaCloudMap)
      });
    }
  }

  class GbaEmeraldIntroScene{
    constructor(reader){
      this.reader=reader;this.assets=new GbaIntroAssetLocator(reader).locate();
      this.palette=root.gba.GbaTilemapRenderer.colors(this.assets.palette);
      this.cache=new Map();
    }
    text(tiles,tilemap,{stride=32,transparentZero=false}={}){
      return root.gba.GbaTilemapRenderer.renderText4bpp({tiles:tiles.bytes,tilemap:tilemap.bytes,palette:this.palette,width:30,height:20,stride,transparentZero});
    }
    affine(tiles,tilemap){
      return root.gba.GbaTilemapRenderer.renderAffine8bpp({tiles:tiles.bytes,tilemap:tilemap.bytes,palette:this.palette,width:64,height:64,stride:64,transparentZero:true});
    }
    drawAffine(context,image,screenX,screenY){context.drawImage(image,Math.round(screenX-128),Math.round(screenY-128));}
    legend(stage,isolation){
      const canvas=blank(),context=canvas.getContext("2d");context.imageSmoothingEnabled=false;
      const background=stage.startsWith("kyogre")
        ?this.text(this.assets.legendBgGfx,this.assets.kyogreBgMap)
        :this.text(this.assets.legendBgGfx,this.assets.groudonBgMap);
      if(!isolation||isolation==="background")context.drawImage(background,0,0);
      if(!isolation||isolation==="legend"){
        const isKyogre=stage.startsWith("kyogre"),figure=this.affine(isKyogre?this.assets.kyogreGfx:this.assets.groudonGfx,isKyogre?this.assets.kyogreMap:this.assets.groudonMap);
        this.drawAffine(context,figure,isKyogre?88:80,isKyogre?80:40);
      }
      if(!isolation||isolation==="atmosphere"){
        context.fillStyle="#000";context.fillRect(0,0,240,32);context.fillRect(0,128,240,32);
      }
      return canvas;
    }
    clouds(progress,isolation){
      const canvas=blank(),context=canvas.getContext("2d");context.imageSmoothingEnabled=false;
      if(!isolation||isolation==="background")context.drawImage(this.text(this.assets.cloudsGfx,this.assets.cloudsSunMap),0,0);
      if(!isolation||isolation==="atmosphere"){
        const left=this.text(this.assets.cloudsGfx,this.assets.cloudsLeftMap,{stride:64,transparentZero:true}),right=this.text(this.assets.cloudsGfx,this.assets.cloudsRightMap,{stride:64,transparentZero:true}),distance=Math.round(80*(1-progress));
        context.drawImage(left,distance,0);context.drawImage(right,-distance,0);
      }
      return canvas;
    }
    rayquaza(flash,isolation){
      const canvas=blank(),context=canvas.getContext("2d");context.imageSmoothingEnabled=false;
      context.fillStyle="#302b36";context.fillRect(0,0,240,160);
      if(!isolation||isolation==="background")context.drawImage(this.text(this.assets.rayquazaClouds,this.assets.rayquazaCloudMap,{transparentZero:true}),0,0);
      if(!isolation||isolation==="legend")context.drawImage(this.text(this.assets.rayquaza,this.assets.rayquazaMap,{transparentZero:true}),0,0);
      if(flash&&(!isolation||isolation==="atmosphere")){context.fillStyle=`rgba(255,255,255,${flash})`;context.fillRect(0,0,240,160);}
      return canvas;
    }
    image(state,isolation=null){
      const key=`${state.stage}:${state.progress||0}:${state.flash||0}:${isolation||"all"}`;
      if(!this.cache.has(key))this.cache.set(key,state.stage.startsWith("groudon")||state.stage.startsWith("kyogre")?this.legend(state.stage,isolation):state.stage==="clouds"?this.clouds(state.progress,isolation):this.rayquaza(state.flash,isolation));
      return this.cache.get(key);
    }
    document(){
      const commands=Object.freeze([
        command("Load Groudon scene","Task_Scene3_LoadGroudon",1,null,["gIntroGroudon_Gfx","gIntroGroudon_Tilemap"]),
        command("Groudon reveal","Task_Scene3_Groudon",96),
        command("Load Kyogre scene","Task_Scene3_LoadKyogre",1,null,["gIntroKyogre_Gfx","gIntroKyogre_Tilemap"]),
        command("Kyogre reveal","Task_Scene3_Kyogre",112),
        command("Load cloud layers","Task_Scene3_LoadClouds1",1,null,["gIntroClouds_Gfx"]),
        command("Clouds close","Task_Scene3_Clouds",80),
        command("First lightning","Task_Scene3_Lightning · x=200",72),
        command("Second lightning","Task_Scene3_Lightning · x=40",48),
        command("Rayquaza intervenes","Task_Scene3_Rayquaza",96)
      ]);
      const states=[
        {stage:"groudon-load"},{stage:"groudon-reveal"},{stage:"kyogre-load"},{stage:"kyogre-reveal"},
        {stage:"clouds",progress:0},{stage:"clouds",progress:1},{stage:"rayquaza",flash:.72},{stage:"rayquaza",flash:.38},{stage:"rayquaza",flash:0}
      ];
      const frames=Object.freeze(states.map((state,index)=>Object.freeze({
        command:index,label:commands[index].label,duration:commands[index].duration,
        regions:Object.freeze([
          Object.freeze({id:"background",label:"Background",x:0,y:0,width:240,height:160}),
          Object.freeze({id:"legend",label:"Legendary picture",x:0,y:0,width:240,height:160}),
          Object.freeze({id:"atmosphere",label:"Atmosphere",x:0,y:0,width:240,height:160})
        ]),
        imageFor:isolation=>this.image(state,isolation)
      })));
      return new ns.AnimationDocument({
        id:"scene:emerald-intro-legends",name:"Emerald intro · Groudon, Kyogre and Rayquaza",domain:"scene",type:"scene",fps:ns.GBA_ANIMATION_TIMING?.refreshHz,
        offset:this.assets.groudonGfx.offset,commands,frames,accuracy:"partial",layers:Object.freeze([
          Object.freeze({id:"background",label:"Background",icon:"fa-panorama"}),
          Object.freeze({id:"legend",label:"Legendary picture",icon:"fa-dragon"}),
          Object.freeze({id:"atmosphere",label:"Windows, clouds and flashes",icon:"fa-cloud-bolt"})
        ]),source:{repository:"pret/pokeemerald",file:"src/intro.c + src/data/graphics/intro_scene.h"},properties:[
          {label:"Scene",value:"Native 240×160 composition from ROM tile graphics, tilemaps and palette"},
          {label:"Playback",value:"Verified scene order and major native delays; sprite tasks, scanline waves, cries and per-tick affine interpolation remain explicit but unsimulated"},
          {label:"Discovery",value:"Profile symbols plus fail-closed decompiled declaration sequence",complexity:"advanced"},
          {label:"Palette",value:MemoryUtils.hex(this.assets.paletteOffset,6),complexity:"advanced"}
        ]
      });
    }
  }
  class GbaIntroSceneCatalog{
    constructor(reader){this.reader=reader;}
    list(){return[new GbaEmeraldIntroScene(this.reader).document()];}
  }
  ns.GbaIntroAssetLocator=GbaIntroAssetLocator;
  ns.GbaEmeraldIntroScene=GbaEmeraldIntroScene;
  ns.GbaIntroSceneCatalog=GbaIntroSceneCatalog;
})(globalThis);
