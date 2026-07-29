(function(global){
  "use strict";

  class HexEditor{
    constructor(reader){
      this.reader=reader;this.current=0;this.anchor=0;this.head=0;this.area="hex";this.pendingNibble=null;this.translationVisible=true;this.mirrored=false;
      this.scope=new EventScope();
      this.hexBuffer=Array.from({length:256},(_,byte)=>byte.toString(16).toUpperCase().padStart(2,"0"));
      const searchField=Dom.byId("memory_search");
      this.elements={root:Dom.byId("hex_editor"),content:Dom.byId("hex_content"),hex:Dom.byId("hex_result"),text:Dom.byId("txt_result"),textArea:Dom.byId("txt_area"),toggleText:Dom.byId("hex_toggle_text"),toggleMirror:Dom.byId("hex_toggle_mirror"),status:Dom.byId("hex_status"),search:searchField?.querySelector("input"),searchButton:searchField?.querySelector("button")};
      this.commands=reader.history?.("hex_editor",{label:"Hex Editor",onChange:()=>this.updateStatus()})||new CommandStack({onChange:()=>this.updateStatus()});
      this.bind();this.go(0);
    }
    bind(){
      const select=event=>{const cell=event.target.closest("[data-byte-offset]");if(!cell)return;event.preventDefault();this.area=cell.dataset.area;const offset=Number(cell.dataset.byteOffset);if(event.shiftKey)this.head=offset;else this.anchor=this.head=offset;this.pendingNibble=null;this.renderSelection();};
      const options=this.scope.options;this.elements.hex.addEventListener("pointerdown",select,options);this.elements.text.addEventListener("pointerdown",select,options);
      this.elements.toggleText.addEventListener("click",()=>this.toggleTranslation(),options);
      this.elements.toggleMirror.addEventListener("click",()=>this.toggleMirror(),options);
      this.elements.search?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();this.search(event.currentTarget.value);}},options);
      this.elements.searchButton?.addEventListener("click",()=>this.search(this.elements.search.value),options);
      document.addEventListener("paste",event=>{if(this.elements.root.classList.contains("hide")||event.target?.matches?.("input,textarea,[contenteditable='true']"))return;const source=event.clipboardData?.getData("text/plain");if(source!==undefined){event.preventDefault();this.paste(source);}},options);
    }
    parseOffset(source){return CoreUtils.parseOffset(source,this.reader.size);}
    search(source){
      try{
        const query=String(source??"").trim();
        if(!query)throw new Error("Enter a ROM offset or text to find.");
        if(/^(?:[+-]?(?:0x|\$)[0-9a-f]+|[+-]?[0-9]+)$/i.test(query)){
          const offset=this.parseOffset(query);this.anchor=this.head=offset;this.area="hex";this.go(offset);return offset;
        }
        const bytes=this.encodeText(query),offset=MemoryUtils.find(this.reader.memory,bytes,{start:Math.min(this.reader.size,this.head+1),wrap:true});
        if(offset===null)throw new Error(`'${query}' was not found in the active game text table.`);
        this.anchor=offset;this.head=offset+bytes.length-1;this.area="text";this.pendingNibble=null;this.go(offset);
        this.elements.status.textContent=`Found ${bytes.length} ${bytes.length===1?"byte":"bytes"} at ${MemoryUtils.hex(offset,6)} · search again for the next match`;
        return offset;
      }catch(error){
        NotificationHandler.pop("Hex search",error.message||String(error),NotificationType.ERROR);return null;
      }
    }
    isTranslationVisible(){return this.translationVisible;}
    isMirrored(){return this.mirrored;}
    toggleTranslation(force=!this.translationVisible){
      this.translationVisible=Boolean(force);this.elements.textArea.classList.toggle("hide",!this.translationVisible);
      if(!this.translationVisible&&this.area==="text")this.area="hex";
      this.updateViewControls();this.renderSelection();return this.translationVisible;
    }
    toggleMirror(force=!this.mirrored){
      this.mirrored=Boolean(force);this.elements.content.classList.toggle("is-mirrored",this.mirrored);this.updateViewControls();return this.mirrored;
    }
    updateViewControls(){
      this.elements.toggleText.classList.toggle("selected",this.translationVisible);this.elements.toggleText.setAttribute("aria-pressed",String(this.translationVisible));this.elements.toggleText.textContent=this.translationVisible?"Hide translation":"Show translation";
      this.elements.toggleMirror.classList.toggle("selected",this.mirrored);this.elements.toggleMirror.setAttribute("aria-pressed",String(this.mirrored));
      this.elements.root.dispatchEvent(new CustomEvent("hexviewchange",{bubbles:true,detail:{translation:this.translationVisible,mirrored:this.mirrored}}));
    }
    pageSize(){const height=this.elements.text.offsetHeight||480;return Math.max(16,Math.floor(height/30)<<4);}
    go(offset=0,{select=false}={}){
      try{
        const size=this.pageSize(),lastPage=Math.max(0,this.reader.size-size);offset=Math.min(Math.max(0,offset&~0xf),lastPage&~0xf);
        const dictionary=this.dictionary(),hexLines=[],textLines=[];
        for(let row=0;row<size/16;row++){
          const start=offset+row*16,hexLine=Dom.create("div",{className:"hex_line",dataset:{offset:start.toString(16).toUpperCase().padStart(8,"0")}}),textLine=Dom.create("div",{className:"txt_line"});
          for(let column=0;column<16&&start+column<this.reader.size;column++){
            const absolute=start+column,byte=this.reader.getByte(absolute),translation=dictionary[byte]??"";
            const dataset={byteOffset:String(absolute)};
            hexLine.append(Dom.create("button",{className:"middle",text:this.hexBuffer[byte],attributes:{type:"button","aria-label":`Byte 0x${absolute.toString(16).toUpperCase()}: ${this.hexBuffer[byte]}`},dataset:{...dataset,area:"hex"}}));
            textLine.append(Dom.create("button",{className:`middle${translation?"":" empty"}`,text:translation||"·",attributes:{type:"button",title:translation||"Unmapped byte","aria-label":`Text byte 0x${absolute.toString(16).toUpperCase()}: ${translation||"unmapped"}`},dataset:{...dataset,area:"text"}}));
          }
          hexLines.push(hexLine);textLines.push(textLine);
        }
        this.elements.hex.replaceChildren(Dom.fragment(hexLines));this.elements.text.replaceChildren(Dom.fragment(textLines));this.current=offset;
        if(select){this.anchor=this.head=Math.min(Math.max(offset,this.head),offset+size-1);}
        this.renderSelection();this.updateStatus();
      }catch(error){NotificationHandler.pop("Hex editor",error.message||String(error),NotificationType.ERROR);}
      return this;
    }
    dictionary(){return this.reader.textDictionary?this.reader.getDictionary(this.reader.textDictionary)||[]:[];}
    selection(){return{start:Math.min(this.anchor,this.head),end:Math.max(this.anchor,this.head)};}
    renderSelection(){
      this.elements.root.querySelectorAll("[data-byte-offset]").forEach(cell=>{const offset=Number(cell.dataset.byteOffset),selected=offset>=this.selection().start&&offset<=this.selection().end;cell.classList.toggle("selected",selected);cell.classList.toggle("onwrite",offset===this.head&&cell.dataset.area===this.area);});
    }
    updateCell(offset){
      const byte=this.reader.getByte(offset),translation=this.dictionary()[byte]??"";
      this.elements.hex.querySelector(`[data-byte-offset='${offset}']`)?.replaceChildren(this.hexBuffer[byte]);
      const text=this.elements.text.querySelector(`[data-byte-offset='${offset}']`);if(text){text.textContent=translation||"·";text.classList.toggle("empty",!translation);}
    }
    writeByte(offset,value,label="Edit byte"){
      value=Number(value);if(!this.reader.isROMOffset(offset)||!Number.isInteger(value)||value<0||value>255)throw new RangeError("Byte values must be between 00 and FF.");
      const previous=this.reader.getByte(offset);if(previous===value)return false;
      const apply=(expected,byte)=>{MemoryUtils.replace(this.reader.memory,offset,Uint8Array.of(expected),Uint8Array.of(byte));this.updateCell(offset);this.updateStatus();};
      this.commands.execute({label:`${label} 0x${offset.toString(16).toUpperCase()}`,description:`${this.hexBuffer[previous]} → ${this.hexBuffer[value]}`,do:()=>apply(previous,value),undo:()=>apply(value,previous)});return true;
    }
    writeText(character){
      const dictionary=this.dictionary(),value=dictionary.indexOf(character);
      if(value<0){NotificationHandler.pop("Text edit",`'${character}' is not available in this game's active text table.`,NotificationType.ERROR);return false;}
      return this.writeByte(this.head,value,"Edit text");
    }
    encodeText(source){
      return new TextTableCodec(this.dictionary()).encode(source);
    }
    decodeHexPaste(source){
      const compact=String(source).replace(/0x/gi,"").replace(/[\s,;:_-]+/g,"");
      if(!compact||compact.length%2||!/^[0-9a-f]+$/i.test(compact))throw new SyntaxError("Paste hexadecimal as complete byte pairs, for example: A9 00 FF.");
      return Uint8Array.from(compact.match(/../g),value=>parseInt(value,16));
    }
    writeSequence(offset,bytes,label){
      if(!(bytes instanceof Uint8Array)||!bytes.length)return false;
      this.reader.memory.assertRange(offset,bytes.length);const previous=MemoryUtils.bytes(this.reader.memory,offset,bytes.length),end=offset+bytes.length-1;
      if(MemoryUtils.equals(this.reader.memory,offset,bytes))return false;
      const apply=(expected,value)=>{MemoryUtils.replace(this.reader.memory,offset,expected,value);for(let current=offset;current<=end;current++)this.updateCell(current);this.anchor=offset;this.head=end;this.pendingNibble=null;if(end<this.current||offset>=this.current+this.pageSize())this.go(offset);else{this.renderSelection();this.updateStatus();}};
      this.commands.execute({label,description:`${bytes.length} ${bytes.length===1?"byte":"bytes"} at 0x${offset.toString(16).toUpperCase()}`,do:()=>apply(previous,bytes),undo:()=>apply(bytes,previous)});return true;
    }
    paste(source){
      try{
        const bytes=this.area==="text"?this.encodeText(String(source)):this.decodeHexPaste(source);
        return this.writeSequence(this.head,bytes,this.area==="text"?"Paste text":"Paste bytes");
      }catch(error){NotificationHandler.pop("Paste",error.message||String(error),NotificationType.ERROR);return false;}
    }
    async pasteClipboard(){try{return this.paste(await navigator.clipboard.readText());}catch(error){NotificationHandler.pop("Paste","Clipboard access was not available. Use Cmd/Ctrl+V while Hex Editor is focused.",NotificationType.ERROR);return false;}}
    move(delta,extend=false){
      const next=Math.min(this.reader.size-1,Math.max(0,this.head+delta));if(!extend)this.anchor=next;this.head=next;this.pendingNibble=null;
      if(next<this.current||next>=this.current+this.pageSize())this.go(next);else this.renderSelection();this.updateStatus();
    }
    copy(){
      const {start,end}=this.selection(),bytes=this.reader.ReadOnlyMemory.slice(start,end+1);
      const value=this.area==="text"?Array.from(bytes,byte=>this.dictionary()[byte]??"").join(""):Array.from(bytes,byte=>this.hexBuffer[byte]).join(" ");
      navigator.clipboard?.writeText(value);return value;
    }
    handleKey(event){
      if(this.elements.root.classList.contains("hide"))return false;
      const command=KeyboardUtils.command(event);
      if(command){event.preventDefault();this.commands[command]();return true;}
      if(KeyboardUtils.isEditableTarget(event.target))return false;
      const modifier=KeyboardUtils.hasPrimaryModifier(event),key=event.key.toLowerCase();
      if(modifier&&key==="c"){event.preventDefault();this.copy();return true;}
      if(event.altKey||modifier)return false;
      const movement={ArrowLeft:-1,ArrowRight:1,ArrowUp:-16,ArrowDown:16,PageUp:-this.pageSize(),PageDown:this.pageSize()};
      if(movement[event.key]){event.preventDefault();this.move(movement[event.key],event.shiftKey);return true;}
      if(event.key==="Backspace"||event.key==="Delete"){event.preventDefault();this.writeByte(this.head,0,"Clear byte");this.move(event.key==="Backspace"?-1:1);return true;}
      if(event.key.length!==1)return false;
      if(this.area==="text"){event.preventDefault();if(this.writeText(event.key))this.move(1);return true;}
      if(!/^[0-9a-f]$/i.test(event.key))return false;
      event.preventDefault();const nibble=parseInt(event.key,16);
      if(this.pendingNibble===null){this.pendingNibble=nibble;this.updateStatus();return true;}
      const value=this.pendingNibble<<4|nibble;this.pendingNibble=null;if(this.writeByte(this.head,value))this.move(1);return true;
    }
    updateStatus(){
      const {start,end}=this.selection(),count=end-start+1,pending=this.pendingNibble===null?"":` · high nibble ${this.pendingNibble.toString(16).toUpperCase()}_`;
      this.elements.status.textContent=`0x${this.head.toString(16).toUpperCase().padStart(6,"0")} · ${count} ${count===1?"byte":"bytes"} selected · ${this.commands.done.length} edits${pending}`;
    }
    undo(){return EditUtils.history(this.commands,"undo",{title:"Hex history"});}
    redo(){return EditUtils.history(this.commands,"redo",{title:"Hex history"});}
    refresh(){return this.go(this.current);}
    destroy(){this.commands.destroy?.();this.scope.destroy();}
  }

  global.hex_wheel=event=>{event.preventDefault();global.RomEditor?.hex_editor?.move(Math.sign(event.deltaY)*16);};
  global.hex_keydown=event=>global.RomEditor?.hex_editor?.handleKey(event);
  global.EHex=HexEditor;
  ((global.PokemonViewer ||= {}).hex ||= {}).Editor=HexEditor;
})(globalThis);
