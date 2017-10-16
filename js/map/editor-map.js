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
class EMap{
  constructor(self){
    /* Map Visualization Variables */
		this.camera = new Camera();
		this.is_being_draw = false;
		this.banks;

    this.html_map = $("#canvas_map")[0];
    this.current_map;

		this.height_color = [
      [ 77, 210, 129], [166, 224, 114], [235, 111,  23], [236, 151,  35], [ 26, 213, 218],
      [239,  84,  84], [238, 217, 108], [ 66, 157, 236], [121, 110, 238], [154, 116, 238],
			[194, 124, 240], [227, 131, 239], [255, 255, 255]
		];
		this.height_level = document.createElement("canvas");

    /* Map buffer */
    this.block_buffer    = [];
    this.palette_buffer  = [];
    this.tileset_buffer  = [];
    this.height_buffer   = [[/* Colored Blocks */],[/* Colored Tiles */]];

    this.overworld_sprite_buffer  = [];
    this.overworld_palette_buffer = [];

    this.reader = self;
    this.context = null;
  };
  /*
    Getter / Setter
  */
  getMapContext(){ return this.html_map.getContext("2d"); };
  getBlockBuffer(_i){ return this.block_buffer[_i].memory; };
  getPaletteBuffer(_i){ return this.palette_buffer[_i].memory; };
  getTilesetBuffer(_i){ return this.tileset_buffer[_i].memory; };

  getOverworldSprite(_i){ let spr = this.overworld_sprite_buffer[_i]; return !!spr ? spr.sprite : spr; };
  getBlocks(_i){ return this.block_buffer[_i]; };
  getBlockSprite(_i, _b){ return this.block_buffer[_i].images[_b]; };
  getCamera(){ return this.camera; };
  /*
    Initialization
  */
  init(){
    this.loadMapsFromMemory();
    this.loadOverworldSprites();
    this.initHTML();
    this.initEvents();
  };

  initHTML(){
    this.appendHeaderMenu();
  };

  /* Loading content.
    From the offset found in memory, the algorithm takes chains of bytes
    and split it as necessary, each byte, short or pointer, is information about
    tilesets, entities, ...
  */
  loadMapsFromMemory(){
    let self = this.reader;
    let type = self.isFRLG() === true ? 1 : 0;
    let header_map  = self.memoryOffsets.map_header;
		let total_banks = self.getTableSize(header_map);
		this.banks = new Array(total_banks);
		for(let b = 0; b < total_banks; b++){
			let bank_offset = self.getOffset(header_map + b * 4);
			let next_bank_offset 	= self.getOffset(header_map + (b + 1) * 4);
      let bank = this.banks[b] = new Bank(bank_offset);
      if(next_bank_offset < bank_offset) next_bank_offset = header_map;
			for(let m = bank_offset; m < next_bank_offset; m += 4){
				let header_pointer = self.getOffset(m);
				let map_pointer = self.getOffset(header_pointer);
        let map = new Map(header_pointer, map_pointer);
        let name_displacement = 4 * ((2 - type) * (self.getByte(header_pointer + 20) - 88 * type) + 1 - type);
        let name_pointer = self.getOffset(self.memoryOffsets[`map_name_${type}`] + name_displacement);
        map.setMapNameOffset(name_pointer);
        map.setMapName(self.getTextByOffset(self.getDictionary("Text"), name_pointer));
        map.setMapNameEffect(self.getByte(header_pointer + 21));
        map.setScriptOffset(self.getOffset(header_pointer + 8));
        map.setMusic(self.getShort(header_pointer + 16));
        map.setWeather(self.getByte(header_pointer + 22));
        map.setMapType(self.getByte(header_pointer + 23));
        map.setPokemonOffset(self.getByte(header_pointer + 27)); // ?? Offset not Byte
        map.setBorderOffset(self.getOffset(map_pointer + 8));
        //border_width: self.getByte(map + 24), // (??)
        //border_height: self.getByte(map + 25), // (??)
        //title: self.getByte(header_pointer+ 26), // (??)
        //index: self.getShort(header_pointer+ 18), // Name table index (??)

				/* Creating map blocks structure. */
				let wmap = self.getShort(map_pointer);
				let hmap = self.getShort(map_pointer + 4);
        if(wmap * hmap > 0){
  				let structOffset = self.getOffset(map_pointer + 12);
          map.resize(wmap,  hmap);
          map.setStructureOffset(structOffset);
  				for(let j = 0; j < hmap; j++){
  					for(let i = 0; i < wmap; i++){
  						map.setBlock(i, j, self.getShort(structOffset + (i + j * wmap) * 2));
  					}
  				}
        }
				// Reading and Adding all Connections to buffer
				let connection = self.getOffset(header_pointer + 12);
        if(self.isROMOffset(connection)){
          map.setConnectionOffset(connection);
  				let firstConnection = self.getOffset(connection + 4);
  				let lastConnection = firstConnection + self.getByte(connection) * 12;
  				for(let c = firstConnection; c < lastConnection; c += 12){
            let connection = new Connection(self.getByte(c), self.getShort(c + 4)|(self.getShort(c + 6)<<16), self.getByte(c + 8), self.getByte(c + 9));
  					map.setConnection((c - firstConnection) / 12, connection);
  				}
        }
				// Events in map
				let pointer_events = self.getOffset(header_pointer + 4);
        if(self.isROMOffset(header_pointer)){
          // Adding Overworlds
  				let firstperson = self.getOffset(pointer_events + 4);
          if(self.isROMOffset(firstperson)){
            map.setEntityOffset(0, firstperson);
    				let lastperson = firstperson + self.getByte(pointer_events) * 24;
    				for(let i = firstperson; i < lastperson; i += 24){
              let overworld = new Overworld(self.getShort(i + 4), self.getShort(i + 6), self.getByte(i + 8));
              overworld.setSpriteIndex(self.getByte(i + 1));
              overworld.setMovement(self.getByte(i + 9));
              overworld.setMovementRadius(self.getByte(i + 10));
              overworld.setTrainer(self.getByte(i + 12));
              overworld.setRangeVision(self.getShort(i + 14));
              overworld.setScriptOffset(self.getOffset(i + 16));
              overworld.setStatus(self.getShort(i + 20));
              map.setEntity(0, self.getByte(i) - 1, overworld);
    				}
          }
  				// Adding Warps
  				let firstwarp = self.getOffset(pointer_events + 8);
          if(self.isROMOffset(firstwarp)){
            map.setEntityOffset(1, firstwarp);
            let lastwarp = firstwarp + self.getByte(pointer_events + 1) * 8;
    				for(let i = firstwarp; i < lastwarp; i += 8){
              let warp = new Warp(self.getShort(i), self.getShort(i + 2), self.getShort(i + 4));
              warp.setWarpIndex(self.getByte(i + 5));
              warp.setBankIndex(self.getByte(i + 6));
              warp.setMapIndex(self.getByte(i + 7));
              map.setEntity(1, (i - firstwarp) / 8, warp);
    				}
          }
          // Adding Scripts
  				let firstscript = self.getOffset(pointer_events + 12);
          if(self.isROMOffset(firstscript)){
            map.setEntityOffset(2, firstscript);
    				let lastscript = firstscript + self.getByte(pointer_events + 2) * 16;
    				for(let i = firstscript; i < lastscript; i += 16){
              let script = new Script(self.getShort(i), self.getShort(i + 2), self.getByte(i + 4));
              script.setNumber(self.getShort(i + 6));
              script.setValue(self.getByte(i + 8));
              script.setScriptOffset(self.getOffset(i + 12));
              map.setEntity(2, (i - firstscript) / 16, script);
    				}
          }
          // Adding signpost
  				let firstsignpost = self.getOffset(pointer_events + 16);
          if(self.isROMOffset(firstsignpost)){
            map.setEntityOffset(3, firstsignpost);
    				let lastsignpost = firstsignpost + self.getByte(pointer_events + 3) * 12;
    				for(let i = firstsignpost; i < lastsignpost; i += 12){
              let signpost = new Signpost(self.getShort(i), self.getShort(i + 2), self.getByte(i + 4));
              signpost.setSpecial(self.getOffset(i + 8));
              map.setEntity(3, (i - firstsignpost) / 12, signpost);
    				}
          }
        }
				// There are two tilesets in each map.
				for(let i = 0; i < 2; i++){
					let offset = self.getOffset(map_pointer + 16 + 4 * i);

					/* Obtaning the palettes from the tilesets. */
					let primary = self.getByte(offset + 1); /* Primary tileset [Byte] */
					let palette_offset = self.getOffset(offset + 8) + 0x20 * (6 + self.isFRLG()) * primary;
          let palette_index = this.getPaletteIndex(palette_offset);
					if(palette_index === -1){
            palette_index = this.palette_buffer.length;
						this.palette_buffer.push({offset: palette_offset, memory: this.getTilesetPalettes(palette_offset, primary), primary: !!primary});
					}
          map.setPalettesIndex(i, palette_index);

					/* Obtaning blocks. */
					let block_offset = self.getOffset(offset + 12);
					let last_block_offset	= type ? self.getOffset(offset + 20) : self.getOffset(offset + 16);
          let block_index = this.getBlockIndex(block_offset);
					if(block_index === -1){
            let used_blocks 	= (last_block_offset - block_offset) >> 4;
						let total_blocks = Math.max(0x200, used_blocks);
						let data_blocks = new Array(total_blocks);
						for(let b = 0; b < total_blocks; b++){
							data_blocks[b] = new Array(8);
							for(let o = 0; o < 8; o++){
								data_blocks[b][o] = self.getShort(block_offset + b * 16 + o * 2);
							}
						}
            block_index = this.block_buffer.length;
						this.block_buffer.push({offset: block_offset, memory: data_blocks, totalBlocks: used_blocks, images: []});
					}
          map.setBlocksIndex(i, block_index);

					/* Creating tile blocks. */
					let tileset_offset = self.getOffset(offset + 4);
          let tileset_index = this.getTilesetIndex(tileset_offset);
					if(tileset_index === -1){
						let tileset_decompress;
            let compressed = self.getByte(tileset_offset);
						if(compressed){
							let totalunCompressed = self.getByte(tileset_offset + 1)<<1|self.getByte(tileset_offset + 2)<<9|self.getByte(tileset_offset + 3)<<17;
							tileset_decompress = Decompressor.LZSS_Decompress(self.ReadOnlyMemory.slice(tileset_offset + 4, tileset_offset + 4 + totalunCompressed), 0x8000);
						}else{
							tileset_decompress = Decompressor.GBA_Decompress(self.ReadOnlyMemory.slice(tileset_offset, tileset_offset + 0x4000));
						}

            let tileset_canvas = document.createElement("canvas");
            let tileset_ctx = tileset_canvas.getContext("2d");
            let tileset_width = tileset_canvas.width = 128;
            let tileset_height = tileset_canvas.height = 256;
            let tilset_image = tileset_ctx.getImageData(0, 0, tileset_width, tileset_height);

            // Draw tilesetsheet
            let block_size = 8, p = 0;
            for(let h = 0; h < tileset_height; h += block_size){
              for(let w = 0; w < tileset_width; w += block_size){
                for(let m = 0; m < block_size; m++){
                  for(let n = 0; n < block_size; n++){
                    let px = tileset_decompress[p++] * 16;
                    let id = (w + n) + (h + m) * tileset_width, idx = id * 4;
                    tilset_image.data[idx + 0] = px;
                    tilset_image.data[idx + 1] = px;
                    tilset_image.data[idx + 2] = px;
                    tilset_image.data[idx + 3] = 255;
                  }
                }
              }
            }
            tileset_ctx.putImageData(tilset_image, 0, 0);
            tileset_index = this.tileset_buffer.length;
						this.tileset_buffer.push(new Tileset(tileset_offset, tileset_decompress, tileset_canvas, compressed));
					}
          map.setTilesetsIndex(i, tileset_index);
				}
        bank.setMap((m - bank_offset) / 4, map);
			}
		}
	};

  loadOverworldSprites(){
    let self = this.reader;
		/* Obtaning Sprites paletes. */
		let palette_header  = self.memoryOffsets.sprite_palette;
		let palette_offset  = self.getOffset(palette_header);
    let palette_index   = 0;
		while(self.isROMOffset(palette_offset)){
      let palette = palette_header + (palette_index++) * 8;
			this.overworld_palette_buffer[self.getByte(palette + 4)] = this.getPalettes(self.getOffset(palette));
			palette_offset = self.getOffset(palette + 8);
		}

		// Adding sprites
    let sprite_header = self.memoryOffsets.sprite_header;
		let sprite_pointer = self.getOffset(sprite_header);
    let sprite_index = 0;
		while(self.isROMOffset(sprite_pointer)){
			let texture = self.getOffset(sprite_pointer + 28);
      let dec_position = self.getOffset(texture);
			if(self.isROMOffset(dec_position)){
				let sprite = Decompressor.GBA_Decompress(self.ReadOnlyMemory.slice(dec_position, dec_position + self.getShort(texture + 4)));
				let palette = this.overworld_palette_buffer[self.getByte(sprite_pointer + 2)];
				let overworldcanvas = document.createElement("canvas");
				let overworld_width 	= overworldcanvas.width 	= self.getShort(sprite_pointer + 8);
				let overworld_height 	= overworldcanvas.height 	= self.getShort(sprite_pointer + 10);
				let overworldctx = overworldcanvas.getContext("2d");
				/* Drawing Sprite Algorithm. */
				let mask = overworldctx.createImageData(overworld_width, overworld_height);
				for(let j = 0; j < overworld_height; j += 8){
					for(let i = 0; i < overworld_width; i += 8){
						for(let h = 0; h < 8; h++){
							for(let w = 0; w < 8; w++){
								let pixel = sprite[j * overworld_width + ((i + h) * 8) + w];
								if(pixel != 0){
									let color = palette[pixel];
									let id = ((j + h) * overworld_width + i + w) * 4;
									mask.data[id + 0] = (color >> 16) & 0xff;
									mask.data[id + 1] = (color >> 8) & 0xff;
									mask.data[id + 2] = color & 0xff;
									mask.data[id + 3] = 255;
								}
							}
						}
					}
				}
				overworldctx.putImageData(mask, 0, 0);
				this.overworld_sprite_buffer[sprite_index] = {
					sprite: overworldcanvas,
					synch: self.getShort(sprite_pointer + 6),
					slot: self.getByte(sprite_pointer + 12),
					overwrite: self.getByte(sprite_pointer + 13),
					empty: self.getShort(sprite_pointer + 14),
					/*distribution: self.getOffset(sprite_pointer + 16),
					sizedraw: self.getOffset(sprite_pointer + 20),
					shiftdraw: self.getOffset(sprite_pointer + 24),*/
					ram: self.getOffset(sprite_pointer + 32)
				};
			}
			sprite_pointer = self.getOffset(sprite_header + 4 * (++sprite_index));
		}
	};

  /*
    Buffers
    If we store just one time each element and look for it when we need it is more
    efficient instead of applying the algorithm that obtain it from the ROM.
  */
  getPaletteIndex(_o){ return this.palette_buffer.findIndex(e=>e.offset==_o); };
  getTilesetIndex(_o){ return this.tileset_buffer.findIndex(e=>e.offset==_o); };
  getBlockIndex(_o){ return this.block_buffer.findIndex(e=>e.offset==_o); };

  /*
    HTML
    Methods that create the user interface
  */
  appendHeaderMenu(){
    let html = "";
    this.banks.forEach((bank, i)=>{
      html += `<div class="bank_option"><div class="bank_name">Bank ${i}</div>`;
      bank.maps.forEach((map, j)=>{
        html +=`<div class="map_option">${j}. ${map.getMapName().replace("[FC]","")}</div>`;
      });
      html += `</div>`;
    });
    $("#map_headers").html(html);
  };

  /* Paletes Methods
    Each palette contains 16 colors, these colors are made from two bytes (16 bits)
    compressed into gba color.
    Tilesets have 13 palettes:
    RSE 0-5 Primary palettes 6-12 Secondary palettes
    FL  0-6 Primary palettes 7-12 Secondary palettes
  */
  getPalettes(offset){return(new Array(16).fill(0).map((a,b)=>Color.gba2hex(this.reader.getShort(offset + b * 2))));};
  getTilesetPalettes(offset, primary){return [].concat(...(new Array(0x6|(primary^this.reader.isFRLG())).fill(0).map((a,b)=>this.getPalettes(offset + b * 32))))};

  /*
    Add / Remove Events
  */
  changeMap(bank_number, map_number){
    let bank = this.banks[bank_number];
		if(bank instanceof Bank){
			let map = bank.getMap(map_number);
      if(map instanceof Map){
        this.current_map = map;
  			let header_html = $(`.bank_option:eq(${bank_number})`);
  			if(!header_html.hasClass("open")){
  				$(".bank_option.open").removeClass("open");
  				header_html.addClass("open");
  			}
  			$(".map_option.current").removeClass("current");
  			let map_html = header_html.find(`.map_option:eq(${map_number})`);
  			let map_top = map_html.offset().top, scroll_top = $("#map_headers").scrollTop();
  			if(map_top < 0 || map_top >= scroll_top + $(window).height()){
  				$("#map_headers").animate({scrollTop: (map_top + scroll_top) + "px"}, 300, ()=>map_html.addClass("current"));
  			}else{
  				map_html.addClass("current");
  			}

  			/* Restore Camera */
  			let element = $("#canvas_map")[0];
  			this.camera.restore();
  			this.camera.fitIn("#canvas_map");
  			this.camera.set((this.camera.width - map.getMapWidth()) / 2, (this.camera.height - map.getMapHeight()) / 2);

  			let ctx = this.getMapContext();
  			ctx.webkitImageSmoothingEnabled = false;
  			ctx.mozImageSmoothingEnabled = false;
  			ctx.imageSmoothingEnabled = false;

  			this.height_level.setAttribute("id", "height_level_new");
  			this.render(ctx);
  			this.render_tileset(map);
      }
		}
	};

  neighbourhood(x, y){
		let next_draw = [];
		let already_drawn = new Set();
    let drawn_maps = 0;
		next_draw.push({ map: this.current_map, x: 0, y: 0 });
    already_drawn.add(this.current_map.getHeaderOffset());

    let next_map = next_draw[drawn_maps];
		while(next_map !== undefined){
      let header_offset = next_map.map.getHeaderOffset();
			let map_width = next_map.map.getMapWidth();
			let map_height = next_map.map.getMapHeight();
			if(Utils.isObject(x)){
				let zoom = this.camera.zoom;
				let dx = this.camera.x + (next_map.x + map_width) * zoom;
				let dy = this.camera.y + (next_map.y + map_height) * zoom;
				let cx = dx - map_width * zoom;
				let cy = dy - map_height * zoom;
				// Draw map name if this is not the current map.
				if((dx > 0 && cx < this.camera.width) && (dy > 0 && cy < this.camera.height) && !already_drawn.has(header_offset)){
					next_map.map.render(this, next_map.x, next_map.y, true);
				}
			}

			// Load next connections.
			next_map.map.getConnections().forEach(connection=>{
				// Don't draw emerge/submerge connections.
        let direction = connection.getDirection();
				if(direction > 0x0 && direction < 0x5){
					let neighbour = this.banks[connection.bank].getMap(connection.map);
					let h = Math.floor(direction/3);
					let o = 16 * connection.offset;
          let neighbour_width = neighbour.getMapWidth();
          let neighbour_height = neighbour.getMapHeight();
					let m = h * ((direction % 2) * -neighbour_width + (direction == 4) * map_width) + (1 - h) * o;
					let n = (1 - h) * (((direction + 1) % 2) * -neighbour_height + (direction == 1) * map_height) + h * o;
					if (!already_drawn.has(neighbour.getHeaderOffset())){
            let mx = next_map.x + m;
            let my = next_map.y + n;
						if(!Utils.isObject(x)){
							let zoom = this.camera.zoom;
							let canvas = $("#canvas_map");
							let dx = (x - this.camera.x)/zoom - mx;
							let dy = (y - this.camera.y)/zoom - my;
							if(dx >= 0 && dy >= 0 && dx <= neighbour_width && dy <= neighbour_height){ return connection; }
						}
						next_draw.push({ map: neighbour, x: mx, y: my });
					}
				}
			});
      next_map = next_draw[++drawn_maps];
	    already_drawn.add(header_offset);
		}
    this.current_map.render(this, 0, 0, false);
	};

  getGfxHeights(){
		let img = $("#height_image")[0];
		for(let k = 0; k < 64; k++){
			let color = this.height_color[k % this.height_color.length];
			let cnvs = document.createElement("canvas");
			let ctx = cnvs.getContext("2d");
			let wdt = ctx.width 	= img.width;
			let hgt = ctx.height 	= img.height;
			ctx.drawImage(img, 0, 0);
			let dat = ctx.getImageData(0, 0, wdt, hgt);
			for(let j = 0; j < hgt; j++){
				for(let i = 0; i < wdt; i++){
					let id = i + j * wdt;
					let op = dat.data[id * 4 + 0] / 255;
					dat.data[id * 4 + 0] = color[0] * op;
					dat.data[id * 4 + 1] = color[1] * op;
					dat.data[id * 4 + 2] = color[2] * op;
				}
			}
			ctx.putImageData(dat, 0, 0);
			this.height_image[0][k] = cnvs;
		}
	};

  getGfxBlocks(index, tileset, palettes){
    let blocks_buffer = this.block_buffer[index];
		if(blocks_buffer.images.length === 0){
      let blocks = new Array(blocks_buffer.totalBlocks);
			for(let j = 0; j < blocks_buffer.totalBlocks; j++){
				let block = document.createElement("canvas");
				let size = block.width = block.height = 16;
				let ctx = block.getContext("2d");
				let img = ctx.createImageData(size, size);
				// 4 layers foreground + 4 layers background = 8 tiles = 1 block
				for(let b = 0; b < 8; b++){
					let section = blocks_buffer.memory[j][b];
					let indx = (section >> 12) * 16; // Palette Index
					let tile = (section & 0x3ff) * 64;
					let flip = (section >> 10) & 0x3;
					let x_flip = 7 * (flip & 0x1), y_flip = 7 * (flip & 0x2) / 2;
					for(let h = 0; h < 8; h++){
						let j = Math.abs(y_flip - h);
						for(let w = 0; w < 8; w++){
							let i = Math.abs(x_flip - w);
							let pixel = tileset[tile + j * 8 + i] & 0xf;
							if(pixel != 0 || b < 4){
								let id = (((b & 0x2) * 4 + h) * size + (b & 0x1) * 8 + w) * 4;

								let color = palettes[indx + pixel];
								img.data[id + 0] = (color >> 16) & 0xff;
								img.data[id + 1] = (color >> 8) & 0xff;
								img.data[id + 2] = color & 0xff;
								img.data[id + 3] = 255;
							}
						}
					}
				}
				ctx.putImageData(img, 0, 0);
        this.block_buffer[index].images[j] = block;
			}
		}
	};

  mouseToMapCoordinates(map, x, y){
		let camera = this.camera, zoom = camera.zoom;
		let mapwidth = this.current_map.width * zoom, mapheight = this.current_map.height * zoom;
		let xMouse = x - map.offset().left - camera.x;
		let yMouse = y - map.offset().top - camera.y;
		if(xMouse >= 0 && xMouse < mapwidth && yMouse >= 0 && yMouse < mapheight){
			return {x: Math.floor(xMouse/(16 * zoom)), y: Math.floor(yMouse/(16 * zoom))};
		}else{
			return false;
		}
	};

  // Render map.
	render(ctx){
		this.is_being_draw = false;
    let camera_zoom   = this.camera.zoom;
		let camera_width  = this.camera.width;
		let camera_height = this.camera.height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, camera_width, camera_height);

		let xCamera = Math.round(this.camera.x);
		let yCamera = Math.round(this.camera.y);
		ctx.setTransform(camera_zoom, 0, 0, camera_zoom, xCamera, yCamera);
		/* Drawing */
		this.neighbourhood(ctx);
		this.camera.update(self);
		if(this.is_being_draw){
			requestAnimationFrame(()=>this.render(ctx));
		}
	};

  /*
		Tileset Methods.
	*/
	setBlock(x, y, map, block, re_draw){
		if(map.getBlock(x, y) != block){
			map.setBlock(x, y, block);
			let ctx = map.getPreviewContext();
			this.draw_block(ctx, map, x, y, block);
			if(!this.is_being_draw){
				this.render(this.getMapContext());
			}
		}
	};

  draw_block(ctx, map, x, y, block){
		let blocks = this.getBlocks(map.getBlocksIndex(0));
		if(block >= blocks.totalBlocks){
			block -= 0x200;
			blocks = this.getBlocks(map.getBlocksIndex(1));
		}
    if(block < blocks.totalBlocks){
			ctx.drawImage(blocks.images[block], x * 16, y * 16);
		}
	};

	render_tileset(map){
		let total = [Math.ceil(this.block_buffer[map.getBlocksIndex(0)].totalBlocks / 8),
								 Math.ceil(this.block_buffer[map.getBlocksIndex(1)].totalBlocks / 8)];
    let blocks = $("#blocks_map")[0];
		blocks.width	= 128;
		blocks.height = (total[0] + total[1]) * 16;
		let ctx = blocks.getContext("2d");
		for(let m = 0; m < 2; m++){
			for(let k = 0; k < total[m]; k++){
				for(let i = 0; i < 8; i++){
					this.draw_block(ctx, map, i, k + total[0] * m, k * 8 + i + 0x200 * m);
				}
			}
		}
	};


  initEvents(){
    let self = this;
    $(".bank_name").click(function(){
      if(!$(this).parent().hasClass("open")){
        $(".bank_option.open").removeClass("open");
      }
      $(this).parent().toggleClass("open");
    });

    $(".map_option").on("click", function(e){
      self.changeMap($(this).parent().index(), $(this).index()-1);
    });

    $("#canvas_map").mousedown(function(e){
      e.preventDefault();
      if(event.which == 1 && $("#mousepannel").hasClass("hide")){
        if(e.ctrlKey){
          $(this).addClass("grabbing");
        }else{
          let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
          if(Utils.isObject(mouse)){
            if(self.camera.zoom > 0.7){
              /* If you are in the map area */
              let xBlock = mouse.x, yBlock = mouse.y;
              if(e.altKey){
                let pick = self.getEvents(xBlock, yBlock, [0, 1, 2, 3]);
                if(pick.length > 0){
                  self.camera.properties.grabbed = pick[0].event;
                }
              }else{
                let block  = self.camera.properties.block || 1;
                self.setBlock(xBlock, yBlock, self.current_map, block);
              }
            }
          }else{
            /* Outside the map area, lets check if the mouse is over neighbour maps. */
            let dx = e.pageX - $(this).offset().left;
            let dy = e.pageY - $(this).offset().top;
            let map = self.neighbourhood(dx, dy);
            if(!!map){
              self.camera.properties.map = map;
            }
          }
        }
      }
    }).on("mousemove", function(e){
      e.stopPropagation();
      e.preventDefault();
      let mouseX = e.pageX, mouseY = e.pageY;
      if(self.click.down && event.which == 1 && $("#mousepannel").hasClass("hide")){
        if(e.ctrlKey && !e.altKey){
          let canvas = $("#canvas_map");
          self.camera.vx += (mouseX - self.click.x)/8;
          self.camera.vy += (mouseY - self.click.y)/8;
          self.click.x = mouseX;
          self.click.y = mouseY;
          if(!self.is_being_draw){
            self.render(self.getMapContext());
          }
        }else{
          let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
          /* Dragging neighbour map */
          if(e.altKey && !!self.camera.properties.map){
            /* Direction Dragging */
            let m = Math.floor(self.camera.properties.map.direction/3);
            let df = Math.round(((1-m) * (mouseX - self.click.x) + m * (mouseY - self.click.y)) / 16);
            df = df / Math.abs(df)|0;
            if(df != 0){
              self.camera.properties.map.offset += df;
              self.click.x = mouseX;
              self.click.y = mouseY;
              self.render(self.getMapContext());
            }
          }else if(Utils.isObject(mouse) && self.camera.zoom > 0.7){
            let xBlock = mouse.x, yBlock = mouse.y;
            if(e.altKey){
              /* Dragging an 'Event' */
              if(self.camera.properties.grabbed != undefined){
                self.camera.properties.grabbed.x = xBlock;
                self.camera.properties.grabbed.y = yBlock;
                self.render(self.getMapContext());
              }
            }else{
              let block  = self.camera.properties.block || 1;
              self.setBlock(xBlock, yBlock, self.current_map, block);
            }
          }
        }
      }
    }).on("wheel", function(e){
      e.preventDefault();
      if($("#mousepannel").hasClass("hide")){
        let i = e.pageX - $(this).offset().left;
        let j = e.pageY - $(this).offset().top;
        self.camera.alterZoom((e.originalEvent.deltaY > 0) ? 1.2 : 1/1.2, i, j);
        self.render(self.getMapContext());
      }
    }).on("contextmenu", function(e){
      e.preventDefault();
      let zoom = self.camera.zoom;
      let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
      if(zoom > 0.7 && Utils.isObject(mouse)){
        self.camera.properties.rightclick = mouse;

        /* Lets translade coords to the left top corner */
        let i = $(this).offset().left + self.camera.x + (mouse.x+1) * (16 * zoom);
        let j = $(this).offset().top + self.camera.y + (mouse.y-1) * (16 * zoom);
        $("#mousepannel").removeClass("hide").css({"left": i + "px", "top": j + "px"});
        let pick = self.getEvents(mouse.x, mouse.y, [0, 1, 2, 3]);
        $(".subpannel").addClass("hide");
        /* Show Script Pannel */
        if(pick.length > 0){
          pick = pick[0];
          let pannel, hasScript = undefined;
          switch (pick.type) {
            case 0:
              pannel = "person";
              hasScript = "script";
              $(".subpannel.person_pannel input[name=range_vision]").prop('disabled', !pick.event.is_trainer);
            break;
            case 1:
              pannel = "warp";
            break;
            case 2:
              pannel = "script";
              hasScript = "script";
            break;
            case 3:
              pannel = "sign";
              $(".signtype_pannel").addClass("hide");
              if(pick.event.type < 0x5){ /* Script */
                hasScript = "special";
                $(".subpannel.special_pannel").removeClass("hide");
              }else if(pick.event.type < 0x8){ /* Item */
                $(".item_pannel").removeClass("hide");
                let split = pick.event.special;
                $(".item_pannel select[name=item]").val(split & 0xff);
                $(".item_pannel input[name=hiddenId]").val(split>>16&0xff);
              }else{ /* Secret Base */
                $(".base_pannel").removeClass("hide");
                $(".base_pannel input[name=base]").val(pick.event.special & 0xff);
              }
              $(".item_pannel input[name=amount]").val(pick.event.quantity + 1);
            break;
          }
          $("#pannelbackground > h3").text(pannel + " nº " + (pick.index+1)).removeClass("hide");
          $("#pannelbackground > input[name=index]").val(pick.index);
          $("#pannelbackground > input[name=type]").val(pick.type);
          pannel = ".subpannel." + pannel + "_pannel";
          if(hasScript == "script" || hasScript == "special"){
            $(".pannelinput.script input").val(Utils.pad(pick.event[hasScript].toString(16).toUpperCase(), '0', 6));
          }

          self.camera.properties.grabbed = pick.event;
          $(pannel + ", .panneloption.scriptoption, .subpannel.showAlways").removeClass("hide");

          for (var property in pick.event){
            if(property != 'script'){
              let element = $(`${pannel} input[name=${property}], select[name=${property}]`);
              if(element.length == 1){
                element.val(pick.event[property]);
              }
            }
          }
        }else{
          $("#pannelbackground > h3").addClass("hide");
          $(".panneloption.scriptoption").addClass("hide");
        }
      }else{
        $("#mousepannel").addClass("hide");
      }
    }).on("dblclick", function(e){
      e.preventDefault();
      if($("#mousepannel").hasClass("hide")){
        let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
        if(Utils.isObject(mouse)){
          let xBlock = mouse.x, yBlock = mouse.y;
          if(e.altKey){
            let pick = self.getEvents(xBlock, yBlock, [0, 1, 2, 3]);
            if(pick.length > 0){
              pick = pick[0];
              if(pick.type == 1){
                self.changeMap(pick.event.map, pick.event.bank);
              }else if(pick.event.script != undefined && pick.event.script != 0x0){
                self.codeResult(pick.event.script);
              }else if(pick.event.special != undefined && pick.event.type < 0x5){
                self.codeResult(pick.event.special);
              }
              self.camera.properties.grabbed = pick.event;
            }
          }
        }else{
          let dx = e.pageX - $(this).offset().left;
          let dy = e.pageY - $(this).offset().top;
          let map = self.neighbourhood(dx, dy);
          if(map != undefined && e.altKey){
            self.changeMap(map.bank, map.map);
          }
        }
      }
    });


    $("#mousepannel_close").click(function(){
      $("#mousepannel").addClass("hide");
    });
    $("#mousepannel .subpannel input, select").bind('keyup mouseup', function(){
      let selected = self.camera.properties.grabbed;
      let value = parseInt($(this).val(), $(this).parent().hasClass("script") ? 16 : 10);
      let inputName = $(this).attr("name");
      selected[inputName] = value;
      switch (inputName) {
        case "is_trainer":
          $(".subpannel.person_pannel input[name=range_vision]").prop('disabled', !value);
        break;
        case "type":
          let nhid = $(".signtype_pannel:not(.hide)");
          let val  = selected.special;
          $(".signtype_pannel, .subpannel.special_pannel").addClass("hide");
          if(value < 0x5){ /* Script */
            $(".subpannel.special_pannel").removeClass("hide");
            $(".subpannel .script input").val(Utils.pad(val.toString(16).toUpperCase(),'0', 6));
          }else if(value < 0x8){ /* Item */
            $(".item_pannel").removeClass("hide");
            $(".item_pannel select[name=item]").val(val&0xff);
            $(".item_pannel input[name=hiddenId]").val(val>>16&0xff);
          }else{ /* Secret Base */
            $(".subpannel .base_pannel input").val(val&0xff)
            $(".base_pannel").removeClass("hide");
          }
        break;
        case "picture":
          self.render(self.getMapContext());
        break;
      }
    });

    $("#rightMap").on("mousedown", function(e){
      e.stopPropagation();
      e.preventDefault();
      let xBlock = e.pageX - $(this).offset().left - 14;
      let yBlock = $(this).scrollTop() + e.pageY - $(this).offset().top;
      if((xBlock >= 0 && xBlock <= 128) && (yBlock >= 0 && yBlock <= $("#blocks_map").height())){
        xBlock >>= 4;
        yBlock >>= 4;
        let limitY = self.block_buffer[self.current_map.getBlocksIndex(0)].totalBlocks >> 3;
        $("#selected_block").css({ "left": ((xBlock << 4) + 12) + "px", "top": (yBlock << 4) + "px" });
        if(yBlock >= limitY){
          yBlock += Math.max(0x40, limitY) - limitY;
        }
        self.camera.properties.block = xBlock + (yBlock * 8);
      }
    });

    $(".panneloption").click(function(){
      $("#mousepannel").addClass('hide');
      if($(this).hasClass("delete_event")){
        let type = parseInt($("#pannelbackground > input[name=type]").val());
        let index = parseInt($("#pannelbackground > input[name=index]").val());
        self.removeEvent(type, index);
      }else if($(this).hasClass("add_event")){
        let value = $("#addevent").data("value");
        let rightclick = self.camera.properties.rightclick;
        if(value != undefined){
          self.addEvent(rightclick.x, rightclick.y, parseInt(value));
        }
      }
      self.render(self.getMapContext());
    });

    /* Creating all events. */
    $("body").mousedown(function(e){
      self.click = {down: true, x: e.pageX, y: e.pageY};
    }).mouseup(function(e){
      self.click.down = false;
      $(".grabbing").removeClass("grabbing");
      self.camera.properties.map = undefined;
    });
  };
};
