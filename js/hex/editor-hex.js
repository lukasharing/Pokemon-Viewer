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
let start_drag = 0;
let last_drag = 0;
let write_pointer = {id: 0, size: 0, parent: null}

function count(prop, event){
  if(event[prop] == null){ return 0; }
  return 1 + count(prop, event[prop]);
}

function select(id0, id1, type){
  const txt_childs = document.getElementById("txt_result").childNodes;
  const hex_childs = document.getElementById("hex_result").childNodes;
  const total = Math.abs(id1 - id0);
  const bottom = write_pointer.id = Math.min(id0, id1);
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
    if(write_pointer.parent !== null){
        write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].classList.remove("onwrite");
    }
    write_pointer.parent = event.target.parentNode.parentNode;

    select(start_drag, last_drag, "remove");
    let i = count("previousSibling", event.target);
    let j = count("previousSibling", event.target.parentNode);
    start_drag = last_drag = write_pointer.id = i + (j << 4);
    document.getElementById("txt_result").childNodes[j].childNodes[i].classList.add("selected");
    document.getElementById("hex_result").childNodes[j].childNodes[i].classList.add("selected");
    write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].classList.add("onwrite");
  }
}

function hex_select(event){
  let action = event.type === "mouseover" ? "add" : "remove";
  let i = count("previousSibling", event.target);
  let j = count("previousSibling", event.target.parentNode);

  document.getElementById("txt_result").childNodes[j].childNodes[i].classList[action]("hover");
  document.getElementById("hex_result").childNodes[j].childNodes[i].classList[action]("hover");

  let id = i + (j << 4);
  if(editor_hex_mouse_down === true){
    write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].classList.remove("onwrite");

    select(id, last_drag, "remove");
    last_drag = id;
    select(start_drag, last_drag, "add");
    write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].classList.add("onwrite");
  }
}

function hex_wheel(event){
  let direction = Math.sign(event.deltaY) << 4;
  RomEditor.hex_editor.go(RomEditor.hex_editor.current + direction);
}

function hex_keyup(event){
  event.preventDefault();
  if(write_pointer.parent != null){
    let lowerbound = Math.min(start_drag, last_drag);
    let upperbound = Math.max(start_drag, last_drag);

    let inc = 0;
    let area = write_pointer.parent.id;
    let letter = 1;
    // Remove Char
    switch(event.keyCode){
      case 8: // Delete
        inc = -1;
        --write_pointer.size;
        if(write_pointer.size < 0){
          write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].innerHTML = "00";
        }
      break;
      case 38: inc = -16; break; // Up
      case 40: inc = +16; break; // Down
      case 37: inc = -1; break; // Left
      case 39: inc = +1; break; // Right
      default:
        if(event.ctrlKey && event.keyCode === 67){ // Copy Ctrol C.
          let copy = "";
          for(let j = lowerbound; j <= upperbound; ++j){
            let x = j % 0x10, y = j >> 4;
            copy += write_pointer.parent.childNodes[y].childNodes[x].innerHTML;
            Utils.copyToClipboard(copy);
          }
        }else if(event.key.length == 1){
          if(area === "hex_result" && !isNaN(parseInt(event.key, 16))){
            inc = 1;
            letter = 2;
            if(write_pointer.size === 0){
              write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].innerHTML = event.key;
            }else{
              write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].innerHTML += event.key;
            }
            ++write_pointer.size;
          }
        }
      break;
    }

    if(inc != 0){
      write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].classList.remove("onwrite");
      write_pointer.id = Math.min(Math.max(lowerbound, write_pointer.id + inc), upperbound);
      write_pointer.parent.childNodes[write_pointer.id >> 4].childNodes[write_pointer.id % 0x10].classList.add("onwrite");
    }

    if(write_pointer.size < 0 || write_pointer.size >= letter){
      write_pointer.size = 0;
    }
  }
}

class EHex{
  constructor(self){
    this.reader = self;

    /*
      Buffer translation
      --> This should optimize the translation of bytes to hex.
    */
    this.current = -self.size;
    this.hex_buffer = [...new Array(256).keys()].map(e=>Utils.pad(e.toString(16), '0', 2));
  };

  go(offset = 0){
    try{
      const dictionary = this.reader.getDictionary("text_table_en");
      const hex_result = document.getElementById("hex_result");
      const txt_result = document.getElementById("txt_result");
      const height = txt_result.offsetHeight;

      const padding = 30, steps = parseInt(height / padding);

      let remainder = Math.abs(this.current - offset) >> 4;
      let element = "firstElementChild";
      let append = "append";
      let extra = steps;
      if(this.current > offset){
        element = "lastElementChild";
        append = "prepend";
        extra = 0;
      }

      let total_remove = Math.min(hex_result.childElementCount, remainder);
      for(let i = 0; i < total_remove; ++i){
        hex_result.removeChild(hex_result[element]);
        txt_result.removeChild(txt_result[element]);
      }

      let total_add = Math.min(remainder, steps);
      console.log(total_add);
  		for(let i = 0; i < total_add; ++i){
        let idx = ((offset >> 4) + extra + i) << 4;
        let hex_line = document.createElement("div"), txt_line = document.createElement("div");
        hex_line.classList.add("hex_line"); txt_line.classList.add("txt_line");
        hex_line.dataset.offset = Utils.pad(idx.toString(16), '0', 8);
        for(let j = idx; j < idx + 0x10; ++j){
          let byte = this.reader.getByte(j);
          let translation = dictionary[byte];
          let hex_cell = document.createElement("div"), txt_cell = document.createElement("div");
          hex_cell.classList.add("middle"); txt_cell.classList.add("middle");
          // There isn't any translation
          if(translation === undefined){
            txt_cell.classList.add("empty");
            translation = "";
          }
          ["mousedown", "mouseup"].forEach(e=>{ hex_cell.addEventListener(e, hex_click); txt_cell.addEventListener(e, hex_click); });
          ["mouseover", "mouseout"].forEach(e=>{ hex_cell.addEventListener(e, hex_select); txt_cell.addEventListener(e, hex_select); });
          hex_cell.innerHTML = byte.toString(16); txt_cell.innerHTML = translation;
          hex_line.append(hex_cell); txt_line.append(txt_cell);
        }
        hex_result[append](hex_line); txt_result[append](txt_line);
      }

      this.current = offset;
    }catch(e){
  	   NotificationHandler.pop("Error", e, NotificationType.ERROR);
    }
	};
};
