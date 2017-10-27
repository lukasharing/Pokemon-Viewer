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
		/* Events Variables */
		this.click = {prop: {blocks: [0]}, down: false, x: 0, y: 0};
    this.mouse_type = 0;

		this.camera = new Camera();
		this.is_camera_moving = false;
		this.banks;

    this.html_map = $("#canvas_map")[0];
    this.current_map;

		this.height_color = [
      [ 77, 210, 129], [166, 224, 114], [235, 111,  23], [236, 151,  35], [ 26, 213, 218],
      [239,  84,  84], [238, 217, 108], [ 66, 157, 236], [121, 110, 238], [154, 116, 238],
			[194, 124, 240], [227, 131, 239], [255, 255, 255]
		];

    /* Map buffer */
    this.block_buffer    = [];
    this.palette_buffer  = [];
    this.tileset_buffer  = [];
    this.height_buffer   = [[/* Colored Blocks */],[/* Colored Tiles */]];

    this.overworld_sprite_buffer  = [];
    this.overworld_palette_buffer = [];

    this.reader = self;
    this.context = null;

    this.height_image = [[], []];
  };

  event_freeze(){ return ($("#map_contextmenu").is(":hidden") && this.reader.window_dragging === undefined) };
  /*
    Getter / Setter
  */
  getMapContext(){ return this.html_map.getContext("2d"); };
  getBlockBuffer(_i){ return this.block_buffer[_i].memory; };
  getPaletteBuffer(_i){ return this.palette_buffer[_i].memory; };
  getTilesetBuffer(_i){ return this.tileset_buffer[_i].memory; };

  /*
    Optimization done:
    After this optimization we loaded all sprites from memory into buffer, now
    we only store into buffer all sprite in the current map.
    Loading all sprites from memory took 80ms.
  */
  getOverworldSprite(_i){
    let sprite = this.overworld_sprite_buffer[_i];
    if(sprite === undefined){
      let self = this.reader;
      let sprite_header = self.memoryOffsets.sprite_header;
  		let sprite_pointer = self.getOffset(sprite_header + 4 * _i);
			let texture = self.getOffset(sprite_pointer + 28);
      let dec_position = self.getOffset(texture);
      let overworldcanvas = undefined;
			if(self.isROMOffset(dec_position)){
				let sprite_decompress = Decompressor.GBA_Decompress(self.ReadOnlyMemory.slice(dec_position, dec_position + self.getShort(texture + 4)));
				let palette = this.overworld_palette_buffer[self.getByte(sprite_pointer + 2)];
        overworldcanvas = document.createElement("canvas");
				let overworld_width 	= overworldcanvas.width 	= self.getShort(sprite_pointer + 8);
				let overworld_height 	= overworldcanvas.height 	= self.getShort(sprite_pointer + 10);
				let overworldctx = overworldcanvas.getContext("2d");

				/* Drawing Sprite Algorithm. */
				let mask = overworldctx.createImageData(overworld_width, overworld_height);
				for(let j = 0; j < overworld_height; j += 8){
					for(let i = 0; i < overworld_width; i += 8){
						for(let h = 0; h < 8; h++){
							for(let w = 0; w < 8; w++){
								let pixel = sprite_decompress[j * overworld_width + ((i + h) * 8) + w];
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
			}
      this.overworld_sprite_buffer[_i] = sprite = {
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
    return sprite.sprite;
  };
  getBlocks(_i){ return this.block_buffer[_i]; };
  getBlockSprite(_i, _b){ return this.block_buffer[_i].images[_b]; };
  getCamera(){ return this.camera; };
  /*
    Initialization
  */
  init(){
    this.getGfxHeights();
    this.loadMapsFromMemory();
    this.loadOverworldPalettes();
    this.initHTML();
    this.initEvents();;
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
        let map_index = (m - bank_offset) / 4;
				let header_pointer = self.getOffset(m);
				let map_pointer = self.getOffset(header_pointer);
        let map = new Map(b, map_index);
        map.setHeaderOffset(header_pointer);
        map.setMapOffset(map_pointer);
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
              let overworld_index = self.getByte(i)-1;
              let overworld = new Overworld(self.getShort(i + 4), self.getShort(i + 6), self.getByte(i + 8), overworld_index+1);
              overworld.setSpriteIndex(self.getByte(i + 1));
              overworld.setMovement(self.getByte(i + 9));
              overworld.setMovementRadius(self.getByte(i + 10));
              overworld.setTrainer(self.getByte(i + 12));
              overworld.setRangeVision(self.getShort(i + 14));
              overworld.setScriptOffset(self.getOffset(i + 16));
              overworld.setStatus(self.getShort(i + 20));
              map.setEntity(0, overworld_index, overworld);
    				}
          }
  				// Adding Warps
  				let firstwarp = self.getOffset(pointer_events + 8);
          if(self.isROMOffset(firstwarp)){
            map.setEntityOffset(1, firstwarp);
            let lastwarp = firstwarp + self.getByte(pointer_events + 1) * 8;
    				for(let i = firstwarp; i < lastwarp; i += 8){
              let warp_index = (i - firstwarp) / 8;
              let warp = new Warp(self.getShort(i), self.getShort(i + 2), self.getShort(i + 4), warp_index+1);
              warp.setWarpIndex(self.getByte(i + 5));
              warp.setMapIndex(self.getByte(i + 6));
              warp.setBankIndex(self.getByte(i + 7));
              map.setEntity(1, warp_index, warp);
    				}
          }
          // Adding Scripts
  				let firstscript = self.getOffset(pointer_events + 12);
          if(self.isROMOffset(firstscript)){
            map.setEntityOffset(2, firstscript);
    				let lastscript = firstscript + self.getByte(pointer_events + 2) * 16;
    				for(let i = firstscript; i < lastscript; i += 16){
              let script_index =  (i - firstscript) / 16;
              let script = new Script(self.getShort(i), self.getShort(i + 2), self.getByte(i + 4), script_index+1);
              script.setNumber(self.getShort(i + 6));
              script.setValue(self.getByte(i + 8));
              script.setScriptOffset(self.getOffset(i + 12));
              map.setEntity(2, script_index, script);
    				}
          }
          // Adding signpost
  				let firstsignpost = self.getOffset(pointer_events + 16);
          if(self.isROMOffset(firstsignpost)){
            map.setEntityOffset(3, firstsignpost);
    				let lastsignpost = firstsignpost + self.getByte(pointer_events + 3) * 12;
    				for(let i = firstsignpost; i < lastsignpost; i += 12){
              let signpost_index = (i - firstsignpost) / 12;
              let signpost = new Signpost(self.getShort(i), self.getShort(i + 2), self.getByte(i + 4), signpost_index+1);
              signpost.setSpecial(self.getOffset(i + 8));
              map.setEntity(3, signpost_index, signpost);
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
        bank.setMap(map_index, map);
			}
		}
	};

  loadOverworldPalettes(){
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
    $("#map_banks").html(html);
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
  change_map(bank_number, map_number){
    let map = this.current_map;
    if(map === undefined || map.getBankIndex() !== bank_number || map.getMapIndex() !== map_number){
      let bank = this.banks[bank_number];
  		if(bank instanceof Bank){
  			map = bank.getMap(map_number);
        if(map instanceof Map){
          this.current_map = map;
    			let header_html = $(`.bank_option:eq(${bank_number})`);
    			if(!header_html.hasClass("open")){
    				$(".bank_option.open").removeClass("open");
    				header_html.addClass("open");
    			}
    			$(".map_option.current").removeClass("current");
    			let map_html = header_html.find(`.map_option:eq(${map_number})`);
    			let map_top = map_html.offset().top, scroll_top = $("#map_banks").scrollTop();
    			if(map_top < 0 || map_top >= scroll_top + $(window).height()){
    				$("#map_banks").animate({scrollTop: (map_top + scroll_top) + "px"}, 300, ()=>map_html.addClass("current"));
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

    			this.render(ctx, true);
    			this.render_tileset(map);
        }
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
      for(let conn in next_map.map.getConnections()){
        let connection = next_map.map.getConnection(conn);
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
			}
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
							let id = (((b & 0x2) * 4 + h) * size + (b & 0x1) * 8 + w) * 4;
              if(pixel != 0){
  							let color = palettes[indx + pixel];
                img.data[id + 0] = (color >> 16) & 0xff;
                img.data[id + 1] = (color >> 8) & 0xff;
                img.data[id + 2] = color & 0xff;
                img.data[id + 3] = 255;
              }else if(b < 4){
  							let color = palettes[indx];
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
		let mapwidth = this.current_map.getMapWidth() * zoom, mapheight = this.current_map.getMapHeight() * zoom;
		let xMouse = x - map.offset().left - camera.x;
		let yMouse = y - map.offset().top - camera.y;
		if(xMouse >= 0 && xMouse < mapwidth && yMouse >= 0 && yMouse < mapheight){
			return {x: Math.floor(xMouse/(16 * zoom)), y: Math.floor(yMouse/(16 * zoom))};
		}else{
			return false;
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
      this.render(this.getMapContext(), true);
    }
  };

  draw_block(ctx, map, x, y, block){
    let blocks = this.getBlocks(map.getBlocksIndex(0));
    if(block >= blocks.totalBlocks){
      block -= Math.max(0x200, blocks.totalBlocks);
      blocks = this.getBlocks(map.getBlocksIndex(1));
    }
    if(block < blocks.totalBlocks){
      ctx.drawImage(blocks.images[block], x * 16, y * 16);
    }
	};

  // Render map.
  render(ctx, force_draw = false){
    if(this.is_camera_moving ^ force_draw){
      this.is_camera_moving = false;
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
      this.camera.update(this);
      requestAnimationFrame(()=>this.render(ctx));
    }
  };

	render_tileset(map){
    let tblock0 = this.block_buffer[map.getBlocksIndex(0)].totalBlocks;
    let tblock1 = this.block_buffer[map.getBlocksIndex(1)].totalBlocks;
		let tile0 = Math.ceil(tblock0 / 8);
		let tile1 = Math.ceil(tblock1 / 8);

    let blocks = $("#blocks_map")[0];
		blocks.width	= 128;
		blocks.height = (tile0 + tile1) * 16;
		let ctx = blocks.getContext("2d");
		for(let k = 0; k < tile0; k++){
			for(let i = 0; i < 8; i++){
				this.draw_block(ctx, map, i, k, k * 8 + i);
			}
		}
    for(let k = 0; k < tile1; k++){
			for(let i = 0; i < 8; i++){
				this.draw_block(ctx, map, i, k + tile0, k * 8 + i + Math.max(0x200, tblock0));
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
      self.change_map($(this).parent().index(), $(this).index()-1);
    });

    $("#canvas_map").mousedown(function(e){
      e.preventDefault();
      if(event.which == 1 && self.event_freeze()){
        if(e.ctrlKey){
          $(this).addClass("grabbing");
        }else{
          let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
          if(Utils.isObject(mouse)){
            if(self.camera.zoom > 0.7){
              /* If you are in the map area */
              let xBlock = mouse.x, yBlock = mouse.y;
              if(e.altKey){
                let pick = self.current_map.findEvents(xBlock, yBlock, [0, 1, 2, 3]);
                if(pick.length > 0){
                  self.camera.prop.grabbed = pick[0];
                }
              }else{
                let block  = self.camera.prop.block || 1;
                self.setBlock(xBlock, yBlock, self.current_map, block);
              }
            }
          }else{
            /* Outside the map area, lets check if the mouse is over neighbour maps. */
            let dx = e.pageX - $(this).offset().left;
            let dy = e.pageY - $(this).offset().top;
            let map = self.neighbourhood(dx, dy);
            if(!!map){
              self.camera.prop.map = map;
            }
          }
        }
      }
    }).on("mousemove", function(e){
      let mouseX = e.pageX, mouseY = e.pageY;
      if(self.click.down && event.which == 1 && self.event_freeze()){
        if(e.ctrlKey && !e.altKey){
          let canvas = $("#canvas_map");
          self.camera.vx += (mouseX - self.click.x)/8;
          self.camera.vy += (mouseY - self.click.y)/8;
          self.click.x = mouseX;
          self.click.y = mouseY;
          self.render(self.getMapContext(), true);
        }else{
          let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
          /* Dragging neighbour map */
          if(e.altKey && !!self.camera.prop.map){
            /* Direction Dragging */
            let m = Math.floor(self.camera.prop.map.direction/3);
            let df = Math.round(((1-m) * (mouseX - self.click.x) + m * (mouseY - self.click.y)) / 16);
            df = df / Math.abs(df)|0;
            if(df != 0){
              self.camera.prop.map.offset += df;
              self.click.x = mouseX;
              self.click.y = mouseY;
              self.render(self.getMapContext(), true);
            }
          }else if(Utils.isObject(mouse) && self.camera.zoom > 0.7){
            let xBlock = mouse.x, yBlock = mouse.y;
            if(e.altKey){
              /* Dragging an 'Event' */
              if(self.camera.prop.grabbed != undefined){
                self.camera.prop.grabbed.set(xBlock, yBlock);
                self.render(self.getMapContext(), true);
              }
            }else{
              let block  = self.camera.prop.block || 1;
              self.setBlock(xBlock, yBlock, self.current_map, block);
            }
          }
        }
      }
    }).on("wheel", function(e){
      e.preventDefault();
      if(self.event_freeze()){
        let i = e.pageX - $(this).offset().left;
        let j = e.pageY - $(this).offset().top;
        self.camera.alterZoom((e.originalEvent.deltaY > 0) ? 1.2 : 1/1.2, i, j);
        self.render(self.getMapContext(), true);
      }
    }).on("contextmenu", function(e){
      e.preventDefault();
      let zoom = self.camera.zoom;
      let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
      if(zoom > 0.7 && Utils.isObject(mouse)){
        self.camera.prop.rightclick = mouse;

        // TODO: Fix. Lets translate coords to the left top corner
        let i = $(this).offset().left + self.camera.x + (mouse.x + 1) * (16 * zoom);
        let j = $(this).offset().top + self.camera.y + (mouse.y - 1) * (16 * zoom);
        $("#map_contextmenu").show().css({"left": `${i}px`, "top": `${j}px`});
        let pick = self.current_map.findEvents(mouse.x, mouse.y, [0, 1, 2, 3]);

        // Hide all subpannels
        $(".map_contextmenu_subpannel").addClass("hide");
        /* Show Script Pannel */
        if(pick.length > 0){
          pick = pick[0];
          if(pick instanceof Overworld){
            $(".map_contextmenu_subpannel.Overworld_pannel input[name=range_vision]").prop("disabled", !pick.getTrainer());
          }else if(pick instanceof Signpost){

          }
          let pannel = pick.constructor.name;
          $("#map_contextmenu_background > h3").text(`${pannel}  ${pick.getIndex()}`).removeClass("hide");
          if(pick.hasScript()){
            let script = Math.max(0, pick.getScriptOffset());
            $(".map_contextmenu_subpannel.Script_pannel").removeClass("hide");
            $(".input.script input").val(Utils.pad(script.toString(16).toUpperCase(), '0', 6));
          }

          $(`.map_contextmenu_subpannel.${pannel}_pannel, .panneloption.delete_event, .map_contextmenu_subpannel.showAlways`).removeClass("hide");
          self.camera.prop.grabbed = pick;
          Object.getOwnPropertyNames(pick).forEach(e=>{
            if(e !== "script"){
              let input = $(`.map_contextmenu_subpannel .input input[name=${e}], select[name=${e}]`);
              if(input.length > 0){
                input.val(pick[e]);
              }
            }
          });

        }else{
          $("#pannelbackground > h3").addClass("hide");
          $(".panneloption.delete_event").addClass("hide");
        }
      }else{
        $("#map_contextmenu").hide();
      }
    }).on("dblclick", function(e){
      e.preventDefault();
      e.stopPropagation();
      if(self.event_freeze()){
        let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
        if(Utils.isObject(mouse)){
          let xBlock = mouse.x, yBlock = mouse.y;
          if(e.altKey){
            let pick = self.current_map.findEvents(xBlock, yBlock, [0, 1, 2, 3]);
            if(pick.length > 0){
              pick = pick[0];
              if(pick instanceof Warp){
                self.change_map(pick.getBankIndex(), pick.getMapIndex());
              }else if(pick.hasScript()){
                let script = pick.getScriptOffset();
                if(self.reader.isROMOffset(script)){
                  self.reader.codeResult(script);
                }
              }
              self.camera.prop.grabbed = pick;
            }
          }
        }else if(e.altKey){
          let dx = e.pageX - $(this).offset().left;
          let dy = e.pageY - $(this).offset().top;
          let map = self.neighbourhood(dx, dy);
          if(!!map){
            self.change_map(map.getBankIndex(), map.getMapIndex());
          }
        }
      }
    });


    $("#map_contextmenu_close").click(()=>$("#map_contextmenu").hide());
    $("#map_contextmenu .subpannel input, select").bind('keyup mouseup', function(){
      let selected = self.camera.prop.grabbed;
      let value = parseInt($(this).val(), $(this).parent().hasClass("script") ? 16 : 10);
      let inputName = $(this).attr("name");
      selected[inputName] = value;
      switch (inputName){
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
          self.render(self.getMapContext(), true);
        break;
      }
    });

    $("#blocks_map").on("mousedown", function(e){
      e.preventDefault();
      let x = e.pageX - $(this).offset().left;
      let y = e.pageY - $(this).offset().top;
      x >>= 4;
      y >>= 4;
      let x_padding = $(this).offset().left - $(this).parent().offset().left;
      let y_padding = $(this).offset().top - $(this).parent().offset().top + $(this).parent().scrollTop();
      $("#selected_block").css({ "left": ((x << 4) + x_padding) + "px", "top": ((y << 4) + y_padding) + "px" });
      let limitY = self.block_buffer[self.current_map.getBlocksIndex(0)].totalBlocks >> 3;
      if(y >= limitY){ y += Math.max(0x40, limitY) - limitY; }
      self.camera.prop.block = x + (y * 8);
    });

    $("#map_contextmenu .option").click(function(){
      if($(this).hasClass("delete_event")){
        let type = parseInt($("#pannelbackground > input[name=type]").val());
        let index = parseInt($("#pannelbackground > input[name=index]").val());
        self.removeEvent(type, index);
      }else if($(this).hasClass("add_event")){
        let value = $("#addevent").data("value");
        let rightclick = self.camera.prop.rightclick;
        if(value != undefined){
          self.current_map.addEvent(rightclick.x, rightclick.y, parseInt(value));
        }
      }
      self.render(self.getMapContext(), true);
      $("#map_contextmenu").hide();
    });

    $(".map_tool").click(function(){
      if($(this).hasClass("selected")){
        let sequence = $(this).attr("data-type");
        let first = parseInt(sequence.split('')[0]);
        let diff = parseInt($(this).data("current")) - first;
        let next = (first + (diff + 1) % sequence.length);
        $(this).data("current", next);
        self.mouse_type = next;
      }else{
        $(".map_tool.selected").removeClass("selected");
        $(this).addClass("selected");
      }
    });
  };
};
