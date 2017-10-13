class Map{
  constructor(){
    // Map title
    this.name           = "";
    this.namePointer    = 0x00000000;
    this.name_effect    = 0x00;
    //header: header,
    this.script         = 0x00000000;

    // Structure
    this.structurePointer = 0x00000000;
    this.connectionPointer= 0x00000000;
    this.connection       = [];
    this.entitiesPointers = [];
    this.entities         = [[/* Overworld */], [/* Warps */], [/* Scripts */], [/* Signposts */]];
    //this.border         = 0x00000000;
    //border_width: self.getByte(map + 24), // (??)
    //border_height: self.getByte(map + 25), // (??)
    this.structure        = [];

    // Palette
    this.palettePointer = 0x00000000;
    this.paletteIndex   = 0;
    // Tilesets
    this.tilesetPointer = 0x00000000;
    this.tilesetIndex   = 0;
    // Blocks
    this.blocksPointer  = 0x00000000;
    this.blocksIndex    = 0;

    // Properties
    this.music          = 0x0000;
    this.weather        = 0x00;
    this.type           = 0x00; // FightType or MapType
    //title: self.getByte(header + 26), // (??)
    this.pokemonPointer  = 0x00000000;
    this.pokemon        = [[], [], [], []];

    // Images
    this.preview;
    this.height_map;
  };

  /*
    Getter / Setter
  */
  getMapWidth() { return this.structure[0].length; };
  getMapHeight(){ return this.structure.length; };
  getMapName(){ return this.name; };
  getMapPointer(){ return this.name_pointer; };
  getStructurePointer(){ return this.script; };
  getScriptPointer(){ return this.script; };
  getConnection(_c){ return this.connection[_c]; };
  getEntityPointer(_t){ return this.entitiesPointers[_t]; };
  getEntityCollection(_t){ return this.entities[_t]; };
  getEntity(_t, _i){ return this.entities[_t][_i]; };
  getPalettePointer(){ return this.palettePointer; };
  getPaletteIndex(){ return this.paletteIndex; };
  getTilesetPointer(){ return this.tilesetPointer; };
  getTilesetIndex(){ return this.tilesetIndex; };
  getBlocksPointer(){ return this.blocksPointer; };
  getBlocksIndex(){ return this.blocksIndex; };
  getMusic(){ return this.music; };
  getWeather(){ return this.weather; };
  getPokemonPointer(){ return this.pokemonPointer; };
  getPokemonCollection(_t){ return this.pokemon[_t]; };
  getPokemon(_t, _i){ return this.pokemon[_t][_i]; };

  setMapName(_n){ this.name = _n; };
  setMapPointer(_p){ this.name_pointer = _p; };
  setStructurePointer(_p){ this.script = _p; };
  setScriptPointer(_p){ this.script = _p; };
  setConnection(_n, _c){ this.connection[_n] = _c; };
  setEntityPointer(_t, _p){ this.entitiesPointers[_t] = _p; };
  setEntity(_t, _i, _e){ this.entities[_t][_i] = _e; };
  setPalettePointer(_o){ this.palettePointer = _o; };
  setPaletteIndex(_i){ this.paletteIndex = _i; };
  setTilesetPointer(_o){ this.tilesetPointer = _o; };
  setTilesetIndex(_i){ this.tilesetIndex = _i; };
  setBlocksPointer(_o){ this.blocksPointer = _o; };
  setBlocksIndex(_i){ this.blocksIndex = _i; };
  setMusic(_i){ this.music = _i; };
  setWeather(_i){ this.weather = _i; };
  setPokemonPointer(_o){ this.pokemonPointer = _o; };
  setPokemon(_t, _i, _p){ this.pokemon[_t][_i] = _p; };

  /*
    Getter / Setter Structure
  */
  getBlockIndex(_x, _y){ return this.structure[_y][_x]&0x3ff; };
  getBlockHeight(_x, _y){ return this.structure[_y][_x]>>10; };
  getBlock(_x, _y){ return this.structure[_y][_x]; };
  setBlockIndex(_x, _y, _b){ this.structure[_y][_x] = (this.structure[_y][_x] & 0x3ff | _b); };
  setBlockHeight(_x, _y, _h){ return (this.structure[_y][_x] & 0xfc00 | (_h << 10)); };
  setBlock(_x, _y, _b){ this.structure[_y][_x] = _b; };

  /*
    Main Methods
  */
  resize(_w, _h){
    let h = this.getMapHeight();
    let w = this.getMapWidth();
    let dw = _w - w;
    let dh = _h - h;
    if(dw < 0){
      for(let j = 0; j < h; j++){
        this.structure[j].length = _w;
      }
    }else if(dw > 0){
      for(let j = 0; j < h){
        for(let i = w + 1; i <= _w; i++){
          this.structure[j][i] = 0x0000;
        }
      }
    }

    if(dh < 0){
      this.structure = _h;
    }else if(dh > 0){
      for(let j = h + 1; j <= _h; j++){
        this.structure[j] = new Array().fill(0x0000);
      }
    }
  };
};

class Connection {
  constructor(_d = 0x000000, _o = 0x00000000, _b = 0x00, _m = 0x00){
    this.direction  = _d;
    this.offset     = _o;
    this.bank       = _b;
    this.map        = _m;
  };
  /*
    Getter / Setter
  */
  getDirection(){ return this.direction; };
  getOffset(){ return this.offset;  };
  getBankIndex(){ return this.bank; };
  getMapIndex(){ return this.map; };
  setDirection(_d){ this.direction = _d; };
  setOffset(_o){ this.offset = _o; };
  setBankIndex(_b){ this.bank = _b; };
  setMapIndex(_m){ this.map = _m; };
};
