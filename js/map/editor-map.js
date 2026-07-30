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


const EVENT = {
  CURSOR_MOVE: 0,
  EVENT_MOVE: 1,
  CAMERA_MOVE: 2,
  EVENT_OPTION: 3,
  EVENT_IN: 4,
  BLOCK_PICKER: 5,
  BLOCK_FILLER: 6,
  ZOOM_OUT: 7,
  ZOOM_IN: 8,
  LAYERS: MapLayerModes.ALL,
  LAYER_TOP: MapLayerModes.MAP,
  LAYER_MID: MapLayerModes.EVENTS,
  LAYER_BOT: MapLayerModes.COLLISION,
  SELECTION: 13,
  GRID: 14,
  NO_GRID: 15
};

class EMap{
  constructor(self){
    this.scope=new EventScope();this.destroyed=false;this.animationFrame=null;this.layoutWriter=new MapLayoutWriter(self.memory);
    /* Map Visualization Variables */
		/* Events Variables */
		this.mouse = {down: false, x: 0, y: 0};

    this.hover_block = {x: null, y: null};
    this.selected_block = 0;
    this.selected_event = null;
    this.layerMode = EVENT.LAYERS;
    this.showGrid = false;
    this.selections = [];
    this.activeSelection = null;
    this.activeBlockGroup = 0;
    this.collisionSelection = null;

		this.camera = new Camera();
		this.is_camera_moving = false;
		this.banks = undefined;

    this.context_map = document.getElementById("canvas_map").getContext("2d");
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
    this.overworld_palette_offsets = [];

    this.reader = self;
    this.structureWriter = new StructureWriter(self.memory);
    this.eventTableWriter = new GbaEventTableWriter(self.memory);
    this.connectionTableWriter = new GbaConnectionTableWriter(self.memory);
    this.context = null;

    this.height_image = [[], []];

    document.addEventListener("romgraphicschange",event=>{
      if(event.detail?.palette){this.overworld_palette_buffer=[];this.overworld_palette_offsets=[];this.loadOverworldPalettes();}
      const offsets=event.detail?.offsets||[],tilesetChanged=this.tileset_buffer.some(tileset=>{
        if(tileset.compressed||!offsets.some(offset=>offset>=tileset.offset&&offset<tileset.offset+0x4000))return false;
        tileset.memory=this.decode4bppRange(tileset.offset);return true;
      });
      if(tilesetChanged)this.block_buffer.forEach(blocks=>{blocks.images=[];});
      this.overworld_sprite_buffer=[];
      if(this.current_map){this.current_map.preview=undefined;this.render(this.getMapContext(),true);}
    },this.scope.options);

    /* Events */
    document.querySelectorAll(".window_menu").forEach((menu) => {
      menu.addEventListener("mousedown", () => {
        RomEditor.window_dragging = menu.parentElement;
      },this.scope.options);
    });
  };

  event_freeze(){
    const contextMenu = document.getElementById("map_contextmenu");
    return (getComputedStyle(contextMenu).display === "none" && this.reader.window_dragging === undefined);
  };
  /*
    Getter / Setter
  */
  getMapContext(){ return this.context_map; };
  getBlockBuffer(_i){ return this.block_buffer[_i].memory; };
  getPaletteBuffer(_i){ return this.palette_buffer[_i].memory; };
  getTilesetBuffer(_i){ return this.tileset_buffer[_i].memory; };
  navigateToMap(bank,map){
    if(this.current_map?.getBankIndex()===bank&&this.current_map?.getMapIndex()===map)return Promise.resolve(false);
    return this.editor.navigate(()=>this.change_map(bank,map));
  }

  /*
    Optimization done:
    After this optimization we loaded all sprites from memory into buffer, now
    we only store into buffer all sprite in the current map.
    Loading all sprites from memory took 80ms.
  */
  getOverworldSprite(_i,direction="south",frameIndex=null,forceFlip=null){
    const facing=PokemonViewer.maps.movement.frame(direction,false,0,"gba"),imageIndex=frameIndex??facing.index,flip=forceFlip??facing.flipX,key=`${_i}:${imageIndex}:${flip}`;
    let sprite = this.overworld_sprite_buffer[key];
    if(sprite === undefined){
      let self = this.reader;
      let sprite_header = self.memoryOffsets.sprite_header;
      let sprite_pointer = self.getOffset(sprite_header + 4 * _i);
      let images = self.getOffset(sprite_pointer + 28),texture=images+imageIndex*8;
      let dec_position = self.getOffset(texture);
      let overworldcanvas,sprite_decompress,palette,paletteSlot,overworld_width,overworld_height;
			if(self.isROMOffset(dec_position)){
        const byteLength=self.getShort(texture+4);
        if(!byteLength||byteLength%GbaSpriteCodec.bytesPerTile)throw new RangeError("The GBA overworld frame is not tile-aligned.");
        const tiles=byteLength/GbaSpriteCodec.bytesPerTile;
        sprite_decompress=new Uint8Array(tiles*64);
        for(let tile=0;tile<tiles;tile++)sprite_decompress.set(GbaSpriteCodec.decodeTile(self.memory,dec_position+tile*GbaSpriteCodec.bytesPerTile),tile*64);
				paletteSlot=self.getByte(sprite_pointer + 2);palette = this.overworld_palette_buffer[paletteSlot];
        overworldcanvas = document.createElement("canvas");
				overworld_width 	= overworldcanvas.width 	= self.getShort(sprite_pointer + 8);
				overworld_height 	= overworldcanvas.height 	= self.getShort(sprite_pointer + 10);
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
				if(flip){const mirrored=document.createElement("canvas");mirrored.width=overworld_width;mirrored.height=overworld_height;mirrored.getContext("2d").drawImage(overworldcanvas,overworld_width,0,-overworld_width,overworld_height);overworldcanvas=mirrored;}
			}
      this.overworld_sprite_buffer[key] = sprite = {
        sprite: overworldcanvas,
        data: sprite_decompress,
        palette,
        paletteOffset:this.overworld_palette_offsets[paletteSlot],
        offset: dec_position,
        byteLength: self.getShort(texture + 4),
        width: overworld_width,
        height: overworld_height,
        synch: self.getShort(sprite_pointer + 6),
        slot: self.getByte(sprite_pointer + 12),
        overwrite: self.getByte(sprite_pointer + 13),
        empty: self.getShort(sprite_pointer + 14),
        /*distribution: self.getOffset(sprite_pointer + 16),
        sizedraw: self.getOffset(sprite_pointer + 20),
        shiftdraw: self.getOffset(sprite_pointer + 24),*/
        ram: self.getOffset(sprite_pointer + 32)
      };
      if(imageIndex===0&&!flip)this.overworld_sprite_buffer[_i]=sprite;
    }
    return sprite.sprite;
  };
  pack4bpp(pixels){
    const bytes=new Uint8Array(Math.ceil(pixels.length/2));
    for(let index=0;index<bytes.length;index++)bytes[index]=(pixels[index*2]&0xf)|((pixels[index*2+1]??0)&0xf)<<4;
    return bytes;
  };
  openSprite(data){EditorLinks.sprite(data);}
  getBlocks(_i){ return this.block_buffer[_i]; };
  getBlockSprite(_i, _b){ return this.block_buffer[_i].images[_b]; };
  getCamera(){ return this.camera; };
  decode4bppRange(offset,byteLength=0x4000){
    this.reader.memory.assertRange(offset,byteLength);
    const tiles=byteLength/GbaSpriteCodec.bytesPerTile,pixels=new Uint8Array(tiles*64);
    for(let tile=0;tile<tiles;tile++)pixels.set(GbaSpriteCodec.decodeTile(this.reader.memory,offset+tile*GbaSpriteCodec.bytesPerTile),tile*64);
    return Array.from(pixels);
  };
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
    this.workspace ||= new MapWorkspace(document.getElementById("map_editor"), "gba");
    this.createPatternWindow();
    try{
      this.regionMap=new PokemonViewer.maps.gba.RegionMap(this.reader);
      this.workspace.setRegionMap(this.regionMap,{onOpen:entry=>{
        const destination=this.banks.flatMap(bank=>bank.maps).find(map=>this.regionMap.sectionForMap(map)===entry.id);
        if(destination){
          if(destination===this.current_map){this.focusMap(destination);this.render(this.getMapContext(),true);return true;}
          return this.navigateToMap(destination.getBankIndex(),destination.getMapIndex());
        }
        else NotificationHandler.pop("Minimap",`${entry.name} has no outdoor map header in the loaded ROM.`,NotificationType.ERROR);
        return false;
      }});
    }catch(error){
      this.regionMap=null;
      console.info("Minimap unavailable for this profile.",error);
    }
    this.appendHeaderMenu();
  };

  createPatternWindow(){
    this.patternCanvas=Dom.create("canvas",{className:"map-pattern-canvas",attributes:{width:"32",height:"32","aria-label":"Native repeated map border"}});
    this.patternCursor=Dom.create("span",{className:"map-pattern-cursor",attributes:{"aria-hidden":"true"}});
    this.patternSelection={x:0,y:0};
    this.patternSummary=Dom.create("p",{className:"map-pattern-summary"});
    this.patternCanvas.addEventListener("click",event=>{
      const map=this.current_map;if(!map)return;
      const rect=this.patternCanvas.getBoundingClientRect(),column=Math.min(map.getBorderWidth()-1,Math.max(0,Math.floor((event.clientX-rect.left)/rect.width*map.getBorderWidth()))),row=Math.min(map.getBorderHeight()-1,Math.max(0,Math.floor((event.clientY-rect.top)/rect.height*map.getBorderHeight())));
      this.patternSelection={x:column,y:row};this.positionPatternCursor();
      const block=MapBlockUtils.gbaIndex(this.reader.memory.u16(map.getBorderOffset()+(row*map.getBorderWidth()+column)*2));
      this.selectInWindowBlock(block);
    },this.scope.options);
    this.patternApply=UiWindow.button("Use selected block",{icon:"fa-stamp",size:"sm",onClick:()=>this.setBorderPatternCell(this.selected_block)});
    this.patternOpen=UiWindow.button("Open block",{icon:"fa-table-cells-large",size:"sm",onClick:()=>{
      const map=this.current_map;if(!map)return;
      const {x,y}=this.patternSelection,block=MapBlockUtils.gbaIndex(this.reader.memory.u16(map.getBorderOffset()+(y*map.getBorderWidth()+x)*2));
      this.selectInWindowBlock(block);
    }});
    this.patternPreview=Dom.create("div",{className:"map-pattern-preview map-pattern-preview--metatiles"},[this.patternCanvas,this.patternCursor]);
    this.workspace.windowManager.register({id:"pattern",title:"Border pattern",icon:"▦",position:{left:310,top:54,width:210},families:["gba"],content:[
      this.patternPreview,
      Dom.create("div",{className:"map-pattern-actions"},[this.patternApply,this.patternOpen]),this.patternSummary
    ]});
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
        let map = new RomMap(b, map_index);
        map.setHeaderOffset(header_pointer);
        map.setMapOffset(map_pointer);
        let name_displacement = 4 * ((2 - type) * (self.getByte(header_pointer + 20) - 88 * type) + 1 - type);
        let name_pointer = self.getOffset(self.memoryOffsets[`map_name_${type}`] + name_displacement);
        map.setMapNameOffset(name_pointer);
        map.setMapName(self.getTextByOffset(self.getDictionary(self.textDictionary), name_pointer));
        map.setMapNameEffect(self.getByte(header_pointer + 21));
        map.setScriptOffset(self.getOffset(header_pointer + 8));
        map.setMusic(self.getShort(header_pointer + 16));
        map.setWeather(self.getByte(header_pointer + 22));
        map.setMapType(self.getByte(header_pointer + 23));
        map.setPokemonOffset(self.getByte(header_pointer + 27)); // ?? Offset not Byte
        const layout=GbaMapLayout.read(self.memory,map_pointer,{frlg:self.isFRLG()});
        map.setBorderOffset(layout.border);
        map.setBorderSize(layout.borderWidth,layout.borderHeight);
        //title: self.getByte(header_pointer + 26), // (??)
        //index: self.getShort(header_pointer + 18), // Name table index (??)

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
            let connection = new RomConnection(self.getByte(c), self.memory.s32(c + 4), self.getByte(c + 8), self.getByte(c + 9));
            connection.sourceOffset=c;
  					map.setConnection((c - firstConnection) / 12, connection);
  				}
        }
				// Events in map
				let pointer_events = self.getOffset(header_pointer + 4);
        if(self.isROMOffset(pointer_events)){
          map.setEventsHeaderOffset(pointer_events);
          // Adding Overworlds
  				let firstperson = self.getOffset(pointer_events + 4);
          if(self.isROMOffset(firstperson)){
            map.setEntityOffset(0, firstperson);
    				let lastperson = firstperson + self.getByte(pointer_events) * 24;
    				for(let i = firstperson; i < lastperson; i += 24){
              let overworld_index = self.getByte(i)-1;
              let overworld = new Overworld(self.getShort(i + 4), self.getShort(i + 6), self.getByte(i + 8), overworld_index+1);
              overworld.sourceOffset = i;
              overworld.properties = GbaObjectEventTemplate.read(self.memory, i);
              overworld.setSpriteIndex(self.getByte(i + 1));
              overworld.setMovement(self.getByte(i + 9));
              overworld.setMovementRadius(self.getByte(i + 10));
              overworld.setTrainer(self.getShort(i + 12));
              overworld.setRangeVision(self.getShort(i + 14));
              overworld.setScriptOffset(self.getOffset(i + 16));
              overworld.setStatus(self.getShort(i + 20));
              map.setEntity(0, (i-firstperson)/24, overworld);
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
              warp.sourceOffset = i;
              warp.properties = GbaWarpEvent.read(self.memory, i);
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
              script.sourceOffset = i;
              script.properties = GbaCoordEvent.read(self.memory, i);
              script.setNumber(self.getShort(i + 6));
              script.setValue(self.getShort(i + 8));
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
              signpost.sourceOffset = i;
              signpost.properties = GbaBgEvent.read(self.memory, i);
              signpost.setType(self.getByte(i + 5));
              signpost.setSpecial(self.getOffset(i + 8));
              map.setEntity(3, signpost_index, signpost);
    				}
          }
        }
				// There are two tilesets in each map.
				for(let i = 0; i < 2; i++){
					let offset = self.getOffset(map_pointer + 16 + 4 * i);
          const tilesetHeader=self.readStructure("tilesetHeader",offset,{frlg:self.isFRLG()}),secondary=Number(tilesetHeader.isSecondary);

					/* Obtaning the palettes from the tilesets. */
					let palette_offset = tilesetHeader.palettes + 0x20 * (6 + self.isFRLG()) * secondary;
          let palette_index = this.getPaletteIndex(palette_offset);
					if(palette_index === -1){
            palette_index = this.palette_buffer.length;
						this.palette_buffer.push({offset: palette_offset, memory: this.getTilesetPalettes(palette_offset, secondary), primary: !tilesetHeader.isSecondary});
					}
          map.setPalettesIndex(i, palette_index);

					/* Obtaning blocks. */
					let block_offset = tilesetHeader.metatiles;
					let last_block_offset	= type ? tilesetHeader.callback : tilesetHeader.metatileAttributes;
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
					let tileset_offset = tilesetHeader.tiles;
          let tileset_index = this.getTilesetIndex(tileset_offset);
					if(tileset_index === -1){
						let tileset_decompress;
            let compressed = tilesetHeader.isCompressed;
						if(compressed){
							let totalunCompressed = self.getByte(tileset_offset + 1)<<1|self.getByte(tileset_offset + 2)<<9|self.getByte(tileset_offset + 3)<<17;
							tileset_decompress = Decompressor.LZSS_Decompress(self.ReadOnlyMemory.slice(tileset_offset + 4, tileset_offset + 4 + totalunCompressed), 0x8000);
						}else{
							tileset_decompress = this.decode4bppRange(tileset_offset);
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
      const slot=self.getByte(palette + 4),offset=self.getOffset(palette);
			this.overworld_palette_buffer[slot] = this.getPalettes(offset);
      this.overworld_palette_offsets[slot]=offset;
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
    this.bankAccordionGroup=UiAccordion.group(this.banks.map((bank,bankIndex)=>({
      title:`Bank ${bankIndex}`,icon:"fa-layer-group",badge:bank.maps.length,className:"bank_option",
      content:bank.maps.map((map,mapIndex)=>Dom.create("button",{
        className: "map_option",
        attributes:{type:"button"},
        dataset: {bank: bankIndex, map: mapIndex},
        text: `${mapIndex}. ${map.getMapName().replace("[FC]", "")}`
      }))
    })),{exclusive:true,label:"Map banks"});
    this.bankAccordionGroup.items.forEach(item=>{item.trigger.classList.add("bank_name");item.panel.classList.add("bank_maps");});
    this.workspace.setNavigation(this.bankAccordionGroup.element);
  };

  /* Paletes Methods
    Each palette contains 16 colors, these colors are made from two bytes (16 bits)
    compressed into gba color.
    Tilesets have 13 palettes:
    RSE 0-5 Primary palettes 6-12 Secondary palettes
    FL  0-6 Primary palettes 7-12 Secondary palettes
  */
  getPalettes(offset){return CoreUtils.range(16,index=>CoreUtils.bgr555ToHex(this.reader.getShort(offset+index*2)));};
  getTilesetPalettes(offset, secondary){return [].concat(...(new Array(0x6|(secondary^this.reader.isFRLG())).fill(0).map((a,b)=>this.getPalettes(offset + b * 32))))};

  /*
    Add / Remove Events
  */
  change_map(bank_number, map_number){
    let map = this.current_map;
    if(map === undefined || map.getBankIndex() !== bank_number || map.getMapIndex() !== map_number){
      let bank = this.banks[bank_number];
  		if(bank instanceof Bank){
  			map = bank.getMap(map_number);
        if(map instanceof RomMap){
          this.current_map = map;
          this.selections = [];
          this.activeSelection = null;
          const bankAccordion=this.bankAccordionGroup?.items[bank_number],bankElement=bankAccordion?.element;
          document.querySelector(".map_option.current")?.classList.remove("current");
          const mapElement=bankElement?.querySelectorAll(".map_option")[map_number];
          mapElement?.classList.add("current");
          bankAccordion?.reveal(mapElement);

          /* Focus the selected map while keeping connected maps renderable. */
          this.focusMap(map);

    			let ctx = this.getMapContext();
    			ctx.webkitImageSmoothingEnabled = false;
    			ctx.mozImageSmoothingEnabled = false;
    			ctx.imageSmoothingEnabled = false;

          this.render(ctx, true);
    			this.render_tileset(map);
          this.renderPatternWindow();
          this.renderDetails(map);
          this.workspace.setMapReference({bank:bank_number,map:map_number,title:map.getMapName()});
          this.workspace.renderRegionMap({sectionId:this.regionMap?.sectionForMap(map)});
        }
  		}
    }else{
      this.focusMap(map);
      this.render(this.getMapContext(),true);
      this.renderPatternWindow();
      this.renderDetails(map);
      this.workspace.setMapReference({bank:bank_number,map:map_number,title:map.getMapName()});
      this.workspace.renderRegionMap({sectionId:this.regionMap?.sectionForMap(map)});
    }
	};

  renderDetails(map=this.current_map){
    if(!map)return;
    const events=map.entities.flatMap((list,type)=>list.filter(Boolean).map((event,index)=>({type:["Object","Warp","Script","Signpost"][type],index:index+1,event})));
    const values={Map:map.getMapName(),Bank:map.getBankIndex(),Index:map.getMapIndex(),Size:`${map.getWidth()} × ${map.getHeight()}`,Music:map.getMusic(),Weather:map.getWeather(),"Map type":map.getMapType(),Header:`0x${map.getHeaderOffset().toString(16).toUpperCase()}`,Layout:`0x${map.getMapOffset().toString(16).toUpperCase()}`,Blocks:`0x${map.getStructureOffset().toString(16).toUpperCase()}`,Connections:map.getConnections().length};
    const actions=[UiWindow.button("Resize map",{icon:"↔",onClick:()=>this.editLayout()}),UiWindow.button("Connections",{icon:"⇄",onClick:()=>this.editConnections()})];
    const complexity=Object.fromEntries(["Bank","Index","Header","Layout","Blocks"].map(key=>[key,"advanced"]));
    this.workspace.renderProperties({title:map.getMapName(),values,complexity,actions,events,onEvent:record=>this.eventInspector.show(record.event,{x:record.event.getX(),y:record.event.getY()},this.context_map.canvas.clientWidth-320,80)});
  };

  borderPattern(map=this.current_map){
    if(!map||!this.reader.isROMOffset(map.getBorderOffset()))return null;
    const width=map.getBorderWidth(),height=map.getBorderHeight();
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>16||height>16)return null;
    this.reader.memory.assertRange(map.getBorderOffset(),width*height*2);
    if(map.preview===undefined)map.create_preview(this);
    const canvas=document.createElement("canvas");canvas.width=width*16;canvas.height=height*16;
    const context=canvas.getContext("2d");context.imageSmoothingEnabled=false;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const block=MapBlockUtils.gbaIndex(this.reader.memory.u16(map.getBorderOffset()+(y*width+x)*2));
      this.draw_block(context,map,x,y,block);
    }
    return canvas;
  };

  renderPatternWindow(){
    if(!this.patternCanvas)return;
    const pattern=this.borderPattern(),map=this.current_map,context=this.patternCanvas.getContext("2d");
    context.clearRect(0,0,this.patternCanvas.width,this.patternCanvas.height);
    if(!pattern||!map){this.patternApply.disabled=true;this.patternOpen.disabled=true;this.patternCursor.hidden=true;this.patternSummary.textContent="No verified border pattern is available for this map.";return;}
    this.patternCanvas.width=pattern.width;this.patternCanvas.height=pattern.height;
    context.imageSmoothingEnabled=false;context.drawImage(pattern,0,0);
    this.patternSelection.x=Math.min(this.patternSelection.x,map.getBorderWidth()-1);this.patternSelection.y=Math.min(this.patternSelection.y,map.getBorderHeight()-1);
    this.patternApply.disabled=false;this.patternOpen.disabled=false;this.patternCursor.hidden=false;this.positionPatternCursor();
    this.patternSummary.textContent=`Native ${map.getBorderWidth()} × ${map.getBorderHeight()} metatile pattern. Pick a cell, choose a block in Blocks, then apply it.`;
  };

  positionPatternCursor(){
    const map=this.current_map;if(!map||!this.patternCursor)return;
    const width=map.getBorderWidth(),height=map.getBorderHeight(),{x,y}=this.patternSelection;
    this.patternPreview?.style.setProperty("--pattern-columns",String(width));this.patternPreview?.style.setProperty("--pattern-rows",String(height));
    Object.assign(this.patternCursor.style,{left:`${x/width*100}%`,top:`${y/height*100}%`,width:`${100/width}%`,height:`${100/height}%`});
  };

  setBorderPatternCell(block){
    const map=this.current_map,{x,y}=this.patternSelection||{};if(!map||!Number.isInteger(block)||block<0||block>MapBlockUtils.GBA_INDEX_MASK||!Number.isInteger(x)||!Number.isInteger(y))return false;
    const offset=map.getBorderOffset()+(y*map.getBorderWidth()+x)*2,previous=this.reader.memory.u16(offset),next=MapBlockUtils.gbaWithIndex(previous,block);
    if(previous===next)return false;
    const apply=(expected,value)=>{
      MemoryUtils.replace(this.reader.memory,offset,MemoryUtils.valueBytes("u16",expected),MemoryUtils.valueBytes("u16",value),{message:"Map border changed after this command"});
      map.preview=undefined;this.renderPatternWindow();this.render(this.getMapContext(),true);
    };
    this.editor.execute({label:`Set border block (${x}, ${y})`,description:`0x${MapBlockUtils.gbaIndex(previous).toString(16).toUpperCase()} → 0x${block.toString(16).toUpperCase()}`,do:()=>apply(previous,next),undo:()=>apply(next,previous)});
    return true;
  };

  renderRepeatingPattern(ctx){
    const tile=this.borderPattern();if(!tile)return false;
    const pattern=ctx.createPattern(tile,"repeat");if(!pattern)return false;
    const zoom=Math.max(this.camera.zoom,.01),left=-this.camera.x/zoom,top=-this.camera.y/zoom;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=pattern;ctx.fillRect(left,top,this.camera.width/zoom,this.camera.height/zoom);ctx.restore();
    return true;
  };

  selectCollisionCell(point){
    const map=this.current_map;if(!map)return false;
    this.collisionSelection={x:point.x,y:point.y};
    const block=map.getBlockIndex(point.x,point.y),elevation=map.getBlockHeight(point.x,point.y);
    let attribute=null;try{attribute=this.metatileAttribute(block,map).attribute;}catch{}
    const values={Cell:`${point.x}, ${point.y}`,Metatile:`0x${block.toString(16).toUpperCase().padStart(3,"0")}`,Elevation:elevation,Behavior:attribute?.behavior??"Unavailable",Layer:attribute?.layerType??"Unavailable"};
    const actions=[UiWindow.button("Edit block properties",{icon:"✎",onClick:()=>this.editBlockProperties(point)}),UiWindow.button("Lower elevation",{icon:"−",onClick:()=>this.setBlockElevation(point.x,point.y,Math.max(0,elevation-1))}),UiWindow.button("Raise elevation",{icon:"+",onClick:()=>this.setBlockElevation(point.x,point.y,Math.min(MapBlockUtils.GBA_ELEVATION_MASK,elevation+1))})];
    this.workspace.renderProperties({title:"Collision / height cell",values,actions,events:[]});
    this.render(this.getMapContext(),true);return true;
  };

  eventReference(event=this.eventInspector?.current){
    if(!event||!this.current_map)return null;
    for(let type=0;type<this.current_map.entities.length;type++){
      const index=this.current_map.getEntityCollection(type).indexOf(event);
      if(index>=0)return EventBookmarkUtils.create(event,{type,index});
    }
    return null;
  };

  eventRecordsForBookmark(){
    return this.current_map?.entities.flatMap((events,type)=>events.map((event,index)=>({type,index,event})))||[];
  };

  bookmark(){
    const map=this.current_map;
    return map?{bank:map.getBankIndex(),map:map.getMapIndex(),title:map.getMapName(),event:this.eventReference()}: {};
  };

  restoreBookmark(target){
    this.change_map(target.bank,target.map);
    if(!target.event||!this.current_map)return this;
    const record=EventBookmarkUtils.resolve(this.eventRecordsForBookmark(),target.event),event=record?.event;
    if(!event)throw new Error("The bookmarked map event no longer exists or is ambiguous.");
    const zoom=this.camera.zoom;this.camera.set(this.camera.width/2-event.getX()*16*zoom,this.camera.height/2-event.getY()*16*zoom);
    this.render(this.getMapContext(),true);
    this.eventInspector.show(event,{x:event.getX(),y:event.getY()},this.context_map.canvas.clientWidth-320,80);
    return this;
  };

  editLayout(){const map=this.current_map;if(map)this.workspace.editLayout({title:`Resize ${map.getMapName()}`,width:map.getWidth(),height:map.getHeight(),onApply:(width,height)=>this.resizeMap(width,height)});}

  resizeMap(width,height){
    const map=this.current_map,oldWidth=map?.getWidth(),oldHeight=map?.getHeight();if(!map||width===oldWidth&&height===oldHeight)return false;
    const layout=map.getMapOffset(),plan=this.layoutWriter.plan({offset:map.getStructureOffset(),width:oldWidth,height:oldHeight,nextWidth:width,nextHeight:height,stride:2,reference:{kind:"gba32",pointerOffset:layout+12},dimensions:[{offset:layout,type:"s32"},{offset:layout+4,type:"s32"}]});
    const update=(target,nextWidth,nextHeight,bytes)=>{map.setStructureOffset(target);map.resize(nextWidth,nextHeight);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let y=0;y<nextHeight;y++)for(let x=0;x<nextWidth;x++)map.setBlock(x,y,view.getUint16((y*nextWidth+x)*2,true));map.preview=undefined;map.height_map=undefined;this.focusMap(map);this.render(this.getMapContext(),true);this.renderDetails(map);};
    this.editor.execute({label:`Resize ${map.getMapName()}`,description:`${oldWidth} × ${oldHeight} → ${width} × ${height}`,do:()=>update(this.layoutWriter.apply(plan),width,height,plan.nextBytes),undo:()=>update(this.layoutWriter.restore(plan),oldWidth,oldHeight,plan.sourceBytes)});
    return true;
  };

  connectionFields(connection){
    return[
      {key:"direction",label:"Direction",value:connection.direction,min:1,max:6},
      {key:"offset",label:"Perpendicular offset",value:connection.offset,min:-2147483648,max:2147483647},
      {key:"bank",label:"Destination bank",value:connection.bank,min:0,max:255},
      {key:"map",label:"Destination map",value:connection.map,min:0,max:255}
    ];
  };

  editConnections(){
    const map=this.current_map;if(!map)return false;const connections=map.getConnections()||[],defaults={direction:1,offset:0,bank:map.getBankIndex(),map:map.getMapIndex()};
    this.workspace.editConnections({
      title:`Connections · ${map.getMapName()}`,
      connections:connections.map((connection,index)=>({label:`${index+1}. Direction ${connection.direction} → ${connection.bank}:${connection.map}`,fields:this.connectionFields(connection)})),
      newConnection:{fields:this.connectionFields(defaults)},
      onApply:(index,values)=>this.updateConnection(index,values),
      onAdd:values=>this.addConnection(values),
      onRemove:index=>this.removeConnection(index)
    });
    return true;
  };

  reloadConnections(){
    const map=this.current_map,header=map?.getHeaderOffset();if(!map||!Number.isInteger(header))return false;
    const pointer=this.reader.memory.pointer(header+12);map.connection=[];map.setConnectionOffset(pointer??0);
    if(pointer!==null){const table=GbaMapConnections.read(this.reader.memory,pointer);table.entries.forEach((entry,index)=>{const connection=new RomConnection(entry.direction,entry.relativeOffset,entry.mapGroup,entry.mapNum);connection.sourceOffset=entry.offset;map.setConnection(index,connection);});}
    this.focusMap(map);this.render(this.getMapContext(),true);this.renderDetails(map);return true;
  };

  addConnection(values){
    const map=this.current_map;if(!map)return false;
    const plan=this.connectionTableWriter.insert(map.getHeaderOffset(),{direction:values.direction,relativeOffset:values.offset,mapGroup:values.bank,mapNum:values.map});
    this.editor.execute({label:"Add connection",description:`Direction ${values.direction} → ${values.bank}:${values.map}`,do:()=>{this.connectionTableWriter.apply(plan);this.reloadConnections();},undo:()=>{this.connectionTableWriter.restore(plan);this.reloadConnections();}});return true;
  };

  removeConnection(index){
    const map=this.current_map;if(!map)return false;const plan=this.connectionTableWriter.remove(map.getHeaderOffset(),index);
    this.editor.execute({label:"Delete connection",description:`Remove connection ${index+1}`,do:()=>{this.connectionTableWriter.apply(plan);this.reloadConnections();},undo:()=>{this.connectionTableWriter.restore(plan);this.reloadConnections();}});return true;
  };

  updateConnection(index,values){
    const connection=this.current_map?.getConnection(index);if(!Number.isInteger(connection?.sourceOffset))return false;
    const schema={direction:{offset:0,type:"u8"},offset:{offset:4,type:"s32"},bank:{offset:8,type:"u8"},map:{offset:9,type:"u8"}};
    return this.structureWriter.edit(this.editor.commands,{base:connection.sourceOffset,schema,current:connection,values,label:`Edit connection ${index+1}`,description:"Update GBA map connection",afterWrite:data=>{Object.assign(connection,data);this.render(this.getMapContext(),true);this.renderDetails();}});
  };

  focusMap(map=this.current_map){
    if(!map)return this;
    this.camera.restore();
    this.camera.fitIn("#canvas_map");
    const padding=.84,zoom=Math.max(.2,Math.min(2,(this.camera.width*padding)/map.getMapWidth(),(this.camera.height*padding)/map.getMapHeight()));
    this.camera.zoom=zoom;
    this.camera.set((this.camera.width-map.getMapWidth()*zoom)/2,(this.camera.height-map.getMapHeight()*zoom)/2);
    return this;
  };

  mapAtScreen(x,y){
    const world=MapUtils.screenToWorld({x,y},this.camera);
    if(MapUtils.pointInRect(world,{width:this.current_map.getMapWidth(),height:this.current_map.getMapHeight()}))return this.current_map;
    return this.neighbourhood(x,y)||null;
  };

  activate({initial=false}={}){
    if(initial)this.focusMap(this.current_map);
    else{
      const bounds=this.workspace.viewport.getBoundingClientRect();
      if(bounds.width&&bounds.height&&(Math.round(bounds.width)!==this.camera.width||Math.round(bounds.height)!==this.camera.height)){
        const worldX=(this.camera.width/2-this.camera.x)/this.camera.zoom,worldY=(this.camera.height/2-this.camera.y)/this.camera.zoom;
        this.camera.resize(Math.round(bounds.width),Math.round(bounds.height));
        this.getMapContext().canvas.width=this.camera.width;this.getMapContext().canvas.height=this.camera.height;
        this.camera.set(this.camera.width/2-worldX*this.camera.zoom,this.camera.height/2-worldY*this.camera.zoom);
      }
    }
    this.render(this.getMapContext(),true);
    this.workspace.windowManager?.clamp();
    return this;
  };

  // Written by HLorenzi and modify by Lukas.
  neighbourhood(x, y){
		let next_draw = [{ map: this.current_map, x: 0, y: 0 }];
		let already_drawn = new Set(), scheduled = new Set([this.current_map.getHeaderOffset()]);
    let drawn_maps = 0;

    let next_map = next_draw[drawn_maps], can_current_draw = false;
		while(next_map !== undefined){
      let header_offset = next_map.map.getHeaderOffset();
			let map_width = next_map.map.getMapWidth();
			let map_height = next_map.map.getMapHeight();
			if(CoreUtils.isObject(x)){
				let zoom = this.camera.zoom;
				let dx = this.camera.x + (next_map.x + map_width) * zoom;
				let dy = this.camera.y + (next_map.y + map_height) * zoom;
				let cx = dx - map_width * zoom;
				let cy = dy - map_height * zoom;
				// Draw map name if this is not the current map.
        if((dx > 0 && cx < this.camera.width) && (dy > 0 && cy < this.camera.height) && !already_drawn.has(header_offset)){
          if(this.current_map.getHeaderOffset() === header_offset){
            can_current_draw = true;
          }else{
            next_map.map.render(this, next_map.x, next_map.y, true);
          }
        }
			}

			// Compose the complete connected component. Schedule a header only once
      // so cyclic and contradictory paths cannot enqueue duplicate maps.
      if(scheduled.size < 128)for(let conn in next_map.map.getConnections()){
        let connection = next_map.map.getConnection(conn);
				// Don't draw emerge/submerge connections.
        let direction = connection.getDirection();
				if(direction > 0x0 && direction < 0x5){
					let neighbour = this.banks[connection.bank].getMap(connection.map);
					let h = Math.floor(direction / 3);
					let o = 16 * connection.offset;
          let neighbour_width = neighbour.getMapWidth();
          let neighbour_height = neighbour.getMapHeight();
					let m = h * ((direction % 2) * -neighbour_width + (direction == 4) * map_width) + (1 - h) * o;
					let n = (1 - h) * (((direction + 1) % 2) * -neighbour_height + (direction == 1) * map_height) + h * o;
					if (!scheduled.has(neighbour.getHeaderOffset())){
            let mx = next_map.x + m;
            let my = next_map.y + n;
						if(!CoreUtils.isObject(x)){
							let zoom = this.camera.zoom;
							let dx = (x - this.camera.x) / zoom - mx;
							let dy = (y - this.camera.y) / zoom - my;
							if(dx >= 0 && dy >= 0 && dx <= neighbour_width && dy <= neighbour_height){ return neighbour; }
						}
						scheduled.add(neighbour.getHeaderOffset());
						next_draw.push({ map: neighbour, x: mx, y: my });
					}
				}
			}
      next_map = next_draw[++drawn_maps];
	    already_drawn.add(header_offset);
		}
    if(can_current_draw){
      this.current_map.render(this, 0, 0, false);
    }
	};

  getGfxHeights(){
		let img = document.getElementById("height_image");
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
		const bounds = map.getBoundingClientRect();
		let xMouse = x - bounds.left - camera.x;
		let yMouse = y - bounds.top - camera.y;
		if(xMouse >= 0 && xMouse < mapwidth && yMouse >= 0 && yMouse < mapheight){
			return {x: Math.floor(xMouse/(16 * zoom)), y: Math.floor(yMouse/(16 * zoom))};
		}else{
			return false;
		}
	};

  /*
		Tileset Methods.
	*/
	setBlock(x, y, map, block, re_draw = true){
    const previous=map.getBlockIndex(x,y);if(previous===block)return;
    const previousWord=map.getBlock(x,y),nextWord=MapBlockUtils.gbaWithIndex(previousWord,block),offset=map.getStructureOffset()+(y*map.getWidth()+x)*2;
    const apply=(expected,next,value)=>{
      if(this.reader.memory.contains(offset,2))MemoryUtils.replace(this.reader.memory,offset,MemoryUtils.valueBytes("u16",expected),MemoryUtils.valueBytes("u16",next),{message:"Map block changed after this command"});
      map.setBlock(x,y,next);
      let ctx=map.getPreviewContext();this.draw_block(ctx,map,x,y,value);if(re_draw)this.render(this.getMapContext(),true);
    };
    if(this.editor?.commands)this.editor.execute({label:`Paint block (${x}, ${y})`,description:`0x${previous.toString(16)} → 0x${block.toString(16)}`,do:()=>apply(previousWord,nextWord,block),undo:()=>apply(nextWord,previousWord,previous)});else apply(previousWord,nextWord,block);
  };

  setBlockElevation(x,y,elevation,map=this.current_map){
    if(!map||x<0||y<0||x>=map.getWidth()||y>=map.getHeight())return false;
    const previous=map.getBlockHeight(x,y);MapBlockUtils.integer(elevation,0,MapBlockUtils.GBA_ELEVATION_MASK,"GBA block elevation");
    if(previous===elevation)return false;
    const previousWord=map.getBlock(x,y),nextWord=MapBlockUtils.gbaWithElevation(previousWord,elevation),offset=MapBlockUtils.offset(map.getStructureOffset(),map.getWidth(),x,y,2);
    const apply=(expected,next)=>{
      MemoryUtils.replace(this.reader.memory,offset,MemoryUtils.valueBytes("u16",expected),MemoryUtils.valueBytes("u16",next),{message:"Map elevation changed after this command"});
      map.setBlock(x,y,next);
      map.height_map=undefined;
      this.render(this.getMapContext(),true);
    };
    this.editor.execute({label:`Set elevation (${x}, ${y})`,description:`${previous} → ${elevation}`,do:()=>apply(previousWord,nextWord),undo:()=>apply(nextWord,previousWord)});
    return true;
  };

  metatileAttribute(block,map=this.current_map){
    if(!map)throw new RangeError("Open a GBA map before reading metatile attributes.");
    MapBlockUtils.integer(block,0,MapBlockUtils.GBA_INDEX_MASK,"GBA metatile");
    const frlg=this.reader.isFRLG(),primaryCount=frlg?0x280:0x200,secondary=block>=primaryCount,local=secondary?block-primaryCount:block;
    const headerOffset=this.reader.getOffset(map.getMapOffset()+16+Number(secondary)*4);
    if(!this.reader.isROMOffset(headerOffset))throw new RangeError("The selected metatile has no resolved tileset header.");
    const tileset=this.reader.readStructure("tilesetHeader",headerOffset,{frlg});
    if(!this.reader.isROMOffset(tileset.metatileAttributes))throw new RangeError("The selected tileset has no metatile-attribute table.");
    const profile=GbaMetatileAttribute.profile(frlg);
    return Object.freeze({block,local,secondary,tileset,attribute:GbaMetatileAttribute.read(this.reader.memory,tileset.metatileAttributes+local*profile.stride,{frlg})});
  };

  async editBlockProperties(point){
    const map=this.current_map;if(!map)return false;
    let resolved;
    try{resolved=this.metatileAttribute(map.getBlockIndex(point.x,point.y),map);}
    catch(error){NotificationHandler.pop("Block properties",error.message||String(error),NotificationType.ERROR);return false;}
    const attributeFields=GbaMetatileAttribute.fields(resolved.attribute).map(field=>({name:field.key,label:field.label,type:"number",value:field.value,min:field.min,max:field.max,step:1,fullWidth:false}));
    let environmentPreview=null,environmentDetail=this.reader.isFRLG()?"FireRed/LeafGreen uses a 32-bit metatile attribute record.":"Ruby/Sapphire/Emerald uses a 16-bit behavior/layer record.";
    try{
      const environment=PokemonViewer.battle.gba.EnvironmentResolver.resolve({mapType:map.getMapType(),behavior:resolved.attribute.behavior,weather:map.getWeather(),bank:map.getBankIndex(),map:map.getMapIndex(),x:point.x,y:point.y});
      this.battleBackgrounds||=new PokemonViewer.battle.gba.Backgrounds(this.reader);const source=this.battleBackgrounds.source(environment.id);
      if(source?.canvas){const canvas=document.createElement("canvas");canvas.width=240;canvas.height=160;canvas.getContext("2d").drawImage(source.canvas,0,0);environmentPreview=Dom.create("figure",{className:"app-dialog__preview"},[canvas,Dom.create("figcaption",{text:`Battle preview · ${environment.label} · ${environment.reason}`})]);}
      environmentDetail+=` Current battle environment: ${environment.label} (${environment.reason}).`;
    }catch{}
    const values=await AppDialog.form({
      title:`Block properties · ${point.x}, ${point.y}`,icon:"▦",
      message:"Elevation belongs to this map cell. Behavior and layer fields belong to the shared metatile and may affect every map using this tileset.",
      detail:environmentDetail,preview:environmentPreview,
      fields:[{name:"elevation",label:"Cell elevation",type:"number",value:map.getBlockHeight(point.x,point.y),min:0,max:MapBlockUtils.GBA_ELEVATION_MASK,step:1,fullWidth:false},...attributeFields],
      submitLabel:"Apply"
    });
    return values?this.setBlockProperties(point,resolved,values,map):false;
  };

  setBlockProperties(point,resolved,values,map=this.current_map){
    if(!map)return false;
    const previousWord=map.getBlock(point.x,point.y),previousRaw=resolved.attribute.raw;
    MapBlockUtils.integer(values.elevation,0,MapBlockUtils.GBA_ELEVATION_MASK,"GBA block elevation");
    const nextWord=MapBlockUtils.gbaWithElevation(previousWord,values.elevation),nextRaw=GbaMetatileAttribute.encode(resolved.attribute,values);
    if(previousWord===nextWord&&previousRaw===nextRaw)return false;
    const layoutOffset=MapBlockUtils.offset(map.getStructureOffset(),map.getWidth(),point.x,point.y,2);
    const wordBytes=value=>MemoryUtils.valueBytes("u16",value),attributeBytes=value=>MemoryUtils.valueBytes(resolved.attribute.type,value);
    const apply=(expectedWord,word,expectedRaw,raw)=>{
      MemoryUtils.replaceAll(this.reader.memory,[
        {offset:layoutOffset,expected:wordBytes(expectedWord),next:wordBytes(word)},
        {offset:resolved.attribute.offset,expected:attributeBytes(expectedRaw),next:attributeBytes(raw)}
      ],{message:"Map block properties changed after this command"});
      map.setBlock(point.x,point.y,word);
      map.height_map=undefined;this.render(this.getMapContext(),true);
    };
    this.editor.execute({
      label:`Edit block properties (${point.x}, ${point.y})`,
      description:`Metatile 0x${resolved.block.toString(16).toUpperCase()} · elevation ${MapBlockUtils.gbaElevation(previousWord)} → ${values.elevation}`,
      do:()=>apply(previousWord,nextWord,previousRaw,nextRaw),undo:()=>apply(nextWord,previousWord,nextRaw,previousRaw)
    });
    return true;
  };

  contextActionEnabled(name){
    if(name==="fill-selection")return this.selections.length>0;
    return name==="properties"||["pick","fill","center","copy"].includes(name);
  };

  runContextAction(name,{point,block}){
    if(name==="properties")return this.editBlockProperties(point);
    if(name==="pick")this.selectInWindowBlock(block);
    else if(name==="fill"){this.fillRegionWith(this.current_map,point.x,point.y,this.selected_block);this.render(this.getMapContext(),true);}
    else if(name==="fill-selection"){this.selections.flatMap(selection=>selection.cells()).forEach(({x,y})=>this.setBlock(x,y,this.current_map,this.selected_block,false));this.render(this.getMapContext(),true);}
    else if(name==="center"){const zoom=this.camera.zoom;this.camera.set(this.camera.width/2-point.x*16*zoom,this.camera.height/2-point.y*16*zoom);this.render(this.getMapContext(),true);}
    else if(name==="copy")CoreUtils.copyText(`${point.x},${point.y}`);
    return true;
  };

  eventStructure(type){return[GbaObjectEventTemplate,GbaWarpEvent,GbaCoordEvent,GbaBgEvent][type];}

  rebaseEventTable(map,type,base){
    const Structure=this.eventStructure(type),list=map.getEntityCollection(type);map.setEntityOffset(type,base);
    list.forEach((entity,index)=>{entity.sourceOffset=base===null?null:base+index*Structure.SIZE;if(entity.sourceOffset!==null)entity.properties=Structure.read(this.reader.memory,entity.sourceOffset);});
  }

  newEvent(type,x,y){
    const list=this.current_map.getEntityCollection(type),index=type===0?Math.max(0,...list.filter(Boolean).map(entity=>entity.getIndex()))+1:list.length+1;
    return type===0?new Overworld(x,y,0,index):type===1?new Warp(x,y,0,index):type===2?new Script(x,y,0,index):new Signpost(x,y,0,index);
  }

  createEvent(type){
    const map=this.current_map,eventsOffset=map?.getEventsHeaderOffset();if(!map||!Number.isInteger(eventsOffset))return false;
    try{
      const point=this.hover_block.x===null?{x:0,y:0}:this.hover_block,created=this.newEvent(type,point.x,point.y),entry=this.eventTableWriter.entry(type,{...point,localId:created.getIndex()}),plan=this.eventTableWriter.insert(eventsOffset,type,entry),list=map.getEntityCollection(type);
      this.editor.execute({
        label:`Add ${plan.config.name}`,description:`Relocate ${plan.nextCount}-entry table`,
        do:()=>{this.eventTableWriter.apply(plan);if(!list.includes(created))list.push(created);this.rebaseEventTable(map,type,plan.allocation);this.render(this.getMapContext(),true);},
        undo:()=>{this.eventTableWriter.restore(plan);map.removeEvent(type,created);this.rebaseEventTable(map,type,plan.pointer);this.render(this.getMapContext(),true);}
      });return created;
    }catch(error){NotificationHandler.pop("Add event",error.message||String(error),NotificationType.ERROR);return false;}
  }

  deleteEvent(entity){
    const map=this.current_map,type=entity instanceof Overworld?0:entity instanceof Warp?1:entity instanceof Script?2:entity instanceof Signpost?3:-1,eventsOffset=map?.getEventsHeaderOffset(),list=type<0?[]:map.getEntityCollection(type),index=list.indexOf(entity);
    if(!Number.isInteger(eventsOffset)||index<0)return false;
    try{
      const plan=this.eventTableWriter.remove(eventsOffset,type,index);
      this.editor.execute({
        label:`Delete ${plan.config.name}`,description:`Relocate ${plan.nextCount}-entry table`,
        do:()=>{this.eventTableWriter.apply(plan);const current=list.indexOf(entity);if(current>=0)list.splice(current,1);this.rebaseEventTable(map,type,plan.allocation);this.render(this.getMapContext(),true);},
        undo:()=>{this.eventTableWriter.restore(plan);if(!list.includes(entity))list.splice(index,0,entity);this.rebaseEventTable(map,type,plan.pointer);this.render(this.getMapContext(),true);}
      });return true;
    }catch(error){NotificationHandler.pop("Delete event",error.message||String(error),NotificationType.ERROR);return false;}
  }

  async confirmDeleteEvent(entity){
    const remove=await AppDialog.confirm({title:`Delete ${entity.constructor.name}?`,message:"The event table will be rebuilt and its pointer updated.",detail:"This change can be undone from History.",confirmLabel:"Delete event",cancelLabel:"Keep event",danger:true});
    return remove?this.deleteEvent(entity):false;
  }

  moveEvent(entity,x,y,{record=true}={}){
    if(!Number.isInteger(entity?.sourceOffset))return false;
    const previous={x:entity.getX(),y:entity.getY()},next={x,y};if(previous.x===x&&previous.y===y)return false;
    const coordinateOffset=entity instanceof Overworld?4:0,schema={x:{offset:coordinateOffset,type:"s16"},y:{offset:coordinateOffset+2,type:"s16"}};
    const update=position=>{entity.set(position.x,position.y);this.render(this.getMapContext(),true);};
    if(record)return this.structureWriter.edit(this.editor.commands,{
      base:entity.sourceOffset,schema,current:previous,values:next,
      label:`Move ${entity.constructor.name} ${entity.getIndex()}`,
      description:`(${previous.x}, ${previous.y}) → (${x}, ${y})`,
      afterWrite:update
    });
    const patches=Object.entries(schema).map(([name,field])=>({
      offset:entity.sourceOffset+field.offset,
      expected:this.structureWriter.encode(field.type,previous[name]),
      next:this.structureWriter.encode(field.type,next[name])
    }));
    MemoryUtils.replaceAll(this.reader.memory,patches,{message:"Map event changed before it could move"});update(next);return true;
  }

  eventFieldSchema(entity){
    const positionOffset=entity instanceof Overworld?4:0,base={
      x:{label:"X",offset:positionOffset,type:"s16",min:-32768,max:32767},
      y:{label:"Y",offset:positionOffset+2,type:"s16",min:-32768,max:32767}
    };
    if(entity instanceof Overworld)return{...base,sprite:{label:"Sprite",offset:1,type:"u8",min:0,max:255},z:{label:"Elevation",offset:8,type:"u8",min:0,max:15},movement_type:{label:"Movement",offset:9,type:"u8",min:0,max:255},movement_radius:{label:"Movement radius",offset:10,type:"u8",min:0,max:255},trainer:{label:"Trainer type",offset:12,type:"u16",min:0,max:65535},range_vision:{label:"Trainer range",offset:14,type:"u16",min:0,max:65535},status:{label:"Visibility flag",offset:20,type:"u16",min:0,max:65535}};
    if(entity instanceof Warp)return{...base,z:{label:"Elevation",offset:4,type:"u8",min:0,max:15},warp:{label:"Destination warp",offset:5,type:"u8",min:0,max:255},map:{label:"Destination map",offset:6,type:"u8",min:0,max:255},bank:{label:"Destination bank",offset:7,type:"u8",min:0,max:255}};
    if(entity instanceof Script)return{...base,z:{label:"Elevation",offset:4,type:"u8",min:0,max:15},number:{label:"Trigger variable",offset:6,type:"u16",min:0,max:65535},value:{label:"Trigger value",offset:8,type:"u16",min:0,max:65535}};
    if(entity instanceof Signpost)return{...base,z:{label:"Elevation",offset:4,type:"u8",min:0,max:15},type:{label:"Signpost type",offset:5,type:"u8",min:0,max:255}};
    return{};
  }

  eventFields(entity){
    return Object.entries(this.eventFieldSchema(entity)).map(([key,field])=>({key,...field,value:Number(entity[key])}));
  }

  updateEventFields(entity,values){
    if(!Number.isInteger(entity?.sourceOffset))return false;
    const schema=this.eventFieldSchema(entity);
    return this.structureWriter.edit(this.editor.commands,{
      base:entity.sourceOffset,schema,current:entity,values,
      label:`Edit ${entity.constructor.name} ${entity.getIndex()}`,
      description:"Update event properties",
      afterWrite:data=>{Object.assign(entity,data);this.render(this.getMapContext(),true);}
    });
  }

  eventActions(event){
    const actions=[];
    if(event instanceof Warp)actions.push({label:"Enter warp",icon:"↪",run:()=>this.enterWarp(event)});
    if(event instanceof Overworld){
      const trainer=this.trainerReference(event);if(trainer){
        let battleEnvironment=null;
        try{battleEnvironment=PokemonViewer.battle.gba.EnvironmentResolver.fromEditor(this,event);}catch(error){console.warn("Battle environment could not be resolved.",error);}
        trainer.environment=battleEnvironment;trainer.mapReference={...this.bookmark(),battleEnvironment};
        actions.push({label:"Open battle team",icon:"⚔",run:()=>EditorLinks.battle({trainer})});
      }
      const id=event.getSpriteIndex();this.getOverworldSprite(id);const sprite=this.overworld_sprite_buffer[id];
      if(sprite?.data){const bytes=this.pack4bpp(sprite.data),editable=bytes.length===sprite.byteLength;actions.push({label:"Open sprite",icon:"▧",run:()=>this.openSprite({offset:sprite.offset,bytes,count:Math.ceil(sprite.data.length/64),columns:Math.max(1,sprite.width/8),title:`Overworld sprite ${id}`,editable,palette:sprite.palette,paletteOffset:sprite.paletteOffset})});}
    }
    if(event instanceof Entity)actions.push({label:"Delete event",icon:"⌫",run:()=>this.confirmDeleteEvent(event)});
    return actions;
  };

  trainerReference(event){
    const start=event?.getScriptOffset?.();if(!Number.isInteger(start))return null;
    for(let offset=start;offset<Math.min(this.reader.size,start+512);offset++)if(this.reader.memory.u8(offset)===0x5c){
      const type=this.reader.memory.u8(offset+1),id=this.reader.memory.u16(offset+2);if(type<=8)return{trainerId:id,scriptOffset:offset,battleType:type};
    }return null;
  };

  codeReference(event){
    if(!Number.isInteger(event?.sourceOffset)||!event.hasScript?.())return null;
    const relative=event instanceof Overworld?16:event instanceof Script?12:event instanceof Signpost?8:null;
    return relative===null?null:{kind:"gba32",pointerOffset:event.sourceOffset+relative};
  };

  enterWarp(warp){
    this.editor.navigate(()=>{
      this.change_map(warp.getBankIndex(),warp.getMapIndex());
      const destination=this.current_map?.getEntity(1,Math.max(0,warp.getWarpIndex()-1));
      if(destination){const zoom=this.camera.zoom;this.camera.set(this.camera.width/2-destination.getX()*16*zoom,this.camera.height/2-destination.getY()*16*zoom);this.render(this.getMapContext(),true);}
    });
    return this;
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

  fillRegionWith(map, x, y, block){
    let width = map.getWidth();
    let initial = map.getBlockIndex(x, y);
    let set = new Set();
    let qeue = [x+y*width];
    let k = 0;
    while(k < qeue.length){
      let xx = qeue[k] % width, yy = Math.floor(qeue[k] / width);
      if(map.getBlockIndex(xx, yy) == initial){
        this.setBlock(xx, yy, map, block, false);
        let i0 = (xx - 1) + yy * width;
        if(xx > 0 && !set.has(i0)){ qeue.push(i0); set.add(i0); }
        let i1 = xx + (yy - 1) * width;
        if(yy > 0 && !set.has(i1)){ qeue.push(i1); set.add(i1); }
        let i2 = (xx + 1) + yy * width;
        if(xx + 1 < map.getWidth() && !set.has(i2)){ qeue.push(i2); set.add(i2); }
        let i3 = xx + (yy + 1) * width;
        if(yy + 1 < map.getHeight() && !set.has(i3)){ qeue.push(i3); set.add(i3);  }
      }
      k++;
    }
  };

  selectInWindowBlock(a){
    const primaryCount=this.blockGroups?.[0]?.count ?? 0;
    const secondaryBase=Math.max(0x200,primaryCount);
    const group=a>=secondaryBase?1:0;
    if(group!==this.activeBlockGroup) this.showBlockGroup(group);
    const local=group===1?a-secondaryBase:a;
    let x = local % 8, y = local >> 3;
    let xx = x << 4, yy = y << 4;
    const tabsHeight=document.querySelector(".block_tabs")?.offsetHeight ?? 0;
    Object.assign(document.getElementById("selected_block").style, {left: `${xx}px`, top: `${yy+tabsHeight}px`});
    this.selected_block = a;
    document.getElementById("selected_block").classList.remove("hide");
    this.workspace.windowManager.reveal("Blocks",{target:document.getElementById("selected_block")});
  };

  // Render map.
  render(ctx, force_draw = false){
    if(this.destroyed)return;
    if(this.is_camera_moving || force_draw){
      this.is_camera_moving = false;
      let camera_zoom   = this.camera.zoom;
      let camera_width  = this.camera.width;
      let camera_height = this.camera.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, camera_width, camera_height);

      ctx.imageSmoothingEnabled=false;
      const pixelRatio=globalThis.devicePixelRatio||1;
      let xCamera = Math.round(this.camera.x*pixelRatio)/pixelRatio;
      let yCamera = Math.round(this.camera.y*pixelRatio)/pixelRatio;
      ctx.setTransform(camera_zoom, 0, 0, camera_zoom, xCamera, yCamera);
      /* Drawing */
      this.renderRepeatingPattern(ctx);
      this.neighbourhood(ctx);
      this.renderOverlays(ctx);
      this.workspace?.refreshRegionMap({sectionId:this.regionMap?.sectionForMap(this.current_map)});
      this.camera.update(this);
      if(this.is_camera_moving&&this.animationFrame===null)this.animationFrame=this.scope.frame(()=>{this.animationFrame=null;this.render(ctx);});
    }
  };

  renderOverlays(ctx){
    const zoom = this.camera.zoom;
    if(this.showGrid && zoom >= 0.5){
      PokemonViewer.maps.overlays.grid(ctx,{width:this.current_map.getMapWidth(),height:this.current_map.getMapHeight(),cell:16,scale:zoom});
    }
    if(this.selections.length){
      this.selections.forEach((selection)=>{const b=selection.bounds;PokemonViewer.maps.overlays.selection(ctx,{x:b.left*16,y:b.top*16,width:selection.width*16,height:selection.height*16,scale:zoom});});
    }
  };

	render_tileset(map){
    let tblock0 = this.block_buffer[map.getBlocksIndex(0)].totalBlocks;
    let tblock1 = this.block_buffer[map.getBlocksIndex(1)].totalBlocks;
		let tile0 = Math.ceil(tblock0 / 8);
		let tile1 = Math.ceil(tblock1 / 8);

		this.blockGroups=[{count:tblock0,rows:tile0,base:0},{count:tblock1,rows:tile1,base:Math.max(0x200,tblock0)}];
    this.showBlockGroup(0);
	};

  showBlockGroup(group){
    this.activeBlockGroup=group;
    const config=this.blockGroups[group],blocks=document.getElementById("blocks_map");
    blocks.width=128;blocks.height=Math.max(16,config.rows*16);
    const ctx=blocks.getContext("2d");
    for(let index=0;index<config.count;index++)this.draw_block(ctx,this.current_map,index%8,Math.floor(index/8),config.base+index);
    document.querySelectorAll(".block_tabs button").forEach((button)=>{const active=Number(button.dataset.tileset)===group;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});
    document.getElementById("selected_block").classList.toggle("hide",!(this.selected_block>=config.base&&this.selected_block<config.base+config.count));
  };

  openTilesetBlock(event){
    const canvas=document.getElementById("blocks_map"),bounds=canvas.getBoundingClientRect();
    const x=Math.floor((event.clientX-bounds.left)*canvas.width/bounds.width/16),y=Math.floor((event.clientY-bounds.top)*canvas.height/bounds.height/16),local=y*8+x,config=this.blockGroups?.[this.activeBlockGroup];
    if(!config||local>=config.count)return;
    const entries=this.block_buffer[this.current_map.getBlocksIndex(this.activeBlockGroup)].memory[local],indices=[this.current_map.getTilesetsIndex(0),this.current_map.getTilesetsIndex(1)],sources=indices.map(index=>this.tileset_buffer[index]),pixels=sources[0].memory.concat(sources[1].memory),tileBytes=[],segments=[];
    let editable=true;
    for(const entry of entries){
      const tile=entry&0x3ff,source=tile>=0x200?sources[1]:sources[0],localTile=tile&0x1ff;
      tileBytes.push(...this.pack4bpp(pixels.slice(tile*64,tile*64+64)));
      if(source.compressed)editable=false;else segments.push({offset:source.offset+localTile*GbaSpriteCodec.bytesPerTile,length:GbaSpriteCodec.bytesPerTile});
    }
    const bytes=Uint8Array.from(tileBytes),linked=editable?{segments,editable:true}:{editable:false};
    this.openSprite({offset:sources[0].offset,bytes,...linked,count:entries.length,columns:4,title:`Map block 0x${(config.base+local).toString(16).toUpperCase()}`});
  };


  initEvents(){
    const options=this.scope.options;
    const banksElement = document.getElementById("map_banks");
    const canvas = document.getElementById("canvas_map");
    const blocks = document.getElementById("blocks_map");
    blocks.addEventListener("dblclick",event=>this.openTilesetBlock(event),options);
    blocks.title="Double-click a block to open its tiles in Sprite Editor";

    banksElement.addEventListener("click", (event) => {
      const mapOption = event.target.closest(".map_option");
      if(mapOption) this.navigateToMap(Number(mapOption.dataset.bank), Number(mapOption.dataset.map));
    },options);

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const point=GestureZoom.anchoredPoint(canvas,event);
      if(!point)return;
      this.camera.alterZoom(GestureZoom.factor(event),point.x,point.y);
      this.render(this.getMapContext(), true);
    }, {passive:false,signal:this.scope.signal});
    GestureZoom.bindPinch(canvas,gesture=>{
      const point=GestureZoom.anchoredPoint(canvas,gesture);
      if(!point)return;
      this.camera.alterZoom(gesture.factor,point.x,point.y);
      this.render(this.getMapContext(),true);
    },{signal:this.scope.signal});
    canvas.addEventListener("dblclick",event=>{
      const point=MapUtils.localPoint(canvas,event.clientX,event.clientY),map=point&&this.mapAtScreen(point.x,point.y);
      if(!map||map===this.current_map)return;
      event.preventDefault();event.stopImmediatePropagation();
      this.navigateToMap(map.getBankIndex(),map.getMapIndex());
    },options);

    this.controls = new MapControls(document.getElementById("map_editor"), (mode) => {
      if(mode === EVENT.ZOOM_IN || mode === EVENT.ZOOM_OUT){
        this.camera.alterZoom(mode === EVENT.ZOOM_IN ? 1.2 : 1 / 1.2, this.camera.width / 2, this.camera.height / 2);
        this.render(this.getMapContext(), true);
      }
      if(MapLayerModes.is(mode)){
        this.layerMode = mode;
        this.collisionSelection = null;
        this.current_map.preview = undefined;
        this.render(this.getMapContext(), true);
      }
      if(mode === EVENT.GRID || mode === EVENT.NO_GRID){
        this.showGrid = mode === EVENT.GRID;
        this.render(this.getMapContext(), true);
      }
      canvas.classList.toggle("grab", mode === EVENT.CAMERA_MOVE);
    },{family:"gba",signal:this.scope.signal});
    this.workspace.root.addEventListener("mapviewchange",event=>{
      if(event.detail?.mode==="map"){this.focusMap(this.current_map);this.render(this.getMapContext(),true);}
      else this.workspace.renderRegionMap({sectionId:this.regionMap?.sectionForMap(this.current_map)});
    },this.scope.options);
    this.contextMenu = new MapContextMenu(this, canvas,options);
    this.eventInspector = new MapEventInspector(this, document.getElementById("map_visualization"));

    const applyTool = (event, isStart = false) => {
      const mode = this.controls.active;
      const point = this.mouseToMapCoordinates(canvas, event.clientX, event.clientY);
      if(!point){
        if(mode === EVENT.EVENT_IN && isStart){
          const bounds = canvas.getBoundingClientRect();
          const map = this.neighbourhood(event.clientX - bounds.left, event.clientY - bounds.top);
          if(map instanceof RomMap) this.navigateToMap(map.getBankIndex(),map.getMapIndex());
        }
        return;
      }
      if(this.layerMode===MapLayerModes.COLLISION && isStart){
        this.selectCollisionCell(point);
      }else if(mode === EVENT.CURSOR_MOVE && this.selected_block !== undefined){
        this.setBlock(point.x, point.y, this.current_map, this.selected_block);
      }else if(mode === EVENT.BLOCK_PICKER && isStart){
        this.selectInWindowBlock(this.current_map.getBlockIndex(point.x, point.y));
      }else if(mode === EVENT.BLOCK_FILLER && isStart){
        this.fillRegionWith(this.current_map, point.x, point.y, this.selected_block);
        this.render(this.getMapContext(), true);
      }else if(mode === EVENT.EVENT_MOVE){
        if(isStart){this.selected_event=this.current_map.findEvents(point.x,point.y,[0,1,2,3])[0];this.eventDrag=this.selected_event?{event:this.selected_event,x:this.selected_event.getX(),y:this.selected_event.getY()}:null;}
        else if(this.selected_event){
          this.selected_event.set(point.x, point.y);
          this.render(this.getMapContext(), true);
        }
      }else if(mode === EVENT.EVENT_OPTION && isStart){
        const selected = this.current_map.findEvents(point.x, point.y, [0, 1, 2, 3])[0] ?? null;
        this.selected_event = selected;
        this.eventInspector.show(selected, point, event.clientX, event.clientY);
      }else if(mode === EVENT.SELECTION){
        if(isStart){
          if(!event.shiftKey)this.selections=[];
          this.activeSelection=new MapSelection(point);
          this.selections.push(this.activeSelection);
        }else if(this.activeSelection){
          this.activeSelection.update(point);
        }
        this.render(this.getMapContext(), true);
      }
      this.hover_block = point;
    };

    canvas.addEventListener("pointerdown", (event) => {
      if(event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      this.mouse.down = true;
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
      if(this.controls.active === EVENT.CAMERA_MOVE) canvas.classList.add("grabbing");
      applyTool(event, true);
    },options);

    canvas.addEventListener("pointermove", (event) => {
      if(!this.mouse.down) return;
      if(this.controls.active === EVENT.CAMERA_MOVE){
        const dx = GestureZoom.dragDelta(event.clientX,this.mouse.x);
        const dy = GestureZoom.dragDelta(event.clientY,this.mouse.y);
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
        this.camera.add(dx, dy);
        this.render(this.getMapContext(), true);
      }else{
        applyTool(event);
      }
    },options);

    const releasePointer = () => {
      if(this.eventDrag){
        const {event,x,y}=this.eventDrag,next={x:event.getX(),y:event.getY()};event.set(x,y);
        if(next.x!==x||next.y!==y)this.moveEvent(event,next.x,next.y);
        this.eventDrag=null;
      }
      this.mouse.down = false;
      this.activeSelection = null;
      canvas.classList.remove("grabbing");
    };
    canvas.addEventListener("pointerup", releasePointer,options);
    canvas.addEventListener("pointercancel", releasePointer,options);

    blocks.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const bounds = blocks.getBoundingClientRect();
      const local = ((event.clientX - bounds.left) >> 4) + 8 * ((event.clientY - bounds.top) >> 4);
      const config=this.blockGroups[this.activeBlockGroup];
      if(local>=config.count)return;
      const index=config.base+local;
      if(index !== this.selected_block) this.selectInWindowBlock(index);
    },options);
    document.querySelector(".block_tabs").addEventListener("click",(event)=>{const tab=event.target.closest("button[data-tileset]");if(tab)this.showBlockGroup(Number(tab.dataset.tileset));},options);

  };

  destroy(){
    this.destroyed=true;this.scope.cancelFrame(this.animationFrame);this.animationFrame=null;this.scope.destroy();
    this.contextMenu?.close();this.eventInspector?.element.remove();
  }

};
((globalThis.PokemonViewer ||= {}).maps ||= {}).GbaDriver=EMap;
