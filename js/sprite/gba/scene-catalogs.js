(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const sprites=(root.sprites||={});
  const EMERALD="f3ae088181bf583e55daf962a92bb46f4f1d07b7";

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
      const reader=this.reader;
      if((reader.capabilities?.fingerprint||reader.fingerprint)!==EMERALD)return Object.freeze({});

      const playerPalette=palette(reader,0xd85cb0);
      const introBgPalette=palette(reader,0xd85cd0);
      const titlePaletteOffset=0xdde418;
      const titlePalette=palette(reader,titlePaletteOffset);
      const bagPalette=compressedPalette(reader,0xd9a560);
      const badgePaletteOffset=0x56f4ec;
      const badgePalette=palette(reader,badgePaletteOffset);

      return Object.freeze({
        intro:new sprites.SpriteResourceCatalog([
          {id:0,label:"Volbeat",source:()=>compressed(reader,{offset:0xd85f50,columns:4,title:"Volbeat · Emerald introduction",palette:palette(reader,0xd85ed0),paletteOffset:0xd85ed0})},
          {id:1,label:"Torchic animation strip",source:()=>compressed(reader,{offset:0xd86130,columns:4,title:"Torchic · Emerald introduction frames",palette:palette(reader,0xd85ef0),paletteOffset:0xd85ef0})},
          {id:2,label:"Manectric animation strip",source:()=>compressed(reader,{offset:0xd86550,columns:8,title:"Manectric · Emerald introduction frames",palette:palette(reader,0xd85f10),paletteOffset:0xd85f10})},
          {id:3,label:"Flygon animation strip",source:()=>compressed(reader,{offset:0xd8702c,columns:8,title:"Flygon · Emerald introduction frames",palette:palette(reader,0xd85f30),paletteOffset:0xd85f30})},
          {id:4,label:"Brendan animation strip",source:()=>compressed(reader,{offset:0xd87568,columns:8,title:"Brendan · Emerald introduction frames",palette:playerPalette,paletteOffset:0xd85cb0})},
          {id:5,label:"May animation strip",source:()=>compressed(reader,{offset:0xd87ca4,columns:8,title:"May · Emerald introduction frames",palette:playerPalette,paletteOffset:0xd85cb0})},
          {id:6,label:"Rayquaza scene",source:()=>compressed(reader,{offset:0xd8ba74,columns:16,title:"Rayquaza · Emerald introduction",palette:introBgPalette,paletteOffset:0xd85cd0})},
          {id:7,label:"Rayquaza clouds",source:()=>compressed(reader,{offset:0xd8c838,columns:16,title:"Rayquaza clouds · Emerald introduction",palette:introBgPalette,paletteOffset:0xd85cd0})},
          {id:8,label:"Lightning animation strip",source:()=>compressed(reader,{offset:0xd8b80c,columns:4,title:"Lightning · Emerald introduction frames",palette:palette(reader,0xd8ba54),paletteOffset:0xd8ba54})},
          {id:9,label:"Bubble animation strip",source:()=>compressed(reader,{offset:0xd8cf44,columns:2,title:"Bubbles · Emerald introduction frames",palette:palette(reader,0xd8d110),paletteOffset:0xd8d110})}
        ]),
        title:new sprites.SpriteResourceCatalog([
          {id:0,label:"Rayquaza title picture",source:()=>compressed(reader,{offset:0x53f058,columns:16,title:"Rayquaza · Emerald title screen",palette:titlePalette,paletteOffset:titlePaletteOffset})},
          {id:1,label:"Title logo shine",source:()=>compressed(reader,{offset:0x53fb3c,columns:8,title:"Logo shine · Emerald title screen",palette:titlePalette,paletteOffset:titlePaletteOffset})},
          {id:2,label:"Title clouds",source:()=>compressed(reader,{offset:0x53fc8c,columns:16,title:"Clouds · Emerald title screen",palette:titlePalette,paletteOffset:titlePaletteOffset})},
          {id:3,label:"Press Start animation strip",source:()=>compressed(reader,{offset:0xde03e8,columns:20,title:"Press Start · Emerald title screen frames",palette:palette(reader,0xde03c8),paletteOffset:0xde03c8})}
        ]),
        bag:new sprites.SpriteResourceCatalog([
          {id:0,label:"Brendan bag states",source:()=>compressed(reader,{offset:0xd98e84,columns:8,title:"Brendan bag · pocket animation states",palette:bagPalette})},
          {id:1,label:"May bag states",source:()=>compressed(reader,{offset:0xd99a00,columns:8,title:"May bag · pocket animation states",palette:bagPalette})},
          {id:2,label:"Bag menu interface tiles",source:()=>compressed(reader,{offset:0xd9a620,columns:16,title:"Bag menu · native interface tiles",palette:compressedPalette(reader,0xd9a588)})}
        ]),
        badges:new sprites.SpriteResourceCatalog([
          {id:0,label:"Hoenn badges",source:()=>compressed(reader,{offset:0x56f5cc,columns:16,title:"Hoenn badges · Trainer Card",palette:badgePalette,paletteOffset:badgePaletteOffset})}
        ])
      });
    }
  }

  sprites.GbaSceneCatalogs=GbaSceneCatalogs;
})(globalThis);
