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
class Entity{
  constructor(_x, _y, _z, _i){
    this.x        = _x;
    this.y        = _y;
    this.z        = _z;
    this.index    = _i;
  };
  /*
    Getter / Setter
  */
  getX(){ return this.x; };
  getY(){ return this.y; };
  getZ(){ return this.z; };
  getIndex(){ return this.index; }
  setX(_x){ this.x = _z; };
  setY(_y){ this.y = _y; };
  setZ(_z){ this.z = _z; };
  set(_x, _y){ this.x = _x; this.y = _y; };
  setIndex(_i){ this.index = _i; }
};

class Overworld extends Entity{
  constructor(x, y, z, i){
    super(x, y, z, i);
    this.sprite           = 0x00;
    this.movement_type    = 0x00;
    this.movement_radius  = 0x00;
    this.trainer          = false;
    this.range_vision     = 0x00;
    this.script           = 0x00000000;
    this.status           = 0x0000;
  };

  /*
    Getter / Setter
  */
  getSpriteIndex(){ return this.sprite; };
  getMovement(){ return this.movement_type; };
  getMovementRadius(){ return this.movement_radius; };
  getTrainer(){ return this.trainer; };
  getRangeVision(){ return this.trainer ? this.range_vision : 0; };
  getScriptOffset(){ return this.script; };
  getStatus(){ return this.status; };

  setSpriteIndex(_i){ this.sprite = _i; };
  setMovement(_m){ this.movement_type = _m; };
  setMovementRadius(_r){ this.movement_radius = _r; };
  setTrainer(_t){ this.trainer = _t; };
  setRangeVision(_r){ if(this.trainer) this.range_vision = _r; };
  setScriptOffset(_s){ this.script = _s; };
  setStatus(_s){ this.status = _s; };

  hasScript(){ return true; };
};

class Warp extends Entity{
  constructor(x, y, z, i){
    super(x, y, z, i);
    this.bank = 0x00;
    this.map  = 0x00;
    this.warp = 0x00;
  };
  /*
    Getter / Setter
  */
  getBankIndex(){ return this.bank; };
  getWarpIndex(){ return this.warp; };
  getMapIndex(){ return this.map; };

  setBankIndex(_b){ this.bank = _b; };
  setWarpIndex(_w){ this.warp = _w; };
  setMapIndex(_m){ this.map = _m; };

  hasScript(){ return false; };
};

class Script extends Entity{
  constructor(x, y, z, i){
    super(x, y, z, i);
    this.number = 0x0000;
    this.value  = 0x00;
    this.script = 0x00000000;
  };
  /*
    Getter / Setter
  */
  getNumber(){ return this.number; };
  getValue(){ return this.value; };
  getScriptOffset(){ return this.script; };

  setNumber(_n){ this.number = _n; };
  setValue(_v){ this.value = _v; };
  setScriptOffset(_s){ this.script = _s; };

  hasScript(){ return true; };
};

class Signpost extends Entity{
  constructor(x, y, z, i){
    super(x, y, z, i);
    this.type = 0x0000,
    this.special = 0x000000;
  };
  /*
    Getter / Setter
  */
  getType(){ return this.type; };
  getSpecial(){ return this.special; };
  getScriptOffset(){ return this.special; };

  setType(_v){ this.type = _v; };
  setSpecial(_v){ this.special = _v; };

  hasScript(){ return this.type < 0x5; };
};
