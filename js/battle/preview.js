(function(global){
  "use strict";
  class BattlePreview {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");this.grid=false;this.scene=null;this.selectedId=null;this.paletteScratch=null;}
    setSize(width,height){this.canvas.width=width;this.canvas.height=height;}
    toggleGrid(){this.grid=!this.grid;return this.grid;}
    render(scene,frame={}) {
      this.scene=scene;
      const ctx=this.ctx,{width,height}=this.canvas;
      ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,width,height);
      if(!scene.verified){this.unavailable(scene);return;}
      const paletteBlends=frame.paletteBlends||[],forLayer=layer=>paletteBlends
        .filter(blend=>blend.targets?.[layer])
        .map(blend=>Number.isFinite(Number(blend.coefficients?.[layer]))
          ?{...blend,coefficient:Number(blend.coefficients[layer])}
          :blend);
      if(scene.backgroundCanvas){
        // ROM battle backgrounds are already rendered in the family's native
        // coordinate space. Never stretch one layer to compensate for a
        // mismatched canvas; doing so moves every sprite/HUD anchor relative
        // to the pixels beneath it.
        this.layer(scene.backgroundCanvas,0,0,scene.backgroundCanvas.width,scene.backgroundCanvas.height,forLayer("background"));
      }
      else{
        const bg=scene.background||["#eef7df","#c9e9b8"];
        ctx.fillStyle=bg[0];ctx.fillRect(0,0,width,height);
        ctx.fillStyle=bg[1];for(let y=0;y<height;y+=8)ctx.fillRect(0,y,width,1);
        if(scene.platform!==false)this.platform(scene.platform,width,height);
      }
      this.sprite(scene.enemy,frame.enemyOffset||{x:0,y:0},forLayer("target"),frame.enemyTransform);
      this.sprite(scene.player,frame.playerOffset||{x:0,y:0},forLayer("user"),frame.playerTransform);
      // Battle-animation OBJs belong to the battle field composition. Paint
      // them after battlers but before the native HUD/textbox; drawing them
      // over a fully mounted scene lets move particles cover healthboxes.
      for(const effect of frame.battleEffects||[])this.overlay(effect,forLayer("effects"));
      for(const overlay of scene.overlays||[])this.overlay(overlay);
      if(scene.textboxCanvas)ctx.drawImage(scene.textboxCanvas,0,0,width,height);
      this.hud(scene);
      this.textbox(scene.text||"",scene,Boolean(scene.textboxCanvas));
      for(const effect of frame.effects||[])this.effect(effect);
      this.selection(scene);
      if(this.grid)this.drawGrid();
    }
    point(event){const rect=this.canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*this.canvas.width/rect.width,y:(event.clientY-rect.top)*this.canvas.height/rect.height};}
    hitTest(event){const point=this.point(event),elements=this.scene?.elements||[];return[...elements].reverse().find(item=>{const b=item.bounds;return b&&point.x>=b.x&&point.x<b.x+b.width&&point.y>=b.y&&point.y<b.y+b.height;})||null;}
    select(id){this.selectedId=id;}
    selection(scene){const item=(scene.elements||[]).find(element=>element.id===this.selectedId);if(!item?.bounds)return;const b=item.bounds,ctx=this.ctx;ctx.save();ctx.strokeStyle="#ffca28";ctx.lineWidth=2;ctx.setLineDash([3,2]);ctx.strokeRect(b.x+1,b.y+1,b.width-2,b.height-2);ctx.restore();}
    unavailable(scene){
      const ctx=this.ctx,{width,height}=this.canvas;
      ctx.fillStyle="#f7f9fb";ctx.fillRect(0,0,width,height);
      ctx.strokeStyle="#cbd8e5";ctx.strokeRect(.5,.5,width-1,height-1);
      ctx.fillStyle="#334155";ctx.font="bold 10px sans-serif";ctx.fillText("Accurate battle sprite preview is not available for this ROM profile.",12,Math.floor(height/2)-4);
      ctx.fillStyle="#64748b";ctx.font="8px monospace";ctx.fillText(scene.reason||"No placeholder graphics are rendered.",12,Math.floor(height/2)+14);
    }
    platform(platform,width,height){
      this.ctx.fillStyle=platform?.color||"rgba(45,85,45,.18)";
      this.ctx.fillRect(width*.52,height*.35,width*.34,8);
      this.ctx.fillRect(width*.11,height*.67,width*.36,8);
    }
    blended(image,blends=[]){
      const active=blends.filter(blend=>Number(blend.coefficient)>0);
      if(!image||!active.length)return image;
      const owner=this.canvas.ownerDocument||global.document,scratch=this.paletteScratch||=owner.createElement("canvas"),
        width=image.width,height=image.height;
      scratch.width=width;scratch.height=height;
      const context=scratch.getContext("2d");context.imageSmoothingEnabled=false;context.clearRect(0,0,width,height);context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,width,height),data=pixels.data;
      for(const blend of active){
        const coefficient=Math.max(0,Math.min(16,Number(blend.coefficient)||0)),color=Number(blend.color)||0,
          target=[color&31,color>>5&31,color>>10&31];
        for(let index=0;index<data.length;index+=4){
          if(data[index+3]===0)continue;
          for(let channel=0;channel<3;channel++){
            const source=data[index+channel]>>3,
              mixed=source+((target[channel]-source)*coefficient>>4);
            data[index+channel]=mixed<<3;
          }
        }
      }
      context.putImageData(pixels,0,0);return scratch;
    }
    layer(image,x,y,width=image?.width,height=image?.height,blends=[]){
      if(!image)return;
      this.ctx.drawImage(this.blended(image,blends),x,y,width,height);
    }
    sprite(sprite,offset,blends=[],transform={}){
      if(!sprite)return;
      const ctx=this.ctx,x=sprite.x+offset.x,y=sprite.y+offset.y,w=sprite.width,h=sprite.height,
        scaleX=Number(transform?.scaleX)||1,scaleY=Number(transform?.scaleY)||1;
      if(sprite.image&&(scaleX!==1||scaleY!==1)){
        ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale(scaleX,scaleY);
        this.layer(sprite.image,-w/2,-h/2,w,h,blends);ctx.restore();
      }
      else if(sprite.image)this.layer(sprite.image,x,y,w,h,blends);
      else {ctx.fillStyle=sprite.color||"#4d7c59";ctx.fillRect(x,y,w,h);ctx.strokeStyle="#24313d";ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
    }
    overlay(item,blends=[]){
      if(!item?.image)return;
      const width=item.width||item.image.width,height=item.height||item.image.height;
      this.layer(item.image,item.x||0,item.y||0,width,height,blends);
    }
    hud(scene){
      if(!scene.hud)return;
      const ctx=this.ctx,box=(item)=>{
        if(item.image)ctx.drawImage(item.image,item.x,item.y,item.width,item.height);else if(scene.nativeHud)return;else{ctx.fillStyle="#fff";ctx.fillRect(item.x,item.y,item.width,item.height);ctx.strokeStyle="#111";ctx.lineWidth=1;ctx.strokeRect(item.x+.5,item.y+.5,item.width-1,item.height-1);}
        if(scene.nativeHud){
          const text=item.text;
          if(!text)throw new Error("A native HUD item requires family-owned text coordinates.");
          const font=scene.hudFont||scene.font;
          this.clippedText(scene,String(item.name||"").slice(0,text.nameLength||10),text.nameX,text.nameY,text.nameWidth,text.nameClip,{font});
          if(item.status&&!item.statusInImage&&text.statusX!=null){
            this.gameText(scene,String(item.status),text.statusX,text.statusY,text.statusWidth,{font});
          }else if(item.level){
            const level=String(item.level),align=(text.levelDigitAlign||0)*Math.max(0,3-level.length),x=text.levelX+align;
            ctx.save();
            if(text.levelClip){const clip=text.levelClip;ctx.beginPath();ctx.rect(clip.x,clip.y,clip.width,clip.height);ctx.clip();}
            if(Number.isInteger(text.levelGlyph)&&typeof font.drawGlyphs==="function")font.drawGlyphs(ctx,[text.levelGlyph,...font.ids(level)],x,text.levelY,{maxWidth:text.levelWidth});
            else this.gameText(scene,`${text.levelPrefix||""}${level}`,x,text.levelY,text.levelWidth,{font});
            ctx.restore();
          }
          return;
        }
        ctx.fillStyle="#111";ctx.font="8px monospace";ctx.fillText(String(item.name||"").slice(0,10),item.x+4,item.y+9);
        if(item.level)ctx.fillText(`L${item.level}`,item.x+item.width-24,item.y+18);
        const barY=item.y+item.height-6;if(!item.image){ctx.strokeRect(item.x+16,barY,item.width-20,4);ctx.fillText("HP",item.x+3,barY+4);}ctx.fillStyle="#18a848";ctx.fillRect(item.x+17,barY+1,item.width-22,3);
      };
      box(scene.hud.enemy);box(scene.hud.player);
    }
    gameText(scene,text,x,y,maxWidth=Infinity,options={}){
      const font=options.font||scene.font;
      if(!font)throw new Error(`Verified ${scene.layout} battle scene has no native ROM font.`);
      const {font:unused,...drawOptions}=options;
      return font.draw(this.ctx,text,x,y,{...drawOptions,maxWidth});
    }
    clippedText(scene,text,x,y,maxWidth,clip,options={}){
      if(!clip)return this.gameText(scene,text,x,y,maxWidth,options);
      this.ctx.save();this.ctx.beginPath();this.ctx.rect(clip.x,clip.y,clip.width,clip.height);this.ctx.clip();
      const width=this.gameText(scene,text,x,y,maxWidth,options);this.ctx.restore();return width;
    }
    textbox(text,scene,mounted=false){
      const ctx=this.ctx,{width,height}=this.canvas;
      const layout=scene.textLayout||{top:height-48,x:8,y:height-32,maxWidth:width-16,lineHeight:16,maxLines:2},top=layout.top;
      if(!mounted){
        ctx.fillStyle="#fff";ctx.fillRect(0,top,width,48);
        ctx.strokeStyle="#111";ctx.lineWidth=1;ctx.strokeRect(.5,top+.5,width-1,47);
        ctx.strokeRect(4.5,top+4.5,width-9,39);
      }
      if(!scene.font)return;
      const {x,y,maxWidth,lineHeight,maxLines=2}=layout,words=String(text).trim().split(/\s+/);let line="",row=0;
      for(const word of words){const next=line?`${line} ${word}`:word;if(scene.font.measure(next)>maxWidth&&line){this.gameText(scene,line,x,y+row*lineHeight,maxWidth);line=word;if(++row>=maxLines)return;}else line=next;}
      if(line&&row<maxLines)this.gameText(scene,line,x,y+row*lineHeight,maxWidth);
    }
    effect(effect){
      const ctx=this.ctx;
      ctx.save();ctx.strokeStyle=effect.color||"#f4d35e";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(effect.x,effect.y,effect.radius||8,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    drawGrid(){
      const ctx=this.ctx,{width,height}=this.canvas;
      ctx.strokeStyle="rgba(36,49,61,.12)";ctx.lineWidth=1;
      for(let x=0;x<width;x+=8){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,height);ctx.stroke();}
      for(let y=0;y<height;y+=8){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(width,y+.5);ctx.stroke();}
    }
  }
  global.BattlePreview=BattlePreview;
})(globalThis);
