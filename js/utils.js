/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is written by Lukas Häring.
*/
class Utils{
	static pad(_t, _c='0', _s){return(_t.length>=_s?"":_c.repeat(_s-_t.length))+_t};
	static isString(_s){return(Object.prototype.toString.call(_s)==='[object String]')};
	static isObject(_o){return(_o instanceof Object)};
	static map(n, a, b, c, d){ return (n - a) * (d - c) / (b - a) + c; };
}

class Color{
  static hue2rgb(p, q, t){
		if(t < 0) t += 1;
		if(t > 1) t -= 1;
		if(t < 1/6) return p + (q - p) * 6 * t;
		if(t < 1/2) return q;
		if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
		return p;
	};
	static hsl2rgb(h, s, l){
		var color = [l, l, l];
		if(s != 0){
			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			color[0] = this.hue2rgb(p, q, h + 1/3);
			color[1] = this.hue2rgb(p, q, h);
			color[2] = this.hue2rgb(p, q, h - 1/3);
		}
		return color.map((x)=>Math.round(x * 255));
	};

  static gba2hex(c){ return((c&0x1F)<<19|(c&0x3e0)<<6|(c&0x7c00)>>7);};
  static hex2gba(c){
    let e = (c&0x0000ff)<<7|(c&0x00ff00)>>6|(c&0xff0000)>>19;
    return((e&0xff)<<8|e>>8);
  };
};
