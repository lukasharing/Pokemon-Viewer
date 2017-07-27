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

class RomReader{
	constructor(){
		/* Game Variables */
		this.gamePath = "";
		this.lang 		= "";
		this.type 		= "";

		/* Editor Variables */
		this.editor = null;
		this.currentArea    = "hex";
		this.comment = "//";

		//* Editor Diccionary Variables *//
		this.diccionary         = [];
		this.selectedDiccionary = "Text";

		/* Events Variables */
		this.click = {down: false, x: 0, y: 0};

		/* Game Buffers Variables */
		this.memoryOffset = {};
		this.memoryRom    = [];

		/* Hexadecimal Visualization Variables */
		this.currentOffset 			= null;
		this.string_translation = [];

		/* Map Visualization Variables */
		this.maps 						= [];
		this.bufferMemory 		= [];
		this.overworldSprites = [];
		this.camera = new Camera();
		this.currentMap = {
			map: undefined,
			image: null,
			loaded: false,
			time: 0
		};

	};

	/* Editor Diccionary Methods */
	getNameDiccionary()		{ return this.selectedDiccionary; };
	setDiccionaryName(n)	{ this.selectedDiccionary = n; };
	getCurrentDiccionary(){ return this.diccionary[this.selectedDiccionary] || null; };
	getDiccionary(n)			{ return this.diccionary[n] || null; };

	addDiccionary(name, translation){
		let diccionary = [];
		let lastindex = 0, index;
		if(translation instanceof Array){
			for(let i = 0; i < translation.length; i += 2){
				index = translation[i];
				for(let k = lastindex + 1; k < index; k++){
					diccionary[k] = null;
				}
				diccionary[index] = translation[i + 1];
				lastindex = index;
			}
		}else if((/\.(json)$/i).test(translation)){
			$.ajax({ url: translation, dataType: 'text', async: false, success: function(data){
				let json = $.parseJSON(data);
				$.each(json, function(key, val) {
					index = parseInt(key, 16);
					for(let k = lastindex + 1; k < index; k++){
						diccionary[k] = undefined;
					}
					diccionary[index] = val;
					lastindex = index;
				});
			}, error: function(e, a, error){
				console.error("ROMREADER: " + error);
			}});
		}else{
			console.error("ROMREADER: Couldn't add this type of diccionary.");
		}
		this.diccionary[name] = diccionary;
	};

	/* Game Buffers Methods */
	getOffset(o)	{ return(this.memoryOffset[o]); };
	getInt(o)			{ return(this.memoryRom[o]|this.memoryRom[o+1]<<8|this.memoryRom[o+2]<<16|this.memoryRom[o+3]<<24);};
	getPointer(o)	{ return(this.memoryRom[o]|this.memoryRom[o+1]<<8|this.memoryRom[o+2]<<16);};
	getShort(o)		{ return(this.memoryRom[o]|this.memoryRom[o+1]<<8);};
	getRhort(o)		{ return(this.memoryRom[o+1]|this.memoryRom[o]<<8);};
	getByte(o)		{ return(this.memoryRom[o]); };

	loadROM(path, offsets, success){
		$("#loadingScreen").removeClass("hide");
		$("#game_selection").addClass("hide");
		let oReq = new XMLHttpRequest();
		oReq.open("GET", path, true);
		oReq.responseType = "arraybuffer";

		oReq.addEventListener("progress", function(e){
			if(e.lengthComputable){
		    let percentComplete = Math.round(e.loaded / e.total * 100);
				$("#loadingScreen h3").text("Loading the game: " + percentComplete + "%");
				$("#loadingScreen .loader").css("width", percentComplete + "%");
		  }
		}, false);

		let self = this;
		oReq.addEventListener("load", function(){
			$("#cancelGBA").click();
			$("#game_selection").removeClass("hide");
			$("#loadingScreen").addClass("hide");
			self.memoryOffset = offsets;
			self.setGamePath(path);
			self.memoryRom = new Uint8Array(this.response);
			self.init();
			success();
		}, false);


		oReq.addEventListener("error", function(){
			console.error("ROMREADER: Couldn't download the game");
		}, false);

		oReq.send();
	};

	/* Hexadecimal Visualization Methods */
	addHexPanel(id, simetry){
		let panel = ""+
			"<div class='hexArea' id='"+ id +"'>"+
				"<div class='lefthexpanel'></div>"+
				"<div class='righthexpanel'>"+
					"<div class='hexheaderpanel'>";
		for(let h = 0; h < 16; h++){
			panel += "<div class='hexNum'>" + h.toString(16) + "</div>";
		}
		panel += "<div class='clear'></div>"+
					"</div>" +
					"<div class='hexZone'><div class='hexScroll'></div></div>"+
				"</div><div class='clear'></div></div>"; /* <-- */
		$("#hexEditor").prepend(panel);

		let self = this;
		if(simetry !== undefined){
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
					$("#" + simetry + " .fieldValue[data-offset=" + $(this).data("offset") + "]").addClass("fieldValuehover");
				}
			}).on("mouseenter mousedown mouseup", ".byteValue", function(e){
				let offset 	= $(this).parent().data("offset");
				let type 		= e.type;
				let click 	= $("#" + id).data("click");
				if(type == "mouseenter" && click){
						$(this).data("selected", true);
						$(this).addClass("byteValuehover");
						$("#" + simetry + " .fieldValue[data-offset=" + offset + "] .byteValue:eq(" + $(this).index() + ")").addClass("byteValuehover");
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

	hexResult(offset, id, child, diccionary){
		let difference = offset - this.currentOffset, abs = Math.abs(difference);
		let size = (Math.floor($(window).height() / 36) - 1) * 16;
		diccionary  = this.diccionary[diccionary];
		let content = "", simetry = "", leftside = "";
		for (let i = offset; i < offset + Math.min(abs, size); i += 16){
			leftside += "<div class='hexValue'>" + i.toString(16).pad('0', 8) + "</div>";
			content += "<div class='fieldValue' data-offset='" + (i) + "'>";
			simetry += "<div class='fieldValue' data-offset='" + (i) + "'>";
			for(let j = i; j <= i + 0xf; j++){
				let byte = this.getByte(j);
				let value = (diccionary == undefined) ? String.fromCharCode(byte) : diccionary[byte];
				content += "<div class='byteValue'>" + byte.toString(16).pad('0', 2).toUpperCase() + "</div>";
				simetry += "<div class='byteValue " + (value == undefined ?  "emptybyte'>" : ("'>" + value)) + "</div>";
			}
			content += "<div class='clear'></div></div>";
			simetry += "<div class='clear'></div></div>";
		}

		if(abs > size){
			$("#" + id + " > .lefthexpanel").html(leftside);
			$("#" + child + " > .righthexpanel .hexScroll").data("diccionary", diccionary).html(simetry);
			$("#" + id + " > .righthexpanel .hexScroll").html(content);
		}else if(abs > 0){
			let index = (abs - difference) * (size - abs) / (32 * abs);
			for(let k = 0; k < abs/16; k++){
				$("#" + id + " .hexValue:eq(" + index + ")").remove();
				$("#" + child + " .fieldValue:eq(" + index + ")").remove();
				$("#" + id + " .fieldValue:eq(" + index + ")").remove();
			}
			if(difference > 0){
				$("#" + id + " > .lefthexpanel").append(leftside);
				$("#" + child + " > .righthexpanel .hexScroll").append(simetry);
				$("#" + id + " > .righthexpanel .hexScroll").append(content);
			}else{
				$("#" + id + " > .lefthexpanel").prepend(leftside);
				$("#" + child + " > .righthexpanel .hexScroll").prepend(simetry);
				$("#" + id + " > .righthexpanel .hexScroll").prepend(content);
			}
		}
		this.currentOffset = offset;
	};

	findByInt(chain, total, offset){
		total = total || this.memoryRom.length;
		let result = [];
		let last = chain[0];
		for(let k = offset || 0, c = 0, equal = 0; k < this.memoryRom.length && c < total; k++){
			if(last == this.getByte(k) || last < 0){
				equal++;
				if(equal == chain.length){
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

	findByHex(hex, total, offset){
		if(hex.length % 2 == 0){
			let chain = hex.match(/.{1,2}/g).map(function(a){
				return (~a.indexOf("X") ? -1 : parseInt(a, 16));
			});
			return this.findByInt(chain, total, offset);
		}else{
			console.error("ROMREADER: Hexadecimal chains have to be even.");
			return null;
		}
	};

	findByDiccionary(chain, name, total, offset){
		let diccionary = this.getDiccionary(name);
		let hex = chain.split("").map(function(e){ return diccionary.indexOf(e);  });
		return this.findByInt(hex, total, offset);
	};

	// NOT USED
	// readString(offset, maxLength){
	// 	let result = "";
	// 	let tb = this.getDiccionary("Text");
	// 	for (let c = 0; c < maxLength; c++) {
	// 		let currChar = this.getByte(offset + c);
	// 		if(tb[currChar] != null){
	// 			result += tb[currChar];
	// 		}else{
	// 			if (currChar == 0xFF){
	// 				break;
	// 			}else if (currChar == 0xFD){
	// 				result += "\\v" + (this.getByte(offset + (c++) + 1) & 0xFF).toString(16).pad('0', 2);
	// 			}else{
	// 				result += "\\x" + currChar.toString(16).pad('0', 2);
	// 			}
	// 		}
	// 	}
	// 	return result;
	// };

	addDefinition(url){
		let regex = new RegExp("#define.*", "g");
		let self = this;
		$.ajax({ url: url, dataType: 'text', async: false, success: function(data){
			let textReg;
			do{
				textReg = regex.exec(data);
				if(textReg){
					let white = textReg[0].split(" ");
					let splName = white[1].split(/_(.+)?/);
					let nameDef = splName[0];
					if(self.string_translation[nameDef] === undefined){ self.string_translation[nameDef] = []; }
					self.string_translation[nameDef].push({hexadecimal: parseInt(white[2], 16), translation: splName[1]});
				}
			}while(textReg);
		}, error: function(e, a, error){ console.error("ROMREADER" + error); }});
	};

	/* Code Visualization Methods */
	addTextComment(t, n){let m=0;return(" /* "+t.split('').map(function(v,i,a){return(i>n?undefined:a[m++])}).join('')+(m>=t.length?"":"...")+" */");};
	addTitleBlock(title){return(this.comment+"---------------\n"+this.comment+" "+title+"\n"+this.comment+"---------------\n"); };
	codeResult(codeOffset){
		let prevBit = this.getByte(Math.max(0, codeOffset - 1));
		let code = this.addTitleBlock("Code");
		if(prevBit <= 0x08 || prevBit == 0x66 || prevBit >= 0xFE){
			/* Loading Diccionaries. */
			let cdeDiccionary = this.getDiccionary("Code"),
					txtDiccionary = this.getDiccionary("Text"),
					movDiccionary = this.getDiccionary("Movement");

			let bufferHex = [[codeOffset /* CODE */], [/* DIALOGUE */], [/* MOVEMENT */], [/* POKEMART	*/], [/* BRAILLE */]];
			/* Code visualization. */
			let totaloffsets = 0;
			while(totaloffsets < bufferHex[0].length){
				let offset = bufferHex[0][totaloffsets++] & 0xffffff;
				code += "#org 0x" + offset.toString(16).toUpperCase() + "\n";
				let finish = false;
				while(!finish){
					let org = cdeDiccionary[this.getByte(offset++)];
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
								let type = this.string_translation[name].find(function(a){return(a.hexadecimal==byte);});
								if(type == null){
									code += " 0x" +  byte.toString(16).toUpperCase();
								}else{
									code += " " + type.translation;
								}
							}else{
								code += " 0x" +  byte.toString(16).toUpperCase();
							}
							let push = null, index = null;
							switch(name){
								case "OFFSET":
									index = 0;
									push = byte;
								break;
								case "TEXT":
									index = 1;
									push = byte;
									code += this.addTextComment(this.getTextByHex(txtDiccionary, push), 34);
								break;
								case "RAW":
									index = 2;
									push = byte;
								break;
								case "MART":
									index = 3;
									push = byte;
								break;
								case "CMP":
									code += " goto";
								break;
							}

							if(push != null && bufferHex[index].indexOf(push&0xffffff) == -1){
								bufferHex[index].push(push & 0xffffff);
							}

							offset += step_byte[1];
						}else{
							code += this.writeHexadecimal(offset, step_byte);
							offset += step_byte;
						}
					}
					if(org.val == "trainerbattle"){
						/*
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

					let text = this.getTextByHex(txtDiccionary, hexMsg);
					code += "#org 0x" + hexMsg.toString(16).toUpperCase() + "\n= " + text +"\n";
					if(b < bufferHex[1].length - 1){
						code += "\n";
					}else if(bufferHex[2].length > 0){
						code += "\n\n"
					}
				}
			}

			/* Movements code visualization. */
			if(bufferHex[2].length > 0){
				code += this.addTitleBlock("Movements");
				for(let b = 0; b < bufferHex[2].length; b++){
					let hexMsg = bufferHex[2][b];
					code += "#org 0x" + hexMsg.toString(16).toUpperCase() + "\n" + this.getMovementsByHex(movDiccionary, hexMsg);
					if(b < bufferHex[2].length - 1){
						code += "\n";
					}else if(bufferHex[3].length > 0){
						code += "\n\n"
					}
				}
			}

			/* Pokémart code visualization. */
			

			/* Braille code visualization. */

		}
		this.editor.setValue(code);
	};

	toHexadecimal(b, k){
		let hexfinal = 0;
		for(let n = 0; n < k; n++){
			hexfinal |= this.getByte(b + n) << (n * 8);
		}
		return hexfinal;
	};

	writeHexadecimal(o, s){ return (" 0x" + this.toHexadecimal(o, s).toString(16).toUpperCase()); };

	getTextByHex(diccionary, begin, end){
		let char = this.getByte(begin);
		let offset = (end > this.memoryRom.length ? this.memoryRom.length : end) || this.memoryRom.length;
		let text = "";
		while(char != 0xFF && begin <= offset){
			text += ((diccionary == null) ? String.fromCharCode(char) : diccionary[char]);
			char = this.getByte(++begin);
		}
		return text;
	};

	getMovementsByHex(d, b){
		let text = "";
		if(d !== undefined){
			let i = this.getByte(b++), finish = false;
			while(!finish && d[i] != null){
				text += "#raw 0x"+ i.toString(16).toUpperCase() +"\u0009"+ this.comment + " " + d[i].EN_def+"\n";
				finish = i == 0xFE;
				i = this.getByte(b++);
			}
		}
		return text;
	};

	/* MUSIC AND ACTION */
	/*
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

	//* Palletes *//
	getPalettes(offset){
		let palettes = [];
		for(let c = 0; c < 16; c++){
			palettes[c] = this.GBA_Decompress(this.getShort(offset + c * 2));
		}
		return palettes;
	};

	getTilesetPalettes(offset, b){
		let palettes = [];
		for(let i = 0; i < 6 + b; i++){
			palettes = palettes.concat(this.getPalettes(offset + i * 32));
		}
		return palettes;
	};

	/* Map Visualization Methods
		---WHEADER---
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
	headersLength(){
		let o = this.memoryOffset.maptable.table_offset;
		while(this.getPointer(o) != 0x2){ o += 4; }
		return (o - this.memoryOffset.maptable.table_offset) / 4;
	};


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
	findOverworldSprites(offset){
		let helper 	= $("#canvashelper")[0];
		let ctx 		=	helper.getContext("2d");
		let sprites = [];
		let index = 0;

		/* Obtaning Sprites palletes. */
		let palettes = [];
		let paletteOffset = this.memoryOffset.spritetable.palette;
		while(this.getByte(paletteOffset + 3) == 0x8){
			palettes[this.getByte(paletteOffset + 4)] = this.getPalettes(this.getPointer(paletteOffset));
			paletteOffset += 8;
		}

		/* Passing through every sprite. */
		while(this.getByte(offset + index + 3) == 0x08){
			let pointer = this.getPointer(offset + index);
			if(this.getShort(pointer) == 0xFFFF){
				let texture = this.getPointer(pointer + 28);
				if(this.getByte(texture + 3) == 0x08){
					let decompression = this.GBA_Decompress(this.getPointer(texture), this.getShort(texture + 4));

					let width 	= helper.width 	= this.getShort(pointer + 8);
					let height 	= helper.height = this.getShort(pointer + 10);
					let palette = palettes[this.getByte(pointer + 2)];

					/* Draw each sprite. */
					let mask 		= ctx.createImageData(width, height);
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
					ctx.putImageData(mask, 0, 0);
					let sprite = new Image();
					sprite.src = helper.toDataURL();
					sprites[index/4] = {
						sprite: sprite,
						synch: this.getShort(pointer + 6),
						slot: this.getByte(pointer + 12),
						overwrite: this.getByte(pointer + 13),
						empty: this.getShort(pointer + 14),
						distribution: this.getPointer(pointer + 16),
						sizedraw: this.getPointer(pointer + 20),
						shiftdraw: this.getPointer(pointer + 24),
						ram: this.getPointer(pointer + 32),
						ud1: this.getShort(texture + 6)
					};
				}
			}
			index += 4;
		}
		this.overworldSprites = sprites;
	};

	addHeader(headerIndex){
		if(headerIndex >= this.headersLength() || this.maps[headerIndex] != undefined) return;
		let type 				= ("AXV").indexOf(this.type) >= 0 ? 0 : 1;
		let pointer 		= this.getPointer(this.memoryOffset.maptable.table_offset + headerIndex * 4);
		let nextPointer = this.getPointer(this.memoryOffset.maptable.table_offset + (headerIndex + 1) * 4);

		let nextMap = pointer;
		let left = "";
		left += "<div class='header_option'> <div class='header_name'>HEADER " + headerIndex + "</div>";
		let maps = [];
		while(nextMap < nextPointer && this.getPointer(nextMap) != 0){
			let header = this.getPointer(nextMap);
			let map = this.getPointer(header), events = this.getPointer(header + 4);

			/* TODO: Comprobar que son offsets. */
			if(this.getByte(header + 3) == 0x08 && this.getByte(header + 7) == 0x08 && this.getByte(map + 15) == 0x08){
				let mapIndex = (nextMap - pointer) / 4;

				let structure = [];
				let wmap = this.getInt(map);
				let hmap = this.getInt(map + 4);
				let structOffset = this.getPointer(map + 12);
				for(let j = 0, jj = 0; j < hmap; j++, jj += wmap){
					structure[j] = [];
					for(let i = 0; i < wmap; i++){
						structure[j][i] = this.getShort(structOffset + (jj + i) * 2);
					}
				}

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

				/* Reading and Adding Pjs to buffer.*/
				let totalpjs = this.getByte(events), persons = [];
				if(totalpjs > 0){
					let point = this.getPointer(events + 4);
					for(let i = 0; i < totalpjs; i++){
						persons.push({
							index: this.getByte(point),
							picture: this.getByte(point + 1),
							x: this.getShort(point + 4),
							y: this.getShort(point + 6),
							heightlevel: this.getByte(point + 8),
							movement_type: this.getByte(point + 9),
							movement_radius: this.getByte(point + 10),
							is_trainer: this.getByte(point + 12),
							range_vision: this.getShort(point + 14),
							script: this.getPointer(point + 16),
							status: this.getShort(point + 20),
							ud1: this.getByte(point + 2),
							ud2: this.getByte(point + 3),
							ud3: this.getByte(point + 11),
							ud4: this.getByte(point + 13),
							ud5: this.getByte(point + 21),
							ud6: this.getShort(point + 22)
						});
						point += 24;
					}
				}

				/* Reading and Adding Warps to buffer.*/
				let totalwarps = this.getByte(events+1), warps = [];
				if(totalwarps > 0){
					let point = this.getPointer(events + 8);
					for(let i = 0; i < totalwarps; i++){
						warps.push({
							x: this.getShort(point),
							y: this.getShort(point + 2),
							warp: this.getByte(point + 5),
							bank: this.getByte(point + 6),
							map: this.getByte(point + 7),
							ud1: this.getByte(point + 4)
						});
						point += 8;
					}
				}

				/* Reading and Adding Scripts to buffer.*/
				let totalscripts = this.getByte(events+2);
				let triggers = [];
				if(totalscripts > 0){
					let point = this.getPointer(events + 12);
					for(let i = 0; i < totalscripts; i++){
						triggers.push({
							x: this.getShort(point),
							y: this.getShort(point + 2),
							script: this.getPointer(point + 11),
							ud1: this.getByte(point + 4),
							ud2: this.getShort(point + 6),
							ud3: this.getByte(point + 8)
						});
						point += 16;
					}
				}

				/* Reading and Adding Signs and Drops to buffer.*/
				let totalsigns = this.getByte(events+3);
				let signs = [];
				if(totalsigns > 0){
					let point = this.getPointer(events + 16);
					for(let i = 0; i < totalsigns; i++){
						signs.push({
							x: this.getShort(point),
							y: this.getShort(point + 2),
							ud1: this.getByte(point + 4),
							ud2: this.getShort(point + 5),
							ud2: this.getByte(point + 7),
							script: this.getPointer(point + 10),
						});
						point += 12;
					}
				}

				let palettes = [];
				let tilesets = [];
				let blocks = [];
				for(let i = 0; i < 2; i++){
					let offset = this.getPointer(map + 16 + 4 * i);

					/* Obtaning tiles palletes. */
					let primary = this.getByte(offset + 1);
					let palette = this.getPointer(offset + 8) + primary * 0xC0;
					let pal = this.bufferMemory[palette];
					if(pal == undefined){
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
						/* Check if it's compressed. */
						if(this.getByte(image)){
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

				//  (this.getByte(header+20)-88*type)*4*(2-type) + (4*(1-type));
				let displacement = 4 * ((2 - type) * (this.getByte(header + 20 ) - 88 * type) + 1 - type);
				let offsetName = this.getPointer(this.memoryOffset.maptable.name_offset + displacement);
				let mapName = this.getTextByHex(this.getDiccionary("Text"), offsetName);
				left += "<div class='header_map' data-bank='"+ headerIndex +"' data-map='"+ mapIndex +"'>"
									+"<span>"+ headerIndex +"."+ mapIndex +"</span> " +
									(~mapName.indexOf("|FC|")?(mapName.replace("|FC|","<i>")+"</i>"):mapName) +
								"</div>";

				maps.push({
					bank: pointer,
					header: header,
					map: {
						border: this.getPointer(map + 8),
						structure: structure,
						palette: palettes,
						tileset: tilesets,
						block: blocks,
						border_width: this.getByte(map + 24),
						border_height: this.getByte(map + 25),
					},
					connection: connections,
					events: [persons, warps, triggers, signs],
					offset: {
						scripts: this.getPointer(header + 8),
					},
					music: this.getShort(header + 16),
					index: this.getShort(header + 18),
					name: mapName,
					visibility: this.getByte(header + 21),
					wheather: this.getByte(header + 22),
					type: this.getByte(header + 23),
					show_title: this.getByte(header + 26),
					combat: this.getByte(header + 27)
				});
			}
			nextMap += 4;
		}
		$("#leftMap").append(left + "</div>");
		this.maps[headerIndex] = maps;
	};

	loadMapArea(){
		let total = this.headersLength();
		for(let i = 0; i < total; i++){
			this.addHeader(i);
		}
		let element = $("#canvas_map")[0];
		this.camera.resize(element.width 	= $(window).width() - 650, element.height	= $(window).height() - 40);
	};

	changeMap(headerIndex, mapIndex){
		let ctx = this.getMapContext();
		let currentMap = this.currentMap.map = this.maps[headerIndex][mapIndex];
		this.currentMap.headerIndex = headerIndex;
		this.currentMap.mapIndex 		= mapIndex;
		this.currentMap.loaded 			= false;
		this.currentMap.time 				= 0;
		let twidth 	= currentMap.map.structure[0].length;
		let theight = currentMap.map.structure.length;
		let width 	= twidth * 16, height = theight * 16;
		let img 		= this.currentMap.image = ctx.createImageData(width, height), data = img.data;
		this.camera.restore();
		this.currentMap.allPalettes = this.bufferMemory[currentMap.map.palette[0]].concat(this.bufferMemory[currentMap.map.palette[1]]);
		this.currentMap.allTilesets = this.bufferMemory[currentMap.map.tileset[0]].concat(this.bufferMemory[currentMap.map.tileset[1]]);
		let blocks0 = this.bufferMemory[currentMap.map.block[0]];
		let blocks1 = this.bufferMemory[currentMap.map.block[1]];
		let blocks  = this.currentMap.allBlocks 	= blocks0.blocks.concat(blocks1.blocks);

		for(let j = 0; j < theight; j++){
			for(let i = 0; i < twidth; i++){
				this.drawBlock(i<<1, j<<4, blocks[currentMap.map.structure[j][i]&0x3ff], img);
			}
		}
		this.drawRightBlocks([blocks0, blocks1]);
	};

	drawMap(){
		let ctx = this.getMapContext();
		let self = this;
		setInterval(function(){
			let widthCamera = self.camera.getWidth(), heightCamera = self.camera.getHeight();
			let widthMap = self.currentMap.image.width, heightMap = self.currentMap.image.height;
			ctx.clearRect(0, 0, widthCamera, heightCamera);
			self.camera.update();
			self.camera.mapX(Math.max(0, widthMap - widthCamera) >> 1);
			self.camera.mapY(Math.max(0, heightMap - heightCamera) >> 1);

			if(!self.currentMap.loaded){
				self.effect2(self.currentMap.time++);
			}

			let camerax = Math.round((widthCamera 	- widthMap) / 2  + self.camera.getX());
			let cameray = Math.round((heightCamera 	- heightMap) / 2 + self.camera.getY());

			/* Drawing */
			ctx.putImageData(self.currentMap.image, camerax, cameray);
			let colorEvent = [0x33cc00, 0xffff00, 0x33ffff, 0xff00ff];
			for(let k = 0; k < 4; k++){
				let color 	= colorEvent[k].toString(16);
				let events 	= self.currentMap.map.events[k];
				for(let i = 0; i < events.length; i++){
					let e = events[i];
					ctx.beginPath();
					ctx.rect(camerax + e.x * 16, cameray + e.y * 16, 16, 16);
					ctx.strokeStyle = "#" + color;
					ctx.stroke();
				}
			}

			let entities = self.currentMap.map.events[0];
			for(let k = 0; k < entities.length; k++){
				let entity = entities[k];
				let sprite = self.overworldSprites[entity.picture];
				if(sprite != undefined){
					sprite = sprite.sprite;
					ctx.drawImage(sprite, (entity.x + 0.5) * 16 - (sprite.width>>1) + camerax, (entity.y + 1) * 16 - sprite.height + cameray);
				}
			}

		}, 100/6);
	};

	/* JUST TRYING EFFECTS */
	effect1(t){
		let widthMap = this.currentMap.image.width, heightMap = this.currentMap.image.height;
		for(let j = 0; j < heightMap; j += 16){
			for(let i = Math.abs((t>>4)-(j>>4)%2)<<4; i < widthMap; i += 32){
				for(let h = 0; h < 16; h++){
					this.currentMap.image.data[((j + h) * widthMap + i + (t % 16)) * 4 + 3] = 255;
				}
			}
		}
		if(t > 32){
			this.currentMap.loaded = true;
		}
	};

	effect2(t){
		let widthMap 	= this.currentMap.image.width, heightMap = this.currentMap.image.height;
		let mj = Math.min(t, heightMap>>5), mi = Math.min(t, widthMap>>5);
		let hm = heightMap >> 5, wm = widthMap >> 5;
		for(let j = -mj; j <= mj; j++){
			let rj = j * j, jj = (hm + j) << 4;
			for(let i = -mi; i <= mi; i++){
				let ri = i * i, ii = (wm + i) << 4;
				if(ri + rj < t * t){
					for(let h = 0; h < 16; h++){
						let hh = (jj + h) * widthMap;
						for(let w = 0; w < 16; w++){
								this.currentMap.image.data[(hh + ii + w) * 4 + 3] = 255;
						}
					}
				}
			}
		}

		if(t > (Math.max(widthMap, heightMap)>>4) / Math.sqrt(2)){
			this.currentMap.loaded = true;
		}
	};

	drawRightBlocks(blocks){
		let elm = $("#blocks_map")[0];
		let ctx = elm.getContext("2d");
		let realHeight = blocks.reduce(function (a, b){ return a.totalBlocks + b.totalBlocks; })>>3;
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
					this.drawBlock(i * 2, y, mapBlocks.blocks[jj + i], img);
				}
			}
			currentHeight += realHeight<<4;
		}
		ctx.putImageData(img, 0, 0);
	};

	drawBlock(x, y, block, canvas){
		canvas = canvas || this.currentMap.image;
		let width = canvas.width, data = canvas.data;
		for(let b = 0; b < 8; b++){
			let tile = block[b];
			let index = tile[0] * 16, palette = tile[1] * 64, flip = tile[2];
			let x_flip = 7 * (flip & 0x1), y_flip = 3.5 * (flip & 0x2);
			for(let h = 0; h < 8; h++){
				let j = Math.abs(y_flip - h);
				for(let w = 0; w < 8; w++){
					let i = Math.abs(x_flip - w);
					let pixel = this.currentMap.allTilesets[palette + j * 8 + i] & 0xf;
					if(pixel != 0){
						let id = ((y + (b&0x2) * 4 + h) * width + (x + (b&0x1)) * 8 + w) * 4;
						let color = this.currentMap.allPalettes[index + pixel];
						data[id + 0] = (color >> 16) & 0xff;
						data[id + 1] = (color >> 8) & 0xff;
						data[id + 2] = color & 0xff;
					}
				}
			}
		}
	};

	getEntity(i, j){
		let all = this.currentMap.map.events[0];
		for(let k = 0; k < all.length; k++){
			let entity = all[k];
			if(entity.x == i && entity.y == j){
				return entity;
			}
		}
		return null;
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
	getArea(){ return this.currentArea; };
	setGamePath(p){ this.gamePath = p; };
	getGameLanguage(){ return this.lang; };

	setArea(n){
		$("main > div:not(.lightbox)").addClass('hide');
		$("#" + n + "Editor").removeClass('hide');
		this.currentArea = n;
	};

	init(){
		/* Adding all diccionaries to buffer. */
		this.addDiccionary("Text", "./decrypt/text_table_en.json");
		this.addDiccionary("Code", "./decrypt/dcccode.json");
		this.addDiccionary("Movement", "./decrypt/dccmovement_rbspem.json");

		/* Adding all definitions to buffer. */
		this.addDefinition("./definition/std.rbh");
		this.addDefinition("./definition/stdpoke.rbh");
		this.addDefinition("./definition/stditems.rbh");
		this.addDefinition("./definition/stdattacks.rbh");

		/* Creating necessary panels. */
		$(".hexArea").remove();
		this.addHexPanel("hexTranslate", "hexResult");
		this.addHexPanel("hexResult", "hexTranslate");

		this.type = this.getTextByHex(undefined, 0xAC, 0xAF);

		/*
		this.loadMapArea();
		this.findOverworldSprites(this.memoryOffset.spritetable.offset);
		this.changeMap(0, 0);
		this.drawMap();
		*/

		/* Creating all events. */
		let self = this;
		$("body").mousedown(function(e){
			self.click = {down: true, x: e.pageX, y: e.pageY};
		}).mouseup(function(e){
			self.click.down = false;
			$(".grabbing").removeClass("grabbing");
		});

		$(".header_map").on("click", function(e){
			self.changeMap(parseInt($(this).data("bank")), parseInt($(this).data("map")));
		});

		$("#canvas_map").mousedown(function(e){
			e.preventDefault();
			if(e.ctrlKey){
				$(this).addClass("grabbing");
			}else{
				let camera = self.camera;
				let mapwidth = self.currentMap.image.width, mapheight = self.currentMap.image.height;
				let mouseX = e.pageX - $(this).offset().left + ((mapwidth - $(this).width())>>1) - camera.x;
				let mouseY = e.pageY - $(this).offset().top + ((mapheight - $(this).height())>>1) - camera.y;
				if(mouseX >= 0 && mouseX < mapwidth && mouseY >= 0 && mouseY < mapheight){
					let xBlock = mouseX>>4;
					let yBlock = mouseY>>4;
					if(e.shiftKey){
						let pick = self.getEntity(xBlock, yBlock);
						self.codeResult(pick.script);
					}else{
						let block  = camera.properties.block || self.currentMap.allBlocks[1];
						self.drawBlock(xBlock<<1, yBlock <<4, block);
					}
				}
			}
		}).on("mousemove", function(e){
			e.preventDefault();
			let mouseX = e.pageX, mouseY = e.pageY;
			if(self.click.down){
				if(e.ctrlKey){
					let canvas = $("#canvas_map");
					self.camera.vx += (mouseX - self.click.x)/8;
					self.camera.vy += (mouseY - self.click.y)/8;
					self.click.x = mouseX;
					self.click.y = mouseY;
				}else{
					let camera = self.camera;
					let mapwidth = self.currentMap.image.width, mapheight = self.currentMap.image.height;
					let mouseX = e.pageX - $(this).offset().left + ((mapwidth - $(this).width())>>1) - camera.x;
					let mouseY = e.pageY - $(this).offset().top + ((mapheight - $(this).height())>>1) - camera.y;
					if(mouseX >= 0 && mouseX < mapwidth && mouseY >= 0 && mouseY < mapheight){
						let blockx = mouseX>>4;
						let blocky = mouseY>>4;
						let block  = camera.properties.block || self.currentMap.allBlocks[1];
						self.drawBlock(blockx<<1, blocky <<4, block);
					}
				}
			}
		});

		$("#blocks_map").on("click", function(e){
			let xBlock = (e.pageX - $(this).offset().left)>>4;
			let yBlock = (e.pageY - $(this).offset().top)>>4;
			let limitY = (self.bufferMemory[self.currentMap.map.map.block[0]].totalBlocks)>>3;
			if(yBlock >= limitY){
				yBlock += Math.max(0x40, limitY) - limitY;
			}
			self.camera.properties.block = self.currentMap.allBlocks[xBlock + (yBlock<<3)];
		});

		this.editor = CodeMirror(document.getElementById("codeEditor"), {
			theme: "3024-day",
			lineNumbers: true,
			styleActiveLine: true,
		});

		this.codeResult(0x15BAD2);//--3821912
		this.hexResult(415853, "hexResult", "hexTranslate", "Text"); // , 2650292
	};
}
