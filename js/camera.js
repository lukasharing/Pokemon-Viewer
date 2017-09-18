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

class Camera{
  constructor(x, y, width, height){
    /* Camera Main Variables */
    this.properties = {};

    this.zoom = 1;

    /* Camera Sizes */
    this.width  = width || 1;
    this.height = height || 1;


    /* Camera Coordinates */
    this.x = x || 0;
    this.y = y || 0;

    /* Camera Velocity */
    this.vx = 0;
    this.vy = 0;

    /* Constants */
    this.friction = 0.89;

  };

  getZoom(){ return this.zoom; };
  setZoom(a){ this.zoom = a; };

  /* Main Methods */
  restore(){
    this.setZoom(1);
    this.x = this.y = this.vx = this.vy = 0;
    this.properties = {};
  };

  update(){
    if(Math.pow(this.vx, 2) + Math.pow(this.vy, 2) > 1){
  	  this.vx *= this.friction;
  	  this.vy *= this.friction;
      this.x += this.vx;
      this.y += this.vy;
    }
  };

  /* Coordinates Methods */
  getX() { return this.x; };
  addX(a){ this.x += a; };
  mapX(mx){
    if(Math.abs(this.x) > mx){
      this.vx = 0;
      this.x  -= ((Math.abs(this.x)/this.x)|0) * (Math.abs(this.x) - mx);
    }
  };
  getY() { return this.y; };
  addY(a){ this.y += a; };
  mapY(my){
    if(Math.abs(this.y) > my){
      this.vy = 0;
      this.y  -= ((Math.abs(this.y)/this.y)|0) * (Math.abs(this.y) - my);
    }
  };
  add(a, b){ this.x += a; this.y += b; };
  set(a, b){ this.x = a; this.y = b; };

  /* Sizes Methods */
  getWidth()  { return this.width; };
  getHeight() { return this.height; };
  resize(w, h){
    this.width  = w;
    this.height = h;
  };

  /* Zoom Methods */
  alterZoom(z, x, y) {
    if(this.zoom * z < 4 && this.zoom * z >  0.16){
      this.zoom *= z;
      this.x = x - (x - this.x) * z;
      this.y = y - (y - this.y) * z;
    }
  };
}
