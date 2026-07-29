/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is coded by Lukas Häring García and the
    idea is taken from some other hacking programs.
*/
class FHandler{
  constructor(){
    this.paths = [];
  };

  async load(paths, callback){
    if(!Array.isArray(paths))throw new TypeError("FileHandler.load expects an array of paths.");
    const results=await Promise.all(paths.map(async path=>{
      const response=await fetch(path,{cache:"no-store"});
      if(!response.ok)throw new Error(`Could not load ${path} (${response.status}).`);
      if(!this.paths.includes(path))this.paths.push(path);
      return{path,result:await response.text()};
    }));
    callback?.(results);
    return results;
  };

};

const FileHandler = new FHandler();
