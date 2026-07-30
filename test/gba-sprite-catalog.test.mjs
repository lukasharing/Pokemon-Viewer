import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const load=async(relative,extras={})=>{
  const context=vm.createContext({
    globalThis:null,Map,Set,Object,Array,Number,String,Uint8Array,ArrayBuffer,
    ...extras
  });
  context.globalThis=context;
  vm.runInContext(await readFile(new URL(relative,import.meta.url),"utf8"),context);
  return context;
};

test("GBA Pokémon Sprite catalog owns graphics without Battle renderer",async()=>{
  class SpeciesData{
    constructor(){
      this.profile={speciesCount:2};
      this.catalog={};
    }
    name(id){return["","BULBASAUR","IVYSAUR"][id];}
    front(id){return{offset:0x1000+id*0x1000,bytes:new Uint8Array(0x1000).fill(id),consumed:0x40,recordOffset:0x100+id*8};}
    back(id){return{offset:0x4000+id*0x800,bytes:new Uint8Array(0x800).fill(id+2),consumed:0x40,recordOffset:0x200+id*8};}
    palette(id){return{offset:0x7000+id*0x20,bytes:new Uint8Array(32).fill(id),consumed:0x20,recordOffset:0x300+id*8};}
    icon(id){return{graphicOffset:0x8000+id*0x200,bytes:new Uint8Array(0x200).fill(id),paletteOffset:0x9000,palette:new Uint8Array(32)};}
    resourceGraph(){return{has:id=>id==="gba:species:1"};}
  }
  const context=await load("../js/sprite/gba/pokemon-catalog.js",{
    PokemonViewer:{gba:{GbaSpeciesData:SpeciesData},sprites:{}},
    GbaSpriteCodec:{decodeColor:value=>`#${value.toString(16).padStart(6,"0")}`}
  });
  const reader={resourceGraph:null};
  const catalog=new context.PokemonViewer.sprites.GbaPokemonSpriteCatalog(reader);
  assert.equal("battle" in context.PokemonViewer,false);
  assert.deepEqual(Array.from(catalog.list(),entry=>entry.label),["001 · BULBASAUR","002 · IVYSAUR"]);

  const source=catalog.source(1),labels=Array.from(source.views,view=>view.label);
  assert.deepEqual(labels,["Front","Front · frame 2","Back","Menu icon"]);
  assert.equal(source.views[0].sourceEncoding,"gMonFrontPicTable · LZ77 · 64×64 4bpp");
  assert.equal(source.views[2].sourceEncoding,"gMonBackPicTable · LZ77 · 64×64 4bpp");
  assert.equal(source.views[3].editable,true);
  assert.equal(source.views[3].paletteOffset,0x9000);
});

test("GBA Species graph owns native front, back and palette resources",async()=>{
  const context=await load("../js/core/resource-graph.js",{PokemonViewer:{}});
  vm.runInContext(await readFile(new URL("../js/core/gba-species.js",import.meta.url),"utf8"),context);
  const Type=context.PokemonViewer.gba.GbaSpeciesData,data=Object.create(Type.prototype);
  Object.assign(data,{
    reader:{capabilities:{provenance:{repository:"pret/pokeemerald"}}},
    profile:{speciesCount:2,monsterNames:0x100,monsterBackPics:0x400},
    catalog:{get:id=>({id,name:`Species ${id}`})},
    _resourceGraph:null,
    name:id=>`Species ${id}`,
    nationalDex:()=>null,
    front:id=>({recordOffset:0x200+id*8,offset:0x1000+id*0x100,consumed:0x40,bytes:new Uint8Array(0x800)}),
    back:id=>({recordOffset:0x400+id*8,offset:0x2000+id*0x100,consumed:0x50,bytes:new Uint8Array(0x800)}),
    palette:id=>({recordOffset:0x600+id*8,offset:0x3000+id*0x40,consumed:0x20,bytes:new Uint8Array(32)})
  });
  const graph=data.resourceGraph();
  assert.equal(graph.size,8);
  assert.equal(graph.edgeCount,10);
  assert.equal(graph.validate().valid,true);
  assert.equal(graph.node("gba:front-sprite:1").data.frames,1);
  assert.deepEqual(Array.from(graph.inbound("gba:sprite-palette:1"),edge=>edge.source).sort(),[
    "gba:back-sprite:1","gba:front-sprite:1","gba:species:1"
  ]);
});
