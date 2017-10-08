/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is coded by Lukas Häring García and
    idea is taken from some other hacking programs.
*/
/*module.exports = new Utils; Works with serverside*/
class Utils{
	static pad(_t, _c='0', _s){return(_t.length>=_s?"":_c.repeat(_s-_t.length))+_t};
	static isString(_s){return(Object.prototype.toString.call(_s)==='[object String]')};
	static isObject(_o){return(_o instanceof Object)};
}
