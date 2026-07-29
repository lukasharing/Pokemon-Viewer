(function(global){
  "use strict";
  class ItemEditor{
    constructor(reader,driverId){
      this.reader=reader;this.root=Dom.byId("item_editor");this.scope=new EventScope();this.commands=reader.history("item_editor",{label:"Item Editor"});
      this.driver=PokemonViewer.items.registry.create(driverId,{reader});
      this.elements={filter:Dom.byId("item_filter"),group:Dom.byId("item_group"),list:Dom.byId("item_list"),title:Dom.byId("item_title"),name:Dom.byId("item_name"),
        icon:Dom.byId("item_icon"),note:Dom.byId("item_graphic_note"),properties:Dom.byId("item_properties"),edit:Dom.byId("item_edit"),sprite:Dom.byId("item_sprite"),data:Dom.byId("item_data"),status:Dom.byId("item_status")};
      this.entries=this.driver.list();this.groups=[...new Set(this.entries.map(entry=>this.driver.category(entry)))].sort();
      this.elements.group.append(...this.groups.map(group=>Dom.create("option",{text:group,attributes:{value:group}})));
      this.scope.listen(this.elements.filter,"input",()=>this.renderList());this.scope.listen(this.elements.group,"change",()=>this.renderList());
      this.scope.listen(this.elements.list,"change",()=>this.open(Number(this.elements.list.value)));
      this.scope.listen(this.elements.edit,"click",()=>this.edit());this.scope.listen(this.elements.sprite,"click",()=>EditorLinks.optional(this.current&&this.driver.spriteLink?.(this.current)));
      this.scope.listen(this.elements.data,"click",()=>this.current&&EditorLinks.hex(this.current.offset,{reference:`item:${this.current.id}`}));
      this.renderList();if(this.entries.length)this.open(this.entries[0].id);
    }
    renderList(){
      const query=this.elements.filter.value.trim().toLowerCase(),group=this.elements.group.value,selected=this.current?.id;
      const visible=this.entries.filter(entry=>{
        if(query&&!entry.name.toLowerCase().includes(query)&&String(entry.id)!==query)return false;
        return !group||this.driver.category(entry)===group;
      });
      this.elements.list.replaceChildren(...visible.map(entry=>Dom.create("option",{text:`${String(entry.id).padStart(3,"0")} · ${entry.name}`,attributes:{value:entry.id}})));
      if(selected&&visible.some(entry=>entry.id===selected))this.elements.list.value=String(selected);
    }
    open(id){
      const item=this.driver.read(id);this.current=item;this.elements.list.value=String(id);this.elements.title.textContent=item.category;this.elements.name.textContent=item.name;
      this.renderIcon(this.driver.icon(item));this.elements.note.textContent=item.iconShared?"Shared field-object graphic used by Gen I items.":"Native 24×24 bag icon from this ROM.";
      this.elements.properties.replaceChildren(...this.driver.properties(item).flatMap(([key,value])=>[Dom.create("dt",{},UiWindow.key(key)),Dom.create("dd",{text:String(value)})]));
      this.elements.sprite.disabled=!this.driver.spriteLink?.(item);this.elements.status.textContent=`${item.name} · Item ${item.id} · ${item.category}`;return true;
    }
    renderIcon(source){
      const canvas=this.elements.icon,ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
      if(!source){canvas.width=canvas.height=24;ctx.clearRect(0,0,24,24);return;}
      const gba=this.reader.memory instanceof GbaMemory,width=source.width||source.columns*8,height=source.height||Math.ceil(source.count/source.columns)*8,bytes=source.bytes||this.reader.memory.slice(source.offset,source.count*(gba?32:16));
      const codec=this.reader.memory instanceof GbaMemory?GbaSpriteCodec:GbcSpriteCodec,pixels=codec.decodeImage?codec.decodeImage(bytes,{width,height}):this.decodeGbc(bytes,width,height,codec);
      canvas.width=width;canvas.height=height;const image=ctx.createImageData(width,height),palette=source.palette||["#e0f8cf","#86c06c","#306850","#071821"];
      for(let index=0;index<pixels.length;index++){const value=Number.parseInt((palette[pixels[index]]||"#000000").slice(1),16),at=index*4;image.data.set([value>>16&255,value>>8&255,value&255,pixels[index]===0&&palette.length>4?0:255],at);}
      ctx.putImageData(image,0,0);
    }
    decodeGbc(bytes,width,height,codec){
      const memory={assertRange(){},u8(offset){return bytes[offset];}},pixels=new Uint8Array(width*height),columns=width/8;
      for(let tile=0;tile<bytes.length/16;tile++){const decoded=codec.decodeTile(memory,tile*16),tx=tile%columns*8,ty=Math.floor(tile/columns)*8;for(let y=0;y<8;y++)for(let x=0;x<8;x++)pixels[(ty+y)*width+tx+x]=decoded[y*8+x];}
      return pixels;
    }
    async edit(){
      if(!this.current)return;const values=await AppDialog.form({title:`Edit ${this.current.name}`,message:"Only verified fixed-size fields are writable.",fields:this.driver.editFields(this.current),submitLabel:"Apply item"});
      if(values&&this.driver.edit(this.current,values,this.commands)!==false)this.open(this.current.id);
    }
    activate(){this.root.editorHeader?.render();}
    undo(){const changed=EditUtils.history(this.commands,"undo",{title:"Item history"});if(changed&&this.current)this.open(this.current.id);return changed;}
    redo(){const changed=EditUtils.history(this.commands,"redo",{title:"Item history"});if(changed&&this.current)this.open(this.current.id);return changed;}
    destroy(){this.commands.destroy();this.scope.destroy();}
  }
  global.ItemEditor=ItemEditor;
})(globalThis);
