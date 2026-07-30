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
    program(document,frame){
      const ctx=this.ctx,{width,height}=this.canvas,command=document.commands?.[frame.command],state=frame.state||{};
      ctx.fillStyle="rgba(255,255,255,.94)";ctx.fillRect(7,7,width-14,height-14);ctx.strokeStyle=COLORS.line;ctx.strokeRect(7.5,7.5,width-15,height-15);
      ctx.fillStyle=COLORS.ink;ctx.font="bold 10px system-ui";ctx.fillText(this.fitText(document.name,width-28),14,22);
      ctx.fillStyle=COLORS.primary;ctx.font="bold 9px ui-monospace, monospace";ctx.fillText(this.fitText(command?.label||"Native program",width-28),14,36);
      ctx.fillStyle=COLORS.muted;ctx.font="8px ui-monospace, monospace";ctx.fillText(this.fitText(command?.source||state.note||"",width-28),14,48);
      const rows=[
        ["Graphics",(state.resources||[]).at(-1)||"—"],
        ["Objects",(state.sprites||[]).at(-1)||"—"],
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
