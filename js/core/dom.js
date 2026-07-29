(function(global){
  "use strict";

  class Dom {
    static byId(id){
      return document.getElementById(id);
    }

    static create(tag, options = {}, children = []){
      const element = document.createElement(tag);
      const {
        className,
        classes = [],
        attributes = {},
        dataset = {},
        events = {},
        text,
        html
      } = options;

      if(className) element.className = className;
      if(classes.length) element.classList.add(...classes.filter(Boolean));
      for(const [name, value] of Object.entries(attributes)){
        if(value !== undefined && value !== null) element.setAttribute(name, String(value));
      }
      Object.assign(element.dataset, dataset);
      for(const [event, handler] of Object.entries(events)) element.addEventListener(event, handler);
      if(text !== undefined) element.textContent = text;
      if(html !== undefined) element.innerHTML = html;
      element.append(...(Array.isArray(children) ? children : [children]).filter(Boolean));
      return element;
    }

    static fragment(children = []){
      const fragment = document.createDocumentFragment();
      fragment.append(...children.filter(Boolean));
      return fragment;
    }

    static setVisible(element, visible){
      element.classList.toggle("hide", !visible);
      return element;
    }
  }

  global.Dom = Dom;
})(globalThis);
