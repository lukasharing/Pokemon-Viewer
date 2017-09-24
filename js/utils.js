class Utils{
	static pad(_t, _c='0', _s){return(_t.length>=_s?_t:(new Array(_s-_t.length+1).join(_c)+_t))};
	static isString(_s){return(Object.prototype.toString.call(_s)==='[object String]')};
}
