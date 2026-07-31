(function(global){
  "use strict";
  class UiResourceCard{
    static action({label,icon="fa-arrow-up-right-from-square",attributes={},className="",disabled=false}={}){
      if(!label)throw new TypeError("UiResourceCard actions require an accessible label.");
      return Dom.create("button",{
        className:`ui-icon-button ui-icon-button--small ui-resource-card__action ${className}`.trim(),
        attributes:{type:"button",title:label,"aria-label":label,...attributes,disabled:disabled?"":null}
      },[UiWindow.icon(icon)]);
    }
    static create({preview=null,eyebrow="",title,description="",actions=[],className="",current=false}={}){
      if(!title)throw new TypeError("UiResourceCard requires a title.");
      const visual=Dom.create("div",{className:"ui-resource-card__preview"},[
        preview||UiWindow.icon("fa-cube")
      ]);
      const content=Dom.create("div",{className:"ui-resource-card__content"},[
        eyebrow?Dom.create("small",{text:eyebrow}):null,
        Dom.create("strong",{text:title}),
        description?Dom.create("span",{text:description}):null
      ].filter(Boolean));
      const controls=Dom.create("div",{className:"ui-resource-card__actions"},
        actions.map(action=>action?.nodeType===1?action:this.action(action)));
      return Dom.create("article",{
        className:`ui-resource-card ${current?"is-current":""} ${className}`.trim()
      },[visual,content,controls]);
    }
  }
  global.UiResourceCard=UiResourceCard;
})(globalThis);
