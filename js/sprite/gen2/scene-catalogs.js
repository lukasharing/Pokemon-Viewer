(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  const CRYSTAL="f4cd194bdee0d04ca4eac29e09b8e4e9d818c133";
  const palette=Object.freeze(["#ffffff","#a8b8d8","#526b9a","#101820"]);
  const banked=(bank,address)=>bank*0x4000+(address-0x4000);
  const raw=(reader,{bank,address,count,columns,title})=>Object.freeze({
    offset:banked(bank,address),count,columns,title,editable:true,palette
  });
  const compressed=(reader,{bank,address,count,columns,title})=>{
    const offset=banked(bank,address),decoded=GscLz.decompress(reader.memory,offset,{maxOutput:0x4000,maxInput:0x4000});
    if(decoded.bytes.length<count*16)throw new Error(`${title} is shorter than its verified native extent.`);
    return Object.freeze({offset,bytes:decoded.bytes.slice(0,count*16),count,columns,title,editable:false,palette,compressed:true});
  };

  class Gen2SceneCatalogs{
    constructor(reader){this.reader=reader;}
    create(){
      if(this.reader.capabilities?.fingerprint!==CRYSTAL)return Object.freeze({});
      const reader=this.reader;
      return Object.freeze({
        intro:new sprites.SpriteResourceCatalog([
          {id:0,label:"Suicune run",source:()=>compressed(reader,{bank:0x39,address:0x555d,count:192,columns:16,title:"Suicune run · Crystal intro"})},
          {id:1,label:"Pichu and Wooper",source:()=>compressed(reader,{bank:0x39,address:0x592d,count:128,columns:16,title:"Pichu and Wooper · Crystal intro"})},
          {id:2,label:"Intro background",source:()=>compressed(reader,{bank:0x39,address:0x5c7d,count:128,columns:16,title:"Background · Crystal intro"})},
          {id:3,label:"Unown sequence",source:()=>compressed(reader,{bank:0x39,address:0x5f5d,count:128,columns:16,title:"Unown sequence · Crystal intro"})},
          {id:4,label:"Intro pulse",source:()=>compressed(reader,{bank:0x39,address:0x634d,count:16,columns:4,title:"Pulse · Crystal intro"})}
        ]),
        title:new sprites.SpriteResourceCatalog([
          {id:0,label:"Suicune title picture",source:()=>compressed(reader,{bank:0x43,address:0x6f46,count:256,columns:16,title:"Suicune · Crystal title screen"})},
          {id:1,label:"Pokémon Crystal logo",source:()=>compressed(reader,{bank:0x43,address:0x7326,count:160,columns:20,title:"Pokémon Crystal logo · title screen"})},
          {id:2,label:"Crystal title ornament",source:()=>compressed(reader,{bank:0x43,address:0x7cee,count:60,columns:6,title:"Crystal ornament · title screen"})}
        ]),
        bag:new sprites.SpriteResourceCatalog([
          {id:0,label:"Male pack",source:()=>raw(reader,{bank:0x04,address:0x5016,count:60,columns:5,title:"Male pack · four pocket states"})},
          {id:1,label:"Female pack",source:()=>raw(reader,{bank:0x12,address:0x4e9b,count:60,columns:5,title:"Female pack · four pocket states"})},
          {id:2,label:"Pack menu tiles",source:()=>raw(reader,{bank:0x04,address:0x4b16,count:80,columns:10,title:"Pack menu interface tiles"})}
        ]),
        badges:new sprites.SpriteResourceCatalog([
          {id:0,label:"Johto badges",source:()=>raw(reader,{bank:0x09,address:0x6043,count:44,columns:2,title:"Johto badges · Trainer Card"})}
        ])
      });
    }
  }
  sprites.Gen2SceneCatalogs=Gen2SceneCatalogs;
})(globalThis);
