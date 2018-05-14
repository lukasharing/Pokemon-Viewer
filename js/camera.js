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
const CAMERA_FRICTION = 0.94;

// Zoom CONSTANTS
const MIN_ZOOM = 4;
const MAX_ZOOM = 0.16;

class Camera{
  constructor(x = 0, y = 0, width = 1, height = 1, zoom = 1){
    /* Camera Main Variables */
    this.properties = {};

    /* Zoom properties */
    this._zoom = zoom;

    /* Camera Sizes */
    this._width  = width;
    this._height = height;


    /* Camera Coordinates */
    this._x = x;
    this._y = y;

    /* Camera Velocity */
    this.vx = 0;
    this.vy = 0;
  };

  /* get/set method */
  get zoom(){ return this._zoom; };
  set zoom(a){ this._zoom = a; };

  /* Main Methods */
  restore(){
    this._zoom = 1;
    this._x = this._y = this.vx = this.vy = 0;
    this.properties = {};
  };

  update(self){
    if(this.vx * this.vx + this.vy * this.vy > 1){
  	  this.vx *= CAMERA_FRICTION;
  	  this.vy *= CAMERA_FRICTION;
      this._x += this.vx;
      this._y += this.vy;
      self.is_camera_moving = true;
    }
  };

  /* Coordinates Methods */
  // X Coordinate
  get x() { return this._x; };
  set x(a){ this._x = a; };
  addX(a){ this._x += a; };
  mapX(mx){
    let abs = Math.abs(this._x);
    if(abs > mx){
      this.vx = 0;
    }
    this._x  -= Math.floor(abs / this._x) * (abs - mx);
  };
  // Y Coordinate
  get y() { return this._y; };
  set y(a){ this._y = a; };
  addY(a){ this._y += a; };
  mapY(my){
    let abs = Math.abs(this._y);
    if(abs > my){
      this.vy = 0;
      this._y  -= Math.floor(abs / this._y) * (abs - my);
    }
  };
  add(a, b){ this._x += a; this._y += b; };

  // X/Y Coordinates
  set(a,b){ this._x = a; this._y = b; };

  /* Sizes Methods */
  get width() { return this._width; };
  set width(b){ this._width = b; };

  get height(){ return this._height; };
  set height(b){ this._height = b; };
  resize(w, h){
    this._width  = w;
    this._height = h;
  };
  fitIn(e){
    let element = $(e)[0];
    this._width  = element.width = $(window).width() - 495;
    this._height = element.height = $(window).height();
  };

  /* Zoom Methods */
  alterZoom(z, x, y){
    if(this._zoom * z < MIN_ZOOM && this._zoom * z >  MAX_ZOOM){
      this._zoom *= z;
      this._x = x - (x - this.x) * z;
      this._y = y - (y - this.y) * z;
    }
  };
}
