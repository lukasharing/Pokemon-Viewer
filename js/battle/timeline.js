(function(global){
  "use strict";
  class BattleTimeline {
    constructor({scrubber,list,onFrame}){this.scrubber=scrubber;this.list=list;this.onFrame=onFrame;this.frames=[];this.index=0;this.timer=null;this.scope=new EventScope();this.bind();}
    bind(){this.scope.listen(this.scrubber,"input",()=>this.go(Number(this.scrubber.value)||0));}
    set(animation){
      this.animation=animation;this.frames=animation.frames?.length?animation.frames:[{label:"Static preview",command:null}];this.index=0;
      this.scrubber.max=String(Math.max(0,this.frames.length-1));this.scrubber.value="0";
      this.list.replaceChildren(...(animation.commands||[]).map((command,index)=>Dom.create("li",{dataset:{command:index}},[
        Dom.create("strong",{text:command.label||command.name||`Command ${index}`}),
        Dom.create("code",{text:command.source||command.bytes||""})
      ])));
      this.go(0);
    }
    go(index){this.index=Math.max(0,Math.min(this.frames.length-1,index));this.scrubber.value=String(this.index);this.highlight();this.onFrame?.(this.frames[this.index],this.index);}
    step(delta){this.go(this.index+delta);}
    play(){if(this.timer||this.frames.length<2)return;this.timer=setInterval(()=>this.go((this.index+1)%this.frames.length),160);}
    pause(){clearInterval(this.timer);this.timer=null;}
    highlight(){this.list.querySelectorAll("li").forEach((item,index)=>item.classList.toggle("is-active",index===this.frames[this.index]?.command));}
    destroy(){this.pause();this.scope.destroy();}
  }
  global.BattleTimeline=BattleTimeline;
})(globalThis);
