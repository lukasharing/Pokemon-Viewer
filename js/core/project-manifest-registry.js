(function(global){
  "use strict";

  const STORAGE_KEY="push.project.source-manifests.v1";
  const FINGERPRINT=/^[0-9a-f]{40}$/;
  const SYMBOL=/^[A-Za-z_.$][A-Za-z0-9_.$]*$/;
  const RESOURCE=/^[A-Za-z][A-Za-z0-9_-]*$/;
  const SYMBOL_KINDS=new Set(["unknown","table","pointer","code","graphics","audio","text","data"]);
  const POINTER_KINDS=new Set(["none","gba32","gb16","gb-far","bank","relative","unknown"]);
  const OWNERSHIP=new Set(["unknown","root","exclusive","shared","pointer-table"]);
  const SOURCE_METHODS=new Set(["source-build","manual","mixed"]);
  const browserStorage=()=>{
    try{return global.localStorage||null;}
    catch{return null;}
  };
  const isObject=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const freeze=value=>{
    if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
    for(const item of Object.values(value))freeze(item);
    return Object.freeze(value);
  };
  const text=(value,label,{nullable=false}={})=>{
    if(nullable&&value==null)return null;
    if(typeof value!=="string"||!value.trim())throw new TypeError(`${label} must be a non-empty string.`);
    return value.trim();
  };
  const fingerprint=value=>{
    const normalized=String(value||"").trim().toLowerCase();
    if(!FINGERPRINT.test(normalized))throw new TypeError("Manifest fingerprint must be a complete lowercase SHA-1.");
    return normalized;
  };
  const integer=(value,label,{min=0,max=Number.MAX_SAFE_INTEGER,optional=false}={})=>{
    if(optional&&value==null)return null;
    if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
    return value;
  };

  class ProjectManifestRegistry{
    constructor({storage=browserStorage()}={}){
      this.storage=storage||null;
      this.manifests=new Map();
      this.restore();
    }
    validate(input,{fingerprint:expectedFingerprint=null,profile=null,platform=null,romSize=null}={}){
      if(!isObject(input))throw new TypeError("A PUSH source manifest must be a JSON object.");
      if(input.schemaVersion!==1)throw new TypeError(`Unsupported source manifest schema '${input.schemaVersion}'.`);
      const actualFingerprint=fingerprint(input.fingerprint);
      if(expectedFingerprint&&actualFingerprint!==fingerprint(expectedFingerprint))throw new Error("The manifest fingerprint does not match the loaded ROM.");
      const actualPlatform=text(input.platform,"Manifest platform").toLowerCase();
      if(!["gb","gba"].includes(actualPlatform))throw new TypeError("Manifest platform must be 'gb' or 'gba'.");
      if(platform&&actualPlatform!==String(platform).toLowerCase())throw new Error(`The manifest targets ${actualPlatform}, not the loaded ${platform} ROM.`);
      const engineProfile=text(input.engineProfile||input.profile,"Manifest engine profile");
      if(profile&&engineProfile!==profile)throw new Error(`The manifest targets '${engineProfile}', not the selected '${profile}' engine.`);
      if(!isObject(input.source))throw new TypeError("Manifest source provenance is required.");
      const sourceMethod=text(input.source.method||"source-build","Manifest source method").toLowerCase();
      if(!SOURCE_METHODS.has(sourceMethod))throw new TypeError("Manifest source method must be 'source-build', 'manual' or 'mixed'.");
      const source={
        repository:text(input.source.repository,"Manifest source repository"),
        commit:text(input.source.commit,"Manifest source commit",{nullable:sourceMethod==="manual"}),
        method:sourceMethod,
        build:text(input.source.build,"Manifest source build")
      };
      if(source.commit&&!FINGERPRINT.test(source.commit.toLowerCase()))throw new TypeError("Manifest source commit must be a complete 40-character hexadecimal commit.");
      if(!isObject(input.symbols)||!Object.keys(input.symbols).length)throw new TypeError("A project manifest must contain at least one source symbol.");
      const maxOffset=Number.isSafeInteger(romSize)&&romSize>0?romSize-1:Number.MAX_SAFE_INTEGER;
      const symbols={};
      for(const [name,entry] of Object.entries(input.symbols)){
        if(!SYMBOL.test(name)||!isObject(entry))throw new TypeError(`Invalid source symbol '${name}'.`);
        const symbol={offset:integer(entry.offset,`Symbol '${name}' offset`,{max:maxOffset})};
        if(entry.address!=null)symbol.address=integer(entry.address,`Symbol '${name}' address`);
        if(entry.bank!=null)symbol.bank=integer(entry.bank,`Symbol '${name}' bank`,{max:0xffff});
        if(entry.extent!=null){
          symbol.extent=integer(entry.extent,`Symbol '${name}' extent`,{min:1});
          if(Number.isSafeInteger(romSize)&&symbol.offset+symbol.extent>romSize)throw new RangeError(`Symbol '${name}' extent exceeds the loaded ROM.`);
        }
        for(const field of ["count","stride"]){
          if(entry[field]!=null)symbol[field]=integer(entry[field],`Symbol '${name}' ${field}`,{min:1});
        }
        if(symbol.extent!=null&&symbol.count!=null&&symbol.stride!=null&&symbol.count*symbol.stride>symbol.extent){
          throw new RangeError(`Symbol '${name}' count × stride exceeds its byte extent.`);
        }
        const kind=text(entry.kind||"unknown",`Symbol '${name}' kind`).toLowerCase();
        if(!SYMBOL_KINDS.has(kind))throw new TypeError(`Symbol '${name}' has unsupported kind '${kind}'.`);
        symbol.kind=kind;
        symbol.pointerKind=text(entry.pointerKind||"unknown",`Symbol '${name}' pointer kind`).toLowerCase();
        if(!POINTER_KINDS.has(symbol.pointerKind))throw new TypeError(`Symbol '${name}' has unsupported pointer kind '${symbol.pointerKind}'.`);
        symbol.ownership=text(entry.ownership||"unknown",`Symbol '${name}' ownership`).toLowerCase();
        if(!OWNERSHIP.has(symbol.ownership))throw new TypeError(`Symbol '${name}' has unsupported ownership '${symbol.ownership}'.`);
        symbol.origin=text(entry.origin||"source-build",`Symbol '${name}' origin`).toLowerCase();
        if(!["source-build","manual"].includes(symbol.origin))throw new TypeError(`Symbol '${name}' origin must be 'source-build' or 'manual'.`);
        symbol.format=text(entry.format||(actualPlatform==="gba"?"gnu":"rgbds"),`Symbol '${name}' format`);
        if(entry.notes!=null)symbol.notes=text(entry.notes,`Symbol '${name}' notes`);
        symbols[name]=symbol;
      }
      if(!isObject(input.resources))throw new TypeError("A project manifest must define its resource groups.");
      if(sourceMethod==="source-build"&&!Object.keys(input.resources).length)throw new TypeError("A source-build manifest must group symbols into resources.");
      const resources={};
      for(const [id,entry] of Object.entries(input.resources)){
        if(!RESOURCE.test(id)||!isObject(entry))throw new TypeError(`Invalid manifest resource '${id}'.`);
        const selected=entry.symbols;
        if(!Array.isArray(selected)||!selected.length)throw new TypeError(`Resource '${id}' must select at least one symbol.`);
        const unique=[...new Set(selected.map(name=>text(name,`Resource '${id}' symbol`)))];
        const missing=unique.filter(name=>!symbols[name]);
        if(missing.length)throw new Error(`Resource '${id}' references unselected symbols: ${missing.join(", ")}.`);
        resources[id]={
          coverage:text(entry.coverage,`Resource '${id}' coverage`),
          symbols:unique,
          notes:entry.notes==null?null:text(entry.notes,`Resource '${id}' notes`)
        };
      }
      return freeze({
        schemaVersion:1,
        profile:text(input.profile,"Manifest profile"),
        engineProfile,
        fingerprint:actualFingerprint,
        platform:actualPlatform,
        source,
        symbols,
        resources
      });
    }
    register(input,options={}){
      const manifest=this.validate(input,options);
      this.manifests.set(manifest.fingerprint,manifest);
      this.persist();
      return manifest;
    }
    upsertManualSymbol({
      fingerprint:manifestFingerprint,profile,engineProfile,platform,source=null,
      name,entry,template=null
    }={},options={}){
      const key=fingerprint(manifestFingerprint);
      const previous=this.get(key);
      const symbolName=text(name,"Manual symbol name");
      if(!SYMBOL.test(symbolName))throw new TypeError(`Invalid source symbol '${symbolName}'.`);
      const targetPlatform=String(platform||previous?.platform||"").toLowerCase();
      const targetEngine=text(engineProfile||previous?.engineProfile,"Manual symbol engine profile");
      const targetProfile=text(profile||previous?.profile||`${targetEngine}-manual`,"Manual symbol project profile");
      const symbols={
        ...(previous?.symbols||{}),
        [symbolName]:{
          ...entry,
          origin:"manual",
          kind:entry?.kind||"unknown",
          format:entry?.format||(targetPlatform==="gba"?"gnu":"rgbds")
        }
      };
      const resources={...(previous?.resources||{})};
      for(const [id,definition] of Object.entries(template?.resources||{})){
        const required=[...(definition.symbols||[])];
        if(!required.length||required.some(requiredName=>!symbols[requiredName])){
          delete resources[id];
          continue;
        }
        resources[id]={
          coverage:definition.coverage||"declared-roots",
          symbols:required,
          notes:"Exact addresses declared for this ROM fingerprint; structural operation audit pending."
        };
      }
      const previousMethod=previous?.source?.method||"source-build";
      const sourceMethod=previous?previousMethod==="manual"?"manual":"mixed":"manual";
      return this.register({
        schemaVersion:1,
        profile:targetProfile,
        engineProfile:targetEngine,
        fingerprint:key,
        platform:targetPlatform,
        source:previous?{...previous.source,method:sourceMethod}:{
          repository:source?.repository||`manual/${targetEngine}`,
          commit:null,
          method:"manual",
          build:source?.build||"Manual ROM dictionary"
        },
        symbols,
        resources
      },options);
    }
    async importFile(file,options={}){
      if(!file||typeof file.text!=="function")throw new TypeError("Choose a PUSH JSON source manifest.");
      let payload;
      try{payload=JSON.parse(await file.text());}
      catch(error){throw new SyntaxError(`The selected source manifest is not valid JSON: ${error.message}`);}
      return this.register(payload,options);
    }
    get(value){
      try{return this.manifests.get(fingerprint(value))||null;}
      catch{return null;}
    }
    resolve(value,options={}){
      const manifest=this.get(value);
      if(!manifest)return null;
      try{return this.validate(manifest,{...options,fingerprint:value});}
      catch{return null;}
    }
    has(value){return Boolean(this.get(value));}
    remove(value){
      const key=fingerprint(value),removed=this.manifests.delete(key);
      if(removed)this.persist();
      return removed;
    }
    all(){return Object.freeze([...this.manifests.values()]);}
    persist(){
      if(!this.storage)return;
      try{this.storage.setItem(STORAGE_KEY,JSON.stringify([...this.manifests.values()]));}catch{}
    }
    restore(){
      if(!this.storage)return this;
      let entries=[];
      try{entries=JSON.parse(this.storage.getItem(STORAGE_KEY)||"[]");}catch{}
      if(!Array.isArray(entries))return this;
      for(const entry of entries){
        try{
          const manifest=this.validate(entry);
          this.manifests.set(manifest.fingerprint,manifest);
        }catch{}
      }
      return this;
    }
    export(value){
      const manifest=this.get(value);
      return manifest?clone(manifest):null;
    }
  }

  const registry=new ProjectManifestRegistry();
  global.ProjectManifestRegistry=registry;
  global.ProjectManifestRegistryClass=ProjectManifestRegistry;
  ((global.PokemonViewer||={}).core||={}).projectManifests=registry;
})(globalThis);
