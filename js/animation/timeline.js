(function(global){
  "use strict";

  class AnimationTimeline {
    constructor({scrubber,list,onFrame,onState}){
      this.scrubber=scrubber;
      this.list=list;
      this.onFrame=onFrame;
      this.onState=onState;
      this.frames=[];
      this.index=0;
      this.timer=null;
      this.scope=new EventScope();
      this.scope.listen(scrubber,"input",()=>this.go(Number(scrubber.value)||0));
      this.scope.listen(list,"click",event=>{
        const item=event.target.closest("[data-command]");if(!item)return;
        const command=Number(item.dataset.command),frame=this.frames.findIndex(value=>value.command===command);
        if(frame>=0)this.go(frame);
      });
    }

    set(document){
      this.document=document;
      this.frames=document.frames.length?document.frames:[{label:"Static preview",command:null}];
      this.index=0;
      this.scrubber.max=String(Math.max(0,this.frames.length-1));
      this.list.replaceChildren(...document.commands.map((command,index)=>Dom.create("li",{dataset:{command:index}},[
        Dom.create("button",{className:"animation-command",attributes:{type:"button"},properties:{title:command.source||command.label||""}},[
          Dom.create("strong",{text:command.label||`Command ${index}`}),Dom.create("code",{text:command.source||""})
        ])
      ])));
      this.go(0);
      this.onState?.({playing:false,canPlay:this.frames.length>1});
    }

    go(index){
      this.index=Math.max(0,Math.min(this.frames.length-1,index));
      this.scrubber.value=String(this.index);
      this.list.querySelectorAll("li").forEach((item,itemIndex)=>item.classList.toggle("is-active",itemIndex===this.frames[this.index]?.command));
      this.onFrame?.(this.frames[this.index],this.index);
    }

    step(delta){this.go(this.index+delta);}
    rate(){
      const value=Number(this.document?.fps);
      return Number.isFinite(value)&&value>0?value:null;
    }
    play(){
      const rate=this.rate();
      if(this.timer||this.frames.length<2||rate===null){
        this.onState?.({playing:false,canPlay:false});
        return;
      }
      this.onState?.({playing:true,canPlay:true});
      const advance=()=>{
        this.go((this.index+1)%this.frames.length);
        this.timer=setTimeout(advance,Math.max(1,Number(this.frames[this.index]?.duration)||1)*1000/rate);
      };
      this.timer=setTimeout(advance,Math.max(1,Number(this.frames[this.index]?.duration)||1)*1000/rate);
    }
    pause(){clearTimeout(this.timer);this.timer=null;this.onState?.({playing:false,canPlay:this.frames.length>1});}
    destroy(){this.pause();this.scope.destroy();}
  }

  global.AnimationTimeline=AnimationTimeline;
})(globalThis);
