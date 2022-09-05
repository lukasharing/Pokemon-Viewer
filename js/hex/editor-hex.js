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

let editor_hex_mouse_down = false;
let start_drag = {x: 0, y: 0};
let last_drag = {x: 0, y: 0};

function count(prop, event){
  if(event[prop] == null){ return 0; }
  return 1 + count(prop, event[prop]);
}

function select(x0, y0, x1, y1, type){
  let id0 = x0 + (y0 << 4), id1 = x1 + (y1 << 4);
  const txt_childs = document.getElementById("txt_result").childNodes;
  const hex_childs = document.getElementById("hex_result").childNodes;
  const total = Math.abs(id1 - id0);
  const bottom = Math.min(id0, id1);
  for(let k = 0; k <= total; ++k){
    let ic = (k + bottom) % 0x10;
    let jc = (k + bottom) >> 4;
    txt_childs[jc].childNodes[ic].classList[type]("selected");
    hex_childs[jc].childNodes[ic].classList[type]("selected");
  }
}


function hex_click(event){
  editor_hex_mouse_down = event.type === "mousedown";
  if(editor_hex_mouse_down){
    select(start_drag.x, start_drag.y, last_drag.x, last_drag.y, "remove");
    let i = start_drag.x = last_drag.x = count("previousSibling", event.target);
    let j = start_drag.y = last_drag.y = count("previousSibling", event.target.parentNode);
    document.getElementById("txt_result").childNodes[j].childNodes[i].classList.add("selected");
    document.getElementById("hex_result").childNodes[j].childNodes[i].classList.add("selected");
  }
}

function hex_select(event){
  let action = event.type === "mouseover" ? "add" : "remove";
  let i = count("previousSibling", event.target);
  let j = count("previousSibling", event.target.parentNode);

  document.getElementById("txt_result").childNodes[j].childNodes[i].classList[action]("hover");
  document.getElementById("hex_result").childNodes[j].childNodes[i].classList[action]("hover");

  if(editor_hex_mouse_down === true){
    select(i, j, last_drag.x, last_drag.y, "remove");
    last_drag.x = i;
    last_drag.y = j;
    select(start_drag.x, start_drag.y, last_drag.x, last_drag.y, "add");
  }
}



class EHex{
  constructor(self) {
    this.reader = self;

    /*
      Buffer translation
      --> This should optimize the translation of bytes to hex.
    */
    this.hex_buffer = [...new Array(256).keys()].map(e=>Utils.pad(e.toString(16), '0', 2));
    this.selected = new Array();
  };

  addHexPanel(id, symmetry){
		/* Code that generates the hex pannel */

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

  go(offset = 0){
    try{
      const dictionary = this.reader.getDictionary("Text");
      const hex_result = document.getElementById("hex_result");
      const txt_result = document.getElementById("txt_result");
      const height = txt_result.offsetHeight;

      const padding = 30, steps = parseInt(height / padding);

      let hex_result_html = "";
      let txt_result_html = "";

      let l_offset = Math.max(0, offset);
      let r_offset = Math.min(this.reader.size - 1, offset + (steps << 4));
      if(r_offset == this.reader.size - 1){
        l_offset -= (this.reader.size - 1 - offset + (steps << 4));
      }
      l_offset >>= 4;
      r_offset >>= 4;

  		for(let i = l_offset, r = 0; i <= r_offset; ++i, ++r){
        let idx = i << 4;
        hex_result_html += `<div class="hex_line" data-offset="${Utils.pad(idx.toString(16), '0', 8)}">`;
        txt_result_html += `<div class="txt_line">`;
        for(let j = idx, c = 0; j < idx + 0x10; ++j, ++c){
          let byte = this.reader.getByte(j);
          hex_result_html += `<div class="middle" onmousedown="hex_click(event)" onmouseup="hex_click(event)" onmouseover="hex_select(event)" onmouseout="hex_select(event)">${this.hex_buffer[byte]}</div>`;
          let translation = dictionary[byte];
          txt_result_html += `<div class="middle empty" onmousedown="hex_click(event)" onmouseup="hex_click(event)" onmouseover="hex_select(event)" onmouseout="hex_select(event)">${translation == undefined ? '×' : translation}</div>`;
        }
        hex_result_html += `</div>`;
        txt_result_html += `</div>`;
      }

      hex_result.innerHTML = hex_result_html;
      txt_result.innerHTML = txt_result_html;

    }catch(e){
  	   NotificationHandler.pop("Error", e, NotificationType.ERROR);
    }

    /* abs = Math.abs(difference);
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
			content += "</div>";
			symmetry += "</div>";
		}

		if(abs > size){
			$(`#${id} > aside`).html(leftside);
			$(`#${child} > main .hexScroll`).data("dictionary", dictionary).html(symmetry);
			$(`#${id} > main .hexScroll`).html(content);
		}else if(abs > 0){
			let index = (abs - difference) * (size - abs) / (32 * abs);
			for(let k = 0; k < abs/16; k++){
				$(`#${id} .hexValue:eq(${index})`).remove();
				$(`#${child} .fieldValue:eq(${index})`).remove();
				$(`#${id} .fieldValue:eq(${index})`).remove();
			}
			if(difference > 0){
				$(`#${id} > aside`).append(leftside);
				$(`#${child} > main .hexScroll`).append(symmetry);
				$(`#${id} > main .hexScroll`).append(content);
			}else{
				$(`#${id} > aside`).prepend(leftside);
				$(`#${child} > main .hexScroll`).prepend(symmetry);
				$(`#${id} > main .hexScroll`).prepend(content);
			}
		}
    */
	};
};
