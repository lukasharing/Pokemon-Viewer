function Camera(x, y, width, height){
  this.x = x || 0;
  this.getX = function(){ return this.x; };
  this.mapX = function(mx){
    if(Math.abs(this.x) > mx){
      this.vx = 0;
      this.x  -= ((Math.abs(this.x)/this.x)|0) * (Math.abs(this.x) - mx);
    }
  };
  this.y = y || 0;
  this.getY = function(){ return this.y; };
  this.mapY = function(my){
    if(Math.abs(this.y) > my){
      this.vy = 0;
      this.y  -= ((Math.abs(this.y)/this.y)|0) * (Math.abs(this.y) - my);
    }
  };

  this.vx = 0;
  this.vy = 0;
  this.restore = function(){
    this.x = this.y = this.vx = this.vy = 0;
    this.properties = {};
    this.zoom   = 1;
  };

  this.friction = 0.89;
  this.setFriction = function(f){ this.friction = f; };
  this.width = width || 1;
  this.getWidth = function(){ return this.width; };
  this.height = height || 1;
  this.getHeight = function(){ return this.height; };
  this.resize = function(w, h){
    this.width  = w;
    this.height = h;
  };
  this.zoom   = 1;
  this.zoomIn = function(z){ this.zoom = Math.max(1, this.zoom - z); };
  this.zoomOut = function(z){ this.zoom = Math.min(8, this.zoom + z); };
  this.properties = {};

  this.update = function(){
    if(Math.pow(this.vx, 2) + Math.pow(this.vy, 2) > 1){
      this.x += this.vx *= this.friction;
      this.y += this.vy *= this.friction;
    }
  };
}
