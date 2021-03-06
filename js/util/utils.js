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

/* Overloading functions. */
HTMLCollection.prototype.forEach = Array.prototype.forEach;
NodeList.prototype.forEach = Array.prototype.forEach;

/* Utils */
document.addEventListener("copy", e=>{ e.preventDefault(); e.clipboardData.setData("text/plain", document.getElementById("clipboard").innerHTML); })
class Utils{
	static pad(_t, _c='0', _s){return(_t.length>=_s?"":_c.repeat(_s-_t.length))+_t};
	static isString(_s){return(Object.prototype.toString.call(_s)==='[object String]')};
	static isObject(_o){return(_o instanceof Object)};
	static map(n, a, b, c, d){ return (n - a) * (d - c) / (b - a) + c; };
	static uid(){return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c ^ crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)); };
	static copyToClipboard(t){ document.getElementById("clipboard").innerHTML = t; document.execCommand("copy"); }
};

// COLOR CLASS
class Color{
  static hue2rgb(p, q, t){
		if(t < 0) t += 1;
		if(t > 1) t -= 1;
		if(t < 1/6) return p + (q - p) * 6 * t;
		if(t < 1/2) return q;
		if(t < 2/3) return p + (q - p) * (0.666 - t) * 6;
		return p;
	};
	static hsl2rgb(h, s, l){
		var color = [l, l, l];
		if(s != 0){
			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			color[0] = this.hue2rgb(p, q, h + 0.333);
			color[1] = this.hue2rgb(p, q, h);
			color[2] = this.hue2rgb(p, q, h - 0.333);
		}
		return color.map(x=>Math.round(x * 255));
	};

  static gba2hex(c){ return((c&0x1F)<<19|(c&0x3e0)<<6|(c&0x7c00)>>7);};
  static hex2gba(c){
    let e = (c&0x0000ff)<<7|(c&0x00ff00)>>6|(c&0xff0000)>>19;
    return((e&0xff)<<8|e>>8);
  };
};

// VECTOR CLASS
class Vector{
  constructor(_x, _y, _z){
    this.x = _x;
    this.y = _y;
    this.z = _z;
  };

  // X COORD
  getX(){ return this.x; };
  setX(_x){ this.x = _x; };
  rotateX(alpha){
    const sn = Math.sin(alpha);
    const cs = Math.cos(alpha);
    const ty = cs * this.y + sn * this.z;
    const tz = cs * this.z - sn * this.y;
    this.y = ty;
    this.z = tz;
  };
  // Y COORD
  getY(){ return this.y; };
  setY(_y){ this.y = _y; };
  rotateY(alpha){
    const sn = Math.sin(alpha);
    const cs = Math.cos(alpha);
    const tx = cs * this.x - sn * this.z;
    const tz = cs * this.z + sn * this.x;
    this.x = tx;
    this.z = tz;
  };
  // Z COORD
  getZ(){ return this.z; };
  setZ(_z){ this.z = _z; };
  rotateZ(alpha){
    const sn = Math.sin(alpha);
    const cs = Math.cos(alpha);
    const tx = cs * this.x + sn * this.y;
    const ty = cs * this.y - sn * this.x;
    this.x = tx;
    this.y = ty;
  };

  // Properties
	pitagoras(){ return (this.x * this.x + this.y * this.y + this.z * this.z); };
  length(){ return Math.sqrt(this.pitagoras()); };

  // Operation
  add(v){ this.x += v.x; this.y += v.y; this.z += v.z; };
  scale(a){ this.x *= a; this.y *= a; this.z *= a; };
  dot(v){ return this.x * v.x + this.y * v.y + this.z * v.z; };
  cross(v){
		const cx = this.y * v.z - this.z * v.y;
		const cy = this.x * v.z - this.z * v.x;
		const cz = this.x * v.y - this.y * v.x;
		return new Vector(cx, cy, cz);
	};
  angle(v){ return Math.acos(this.length() * v.length() / this.dot(v)); };
  normalize(){
		const length = 1.0 / this.length();
		this.x *= length;
		this.y *= length;
		this.z *= length;
	};
};
