(function(global){
  "use strict";
  class AnimationRenderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");}
    render(document,frame={}){
      const ctx=this.ctx,{width,height}=this.canvas;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,width,height);
      ctx.fillStyle="#f7fafc";ctx.fillRect(0,0,width,height);
      ctx.strokeStyle="#d3e0ec";
      for(let x=0;x<width;x+=8){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,height);ctx.stroke();}
      for(let y=0;y<height;y+=8){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(width,y+.5);ctx.stroke();}
      if(frame.image){
        const scale=Math.max(1,Math.floor(Math.min((width-32)/frame.image.width,(height-42)/frame.image.height)));
        const drawWidth=frame.image.width*scale,drawHeight=frame.image.height*scale,x=Math.round((width-drawWidth)/2),y=Math.round((height-drawHeight)/2);
        ctx.save();ctx.translate(frame.hFlip?width:0,frame.vFlip?height:0);ctx.scale(frame.hFlip?-1:1,frame.vFlip?-1:1);
        ctx.drawImage(frame.image,x,y,drawWidth,drawHeight);ctx.restore();
      }else{
        ctx.fillStyle="#24313d";ctx.font="bold 10px monospace";ctx.fillText(document.name,8,16);
        const command=document.commands?.[frame.command];ctx.font="10px monospace";ctx.fillStyle="#31526d";
        ctx.fillText(command?.source||"No decoded visual command",8,38);
      }
      ctx.fillStyle="#64748b";ctx.font="10px monospace";ctx.fillText(`${document.accuracy} · ${frame.duration||1} tick${frame.duration===1?"":"s"}`,8,height-9);
    }
  }
  global.AnimationRenderer=AnimationRenderer;
})(globalThis);
