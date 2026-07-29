(function(global){
  "use strict";

  const scripts = new Map();
  const styles = new Map();
  const keyFor = src => String(src);

  const loadScript = (src) => {
    const key=keyFor(src);
    if(scripts.has(key)) return scripts.get(key);

    const pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => resolve(src), {once: true});
      script.addEventListener("error", () => {
        if(scripts.get(key)===pending)scripts.delete(key);
        script.remove();
        reject(new Error(`Could not load ${src}.`));
      }, {once: true});
      document.head.append(script);
    });
    scripts.set(key, pending);
    return pending;
  };
  const loadStyle = (href) => {
    const key=keyFor(href);
    if(styles.has(key))return styles.get(key);
    const pending=new Promise((resolve,reject)=>{
      const link=document.createElement("link");
      link.rel="stylesheet";link.href=href;
      link.addEventListener("load",()=>resolve(href),{once:true});
      link.addEventListener("error",()=>{if(styles.get(key)===pending)styles.delete(key);link.remove();reject(new Error(`Could not load ${href}.`));},{once:true});
      document.head.append(link);
    });
    styles.set(key,pending);return pending;
  };

  global.AssetLoader = Object.freeze({
    loadScript,
    async loadScripts(paths){
      for(const path of paths) await loadScript(path);
    },
    loadStyle,
    async loadStyles(paths){
      for(const path of paths)await loadStyle(path);
    },
    hasScript(path){
      return scripts.has(keyFor(path));
    }
  });
})(globalThis);
