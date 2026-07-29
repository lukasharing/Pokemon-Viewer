(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  class GbaItemData{
    static RECORD_SIZE=44;
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=root.gba.assets.profile(reader);
      if(!Number.isInteger(this.profile?.items)||!Number.isInteger(this.profile?.itemCount))throw new Error(`${reader.type||"This GBA ROM"} has no verified item table.`);
      this.dictionary=reader.getDictionary(reader.textDictionary||"text_table_en");
    }
    name(offset){return this.reader.getTextByOffset(this.dictionary,offset,14).replace(/@.*$/,"").trim();}
    list(){return Array.from({length:this.profile.itemCount-1},(_,index)=>{const id=index+1,offset=this.profile.items+id*this.constructor.RECORD_SIZE;return Object.freeze({id,name:this.name(offset)||`Item #${id}`});});}
    get(id){
      if(!Number.isInteger(id)||id<1||id>=this.profile.itemCount)throw new RangeError(`GBA item must be 1–${this.profile.itemCount-1}.`);
      const offset=this.profile.items+id*this.constructor.RECORD_SIZE,item=GbaItem.read(this.memory,offset,(at,length)=>this.reader.getTextByOffset(this.dictionary,at,length).replace(/@.*$/,"").trim());
      return Object.freeze({...item,id,category:this.category(item),icon:this.icon(id)});
    }
    category(item){
      if(/BERRY$/i.test(item.name))return"Berries";
      return ["Items","Key items","Poké Balls","TMs / HMs","Berries"][item.pocket]||"Items";
    }
    icon(id){
      if(!Number.isInteger(this.profile.itemIcons))return null;
      const record=this.profile.itemIcons+id*8,graphic=this.memory.pointer(record),palette=this.memory.pointer(record+4);
      if(!Number.isInteger(graphic)||!Number.isInteger(palette))return null;
      const pixels=root.gba.GbaLz77.decode(this.memory,graphic).bytes,paletteBytes=root.gba.GbaLz77.decode(this.memory,palette).bytes;
      if(pixels.length<288||paletteBytes.length<32)throw new Error(`Item #${id} has invalid native icon data.`);
      const colors=Array.from({length:16},(_,index)=>CoreUtils.bgr555ToRgb(paletteBytes[index*2]|paletteBytes[index*2+1]<<8))
        .map(rgb=>`#${rgb.map(value=>value.toString(16).padStart(2,"0")).join("")}`);
      return Object.freeze({offset:graphic,paletteOffset:palette,bytes:pixels.slice(0,288),count:9,columns:3,width:24,height:24,palette:Object.freeze(colors),editable:false,title:`${this.name(this.profile.items+id*this.constructor.RECORD_SIZE)} · item icon`});
    }
    encode(item,values){
      const result=MemoryUtils.bytes(this.memory,item.offset,this.constructor.RECORD_SIZE),u16=(at,value)=>{result[at]=value&255;result[at+1]=value>>8&255;};
      const price=Number(values.price),importance=Number(values.importance),pocket=Number(values.pocket);
      if(!Number.isInteger(price)||price<0||price>65535)throw new RangeError("Price must be 0–65535.");
      if(!Number.isInteger(importance)||importance<0||importance>2)throw new RangeError("Importance must be 0–2.");
      if(!Number.isInteger(pocket)||pocket<1||pocket>5)throw new RangeError("Pocket must be 1–5.");
      u16(16,price);result[24]=importance;result[26]=pocket;return result;
    }
  }
  root.gba=Object.freeze({...root.gba,GbaItemData});
})(globalThis);
