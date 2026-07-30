import {readFile,readdir} from "node:fs/promises";
import {resolve,join} from "node:path";

const root=resolve(import.meta.dirname,"..");
const shared=[
  "js/core/editor-links.js","js/core/project-events.js","js/core/pixel-canvas.js",
  "js/battle/editor.js","js/battle/library.js","js/battle/preview.js","js/battle/timeline.js","js/battle/hud-assets.js",
  "js/battle/source-state.js","js/battle/party-view.js",
  "js/encounters/editor.js","js/encounters/library.js","js/encounters/view-model.js","js/encounters/slot-view.js",
  "js/sprite/editor.js","js/sprite/compositor.js"
];
const forbiddenShared=[
  {pattern:/\b(?:family|layout|platform)\s*={2,3}\s*["'](?:gba|gbc|gb|gen1|gen2|gen3)["']/g,label:"family/layout switch"},
  {pattern:/["'](?:gba|gbc|gb|gen1|gen2|gen3)["']\s*={2,3}\s*\b(?:family|layout|platform)\b/g,label:"reversed family/layout switch"}
];
const filesUnder=async directory=>{
  const absolute=join(root,directory),entries=await readdir(absolute,{withFileTypes:true}),files=[];
  for(const entry of entries){
    const relative=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await filesUnder(relative));
    else if(entry.isFile()&&entry.name.endsWith(".js"))files.push(relative);
  }
  return files;
};
const failures=[];
for(const file of shared){
  const source=await readFile(join(root,file),"utf8");
  for(const rule of forbiddenShared)if(rule.pattern.test(source))failures.push(`${file}: shared code contains a ${rule.label}`);
}
const families=[
  {
    name:"GBA",
    directories:[
      "js/animation/gba","js/battle/gba","js/encounters/gba","js/fonts/gba","js/items/gba",
      "js/map/gba","js/moves/gba","js/pokedex/gba","js/sound/gba","js/sprite/gba","js/structures/gba"
    ],
    files:[
      "js/animation/gba-driver.js","js/code/codecs/gba-arm.js","js/code/scripts/gba-event-script.js",
      "js/core/gba-encounters.js","js/core/gba-items.js","js/core/gba-moves.js","js/core/gba-rom-assets.js",
      "js/core/gba-species.js","js/core/gba-tilemap.js","js/core/gba-trainers.js","js/core/gba-wave-data.js",
      "js/rom/runtime/gba.js"
    ],
    forbidden:/PokemonViewer\.(?:gen1|gen2)|\bGbc[A-Z]|\/(?:gbc|gen2)\//
  },
  {
    name:"Gen I",
    directories:[
      "js/animation/gbc","js/battle/gbc","js/encounters/gbc","js/fonts/gbc","js/items/gbc",
      "js/map/gbc","js/moves/gbc","js/pokedex/gbc","js/sprite/gbc","js/structures/gbc"
    ],
    files:[
      "js/code/codecs/gbc-lr35902.js","js/code/scripts/gbc-text-script.js",
      "js/core/gen1-encounters.js","js/core/gen1-items.js","js/core/gen1-moves.js",
      "js/core/gen1-species.js","js/core/gen1-trainers.js","js/rom/runtime/gbc.js"
    ],
    forbidden:/PokemonViewer\.gba|\bGba[A-Z]|\/gba\/|PokemonViewer\.gen2|\/gen2\//
  },
  {
    name:"Gen II",
    directories:[
      "js/animation/gen2","js/battle/gen2","js/encounters/gen2","js/map/gen2",
      "js/moves/gen2","js/pokedex/gen2","js/sprite/gen2","js/structures/gen2"
    ],
    files:[
      "js/code/scripts/gen2-event-script.js","js/code/scripts/gen2-text-script.js",
      "js/core/gen2-encounters.js","js/core/gen2-progression.js","js/core/gen2-species.js",
      "js/core/gen2-trainers.js","js/rom/runtime/gen2.js"
    ],
    forbidden:/PokemonViewer\.(?:gba|gen1)|\bGba[A-Z]|\/(?:gba|gbc)\//
  }
];
for(const family of families){
  const files=[...family.files];
  for(const directory of family.directories)files.push(...await filesUnder(directory));
  for(const file of files){
    const source=await readFile(join(root,file),"utf8");
    if(family.forbidden.test(source))failures.push(`${file}: ${family.name} module imports or references another ROM family`);
  }
}
for(const directory of ["js/sprite/gba","js/sprite/gbc","js/sprite/gen2"])for(const file of await filesUnder(directory)){
  const source=await readFile(join(root,file),"utf8");
  if(/PokemonViewer\.battle|\/battle\//.test(source))failures.push(`${file}: Sprite resources depend on the Battle renderer instead of their family data provider`);
}
if(failures.length){
  console.error("ROM family boundary validation failed:");
  for(const failure of failures)console.error(`- ${failure}`);
  process.exitCode=1;
}else{
  const isolated=families.reduce((count,family)=>count+family.files.length,0)
    +(await Promise.all(families.flatMap(family=>family.directories.map(filesUnder)))).flat().length;
  console.log(`Family boundary validation passed for ${shared.length} shared modules and ${isolated} isolated family modules across ${families.length} groups.`);
}
