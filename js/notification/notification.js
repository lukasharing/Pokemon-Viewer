(function(global){
  "use strict";
  const NotificationType=Object.freeze({NONE:0,ERROR:1,SUCCESS:2,NOTIFICATION:3});
  const typeName=type=>Object.entries(NotificationType).find(([,value])=>value===type)?.[0]||"NOTIFICATION";

  class AppNotification{
    constructor(title,description,type=NotificationType.NOTIFICATION,{details="",persistent=false}={}){
      this.id=global.crypto?.randomUUID?.()||`notice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      this.title=String(title||"Notification");
      this.description=String(description||"");
      this.details=String(details||"");
      this.type=type;
      this.persistent=Boolean(persistent);
      this.date=new Date();
    }
    getDate(){return this.date;}
    getId(){return this.id;}
    getElement(){
      const time=this.date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
      const detail=this.details?Dom.create("details",{className:"notification-details"},[
        Dom.create("summary",{text:"Technical details"}),
        Dom.create("pre",{text:this.details})
      ]):null;
      const kind=this.type===NotificationType.ERROR?"Error":this.type===NotificationType.SUCCESS?"Success":"Notification";
      return Dom.create("article",{
        className:`notification notification--${typeName(this.type).toLowerCase()}`,
        dataset:{uid:this.id,persistent:String(this.persistent)},
        attributes:{role:this.type===NotificationType.ERROR?"alert":"status","aria-live":this.type===NotificationType.ERROR?"assertive":"polite","aria-atomic":"true","aria-label":`${kind}: ${this.title}`}
      },[
        Dom.create("span",{className:"notification-icon",attributes:{"aria-hidden":"true"}}),
        Dom.create("div",{className:"notification-info"},[
          Dom.create("header",{},[Dom.create("h6",{text:this.title}),Dom.create("time",{text:time,attributes:{datetime:this.date.toISOString()}})]),
          Dom.create("p",{text:this.description}),
          detail
        ].filter(Boolean)),
        Dom.create("button",{className:"notification-close",attributes:{type:"button","aria-label":"Dismiss notification",title:"Dismiss"},text:"×"})
      ]);
    }
  }

  global.NotificationType=NotificationType;
  global.AppNotification=AppNotification;
})(globalThis);
