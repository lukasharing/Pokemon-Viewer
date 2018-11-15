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
class ECode{
  constructor(self){
    this.reader = self;
		this.comment = "//";
    this.editor = CodeMirror(document.getElementById("#code_editor"), {
			theme: "3024-day",
			lineNumbers: true,
			styleActiveLine: true,
		});

		this.global_constants = [];

    /* Adding all definitions to buffer. */
		let regex = new RegExp("#define.*", "g");
		FileHandler.load(["./definition/std.rbh", "./definition/stdpoke.rbh", "./definition/stdattacks.rbh"], results=>{
			results.forEach(e=>{
				let textReg = regex.exec(data);
				while(textReg){
					let white = textReg[0].split(" "), splName = white[1].split(/_(.+)?/), nameDef = splName[0];
					if(this.global_constants[nameDef] === undefined){ this.global_constants[nameDef] = []; }
					this.global_constants[nameDef].push({
						hexadecimal: parseInt(white[2], 16),
						EN_def: splName[1]
					});

					textReg = regex.exec(data);
				}
			});
		});

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
		let maxsize = (length == undefined ? (this.size-begin) : Math.min(length, this.size-begin));
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
		this.change_workspace("xse");
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
};
