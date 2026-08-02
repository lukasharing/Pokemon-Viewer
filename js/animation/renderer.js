(function(global){
  "use strict";
  const COLORS=Object.freeze({ink:"#24313d",muted:"#64748b",line:"#d3e0ec",surface:"#ffffff",canvas:"#f7fafc",primary:"#2f86c9",green:"#198754",amber:"#b56a00"});
  class AnimationRenderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");this.nativeCanvas=null;this.nativePreview=null;this.isolation=null;this.regions=new UiCanvasRegions(canvas);}
    get hitRegions(){return this.regions.items.map(item=>item.source);}
    set hitRegions(items){this.regions.set(items||[]);}
    setIsolation(id){this.isolation=id||null;return this;}
    select(id){this.regions.select(id);return this;}
    pickRegion(clientX,clientY){return this.regions.hit(clientX,clientY);}
    pickLayer(clientX,clientY){
      return this.pickRegion(clientX,clientY)?.id||null;
    }
    background(){
      const ctx=this.ctx,{width,height}=this.canvas;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,width,height);
      ctx.fillStyle=COLORS.canvas;ctx.fillRect(0,0,width,height);ctx.strokeStyle=COLORS.line;ctx.lineWidth=1;
      for(let x=.5;x<width;x+=8){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
      for(let y=.5;y<height;y+=8){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    }
    fitText(text,maxWidth){
      const ctx=this.ctx,value=String(text??"");if(ctx.measureText(value).width<=maxWidth)return value;
      let output=value;while(output.length&&ctx.measureText(`${output}…`).width>maxWidth)output=output.slice(0,-1);return`${output}…`;
    }
    image(document,frame,image){
      const ctx=this.ctx,{width,height}=this.canvas,availableHeight=height-28;
      const scale=Math.max(1,Math.floor(Math.min((width-28)/image.width,(availableHeight-12)/image.height)));
      const drawWidth=image.width*scale,drawHeight=image.height*scale,x=Math.round((width-drawWidth)/2),y=Math.round((availableHeight-drawHeight)/2);
      this.regions.set(frame.regions||[],{offsetX:x,offsetY:y,scaleX:scale});
      ctx.save();ctx.translate(frame.hFlip?width:0,frame.vFlip?availableHeight:0);ctx.scale(frame.hFlip?-1:1,frame.vFlip?-1:1);
      ctx.drawImage(image,x,y,drawWidth,drawHeight);ctx.restore();
      this.regions.draw(ctx);
      ctx.fillStyle="rgba(255,255,255,.92)";ctx.fillRect(0,height-25,width,25);ctx.strokeStyle=COLORS.line;ctx.strokeRect(.5,height-25.5,width-1,25);
      ctx.fillStyle=COLORS.ink;ctx.font="bold 9px system-ui";ctx.fillText(this.fitText(frame.label||document.name,width-16),8,height-10);
    }
    drawNativeScene(document,frame){
      const scene=document.scene,state=frame.state||{},ctx=this.ctx,{width,height}=this.canvas;
      if(!scene)return false;
      const scale=Math.min(width/scene.width,height/scene.height),viewWidth=scene.width*scale,viewHeight=scene.height*scale;
      const left=(width-viewWidth)/2,top=(height-viewHeight)/2;
      ctx.save();ctx.translate(left,top);ctx.scale(scale,scale);
      const objects=(state.sprites||[]).filter(value=>value&&typeof value==="object");
      const paintObjects=(paintContext)=>{
        objects.forEach((object,index)=>{
          const image=object.asset?.canvas;if(!image)return;
          const anchor=scene.anchors[object.anchor]||scene.anchors.target,nativeFrame=object.asset?.nativeFrame,
            frameX=Number(nativeFrame?.x)||0,frameY=Number(nativeFrame?.y)||0,
            destination=scene.anchors[nativeFrame?.toAnchor],progress=Math.max(0,Math.min(1,Number(nativeFrame?.progress)||0)),
            objectX=Number(object.x)||0,objectY=Number(object.y)||0,
            point=destination?{
              x:(anchor.x+objectX)*(1-progress)+(destination.x+(Number(nativeFrame?.targetX)||0))*progress,
              y:(anchor.y+objectY)*(1-progress)+(destination.y+(Number(nativeFrame?.targetY)||0))*progress
            }:{x:anchor.x+objectX,y:anchor.y+objectY};
          const x=object.asset.sceneOverlay?0:point.x+frameX-image.width/2;
          const y=object.asset.sceneOverlay?0:point.y+frameY-image.height/2;
          const scaleX=Number(nativeFrame?.scaleX)||(nativeFrame?.hFlip?-1:1),scaleY=Number(nativeFrame?.scaleY)||(nativeFrame?.vFlip?-1:1),rotation=Number(nativeFrame?.rotation)||0;
          paintContext.save();paintContext.translate(Math.round(x+image.width/2),Math.round(y+image.height/2));paintContext.rotate(rotation);paintContext.scale(scaleX,scaleY);
          paintContext.drawImage(image,-image.width/2,-image.height/2);paintContext.restore();
        });
      };
      if(scene.nativeScene&&typeof global.BattlePreview==="function"){
        if(!this.nativeCanvas||this.nativeCanvas.width!==scene.width||this.nativeCanvas.height!==scene.height){
          this.nativeCanvas=global.document.createElement("canvas");
          this.nativeCanvas.width=scene.width;this.nativeCanvas.height=scene.height;
          this.nativePreview=new global.BattlePreview(this.nativeCanvas);
        }
        const effects=global.document.createElement("canvas"),effectsContext=effects.getContext("2d");
        effects.width=scene.width;effects.height=scene.height;effectsContext.imageSmoothingEnabled=false;
        paintObjects(effectsContext);
        const offset=target=>(state.sceneTracks||[]).filter(item=>item.target===target||item.target==="both").reduce((total,item)=>({
          x:total.x+(Number(item.x)||0),y:total.y+(Number(item.y)||0)
        }),{x:0,y:0});
        const transform=target=>(state.sceneTracks||[]).filter(item=>item.target===target).reduce((total,item)=>({
          scaleX:total.scaleX*(Number(item.scaleX)||1),
          scaleY:total.scaleY*(Number(item.scaleY)||1),
          rotation:total.rotation+(Number(item.rotation)||0)
        }),{scaleX:1,scaleY:1,rotation:0});
        const mountedBackground=state.background?.canvas?state.background:null,
          rotation=(state.sceneTracks||[]).reduce((total,track)=>total+(Number(track.backgroundPaletteRotation)||0),0),
          backgroundCanvas=mountedBackground
            ?mountedBackground.paletteCycles?.[((rotation%11)+11)%11]||mountedBackground.canvas
            :null,
          nativeScene=backgroundCanvas
            ?{
              ...scene.nativeScene,backgroundCanvas,
              backgroundScrollCanvas:mountedBackground.scrollCanvas,
              backgroundViewport:mountedBackground.viewport
            }
            :scene.nativeScene;
        const playerRole=scene.roles?.player||"user",opponentRole=scene.roles?.opponent||"target",
          visible=role=>state.visibility&&typeof state.visibility==="object"
            ?state.visibility[role]!==false
            :state.visibility!=="hidden",
          projectEffect=effect=>{
            if(!effect?.targets)return effect;
            const targets=effect.targets,coefficients=effect.coefficients;
            return{
              ...effect,
              targets:{...targets,user:Boolean(targets[playerRole]),target:Boolean(targets[opponentRole])},
              ...(coefficients?{coefficients:{...coefficients,user:coefficients[playerRole],target:coefficients[opponentRole]}}:{})
            };
          };
        this.nativePreview.render(nativeScene,{
          playerOffset:offset(playerRole),enemyOffset:offset(opponentRole),
          backgroundOffset:offset("background"),
          playerTransform:transform(playerRole),enemyTransform:transform(opponentRole),
          playerVisible:visible(playerRole),enemyVisible:visible(opponentRole),
          paletteEffects:(state.sceneTracks||[]).flatMap(track=>
            [track.paletteBlend,track.paletteEffect].filter(Boolean).map(projectEffect)
          ),
          battleEffects:objects.length?[{image:effects,x:0,y:0,width:scene.width,height:scene.height}]:[]
        });
        ctx.drawImage(this.nativeCanvas,0,0);
        this.regions.set(scene.nativeScene.elements||[],{offsetX:left,offsetY:top,scaleX:scale});
      }else if(scene.baseCanvas)ctx.drawImage(scene.baseCanvas,0,0);
      else{
        ctx.fillStyle=scene.family==="gba"?"#e7ffd6":"#ffffff";ctx.fillRect(0,0,scene.width,scene.height);
        ctx.strokeStyle=scene.family==="gba"?"#c8efb2":"#d7d7d7";ctx.lineWidth=1;
        for(let y=8;y<scene.height;y+=8){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(scene.width,y+.5);ctx.stroke();}
      }
      const draw=(image,point)=>{if(image&&point)ctx.drawImage(image,point.x,point.y);};
      if(!scene.nativeScene){
        const visible=role=>state.visibility&&typeof state.visibility==="object"
          ?state.visibility[role]!==false
          :state.visibility!=="hidden";
        if(visible(scene.roles?.opponent||"target"))draw(scene.opponent,scene.anchors.opponent);
        if(visible(scene.roles?.player||"user"))draw(scene.player,scene.anchors.player);
      }
      // A family-owned BattlePreview has already composited effects into the
      // battle field before its HUD. Fallback scenes have no mounted HUD, so
      // they can draw directly here.
      if(!scene.nativeScene)paintObjects(ctx);
      if(state.blend&&!scene.nativeScene){ctx.fillStyle="rgba(255,255,255,.16)";ctx.fillRect(0,0,scene.width,scene.height);}
      ctx.restore();
      this.regions.draw(ctx);
      const command=document.commands?.[frame.command],label=command?.source||frame.label||document.name;
      ctx.fillStyle="rgba(20,34,48,.88)";ctx.fillRect(0,height-20,width,20);ctx.fillStyle="#fff";ctx.font="bold 8px ui-monospace, monospace";ctx.fillText(this.fitText(label,width-12),6,height-7);
      return true;
    }
    program(document,frame){
      const ctx=this.ctx,{width,height}=this.canvas,command=document.commands?.[frame.command],state=frame.state||{};
      if(this.drawNativeScene(document,frame))return;
      ctx.fillStyle="rgba(255,255,255,.94)";ctx.fillRect(7,7,width-14,height-14);ctx.strokeStyle=COLORS.line;ctx.strokeRect(7.5,7.5,width-15,height-15);
      ctx.fillStyle=COLORS.ink;ctx.font="bold 10px system-ui";ctx.fillText(this.fitText(document.name,width-28),14,22);
      ctx.fillStyle=COLORS.primary;ctx.font="bold 9px ui-monospace, monospace";ctx.fillText(this.fitText(command?.label||"Native program",width-28),14,36);
      ctx.fillStyle=COLORS.muted;ctx.font="8px ui-monospace, monospace";ctx.fillText(this.fitText(command?.source||state.note||"",width-28),14,48);
      const rows=[
        ["Graphics",(state.resources||[]).at(-1)?.name||(state.resources||[]).at(-1)||"—"],
        ["Objects",(state.sprites||[]).at(-1)?.label||(state.sprites||[]).at(-1)||"—"],
        ["Tasks",(state.tasks||[]).at(-1)||"—"],
        ["Audio",(state.sounds||[]).at(-1)||"—"],
        ["Video",state.background||state.palette||state.blend||
          (state.visibility&&typeof state.visibility==="object"
            ?Object.entries(state.visibility).filter(([,shown])=>!shown).map(([role])=>`${role} hidden`).join(", ")||"visible"
            :state.visibility)||"—"]
      ];
      rows.forEach(([label,value],index)=>{
        const y=59+index*16;ctx.fillStyle=index%2?"#f7fafc":"#eef5fb";ctx.fillRect(14,y,width-28,14);
        ctx.fillStyle=COLORS.muted;ctx.font="bold 7px system-ui";ctx.fillText(label.toUpperCase(),19,y+10);
        ctx.fillStyle=COLORS.ink;ctx.font="8px ui-monospace, monospace";ctx.fillText(this.fitText(value,width-88),70,y+10);
      });
      const total=Math.max(1,document.commands?.length||1),position=Math.max(0,Number(frame.command)||0);
      ctx.fillStyle=COLORS.line;ctx.fillRect(14,height-17,width-28,4);ctx.fillStyle=COLORS.primary;ctx.fillRect(14,height-17,Math.max(2,(width-28)*(position+1)/total),4);
    }
    render(document,frame={}){
      this.background();this.regions.set([]);
      let image=null,error=null;
      try{image=typeof frame.imageFor==="function"?frame.imageFor(this.isolation):frame.image||null;}catch(reason){error=reason;}
      if(image)this.image(document,frame,image);else this.program(document,frame);
      const ctx=this.ctx,{width}=this.canvas;ctx.fillStyle=document.accuracy==="verified"?COLORS.green:COLORS.amber;ctx.fillRect(width-8,0,8,8);
      return Object.freeze({native:Boolean(image),error});
    }
  }
  global.AnimationRenderer=AnimationRenderer;
})(globalThis);
