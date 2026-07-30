export {parseSymbolText} from "../../js/core/source-symbol-parser.mjs";
import {parseSymbolText} from "../../js/core/source-symbol-parser.mjs";

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
    if(symbol)selected[name]=symbol;
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
