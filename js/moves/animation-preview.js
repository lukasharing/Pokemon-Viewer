(function(global){
  "use strict";

  class MoveAnimationPreview{
    constructor({reader,driverId,canvas,scrubber,list,current,accuracy,onState}){
      this.driverId=driverId;
      this.driver=PokemonViewer.animation.registry.create(driverId,{reader});
      this.renderer=new AnimationRenderer(canvas);
      this.current=current;this.accuracy=accuracy;
      this.timeline=new AnimationTimeline({
        scrubber,list,
        onFrame:(frame,index)=>{
          this.renderer.render(this.document,frame);
          const command=this.document?.commands?.[frame?.command];
          this.current.textContent=command?.source||frame?.label||"Static frame";
          this.current.dataset.frame=String(index+1);
        },onState
      });
    }
    documentFor(move){
      return this.driverId==="gba"?this.driver.document(move.id):this.driver.document(move);
    }
    set(move){
      this.pause();
      const document=this.documentFor(move);
      if(!document)throw new Error(`${move.name} has no verified native animation document.`);
      this.document=document;this.timeline.set(document);
      this.accuracy.textContent=document.accuracy==="verified"?"Exact preview":"Partial preview";
      this.accuracy.title=document.accuracyDetail||"Preview accuracy reported by the game-family decoder.";
      this.accuracy.dataset.accuracy=document.accuracy;
      return document;
    }
    play(){this.timeline.play();}
    pause(){this.timeline.pause();}
    restart(){this.timeline.pause();this.timeline.go(0);}
    step(delta){this.timeline.step(delta);}
    destroy(){this.timeline.destroy();}
  }

  global.MoveAnimationPreview=MoveAnimationPreview;
})(globalThis);
