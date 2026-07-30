const HEX=/^(?:0x)?[0-9a-f]+$/i;
const SYMBOL=/^[A-Za-z_.$][A-Za-z0-9_.$]*$/;
const SHA1=/^[0-9a-f]{40}$/i;

const addSymbol=(symbols,name,symbol,line)=>{
  if(!SYMBOL.test(name))return false;
  const current=symbols.get(name);
  if(current&&JSON.stringify(current)!==JSON.stringify(symbol)){
    throw new Error(`Source symbol '${name}' resolves to conflicting addresses (line ${line}).`);
  }
  symbols.set(name,Object.freeze(symbol));
  return true;
};

export function parseSymbolDocument(text,{platform,romSize=null}={}){
  const target=String(platform||"").toLowerCase();
  if(!["gb","gba"].includes(target))throw new TypeError("Symbol parsing requires platform 'gb' or 'gba'.");
  const size=Number.isSafeInteger(romSize)&&romSize>0?romSize:null;
  const symbols=new Map(),diagnostics={rgbds:0,gnu:0,ignored:0};
  for(const [index,rawLine] of String(text).split(/\r?\n/).entries()){
    const line=rawLine.trim();
    if(!line||line.startsWith(";")||line.startsWith("#"))continue;
    const rgbds=line.match(/^([0-9a-f]+):([0-9a-f]{4})\s+([A-Za-z_.$@][\w.$@]*)$/i);
    if(rgbds&&target==="gb"){
      const bank=parseInt(rgbds[1],16),address=parseInt(rgbds[2],16);
      const isRom=bank===0?address<0x4000:address>=0x4000&&address<0x8000;
      if(!isRom){diagnostics.ignored++;continue;}
      const offset=bank===0?address:bank*0x4000+(address-0x4000);
      if(size!==null&&offset>=size)throw new RangeError(`RGBDS symbol '${rgbds[3]}' is outside the loaded ROM (line ${index+1}).`);
      if(addSymbol(symbols,rgbds[3],{offset,bank,address,format:"rgbds"},index+1))diagnostics.rgbds++;
      else diagnostics.ignored++;
      continue;
    }
    if(target==="gba"){
      const sized=line.match(/^(?:0x)?([0-9a-f]{8,16})\s+(0x[0-9a-f]+|[0-9a-f]{2,})\s+(?:[A-Za-z]\s+)?([A-Za-z_.$][A-Za-z0-9_.$]*)$/i);
      if(sized){
        const address=parseInt(sized[1],16),extent=parseInt(sized[2],16),name=sized[3];
        if(address>=0x08000000&&extent>0){
          const offset=address-0x08000000;
          if(size!==null&&(offset>=size||offset+extent>size))throw new RangeError(`GNU symbol '${name}' extent is outside the loaded ROM (line ${index+1}).`);
          if(addSymbol(symbols,name,{offset,address,extent,format:"gnu"},index+1))diagnostics.gnu++;
          else diagnostics.ignored++;
          continue;
        }
      }
      const parts=line.split(/\s+/);
      const addressIndex=parts.findIndex(part=>HEX.test(part)&&part.replace(/^0x/i,"").length>=6);
      if(addressIndex>=0){
        const name=parts.slice(addressIndex+1).findLast(part=>SYMBOL.test(part)&&!/^[A-Fa-f]$/.test(part));
        const address=parseInt(parts[addressIndex],16);
        if(name&&address>=0x08000000){
          const offset=address-0x08000000;
          if(size!==null&&offset>=size)throw new RangeError(`GNU symbol '${name}' is outside the loaded ROM (line ${index+1}).`);
          if(addSymbol(symbols,name,{offset,address,format:"gnu"},index+1))diagnostics.gnu++;
          else diagnostics.ignored++;
          continue;
        }
      }
    }
    diagnostics.ignored++;
  }
  if(!symbols.size)throw new Error(`No ${target==="gba"?"GBA ROM":"RGBDS ROM"} symbols were found.`);
  return Object.freeze({symbols,diagnostics:Object.freeze(diagnostics)});
}

export function parseSymbolText(text,options={}){
  return parseSymbolDocument(text,options).symbols;
}

export function buildProjectManifestFromSymbols({
  symbolText,platform,romSize,fingerprint,engineProfile,profile,source,template
}={}){
  if(!SHA1.test(String(fingerprint||"")))throw new TypeError("A complete loaded-ROM SHA-1 is required.");
  if(!SHA1.test(String(source?.commit||"")))throw new TypeError("A complete source commit is required.");
  if(!template?.resources)throw new TypeError("A family source template is required.");
  const parsed=parseSymbolDocument(symbolText,{platform,romSize});
  const resources={},selected={},missing={};
  const enrich=(name,symbol)=>{
    const definition=template.symbolMetadata?.[name]||{},result={...symbol};
    if(definition.extent!=null&&result.extent!=null&&definition.extent!==result.extent){
      throw new Error(`Source symbol '${name}' extent conflicts with reviewed ${template.id||engineProfile} engine knowledge.`);
    }
    for(const field of ["extent","count","stride","kind","pointerKind","ownership","notes"]){
      if(definition[field]!=null&&result[field]==null)result[field]=definition[field];
    }
    return Object.freeze(result);
  };
  for(const [id,definition] of Object.entries(template.resources)){
    const patterns=(definition.symbolPatterns||[]).map(pattern=>new RegExp(pattern));
    const matched=[...parsed.symbols.keys()].filter(name=>patterns.some(pattern=>pattern.test(name)));
    const names=[...new Set([...(definition.symbols||[]),...matched])],absent=names.filter(name=>!parsed.symbols.has(name));
    if(absent.length){missing[id]=Object.freeze(absent);continue;}
    for(const name of names)selected[name]=enrich(name,parsed.symbols.get(name));
    resources[id]=Object.freeze({
      coverage:definition.coverage||"root-only",
      symbols:Object.freeze(names),
      notes:`Imported from ${source.build}; structural operation audit pending.`
    });
  }
  if(!Object.keys(resources).length){
    const summary=Object.entries(missing).map(([id,names])=>`${id}: ${names.join(", ")}`).join("; ");
    throw new Error(`The symbol file completes no known ${engineProfile} resource group. Missing ${summary}.`);
  }
  return Object.freeze({
    manifest:Object.freeze({
      schemaVersion:1,
      profile:String(profile||`${engineProfile}-project`),
      engineProfile:String(engineProfile),
      fingerprint:String(fingerprint).toLowerCase(),
      platform:String(platform),
      ...(template.id?{knowledge:Object.freeze({
        id:template.id,method:template.method,evidence:template.evidence
      })}:{}),
      source:Object.freeze({
        repository:String(source.repository).trim(),
        commit:String(source.commit).toLowerCase(),
        build:String(source.build).trim()
      }),
      symbols:Object.freeze(selected),
      resources:Object.freeze(resources)
    }),
    report:Object.freeze({
      parsed:parsed.symbols.size,
      selected:Object.keys(selected).length,
      resources:Object.freeze(Object.keys(resources)),
      missing:Object.freeze(missing),
      diagnostics:parsed.diagnostics
    })
  });
}
