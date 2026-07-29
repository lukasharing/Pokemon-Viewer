const HEX=/^(?:0x)?[0-9a-f]+$/i;

export function parseSymbolText(text,{platform}={}){
  const symbols=new Map();
  for(const rawLine of String(text).split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line||line.startsWith(";")||line.startsWith("#"))continue;
    const rgbds=line.match(/^([0-9a-f]{2}):([0-9a-f]{4})\s+([A-Za-z_.$@][\w.$@]*)$/i);
    if(rgbds){
      const bank=parseInt(rgbds[1],16),address=parseInt(rgbds[2],16);
      if(bank>0&&address<0x4000)throw new Error(`Invalid banked RGBDS address: ${line}`);
      const offset=bank===0?address:bank*0x4000+(address-0x4000);
      symbols.set(rgbds[3],Object.freeze({offset,bank,address,format:"rgbds"}));
      continue;
    }
    const parts=line.split(/\s+/);
    const addressIndex=parts.findIndex(part=>HEX.test(part)&&part.replace(/^0x/i,"").length>=6);
    if(addressIndex<0)continue;
    const name=parts.slice(addressIndex+1).findLast(part=>/^[A-Za-z_.$][\w.$]*$/.test(part)&&!/^[A-Fa-f]$/.test(part));
    if(!name)continue;
    const address=parseInt(parts[addressIndex],16);
    const offset=platform==="gba"&&address>=0x08000000?address-0x08000000:address;
    if(offset<0)throw new Error(`Invalid ROM symbol address: ${line}`);
    symbols.set(name,Object.freeze({offset,address,format:"gnu"}));
  }
  return symbols;
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
