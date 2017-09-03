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
		this.currentWorkspace    = "";
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
		this.items						= [];
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
				diccionary[index] = translation[i + 1];
			}
		}else if((/\.(json)$/i).test(translation)){
			$.ajax({ url: translation, dataType: 'text', async: false, success: function(data){
				let json = $.parseJSON(data);
				$.each(json, function(key, val) {
					index = parseInt(key, 16);
					diccionary[index] = val;
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
		this.changeWorkspace("hex");
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
		this.changeWorkspace("hex");
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
	//* Search Methods *//
	findByInt(chain, start, end){
		end = end || this.memoryRom.length;
		let result = [];
		let last = chain[0];
		for(let k = start || 0, c = 0, equal = 0; k < this.memoryRom.length && c < end; k++){
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
	findByHex(hex, start, end){
		if(hex.length % 2 == 0){
			let chain = hex.match(/.{1,2}/g).map(function(a){
				return (~a.indexOf("X") ? -1 : parseInt(a, 16));
			});
			return this.findByInt(chain, start, end);
		}else{
			console.error("ROMREADER: Hexadecimal chains have to be even.");
			return null;
		}
	};
	findByDiccionary(chain, name, start, end){
		let diccionary = this.getDiccionary(name);
		let hex = chain.split("").map(function(e){ return diccionary.indexOf(e);  });
		return this.findByInt(hex, start, end);
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
					self.string_translation[nameDef].push({hexadecimal: parseInt(white[2], 16), EN_def: splName[1]});
				}
			}while(textReg);
		}, error: function(e, a, error){ console.error("ROMREADER" + error); }});
	};

	/* Code Visualization Methods */
	writeTextPreview(t, n){let m=0;return(" /* "+t.split('').map(function(v,i,a){return(i>n?undefined:a[m++])}).join('')+(m>=t.length?"":"...")+" */");};
	addTitleBlock(title){return(this.comment+"---------------\n"+this.comment+" "+title+"\n"+this.comment+"---------------\n"); };
	toHexadecimal(b, k){
		let hexfinal = 0;
		for(let n = 0; n < k; n++){
			hexfinal |= this.getByte(b + n) << (n * 8);
		}
		return hexfinal;
	};
	writeHexadecimal(o, s){ return (" 0x" + this.toHexadecimal(o, s).toString(16).toUpperCase()); };
	getTextByPointer(diccionary, begin, end){
		let char = this.getByte(begin);
		let offset = (end == undefined ? this.memoryRom.length : Math.min(end, this.memoryRom.length));
		let text = "", isText = true;
		while(char != 0xff && begin <= offset && isText){
			if(diccionary == null){
				text += String.fromCharCode(char);
			}else{
				let translation = diccionary[char];
				if(translation == undefined){
					isText = false;
				}else{
					text += translation;
				}
			}
			char = this.getByte(++begin);
		}
		return (char == 0xff && isText) ? text : "";
	};
	writeRAWList(buffer, txt, n, diccionary, end, step){
		let text = "";
		if(buffer[n].length > 0){
			text += this.addTitleBlock(txt);
			for(let b = 0; b < buffer[n].length; b++){
				let offset = buffer[n][b];
				text += "#org 0x" + offset.toString(16).toUpperCase() + "\n";
				let i = this.getShort(offset)&(step*0xff);
				let finish = false;
				while(!finish){
					text += "#raw " + ["byte", "word"][step - 1] + " 0x"+ i.toString(16).toUpperCase();
					if(diccionary != undefined){
						text += "\u0009" + this.comment + " ";
						switch (diccionary) {
							case "items":
								if(i == 0x0){
									text += "End of Items";
								}else if(this[diccionary][i] != undefined){
									text += this[diccionary][i].name;
								}
							break;
						}
					}
					text += "\n";
					finish = (i == end);
					i = this.getShort(offset += step) & (step*0xff);
				}
				if(b < buffer[n].length - 1){
					text += "\n";
				}
			}
			for(let k = n + 1; k < buffer.length; k++){
				if(buffer[k].length > 0){
					text += "\n\n";
					break;
				}
			}
		}
		return text;
	};
	codeResult(codeOffset){
		this.changeWorkspace("xse");
		let prevBit = this.getByte(Math.max(0, codeOffset - 1));
		let code = this.addTitleBlock("Code");
		if(prevBit <= 0x08 || prevBit == 0x66 || prevBit == 0x27 || prevBit >= 0xFE){
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
									code += " " + type.EN_def;
								}
							}else if(name != "NULL"){
								code += " 0x" +  byte.toString(16).toUpperCase();
							}
							let push = byte, index = null;
							switch(name){
								case "OFFSET":
									index = 0;
								break;
								case "TEXT":
									index = 1;
									code += this.writeTextPreview(this.getTextByPointer(txtDiccionary, push&0xffffff), 34);
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

							if(index != null && bufferHex[index].indexOf(push&0xffffff) == -1){
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

					let text = this.getTextByPointer(txtDiccionary, hexMsg);
					code += "#org 0x" + hexMsg.toString(16).toUpperCase() + "\n= " + text +"\n";
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
			code += this.writeRAWList(bufferHex, "Movements", 2, movDiccionary, 0xFE, 1);
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

	//* Palletes *//
	getPalettes(offset){
		let palettes = [];
		for(let c = 0; c < 16; c++){
			palettes[c] = this.GBA2HEX(this.getShort(offset + c * 2));
		}
		return palettes;
	};
	getTilesetPalettes(offset, primary){
		let palettes = [];
		for(let i = 0; i < 6 + primary; i++){
			palettes = palettes.concat(this.getPalettes(offset + i * 32));
		}
		return palettes;
	};

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

	getEvents(i, j, e){
		let all = e instanceof Array ? e : [e];
		let found = [];
		for(let m = 0; m < all.length; m++){
			let events = this.currentMap.events[e[m]];
			for(let k = 0; k < events.length; k++){
				let event = events[k];
				if(event != undefined){
					if(event.x == i && event.y == j){
						found.push({index: k, type: m, event: event});
					}
				}
			}
		}
		return found;
	};

	removeEvent(a, b){
		let events = this.currentMap.events[a];
		events.splice(b, 1);
	};

	addEvent(x, y, t){
		let event;
		if(t == 0){ /* Person */
			event = { picture: 0, ud1: 0, x: x, y: y, heightlevel: 0, movement_type: 0, movement_radius: 0, ud2: 0, is_trainer: 0, ud3: 0, range_vision: 0, script: 0, status: 0, ud4: 0 };
		}else if(t == 1){ /* Warp */
			event = { x: x, y: y, heightlevel: 0, warp: 0, bank: 0, map: 0 };
		}else if(t == 2){ /* Script */
			event = { x: x, y: y, heightlevel: 0, number: 0, value: 0, script: 0 };
		}else if(t == 3){ /* Sign */
			event = { x: x, y: y, heightlevel: 0, type: 0, quantity: 0, special: 0 };
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
	loadItemsFromRAM(){
		let isItem = true;
		let offset = this.memoryOffset.itemtable.offset;
		let diccionary = this.getDiccionary("Text");
		while(isItem){
			let itemName = this.getTextByPointer(diccionary, offset, offset + 14);
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
	/*
		Definitions:
		X -> Coord X
		Y -> Coord Y
		U -> Undefined
		E -> Empty
		O -> Offset
	*/
	addHeader(headerIndex){
		if(this.maps[headerIndex] = undefined) return null;
		let type 				= 0;
		let pointer 		= this.getPointer(this.memoryOffset.maptable.table_offset + headerIndex * 4);
		let nextPointer = this.getPointer(this.memoryOffset.maptable.table_offset + (headerIndex + 1) * 4);

		let nextMap = pointer;
		let left = "<div class='header_option'> <div class='header_name'>HEADER " + headerIndex + "</div>";
		let maps = [];

		while(nextMap < nextPointer && this.getPointer(nextMap) != 0){
			let header = this.getPointer(nextMap);
			let map = this.getPointer(header), events = this.getPointer(header + 4);

			/* TODO: Comprobar que son offsets. */
			if(this.getByte(header + 3) == 0x08 && this.getByte(header + 7) == 0x08 && this.getByte(map + 15) == 0x08){
				let mapIndex = (nextMap - pointer) / 4;

				/* Creating map blocks structure. */
				let structure = [];
				let wmap = this.getInt(map);
				let hmap = this.getInt(map + 4);
				let structOffset = this.getPointer(map + 12);

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

				/* Reading and Adding Pjs to buffer.*/
				let persons = [];
				let firstperson = this.getPointer(events + 4);
				let lastperson = firstperson + this.getByte(events) * 24;
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
				let firstwarp = this.getPointer(events + 8);
				let lastwarp = firstwarp + this.getByte(events + 1) * 8;
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
				let firsttrigger = this.getPointer(events + 12);
				let lasttrigger = firsttrigger + this.getByte(events + 2) * 16;
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
				let firstsign = this.getPointer(events + 16);
				let lastsign = firstsign + this.getByte(events + 3) * 12;
				for(let i = firstsign; i < lastsign; i += 12){
					signs.push({
						x: this.getShort(i),
						y: this.getShort(i + 2),
						heightlevel: this.getByte(i + 4),
						type: this.getShort(i + 5),
						quantity: this.getByte(i + 7),
						special: this.getPointer(i + 8),
					});
				}

				let palettes = [];
				let tilesets = [];
				let blocks = [];
				for(let i = 0; i < 2; i++){
					let offset = this.getPointer(map + 16 + 4 * i);

					/* Obtaning tiles palletes. */
					let primary = this.getByte(offset + 1); /* Compression? */
					let palette = this.getPointer(offset + 8) + primary * 0xC0; /* Pallete Offset */
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
				let mapName = this.getTextByPointer(this.getDiccionary("Text"), offsetName);
				left += "<div class='header_map' data-bank='"+ headerIndex +"' data-map='"+ mapIndex +"'>"
									+"<span>"+ headerIndex +"."+ mapIndex +"</span> " +
									(~mapName.indexOf("|FC|")?(mapName.replace("|FC|","<i>")+"</i>"):mapName) +
								"</div>";

				maps.push({
					name: mapName,
					bank: pointer,
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
					wildpokemon: this.getByte(header + 27)
				});
			}
			nextMap += 4;
		}
		if(maps.length > 0){
			$("#widthMap").append(left + "</div>");
		}
		this.maps[headerIndex] = maps;
	};
	loadMapsFromRAM(){
		let total = this.headersLength();
		for(let i = 0; i < total; i++){
			this.addHeader(i);
		}
		let element = $("#canvas_map")[0];
		this.camera.resize(element.width 	= $(window).width() - 650, element.height	= $(window).height() - 40);
	};
	changeMap(headerIndex, mapIndex){
		if(this.maps[headerIndex] != undefined){
			let currentMap = this.currentMap = this.maps[headerIndex][mapIndex];
			this.currentMap.loaded 			= false;
			this.currentMap.time 				= 0;
			this.currentMap.allPalettes = this.bufferMemory[currentMap.palette[0]].concat(this.bufferMemory[currentMap.palette[1]]);
			this.currentMap.allTilesets = this.bufferMemory[currentMap.tileset[0]].concat(this.bufferMemory[currentMap.tileset[1]]);
			let blocks0 = this.bufferMemory[currentMap.block[0]];
			let blocks1 = this.bufferMemory[currentMap.block[1]];
			let blocks  = this.currentMap.allBlocks 	= blocks0.blocks.concat(blocks1.blocks);
			if(currentMap.preview == undefined){
				let twidth 	= currentMap.structure[0].length;
				let theight = currentMap.structure.length;
				let img 		= this.getMapContext().createImageData(twidth * 16, theight * 16), data = img.data;

				for(let j = 0; j < theight; j++){
					for(let i = 0; i < twidth; i++){
						this.drawBlock(i<<1, j<<4, blocks[currentMap.structure[j][i]&0x3ff], this.currentMap.allPalettes, this.currentMap.allTilesets, img);
					}
				}
				currentMap.preview = img;
			}
			this.getMapAndNeighboursPreview();
			this.camera.restore();
			this.drawRightBlocks([blocks0, blocks1]);
			this.drawMap();
		}
	};

	getMapAndNeighboursPreview(){
		let connections = this.currentMap.connection;
		let ctx = this.getMapContext();
		for(let i = 0; i < connections.length; i++){
			let connection = this.maps[connections[i].bank][connections[i].map];
			if(connection.preview == undefined){
				let twidth 	= connection.structure[0].length;
				let theight = connection.structure.length;
				let preview 		= ctx.createImageData(twidth * 16, theight * 16), data = preview.data;
				let palettes 	= this.bufferMemory[connection.palette[0]].concat(this.bufferMemory[connection.palette[1]]);
				let tilesets 	= this.bufferMemory[connection.tileset[0]].concat(this.bufferMemory[connection.tileset[1]]);
				let blocks  	= this.bufferMemory[connection.block[0]].blocks.concat(this.bufferMemory[connection.block[1]].blocks);

				for(let j = 0; j < theight; j++){
					for(let i = 0; i < twidth; i++){
						this.drawBlock(i<<1, j<<4, blocks[connection.structure[j][i]&0x3ff], palettes, tilesets, preview);
					}
				}
				connection.preview = preview;
			}
		}

	}

	mouseToMapCoordinates(map, x, y){
		let camera = this.camera;
		let mapwidth = this.currentMap.preview.width, mapheight = this.currentMap.preview.height;
		let xMouse = x - map.offset().left + ((mapwidth - map.width())>>1) - camera.x;
		let yMouse = y - map.offset().top + ((mapheight - map.height())>>1) - camera.y;
		if(xMouse >= 0 && xMouse < mapwidth && yMouse >= 0 && yMouse < mapheight){
			return {x: xMouse>>4, y: yMouse>>4};
		}else{
			return false;
		}
	};
	getNeighbourbyMouse(canvas, x, y){
		let widthMap = this.currentMap.preview.width;
		let heightMap = this.currentMap.preview.height;

		/* Lets translade coords to the left top corner */
		let i = x - canvas.offset().left - (canvas.width() - widthMap) / 2;
		let j = y - canvas.offset().top - (canvas.height() - heightMap) / 2;
		for(let c = 0; c < this.currentMap.connection.length; c++){
			let connection = this.currentMap.connection[c];
			if(connection.direction > 0x0){
				let map = this.maps[connection.bank][connection.map];
				let h = Math.floor(connection.direction/3);
				let m = h * ((connection.direction%2) * -map.preview.width + (connection.direction == 4) * (widthMap)) + 16 * (1 - h) * connection.offset;
				let n = (1-h)*(((connection.direction+1)%2) * -map.preview.height + (connection.direction == 1) * heightMap) + 16 * h * connection.offset;
				let dx = i - m - this.camera.x;
				let dy = j - n - this.camera.y;
				if(dx >= 0 && dy >= 0 && dx <= map.preview.width && dy <= map.preview.height){
					return connection;
				}
			}
		}
	};

	drawMap(){
		let ctx = this.getMapContext();
		let self = this;
		setInterval(function(){
			let widthCamera = self.camera.getWidth(), heightCamera = self.camera.getHeight();
			let widthMap = self.currentMap.preview.width, heightMap = self.currentMap.preview.height;
			ctx.clearRect(0, 0, widthCamera, heightCamera);
			self.camera.update();
			// self.camera.mapX(Math.max(0, widthMap - widthCamera + 100) >> 1);
			// self.camera.mapY(Math.max(0, heightMap - heightCamera + 100) >> 1);

			// if(!self.currentMap.loaded){
			// 	self.effect2(self.currentMap.time++);
			// }

			let xCamera = Math.round((widthCamera 	- widthMap) / 2  + self.camera.getX());
			let yCamera = Math.round((heightCamera 	- heightMap) / 2 + self.camera.getY());

			/* Drawing */
			let connections = self.currentMap.connection;
			for(let c = 0; c < connections.length; c++){
				let connection = connections[c];
				if(connection.direction > 0x0){
					let map = self.maps[connection.bank][connection.map];
					let h = Math.floor(connection.direction/3);
					let x = h * ((connection.direction%2) * -map.preview.width + (connection.direction == 4) * (widthMap)) + 16 * (1 - h) * connection.offset;
					let y = (1-h)*(((connection.direction+1)%2) * -map.preview.height + (connection.direction == 1) * heightMap) + 16 * h * connection.offset;
					ctx.putImageData(map.preview, x + xCamera, y + yCamera);


					let mapname = map.name + " [" + connection.bank + ", " + connection.map + "]";
					let xText = xCamera + x + (map.preview.width>>1) - mapname.length * 7;
					let yText = yCamera + y + (map.preview.height>>1) + 10;
					//* BLACK RECTANGLE TODO: Change it to the 'Sign Background' *//
					ctx.beginPath();
					ctx.fillStyle = "rgba(10, 10, 10, 0.7)";
					ctx.rect(xText - 20, yText - 40, mapname.length * 18, 60);
					ctx.fill();

					/* DISPLAY NAME TODO: USE POKEMON FONT TO SHOW THE NAME */
					ctx.font = "bold 30px Arial";
					ctx.fillStyle = "white";
					ctx.fillText(mapname, xText, yText);
				}
			}

			ctx.putImageData(self.currentMap.preview, xCamera, yCamera);
			ctx.beginPath();
			ctx.rect(xCamera - 3, yCamera - 3, widthMap + 3, heightMap + 3);
			ctx.strokeStyle = "red";
			ctx.lineWidth = 3;
			ctx.stroke();

			let colorEvent = [0x33cc00, 0xffff00, 0x33ffff, 0xff00ff];
			for(let k = 0; k < 4; k++){
				let color 	= colorEvent[k].toString(16);
				let events 	= self.currentMap.events[k];
				for(let i = 0; i < events.length; i++){
					let e = events[i];
					if(e != undefined){
						ctx.beginPath();
						ctx.rect(xCamera + e.x * 16, yCamera + e.y * 16, 16, 16);
						ctx.lineWidth = 1;
						ctx.strokeStyle = "#" + color;
						ctx.stroke();
					}
				}
			}

			let entities = self.currentMap.events[0];
			for(let k = 0; k < entities.length; k++){
				let entity = entities[k];
				if(entity != undefined){
					let sprite = self.overworldSprites[entity.picture];
					if(sprite != undefined){
						sprite = sprite.sprite;
						let xSprite = (entity.x + 0.5) * 16 - (sprite.width>>1) + xCamera;
						let ySprite = (entity.y + 1) * 16 - sprite.height + yCamera;
						ctx.drawImage(sprite, xSprite, ySprite);
					}
				}
			}

		}, 100/6);
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
		let current = this.currentMap;
		current.structure[y][x] = block;
		this.drawBlock(x<<1, y<<4, current.allBlocks[block], current.allPalettes, current.allTilesets, current.preview);
	};

	drawBlock(x, y, block, palletes, tileset, canvas){
		let width = canvas.width;
		let data = canvas.data;
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
						let color = palletes[index + pixel];
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
	setGamePath(p){ this.gamePath = p; };
	getGameLanguage(){ return this.lang; };
	getWorkspaceName(){ return this.currentWorkspace; };
	changeWorkspace(n){
		if(this.currentWorkspace != n){
			let menu_option = $("#rightside_menu > div[data-value="+n+"]");
			$(".viewer_in").removeClass("viewer_in");

			menu_option.addClass("viewer_in");

			$("#rightpannel > div:not(.lightbox)").addClass('hide');
			$("#" + n + "Editor").removeClass('hide');
			if(menu_option.hasClass("icon-code")) this.editor.refresh();
			this.currentWorkspace = n;
		}
	};

	init(){
		/* Adding all diccionaries to buffer. */
		this.addDiccionary("Text", "./decrypt/text_table_en.json");
		this.addDiccionary("Code", "./decrypt/dcccode.json");
		this.addDiccionary("Movement", "./decrypt/dccmovement.json");

		/* Adding all definitions to buffer.
			TODO: Take all from memory and not from outside files.
		*/
		this.addDefinition("./definition/std.rbh");
		this.addDefinition("./definition/stdpoke.rbh");
		this.addDefinition("./definition/stdattacks.rbh");

		/* Creating necessary panels. */
		$(".hexArea").remove();
		this.addHexPanel("hexTranslate", "hexResult");
		this.addHexPanel("hexResult", "hexTranslate");

		this.type = this.getTextByPointer(0, 0xAC, 0xAF);

		this.loadMapsFromRAM();
		this.loadItemsFromRAM();
		this.findOverworldSprites(this.memoryOffset.spritetable.offset);
		//this.changeMap(0, 0);
		/*0x14AE30
		 snop 	-> 20, 70, 47, 00
		 snop1	-> 20, 70, 47, 00
		 end 		-> B5, FF, F7, B5, FD, 00
		 return -> B5, FF, F7, D9, FD, 00
		*/
		this.hexResult(0x3C5564, "hexResult", "hexTranslate", "Text");

		for(let i = 0; i < this.items.length; i++){
			let item = this.items[i];
			if(item != undefined){
				let name = item.name, nameTransformed;
				if(/^([T,H]M[0-9]{2})$/.test(name)){
					nameTransformed = name;
				}else{
					nameTransformed = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
				}
				$(".selectItems").append("<option value='"+i+"'>"+ nameTransformed +"</option>");
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

		$(".header_map").on("click", function(e){
			self.changeMap(parseInt($(this).data("bank")), parseInt($(this).data("map")));
		});

		$("#canvas_map").mousedown(function(e){
			e.preventDefault();
			self.click.x = e.pageX;
			self.click.y = e.pageY;
			if(event.which == 1){
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
						let map = self.getNeighbourbyMouse($(this), e.pageX, e.pageY);
						if(map != undefined){
							self.camera.properties.map = map;
						}
					}
				}
			}
		}).on("mousemove", function(e){
			e.preventDefault();
			let mouseX = e.pageX, mouseY = e.pageY;
			if(self.click.down && event.which == 1){
				if(e.ctrlKey && !e.altKey){
					let canvas = $("#canvas_map");
					self.camera.vx += (mouseX - self.click.x)/8;
					self.camera.vy += (mouseY - self.click.y)/8;
					self.click.x = mouseX;
					self.click.y = mouseY;
				}else{
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
		}).on("contextmenu", function(e){
			e.preventDefault();
			let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
			if(mouse instanceof Object){
				self.camera.properties.rightclick = mouse;
				let widthMap = self.currentMap.preview.width;
				let heightMap = self.currentMap.preview.height;

				/* Lets translade coords to the left top corner */
				let i = $(this).offset().left + ($(this).width() - widthMap) / 2 + 24 + (mouse.x<<4) + self.camera.x;
				let j = $(this).offset().top + ($(this).height() - heightMap) / 2 - 40 + (mouse.y<<4) + self.camera.y;
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
								$(".item_pannel input[name=amount]").val(pick.event.quantity + 1);
							}else{ /* Secret Base */
								$(".base_pannel").removeClass("hide");
								$(".base_pannel input[name=base]").val(pick.event.special);
							}
						break;
					}
					$("#mousepannel > input[name=index]").val(pick.index);
					$("#mousepannel > input[name=type]").val(pick.type);
					pannel = ".subpannel." + pannel + "_pannel";
					if(hasScript == "script" || hasScript == "special"){
						$(".pannelinput.script input").val(pick.event[hasScript].toString(16).toUpperCase().pad('0', 6));
					}

					self.camera.properties.grabbed = pick.event;
					$(pannel + ", .panneloption.scriptoption, .subpannel.showAlways").removeClass("hide");

					for (var property in pick.event){
						if(property != 'script'){
							let element = $(pannel + " input[name="+property+"], select[name="+property+"]");
							if(element.length == 1){
								element.val(pick.event[property]);
							}
						}
					}
				}else{
					$(".panneloption.scriptoption").addClass("hide");
				}
			}else{
				$("#mousepannel").addClass("hide");
			}
		}).on("dblclick", function(e){
			e.preventDefault();
			let mouse = self.mouseToMapCoordinates($(this), e.pageX, e.pageY);
			if(mouse instanceof Object){
				let xBlock = mouse.x, yBlock = mouse.y;
				if(e.altKey){
					let pick = self.getEvents(xBlock, yBlock, [0, 1, 2, 3]);
					if(pick.length > 0){
						pick = pick[0];
						if(pick.type == 1){
							self.changeMap(pick.event.map, pick.event.bank);
						}else if(pick.script != 0x0){
							self.codeResult(pick.event.script);
						}
						self.camera.properties.grabbed = pick.event;
					}
				}
			}else{
				let map = self.getNeighbourbyMouse($(this), e.pageX, e.pageY);
				if(map != undefined && e.altKey){
					self.changeMap(map.bank, map.map);
				}
			}
		});

		$("#mousepannel .subpannel input, select").bind('keyup mouseup', function(){
			let selected = self.camera.properties.grabbed;
			console.log($(this).parent().parent().attr("class"));
			let value = parseInt($(this).val(), $(this).parent().hasClass("script") ? 16 : 10);
			selected[$(this).prop("name")] = value;
			if($(this).attr("name") == "is_trainer"){
				$(".subpannel.person_pannel input[name=range_vision]").prop('disabled', !value);
			}
		});

		$("#blocks_map").on("click", function(e){
			let xBlock = (e.pageX - $(this).offset().left)>>4;
			let yBlock = (e.pageY - $(this).offset().top)>>4;
			let limitY = (self.bufferMemory[self.currentMap.map.block[0]].totalBlocks)>>3;
			if(yBlock >= limitY){
				yBlock += Math.max(0x40, limitY) - limitY;
			}
			self.camera.properties.block = xBlock + (yBlock<<3);
		});

		$(".panneloption").click(function(){
			$("#mousepannel").addClass('hide');
			if($(this).hasClass("delete_event")){
				let type = parseInt($("#mousepannel > input[name=type]").val());
				let index = parseInt($("#mousepannel > input[name=index]").val());
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
	};
}
