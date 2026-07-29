(function(global){
  "use strict";
  class NotificationCenter{
    constructor({duration=6000,maximum=5}={}){
      this.duration=duration;this.maximum=maximum;this.notifications=[];this.timers=new Map();
    }
    get getLastNotification(){return this.notifications.at(-1);}
    get getLastUpdate(){return this.getLastNotification?.getDate();}
    container(){
      const element=document.getElementById("notification-area");
      if(!element)throw new Error("Notification area is not available.");
      element.setAttribute("aria-live","polite");element.setAttribute("aria-relevant","additions");
      return element;
    }
    notify(title,message,{type=NotificationType.NOTIFICATION,details="",persistent=type===NotificationType.ERROR}={}){
      const notice=new AppNotification(title,message,type,{details}),element=notice.getElement(),container=this.container();
      this.notifications.push(notice);container.prepend(element);
      element.querySelector(".notification-close").addEventListener("click",()=>this.dismiss(notice.id));
      requestAnimationFrame(()=>element.classList.add("visible"));
      while(this.notifications.length>this.maximum)this.dismiss(this.notifications[0].id);
      if(!persistent)this.timers.set(notice.id,setTimeout(()=>this.dismiss(notice.id),this.duration));
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
    dismiss(id){
      const index=this.notifications.findIndex(notice=>notice.id===id);
      if(index<0)return false;
      const [notice]=this.notifications.splice(index,1),timer=this.timers.get(id);
      if(timer)clearTimeout(timer);this.timers.delete(id);
      const element=document.querySelector(`#notification-area [data-uid="${notice.id}"]`);
      element?.classList.remove("visible");element?.addEventListener("transitionend",()=>element.remove(),{once:true});
      setTimeout(()=>element?.remove(),250);
      return true;
    }
    clear(){for(const notice of [...this.notifications])this.dismiss(notice.id);}
  }
  global.NotificationCenter=NotificationCenter;
  global.NotificationHandler=new NotificationCenter();
})(globalThis);
