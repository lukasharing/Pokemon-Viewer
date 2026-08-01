import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";

const options=new Map();
for(let index=2;index<process.argv.length;index+=2)options.set(process.argv[index],process.argv[index+1]);
for(const name of ["--pokered","--pokecrystal","--pokeemerald","--output"]){
  if(!options.has(name)){
    console.error("Usage: node scripts/generate-audio-source-catalog.mjs --pokered <repo> --pokecrystal <repo> --pokeemerald <repo> --output <js>");
    process.exit(1);
  }
}

const read=async(repo,path)=>readFile(resolve(repo,path),"utf8");
const humanize=value=>value
  .replace(/^(MUS|MUSIC|SE|SFX)_/,"")
  .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
  .toLocaleLowerCase()
  .split("_")
  .filter(Boolean)
  .map(part=>part.length<=2?part.toUpperCase():part[0].toUpperCase()+part.slice(1))
  .join(" ");

const pokered=options.get("--pokered");
const pokecrystal=options.get("--pokecrystal");
const pokeemerald=options.get("--pokeemerald");

const gen1MapSource=await read(pokered,"data/maps/songs.asm");
const gen1Maps=[...gen1MapSource.matchAll(/db\s+(MUSIC_[A-Z0-9_]+),\s+BANK\([^)]+\)\s*;\s*([A-Z0-9_]+)/g)]
  .map(([,song,map])=>({map,mapName:humanize(map),song,songName:humanize(song)}));

const gen1Constants=await read(pokered,"constants/music_constants.asm");
let audioBank=null;
const gen1Songs=[];
for(const line of gen1Constants.split(/\r?\n/)){
  const bank=line.match(/^\s*;\s*AUDIO_([123])\s*$/i);if(bank){audioBank=Number(bank[1]);continue;}
  const song=line.match(/^\s*music_const\s+((?:MUSIC|SFX)_[A-Z0-9_]+),\s*([A-Za-z0-9_]+)/);if(!song)continue;
  gen1Songs.push({symbol:song[1],header:song[2],name:humanize(song[1]),bank:audioBank,kind:song[1].startsWith("SFX_")?"sfx":"music"});
}

const crystalConstants=await read(pokecrystal,"constants/music_constants.asm");
const gen2Songs=[...crystalConstants.matchAll(/^\s*const\s+(MUSIC_[A-Z0-9_]+)\s*;\s*([0-9a-f]{2})/gmi)]
  .sort((a,b)=>parseInt(a[2],16)-parseInt(b[2],16))
  .map(([,symbol,id])=>({id:parseInt(id,16),symbol,name:humanize(symbol)}));
const crystalSfx=await read(pokecrystal,"constants/sfx_constants.asm");
const gen2Sfx=[...crystalSfx.matchAll(/^\s*const\s+(SFX_[A-Z0-9_]+)\s*;\s*([0-9a-f]{2})/gmi)]
  .sort((a,b)=>parseInt(a[2],16)-parseInt(b[2],16))
  .map(([,symbol,id])=>({id:parseInt(id,16),symbol,name:humanize(symbol),kind:"sfx"}));

const emeraldSongs=await read(pokeemerald,"include/constants/songs.h");
const gbaSongs=[...emeraldSongs.matchAll(/^#define\s+((?:MUS|SE)_[A-Z0-9_]+)\s+(\d+)\b/gm)]
  .sort((a,b)=>Number(a[2])-Number(b[2]))
  .map(([,symbol,id])=>({id:Number(id),symbol,name:humanize(symbol),kind:symbol.startsWith("MUS_")?"music":"sfx"}));

const groupData=JSON.parse(await read(pokeemerald,"data/maps/map_groups.json"));
const gbaGroups=groupData.group_order.map((group,index)=>({
  index,
  name:humanize(group.replace(/^gMapGroup_/,"")),
  maps:groupData[group].map(map=>({name:map,label:humanize(map)}))
}));

const payload={schemaVersion:2,provenance:{
  gen1:"pret/pokered constants/music_constants.asm + data/maps/songs.asm",
  gen2:"pret/pokecrystal constants/music_constants.asm + constants/sfx_constants.asm",
  gba:"pret/pokeemerald include/constants/songs.h + data/maps/map_groups.json"
},gen1:{songs:gen1Songs,maps:gen1Maps},gen2:{songs:gen2Songs,sfx:gen2Sfx},gba:{songs:gbaSongs,groups:gbaGroups}};
const output=`(function(global){\n  "use strict";\n  const sound=((global.PokemonViewer||={}).sound||={});\n  sound.sourceCatalog=Object.freeze(${JSON.stringify(payload)});\n})(globalThis);\n`;
await writeFile(resolve(options.get("--output")),output);
console.log(`Generated ${gen1Songs.length} Gen I music/SFX entries, ${gen1Maps.length} Gen I map references, ${gen2Songs.length} Crystal songs, ${gen2Sfx.length} Crystal SFX, ${gbaSongs.length} Emerald songs/SFX and ${gbaGroups.length} Emerald map groups.`);
