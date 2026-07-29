(function(global){
  "use strict";
  const sprites=((global.PokemonViewer||={}).sprites||={});
  const GREEN=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);
  const exactProfiles=Object.freeze({
    "ea9bcae617fdf159b045185467ae58b2e4a48b9a":"red",
    "d7037c83e1ae5b39bde3c30787637ba1d4c48ce2":"blue"
  });
  const banked=(bank,address)=>bank===0?address:bank*0x4000+(address-0x4000);
  const raw=(reader,{bank,address,count,columns,title})=>Object.freeze({
    offset:banked(bank,address),count,columns,title,editable:true,palette:GREEN
  });

  const animation=(reader,variant)=>{
    const frontName=variant==="blue"?"Jigglypuff":"Nidorino";
    const base=variant==="blue"?0x6099:0x6099;
    return Object.freeze({
      title:`${frontName} intro animation`,
      views:Object.freeze([
        raw(reader,{bank:0x10,address:base,count:36,columns:6,title:`${frontName} · intro frame 1`}),
        raw(reader,{bank:0x10,address:base+0x240,count:36,columns:6,title:`${frontName} · intro frame 2`}),
        raw(reader,{bank:0x10,address:base+0x480,count:36,columns:6,title:`${frontName} · intro frame 3`})
      ])
    });
  };

  class Gen1SceneCatalogs{
    constructor(reader){
      this.reader=reader;
      this.variant=exactProfiles[reader.capabilities?.fingerprint];
    }
    create(){
      if(!this.variant)return Object.freeze({});
      const reader=this.reader;
      return Object.freeze({
        intro:new sprites.SpriteResourceCatalog([
          {id:0,label:"Gengar intro tiles",source:()=>raw(reader,{bank:0x10,address:0x5a99,count:95,columns:19,title:"Gengar · intro tile sheet"})},
          {id:1,label:`${this.variant==="blue"?"Jigglypuff":"Nidorino"} intro animation`,source:()=>animation(reader,this.variant)}
        ]),
        title:new sprites.SpriteResourceCatalog([
          {id:0,label:"Pokémon logo",source:()=>raw(reader,{bank:0x04,address:0x5380,count:112,columns:16,title:"Pokémon logo · title screen"})},
          {id:1,label:"Player title picture",source:()=>raw(reader,{bank:0x04,address:0x66a8,count:35,columns:5,title:"Player · title screen"})},
          {id:2,label:"Game Freak title graphic",source:()=>raw(reader,{bank:0x04,address:0x61f8,count:9,columns:9,title:"Game Freak · title graphic"})}
        ]),
        badges:new sprites.SpriteResourceCatalog([
          {id:0,label:"Kanto badges",source:()=>raw(reader,{bank:0x03,address:0x6a9e,count:64,columns:2,title:"Kanto badges · Trainer Card"})}
        ])
      });
    }
  }
  sprites.Gen1SceneCatalogs=Gen1SceneCatalogs;
})(globalThis);
