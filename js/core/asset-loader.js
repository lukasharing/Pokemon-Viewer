(function(global){
  "use strict";

  const scripts = new Map();
  const modules = new Map();
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
  const loadModule = (src) => {
    const key=keyFor(src);
    if(modules.has(key)) return modules.get(key);

    const pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = src;
      script.addEventListener("load", () => resolve(src), {once: true});
      script.addEventListener("error", () => {
        if(modules.get(key)===pending)modules.delete(key);
        script.remove();
        reject(new Error(`Could not load module ${src}.`));
      }, {once: true});
      document.head.append(script);
    });
    modules.set(key, pending);
    return pending;
  };
  const hasDagre = () => Boolean(
    global.dagre &&
    typeof global.dagre.layout === "function" &&
    typeof global.dagre.graphlib?.Graph === "function"
  );
  const loadDagre = async () => {
    if(!hasDagre()){
      await loadModule("js/core/dagre-runtime.mjs?v=1");
    }
    if(!hasDagre()){
      throw new Error("Dagre loaded without a compatible graph layout API.");
    }
    return global.dagre;
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
    loadModule,
    loadDagre,
    async loadScripts(paths){
      // Dynamic scripts with `async = false` execute in insertion order, while
      // starting every request here lets the browser download independent
      // modules concurrently.  Awaiting each request before creating the next
      // one turned every lazy workspace into a network waterfall.
      await Promise.all(Array.from(paths||[],path=>loadScript(path)));
    },
    loadStyle,
    async loadStyles(paths){
      for(const path of paths)await loadStyle(path);
    },
    hasScript(path){
      return scripts.has(keyFor(path));
    },
    hasModule(path){
      return modules.has(keyFor(path));
    }
  });
})(globalThis);
