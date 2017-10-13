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
  constructor(){
    /* Map Visualization Variables */
		this.camera = new Camera();
		this.is_being_draw = false;


    this.currentMap;
		this.height_color = [	[ 77, 210, 129], [166, 224, 114], [235, 111,  23], [236, 151,  35], [ 26, 213, 218],
													[239,  84,  84], [238, 217, 108], [ 66, 157, 236], [121, 110, 238], [154, 116, 238],
													[194, 124, 240], [227, 131, 239], [255, 255, 255]
												];
		this.height_level = document.createElement("canvas");

    /* Map buffer */
		this.maps_buffer 			= [];
    this.tileset_buffer   = [];
		this.palettes_buffer  = [];
    this.height_buffer    = [[/* Colored Blocks */],[/* Colored Tiles */]];
    this.blocks_buffer    = [];
		this.overworld_buffer = [];
  };

  /*
    Initialization
  */
  init(self){
    this.loadMapsFromMemory(self);
    this.loadOverworldSprites(self);
  };

  /* Loading content.
    From the offset found in memory, the algorithm takes chains of bytes
    and split it as necessary, each byte, short or pointer, is information about
    tilesets, entities, ...
    TODO:
		let left = `<div class='bank_option'> <div class='bank_name'>Bank ${i}</div>`;
    left +=`<div class="header_map">${j} ${mapName.replace("[FC]","")}</div>`;
  */
  loadMapsFromMemory(self){
    let header_map  = self.memoryOffsets.map_header;
		let total_banks = self.getTableSize(header_map);
		this.maps = new Array(total_banks);
		for(let b = 0; b < total_banks; b++){
			let type 				= self.isFRLG();
			let offset 			= self.getPointer(header_map + b * 4);
			let nextoffset 	= self.getPointer(header_map + (b + 1) * 4);
			if(nextoffset < offset) nextoffset = header_map;


			let total_maps = self.getTableSize(offset, nextoffset);
			this.maps[b] = new Array(total_maps);
			for(let m = 0; m < total_maps; m++){
				let header_pointer = self.getPointer(offset + m * 4);
				let map_pointer = self.getPointer(header);

        let map = new Map();

				let name_displacement = 4 * ((2 - type) * (self.getByte(header + 20) - 88 * type) + 1 - type);
				let name_pointer = self.getPointer(self.memoryOffsets[`map_name_${(this.isFRLG()|0)}`] + name_displacement);
        map.setMapName(self.getTextByOffset(self.getDictionary("Text"), toOffset(name_pointer)));
        map.setMapOffset(name_pointer);
        map.setScriptPointer(self.getPointer(header + 8));
        //map.setBorderOffset(self.getPointer(map + 8));
        //border_width: self.getByte(map + 24), // (??)
        //border_height: self.getByte(map + 25), // (??)
        this.maps[i][j] = {
					header: header,
					structure: structure,
					palette: palettes, // Pointers to map blocks
					tileset: tilesets, // Pointers to map blocks
					music: self.getShort(header + 16), // Music index
					index: self.getShort(header + 18), // Name table index (??)
					visibility: self.getByte(header + 21), // Effect when showing map name
					wheather: self.getByte(header + 22), // Wheather in map
					type: self.getByte(header + 23), // (??)
					title: self.getByte(header + 26), // (??)
					wildpokemon: self.getByte(header + 27), // Pointer to wild pokémon
					width: structure[0].length * 16,
					height: structure.length * 16
				};


				/* Creating map blocks structure. */
				let wmap = self.getPointer(map);
				let hmap = self.getPointer(map + 4);
        map.resize(wmap, hmap);
				let structOffset = self.getPointer(map + 12);
        map.setStructureOffset(structOffset);
				let structure = new Array(hmap);
				for(let j = 0; j < hmap; j++){
					for(let i = 0; i < wmap; i++){
						map.setBlock(i, j, self.getShort(structOffset + (j * wmap + i) * 2));
					}
				}

				/* Reading and Adding all Connections to buffer */
				let connection = self.getPointer(header + 12);
        map.connectionPointer(connection);
				if(connection != 0x0){
					let total = self.getPointer(connection);
					let pconn = self.getPointer(connection + 4);
					for(let c = 0; c < total; c++){
            let connection = new Connection(self.getPointer(pconn), self.getPointer(pconn + 4), self.getByte(pconn + 8), self.getByte(pconn + 9));
						map.setConnection(c, connection);
						pconn += 12;
					}
				}

				/* Events in map */
				let pointer_events = self.getPointer(header + 4);
        // Adding Overworlds
				let firstperson = self.getPointer(pointer_events + 4);
				let lastperson = firstperson + self.getByte(pointer_events) * 24;
				for(let i = firstperson; i < lastperson; i += 24){
          let overworld = new Overworld(self.getShort(i + 4), self.getShort(i + 6), self.getByte(i + 8));
          overworld.setSpriteIndex(self.getByte(i + 1));
          overworld.setMovement(self.getByte(i + 9));
          overworld.setMovementRadius(self.getByte(i + 10));
          overworld.setTrainer(self.getByte(i + 12));
          overworld.setRangeVision(self.getShort(i + 14));
          overworld.setScriptOffset(self.getPointer(i + 16));
          overworld.setStatus(self.getShort(i + 20));
          map.setEntity(0, self.getByte(i) - 1, overworld);
				}
				// Adding Warps
				let firstwarp = self.getPointer(pointer_events + 8);
				let lastwarp = firstwarp + self.getByte(pointer_events + 1) * 8;
				for(let i = firstwarp; i < lastwarp; i += 8){
          let warp = new Warp(self.getShort(i), self.getShort(i + 2), self.getShort(i + 4));
          warp.setWarpIndex(self.getByte(i + 5));
          warp.setBankIndex(self.getByte(i + 6));
          warp.setMapIndex(self.getByte(i + 7));
          map.setEntity(1, (i - firstwarp) / 16, warp);
				}
        // Adding Scripts
				let firstscript = self.getPointer(pointer_events + 12);
				let lastscript = firstscript + self.getByte(pointer_events + 2) * 16;
				for(let i = firstscript; i < lastscript; i += 16){
          let script = new Script(self.getShort(i), self.getShort(i + 2), self.getByte(i + 4));
          script.setNumbet(self.getShort(i + 6));
          script.setValue(self.getByte(i + 8));
          script.setScript(self.getScriptOffset(i + 12));
          map.setEntity(2, (i - firstscript) / 16, script);
				}
        // Adding signpost
				let firstsignpost = self.getPointer(pointer_events + 16);
				let lastsignpost = firstsignpost + self.getByte(pointer_events + 3) * 12;
				for(let i = firstsignpost; i < lastsignpost; i += 12){
          let signpost = new Signpost(self.getShort(i), self.getShort(i + 2), self.getByte(i + 4));
          signpost.setSpecial(self.getPointer(i + 8));
          signposts.push(signpost);
          map.setEntity(3, (i - firstsignpost) / 16, signposts);
				}

				let palettes = [];
				let tilesets = [];
				let blocks = [];
				/* There are two tilesets in each map. */
				for(let i = 0; i < 2; i++){
					let offset = self.getPointer(map + 16 + 4 * i);

					/* Obtaning the palettes from the tilesets. */
					let primary = self.getByte(offset + 1); /* Primary tileset [Byte] */
					let palette = self.getPointer(offset + 8) + 0x20 * (6 + self.isFRLG()) * primary; /* Palette Offset */
					if(self.bufferMemory[palette] === undefined){
						self.bufferMemory[palette] = this.loadTilesetPalettes(palette, primary);
					}
					palettes[primary] = palette;

					/* Obtaning blocks. */
					let blocksPointer = self.getPointer(offset + 12);
					let endBlocks			= type ? self.getPointer(offset + 20) : self.getPointer(offset + 16);
					if(self.bufferMemory[blocksPointer] == null){
						let realBlocks 	= (endBlocks - blocksPointer) >> 4;
						let totalBlocks = Math.max(0x200, realBlocks);
						let dataBlocks = new Array(totalBlocks);
						for(let b = 0; b < totalBlocks; b++){
							dataBlocks[b] = new Array(8);
							for(let o = 0; o < 8; o++){
								let att = this.getShort(blocksPointer + (b<<4) + (o<<1));
								dataBlocks[b][o] = att;
							}
						}
						self.bufferMemory[blocksPointer] = [{blocks: dataBlocks, totalBlocks: realBlocks}];
					}
					blocks[i] = blocksPointer;

					/* Creating tile blocks. */
					let image = self.getPointer(offset + 4);
					let tileset = self.bufferMemory[image];
					if(tileset == null){
						let tiles;
						if(self.getByte(image)){/* Compression byte. */
							let totalunCompressed = self.getByte(image + 1)<<1|self.getByte(image + 2)<<9|self.getByte(image + 3)<<17;
							tiles = Decompression.LZSS_Decompress(self.memoryRom.slice(image + 4, image + 4 + totalunCompressed), 0x8000);
						}else{
							tiles = Decompression.GBA_Decompress(self.memoryRom.slice(image, image + 0x4000));
						}
						self.bufferMemory[image] = tiles;
					}
					tilesets[i] = image;
				}
			}
			$("#map_headers").append(`${left}</div>`);
		}
	};

  loadOverworldSprites(self){
		let sprites = [];
		let index = 0;

		/* Obtaning Sprites paletes. */
		let palettes = [];
		let paletteOffset = self.memoryOffsets.sprite_palette;
		let byte = self.getByte(paletteOffset + 3);
		while(self.isROMPointer(byte)){
			palettes[self.getByte(paletteOffset + 4)] = this.loadPalettes(self.getPointer(paletteOffset));
			byte = self.getByte((paletteOffset += 8) + 3);
		}

		/* Passing through every sprite. */
		let offset = self.memoryOffsets.sprite_header;
		while(self.isROMPointer(self.getByte(offset + 3))){
			let pointer = self.getPointer(offset);
			if(self.getShort(pointer) == 0xFFFF){
				let texture = self.getPointer(pointer + 28);
				if(self.isROMPointer(self.getByte(texture + 3))){
          let dec_position = self.getPointer(texture);
					let decompression = Decompression.GBA_Decompress(self.memoryRom.slice(dec_position, dec_position + self.getShort(texture + 4)));
					let palette = palettes[self.getByte(pointer + 2)];

					let previewCanvas = document.createElement("canvas");
					let width 	= previewCanvas.width 	= self.getShort(pointer + 8);
					let height 	= previewCanvas.height 	= self.getShort(pointer + 10);
					let previewCanvasCtx = previewCanvas.getContext("2d");

					/* Drawing Sprite Algorithm. */
					let mask = previewCanvasCtx.createImageData(width, height);
					for(let j = 0; j < height; j += 8){
						for(let i = 0; i < width; i += 8){
							for(let h = 0; h < 8; h++){
								for(let w = 0; w < 8; w++){
									let pixel = decompression[j * width + ((i + h) << 3) + w];
									if(pixel != 0){
										let color = palette[pixel];
										let id = ((j + h) * width + i + w) * 4;
										mask.data[id + 0] = (color >> 16) & 0xff;
										mask.data[id + 1] = (color >> 8) & 0xff;
										mask.data[id + 2] = color & 0xff;
										mask.data[id + 3] = 255;
									}
								}
							}
						}
					}
					previewCanvasCtx.putImageData(mask, 0, 0);

					sprites.push({
						sprite: previewCanvas,
						synch: self.getShort(pointer + 6),
						slot: selfgetByte(pointer + 12),
						overwrite: self.getByte(pointer + 13),
						empty: self.getShort(pointer + 14),
						distribution: self.getPointer(pointer + 16),
						sizedraw: self.getPointer(pointer + 20),
						shiftdraw: self.getPointer(pointer + 24),
						ram: self.getPointer(pointer + 32),
						ud1: self.getShort(texture + 6)
					});
				}
			}
			offset += 4;
		}
		this.overworldSprites = sprites;
	};


  /* Paletes Methods
    Each palette contains 16 colors, these colors are made from two bytes (16 bits)
    compressed into gba color.
    Tilesets have 13 palettes:
    RSE 0-5 Primary palettes 6-12 Secondary palettes
    FL  0-6 Primary palettes 7-12 Secondary palettes
  */
  loadPalettes(offset){return(new Array(16).fill(0).map((a,b)=>Color.gba2hex(this.getShort(offset + b * 2))));};
  loadTilesetPalettes(offset, primary){return [].concat(...(new Array(0x6|(primary^this.isFRLG())).fill(0).map((a,b)=>this.loadPalettes(offset + b * 32))))};

  /*
    Getter / Setter
  */
  getMap(bank, map){ return (this.maps[bank] != undefined && this.maps[bank][map] != undefined) ? this.maps[bank][map] : undefined; };
  getEvents(i, j, e){
    let all = e instanceof Array ? e : [e];
    let found = [];
    all.forEach((a,m,b)=>{
        let events = this.currentMap.events[e[m]];
        events.forEach((c,k,d)=>{
          let event = events[k];
          if(event != undefined){
            if(event.x == i && event.y == j){
              found.push({index: k, type: m, event: event});
            }
          }
        });
    });
    return found;
  };

  /*
    Add / Remove
  */
  removeEvent(a, b){ this.currentMap.events[a].splice(b, 1); };
  addEvent(x, y, z){
    let event;
    switch(z){
      case 0: event = new Person(x, y, 0);  break;
      case 1: event = new Warp(x, y, 0);    break;
      case 2: event = new Script(x, y, 0);  break;
      case 3: event = new Signpost(x, y, 0);break;
      default: event = null;
    }
    if(Utils.isObject(event)){
      this.currentMap.events[t].push(event);
    }
  };

	changeMap(bank, mapNumber){
		if(this.maps[bank] != undefined){
			let map = this.currentMap = this.maps[bank][mapNumber];
			let header_html = $(".bank_option:eq(" + bank + ")");
			if(!header_html.hasClass("open")){
				$(".bank_option.open").removeClass("open");
				header_html.addClass("open");
			}
			$(".header_map.current").removeClass("current");
			let map_html = header_html.find(`.header_map:eq(${mapNumber})`);
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
			this.camera.set((this.camera.width - map.width) / 2, (this.camera.height - map.height) / 2);

			let ctx = this.getMapContext();
			ctx.webkitImageSmoothingEnabled = false;
			ctx.mozImageSmoothingEnabled = false;
			ctx.imageSmoothingEnabled = false;

			this.height_level.setAttribute("id", "height_level_new");
			this.getMapPreview(map);
			this.drawTilesetMap($("#blocks_map")[0], map);

			this.render_map(ctx);
		}
	};

  neighbourhood(x, y){
		let nextMapsToDraw = [];
		let alreadyDrawnMaps = new Set();

		nextMapsToDraw.push({ map: this.currentMap, x: 0, y: 0 });
		alreadyDrawnMaps.add(this.currentMap.header);

		while(nextMapsToDraw.length > 0){
			let mapToDraw = nextMapsToDraw.shift();

			if(Utils.isObject(x)){
				let zoom = this.camera.zoom;

				let map_width = mapToDraw.map.width;
				let map_height = mapToDraw.map.height;
				let dx = this.camera.x + (mapToDraw.x + map_width) * zoom;
				let dy = this.camera.y + (mapToDraw.y + map_height) * zoom;
				let cx = dx - map_width * zoom;
				let cy = dy - map_height * zoom;
				// Draw map name if this is not the current map.
				if((dx > 0 && cx < this.camera.width) && (dy > 0 && cy < this.camera.height) && mapToDraw.map != this.currentMap){
					x.drawImage(this.getMapPreview(mapToDraw.map), mapToDraw.x, mapToDraw.y);
					let mapname = mapToDraw.map.name;// + " [" + connection.bank + ", " + connection.map + "]";
					let xText = mapToDraw.x + (map_width>>1) - mapname.length * 8;
					let yText = mapToDraw.y + (map_height>>1) + 10;
					//* BLACK RECTANGLE TODO: Change it to the 'Sign Background' *//
					x.beginPath();
					x.fillStyle = "rgba(10, 10, 10, 0.7)";
					x.rect(xText - 20, yText - 40, mapname.length * 24, 60);
					x.fill();

					/* DISPLAY NAME TODO: USE POKEMON FONT TO SHOW THE NAME */
					x.font = "bold 30px Arial";
					x.fillStyle = "white";
					x.fillText(mapname, xText, yText);
				}
			}

			// Load next connections.
			let connections = mapToDraw.map.connection;
			for(let c = 0; c < connections.length; c++){
				let connection = connections[c];

				// Don't draw emerge/submerge connections.
				if(connection.direction > 0x0 && connection.direction < 0x5){
					let map = this.getMap(connection.bank, connection.map);
					if(map != undefined){
						let h = Math.floor(connection.direction/3);
						let o = 16 * connection.offset;
						let m = h * ((connection.direction%2) * -map.width + (connection.direction == 4) * (mapToDraw.map.width)) + (1 - h) * o;
						let n = (1-h)*(((connection.direction+1)%2) * -map.height + (connection.direction == 1) * mapToDraw.map.height) + h * o;

						if (!alreadyDrawnMaps.has(map.header)){
							if(!Utils.isObject(x)){
								let zoom = this.camera.zoom;
								let canvas = $("#canvas_map");
								let dx = (x - this.camera.x)/zoom - (mapToDraw.x + m);
								let dy = (y - this.camera.y)/zoom - (mapToDraw.y + n);
								if(dx >= 0 && dy >= 0 && dx <= map.width && dy <= map.height){ return connection; }
							}

							nextMapsToDraw.push({ map: map, x: mapToDraw.x + m, y: mapToDraw.y + n });
							alreadyDrawnMaps.add(map.header);
						}
					}
				}
			}
		}

		if(Utils.isObject(x)){
			x.drawImage(this.currentMap.preview, 0, 0);

			let map_width = this.currentMap.width;
			let map_height = this.currentMap.height;
			x.beginPath();
			x.rect(-2, -2, map_width + 3, map_height + 3);
			x.strokeStyle = "red";
			x.lineWidth = 3;
			x.stroke();
			if(this.height_level.getAttribute("id") == "height_level_new"){
				let date = new Date().getTime();
				this.height_level.setAttribute("id", "height_level_created");
				this.height_level.width = map_width;
				this.height_level.height = map_height;
				let context = this.height_level.getContext("2d");
				let structure = this.currentMap.structure;
				let structure_width = structure[0].length;
				let structure_height = structure.length;
				for(let j = 0; j < structure_height; j++){
					for(let i = 0; i < structure_width; i++){
						let actual = this.currentMap.structure[j][i]>>10;
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
		}
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

  getGfxBlocks(offset, tileset, palettes){
		if(this.bufferMemory[offset][1] == undefined){
			let blocks = this.bufferMemory[offset][0];
			this.bufferMemory[offset][1] = new Array(blocks.totalBlocks);
			for(let j = 0; j < blocks.totalBlocks; j++){
				let block = document.createElement("canvas");
				let size = block.width = block.height = 16;
				let ctx = block.getContext("2d");
				let img = ctx.createImageData(size, size);

				// 4 layers foreground + 4 layers background = 8 tiles = 1 block
				for(let b = 0; b < 8; b++){
					let section = blocks.blocks[j][b];
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
								//RGB((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff)
								img.data[id + 0] = (color >> 16) & 0xff; //indx + pixel;
								img.data[id + 1] = (color >> 8) & 0xff;
								img.data[id + 2] = color & 0xff;
								img.data[id + 3] = 255;
							}
						}
					}
				}
				ctx.putImageData(img, 0, 0);
				this.bufferMemory[offset][1][j] = block;
			}
		}
	};

  getMapPreview(map){
		if(map.preview == undefined){
			/* create block set for the map */
			let tileset = this.bufferMemory[map.tileset[0]].concat(this.bufferMemory[map.tileset[1]]);
			let palettes = this.bufferMemory[map.palette[0]].concat(this.bufferMemory[map.palette[1]]);
			this.getGfxBlocks(map.block[0], tileset, palettes);
			this.getGfxBlocks(map.block[1], tileset, palettes);

			let previewCanvas = document.createElement("canvas");
			let twidth, theight;
			previewCanvas.width 	= (twidth 	= map.structure[0].length) * 16;
			previewCanvas.height 	= (theight 	= map.structure.length) * 16;
			let previewCanvasCtx = previewCanvas.getContext("2d");

			for(let j = 0; j < theight; j++){
				for(let i = 0; i < twidth; i++){
					this.drawBlock(previewCanvasCtx, i, j, map, map.structure[j][i]&0x3ff);
				}
			}
			map.preview = previewCanvas;
		}

		return map.preview;
	};

  mouseToMapCoordinates(map, x, y){
		let camera = this.camera, zoom = camera.zoom;
		let mapwidth = this.currentMap.width * zoom, mapheight = this.currentMap.height * zoom;
		let xMouse = x - map.offset().left - camera.x;
		let yMouse = y - map.offset().top - camera.y;
		if(xMouse >= 0 && xMouse < mapwidth && yMouse >= 0 && yMouse < mapheight){
			return {x: Math.floor(xMouse/(16 * zoom)), y: Math.floor(yMouse/(16 * zoom))};
		}else{
			return false;
		}
	};

  // Render map.
	render_map(ctx){
		this.is_being_draw = false;
		let camera_width = this.camera.width;
		let camera_height = this.camera.height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, camera_width, camera_height);

		let xCamera = Math.round(this.camera.x);
		let yCamera = Math.round(this.camera.y);
		ctx.setTransform(this.camera.zoom, 0, 0, this.camera.zoom, xCamera, yCamera);

		/* Drawing */
		this.neighbourhood(ctx);

		if(this.camera.zoom > 0.7){
			let colorEvent = [0x33cc00, 0x440044, 0x33ffff, 0xff00ff];
			for(let k = 0; k < 4; k++){
				let color 	= colorEvent[k];
				let events 	= this.currentMap.events[k];
				for(let i = 0; i < events.length; i++){
					let e = events[i];
					if(e != undefined){
						let x = (e.x << 4);
						let y = (e.y << 4);

						ctx.beginPath();
						ctx.rect(x, y, 16, 16);
						ctx.lineWidth = 1;
						ctx.strokeStyle = "#" + color.toString(16);
						ctx.stroke();
					}
				}
			}

			let entities = this.currentMap.events[0];
			for(let k = 0; k < entities.length; k++){
				let entity = entities[k];
				if(entity != undefined){
					let sprite = this.overworldSprites[entity.picture];
					if(sprite != undefined){
						sprite = sprite.sprite;
						let xSprite = (entity.x + 0.5) * 16 - (sprite.width>>1);
						let ySprite = (entity.y + 1) * 16 - sprite.height;
						ctx.drawImage(sprite, xSprite, ySprite);
					}
				}
			}
		}
		this.camera.update(this);
		if(this.is_being_draw){
			requestAnimationFrame(()=>this.render_map(ctx));
		}
	};

  /*
		Tileset Methods.
	*/
	setBlock(x, y, map, block, re_draw){
		if((map.structure[y][x]&0x3ff) != block){
			map.structure[y][x] = block;
			let ctx = map.preview.getContext("2d");
			this.drawBlock(ctx, x, y, map, block);
			if(!this.is_being_draw){
				this.render_map(this.getMapContext());
			}
		}
	};

	drawBlock(ctx, x, y, map, block){
		let blocks = this.bufferMemory[map.block[0]];
		if(block >= blocks[0].totalBlocks){
			block -= 0x200;
			blocks = this.bufferMemory[map.block[1]];
		}
		if(block < blocks[0].totalBlocks){
			ctx.drawImage(blocks[1][block], x * 16, y * 16);
		}
	};

	drawTilesetMap(canvas, map){
		let total = [Math.ceil(this.bufferMemory[map.block[0]][0].totalBlocks / 8),
									Math.ceil(this.bufferMemory[map.block[1]][0].totalBlocks / 8)];
		canvas.width	= 128;
		canvas.height = (total[0] + total[1])*16;
		let ctx = canvas.getContext("2d");
		for(let m = 0; m < 2; m++){
			for(let k = 0; k < total[m]; k++){
				for(let i = 0; i < 8; i++){
					this.drawBlock(ctx, i, k + total[0] * m, map, k * 8 + i + 0x200 * m);
				}
			}
		}
	};


  initEvents(){
    $(".bank_name").click(function(){
      if(!$(this).parent().hasClass("open")){
        $(".bank_option.open").removeClass("open");
      }
      $(this).parent().toggleClass("open");
    });

    $(".header_map").on("click", function(e){
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
                self.setBlock(xBlock, yBlock, self.currentMap, block);
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
            self.render_map(self.getMapContext());
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
              self.render_map(self.getMapContext());
            }
          }else if(Utils.isObject(mouse) && self.camera.zoom > 0.7){
            let xBlock = mouse.x, yBlock = mouse.y;
            if(e.altKey){
              /* Dragging an 'Event' */
              if(self.camera.properties.grabbed != undefined){
                self.camera.properties.grabbed.x = xBlock;
                self.camera.properties.grabbed.y = yBlock;
                self.render_map(self.getMapContext());
              }
            }else{
              let block  = self.camera.properties.block || 1;
              self.setBlock(xBlock, yBlock, self.currentMap, block);
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
        self.render_map(self.getMapContext());
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
                $(".base_pannel input[name=base]").val(pick.event.special&0xff);
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
          self.render_map(self.getMapContext());
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
        let limitY = (self.bufferMemory[self.currentMap.block[0]][0].totalBlocks)>>3;
        $("#selected_block").css({ "left": ((xBlock << 4) + 12) + "px", "top": (yBlock << 4) + "px" });
        if(yBlock >= limitY){
          yBlock += Math.max(0x40, limitY) - limitY;
        }
        self.camera.properties.block = xBlock + (yBlock<<3);
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
      self.render_map(self.getMapContext());
    });

    /* Creating all events. */
    let self = this;
    $("body").mousedown(function(e){
      self.click = {down: true, x: e.pageX, y: e.pageY};
    }).mouseup(function(e){
      self.click.down = false;
      $(".grabbing").removeClass("grabbing");
      self.camera.properties.map = undefined;
    });
  };
};
