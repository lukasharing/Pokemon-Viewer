(function(global){
  "use strict";
  const COLORS=Object.freeze({ink:"#24313d",muted:"#64748b",line:"#d3e0ec",surface:"#ffffff",canvas:"#f7fafc",primary:"#2f86c9",green:"#198754",amber:"#b56a00"});
  class AnimationRenderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");}
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
      ctx.save();ctx.translate(frame.hFlip?width:0,frame.vFlip?availableHeight:0);ctx.scale(frame.hFlip?-1:1,frame.vFlip?-1:1);
      ctx.drawImage(image,x,y,drawWidth,drawHeight);ctx.restore();
      ctx.fillStyle="rgba(255,255,255,.92)";ctx.fillRect(0,height-25,width,25);ctx.strokeStyle=COLORS.line;ctx.strokeRect(.5,height-25.5,width-1,25);
      ctx.fillStyle=COLORS.ink;ctx.font="bold 9px system-ui";ctx.fillText(this.fitText(frame.label||document.name,width-16),8,height-10);
    }
    drawNativeScene(document,frame){
      const scene=document.scene,state=frame.state||{},ctx=this.ctx,{width,height}=this.canvas;
      if(!scene)return false;
      const scale=Math.min(width/scene.width,height/scene.height),viewWidth=scene.width*scale,viewHeight=scene.height*scale;
      const left=(width-viewWidth)/2,top=(height-viewHeight)/2;
      ctx.save();ctx.translate(left,top);ctx.scale(scale,scale);
      if(scene.baseCanvas)ctx.drawImage(scene.baseCanvas,0,0);
      else{
        ctx.fillStyle=scene.family==="gba"?"#e7ffd6":"#ffffff";ctx.fillRect(0,0,scene.width,scene.height);
        ctx.strokeStyle=scene.family==="gba"?"#c8efb2":"#d7d7d7";ctx.lineWidth=1;
        for(let y=8;y<scene.height;y+=8){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(scene.width,y+.5);ctx.stroke();}
      }
      const draw=(image,point)=>{if(image&&point)ctx.drawImage(image,point.x,point.y);};
      if(state.visibility!=="hidden"){draw(scene.opponent,scene.anchors.opponent);draw(scene.player,scene.anchors.player);}
      const objects=(state.sprites||[]).filter(value=>value&&typeof value==="object");
      objects.forEach((object,index)=>{
        const image=object.asset?.canvas;if(!image)return;
        const anchor=scene.anchors[object.anchor]||scene.anchors.target;
        const x=object.asset.sceneOverlay?0:anchor.x+(Number(object.x)||0)-image.width/2;
        const y=object.asset.sceneOverlay?0:anchor.y+(Number(object.y)||0)-image.height/2;
        const nativeFrame=object.asset?.nativeFrame,scaleX=Number(nativeFrame?.scaleX)||(nativeFrame?.hFlip?-1:1),scaleY=Number(nativeFrame?.scaleY)||(nativeFrame?.vFlip?-1:1),rotation=Number(nativeFrame?.rotation)||0;
        ctx.save();ctx.globalAlpha=.92;ctx.translate(Math.round(x+image.width/2),Math.round(y+image.height/2));ctx.rotate(rotation);ctx.scale(scaleX,scaleY);
        ctx.drawImage(image,-image.width/2,-image.height/2);ctx.restore();ctx.globalAlpha=1;
      });
      if(!objects.some(object=>object.asset?.canvas)){
        const resource=[...(state.resources||[])].reverse().find(value=>value?.canvas);
        if(resource){
          const point=scene.anchors.target;ctx.globalAlpha=.88;ctx.drawImage(resource.canvas,Math.round(point.x-resource.canvas.width/2),Math.round(point.y-resource.canvas.height/2));ctx.globalAlpha=1;
        }
      }
      if(state.blend){ctx.fillStyle="rgba(255,255,255,.16)";ctx.fillRect(0,0,scene.width,scene.height);}
      ctx.restore();
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
        ["Video",state.background||state.palette||state.blend||state.visibility||"—"]
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
      this.background();
      let image=null,error=null;
      try{image=frame.image||null;}catch(reason){error=reason;}
      if(image)this.image(document,frame,image);else this.program(document,frame);
      const ctx=this.ctx,{width}=this.canvas;ctx.fillStyle=document.accuracy==="verified"?COLORS.green:COLORS.amber;ctx.fillRect(width-8,0,8,8);
      return Object.freeze({native:Boolean(image),error});
    }
  }
  global.AnimationRenderer=AnimationRenderer;
})(globalThis);
