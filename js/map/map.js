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
class Map{
  constructor(header_pointer, map_pointer){
    // Header Offset
    this.headerOffset  = header_pointer;
    this.music          = 0x0000;
    this.weather        = 0x00;
    this.type           = 0x00; // FightType or MapType
    this.script         = 0x00000000;
    this.pokemonOffset  = 0x00000000;
    this.pokemon        = [[], [], [], []];
    //title: self.getByte(header + 26), // (??)

    // Map title
    this.name       = "";
    this.nameOffset = 0x00000000;
    this.name_effect= 0x00;
    //header: header,

    // Structure
    this.mapOffset       = map_pointer;
    this.structureOffset = 0x00000000;
    this.connectionOffset= 0x00000000;
    this.connection      = [];
    this.entitiesOffsets = [];
    this.entities        = [[/* Overworld */], [/* Warps */], [/* Scripts */], [/* Signposts */]];
    this.borderOffset    = 0x00000000;
    //border_width: self.getByte(map + 24), // (??)
    //border_height: self.getByte(map + 25), // (??)
    this.structure        = [];

    // Palette
    this.palettesIndex   = new Array(2);
    // Tilesets
    this.tilesetsIndex   = new Array(2);
    // Blocks
    this.blocksIndex     = new Array(2);

    // Images
    this.preview;
    this.preview_ctx;
    this.height_map;
  };

  /*
    Getter / Setter
  */
  getMapOffset(){ return this.mapOffset; };
  getHeaderOffset(){ return this.headerOffset; };
  getWidth() { return this.structure[0].length; };
  getHeight(){ return this.structure.length; };
  getMapWidth() { return this.structure[0].length * 16; };
  getMapHeight(){ return this.structure.length * 16; };
  getMapName(){ return this.name; };
  getMapNameEffect(){ return this.name_effect; };
  getMapOffset(){ return this.name_pointer; };
  getStructureOffset(){ return this.script; };
  getScriptOffset(){ return this.script; };
  getConnectionOffset(_c){ return this.connectionOffset; };
  getConnection(_c){ return this.connection[_c]; };
  getConnections(){ return this.connection; };
  getEntityOffset(_t){ return this.entitiesOffsets[_t]; };
  getEntityCollection(_t){ return this.entities[_t]; };
  getEntity(_t, _i){ return this.entities[_t][_i]; };
  getBorderOffset(){ return this.borderOffset; };
  getPalettesIndex(_i){ return this.palettesIndex[_i]; };
  getTilesetsIndex(_i){ return this.tilesetsIndex[_i]; };
  getBlocksIndex(_i){ return this.blocksIndex[_i]; };
  getMusic(){ return this.music; };
  getWeather(){ return this.weather; };
  getMapType(){ return this.type; };
  getPokemonOffset(){ return this.pokemonOffset; };
  getPokemonCollection(_t){ return this.pokemon[_t]; };
  getPokemon(_t, _i){ return this.pokemon[_t][_i]; };
  getPreview(){ return this.preview; };
  getPreviewContext(){ return this.preview_ctx; };

  setMapOffset(_p){ this.mapOffset = _p; };
  setHeaderOffset(_p){ this.headerOffset = _p; };
  setMapNameOffset(_p){ this.name_pointer = _p; };
  setMapName(_n){ this.name = _n; };
  setMapNameEffect(_n){ this.name_effect = _n; };
  setStructureOffset(_p){ this.script = _p; };
  setScriptOffset(_p){ this.script = _p; };
  setConnectionOffset(_p){ this.connectionOffset = _p; };
  setConnection(_n, _c){ this.connection[_n] = _c; };
  setEntityOffset(_t, _p){ this.entitiesOffsets[_t] = _p; };
  setEntity(_t, _i, _e){ this.entities[_t][_i] = _e; };
  setBorderOffset(_p){ this.borderOffset = _p; };
  setPalettesIndex(_e, _i){ this.palettesIndex[_e] = _i; };
  setTilesetsIndex(_e, _i){ this.tilesetsIndex[_e] = _i; };
  setBlocksIndex(_e, _i){ this.blocksIndex[_e] = _i; };
  setMusic(_i){ this.music = _i; };
  setWeather(_i){ this.weather = _i; };
  setMapType(_i){ this.type = _i; };
  setPokemonOffset(_o){ this.pokemonOffset = _o; };
  setPokemon(_t, _i, _p){ this.pokemon[_t][_i] = _p; };
  setPreview(_v){ this.preview = _v; };
  /*
    Getter / Setter Structure
  */
  getBlockIndex(_x, _y){ return this.structure[_y][_x]&0x3ff; };
  getBlockHeight(_x, _y){ return this.structure[_y][_x]>>10; };
  getBlock(_x, _y){ return this.structure[_y][_x]; };
  setBlock(_x, _y, _b){ this.structure[_y][_x] = (this.structure[_y][_x] & 0x3ff | _b); };
  setBlockHeight(_x, _y, _h){ return (this.structure[_y][_x] & 0xfc00 | (_h << 10)); };
  setBlock(_x, _y, _b){ this.structure[_y][_x] = _b; };

  /*
    Find methods
  */

  findEvents(i, j, e){
    let found = [];
    (e instanceof Array ? e : [e]).forEach((a,m,b)=>{
      let events = this.entities[e[m]];
      found.push(events.find(e=>(e.x == i && e.y == j))[0]);
    });
    return found;
  };

  /*
    Main Methods
  */
  resize(_w, _h){
    let h = this.getMapHeight();
    let w = h == 0 ? 0 : this.getMapWidth();
    let dw = _w - w;
    let dh = _h - h;
    if(dh < 0){
      this.structure = _h;
    }else if(dh > 0){
      for(let j = h; j < _h; j++){
        this.structure[j] = new Array(_w).fill(0x0000);
      }
      h = _h;
    }

    if(dw < 0){
      for(let j = 0; j < h; j++){
        this.structure[j].length = _w;
      }
    }else if(dw > 0){
      for(let j = 0; j < h; j++){
        for(let i = w; i < _w; i++){
          this.structure[j][i] = 0x0000;
        }
      }
    }
  };

  render(editor, dx, dy, show_name){
    let ctx = editor.getMapContext();
    if(this.preview === undefined){
      this.create_preview(editor);
    }
    ctx.drawImage(this.preview, dx, dy);
    let name = this.getMapName();// + " [" + connection.bank + ", " + connection.map + "]";

    let map_width = this.getMapWidth();
    let map_height = this.getMapHeight();
    let xText = dx + map_width / 2 - name.length * 8;
    let yText = dy + map_height / 2 + 10;
    if(show_name){
      //* BLACK RECTANGLE TODO: Change it to the 'Sign Background' *//
      ctx.beginPath();
      ctx.fillStyle = "rgba(10, 10, 10, 0.7)";
      ctx.rect(xText - 20, yText - 40, name.length * 24, 60);
      ctx.fill();

      /* DISPLAY NAME TODO: USE POKEMON FONT TO SHOW THE NAME */
      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "white";
      ctx.fillText(name, xText, yText);
    }else{
      ctx.beginPath();
      ctx.rect(-2, -2, map_width + 3, map_height + 3);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3;
      ctx.stroke();
      if(editor.getCamera().zoom > 0.7){
        this.render_entities(editor, dx, dy);
      }
    }
  };

  render_entities(editor, dx, dy){
    let ctx = editor.getMapContext();
		let colorEvent = ["#33cc00", "#440044", "#33ffff", "#ff00ff"];
    this.entities.forEach((event, index)=>{
			event.forEach(entity=>{
				if(entity != undefined){
          let x = dx + entity.getX() * 16;
          let y = dy + entity.getY() * 16;
					ctx.beginPath();
					ctx.rect(x, y, 16, 16);
					ctx.lineWidth = 1;
					ctx.strokeStyle = colorEvent[index];
					ctx.stroke();
          if(index == 0){
			      let sprite = editor.getOverworldSprite(entity.getSpriteIndex());
  					if(sprite !== undefined){
  						let xSprite = x + 8 - (sprite.width / 2);
  						let ySprite = y + 16 - sprite.height;
  						ctx.drawImage(sprite, xSprite, ySprite);
  					}
          }
				}
      });
    });
  };

  render_topographic(editor, dx, dy){
    if(editor.height_level.getAttribute("id") == "height_level_new"){
    	let date = new Date().getTime();
    	editor.height_level.setAttribute("id", "height_level_created");
    	editor.height_level.width = map_width;
    	editor.height_level.height = map_height;
    	let context = this.height_level.getContext("2d");
    	let structure = this.current_map.structure;
    	let structure_width = structure[0].length;
    	let structure_height = structure.length;
    	for(let j = 0; j < structure_height; j++){
    		for(let i = 0; i < structure_width; i++){
    			let actual = this.current_map.structure[j][i]>>10;
    			let top 		= j - 1 < 0 ? 0 : !(structure[j-1][i]>>10^actual);
    			let left 		= i - 1 < 0 ? 0 : !(structure[j][i-1]>>10^actual);
    			let right		= i + 1 >= structure_width ? 0 : !(structure[j][i+1]>>10^actual);
    			let bottom 	= j + 1 >= structure_height ? 0 : !(structure[j+1][i]>>10^actual);
    			let name_image = actual|(top<<7|left<<8|bottom<<9|right<<10);
    			let tile_block = this.height_image[1][name_image];
    			if(tile_block == undefined){
    				let block_height = this.height_image[0][actual];
    				let cvs = document.createElement("canvas");
    				cvs.width = 16;
    				cvs.height = 16;
    				let ctx = cvs.getContext("2d");
    				for(let h = 0; h <= 1; h++){
    					for(let w = 0; w <= 1; w++){
    						let dw = (w & !right)	| (!w & !left);
    						let dh = (h & !bottom) | (!h & !top);
    						let sgx = 2 * (1 - w) - 1;
    						let sgy = 2 * (1 - h) - 1;
    						let fx = 8 * (1 - sgx * dw);
    						let fy = 8 * (1 - sgy * dh);
    						ctx.drawImage(block_height, fx, fy, 8, 8, w * 8, h * 8, 8, 8);
    					}
    				}
    				tile_block = this.height_image[1][name_image] = cvs;
    			}
    			context.drawImage(tile_block, i * 16, j * 16);
    		}
    	}
    }
    x.drawImage(this.height_level, 0, 0);
  };

  create_preview(editor){
		// Create block set for the map
		let tileset_concat = editor.getTilesetBuffer(this.getTilesetsIndex(0)).concat(editor.getTilesetBuffer(this.getTilesetsIndex(1)));
		let palette_concat = editor.getPaletteBuffer(this.getPalettesIndex(0)).concat(editor.getPaletteBuffer(this.getPalettesIndex(1)));
		editor.getGfxBlocks(this.getBlocksIndex(0), tileset_concat, palette_concat);
		editor.getGfxBlocks(this.getBlocksIndex(1), tileset_concat, palette_concat);

		let map_preview = document.createElement("canvas");
		let twidth, theight;
		map_preview.width = (twidth 	= this.getWidth()) * 16;
		map_preview.height= (theight 	= this.getHeight()) * 16;
		let preview_ctx = this.preview_ctx = map_preview.getContext("2d");

		for(let j = 0; j < theight; j++){
			for(let i = 0; i < twidth; i++){
				editor.draw_block(preview_ctx, this, i, j, this.getBlockIndex(i, j));
			}
		}
		this.preview = map_preview;
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
