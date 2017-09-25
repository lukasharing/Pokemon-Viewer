/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is coded by Lukas Häring García and
    idea is taken from some other hacking programs.
*/
/*const Utils = require("utils.js"); Just Works with Serverside*/
class RomReader{
	constructor(){
		/* Game Variables */
		this.game_bases = [];
		this.gamePath = "";
		this.lang 		= "";
		this.type 		= "";
		this.version	= "";

		/* Editor Variables */
		this.editor = null;
		this.currentWorkspace    = "";
		this.comment = "//";

		//* Editor dictionary Variables *//
		this.dictionary         = [];
		this.selecteddictionary = "Text";

		/* Events Variables */
		this.click = {properties: {blocks: [0]}, down: false, x: 0, y: 0};

		/* Game Buffers Variables */
		this.memoryOffsets = {};
		this.memoryRom;

		/* Hexadecimal Visualization Variables */
		this.currentOffset 			= null;
		this.string_translation = [];

 		this.seed = true; // NOT TO TELL U

		/* Map Visualization Variables */
		this.maps 						= null;
		this.items						= [];
		this.bufferMemory 		= [];
		this.overworldSprites = [];
		this.camera = new Camera();
		this.currentMap = {
			map: undefined,
			image: null,
			loaded: false
		};

	};

	/* Pokemon Bases */
	setGameBases(n){ this.game_bases = n; };
	isFRLG(){ return (this.type == "fire_red" || this.type == "leaf_green"); }

	/* Editor dictionary Methods */
	getDictionary(n){ return this.dictionary[n]; };

	addDictionaries(urls){
		let ajaxs = new Array(urls.length);
		for(let j = 0; j < urls.length; j++){
			ajaxs[j] = $.ajax({ url: urls[j][1], dataType: 'text'}).done(data=>{
				let dictionary = [];
				$.each($.parseJSON(data), function(key, val) {
					dictionary[parseInt(key, 16)] = val;
				});
				this.dictionary[urls[j][0]] = dictionary;
			}).fail((a, error)=>{ console.error(`ROMREADER: ${error}`); });
		}
		return ajaxs;
	};

	/* Game Buffers Methods */
	getInt(o)			{ return(this.memoryRom[o]|this.memoryRom[o+1]<<8|this.memoryRom[o+2]<<16|this.memoryRom[o+3]<<24);};
	getPointer(o)	{ return Math.max(0, this.getInt(o) - 0x8000000); };
	getShort(o)		{ return(this.memoryRom[o]|this.memoryRom[o+1]<<8);};
	getRhort(o)		{ return(this.memoryRom[o+1]|this.memoryRom[o]<<8);};
	getByte(o)		{ return(this.memoryRom[o]); };
	offsetExtension(a){ return (a == 0x08 || a == 0x09); };

	loadROM(file, info){
		let reader = new FileReader();
		let self = this;
  	reader.onload = function(e){
			self.memoryRom = new Uint8Array(this.result);

			// System game detection.
			let isPokemonGame = true;
			if(!Utils.isObject(info)){
				for(let gameName in self.game_bases){
					if(gameName !== 'global'){
					let rom = self.game_bases[gameName];
						for(let lng in rom.memory){
							let game = rom.memory[lng];
							for(let j = 1; j <= 2 && game.version != undefined; j++){
								let version = game.version["offset_v" + j];
								if(version > 0){
									let search = game.version.string;
									if(self.getTextByPointer(null, version, search.length) == search){
										info = {lang: lng, base: gameName};
									}
								}
							}
						}
					}
				}
				if(info.lang == null) isPokemonGame = false;
			}

			let {lang, base} = info;
			if(isPokemonGame){
				for(let prop in self.game_bases.global){
					let offset = self.game_bases.global[prop];
					let find = self.findByHex(offset.chain);
					self.memoryOffsets[prop] = self.getPointer(find[offset.index] + offset.chain.length/2);
				}
				self.setGameInformation(lang, base, file.name);
				self.init();

				/* jQuery stuff */
				$("#cancel_button").click();
				$("#loadingScreen").addClass("hide");

				/* Put logo into selected game and class it. */
				/*let button = $("#buttonFile");
				let logo_path = "css/images/roms/logo/" + baseName.logo.replace("$", lang);
				button.attr("class", "rom_button_" + baseName).find("div").addClass("hide");
				button.find("img").removeClass("hide").attr("src", logo_path);*/
			}else{
				console.error("ROMREADER: This is not a Pókemon Game");
			}
		};
		reader.onloadstart = function(e){
			$("#loadingScreen").removeClass("hide");
			$("#game_selection").addClass("hide");
		};
		reader.onprogress = function(e){
			if(e.lengthComputable){
				let percentComplete = Math.round(e.loaded / e.total * 100);
				$("#loadingScreen h3").text("Loading the game: " + percentComplete + "%");
				$("#loadingScreen .loader").css("width", percentComplete + "%");
			}
		};
		reader.onerror = function(e){
			console.error("ROMREADER: Something went wrong while trying to load the game.");
		};
  	reader.readAsArrayBuffer(file);
	};

	/* Hexadecimal Visualization Methods */
	addHexPanel(id, symmetry){
		this.changeWorkspace("hex");

		/* Code that generates the hex pannel*/
		let panel = `<div class="hexArea" id="${id}"><div class="lefthexpanel"></div><div class="righthexpanel"><div class="hexheaderpanel">`;
		[..."0123456789ABCDEF"].forEach(function(a){panel+=`<div class='hexNum'>${a.toString(16)}</div>`});
		panel += `<div class='clear'></div></div><div class='hexZone'><div class='hexScroll'></div></div></div><div class='clear'></div></div>`; /* <-- */
		$("#hexEditor").prepend(panel);

		let self = this;
		if(symmetry !== undefined){
			$("#" + id).bind('mousewheel DOMMouseScroll mouseleave', function(event){
				if(event.type == "mouseleave"){
					$(this).data("click", false);
				}else{
					let wheel = event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0;
					let offset = Math.max(0, self.currentOffset + (1-2*wheel) * 0x10);
					self.hexResult(offset, "hexResult", "hexTranslate", "Text");
				}
			}).on("mouseenter mouseleave", ".fieldValue", function(e){
				if(e.type == "mouseleave"){
					$(".fieldValuehover").removeClass("fieldValuehover");
				}else{
					$(this).addClass("fieldValuehover");
					$("#" + symmetry + " .fieldValue[data-offset=" + $(this).data("offset") + "]").addClass("fieldValuehover");
				}
			}).on("mouseenter mousedown mouseup", ".byteValue", function(e){
				let offset 	= $(this).parent().data("offset");
				let type 		= e.type;
				let click 	= $("#" + id).data("click");
				if(type == "mouseenter" && click){
						$(this).data("selected", true);
						$(this).addClass("byteValuehover");
						$("#" + symmetry + " .fieldValue[data-offset=" + offset + "] .byteValue:eq(" + $(this).index() + ")").addClass("byteValuehover");
				}else if(type == "mousedown"){
					$(".byteValuehover").data({selected: false, selected: ""}).removeClass("byteValuehover");
					$("#" + id).data("click", true);
					$(this).data({selected: true, selected: "first"});
					$(this).addClass("byteValuehover");
				}else if(type == "mouseup"){
					$("#" + id).data("click", false);
					$(this).data("selected", "last");
				}
			});
		}
	};
	hexResult(offset, id, child, dictionary){
		this.changeWorkspace("hex");
		let difference = offset - this.currentOffset, abs = Math.abs(difference);
		let size = (Math.floor($(window).height() / 36) - 1) * 16;
		if(abs == 0) abs = size;
		dictionary  = this.dictionary[dictionary];
		let content = "", symmetry = "", leftside = "";
		for (let i = offset; i < offset + Math.min(abs, size); i += 16){
			leftside += `<div class="hexValue">${Utils.pad(i.toString(16), '0', 8)}</div>`;
			content += `<div class="fieldValue" data-offset="${i}">`;
			symmetry += `<div class="fieldValue" data-offset="${i}">`;
			for(let j = i; j <= i + 0xf; j++){
				let byte = this.getByte(j);
				let value = (dictionary == undefined) ? String.fromCharCode(byte) : dictionary[byte];
				content += `<div class='byteValue'>${Utils.pad(byte.toString(16).toUpperCase(), '0', 2)}</div>`;
				symmetry += `<div class='byteValue ${value==undefined?"emptybyte'>":(`'>${value}`)}</div>`;
			}
			content += "<div class='clear'></div></div>";
			symmetry += "<div class='clear'></div></div>";
		}

		if(abs > size){
			$(`#${id} > .lefthexpanel`).html(leftside);
			$(`#${child} > .righthexpanel .hexScroll`).data("dictionary", dictionary).html(symmetry);
			$(`#${id} > .righthexpanel .hexScroll`).html(content);
		}else if(abs > 0){
			let index = (abs - difference) * (size - abs) / (32 * abs);
			for(let k = 0; k < abs/16; k++){
				$(`#${id} .hexValue:eq(${index})`).remove();
				$(`#${child} .fieldValue:eq(${index})`).remove();
				$(`#${id} .fieldValue:eq(${index})`).remove();
			}
			if(difference > 0){
				$(`#${id} > .lefthexpanel`).append(leftside);
				$(`#${child} > .righthexpanel .hexScroll`).append(symmetry);
				$(`#${id} > .righthexpanel .hexScroll`).append(content);
			}else{
				$(`#${id} > .lefthexpanel`).prepend(leftside);
				$(`#${child} > .righthexpanel .hexScroll`).prepend(symmetry);
				$(`#${id} > .righthexpanel .hexScroll`).prepend(content);
			}
		}
		this.currentOffset = offset;
	};
	//* Search Methods *//
	findByInt(chain, start, end){
		end = end || this.memoryRom.length;
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
		return this.findByInt([...chain].map(e=>{ return(dictionary == null?e.charCodeAt(0):dictionary.indexOf(e))}), start, end);
	};

	addDefinitions(urls){
		let ajaxs = new Array(urls.length);
		for(let j = 0; j < urls.length; j++){
			let regex = new RegExp("#define.*", "g");
			ajaxs[j] = $.ajax({ url: urls[j], dataType: 'text'}).done(data=>{
				let textReg = regex.exec(data);
				while(textReg){
					let white = textReg[0].split(" "), splName = white[1].split(/_(.+)?/), nameDef = splName[0];
					if(this.string_translation[nameDef] === undefined){ this.string_translation[nameDef] = []; }
					this.string_translation[nameDef].push({hexadecimal: parseInt(white[2], 16), EN_def: splName[1]});
					textReg = regex.exec(data);
				}
			}).fail((jqXHR, textStatus)=>{ console.error(`ROMREADER ${textStatus}`); });
		}
		return ajaxs;
	};

	/* Code Visualization Methods */
	writeTextPreview(t, n){return(` /* ${([...t].map((v,i,a)=>{return(i>n?undefined:a[i])}).join('')+(t.length<=n?"":"..."))} */`);};
	addTitleBlock(title){return(`${this.comment}---------------\n${this.comment} ${title}\n${this.comment}---------------\n`); };
	toHexadecimal(b, k){
		let hexfinal = 0;
		for(let n = 0; n < k; n++){
			hexfinal |= this.getByte(b + n) << (n * 8);
		}
		return hexfinal;
	};
	writeHexadecimal(o, s){return(` 0x${this.toHexadecimal(o, s).toString(16).toUpperCase()}`)};
	getTextByPointer(dictionary, begin, length){
		let char = this.getByte(begin);
		let maxsize = (length == undefined ? (this.memoryRom.length-begin) : Math.min(length, this.memoryRom.length-begin));
		let text = "", isText = true, k = 0;
		while(char != 0xff && k < maxsize && isText){
			if(dictionary == null){
				text += String.fromCharCode(char);
			}else{
				let translation = dictionary[char];
				if(translation == undefined){
					isText = false;
				}else{
					text += translation;
				}
			}
			char = this.getByte(begin+(++k));
		}
		return isText ? text : "";
	};
	writeRAWList(buffer, txt, n, dictionary, end, step){
		let text = "";
		if(buffer[n].length > 0){
			text += this.addTitleBlock(txt);
			for(let b = 0; b < buffer[n].length; b++){
				let offset = buffer[n][b];
				text += `#org 0x${offset.toString(16).toUpperCase()}\n`;
				let i = this.getShort(offset)&(step*0xff);
				while(i != end){
					text += `#raw ${["byte", "word"][step - 1]} 0x${i.toString(16).toUpperCase()}\u0009 ${this.comment} `;
					if(dictionary != undefined){
						if(dictionary == "items"){
							if(this[dictionary][i] != undefined){
								text += this[dictionary][i].name;
							}
						}
					}else{
						text += "Unknown";
					}
					text += "\n";
					i = this.getShort(offset += step) & (step*0xff);
				}
				text += `#raw ${["byte", "word"][step - 1]} 0x${end.toString(16).toUpperCase()}\u0009 ${this.comment} End of ${dictionary}\n`;
				if(b < buffer[n].length - 1){ text += "\n"; }
			}
			text += "\n\n";
		}
		return text;
	};
	codeResult(codeOffset){
		this.changeWorkspace("xse");
		let prevBit = this.getByte(Math.max(0, codeOffset - 1));
		let code = this.addTitleBlock("Code");
		if(prevBit <= 0x08 || prevBit == 0x66 || prevBit == 0x27 || prevBit >= 0xFE){
			/* Loading Diccionaries. */
			let cdedictionary = this.getDictionary("Code"),
					txtdictionary = this.getDictionary("Text"),
					movdictionary = this.getDictionary("Movement");

			let bufferHex = [[codeOffset /* CODE */], [/* DIALOGUE */], [/* MOVEMENT */], [/* POKEMART	*/], [/* BRAILLE */]];
			/* Code visualization. */
			let totaloffsets = 0;
			while(totaloffsets < bufferHex[0].length){
				let offset = bufferHex[0][totaloffsets++] & 0xffffff;
				code += `#org 0x${offset.toString(16).toUpperCase()}\n`;
				let finish = false;
				while(!finish){
					let org = cdedictionary[this.getByte(offset++)];
					code += org.val;

					for(let i = 0; i < org.bUsed.length; i++){
						let step_byte = org.bUsed[i];
						if(step_byte == -1){
							finish = true;
							break;
						}
						if(step_byte instanceof Array){
							let name = step_byte[0];
							let byte = this.toHexadecimal(offset, step_byte[1]);

							/* Translate the bit into a known char. */
							if(this.string_translation[name] != null){
								let type = this.string_translation[name].find(a=>(a.hexadecimal==byte));
								if(type == null){
									code += ` 0x${byte.toString(16).toUpperCase()}`;
								}else{
									code += ` ${type.EN_def}`;
								}
							}else if(name != "NULL"){
								code += ` 0x${byte.toString(16).toUpperCase()}`;
							}

							let block = byte & 0xffffff, index = null;
							switch(name){
								case "OFFSET":
									index = 0;
								break;
								case "TEXT":
									index = 1;
									code += this.writeTextPreview(this.getTextByPointer(txtdictionary, block), 34);
								break;
								case "RAW":
									index = 2;
								break;
								case "MART":
									index = 3;
								break;
								case "BRAILLE":
									index = 4;
								case "CMP":
									code += " goto";
								break;
							}

							if(index != null && bufferHex[index].indexOf(block) == -1){
								bufferHex[index].push(block);
							}

							offset += step_byte[1];
						}else{
							code += this.writeHexadecimal(offset, step_byte);
							offset += step_byte;
						}
					}
					if(org.val == "trainerbattle"){
						/* TODO: (??)
						0 -> 2
						4 -> 3
						*/
						let trainer = this.getByte(offset - 13);
						if(trainer == 0x2){
							let script = this.toHexadecimal(offset, 4);
							if(bufferHex[0].indexOf(script) == -1){
								bufferHex[0].push(script);
							}
							code += this.writeHexadecimal(offset, 4);
							offset += 4;
						}
					}

					code += "\n";
				}

				if(bufferHex[0].length != totaloffsets){
					code += "\n//---------------\n";
				}else if(bufferHex[1].length > 0){
					code += "\n\n";
				}
			}

			/* Speech box code visualization. */
			if(bufferHex[1].length > 0){
				code += this.addTitleBlock("Strings");
				for(let b = 0; b < bufferHex[1].length; b++){
					let hexMsg = bufferHex[1][b];

					let text = this.getTextByPointer(txtdictionary, hexMsg);
					code += `#org 0x${hexMsg.toString(16).toUpperCase()}\n= ${text}\n`;
					if(b < bufferHex[1].length - 1){
						code += "\n";
					}
				}
				for(let k = 2; k < bufferHex.length; k++){
					if(bufferHex[k].length > 0){
						code += "\n\n";
						break;
					}
				}
			}

			/* Movements code visualization. */
			code += this.writeRAWList(bufferHex, "Movements", 2, undefined, 0xFE, 1);
			/* Pokémart code visualization. */
			code += this.writeRAWList(bufferHex, "MartItems", 3, "items", 0x0, 2);
			/* Braille code visualization.
			 		TODO:
						*Not working fine, I only know that ends with 0x3 but it can start with 0x3, maybe 0x3 means stop?
			*/
			//code += this.writeRAWList(bufferHex, "Braille", 4, null, 0x3, 2);
		}
		this.editor.setValue(code);
	};

	/* GBA MUSIC
	B1: ends song as far as I can tell, a song is always ended with B1, also when looping.
	B2 <pointer>: loops song
	B3 <pointer>: Jump to other part of song
	B4: Return from other part of song
	BB <byte>: set tempo (offset?)
	BC <byte>: set pitch (offset)
	BD <byte>: set instrument
	BE <byte>: set volume
	BF <byte>: set spanning
	C0-CE :
	CF-FF : Play a note.
	this.getSongInfo = function(a){
		let songtable = this.getOffset("songtable");
		let table = songtable.offset + parseInt(songtable[a], 16) * 8;
		let header = this.getPointer(table);
		let voices = this.getPointer(header + 4);
		let tracks = [], index = header + 11;
		while(this.getByte(index) == 0x8){
			tracks.push(this.getPointer(index-3));
			index += 4;
		}
		let instruments = [], index = voices;
		for(let i = voices; i < voices + 0x600; i += 0xC){
			let type = this.getByte(i);
			let instrument = {type: type, offset: i};
			if(type % 0x40 == 0 || type == 0x3 || type == 0xB){
				let offsets = 0;
				instrument.offsets = [this.getPointer(i + 4)];
				if(type == 0x40){
					instrument.offsets.push(this.getPointer(i + 8));
				}
			}
			if(this.getByte(i+1) == 0x3C){
				instrument.adsr =[this.getByte(i+8),this.getByte(i+9),this.getByte(i+10),this.getByte(i+11)];
			}
			instruments.push(instrument);
		}

		return {table: table,
						header: {offset: header, tracks: tracks},
						voicegroup: {offset: voices, instruments: instruments}};
	};

	this.playMusic = function(m, k){
		let self = this;
		let f = m[k];
		let kj = {a:this.getByte(f + 8), d:this.getByte(f + 9), s:this.getByte(f + 10), r:this.getByte(f + 11)};
		let env = T("adshr", kj, T("sin")).on("ended", function() {
			this.pause();
			if(k < m.length) self.ADSR(m, k + 1);
		}).bang().play();
	};
	*/

	/* Compression and Decompression Methods. */
	LZSS_Decompress(offset, totalunCompressed){
		let position = 0, uncompressed = [];
		while(position < totalunCompressed){
			let compressed = this.getByte(offset++);
			for(let bit = 7; bit >= 0; bit--){
				if(compressed >> bit & 1){
					let short = this.getRhort(offset);
					let size = position + ((3 + (short>>0xC)) << 1);
					let copy = ((short & 0xFFF) + 1) << 1;
					for (let u = position; u < size; u += 2){
						uncompressed[u] = uncompressed[u - copy];
						uncompressed[u + 1] = uncompressed[u + 1 - copy];
					}
					offset 	 += 2;
					position = size;
				}else{
					let b = this.getByte(offset++);
					uncompressed[position++] = b & 0xf;
					uncompressed[position++] = b >> 4;
				}
				if(position >= totalunCompressed) break;
			}
		}
		return uncompressed;
	};
	GBA_Decompress(offset, total){
		let compress = [];
		for(let k = 0; k < total; k++){
			let b = this.getByte(offset + k);
			compress[k * 2] = b & 0xf;
			compress[k * 2 + 1] = b >> 4;
		}
		return compress;
	};

	/* Image Manipulation Method. */
	getMapContext(){ return $("#canvas_map")[0].getContext("2d"); };

	//** Colors *//
	GBA2HEX(pal){ return((pal&0x1F)<<19|(pal&0x3e0)<<6|(pal&0x7c00)>>7);};
	HEX2GBA(pal){
		let encode = (pal&0x0000ff)<<7|(pal&0x00ff00)>>6|(pal&0xff0000)>>19;
		return((encode&0xff)<<8|encode>>8);
	};

	//* Paletes Methods *//
	getPalettes(offset){return(new Array(16).fill(0).map((a,b)=>this.GBA2HEX(this.getShort(offset + b * 2))));};
	/*
		--> RSE 0-5 Primary 6-12 Secondary
		--> FL  0-6 Primary 7-12 Secondary
	*/
	getTilesetPalettes(offset, primary){return [].concat(...(new Array(0x6|(primary^this.isFRLG())).fill(0).map((a,b)=>this.getPalettes(offset + b * 32))))};

	/* Map Visualization Methods
		---WHEATHER---
		00 = house weather
		01 = sunny weather with clouds in the water
		02 = normal weather
		03 = rain weather
		04 = 3 flakes
		05 = rains with thunderstorm
		06 = nebulas remains nearly on the place
		07 = continuous snow
		08 = sandstorm
		09 = nebulas blows from above right
		0A = poet bright fog
		0B = cloudy
		0C = underground flashes
		0D = much rain with thunderstorm
		0E = underwater fog

		Permission byte: 00 = no flies : 02 = flies
		Cave: 00 = normal : 01 lightning applicable : 02 lightning not applicable

		Combat type:
		00 = coincidental
		01 = arena Style
		02 = team Rocket Style
		03 = ???
		04 = 1. Top-4
		05 = 2. Top-4
		06 = 3. Top-4
		07 = 4. Top-4
		08 = red POKéBALL
		*/
	getTableSize(b, e = this.memoryRom.length){
		let c = 0;
		while(this.offsetExtension(this.getByte(b + 3)) && b < e){ b += 4; c++; }
		return c;
	};

	getMap(bank, map){ return (this.maps[bank] != undefined && this.maps[bank][map] != undefined) ? this.maps[bank][map] : undefined; };


	/* IDEA:
		distribution:
			-- Structure: 00XX00XX080000
			-- XX -> 40, 80, (C0->For now at the last XX)
			FIRERED:
				16x16 Pixels 	-> 3815152 -> 7
				16x32 Pixels 	-> 3815184 -> 3
				Ship (Big)		-> 3815136 -> 9
				Island Ship 	-> 3815200 -> 1
				Legendary Bird-> 3815192 -> 2
			RUBY:
					16x16 Pixels 	-> 3609044 -> 6
					16x32 Pixels 	-> 3609068 -> 3
					Machoque,Truck, Regis-> 3609076 -> 2
			sizedraw:
				-- Structure: 00000000 XX000000XXXXXX08
				-- First XX -> ??
				-- Last XX -> Offset ??
	*/

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

	removeEvent(a, b){ this.currentMap.events[a].splice(b, 1); };

	addEvent(x, y, t){
		let event;
		if(t == 0){ /* Person */
			event = { picture: 0, ud1: 0, x: x, y: y, heightlevel: 0, movement_type: 0, movement_radius: 0, ud2: 0, is_trainer: 0, ud3: 0, range_vision: 0, script: 0, status: 0, ud4: 0 };
		}else if(t == 1){ /* Warp */
			event = { x: x, y: y, heightlevel: 0, warp: 0, bank: 0, map: 0 };
		}else if(t == 2){ /* Script */
			event = { x: x, y: y, heightlevel: 0, number: 0, value: 0, script: 0 };
		}else if(t == 3){ /* Sign */
			event = { x: x, y: y, heightlevel: 0, type: 0, ud0: 0, special: 0, quantity: 0 };
		}else{ return; }
		this.currentMap.events[t].push(event);
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
	*/
	loadItemsFromMemory(){
		let isItem = true;
		let offset = this.memoryOffsets.item_header;
		let dictionary = this.getDictionary("Text");
		while(isItem){
			let itemName = this.getTextByPointer(dictionary, offset, 14);
			if(itemName != ""){
				this.items.push({
					name: itemName,
					index: this.getShort(offset + 14),
					price: this.getShort(offset + 16),
					hold: this.getByte(offset + 18),
					duration: this.getByte(offset + 19),
					description: this.getPointer(offset + 20),
					shortcut0: this.getByte(offset + 24),//?
					shortcut1: this.getByte(offset + 25),//?
					pocket: this.getByte(offset + 26),
					numberPocket: this.getByte(offset + 27), //?
					pointerOutBattle: this.getPointer(offset + 28),

					actionInBattle: this.getPointer(offset + 32),	//?
					pointerInBattle: this.getPointer(offset + 36),

					obtainingOrder: this.getPointer(offset + 40)
				});
				offset += 0x2C;
			}else{
				isItem = false;
			}
		}
	};

	loadOverworldSprites(){
		let sprites = [];
		let index = 0;

		/* Obtaning Sprites paletes. */
		let palettes = [];
		let paletteOffset = this.memoryOffsets.sprite_palette;
		let byte = this.getByte(paletteOffset + 3);
		while(this.offsetExtension(byte)){
			palettes[this.getByte(paletteOffset + 4)] = this.getPalettes(this.getPointer(paletteOffset));
			byte = this.getByte((paletteOffset += 8) + 3);
		}

		/* Passing through every sprite. */
		let offset = this.memoryOffsets.sprite_header;
		while(this.offsetExtension(this.getByte(offset + 3))){
			let pointer = this.getPointer(offset);
			if(this.getShort(pointer) == 0xFFFF){
				let texture = this.getPointer(pointer + 28);
				if(this.offsetExtension(this.getByte(texture + 3))){
					let decompression = this.GBA_Decompress(this.getPointer(texture), this.getShort(texture + 4));
					let palette = palettes[this.getByte(pointer + 2)];

					let previewCanvas = document.createElement("canvas");
					let width 	= previewCanvas.width 	= this.getShort(pointer + 8);
					let height 	= previewCanvas.height 	= this.getShort(pointer + 10);
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
						synch: this.getShort(pointer + 6),
						slot: this.getByte(pointer + 12),
						overwrite: this.getByte(pointer + 13),
						empty: this.getShort(pointer + 14),
						distribution: this.getPointer(pointer + 16),
						sizedraw: this.getPointer(pointer + 20),
						shiftdraw: this.getPointer(pointer + 24),
						ram: this.getPointer(pointer + 32),
						ud1: this.getShort(texture + 6)
					});
				}
			}
			offset += 4;
		}
		this.overworldSprites = sprites;
	};
	/*
		Definitions:
		X -> Coord X
		Y -> Coord Y
		U -> Undefined
		E -> Empty
		O -> Offset
	*/
	loadMapsFromMemory(){
		let total_banks = this.getTableSize(this.memoryOffsets.map_header);
		this.maps = new Array(total_banks);
		for(let i = 0; i < total_banks; i++){
			let type 				= this.isFRLG();
			let offset 			= this.getPointer(this.memoryOffsets.map_header + i * 4);
			let nextoffset 	= this.getPointer(this.memoryOffsets.map_header + (i + 1) * 4);
			if(nextoffset < offset) nextoffset = this.memoryOffsets.map_header;

			let left = `<div class='bank_option'> <div class='bank_name'>Bank ${i}</div>`;

			let total_maps = this.getTableSize(offset, nextoffset);
			this.maps[i] = new Array(total_maps);
			for(let j = 0; j < total_maps; j++){
				let header = this.getPointer(offset + j * 4);
				let map = this.getPointer(header);
				let byt3 = this.getByte(header + 3), byt7 = this.getByte(header + 7), byt15 = this.getByte(map + 15);
				if(this.offsetExtension(byt3) && this.offsetExtension(byt7) && this.offsetExtension(byt15)){
					/* Creating map blocks structure. */
					let wmap = this.getInt(map);
					let hmap = this.getInt(map + 4);
					let structOffset = this.getPointer(map + 12);
					let structure = [];

					if(wmap > 0xff || hmap > 0xff) return 0;

					for(let j = 0, jj = 0; j < hmap; j++, jj += wmap){
						structure[j] = [];
						for(let i = 0; i < wmap; i++){
							structure[j][i] = this.getShort(structOffset + (jj + i) * 2);
						}
					}

					/* Reading and Adding all Connections to buffer */
					let connection = this.getPointer(header + 12);
					let connections = [];
					if(connection != 0x0){
						let total = this.getInt(connection);
						let pconn = this.getPointer(connection + 4);
						for(let c = 0; c < total; c++){
							connections.push({
								direction: this.getInt(pconn),
								offset: this.getInt(pconn + 4),
								bank: this.getByte(pconn + 8),
								map: this.getByte(pconn + 9)
							});
							pconn += 12;
						}
					}

					/* Events in map */
					let pointer_events = this.getPointer(header + 4);

					/* Reading and Adding Pjs to buffer.*/
					let persons = [];
					let firstperson = this.getPointer(pointer_events + 4);
					let lastperson = firstperson + this.getByte(pointer_events) * 24;
					for(let i = firstperson; i < lastperson; i += 24){
						persons[this.getByte(i)-1/* internal index */] = {
							picture: this.getByte(i + 1),
							ud1: this.getShort(i + 2), // Always 00,
							x: this.getShort(i + 4),
							y: this.getShort(i + 6),
							heightlevel: this.getByte(i + 8),
							movement_type: this.getByte(i + 9),
							movement_radius: this.getByte(i + 10),
							ud2: this.getByte(i + 11), // Always 0
							is_trainer: this.getByte(i + 12), // 0 -> No, 1 -> Yes
							ud3: this.getByte(i + 13), // Always 0
							range_vision: this.getShort(i + 14), // Vision Range [0, FF].
							script: this.getPointer(i + 16),
							status: this.getShort(i + 20),
							ud4: this.getByte(i + 21) // 0 -> ----, 1 -> Never ----, 2 -> ----, 3 -> ----, 4 ->
						};
					}
					/* Reading and Adding Warps to buffer.*/
					let warps = [];
					let firstwarp = this.getPointer(pointer_events + 8);
					let lastwarp = firstwarp + this.getByte(pointer_events + 1) * 8;
					for(let i = firstwarp; i < lastwarp; i += 8){
						warps.push({
							x: this.getShort(i),
							y: this.getShort(i + 2),
							ud1: this.getByte(i + 4),
							warp: this.getByte(i + 5),
							bank: this.getByte(i + 6),
							map: this.getByte(i + 7)
						});
					}

					/* Reading and Adding Scripts to buffer.
						XXYYUUUUEEEEOOOO
					*/
					let triggers = [];
					let firsttrigger = this.getPointer(pointer_events + 12);
					let lasttrigger = firsttrigger + this.getByte(pointer_events + 2) * 16;
					for(let i = firsttrigger; i < lasttrigger; i += 16){
						triggers.push({
							x: this.getShort(i),
							y: this.getShort(i + 2),
							heightlevel: this.getByte(i + 4),
							number: this.getShort(i + 6),
							value: this.getByte(i + 8),
							script: this.getPointer(i + 12)
						});
					}

					/* Reading and Adding Signs and Drops to buffer.
						XXYYUUUUOOOO
					*/
					let signs = [];
					let firstsign = this.getPointer(pointer_events + 16);
					let lastsign = firstsign + this.getByte(pointer_events + 3) * 12;
					for(let i = firstsign; i < lastsign; i += 12){
						signs.push({
							x: this.getShort(i),
							y: this.getShort(i + 2),
							heightlevel: this.getByte(i + 4),
							type: this.getShort(i + 5),
							ud0: this.getByte(i + 7),
							special: this.getPointer(i + 8),
							quantity: this.getByte(i + 11),
						});
					}

					let palettes = [];
					let tilesets = [];
					let blocks = [];
					/* There are two tilesets in each map. */
					for(let i = 0; i < 2; i++){
						let offset = this.getPointer(map + 16 + 4 * i);

						/* Obtaning the palettes from the tilesets. */
						let primary = this.getByte(offset + 1); /* Primary tileset [Byte] */
						let palette = this.getPointer(offset + 8) + 0x20 * (6 + this.isFRLG()) * primary; /* Palette Offset */
						let pal = this.bufferMemory[palette];
						if(pal == null){
							this.bufferMemory[palette] = this.getTilesetPalettes(palette, primary);
						}
						palettes.push(palette);

						/* Obtaning blocks. */
						let blocksPointer = this.getPointer(offset + 12);
						let endBlocks			= type ? this.getPointer(offset + 20) : this.getPointer(offset + 16);
						if(this.bufferMemory[blocksPointer] == null){
							let realBlocks 	= (endBlocks - blocksPointer) >> 4;
							let totalBlocks = Math.max(0x200, realBlocks);
							let dataBlocks = [];
							for(let b = 0; b < totalBlocks; b++){
								let block = [];
								for(let o = 0; o < 8; o++){
									let att = this.getShort(blocksPointer + (b<<4) + (o<<1));
									block[o] = [att >> 12, att & 0x3ff, (att >> 10) & 0x3];
								}
								dataBlocks.push(block);
							}
							this.bufferMemory[blocksPointer] = {blocks: dataBlocks, totalBlocks: realBlocks};
						}
						blocks.push(blocksPointer);

						/* Creating tile blocks. */
						let image = this.getPointer(offset + 4);
						let tileset = this.bufferMemory[image];
						if(tileset == null){
							let tiles;
							if(this.getByte(image)){/* Compression byte. */
								let totalunCompressed = this.getByte(image + 1)<<1|this.getByte(image + 2)<<9|this.getByte(image + 3)<<17;
								tiles = this.LZSS_Decompress(image + 4, totalunCompressed);
								for(let b = tiles.length; b < 0x8000; b++){
									tiles[b] = 0;
								}
							}else{
								tiles = this.GBA_Decompress(image, 0x4000);
							}
							this.bufferMemory[image] = tiles;
						}
						tilesets.push(image);
					}

					let displacement = 4 * ((2 - type) * (this.getByte(header + 20) - 88 * type) + 1 - type);
					let offsetName = this.getPointer(this.memoryOffsets[`map_name_${(this.isFRLG()|0)}`] + displacement);
					let mapName = this.getTextByPointer(this.getDictionary("Text"), offsetName);
					left +=`<div class="header_map">${j} ${mapName.replace("[FC]","")}</div>`;

					this.maps[i][j] = {
						name: mapName,
						header: header,
						script: this.getPointer(header + 8),
						connection: connections,
						events: [persons, warps, triggers, signs],
						border: this.getPointer(map + 8),
						structure: structure,
						palette: palettes,
						tileset: tilesets,
						block: blocks,
						border_width: this.getByte(map + 24),
						border_height: this.getByte(map + 25),
						music: this.getShort(header + 16),
						index: this.getShort(header + 18),
						visibility: this.getByte(header + 21),
						wheather: this.getByte(header + 22),
						type: this.getByte(header + 23),
						title: this.getByte(header + 26),
						wildpokemon: this.getByte(header + 27),

						width: structure[0].length * 16,
						height: structure.length * 16
					};
				}
			}
			$("#map_headers").append(`${left}</div>`);
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
			this.currentMap.loaded = false;

			/* Restore Camera */
			let element = $("#canvas_map")[0];
			this.camera.restore();
			this.camera.fitIn("#canvas_map");
			this.camera.set((this.camera.width - map.width) / 2, (this.camera.height - map.height) / 2);

			// Concat palettes and tiles */
			map.allPalettes = this.bufferMemory[map.palette[0]].concat(this.bufferMemory[map.palette[1]]);
			map.allTilesets = this.bufferMemory[map.tileset[0]].concat(this.bufferMemory[map.tileset[1]]);

			let blocks0 = this.bufferMemory[map.block[0]];
			let blocks1 = this.bufferMemory[map.block[1]];
			let blocks  = this.currentMap.allBlocks = blocks0.blocks.concat(blocks1.blocks);

			this.drawRightBlocks([blocks0, blocks1]);

			let ctx = this.getMapContext();
			ctx.webkitImageSmoothingEnabled = false;
			ctx.mozImageSmoothingEnabled = false;
			ctx.imageSmoothingEnabled = false;

			requestAnimationFrame(()=>this.render_map(ctx, ++this.seed));
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

				let dx = this.camera.x + (mapToDraw.x + mapToDraw.map.width) * zoom;
				let dy = this.camera.y + (mapToDraw.y + mapToDraw.map.height) * zoom;
				let cx = dx - mapToDraw.map.width * zoom;
				let cy = dy - mapToDraw.map.height * zoom;
				if((dx > 0 && cx < this.camera.width) && (dy > 0 && cy < this.camera.height)){
					x.drawImage(this.getMapPreview(mapToDraw.map), mapToDraw.x, mapToDraw.y);

					// Draw map name if this is not the current map.
					if(mapToDraw.map != this.currentMap){
						let mapname = mapToDraw.map.name;// + " [" + connection.bank + ", " + connection.map + "]";
						let letterSize = 30;
						let xText = mapToDraw.x + (mapToDraw.map.width>>1) - mapname.length * 8;
						let yText = mapToDraw.y + (mapToDraw.map.height>>1) + 10;
						//* BLACK RECTANGLE TODO: Change it to the 'Sign Background' *//
						x.beginPath();
						x.fillStyle = "rgba(10, 10, 10, 0.7)";
						x.rect(xText - 20, yText - 40, mapname.length * letterSize * 0.80, 60);
						x.fill();

						/* DISPLAY NAME TODO: USE POKEMON FONT TO SHOW THE NAME */
						x.font = "bold " + letterSize + "px Arial";
						x.fillStyle = "white";
						x.fillText(mapname, xText, yText);
					}
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

						// this.x = x - (x - this.x) * z;
						// this.y = y - (y - this.y) * z;
						if (!alreadyDrawnMaps.has(map.header)){
							if(typeof x !== "object"){
								let zoom = this.camera.zoom;
								let canvas = $("#canvas_map");
								let dx = (x - this.camera.x) - (mapToDraw.x + m) * zoom;
								let dy = (y - this.camera.y) - (mapToDraw.y + n) * zoom;
								if(dx >= 0 && dy >= 0 && dx <= map.width * zoom && dy <= map.height * zoom){
									return connection;
								}
							}

							nextMapsToDraw.push({ map: map, x: mapToDraw.x + m, y: mapToDraw.y + n });
							alreadyDrawnMaps.add(map.header);
						}
					}
				}
			}
		}

		if(typeof x === "object"){
			x.beginPath();
			x.rect(-2, -2, this.currentMap.width + 3, this.currentMap.height + 3);
			x.strokeStyle = "red";
			x.lineWidth = 3;
			x.stroke();
		}
	};

	getMapPreview(map){
		if(map.preview == undefined){
			map.allPalettes = this.bufferMemory[map.palette[0]].concat(this.bufferMemory[map.palette[1]]);
			map.allTilesets = this.bufferMemory[map.tileset[0]].concat(this.bufferMemory[map.tileset[1]]);

			let blocks0 = this.bufferMemory[map.block[0]];
			let blocks1 = this.bufferMemory[map.block[1]];
			let blocks  = map.allBlocks 	= blocks0.blocks.concat(blocks1.blocks);

			let previewCanvas = document.createElement("canvas");
			let twidth, theight;
			previewCanvas.width 	= (twidth 	= map.structure[0].length) * 16;
			previewCanvas.height 	= (theight 	= map.structure.length) * 16;
			let previewCanvasCtx = previewCanvas.getContext("2d");

			let img = previewCanvasCtx.createImageData(previewCanvas.width, previewCanvas.height);
			for(let j = 0; j < theight; j++){
				for(let i = 0; i < twidth; i++){
					this.drawBlock(i<<1, j<<4, blocks[map.structure[j][i]&0x3ff], map.allPalettes, map.allTilesets, img);
				}
			}
			previewCanvasCtx.putImageData(img, 0, 0);

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
	render_map(ctx, seed){
		let camera_width = this.camera.width;
		let camera_height = this.camera.height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, camera_width, camera_height);

		let xCamera = Math.round(this.camera.x);
		let yCamera = Math.round(this.camera.y);
		ctx.setTransform(this.camera.zoom, 0, 0, this.camera.zoom, xCamera, yCamera);

		this.camera.update();

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
		if(this.seed === seed){
			requestAnimationFrame(()=>this.render_map(ctx, seed));
		}
	};

	drawRightBlocks(blocks){
		let elm = $("#blocks_map")[0];
		let ctx = elm.getContext("2d");
		let realHeight = blocks.reduce((a, b)=>(a.totalBlocks + b.totalBlocks))>>3;
		let width = elm.width 	= 128, height = elm.height = realHeight << 4;
		ctx.clearRect(0, 0, width, height);
		let img = ctx.createImageData(width, height), data = img.data;
		for(let i = 0, total = width * height * 4; i < total; i+= 4){ data[i + 3] = 255; } // <--

		let currentHeight = 0;
		for(let k = 0; k < blocks.length; k++){
			let mapBlocks = blocks[k];
			realHeight = mapBlocks.totalBlocks >> 3;
			for(let j = 0; j < realHeight; j++){
				let y = currentHeight + j * 16, jj = j * 8;
				for(let i = 0; i < 8; i++){
					this.drawBlock(i * 2, y, mapBlocks.blocks[jj + i], this.currentMap.allPalettes, this.currentMap.allTilesets, img);
				}
			}
			currentHeight += realHeight<<4;
		}
		ctx.putImageData(img, 0, 0);
	};
	/*
		Method that draws a block to a given position and canvas.
	*/
	setBlock(x, y, block){
		let map = this.currentMap;
		map.structure[y][x] = block;
		let ctx = map.preview.getContext("2d");
		let helper 	= $("#canvashelper")[0];
		helper.width = helper.height = 16;
		let htx =	helper.getContext("2d");
		let dta = htx.createImageData(16, 16);
		this.drawBlock(0, 0, map.allBlocks[block], map.allPalettes, map.allTilesets, dta);
		htx.putImageData(dta, 0, 0);
		ctx.drawImage(helper, x * 16, y * 16);
	};

	drawBlock(x, y, block, paletes, tileset, canvas){
		let {width, data} = canvas;
		for(let b = 0; b < 8; b++){
			let tile = block[b];
			let index = tile[0] * 16, palette = tile[1] * 64, flip = tile[2];
			let x_flip = 7 * (flip & 0x1), y_flip = 3.5 * (flip & 0x2);
			for(let h = 0; h < 8; h++){
				let j = Math.abs(y_flip - h);
				for(let w = 0; w < 8; w++){
					let i = Math.abs(x_flip - w);
					let pixel = tileset[palette + j * 8 + i] & 0xf;
					if(pixel != 0){
						let id = ((y + (b&0x2) * 4 + h) * width + (x + (b&0x1)) * 8 + w) * 4;

						let color = paletes[index + pixel];
						data[id + 0] = (color >> 16) & 0xff;
						data[id + 1] = (color >> 8) & 0xff;
						data[id + 2] = color & 0xff;
						data[id + 3] = 255;
					}
				}
			}
		}
	};


	/*this.fillRectangle = function(data, x, y, width, height, color, lmw, lmh){
		let r = color>>16&0xFF, g = color>>8&0xFF, b = color&0xFF;
		for(let j = y; j < y + height; j++){
			let jj = j * lmw;
			for(let i = x; i < x + width; i++){
				let id = (jj + i) * 4;
				data[id] = r;
				data[id + 1] = g;
				data[id + 2] = b;
			}
		}
	};

	this.strokeRectangle = function(data, x, y, width, height, color, size, lmw, lmh){
		let r = color>>16&0xFF, g = color>>8&0xFF, b = color&0xFF;
		for(let j = 0; j < height; j++){
			let jj = (j + y) * lmw + x;
			let id0 = jj * 4, id1 = id0 + (width - 1) * 4;
			for(let b = 0; b < size; b++){
				data[id0] = r;
				data[id0 + 1] = g;
				data[id0 + 2] = b;
				data[id1] = r;
				data[id1 + 1] = g;
				data[id1 + 2] = b;
				id0 += 4;
				id1 -= 4;
			}
		}
		for(let i = size; i < width - size; i++){
			let jj = y * lmw + x + i;
			let id0 = jj * 4, id1 = id0 + (height - 1) * lmw * 4;
			for(let b = 0; b < size; b++){
				data[id0] = r;
				data[id0 + 1] = g;
				data[id0 + 2] = b;
				data[id1] = r;
				data[id1 + 1] = g;
				data[id1 + 2] = b;
				id0 += lmw * 4;
				id1 -= lmw * 4;
			}
		}

		@ sprite dimensions
			.align 2
		gUnknown_082087C4:: @ 82087C4
			@ square
			.byte 1, 1
			.byte 2, 2
			.byte 4, 4
			.byte 8, 8

			@ horizontal rectangle
			.byte 2, 1
			.byte 4, 1
			.byte 4, 2
			.byte 8, 4

			@ vertical rectangle
			.byte 1, 2
			.byte 1, 4
			.byte 2, 4
			.byte 4, 8

	};*/

	/* Main Methods. */
	setGameInformation(a, b, c){ this.lang = a; this.type = b; this.gamePath = c; };
	getGameLanguage(){ return this.lang; };
	getWorkspaceName(){ return this.currentWorkspace; };
	changeWorkspace(n){
		if(this.currentWorkspace != n){
			let menu_option = $(`#rightside_menu > div[data-value=${n}]`);
			$(".viewer_in").removeClass("viewer_in");

			menu_option.addClass("viewer_in");

			$("#rightpannel > div:not(.lightbox)").addClass('hide');
			$("#" + n + "Editor").removeClass('hide');
			if(menu_option.hasClass("icon-code")) this.editor.refresh();
			this.currentWorkspace = n;
		}
	};

	/* Time difference
	let now = new Date().getTime();
	console.log(new Date().getTime() - now);
	*/

	init(){
		/* Adding all diccionaries to buffer. */
		let ajaxdic = this.addDictionaries([["Text", "./decrypt/text_table_en.json"], ["Code", "./decrypt/dcccode.json"], ["Movement", "./decrypt/dccmovement.json"]]);

		/* Adding all definitions to buffer. */
		let ajaxdef = this.addDefinitions(["./definition/std.rbh", "./definition/stdpoke.rbh", "./definition/stdattacks.rbh"]);

		$.when(...ajaxdic, ...ajaxdef).then(()=>{
			/* Creating necessary panels. */
			$(".hexArea").remove();
			this.addHexPanel("hexTranslate", "hexResult");
			this.addHexPanel("hexResult", "hexTranslate");

			this.loadMapsFromMemory();
			this.loadItemsFromMemory();
			this.loadOverworldSprites();
			//this.changeMap(0, 0);
			/*0x14AE30
			 snop 	-> 20, 70, 47, 00
			 snop1	-> 20, 70, 47, 00
			 end 		-> B5, FF, F7, B5, FD, 00
			 return -> B5, FF, F7, D9, FD, 00
			*/
			// console.log(this.findByDictionary(""))
			this.hexResult(0x0, "hexResult", "hexTranslate");
			for(let i = 0; i < this.items.length; i++){
				let item = this.items[i];
				if(item != undefined){
					let name = item.name;
					if(!/^([T,H]M[0-9]{2})$/.test(name)){
						name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
					}
					$(".selectItems").append(`<option value="${i}">${name}</option>`);
				}
			}

			/* Creating all events. */
			let self = this;
			$("body").mousedown(function(e){
				self.click = {down: true, x: e.pageX, y: e.pageY};
			}).mouseup(function(e){
				self.click.down = false;
				$(".grabbing").removeClass("grabbing");
				self.camera.properties.map = undefined;
			});

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
				if(self.camera.zoom > 0.7 && event.which == 1 && $("#mousepannel").hasClass("hide")){
					if(e.ctrlKey){
						$(this).addClass("grabbing");
					}else{
						let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
						if(mouse instanceof Object){
							/* If you are in the map area */
							let xBlock = mouse.x, yBlock = mouse.y;
							if(e.altKey){
								let pick = self.getEvents(xBlock, yBlock, [0, 1, 2, 3]);
								if(pick.length > 0){
									self.camera.properties.grabbed = pick[0].event;
								}
							}else{
								let block  = self.camera.properties.block || 1;
								self.setBlock(xBlock, yBlock, block);
							}
						}else{
							/* Outside the map area, lets check if the mouse is over neighbour maps. */
							let dx = e.pageX - $(this).offset().left;
							let dy = e.pageY - $(this).offset().top;
							let map = self.neighbourhood(dx, dy);
							if(map != undefined){
								self.camera.properties.map = map;
							}
						}
					}
				}
			}).on("mousemove", function(e){
				e.preventDefault();
				let mouseX = e.pageX, mouseY = e.pageY;
				if(self.click.down && event.which == 1 && $("#mousepannel").hasClass("hide")){
					if(e.ctrlKey && !e.altKey){
						let canvas = $("#canvas_map");
						self.camera.vx += (mouseX - self.click.x)/8;
						self.camera.vy += (mouseY - self.click.y)/8;
						self.click.x = mouseX;
						self.click.y = mouseY;
					}else if(self.camera.zoom > 0.7){
						let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
						/* Dragging neighbour map */
						if(e.altKey && self.camera.properties.map != undefined){
							/* Direction Dragging */
							let m = Math.floor(self.camera.properties.map.direction/3);
							let df = Math.round(((1-m) * (mouseX - self.click.x) + m * (mouseY - self.click.y)) / 16);
							df = df / Math.abs(df)|0;
							if(Math.abs(df) == 1){
								self.camera.properties.map.offset += df;
								self.click.x = mouseX;
								self.click.y = mouseY;
							}
						}else if(mouse instanceof Object){
							let xBlock = mouse.x, yBlock = mouse.y;
							if(e.altKey){
								/* Dragging an 'Event' */
								if(self.camera.properties.grabbed != undefined){
									self.camera.properties.grabbed.x = xBlock;
									self.camera.properties.grabbed.y = yBlock;
								}
							}else{
								let block  = self.camera.properties.block || 1;
								self.setBlock(xBlock, yBlock, block);
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
				}
			}).on("contextmenu", function(e){
				e.preventDefault();
				let zoom = self.camera.zoom;
				let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
				if(zoom > 0.7 && mouse instanceof Object){
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
					if(mouse instanceof Object){
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
					let limitY = (self.bufferMemory[self.currentMap.block[0]].totalBlocks)>>3;
					if(yBlock >= limitY){
						yBlock += Math.max(0x40, limitY) - limitY;
					}
					$("#selected_block").css({ "left": ((xBlock << 4) + 12) + "px", "top": (yBlock << 4) + "px" })
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
			});

			this.editor = CodeMirror(document.getElementById("codeEditor"), {
				theme: "3024-day",
				lineNumbers: true,
				styleActiveLine: true,
			});
		});
	};
}
