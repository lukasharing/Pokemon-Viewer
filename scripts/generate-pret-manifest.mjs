import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {spawn} from "node:child_process";
import {buildPretManifest} from "./lib/pret-manifest.mjs";

const values=new Map();
for(let index=2;index<process.argv.length;index+=2)values.set(process.argv[index],process.argv[index+1]);
for(const key of ["--repo","--symbols","--config","--output"]){
  if(!values.get(key)){
    console.error("Usage: node scripts/generate-pret-manifest.mjs --repo <pret checkout> --symbols <build.sym> --config <profile.json> --output <manifest.json>");
    process.exit(1);
  }
}
const git=(cwd,args)=>new Promise((resolveGit,reject)=>{
  const child=spawn("git",args,{cwd,stdio:["ignore","pipe","pipe"]});let output="";
  child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>output+=chunk);
  child.on("error",reject);child.on("close",code=>code===0?resolveGit(output.trim()):reject(new Error(output.trim())));
});

const repo=resolve(values.get("--repo"));
const [configText,symbolText,commit,dirty]=await Promise.all([
  readFile(resolve(values.get("--config")),"utf8"),
  readFile(resolve(values.get("--symbols")),"utf8"),
  git(repo,["rev-parse","HEAD"]),
  git(repo,["status","--porcelain"])
]);
if(dirty)throw new Error("Refusing to generate provenance from a dirty pret checkout.");
const manifest=buildPretManifest({config:JSON.parse(configText),symbolText,commit});
await writeFile(resolve(values.get("--output")),`${JSON.stringify(manifest,null,2)}\n`);
console.log(`Generated ${manifest.profile} from ${manifest.source.repository}@${manifest.source.commit}.`);
