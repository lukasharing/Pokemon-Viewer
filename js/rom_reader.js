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
class RomReader{
	constructor(){
		/* Game Variables */
		this.game_bases = [];
		this.gamePath = "";
		this.lang 		= "";
		this.type 		= "";
		this.version	= "";

		/* Editor Variables */
		this.currentWorkspace    = "";
		this.comment = "//";

		//* Editor dictionary Variables *//
		this.dictionary         = [];
		this.selecteddictionary = "Text";

		/* Game Buffers Variables */
		this.memoryOffsets = {};
		this.ReadOnlyMemory;

		/* Hexadecimal Visualization Variables */
		this.currentOffset 			= 0;
		this.string_translation = [];

		/* Items */
		this.items						= [];

		/* _editors */
		this.map_editor = new EMap(this);
		this.code_editor = CodeMirror($("#code_editor")[0], {
			theme: "3024-day",
			lineNumbers: true,
			styleActiveLine: true,
		});


		// Window Handler
		this.window_dragging;
	};

	/* Pokemon Bases */
	setGameBases(n){ this.game_bases = n; };
	isFRLG(){ return (this.type == "fire_red" || this.type == "leaf_green"); }

	/* _editor dictionary Methods */
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
	getOffset(o)	{ return((this.ReadOnlyMemory[o]|this.ReadOnlyMemory[o+1]<<8|this.ReadOnlyMemory[o+2]<<16|this.ReadOnlyMemory[o+3]<<24) - 0x8000000); };
	getShort(o)		{ return(this.ReadOnlyMemory[o]|this.ReadOnlyMemory[o+1]<<8); };
	getByte(o)		{ return(this.ReadOnlyMemory[o]); };
	isROMOffset(o){ return (o >= 0 && o <= 0x2000000); };

	loadROM(file){
		let reader = new FileReader();
		let self = this;
		console.log(file);
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
								if(self.getTextByOffset(null, version, search.length) == search){
									info.lang = lng;
									info.base = game_name;
								}
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
				console.log(tapp);
				$("#loader_info").html(`Tiempo aproximado: ${ (de <= 0 ? 0 : tapp).toFixed(2) } segundos <br/> Bytes restantes: ${e.loaded} / ${e.total} bytes`);

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

	/* Hexadecimal Visualization Methods */
	addHexPanel(id, symmetry){
		this.changeWorkspace("hex");

		/* Code that generates the hex pannel*/
		let panel = `<div class="hexArea" id="${id}"><div class="lefthexpanel"></div><div class="righthexpanel"><div class="hexheaderpanel">`;
		[..."0123456789ABCDEF"].forEach(function(a){panel+=`<div class='hexNum'>${a.toString(16)}</div>`});
		panel += `<div class='clear'></div></div><div class='hexZone'><div class='hexScroll'></div></div></div><div class='clear'></div></div>`; /* <-- */
		$("#hex_editor").prepend(panel);

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
		end = end || this.ReadOnlyMemory.length;
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
	getTextByOffset(dictionary, begin, length){
		let char = this.getByte(begin);
		let maxsize = (length == undefined ? (this.ReadOnlyMemory.length-begin) : Math.min(length, this.ReadOnlyMemory.length-begin));
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
									code += this.writeTextPreview(this.getTextByOffset(txtdictionary, block), 34);
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

					let text = this.getTextByOffset(txtdictionary, hexMsg);
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
		this.code_editor.setValue(code);
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
		let header = this.getOffset(table);
		let voices = this.getOffset(header + 4);
		let tracks = [], index = header + 11;
		while(this.getByte(index) == 0x8){
			tracks.push(this.getOffset(index-3));
			index += 4;
		}
		let instruments = [], index = voices;
		for(let i = voices; i < voices + 0x600; i += 0xC){
			let type = this.getByte(i);
			let instrument = {type: type, offset: i};
			if(type % 0x40 == 0 || type == 0x3 || type == 0xB){
				let offsets = 0;
				instrument.offsets = [this.getOffset(i + 4)];
				if(type == 0x40){
					instrument.offsets.push(this.getOffset(i + 8));
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

	getTableSize(o, e = this.ReadOnlyMemory.length){
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
	*/
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

	/* Main Methods. */
	setGameInformation(i){ this.lang = i.lang; this.type = i.base; };
	getGameLanguage(){ return this.lang; };
	getWorkspaceName(){ return this.currentWorkspace; };
	changeWorkspace(n){
		if(this.currentWorkspace != n){
			let menu_option = $(`#rightside_menu > div[data-value=${n}]`);
			$(".viewer_in").removeClass("viewer_in");

			menu_option.addClass("viewer_in");

			$("#rightpannel > div:not(.lightbox)").addClass('hide');
			$("#" + n + "_editor").removeClass('hide');
			if(menu_option.hasClass("icon-code")) this.code_editor.refresh();
			this.currentWorkspace = n;
		}
	};

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

			//this.loadItemsFromMemory();
			this.hexResult(1863640, "hexResult", "hexTranslate");

			this.map_editor.init();
			this.map_editor.change_map(0, 0);

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
		});
	};
}
