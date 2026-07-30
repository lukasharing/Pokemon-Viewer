import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const values={};
for(let index=2;index<process.argv.length;index+=2)values[process.argv[index].replace(/^--/,"")]=process.argv[index+1];
if(!values.pokered||!values.pokecrystal||!values.pokeemerald){
  console.error("Usage: node scripts/generate-animation-source-catalog.mjs --pokered <repo> --pokecrystal <repo> --pokeemerald <repo> [--output <js>]");
  process.exit(1);
}
const repositories=Object.freeze({pokered:values.pokered,pokecrystal:values.pokecrystal,pokeemerald:values.pokeemerald});
const read=(repository,file)=>fs.readFileSync(path.join(repositories[repository],file),"utf8");
const humanize=name=>name.replace(/^(ANIM_TAG_|BATTLE_ANIM_OBJ_|BATTLE_ANIM_GFX_|SUBANIM_[0-9]+_)/,"").toLowerCase().split("_").map(word=>word[0]?.toUpperCase()+word.slice(1)).join(" ");

const gba={};
for(const match of read("pokeemerald","include/constants/battle_anim.h").matchAll(/^#define\s+(ANIM_TAG_[A-Z0-9_]+)\s+\(ANIM_SPRITES_START \+ (\d+)\)/gm)){
  gba[10000+Number(match[2])]=Object.freeze({symbol:match[1],name:humanize(match[1])});
}

const constants=read("pokecrystal","constants/battle_anim_constants.asm");
const section=(start,end)=>constants.slice(constants.indexOf(start),constants.indexOf(end,constants.indexOf(start)));
const indexed=(text,prefix)=>{
  const result={};let index=0;
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*const\s+([A-Z0-9_]+)/);if(!match)continue;
    if(match[1].startsWith(prefix))result[index++]=Object.freeze({symbol:match[1],name:humanize(match[1])});
  }
  return result;
};
const gen2Objects=indexed(section("; BattleAnimObjects indexes","; BattleAnimFrameData indexes"),"BATTLE_ANIM_OBJ_");
const gen2Graphics=indexed(section("; AnimObjGFX indexes","DEF NUM_BATTLE_ANIM_GFX"),"BATTLE_ANIM_GFX_");

const gen1={};let gen1Index=0;
const gen1Constants=read("pokered","constants/move_animation_constants.asm");
for(const line of gen1Constants.slice(gen1Constants.indexOf("; SubanimationPointers indexes")).split(/\r?\n/)){
  if(line.includes("DEF NUM_SUBANIMS"))break;
  const match=line.match(/^\s*const\s+(SUBANIM_[A-Z0-9_]+)/);if(match)gen1[gen1Index++]=Object.freeze({symbol:match[1],name:humanize(match[1])});
}

const output=`(function(global){"use strict";const ns=((global.PokemonViewer||={}).animation||={});ns.sourceCatalog=Object.freeze(${JSON.stringify({gba,gen2Objects,gen2Graphics,gen1})});})(globalThis);\n`;
fs.writeFileSync(path.resolve(root,values.output||"js/animation/source-catalog.js"),output);
console.log(`Animation source catalog: ${Object.keys(gba).length} GBA tags, ${Object.keys(gen2Objects).length} Crystal objects, ${Object.keys(gen2Graphics).length} Crystal graphics, ${Object.keys(gen1).length} Gen I subanimations.`);
