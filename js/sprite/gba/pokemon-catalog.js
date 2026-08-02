(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  const colors=bytes=>Object.freeze(Array.from({length:16},(_,index)=>{
    const value=bytes[index*2]|bytes[index*2+1]<<8;
    return GbaSpriteCodec.decodeColor(value);
  }));

  class GbaPokemonSpriteCatalog{
    constructor(reader){
      this.reader=reader;
      this.data=reader.gbaSpeciesData||=new PokemonViewer.gba.GbaSpeciesData(reader);
      this.count=this.data.profile.speciesCount;
      // Sprite browsing only needs the selected species' picture records.
      // Building the complete Species ResourceGraph here decoded every front,
      // back and palette asset before the first sprite could appear. Graph
      // owners populate that domain lazily when a reference view requests it.
    }
    available(){return this.count>0;}
    list(){
      return Array.from({length:this.count},(_,index)=>{
        const id=index+1;
        return Object.freeze({id,label:`${String(id).padStart(3,"0")} · ${this.data.name(id)}`});
      });
    }
    picture(id,side){
      const graphic=side==="back"?this.data.back(id):this.data.front(id);
      const palette=this.data.palette(id);
      return Object.freeze({
        offset:graphic.offset,
        bytes:graphic.bytes.slice(0,0x800),
        count:64,
        columns:8,
        editable:false,
        palette:colors(palette.bytes),
        label:side==="back"?"Back":"Front",
        title:`${this.data.name(id)} · ${side} sprite`,
        sourceEncoding:`gMon${side==="back"?"Back":"Front"}PicTable · LZ77 · 64×64 4bpp`
      });
    }
    icon(id){
      try{
        const icon=this.data.icon(id);
        return Object.freeze({
          offset:icon.graphicOffset,
          bytes:icon.bytes,
          count:16,
          columns:4,
          editable:true,
          palette:colors(icon.palette),
          paletteOffset:icon.paletteOffset,
          label:"Menu icon",
          title:`${this.data.name(id)} · native menu icon`,
          sourceEncoding:"gMonIconTable · 32×32 4bpp"
        });
      }catch{return null;}
    }
    source(id){
      if(!Number.isInteger(id)||id<1||id>this.count)throw new RangeError(`GBA Pokémon sprite must be 1–${this.count}.`);
      const name=this.data.name(id),front=this.picture(id,"front"),back=this.picture(id,"back");
      const animated=this.data.front(id),views=[front];
      if(animated.bytes.length>=0x1000)views.push(Object.freeze({
        ...front,offset:animated.offset,bytes:animated.bytes.slice(0x800,0x1000),
        label:"Front · frame 2",title:`${name} · animated front frame 2`,editable:false
      }));
      views.push(back);
      const icon=this.icon(id);
      if(icon)views.push(icon);
      return Object.freeze({
        title:`${name} · Pokémon sprites`,activeView:0,
        views:Object.freeze(views)
      });
    }
  }
  sprites.GbaPokemonSpriteCatalog=GbaPokemonSpriteCatalog;
})(globalThis);
