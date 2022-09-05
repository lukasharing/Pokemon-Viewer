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

// MASTER DELEGATOR
document.onkeyup = function(event){
	hex_keyup(event);
}

class RomReader{
	constructor(){
		/* Game Variables */
		this.game_bases = [];
		this.gamePath = "";
		this.lang 		= "";
		this.type 		= "";
		this.version	= "";

		/* Editor Variables */
		this.currentWorkspace = "";

		//* Editor dictionary Variables *//
		this.dictionary = {};

		/* Game Buffers Variables */
		this.memoryOffsets = {};
		this.ReadOnlyMemory;

		/* Items */
		this.items = [];

		/* Editors */
		this.map_editor = new EMap(this);
		this.hex_editor = null;
		this.code_editor = null; //new ECode(this);
	};

	/* Global */
	get size(){ return this.ReadOnlyMemory.length; };

	/* Pokemon Bases */
	setGameBases(n){ this.game_bases = n; };
	isFRLG(){ return (this.type == "fire_red" || this.type == "leaf_green"); };

	/* _editor dictionary Methods */
	getDictionary(n){ return this.dictionary[n]; };

	/* Game Buffers Methods */
	getOffset(o)	{ return((this.ReadOnlyMemory[o]|this.ReadOnlyMemory[o+1]<<8|this.ReadOnlyMemory[o+2]<<16|this.ReadOnlyMemory[o+3]<<24) - 0x8000000); };
	getShort(o)		{ return(this.ReadOnlyMemory[o]|this.ReadOnlyMemory[o+1]<<8); };
	getByte(o)		{ return(this.ReadOnlyMemory[o]); };
	isROMOffset(o){ return (o >= 0 && o < this.size); };

	loadROM(file){
		let reader = new FileReader();
		let self = this;
  	reader.onload = function(e){
			self.ReadOnlyMemory = new Uint8Array(this.result);

			// System game detection.
			let info = {lang: null, base: null};
			for(let game_name in self.game_bases){
				if(game_name !== 'global'){
					let rom = self.game_bases[game_name];
					for(let lng in rom.memory){
						let game = rom.memory[lng];
						for(let j = 1; j <= 2 && game.version != undefined; j++){
							let version = game.version["offset_v" + j];
							if(version > 0){
								let search = game.version.string;
								//if(self.getTextByOffset(null, version, search.length) == search){
									info.lang = "en";
									info.base = "fire_red";
								//}
							}
						}
					}
				}
			}

			self.gamePath = file.name;
			if(info.lang != null){
				for(let prop in self.game_bases.global){
					let offset = self.game_bases.global[prop];
					let find = self.findByHex(offset.chain);
					self.memoryOffsets[prop] = self.getOffset(find[offset.index] + offset.chain.length * 0.5);
				}
				self.setGameInformation(info);
				self.init();

				/* jQuery stuff */
				$("#selectLightboxRom").addClass("hide");
				/* Put logo into selected game and class it. */
				/*let button = $("#buttonFile");
				let logo_path = "css/images/roms/logo/" + baseName.logo.replace("$", lang);
				button.attr("class", "rom_button_" + baseName).find("div").addClass("hide");
				button.find("img").removeClass("hide").attr("src", logo_path);*/
			}else{
				$("#loader_file_container").addClass("hide");
				$("#system_unknown").removeClass("hide");
			}
		};
		reader.onloadstart = function(e){
			$("#loader_file_container").removeClass("hide");
			$("#upload_game").addClass("hide");
		};

		let ti = (new Date()).getTime();
		let vm = 0.0;
		reader.onprogress = function(e){
			if(e.lengthComputable){
				// Developer info
				let tf = (new Date()).getTime();
				let dt = tf - ti;
				let de = e.total - e.loaded;
				vm += dt;
				ti = tf;
				let tapp = (vm * de) / e.loaded / 1000;
				//$("#loader_info").html(`Tiempo aproximado: ${ (de <= 0 ? 0 : tapp).toFixed(2) } segundos <br/> Bytes restantes: ${e.loaded} / ${e.total} bytes`);

				let percentComplete = Math.round(e.loaded / e.total * 100);
				$("#loader_file_container h3").text(`${percentComplete}%`);
				$("#loader_file_container .loader").css("width", `${percentComplete}%`);
			}
		};
		reader.onerror = function(e){
			console.error("ROMREADER: Something went wrong while trying to load the game.");
		};
		reader.readAsArrayBuffer(file);
	};

	//* Search Methods *//
	findByInt(chain, start, end){
		end = end || this.size;
		let result = [];
		let last = chain[0];
		for(let k = start || 0, c = 0, equal = 0; (k + equal) < end; k++){
			if(last == this.getByte(k) || last < 0){
				equal++;
				if(equal == chain.length){ // found
					equal = 0;
					result.push(k-chain.length+1);
					c++;
					k += chain.length-1;
				}
			}else{
				equal = 0;
			}
			last = chain[equal];
		}
		return result;
	};

	findByHex(hex, start, end){
		if(hex.length % 2 == 0){
			return this.findByInt(hex.match(/.{1,2}/g).map((a)=>{return (~a.indexOf("X") ? -1 : parseInt(a, 16))}), start, end);
		}else{
			console.error("ROMREADER: Hexadecimal chains have to be even.");
			return null;
		}
	};

	findByDictionary(chain, name, start, end){
		let dictionary = this.getDictionary(name);
		let text2hex = [...chain].map(e=>{ return(dictionary == null?e.charCodeAt(0):dictionary.indexOf(e))});
		return this.findByInt(text2hex, start, end);
	};

	/* Memory Manipulation */
  write_hex_memory(p = 0x000000, hex = 0x00){
		
  };

  write_char_memory(p = 0x000000, char = ' '){

  };

	getTableSize(o, e = this.size){
		let c = 0;
		while(this.isROMOffset(this.getOffset(o)) && o < e){ o += 4; c++; }
		return c;
	};

	/* Items are stored like this:
		// string "????????($->endline)" (MAX 14bytes)
		// 2 byte -> Item index
		// 2 byte -> Price
		// 1 byte -> HOLD_EFFECT_NONE
		// 1 byte -> Increasing time repels, pokémon stats...
		// 4 byte -> Description Type
		// 1 byte -> Pbbly means key shortcut (start) [DEVON GOODS => 2] (?)
		// 1 byte -> Pbbly means key shortcut (select) (?)
		// 1 byte -> Pocket position
		// 1 byte -> Number Pocket (?)
		// 4 byte -> Out of battle
		// 4 byte ->							<:
		// 4 byte -> In battle		<:
		// 4 byte -> Obtaining Order (Rod, Mail, Pokémon...)
	loadItemsFromMemory(){
		let isItem = true;
		let offset = this.memoryOffsets.item_header;
		let dictionary = this.getDictionary("Text");
		while(isItem){
			let itemName = this.getTextByOffset(dictionary, offset, 14);
			if(itemName != ""){
				this.items.push({
					name: itemName,
					index: this.getShort(offset + 14),
					price: this.getShort(offset + 16),
					hold: this.getByte(offset + 18),
					duration: this.getByte(offset + 19),
					description: this.getOffset(offset + 20),
					shortcut0: this.getByte(offset + 24),//?
					shortcut1: this.getByte(offset + 25),//?
					pocket: this.getByte(offset + 26),
					numberPocket: this.getByte(offset + 27), //?
					pointerOutBattle: this.getOffset(offset + 28),

					actionInBattle: this.getOffset(offset + 32),	//?
					pointerInBattle: this.getOffset(offset + 36),

					obtainingOrder: this.getOffset(offset + 40)
				});
				offset += 0x2C;
			}else{
				isItem = false;
			}
		}
	};
*/

	/* Main Methods. */
	setGameInformation(i){ this.lang = i.lang; this.type = i.base; };

	init(){
		/* Adding all diccionaries to buffer. */
		FileHandler.load(["./decrypt/text_table_en.json", "./decrypt/dcccode.json", "./decrypt/dccmovement.json"], results=>{
			results.forEach(r=>{
				let json = JSON.parse(r.result);
				let dictionary = new Array(256);
				for(let key in json){
					dictionary[parseInt(key, 16)] = json[key];
				}
				this.dictionary[r.path.split("/")[2].split(".")[0]] = dictionary;
			});

			change_workspace(0, "hex");
			this.hex_editor = new EHex(this);
			this.hex_editor.go(0x000000);
		});

	};
};
