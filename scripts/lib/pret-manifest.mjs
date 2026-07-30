export {parseSymbolText} from "../../js/core/source-symbol-parser.mjs";
import {parseSymbolText} from "../../js/core/source-symbol-parser.mjs";

const POSITIVE_FIELDS=new Set(["extent","count","stride"]);
const KINDS=new Set(["unknown","table","pointer","code","graphics","audio","text","data"]);
const POINTER_KINDS=new Set(["none","gba32","gb16","gb-far","bank","relative","unknown"]);
const OWNERSHIP=new Set(["unknown","root","exclusive","shared","pointer-table"]);
const KNOWLEDGE_FAMILIES=new Set(["gba","gen1","gen2"]);
const MANUAL_KNOWLEDGE_POLICY=Object.freeze({
  addressAuthority:"none",
  compatibilityAuthority:"none",
  writeAuthority:"operation-audit-required"
});
const FORBIDDEN_MANUAL_KEYS=new Set([
  "offset","address","fingerprint","sha1","romoffset","absoluteoffset","baseaddress"
]);
const patterns=(values,label)=>Array.from(values||[],(value,index)=>{
  try{return new RegExp(value);}
  catch(error){throw new SyntaxError(`${label} pattern ${index+1} is invalid: ${error.message}`);}
});
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

export const normalizeManualKnowledge=config=>{
  const definition=config?.knowledge;
  if(!definition||typeof definition!=="object"||Array.isArray(definition)){
    throw new TypeError(`Manifest config '${config?.profile||"unknown"}' requires reviewed manual knowledge provenance.`);
  }
  const id=String(definition.id||"").trim();
  const family=String(definition.family||"").trim().toLowerCase();
  const method=String(definition.method||"").trim().toLowerCase();
  const evidence=String(definition.evidence||"").trim();
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(id))throw new TypeError("Manual knowledge id must be a stable lowercase identifier.");
  if(!KNOWLEDGE_FAMILIES.has(family))throw new TypeError(`Manual knowledge family '${family}' is unsupported.`);
  if(method!=="reviewed-manual")throw new TypeError("Manual engine knowledge must use the 'reviewed-manual' method.");
  if(!evidence)throw new TypeError("Manual engine knowledge requires review evidence.");
  return Object.freeze({id,family,method,evidence,policy:MANUAL_KNOWLEDGE_POLICY});
};

const assertOffsetFree=(value,path="knowledge")=>{
  if(!value||typeof value!=="object")return;
  for(const [key,item] of Object.entries(value)){
    if(FORBIDDEN_MANUAL_KEYS.has(key.toLowerCase())){
      throw new TypeError(`Manual engine knowledge cannot contain absolute identity field '${path}.${key}'.`);
    }
    assertOffsetFree(item,`${path}.${key}`);
  }
};

const normalizeKnowledgeReview=(config,source={})=>{
  const commit=String(source.commit||"").trim().toLowerCase();
  if(!/^[0-9a-f]{40}$/.test(commit)){
    throw new TypeError(`Manual engine knowledge review for '${config.profile}' requires the pinned 40-character source commit.`);
  }
  return Object.freeze({
    profile:config.profile,
    repository:String(source.repository||config.repository||"").trim(),
    commit,
    build:String(source.build||config.build||"reference").trim()
  });
};

export const buildManualKnowledge=(config,{source}={})=>{
  const knowledge=normalizeManualKnowledge(config);
  const result={
    schemaVersion:2,
    ...knowledge,
    platform:config.platform,
    repository:config.repository,
    profiles:Object.freeze([config.profile]),
    reviews:Object.freeze([normalizeKnowledgeReview(config,source)]),
    symbolMetadata:Object.freeze(Object.fromEntries(Object.entries(config.symbolMetadata||{}).map(([name,value])=>[
      name,Object.freeze({...value})
    ]))),
    structures:Object.freeze(Object.fromEntries(Object.entries(config.structures||{}).map(([name,value])=>[
      name,freezeTree(value)
    ]))),
    resources:Object.freeze(Object.fromEntries(Object.entries(config.resources||{}).map(([id,value])=>[
      id,Object.freeze({
        coverage:value.coverage||"root-only",
        symbols:Object.freeze([...(value.symbols||[])]),
        ...(value.symbolPatterns?{symbolPatterns:Object.freeze([...value.symbolPatterns])}:{}),
        ...(value.notes?{notes:value.notes}:{}),
      })
    ])))
  };
  assertOffsetFree(result);
  return Object.freeze(result);
};

const freezeTree=value=>{
  if(!value||typeof value!=="object")return value;
  if(Array.isArray(value))return Object.freeze(value.map(freezeTree));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,freezeTree(item)])));
};

export function applyConfiguredMetadata(manifest,config){
  const definitions=config?.symbolMetadata||{};
  const symbols=Object.fromEntries(Object.entries(manifest?.symbols||{}).map(([name,symbol])=>[
    name,applySymbolMetadata(name,symbol,definitions[name])
  ]));
  return Object.freeze({
    ...manifest,
    knowledge:normalizeManualKnowledge(config),
    symbols:Object.freeze(symbols)
  });
}

export function buildPretManifest({config,symbolText,commit}){
  if(!config?.profile||!config?.fingerprint||!config?.repository)throw new Error("Manifest config requires profile, fingerprint, and repository.");
  if(!/^[0-9a-f]{40}$/i.test(commit||""))throw new Error("A full 40-character source commit is required.");
  const parsed=parseSymbolText(symbolText,{platform:config.platform});
  const required=Array.from(config.requiredSymbols||[]);
  const optional=Array.from(config.optionalSymbols||[]);
  const optionalPatterns=patterns(config.optionalSymbolPatterns,"Optional symbol");
  const missing=required.filter(name=>!parsed.has(name));
  if(missing.length)throw new Error(`Missing required symbols: ${missing.join(", ")}`);
  const selected={};
  const patternMatches=[...parsed.keys()].filter(name=>optionalPatterns.some(pattern=>pattern.test(name)));
  for(const name of [...new Set([...required,...optional,...patternMatches])]){
    const symbol=parsed.get(name);
    if(symbol)selected[name]=applySymbolMetadata(name,symbol,config.symbolMetadata?.[name]);
  }
  const resources={};
  for(const [id,definition] of Object.entries(config.resources||{})){
    const resourcePatterns=patterns(definition.symbolPatterns,`Resource '${id}' symbol`);
    const matched=Object.keys(selected).filter(name=>resourcePatterns.some(pattern=>pattern.test(name)));
    const names=[...new Set([...Array.from(definition.symbols||[]),...matched])];
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
    knowledge:normalizeManualKnowledge(config),
    source:Object.freeze({
      repository:config.repository,
      commit:commit.toLowerCase(),
      build:config.build||"reference"
    }),
    symbols:Object.freeze(selected),
    resources:Object.freeze(resources)
  });
}
