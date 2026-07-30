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
  {directories:["js/battle/gba","js/sprite/gba"],forbidden:/PokemonViewer\.(?:gen1|gen2)|\bGbc[A-Z]|\/(?:gbc|gen2)\//},
  {directories:["js/battle/gbc","js/sprite/gbc"],forbidden:/PokemonViewer\.gba|\bGba[A-Z]|\/gba\//},
  {directories:["js/battle/gen2","js/sprite/gen2"],forbidden:/PokemonViewer\.(?:gba|gen1)|\bGba[A-Z]|\/(?:gba|gbc)\//}
];
for(const family of families)for(const directory of family.directories)for(const file of await filesUnder(directory)){
  const source=await readFile(join(root,file),"utf8");
  if(family.forbidden.test(source))failures.push(`${file}: family module imports or references another ROM family`);
}
for(const directory of ["js/sprite/gba","js/sprite/gbc","js/sprite/gen2"])for(const file of await filesUnder(directory)){
  const source=await readFile(join(root,file),"utf8");
  if(/PokemonViewer\.battle|\/battle\//.test(source))failures.push(`${file}: Sprite resources depend on the Battle renderer instead of their family data provider`);
}
if(failures.length){
  console.error("ROM family boundary validation failed:");
  for(const failure of failures)console.error(`- ${failure}`);
  process.exitCode=1;
}else console.log(`Family boundary validation passed for ${shared.length} shared modules and ${families.length} isolated family groups.`);
