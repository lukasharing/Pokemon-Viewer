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
    this.paths = new Array();
  };

  load(paths, callback){
    Promise.all(paths.map(async (e)=>{
      let file = await fetch(e);
      if(file.status == 404){
        throw `Files couldn't be loaded`;
      }
      this.paths.push(paths);
      return file.text();
    })).then(text_promises=>{
      Promise.all(text_promises).then(results=>{
        callback(results.map((e, b)=>{ return {path: paths[b], result: e} }));
      });
    }).catch(e=>{ NotificationHandler.pop("Error", e, NotificationType.ERROR); });
  };

};

const FileHandler = new FHandler();
