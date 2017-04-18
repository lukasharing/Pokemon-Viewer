function RomReader(){
	// GAME PATH
	this.gamePath = "";
	this.lang 		= "";
	this.type 		= "";

	this.setGamePath = function(p){ this.gamePath = p; };
	this.getLanguage = function(){ return this.lang; };

	// WORKSPACE
	this.currentArea    = "hex";
	this.setArea        = function(n){
		$("main > div:not(.lightbox)").addClass('hide');
		$("#" + n + "Editor").removeClass('hide');
		this.currentArea = n;
	};

	this.getArea        = function(){ return this.currentArea; };
	this.comment = "//";
	this.editor = null;

	// EVENTS
	this.click 	= {down: false, x: 0, y: 0};

	// DICCIONARY
	this.diccionary         = [];
	this.selectedDiccionary = "Text";
	this.getNameDiccionary = function(){ return this.selectedDiccionary; };
	this.setDiccionaryName  = function(n){ this.selectedDiccionary = n; };
	this.getCurrentDiccionary = function(){ return this.diccionary[this.selectedDiccionary] || undefined; };
	this.getDiccionary      = function(n){ return this.diccionary[n] || undefined; };
	this.addDiccionary    = function(name, translation){
		var diccionary = [];
		var lastindex = 0, index;
		if(translation instanceof Array){
			for(var i = 0; i < translation.length; i += 2){
				index = translation[i];
				for(var k = lastindex + 1; k < index; k++){
					diccionary[k] = undefined;
				}
				diccionary[index] = translation[i + 1];
				lastindex = index;
			}
		}else if((/\.(json)$/i).test(translation)){
			$.ajax({ url: translation, dataType: 'text', async: false, success: function(data){
				var json = $.parseJSON(data);
					$.each(json, function(key, val) {
						index = parseInt(key, 16);
						for(var k = lastindex + 1; k < index; k++){
							diccionary[k] = undefined;
						}
						diccionary[index] = val;
						lastindex = index;
					});

				}, error: function(e, a, error){
					console.error("ROMREADER: "+error);
				}
			});
		}else{
			console.error("ROMREADER: Couldn't add this type of diccionary.");
		}
		this.diccionary[name] = diccionary;
	};

	// GAME BUFFERS
	this.memoryOffset = {};
	this.getOffset = function(o){ return this.memoryOffset[o]; };
	this.memoryRom    = [];
	this.getInt = function(o){return(this.memoryRom[o]|this.memoryRom[o+1]<<8|this.memoryRom[o+2]<<16|this.memoryRom[o+3]<<24);};
	this.getPointer = function(o){return(this.memoryRom[o]|this.memoryRom[o+1]<<8|this.memoryRom[o+2]<<16);};
	this.getShort = function(o){return(this.memoryRom[o]|this.memoryRom[o+1] << 8);};
	this.getReverseShort = function(o){return(this.memoryRom[o+1]|this.memoryRom[o]<<8);};
	this.getByte = function(o){return(this.memoryRom[o]); };

	this.loadROM      = function(path, lang, offsets, success){
		this.lang = lang;
		$("#loadingScreen").removeClass("hide");
		$("#game_selection").addClass("hide");
		var oReq = new XMLHttpRequest();
		var d = new Date().getTime();
		oReq.open("GET", path, true);
		oReq.responseType = "arraybuffer";

		oReq.addEventListener("progress", function(oEvent){
			if (oEvent.lengthComputable) {
		    var percentComplete = Math.round(oEvent.loaded / oEvent.total * 100);
				$("#loadingScreen h3").text("Loading the game: " + percentComplete + "%");
				$("#loadingScreen .loader").css("width", percentComplete + "%");
		  }
		}, false);

		var self = this;
		oReq.addEventListener("load", function(oEvent){
			console.log(new Date().getTime() - d);
			$("#cancelGBA").click();
			$("#game_selection").removeClass("hide");
			$("#loadingScreen").addClass("hide");
			self.memoryOffset = offsets;
			self.setGamePath(path);
			self.memoryRom = new Uint8Array(this.response);
			self.init();
			success();
		}, false);


		oReq.addEventListener("error", function(oEvent){
			console.error("ROMREADER: Couldn't download the game");
		}, false);

		oReq.send();
	};

	/* HEX VIEW */
	this.currentOffset    = -10000;
	this.addHexPanel = function(id, simetry){
		var panel = "<div class='hexArea' id='"+ id +"'>"+
									"<div class='lefthexpanel'></div>"+
									"<div class='righthexpanel'>"+
										"<div class='hexheaderpanel'>";
						for(var h = 0; h < 16; h++){
							panel += "<div class='hexNum'>" + h.toString(16) + "</div>";
						}
						panel += "<div class='clear'></div>"+
										"</div>" +
						 				"<div class='hexZone'>"+
											"<div class='hexScroll'></div>"+
										"</div>"+
									"</div><div class='clear'></div>";
		$("#hexEditor").prepend(panel);

		var self = this;
		if(simetry !== undefined){
			$("#"+id).bind('mousewheel DOMMouseScroll mouseleave', function(event){
				if(event.type == "mouseleave"){
					$(this).data("click", false);
				}else{
					var offset = self.currentOffset;
					var wheel = event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0;
					offset = Math.max(0, offset + (1-2*wheel) * 0x10);
					self.hexResult(offset, "hexResult", "hexTranslate", "Text");
				}
			}).on("mouseenter mouseleave", ".fieldValue", function(e){
				var offset = $(this).data("offset");
				if(e.type == "mouseleave"){
					$(".fieldValuehover").removeClass("fieldValuehover");
				}else{
					$(this).addClass("fieldValuehover");
					$("#"+simetry+" .fieldValue[data-offset="+offset+"]").addClass("fieldValuehover");
				}
			}).on("mouseenter mousedown mouseup", ".byteValue", function(e){
				var offset = $(this).parent().data("offset");
				var type = e.type;
				var click = $("#"+id).data("click");
				if(type == "mouseenter" && click){

						$(this).data("selected", true);
						$(this).addClass("byteValuehover");
						$("#"+simetry+" .fieldValue[data-offset="+offset+"] .byteValue:eq("+$(this).index()+")").addClass("byteValuehover");

				}else if(type == "mousedown"){

					$(".byteValuehover").data({selected: false, selected: ""}).removeClass("byteValuehover");
					$("#"+id).data("click", true);
					$(this).data({selected: true, selected: "first"});
					$(this).addClass("byteValuehover");

				}else if(type == "mouseup"){
					$("#"+id).data("click", false);
					$(this).data("selected", "last");
				}
			});
		}
	};

	this.hexResult = function(offset, id, child, diccionary){
		var difference = offset - this.currentOffset, abs = Math.abs(difference);
		var size = (Math.floor($(window).height() / 36) - 1) * 16;
		diccionary  = this.diccionary[diccionary];
		var content = "", simetry = "", leftside = "", helper = "";
		for (var i = offset; i < offset + Math.min(abs, size); i += 16){
			leftside += "<div class='hexValue'>" + i.toString(16).pad('0', 8) + "</div>";
			helper = "<div class='fieldValue' data-offset='" + (i) + "'>";
			content += helper;
			simetry += helper;
			for(var j = i; j <= i + 0xf; j++){
				var byte = this.getByte(j), value = diccionary == undefined ? String.fromCharCode(byte) : diccionary[byte];
				content += "<div class='byteValue'>"+ byte.toString(16).pad('0', 2).toUpperCase() +"</div>";
				simetry += "<div class='byteValue "+ (value == undefined ?  "emptybyte'>" : ("'>"+value))+"</div>";
			}
			helper = "<div class='clear'></div></div>";
			content += helper;
			simetry += helper;
		}

		if(abs > size){
			$("#"+id+" > .lefthexpanel").html(leftside);
			$("#"+child+" > .righthexpanel .hexScroll").data("diccionary", diccionary).html(simetry);
			$("#"+id+" > .righthexpanel .hexScroll").html(content);
		}else if(abs > 0){
			var index = (abs - difference) * (size - abs) / (32 * abs);
			for(var k = 0; k < abs/16; k++){
				$("#"+id+" .hexValue:eq("+index+")").remove();
				$("#"+child+" .fieldValue:eq("+index+")").remove();
				$("#"+id+" .fieldValue:eq("+index+")").remove();
			}
			if(difference > 0){
				$("#"+id+" > .lefthexpanel").append(leftside);
				$("#"+child+" > .righthexpanel .hexScroll").append(simetry);
				$("#"+id+" > .righthexpanel .hexScroll").append(content);
			}else{
				$("#"+id+" > .lefthexpanel").prepend(leftside);
				$("#"+child+" > .righthexpanel .hexScroll").prepend(simetry);
				$("#"+id+" > .righthexpanel .hexScroll").prepend(content);
			}
		}
		this.currentOffset = offset;
	};

	this.findByInt = function(chain, total, offset){
		total = total || this.memoryRom.length;
		var result = [];
		var last = chain[0];
		for(var k = offset || 0, c = 0, equal = 0; k < this.memoryRom.length && c < total; k++){
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

	this.findByHex = function(hex, total, offset){
		if(hex.length % 2 === 0){
			var chain = hex.match(/.{1,2}/g).map(function(a){
				return (~a.indexOf("X") ? -1 : parseInt(a,16));
			});
			return this.findByInt(chain, total, offset);
		}else{
			console.error("ROMREADER: This hexadecimal chain has to be even.");
		}
	};

	this.findByDiccionary = function(chain, diccionary, total, offset){
		diccionary = this.getDiccionary(diccionary);
		var hex = chain.split("").map(function(e){ return diccionary.indexOf(e);  });
		return this.findByInt(hex, total, offset);
	};

	this.readString = function(offset, maxLength){
		var result = "";
		var tb = this.getDiccionary("Text");
		for (var c = 0; c < maxLength; c++) {
			var currChar = this.getByte(offset + c);
			if(tb[currChar] != null){ result += tb[currChar]; }
			else{
				if (currChar == 0xFF){ break; }
				else if (currChar == 0xFD){
					result += "\\v" + (this.getByte(offset + (c++) + 1) & 0xFF).toString(16).pad('0', 2);
				} else {
					result += "\\x" + currChar.toString(16).pad('0', 2);
				}
			}
		}
		return result;
	}

	this.STRING_TYPE = [];
	this.addDefinition = function(url){
		var regex = /[^#define]+/g;
		var self = this;
		$.ajax({ url: url, dataType: 'text', async: false, success: function(data){
			var textReg;
			do {
				textReg = regex.exec(data);
				if (textReg)
				{
					var white = textReg[0].split(" ");
					var splName = white[1].split(/_(.+)?/);
					var nameDef = splName[0];
					if(self.STRING_TYPE[nameDef] === undefined){ self.STRING_TYPE[nameDef] = []; }
					self.STRING_TYPE[nameDef][parseInt(white[2], 16)] = splName[1]; // white[1]
				}
			} while (textReg);
		}, error: function(e, a, error){ console.error("ROMREADER"+error); }});
	};

	//** CODEVIEW **//
	this.addTextComment = function(t, n){ return " /* "+t.split('').map(function(v,i,a){return(i>n?null:a[i])}).join('')+(t.length>n?"":"...")+" */"; };
	this.addTitleBlock = function(title){ return this.comment + "---------------\n" + this.comment + " " + title + "\n"+this.comment + "---------------"; };
	this.codeResult = function(codeOffset){
		var prevBit = this.getByte(Math.max(0, codeOffset - 1));
		var code = this.addTitleBlock("Code");
		if(prevBit <= 0x08 || prevBit == 0x66 || prevBit >= 0xFE){
			// DICCIONARIES
			var cdeDiccionary = this.getDiccionary("Code"),
					txtDiccionary = this.getDiccionary("Text"),
					movDiccionary = this.getDiccionary("Movement");

			var bufferHex = [
							[codeOffset /* CODE */],
							[/* DIALOGUE */],
							[/* MOVEMENT */],
							[/* BRAILLE	*/]];

			while(bufferHex[0].length > 0){
				var offset = bufferHex[0][0];
				code += "\n#org" + this.writeHexadecimal(offset, 3);
				var tag = 4, itt = 0;
				while(tag > 3){
					var org = cdeDiccionary[this.getByte(offset++)];
					code += "\n" + org.val;
					for(var i = 0; i < org.bUsed.length; i++){
						var step_byte = org.bUsed[i];
						if(step_byte instanceof Array){
							var size = step_byte[0];
							if($.type(size) == "string"){
								// IF THIS BYTE IS IN THE DICCIONARY, TRANSLATE IT.
								var hex = this.toHexDecimal(offset, step_byte[1]);
								var type = this.STRING_TYPE[size];
								code += " " + (type[hex] || "0x" + hex.toString(16).toUpperCase()) + " " + (size == "CMP" ? "goto" : "");
								offset += step_byte[1];
							}else{
								code += this.writeHexadecimal(offset, size);
								switch (step_byte[1]) {
									case "OFFSET":
										bufferHex[0].push(this.toHexDecimal(offset, 3));
									break;
									case "TEXT":
										var txtOff = this.toHexDecimal(offset, 3);
										var text = this.getTextByHex(txtDiccionary, txtOff);
										bufferHex[1].push({offset: txtOff, text: text});
										code += this.addTextComment(text, 34);
									break;
								}
								offset += step_byte[0];
							}
						}else{
							code += this.writeHexadecimal(offset, step_byte);
							offset += step_byte;
						}
					}
					tag = this.getByte(offset);
				}
				code += "\n"+cdeDiccionary[this.getByte(offset)].val+"\n";
				bufferHex[0].splice(0, 1);
			}

			if(bufferHex[1].length > 0){
				code += "\n\n\n" + this.addTitleBlock("Strings");
				for(var b = 0; b < bufferHex[1].length; b++){
					var hexMsg = bufferHex[1][b];
					code += "\n#org 0x" + hexMsg.offset.toString(16).toUpperCase() + "\n" +
										"= " + hexMsg.text +"\n";
				}
			}

			if(bufferHex[2].length > 0){
				code += "\n\n\n" + this.addTitleBlock("Movements");
				for(var b = 0; b < bufferHex[2].length; b++){
					var hexMsg = bufferHex[2][b];
					code += "\n#org 0x" + hexMsg.toString(16).toUpperCase() + "\n" +
										this.getMovementsByHex(movDiccionary, hexMsg) + "\n";
				}
			}
		}
		this.editor.setValue(code);
	};

	this.isString = function(o){ return (Object.prototype.toString.call(o) === '[object String]'); };

	this.toHexDecimal = function(b, k){
		var hexfinal = 0;
		for(var n = 0; n < k; n++){
			hexfinal |= this.getByte(b + n) << (n * 8);
		}
		return hexfinal;
	};

	this.writeHexadecimal = function(o, s){
		return " 0x" + this.toHexDecimal(o, s).toString(16).toUpperCase();
	};

	this.getTextByHex = function(diccionary, offset, lastOffset){
		var text = "";
		var char = this.getByte(offset++), lastOffset = lastOffset || this.memoryRom.length;
		while(char != 0xFF && offset <= lastOffset){
			text += diccionary == undefined ? String.fromCharCode(char) : diccionary[char];
			char = this.getByte(offset++);
		}
		return text;
	};

	this.getMovementsByHex = function(d, b){
		var t = "";
		if(d !== undefined){
			var i = this.getByte(b++);
			while(i != 0xFE && d[i] != undefined){
				t += "\n#raw 0x"+ i.toString(16).toUpperCase() +"\u0009// "+ d[i].EN_def+"";
				i = this.getByte(b++);
			}
		}
		return t;
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
	*/
	this.getSongInfo = function(a){
		var songtable = this.getOffset("songtable");
		var table = songtable.offset + parseInt(songtable[a], 16) * 8;
		var header = this.getPointer(table);
		var voices = this.getPointer(header + 4);
		var tracks = [], index = header + 11;
		while(this.getByte(index) == 0x8){
			tracks.push(this.getPointer(index-3));
			index += 4;
		}
		var instruments = [], index = voices;
		for(var i = voices; i < voices + 0x600; i += 0xC){
			var type = this.getByte(i);
			var instrument = {type: type, offset: i};
			if(type % 0x40 == 0 || type == 0x3 || type == 0xB){
				var offsets = 0;
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
		var self = this;
		var f = m[k];
		var kj = {a:this.getByte(f + 8), d:this.getByte(f + 9), s:this.getByte(f + 10), r:this.getByte(f + 11)};
		var env = T("adshr", kj, T("sin")).on("ended", function() {
			this.pause();
			if(k < m.length) self.ADSR(m, k + 1);
		}).bang().play();
	};

	/* MAP
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
	this.maps = [];
	this.getMapContext = function(){ return $("#canvas_map")[0].getContext("2d"); };
	this.bufferMemory = [];

	/* COLORS */
	this.GBA2HEX = function(pal){return (pal&0x1F)<<19|(pal&0x3e0)<<6|(pal&0x7c00)>>7;};
	this.HEX2GBA = function(pal){
		var encode = (pal&0x0000ff)<<7|(pal&0x00ff00)>>6|(pal&0xff0000)>>19;
		return ((encode&0xff)<<8|encode>>8);
	};

	/* DECOMPRESSION */
	this.decompressLZSS = function(offset, totalunCompressed){
		var position = 0, uncompressed = [];
		while(position < totalunCompressed){
			var compressed = this.getByte(offset++);
			for(var bit = 7; bit >= 0; bit--){
				if(compressed >> bit & 1){ // COPY ELEMENT TIME
					var short = this.getReverseShort(offset);
					var size = position + ((3 + (short>>0xC)) << 1);
					var copy = ((short & 0xFFF) + 1) << 1;
					for (var u = position; u < size; u += 2){
						uncompressed[u] = uncompressed[u - copy];
						uncompressed[u + 1] = uncompressed[u + 1 - copy];
					}
					offset 	 += 2;
					position = size;
				}else{  // COPY LINE TIME
					var b = this.getByte(offset++);
					uncompressed[position++] = b & 0xf;
					uncompressed[position++] = b >> 4;
				}
				if(position >= totalunCompressed) break;
			}
		}
		return uncompressed;
  };

	this.decompressGBA = function(offset, total){
		var compress = [];
		for(var k = 0; k < total; k++){
			var b = this.getByte(offset + k);
			compress[k * 2] = b & 0xf;
			compress[k * 2 + 1] = b >> 4;
		}
		return compress;
	};

	/* PALETTES */
	this.getPalettes = function(offset){
		var palettes = [];
		for(var c = 0; c < 16; c++){
			palettes[c] = this.GBA2HEX(this.getShort(offset + c * 2));
		}
		return palettes;
	};

	this.getTilesetPalettes = function(offset, b){
		var palettes = [];
		for(var i = 0; i < 6 + b; i++){
			palettes = palettes.concat(this.getPalettes(offset + i * 32));
		}
		return palettes;
	};

	this.headersLength = function(){
		var o = n = this.memoryOffset.maptable.table_offset;
		while(this.getPointer(o) != 0x2){ o+=4; }
		return (o-n)/4;
	};

	this.overworldSprites = [];

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
	this.findOverworldSprites = function(offset){
		var helper 	= $("#canvashelper")[0];
		var ctx 		=	helper.getContext("2d");
		var sprites = [], index = 0;

		/* SPRITES PALETTES */
		var palettes = [], paletteOffset = this.memoryOffset.spritetable.palette;
		while(this.getByte(paletteOffset + 3) == 0x8){
			palettes[this.getByte(paletteOffset + 4)] = this.getPalettes(this.getPointer(paletteOffset));
			paletteOffset+=8;
		}

		while(this.getByte(offset + index + 3) == 0x8){
			var pointer = this.getPointer(offset + index);
			if(this.getShort(pointer) == 0xFFFF){
				var texture = this.getPointer(pointer + 28);
				if(this.getByte(texture + 3) == 0x8){
					var decompression = this.decompressGBA(this.getPointer(texture), this.getShort(texture + 4));

					var width 	= helper.width 	= this.getShort(pointer + 8);
					var height 	= helper.height = this.getShort(pointer + 10);
					var palette = palettes[this.getByte(pointer + 2)];
					var mask 	= ctx.createImageData(width, height);
					for(var j = 0; j < height; j += 8){
						for(var i = 0; i < width; i += 8){
							for(var h = 0; h < 8; h++){
								for(var w = 0; w < 8; w++){
									var id = (j + h) * width + i + w;
									var pixel = decompression[j * width + ((i + h) << 3) + w];
									if(pixel != 0){
										var color = palette[pixel];
										id *= 4;
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
					var sprite = new Image();
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

	this.addHeader = function(headerIndex){
		if(headerIndex >= this.headersLength() || this.maps[headerIndex] != undefined) return;
		var type 				= ("AXV").indexOf(this.type) >= 0 ? 0 : 1;
		var pointer 		= this.getPointer(this.memoryOffset.maptable.table_offset + headerIndex * 4);
		var nextPointer = this.getPointer(this.memoryOffset.maptable.table_offset + (headerIndex + 1) * 4);

		var nextMap = pointer;
		var left = "";
		left += "<div class='header_option'> <div class='header_name'>HEADER " + headerIndex + "</div>";
		var maps = [];
		var mepe = 0;
		while(nextMap < nextPointer && this.getPointer(nextMap) != 0){
			var header = this.getPointer(nextMap);
			var map = this.getPointer(header), events = this.getPointer(header + 4);
			/* TODO: COMRPOBAR QUE SON OFFSETS */
			if(this.getByte(header + 3) == 0x08 && this.getByte(header + 7) == 0x08 && this.getByte(map + 15) == 0x08){
				var mapIndex = (nextMap - pointer) / 4;

				var structure = [], wmap = this.getInt(map), hmap = this.getInt(map+4);
				var structOffset = this.getPointer(map + 12);
				for(var j = 0, jj = 0; j < hmap; j++, jj += wmap){
					structure[j] = [];
					for(var i = 0; i < wmap; i++){
						structure[j][i] = this.getShort(structOffset + (jj + i) * 2);
					}
				}

				var connection = this.getPointer(header + 12);
				var connections = [];
				if(connection != 0x0){
					var total = this.getInt(connection);
					var pconn = this.getPointer(connection + 4);
					for(var c = 0; c < total; c++){
						connections.push({
							direction: this.getInt(pconn),
							offset: this.getInt(pconn + 4),
							bank: this.getByte(pconn + 8),
							map: this.getByte(pconn + 9)
						});
						pconn += 12;
					}
				}

				/*PERSONS*/
				var total = this.getByte(events), persons = [];
				if(total > 0){
					var point = this.getPointer(events + 4);
					for(var i = 0; i < total; i++){
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

				/*WARPS*/
				var total = this.getByte(events+1), warps = [];
				if(total > 0){
					var point = this.getPointer(events + 8);
					for(var i = 0; i < total; i++){
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

				/*TRIGGERS*/
				var total = this.getByte(events+2);
				var triggers = [];
				if(total > 0){
					var point = this.getPointer(events + 12);
					for(var i = 0; i < total; i++){
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

				/*SIGNS*/
				var total = this.getByte(events+3);
				var signs = [];
				if(total > 0){
					var point = this.getPointer(events + 16);
					for(var i = 0; i < total; i++){
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

				var palettes = [], tilesets = [], blocks = [];
				for(var i = 0; i < 2; i++){
					var tileset = this.getPointer(map + 16 + 4 * i);

					/* PALETTE TILESET */
					var primary = this.getByte(tileset + 1);
					var palette = this.getPointer(tileset + 8) + primary * 0xC0;
					var pal = this.bufferMemory[palette];
					if(pal == undefined){
						this.bufferMemory[palette] = this.getTilesetPalettes(palette, primary);
					}
					palettes.push(palette);

					/* BLOCKS MAP */
					var blocksPointer = this.getPointer(tileset + 12);
					var endBlocks			= type ? this.getPointer(tileset + 20) : this.getPointer(tileset + 16);
					if(this.bufferMemory[block] == undefined){
						var realBlocks 	= (endBlocks - blocksPointer) >> 4;
						var totalBlocks = Math.max(0x200, realBlocks);
						var dataBlocks = [];
						for(var b = 0; b < totalBlocks; b++){
							var block = [];
							for(var o = 0; o < 8; o++){
								var att = this.getShort(blocksPointer + (b<<4) + (o<<1));
								block[o] = [att >> 12, att & 0x3ff, (att >> 10) & 0x3];
							}
							dataBlocks.push(block);
						}
						this.bufferMemory[blocksPointer] = {blocks: dataBlocks, totalBlocks: realBlocks};
					}
					blocks.push(blocksPointer);

					/* TILESET IMAGE */
					var image = this.getPointer(tileset + 4);
					var tileset = this.bufferMemory[image];
					if(tileset == undefined){
						var tiles;
						if(this.getByte(image)){ // IS COMPRESSED
							var totalunCompressed = this.getByte(image + 1)<<1|this.getByte(image + 2)<<9|this.getByte(image + 3)<<17;
							tiles = this.decompressLZSS(image + 4, totalunCompressed);
							for(var b = tiles.length; b < 0x8000; b++){
								tiles[b] = 0;
							}
						}else{
							tiles = this.decompressGBA(image, 0x4000);
						}
						this.bufferMemory[image] = tiles;
					}
					tilesets.push(image);
				}

				var offsetName = this.getPointer(this.memoryOffset.maptable.name_offset + (this.getByte(header+20)-88*type)*4*(2-type) + (4*(1-type)));
				var mapName = this.getTextByHex(this.getDiccionary("Text"), offsetName);
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

	/* DRAW MAP */
	this.camera = new Camera();
	this.currentMap = {
		map: undefined,
		image: null,
		loaded: false,
		time: 0
	};

	this.loadMapArea = function(){
		var total = this.headersLength();
		for(var i = 0; i < total; i++){
			this.addHeader(i);
		}
		var element = $("#canvas_map")[0];
		this.camera.resize(element.width 	= $(window).width() - 650, element.height	= $(window).height() - 40);
	};

	this.changeMap = function(headerIndex, mapIndex){
		var ctx = this.getMapContext();
		var currentMap = this.currentMap.map = this.maps[headerIndex][mapIndex];
		this.currentMap.headerIndex = headerIndex;
		this.currentMap.mapIndex 		= mapIndex;
		this.currentMap.loaded 			= false;
		this.currentMap.time 				= 0;
		var twidth 	= currentMap.map.structure[0].length;
		var theight = currentMap.map.structure.length;
		var width 	= twidth * 16, height = theight * 16;
		var img 		= this.currentMap.image = ctx.createImageData(width, height), data = img.data;
		this.camera.restore();
		this.currentMap.allPalettes = this.bufferMemory[currentMap.map.palette[0]].concat(this.bufferMemory[currentMap.map.palette[1]]);
		this.currentMap.allTilesets = this.bufferMemory[currentMap.map.tileset[0]].concat(this.bufferMemory[currentMap.map.tileset[1]]);
		var blocks0 = this.bufferMemory[currentMap.map.block[0]];
		var blocks1 = this.bufferMemory[currentMap.map.block[1]];
		var blocks  = this.currentMap.allBlocks 	= blocks0.blocks.concat(blocks1.blocks);

		for(var j = 0; j < theight; j++){
			for(var i = 0; i < twidth; i++){
				this.drawBlock(i<<1, j<<4, blocks[currentMap.map.structure[j][i]&0x3ff], img);
			}
		}
		this.drawRightBlocks([blocks0, blocks1]);
	};

	this.drawMap = function(){
		var ctx = this.getMapContext();
		var self = this;
		setInterval(function(){
			var widthCamera = self.camera.getWidth(), heightCamera = self.camera.getHeight();
			var widthMap = self.currentMap.image.width, heightMap = self.currentMap.image.height;
			ctx.clearRect(0, 0, widthCamera, heightCamera);
			self.camera.update();
			self.camera.mapX(Math.max(0, widthMap - widthCamera) >> 1);
			self.camera.mapY(Math.max(0, heightMap - heightCamera) >> 1);

			if(!self.currentMap.loaded){
				var time = self.currentMap.time++;
				self.effect2(time);
			}

			var camerax = Math.round((widthCamera 	- widthMap) / 2  + self.camera.getX());
			var cameray = Math.round((heightCamera 	- heightMap) / 2 + self.camera.getY());

			ctx.putImageData(self.currentMap.image, camerax, cameray);
			var colorEvent = [0x33cc00, 0xffff00, 0x33ffff, 0xff00ff];
			for(var k = 0; k < 4; k++){
				var color 	= colorEvent[k].toString(16);
				var events 	= self.currentMap.map.events[k];
				for(var i = 0; i < events.length; i++){
					var e = events[i];
					ctx.beginPath();
					ctx.rect(camerax + e.x * 16, cameray + e.y * 16, 16, 16);
					ctx.strokeStyle = "#" + color;
					ctx.stroke();
				}
			}

			var entities = self.currentMap.map.events[0];
			for(var k = 0; k < entities.length; k++){
				var entity = entities[k];
				var sprite = self.overworldSprites[entity.picture];
				if(sprite != undefined){
					sprite = sprite.sprite;
					ctx.drawImage(sprite, (entity.x + 0.5) * 16 - (sprite.width>>1) + camerax, (entity.y + 1) * 16 - sprite.height + cameray);
				}
			}

		}, 100/6);
	};

	/* JUST TRYING EFFECTS */
	this.effect1 = function(t){
		var widthMap = this.currentMap.image.width, heightMap = this.currentMap.image.height;
		for(var j = 0; j < heightMap; j += 16){
			for(var i = Math.abs((t>>4)-(j>>4)%2)<<4; i < widthMap; i += 32){
				for(var h = 0; h < 16; h++){
					this.currentMap.image.data[((j + h) * widthMap + i + (t % 16)) * 4 + 3] = 255;
				}
			}
		}
		if(t > 32){
			this.currentMap.loaded = true;
		}
	};

	this.effect2 = function(t){
		var widthMap 	= this.currentMap.image.width, heightMap = this.currentMap.image.height;
		var mj = Math.min(t, heightMap>>5), mi = Math.min(t, widthMap>>5);
		var hm = heightMap >> 5, wm = widthMap >> 5;
		for(var j = -mj; j <= mj; j++){
			var rj = j * j, jj = (hm + j) << 4;
			for(var i = -mi; i <= mi; i++){
				var ri = i * i, ii = (wm + i) << 4;
				if(ri + rj < t * t){
					for(var h = 0; h < 16; h++){
						var hh = (jj + h) * widthMap;
						for(var w = 0; w < 16; w++){
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

	this.drawRightBlocks = function(blocks){
		var elm = $("#blocks_map")[0];
		var ctx = elm.getContext("2d");
		var realHeight = blocks.reduce(function (a, b){ return a.totalBlocks + b.totalBlocks; })>>3;
		var width = elm.width 	= 128, height = elm.height = realHeight << 4;
		ctx.clearRect(0, 0, width, height);
		var img = ctx.createImageData(width, height), data = img.data;
		for(var i = 0, total = width * height * 4; i < total; i+= 4){ data[i + 3] = 255; } // SET OPACITY 255.

		var currentHeight = 0;
		for(var k = 0; k < blocks.length; k++){
			var mapBlocks = blocks[k];
			realHeight = mapBlocks.totalBlocks >> 3;
			for(var j = 0; j < realHeight; j++){
				var y = currentHeight + j * 16, jj = j * 8;
				for(var i = 0; i < 8; i++){
					this.drawBlock(i * 2, y, mapBlocks.blocks[jj + i], img);
				}
			}
			currentHeight += realHeight<<4;
		}
		ctx.putImageData(img, 0, 0);
	};

	this.drawBlock = function(x, y, block, canvas){
		canvas = canvas || this.currentMap.image;
		var width = canvas.width, data = canvas.data;
		for(var b = 0; b < 8; b++){
			var tile = block[b];
			var index = tile[0] * 16, palette = tile[1] * 64, flip = tile[2];
			var x_flip = 7 * (flip & 0x1), y_flip = 3.5 * (flip & 0x2);
			for(var h = 0; h < 8; h++){
				var j = Math.abs(y_flip - h);
				for(var w = 0; w < 8; w++){
					var i = Math.abs(x_flip - w);
					var pixel = this.currentMap.allTilesets[palette + j * 8 + i] & 0xf;
					if(pixel != 0){
						var id = ((y + (b&0x2) * 4 + h) * width + (x + (b&0x1)) * 8 + w) * 4;
						var color = this.currentMap.allPalettes[index + pixel];
						data[id + 0] = (color >> 16) & 0xff;
						data[id + 1] = (color >> 8) & 0xff;
						data[id + 2] = color & 0xff;
					}
				}
			}
		}
	};

	this.getEntity = function(i, j){
		var all = this.currentMap.map.events[0];
		for(var k = 0; k < all.length; k++){
			var entity = all[k];
			if(entity.x == i && entity.y == j){
				return entity;
			}
		}
		return undefined;
	};

	/*this.fillRectangle = function(data, x, y, width, height, color, lmw, lmh){
		var r = color>>16&0xFF, g = color>>8&0xFF, b = color&0xFF;
		for(var j = y; j < y + height; j++){
			var jj = j * lmw;
			for(var i = x; i < x + width; i++){
				var id = (jj + i) * 4;
				data[id] = r;
				data[id + 1] = g;
				data[id + 2] = b;
			}
		}
	};

	this.strokeRectangle = function(data, x, y, width, height, color, size, lmw, lmh){
		var r = color>>16&0xFF, g = color>>8&0xFF, b = color&0xFF;
		for(var j = 0; j < height; j++){
			var jj = (j + y) * lmw + x;
			var id0 = jj * 4, id1 = id0 + (width - 1) * 4;
			for(var b = 0; b < size; b++){
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
		for(var i = size; i < width - size; i++){
			var jj = y * lmw + x + i;
			var id0 = jj * 4, id1 = id0 + (height - 1) * lmw * 4;
			for(var b = 0; b < size; b++){
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

	this.init = function(){
		var self = this;
		//EVENTS
		$("body").mousedown(function(e){
			self.click = {down: true, x: e.pageX, y: e.pageY};
		}).mouseup(function(e){
			self.click.down = false;
			$(".grabbing").removeClass("grabbing");
		});

		// ADD TO DICCIONARY
		this.addDiccionary("Text", "./decrypt/text_table_"+this.getLanguage()+".json");
		this.addDiccionary("Code", "./decrypt/dcccode.json");
		this.addDiccionary("Movement", "./decrypt/dccmovement_rbspem.json");

		// ADD TO DEFINITION
		this.addDefinition("./definition/std.rbh");
		this.addDefinition("./definition/stdpoke.rbh");
		this.addDefinition("./definition/stditems.rbh");
		this.addDefinition("./definition/stdattacks.rbh");

		// CLEAR PANELS AND ADD NEW ONES
		$(".hexArea").remove();
		this.addHexPanel("hexTranslate", "hexResult");
		this.addHexPanel("hexResult", "hexTranslate");

		this.type = this.getTextByHex(undefined, 0xAC, 0xAF);

		this.loadMapArea();
		this.findOverworldSprites(this.memoryOffset.spritetable.offset);
		this.changeMap(0, 0);
		this.drawMap();

		$(".header_map").on("click", function(e){
			self.changeMap(parseInt($(this).data("bank")), parseInt($(this).data("map")));
		});

		$("#canvas_map").mousedown(function(e){
			e.preventDefault();
			if(e.ctrlKey){
				$(this).addClass("grabbing");
			}else{
				var camera = self.camera;
				var mapwidth = self.currentMap.image.width, mapheight = self.currentMap.image.height;
				var mouseX = e.pageX - $(this).offset().left + ((mapwidth - $(this).width())>>1) - camera.x;
				var mouseY = e.pageY - $(this).offset().top + ((mapheight - $(this).height())>>1) - camera.y;
				if(mouseX >= 0 && mouseX < mapwidth && mouseY >= 0 && mouseY < mapheight){
					var xBlock = mouseX>>4;
					var yBlock = mouseY>>4;
					if(e.shiftKey){
						var pick = self.getEntity(xBlock, yBlock);
						self.codeResult(pick.script);
					}else{
						var block  = camera.properties.block || self.currentMap.allBlocks[1];
						self.drawBlock(xBlock<<1, yBlock <<4, block);
					}
				}
			}
		}).on("mousemove", function(e){
			e.preventDefault();
			var mouseX = e.pageX, mouseY = e.pageY;
			if(self.click.down){
				if(e.ctrlKey){
					var canvas = $("#canvas_map");
					self.camera.vx += (mouseX - self.click.x)/8;
					self.camera.vy += (mouseY - self.click.y)/8;
					self.click.x = mouseX;
					self.click.y = mouseY;
				}else{
					var camera = self.camera;
					var mapwidth = self.currentMap.image.width, mapheight = self.currentMap.image.height;
					var mouseX = e.pageX - $(this).offset().left + ((mapwidth - $(this).width())>>1) - camera.x;
					var mouseY = e.pageY - $(this).offset().top + ((mapheight - $(this).height())>>1) - camera.y;
					if(mouseX >= 0 && mouseX < mapwidth && mouseY >= 0 && mouseY < mapheight){
						var blockx = mouseX>>4;
						var blocky = mouseY>>4;
						var block  = camera.properties.block || self.currentMap.allBlocks[1];
						self.drawBlock(blockx<<1, blocky <<4, block);
					}
				}
			}
		});

		$("#blocks_map").on("click", function(e){
			var xBlock = (e.pageX - $(this).offset().left)>>4;
			var yBlock = (e.pageY - $(this).offset().top)>>4;
			var limitY = (self.bufferMemory[self.currentMap.map.map.block[0]].totalBlocks)>>3;
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
		this.codeResult(0x14B7C3);//--3821912
		this.hexResult(415853, "hexResult", "hexTranslate", "Text"); // , 2650292
	};
}
