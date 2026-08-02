(function(global){
  "use strict";
  class NotificationCenter{
    constructor({duration=6000,maximum=5,historyLimit=100}={}){
      this.duration=duration;this.maximum=maximum;this.historyLimit=historyLimit;this.notifications=[];this.history=[];this.timers=new Map();this.problemsWindow=null;
    }
    get getLastNotification(){return this.notifications.at(-1);}
    get getLastUpdate(){return this.getLastNotification?.getDate();}
    container(){
      const element=document.getElementById("notification-area");
      if(!element)throw new Error("Notification area is not available.");
      element.setAttribute("role","region");element.setAttribute("aria-label","Notifications");element.removeAttribute("aria-live");
      const problems=document.getElementById("notification-problems-button");
      if(problems&&!problems.dataset.bound){problems.dataset.bound="true";problems.addEventListener("click",()=>this.openProblems());}
      return element;
    }
    notify(title,message,{type=NotificationType.NOTIFICATION,details="",persistent=type===NotificationType.ERROR}={}){
      const notice=new AppNotification(title,message,type,{details,persistent}),element=notice.getElement(),container=this.container();
      this.notifications.push(notice);this.history.push(notice);if(this.history.length>this.historyLimit)this.history.splice(0,this.history.length-this.historyLimit);container.prepend(element);
      element.querySelector(".notification-close").addEventListener("click",()=>this.dismiss(notice.id));
      element.addEventListener("pointerenter",()=>this.pause(notice.id));element.addEventListener("pointerleave",()=>{if(!element.contains(document.activeElement))this.resume(notice.id);});
      element.addEventListener("focusin",()=>this.pause(notice.id));element.addEventListener("focusout",event=>{if(!element.contains(event.relatedTarget))this.resume(notice.id);});
      requestAnimationFrame(()=>element.classList.add("visible"));
      while(this.notifications.length>this.maximum)this.dismiss(this.notifications[0].id);
      if(!persistent)this.schedule(notice,this.duration);
      this.syncProblems();
      return notice;
    }
    error(title,error,{persistent=true}={}){
      const value=error instanceof Error?error:new Error(String(error));
      return this.notify(title,value.message,{type:NotificationType.ERROR,details:value.stack||"",persistent});
    }
    success(title,message){return this.notify(title,message,{type:NotificationType.SUCCESS});}
    info(title,message){return this.notify(title,message,{type:NotificationType.NOTIFICATION});}
    pop(title,description,type=NotificationType.NOTIFICATION){
      return type===NotificationType.ERROR?this.error(title,description):this.notify(title,description,{type});
    }
    schedule(notice,delay){
      const remaining=Math.max(0,Number(delay)||0),record={remaining,deadline:Date.now()+remaining,handle:null};
      record.handle=setTimeout(()=>this.dismiss(notice.id),remaining);this.timers.set(notice.id,record);return record;
    }
    pause(id){
      const record=this.timers.get(id);if(!record?.handle)return false;
      clearTimeout(record.handle);record.remaining=Math.max(0,record.deadline-Date.now());record.handle=null;return true;
    }
    resume(id){
      const notice=this.notifications.find(item=>item.id===id),record=this.timers.get(id);if(!notice||notice.persistent||!record||record.handle)return false;
      this.schedule(notice,record.remaining||this.duration);return true;
    }
    dismiss(id){
      const index=this.notifications.findIndex(notice=>notice.id===id);
      if(index<0)return false;
      const [notice]=this.notifications.splice(index,1),timer=this.timers.get(id);
      if(timer?.handle)clearTimeout(timer.handle);this.timers.delete(id);
      const element=document.querySelector(`#notification-area [data-uid="${notice.id}"]`);
      element?.classList.remove("visible");element?.addEventListener("transitionend",()=>element.remove(),{once:true});
      setTimeout(()=>element?.remove(),250);
      return true;
    }
    clear(){for(const notice of [...this.notifications])this.dismiss(notice.id);}
    problems(){return this.history.filter(notice=>notice.type===NotificationType.ERROR);}
    syncProblems(){
      const button=document.getElementById("notification-problems-button"),count=document.getElementById("notification-problems-count"),total=this.problems().length;
      if(button){button.hidden=!total;button.setAttribute("aria-label",`Open problems (${total})`);}if(count)count.textContent=String(total);this.renderProblems();return total;
    }
    openProblems(){
      if(!global.UiWindow||!global.Dom)throw new Error("Problems panel requires the shared UI material.");
      if(!this.problemsWindow){
        const host=Dom.create("section",{className:"notification-problems hide"});document.body.append(host);
        this.problemsWindow=new UiWindow({element:host,title:"Problems",icon:"fa-triangle-exclamation",minimizable:true,maximizable:false,closable:true});
        this.problemsList=Dom.create("div",{className:"notification-problems__list"});
        this.problemsWindow.setContent(this.problemsList).setFooter(UiWindow.button("Clear problems",{icon:"fa-check",onClick:()=>this.clearProblems()}));
      }
      this.renderProblems();this.problemsWindow.show();this.problemsWindow.header.querySelector("button")?.focus();return this.problemsWindow;
    }
    renderProblems(){
      if(!this.problemsList)return;const problems=[...this.problems()].reverse();
      this.problemsList.replaceChildren(...(problems.length?problems.map(notice=>Dom.create("article",{className:"notification-problem"},[
        Dom.create("header",{},[Dom.create("strong",{text:notice.title}),Dom.create("time",{text:notice.date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),attributes:{datetime:notice.date.toISOString()}})]),
        Dom.create("p",{text:notice.description}),notice.details?Dom.create("details",{},[Dom.create("summary",{text:"Technical details"}),Dom.create("pre",{text:notice.details})]):null
      ].filter(Boolean))):[Dom.create("p",{className:"notification-problems__empty",text:"No recorded problems."})]));
    }
    clearProblems(){
      for(const notice of [...this.notifications])if(notice.type===NotificationType.ERROR)this.dismiss(notice.id);
      this.history=this.history.filter(notice=>notice.type!==NotificationType.ERROR);this.syncProblems();
    }
  }
  global.NotificationCenter=NotificationCenter;
  global.NotificationHandler=new NotificationCenter();
})(globalThis);
