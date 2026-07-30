export {parseSymbolText} from "../../js/core/source-symbol-parser.mjs";
import {parseSymbolText} from "../../js/core/source-symbol-parser.mjs";

const POSITIVE_FIELDS=new Set(["extent","count","stride"]);
const KINDS=new Set(["unknown","table","pointer","code","graphics","audio","text","data"]);
const POINTER_KINDS=new Set(["none","gba32","gb16","gb-far","bank","relative","unknown"]);
const OWNERSHIP=new Set(["unknown","root","exclusive","shared","pointer-table"]);
export const applySymbolMetadata=(name,parsed,definition={})=>{
  if(!definition||typeof definition!=="object"||Array.isArray(definition))throw new TypeError(`Symbol metadata for '${name}' must be an object.`);
  const result={...parsed};
  for(const field of POSITIVE_FIELDS){
    if(definition[field]==null)continue;
    if(!Number.isSafeInteger(definition[field])||definition[field]<1)throw new RangeError(`Symbol '${name}' ${field} must be a positive integer.`);
    if(field==="extent"&&result.extent!=null&&result.extent!==definition.extent)throw new Error(`Symbol '${name}' extent conflicts with the source artifact.`);
    result[field]=definition[field];
  }
  if(result.count!=null&&result.stride!=null&&result.extent!=null&&result.count*result.stride>result.extent){
    throw new RangeError(`Symbol '${name}' count × stride exceeds its byte extent.`);
  }
  for(const [field,allowed,fallback] of [
    ["kind",KINDS,"unknown"],["pointerKind",POINTER_KINDS,"unknown"],["ownership",OWNERSHIP,"unknown"]
  ]){
    if(definition[field]==null)continue;
    const value=String(definition[field]||fallback).toLowerCase();
    if(!allowed.has(value))throw new TypeError(`Symbol '${name}' has unsupported ${field} '${value}'.`);
    result[field]=value;
  }
  if(definition.notes!=null){
    if(typeof definition.notes!=="string"||!definition.notes.trim())throw new TypeError(`Symbol '${name}' notes must be non-empty text.`);
    result.notes=definition.notes.trim();
  }
  return Object.freeze(result);
};

export function applyConfiguredMetadata(manifest,config){
  const definitions=config?.symbolMetadata||{};
  const symbols=Object.fromEntries(Object.entries(manifest?.symbols||{}).map(([name,symbol])=>[
    name,applySymbolMetadata(name,symbol,definitions[name])
  ]));
  return Object.freeze({...manifest,symbols:Object.freeze(symbols)});
}

export function buildPretManifest({config,symbolText,commit}){
  if(!config?.profile||!config?.fingerprint||!config?.repository)throw new Error("Manifest config requires profile, fingerprint, and repository.");
  if(!/^[0-9a-f]{40}$/i.test(commit||""))throw new Error("A full 40-character source commit is required.");
  const parsed=parseSymbolText(symbolText,{platform:config.platform});
  const required=Array.from(config.requiredSymbols||[]);
  const optional=Array.from(config.optionalSymbols||[]);
  const missing=required.filter(name=>!parsed.has(name));
  if(missing.length)throw new Error(`Missing required symbols: ${missing.join(", ")}`);
  const selected={};
  for(const name of [...required,...optional]){
    const symbol=parsed.get(name);
    if(symbol)selected[name]=applySymbolMetadata(name,symbol,config.symbolMetadata?.[name]);
  }
  const resources={};
  for(const [id,definition] of Object.entries(config.resources||{})){
    const names=Array.from(definition.symbols||[]);
    const absent=names.filter(name=>!selected[name]);
    if(absent.length)throw new Error(`Resource '${id}' references unselected symbols: ${absent.join(", ")}`);
    resources[id]=Object.freeze({
      coverage:definition.coverage||"root-only",
      symbols:Object.freeze(names),
      notes:definition.notes||null
    });
  }
  return Object.freeze({
    schemaVersion:1,
    profile:config.profile,
    fingerprint:String(config.fingerprint).toLowerCase(),
    platform:config.platform,
    source:Object.freeze({
      repository:config.repository,
      commit:commit.toLowerCase(),
      build:config.build||"reference"
    }),
    symbols:Object.freeze(selected),
    resources:Object.freeze(resources)
  });
}
