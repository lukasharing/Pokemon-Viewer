(function(global){
  "use strict";
  // Declarative reference only: locations belong to verified per-ROM profiles.
  // Editors must never infer an offset from this catalog.
  const families=Object.freeze({
    gba:Object.freeze({pointer:"u32 little-endian ROM address 0x08000000",records:Object.freeze({mapHeader:"28 bytes",mapLayout:"24 bytes",tilesetHeader:"24 bytes",connection:"12 bytes",eventHeader:"20 bytes",objectEvent:"24 bytes",warpEvent:"8 bytes",coordEvent:"16 bytes",bgEvent:"12 bytes",item:"44 bytes",objectEventGraphicsInfo:"36 bytes",spriteFrameImage:"8 bytes"}),tables:Object.freeze(["map groups / map headers","layouts","tilesets","map connections","map events","object-event graphics","items","species names","base stats","Pokédex entries","front/back pic tables","palettes","cry table","region-map sections","fly warps","songs / voicegroups","battle animation scripts"])}),
    gbc:Object.freeze({pointer:"bank + 16-bit address; Gen I far pointer is db bank, dw address",records:Object.freeze({mapHeader:"variable + connection tails",objectBlock:"variable",warp:"4 bytes",signpost:"3 bytes",person:"8 bytes",item:"7 bytes",trainer:"8 bytes",tilesetHeader:"variable / banked",itemPrice:"3-byte BCD"}),tables:Object.freeze(["MapHeaderPointers","MapHeaderBanks","map object blocks","tilesets","overworld sprite catalog","ItemNames","ItemPrices","Town Map entries","FlyWarp destinations","cry/audio engine commands"])}),
    gen2:Object.freeze({pointer:"dba fields are dw address, db bank",records:Object.freeze({mapGroupEntry:"9 bytes",mapAttributes:"12 bytes + connection tail",warp:"5 bytes",coordEvent:"8 bytes",backgroundEvent:"5 bytes",objectEvent:"13 bytes",tilesetHeader:"15 bytes",overworldSprite:"native fixed catalog"}),tables:Object.freeze(["MapGroupPointers","map attributes","map events","tilesets","landmarks","flypoints","Town Map entries","Pokémon pics / palettes","cries / music","battle animation commands"])} )
  });
  const catalog=Object.freeze({families,get(family){return families[family]||null;},list(family){const entry=families[family];return entry?Object.freeze([...Object.keys(entry.records),...entry.tables]):Object.freeze([]);}});
  ((global.PokemonViewer||={}).structures||={}).reference=catalog;
})(globalThis);
