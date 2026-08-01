(function(global){
  "use strict";
  class UiLoading{
    static create(label="Loading…",{compact=false}={}){
      return Dom.create("span",{
        className:`ui-loading${compact?" ui-loading--compact":""}`,
        attributes:{role:"status","aria-live":"polite"}
      },[
        Dom.create("span",{className:"ui-loading__spinner",attributes:{"aria-hidden":"true"}}),
        Dom.create("span",{className:"ui-loading__label",text:label})
      ]);
    }
  }
  global.UiLoading=UiLoading;
  (((global.PokemonViewer||={}).ui||={}).Loading)=UiLoading;
})(globalThis);
