class Tileset{
  constructor(_o = 0x000000, _m = null, _i = null, _c = false){
    this.offset = _o;
    this.memory = _m;
    this.image  = _i;
    this.compressed = _c;
  };

  /*
    Getter / Setter
  */
  setOffset(_o){  this.offset = _o; };
  setMemory(_m){ this.memory = _m; };
  setImage(_i){ this.image = _i; };

  getOffset(_o){ return this.offset; };
  getMemory(_m){ return this.memory; };
  getImage(_i){ return this.image; };

}
