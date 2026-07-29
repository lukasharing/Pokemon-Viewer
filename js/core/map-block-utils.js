(function(global){
  "use strict";

  class MapBlockUtils{
    static GBA_INDEX_MASK=0x03ff;
    static GBA_ELEVATION_MASK=0x3f;

    static gbaIndex(value){
      return this.word(value)&this.GBA_INDEX_MASK;
    }

    static gbaElevation(value){
      return this.word(value)>>>10&this.GBA_ELEVATION_MASK;
    }

    static gbaPack(index,elevation){
      this.integer(index,0,this.GBA_INDEX_MASK,"GBA block index");
      this.integer(elevation,0,this.GBA_ELEVATION_MASK,"GBA block elevation");
      return index|elevation<<10;
    }

    static gbaWithIndex(value,index){
      return this.gbaPack(index,this.gbaElevation(value));
    }

    static gbaWithElevation(value,elevation){
      return this.gbaPack(this.gbaIndex(value),elevation);
    }

    static offset(base,width,x,y,stride=1){
      for(const [name,value,min] of [["base",base,0],["width",width,1],["x",x,0],["y",y,0],["stride",stride,1]])this.integer(value,min,Number.MAX_SAFE_INTEGER,name);
      if(x>=width)throw new RangeError("Block X is outside the map width.");
      return base+(y*width+x)*stride;
    }

    static gen2CollisionOffset(base,block){
      this.integer(base,0,Number.MAX_SAFE_INTEGER,"Gen II collision table");
      this.integer(block,0,0x7f,"Gen II metatile");
      return base+block*4;
    }

    static gen2Collision(values){
      if(!Array.isArray(values)&&!(values instanceof Uint8Array))throw new TypeError("Gen II collision requires four byte values.");
      if(values.length!==4)throw new RangeError("Gen II collision requires exactly four values.");
      return Uint8Array.from(values,value=>this.integer(value,0,0xff,"Gen II collision value"));
    }

    static integer(value,min,max,label){
      if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
      return value;
    }

    static word(value){
      return this.integer(value,0,0xffff,"Packed GBA block");
    }
  }

  global.MapBlockUtils=MapBlockUtils;
  ((global.PokemonViewer ||= {}).core ||= {}).MapBlockUtils=MapBlockUtils;
})(globalThis);
