(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const sprites=(root.sprites||={});

  const palette=(reader,offset,count=16)=>Object.freeze(Array.from({length:count},(_,index)=>
    GbaSpriteCodec.decodeColor(reader.memory.u16(offset+index*2))
  ));
  const compressedPalette=(reader,offset)=>palette({
    memory:new RomMemory(root.gba.GbaLz77.decode(reader.memory,offset,{maxOutput:0x400}).bytes)
  },0);
  const compressed=(reader,{offset,columns,title,palette:colors,paletteOffset=null})=>{
    const decoded=root.gba.GbaLz77.decode(reader.memory,offset);
    if(decoded.bytes.length%GbaSpriteCodec.bytesPerTile)throw new Error(`${title} does not end on a native 4bpp tile boundary.`);
    return Object.freeze({
      offset,bytes:decoded.bytes,count:decoded.bytes.length/GbaSpriteCodec.bytesPerTile,columns,
      title,editable:false,compressed:true,palette:colors,paletteOffset
    });
  };

  class GbaSceneCatalogs{
    constructor(reader){this.reader=reader;}
    create(){
      const reader=this.reader,profile=reader.memoryProfile,schema=profile?.structure("GbaSceneCatalogs");
      if(!profile||!schema)return Object.freeze({});
      const result={};
      for(const [group,definitions] of Object.entries(schema.groups)){
        const required=new Set(definitions.flatMap(definition=>[definition.gfx,definition.palette]));
        if([...required].some(name=>profile.offset(name)==null))continue;
        result[group]=new sprites.SpriteResourceCatalog(definitions.map(definition=>({
          id:definition.id,label:definition.label,
          source:()=>{
            const offset=profile.require(definition.gfx).offset;
            const paletteOffset=profile.require(definition.palette).offset+(definition.paletteDisplacement||0);
            const colors=schema.paletteEncoding[definition.palette]==="lz"
              ?compressedPalette(reader,paletteOffset)
              :palette(reader,paletteOffset);
            return compressed(reader,{
              offset,columns:definition.columns,title:definition.title,
              palette:colors,paletteOffset
            });
          }
        })));
      }
      return Object.freeze(result);
    }
  }

  sprites.GbaSceneCatalogs=GbaSceneCatalogs;
})(globalThis);
