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
class RomMap{
  constructor(bank_index, map_index){
    // information
    this.bank = bank_index;
    this.map  = map_index;

    // Header Offset
    this.headerOffset   = 0x00000000;
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
    this.mapOffset       = 0x00000000;
    this.structureOffset = 0x00000000;
    this.connectionOffset= 0x00000000;
    this.connection      = [];
    this.entitiesOffsets = [];
    this.eventsHeaderOffset = null;
    this.entities        = [[/* Overworld */], [/* Warps */], [/* Scripts */], [/* Signposts */]];
    this.borderOffset    = 0x00000000;
    this.borderWidth     = 2;
    this.borderHeight    = 2;
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
  getMapIndex(){ return this.map; };
  getBankIndex(){ return this.bank; };
  getMapOffset(){ return this.mapOffset; };
  getHeaderOffset(){ return this.headerOffset; };
  getWidth() { return this.structure[0].length; };
  getHeight(){ return this.structure.length; };
  getMapWidth() { return this.structure[0].length * 16; };
  getMapHeight(){ return this.structure.length * 16; };
  getMapName(){ return this.name; };
  getMapNameEffect(){ return this.name_effect; };
  getMapNameOffset(){ return this.name_pointer; };
  getStructureOffset(){ return this.structureOffset; };
  getScriptOffset(){ return this.script; };
  getConnectionOffset(_c){ return this.connectionOffset; };
  getConnection(_c){ return this.connection[_c]; };
  getConnections(){ return this.connection; };
  getEntityOffset(_t){ return this.entitiesOffsets[_t]; };
  getEventsHeaderOffset(){ return this.eventsHeaderOffset; };
  getEntityCollection(_t){ return this.entities[_t]; };
  getEntity(_t, _i){ return this.entities[_t][_i]; };
  getBorderOffset(){ return this.borderOffset; };
  getBorderWidth(){ return this.borderWidth; };
  getBorderHeight(){ return this.borderHeight; };
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

  setMapIndex(_i){ this.map = _i; };
  setBankIndex(_i){ this.bank = _i; };
  setMapOffset(_p){ this.mapOffset = _p; };
  setHeaderOffset(_p){ this.headerOffset = _p; };
  setMapNameOffset(_p){ this.name_pointer = _p; };
  setMapName(_n){ this.name = _n; };
  setMapNameEffect(_n){ this.name_effect = _n; };
  setStructureOffset(_p){ this.structureOffset = _p; };
  setScriptOffset(_p){ this.script = _p; };
  setConnectionOffset(_p){ this.connectionOffset = _p; };
  setConnection(_n, _c){ this.connection[_n] = _c; };
  setEntityOffset(_t, _p){ this.entitiesOffsets[_t] = _p; };
  setEventsHeaderOffset(_p){ this.eventsHeaderOffset = _p; };
  setEntity(_t, _i, _e){ this.entities[_t][_i] = _e; };
  setBorderOffset(_p){ this.borderOffset = _p; };
  setBorderSize(width,height){this.borderWidth=width;this.borderHeight=height;return this;};
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
  getBlockIndex(_x, _y){ return MapBlockUtils.gbaIndex(this.structure[_y][_x]); };
  getBlockHeight(_x, _y){ return MapBlockUtils.gbaElevation(this.structure[_y][_x]); };
  getBlock(_x, _y){ return this.structure[_y][_x]; };
  setBlockIndex(_x, _y, _b){ this.structure[_y][_x] = MapBlockUtils.gbaWithIndex(this.structure[_y][_x],_b); };
  setBlockHeight(_x, _y, _h){ return (this.structure[_y][_x] = MapBlockUtils.gbaWithElevation(this.structure[_y][_x],_h)); };
  setBlock(_x, _y, _b){ this.structure[_y][_x] = _b; };

  /*
    Find methods
  */

  findEvents(i, j, e){
    let found = [];
    (e instanceof Array ? e : [e]).forEach((a,m,b)=>{
      let events = this.entities[e[m]];
      let find = events.find(e=>(e.x == i && e.y == j));
      if(!!find){
        found.push(find);
      }
    });
    return found;
  };

  addEvent(i, j, e){
    let event;
    let index = this.entities[e].length + 1;
    switch(e){
      case 0: event = new Overworld(i, j, 0, index); break;
      case 1: event = new Warp(i, j, 0, index); break;
      case 2: event = new Script(i, j, 0, index); break;
      case 3: event = new Signpost(i, j, 0, index); break;
    }
    this.entities[e].push(event);
    return event;
  }
  removeEvent(type,event){const list=this.entities[type],index=typeof event==="number"?event:list.indexOf(event);if(index<0||index>=list.length)return null;return list.splice(index,1)[0];}

  /*
    Main Methods
  */
  resize(_w, _h){
    if(!Number.isInteger(_w)||!Number.isInteger(_h)||_w<1||_h<1)throw new RangeError("Map dimensions must be positive integers.");
    const previous=this.structure;
    this.structure=Array.from({length:_h},(_,y)=>Array.from({length:_w},(_,x)=>previous[y]?.[x]??0));
    this.preview=undefined;this.height_map=undefined;
    return this;
  };

  render(editor, dx, dy, show_name){
    let ctx = editor.getMapContext();
    if(this.preview === undefined){
      this.create_preview(editor);
    }

    ctx.save();
    if(MapLayerModes.dimsMap(editor.layerMode)) ctx.globalAlpha = 0.24;
    ctx.drawImage(this.preview, dx, dy);
    ctx.restore();
    const name=this.getMapName(),map_width=this.getMapWidth(),map_height=this.getMapHeight();
    if(show_name){
      MapUtils.drawMapFrame(ctx,{x:dx,y:dy,width:map_width,height:map_height},{label:name,scale:editor.getCamera().zoom});
    }else{
      MapUtils.drawMapFrame(ctx,{x:dx,y:dy,width:map_width,height:map_height},{current:true,scale:editor.getCamera().zoom});
      if(MapLayerModes.showsEvents(editor.layerMode)){
        this.render_entities(editor, dx, dy);
      }
      if(editor.layerMode === MapLayerModes.COLLISION) this.render_topographic(editor, dx, dy);
    }
  };

  render_entities(editor, dx, dy){
    let ctx = editor.getMapContext();
		const eventTypes=["Object","Warp","Script","Sign"];
    this.entities.forEach((event, index)=>{
			event.forEach(entity=>{
				if(entity != undefined){
          let x = dx + entity.getX() * 16;
          let y = dy + entity.getY() * 16;
          let sprite=null;
          if(index == 0){
            const movement=PokemonViewer.maps.movement,model=movement.describe(entity,"gba");
            PokemonViewer.maps.overlays.vision(ctx,{x,y,direction:model.initial,range:model.sight});
			      sprite = editor.getOverworldSprite(entity.getSpriteIndex(),model.initial);
          }
          PokemonViewer.maps.overlays.marker(ctx,{x,y,type:eventTypes[index],sprite});
				}
      });
    });
  };

  render_topographic(editor, dx, dy){
    let ctx = editor.getMapContext();
    const attributes=new Map(),heightMax=MapBlockUtils.GBA_ELEVATION_MASK;
    ctx.save();
    for(let y=0;y<this.getHeight();y++)for(let x=0;x<this.getWidth();x++){
      const elevation=this.getBlockHeight(x,y),block=this.getBlockIndex(x,y);
      if(!attributes.has(block))try{attributes.set(block,editor.metatileAttribute(block,this).attribute);}catch{attributes.set(block,null);}
      const behavior=attributes.get(block)?.behavior??0,hue=Math.round(205-(elevation/Math.max(1,heightMax))*185),lightness=46+Math.min(20,(behavior%5)*4);
      ctx.fillStyle=`hsla(${hue} 78% ${lightness}% / .54)`;ctx.fillRect(dx+x*16,dy+y*16,16,16);
      if(x===0||this.getBlockHeight(x-1,y)!==elevation){ctx.fillStyle="rgba(15,23,42,.48)";ctx.fillRect(dx+x*16,dy+y*16,1,16);}
      if(y===0||this.getBlockHeight(x,y-1)!==elevation){ctx.fillStyle="rgba(255,255,255,.62)";ctx.fillRect(dx+x*16,dy+y*16,16,1);}
    }
    const selected=editor.collisionSelection;
    if(selected&&selected.x>=0&&selected.y>=0&&selected.x<this.getWidth()&&selected.y<this.getHeight()){ctx.lineWidth=2/Math.max(editor.getCamera().zoom,.01);ctx.strokeStyle="#fff";ctx.strokeRect(dx+selected.x*16+1,dy+selected.y*16+1,14,14);ctx.strokeStyle="#152d43";ctx.lineWidth=1/Math.max(editor.getCamera().zoom,.01);ctx.strokeRect(dx+selected.x*16+.5,dy+selected.y*16+.5,15,15);}
    ctx.restore();
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

class RomConnection {
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

globalThis.RomMap=RomMap;
globalThis.RomConnection=RomConnection;
{
  const maps=(globalThis.PokemonViewer||={}).maps||={};
  maps.RomMap=RomMap;
  maps.RomConnection=RomConnection;
}
