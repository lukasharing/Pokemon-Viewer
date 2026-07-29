import {readdir} from "node:fs/promises";
import {spawn} from "node:child_process";
import {resolve, relative, sep} from "node:path";

const root=resolve(import.meta.dirname,"..");
const sourceRoot=resolve(root,"js");
const excluded=[
  `js${sep}code${sep}codemirror${sep}`,
  `js${sep}emulator${sep}core${sep}`,
  `js${sep}emulator${sep}includes${sep}`,
  `js${sep}emulator${sep}user_scripts${sep}`
];

async function files(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  const found=[];
  for(const entry of entries){
    const path=resolve(directory,entry.name);
    const projectPath=relative(root,path);
    if(excluded.some(prefix=>projectPath.startsWith(prefix)))continue;
    if(entry.isDirectory())found.push(...await files(path));
    else if(entry.isFile()&&entry.name.endsWith(".js"))found.push(path);
  }
  return found;
}

function check(path){
  return new Promise((resolveCheck,reject)=>{
    const child=spawn(process.execPath,["--check",path],{stdio:["ignore","pipe","pipe"]});
    let output="";
    child.stdout.on("data",chunk=>output+=chunk);
    child.stderr.on("data",chunk=>output+=chunk);
    child.on("error",reject);
    child.on("close",code=>{
      if(code===0)resolveCheck();
      else reject(new Error(`${relative(root,path)}\n${output.trim()}`));
    });
  });
}

const sources=await files(sourceRoot);
const failures=[];
for(const source of sources){
  try{await check(source);}
  catch(error){failures.push(error.message);}
}
if(failures.length){
  console.error(`Syntax validation failed for ${failures.length} script(s):\n\n${failures.join("\n\n")}`);
  process.exitCode=1;
}else{
  console.log(`Syntax validation passed for ${sources.length} first-party scripts.`);
}
