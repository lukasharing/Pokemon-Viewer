(function(global){
  "use strict";
  const profiles=Object.freeze({
    emerald:{monsterPics:0x30a194,monsterBackPics:0x3028f8,monsterPalettes:0x303680,monsterFrontCoords:0x300d38,monsterBackCoords:0x3021d8,enemyMonElevation:0x305dcc,monFrontAnims:0x309aac,monFrontAnimIds:0x3299ec,trainerFrontPics:0x305654,trainerFrontPalettes:0x30593c,battleEnvironmentTable:0x31aba8,healthboxPalette:0xc11b9c,ballDisplayPalette:0xc11bbc,healthboxElements:0xc11bdc,healthboxPlayer:0xc1f1c8,healthboxOpponent:0xc1f46c,ballStatusBar:0xd8fbf0,battleTextboxTiles:0xc00000,battleTextboxPalette:0xc004e0,battleTextboxTilemap:0xc00524,fontSmallLatin:0x633ce4,fontSmallWidths:0x63bce4,fontNormalLatin:0x64c2e4,fontNormalWidths:0x6542e4,monsterNames:0x3185c8,monsterNameSize:11,pokedexEntries:0x56b5b0,pokedexEntrySize:32,speciesCount:411,pokedexCount:386,evolutions:0x32531c,tmHmLearnsets:0x31e898,tmHmCount:58,levelUpLearnsets:0x32937c,monFootprintTable:0x56e694,regionMapEntries:0x5a14fc,wildMonHeaders:0x552d48,battleMoves:0x31c898,moveNames:0x31977c,moveCount:354,songCount:610,speciesIdToCryId:0x31f61c,cryTable:0x69dcf4,cryTableReverse:0x69ef24,monIconTable:0x57bca8,monIconPaletteIndices:0x57c388,monIconPaletteTable:0x57c540},
    fire_red:{monsterPics:0x2350ac,monsterBackPics:0x23654c,monsterPalettes:0x23730c,fontSmallLatin:0x1dab00,fontSmallWidths:0x1e2b00,fontNormalLatin:0x1f3100,fontNormalWidths:0x1fb100,monsterNames:0x245ee0,monsterNameSize:11,pokedexEntries:0x44e850,pokedexEntrySize:36,speciesCount:411,pokedexCount:386,evolutions:0x2597c4,tmHmLearnsets:0x252c38,tmHmCount:57,battleMoves:0x250c04,moveNames:0x2470a4,moveCount:354},
    leaf_green:{monsterPics:0x235088,monsterBackPics:0x236528,monsterPalettes:0x2372e8,monsterNames:0x245ebc,monsterNameSize:11,pokedexEntries:0x44e270,pokedexEntrySize:36,speciesCount:411,pokedexCount:386,evolutions:0x2597a0,tmHmLearnsets:0x252c14,tmHmCount:57}
  });
  const revisedProfile=(reader,base)=>{
    if(!["fire_red","leaf_green"].includes(reader?.type)||Number(reader.version)!==1)return base;
    const shifted={...base};
    for(const name of ["monsterPics","monsterBackPics","monsterPalettes","fontNormalLatin","fontNormalWidths","monsterNames","tmHmLearnsets","battleMoves","moveNames"]){
      if(Number.isInteger(shifted[name]))shifted[name]+=0x70;
    }
    shifted.pokedexEntries+=0x60;
    return Object.freeze(shifted);
  };
  const SYMBOL_BINDINGS=Object.freeze({
    monsterPics:"gMonFrontPicTable",monsterBackPics:"gMonBackPicTable",monsterPalettes:"gMonPaletteTable",
    monIconTable:"gMonIconTable",monIconPaletteIndices:"gMonIconPaletteIndices",monIconPaletteTable:"gMonIconPaletteTable",
    monsterFrontCoords:"gMonFrontPicCoords",monsterBackCoords:"gMonBackPicCoords",enemyMonElevation:"gEnemyMonElevation",
    monFrontAnims:"gMonFrontAnimsPtrTable",monFrontAnimIds:"sMonFrontAnimIdsTable",monsterNames:"gSpeciesNames",
    pokedexEntries:"gPokedexEntries",evolutions:"gEvolutionTable",tmHmLearnsets:Object.freeze(["gTMHMLearnsets","sTMHMLearnsets"]),
    levelUpLearnsets:"gLevelUpLearnsets",monFootprintTable:"gMonFootprintTable",battleMoves:"gBattleMoves",
    moveNames:"gMoveNames",trainers:"gTrainers",trainerFrontPics:"gTrainerFrontPicTable",
    trainerFrontPalettes:"gTrainerFrontPicPaletteTable",mapGroups:"gMapGroups",songTable:"gSongTable",
    speciesIdToCryId:Object.freeze(["gSpeciesIdToCryId","sHoennSpeciesIdToCryId"]),cryTable:"gCryTable",cryTableReverse:"gCryTable_Reverse",
    battleAnimations:"gBattleAnims_Moves",regionMapEntries:"gRegionMapEntries",wildMonHeaders:"gWildMonHeaders",
    items:"gItems",itemIcons:Object.freeze(["gItemIconTable","sItemIconTable"]),fontNormalLatin:"gFontNormalLatinGlyphs",
    fontNormalWidths:"gFontNormalLatinGlyphWidths",fontSmallLatin:"gFontSmallLatinGlyphs",
    fontSmallWidths:"gFontSmallLatinGlyphWidths"
  });
  const profile=reader=>{
    const source=profiles[reader?.type]||null,baseFallback=source?revisedProfile(reader,source):null;
    const fallback=baseFallback&&reader?.type==="emerald"
      ?Object.freeze({...baseFallback,items:0x5839a0,itemIcons:0x614410,itemCount:377})
      :baseFallback&&reader?.type==="fire_red"&&Number(reader.version)===1
        ?Object.freeze({...baseFallback,items:0x3db098,itemIcons:0x3d4304,itemCount:375})
        :baseFallback;
    const dictionary=reader?.memoryProfile;
    if(!fallback||!dictionary?.verified)return null;
    const resolved={...fallback,verifiedReference:true};
    for(const [property,binding] of Object.entries(SYMBOL_BINDINGS)){
      const symbols=Array.isArray(binding)?binding:[binding];
      const offset=symbols.map(symbol=>dictionary.offset(symbol)).find(Number.isInteger);
      if(Number.isInteger(offset))resolved[property]=offset;
    }
    return Object.freeze(resolved);
  };
  ((global.PokemonViewer||={}).gba||={}).assets=Object.freeze({profiles,SYMBOL_BINDINGS,profile});
})(globalThis);
