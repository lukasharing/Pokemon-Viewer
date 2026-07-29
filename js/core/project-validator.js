(function(global){
  "use strict";

  const LEVELS=new Set(["error","warning","info"]);
  const CATEGORIES=Object.freeze(["schema","domain","graph","allocation","export"]);

  const diagnostic=(category,level,code,message,detail=null)=>{
    if(!CATEGORIES.includes(category))throw new TypeError(`Unknown validation category '${category}'.`);
    if(!LEVELS.has(level))throw new TypeError(`Unknown validation level '${level}'.`);
    return Object.freeze({
      category,level,code:String(code),message:String(message),
      detail:detail==null?null:String(detail)
    });
  };

  class ValidationRegistry{
    constructor(){this.providers=new Map();}
    register(id,provider){
      if(typeof id!=="string"||!id.trim())throw new TypeError("A validator requires a stable ID.");
      if(typeof provider!=="function")throw new TypeError(`Validator '${id}' must be a function.`);
      if(this.providers.has(id))throw new Error(`Validator '${id}' is already registered.`);
      this.providers.set(id,provider);
      return()=>this.providers.delete(id);
    }
    set(id,provider){
      if(typeof id!=="string"||!id.trim())throw new TypeError("A validator requires a stable ID.");
      if(typeof provider!=="function")throw new TypeError(`Validator '${id}' must be a function.`);
      this.providers.set(id,provider);
      return()=>{if(this.providers.get(id)===provider)this.providers.delete(id);};
    }
    entries(){return Object.freeze([...this.providers.entries()]);}
    clear(){this.providers.clear();}
  }

  class ProjectValidator{
    static categories=CATEGORIES;
    static registerDomain(reader,id,provider){
      if(!(reader?.validation instanceof ValidationRegistry))return()=>{};
      return reader.validation.set(id,provider);
    }

    static validate(reader,{snapshot=null}={}){
      const diagnostics=[];
      const add=(category,level,code,message,detail)=>diagnostics.push(diagnostic(category,level,code,message,detail));
      const current=reader?.ReadOnlyMemory;
      const original=reader?.OriginalMemory;
      const bytes=snapshot?.bytes||current;

      if(!(current instanceof Uint8Array))add("schema","error","ROM_NOT_LOADED","No ROM byte view is loaded.");
      if(!(original instanceof Uint8Array))add("schema","error","SOURCE_MISSING","The immutable source snapshot is missing.");
      if(current instanceof Uint8Array&&original instanceof Uint8Array&&current.length!==original.length){
        add("schema","error","SOURCE_SIZE_MISMATCH","The editable ROM and immutable source have different sizes.");
      }
      if(!(bytes instanceof Uint8Array))add("export","error","EXPORT_BYTES_MISSING","The export snapshot has no byte payload.");
      if(bytes instanceof Uint8Array&&current instanceof Uint8Array&&bytes.length!==current.length){
        add("export","error","EXPORT_SIZE_MISMATCH","The export snapshot size differs from the loaded ROM.");
      }
      if(!["gb","gbc","gba"].includes(reader?.family)){
        add("schema","error","FAMILY_UNKNOWN","The loaded ROM has no supported platform family.");
      }
      if(!reader?.editorProfile)add("schema","warning","PROFILE_UNKNOWN","No exact editor profile is attached to this project.");

      const providers=reader?.validation?.entries?.()||[];
      for(const [id,provider] of providers){
        try{
          const result=provider({reader,bytes,snapshot,diagnostic})||[];
          if(!Array.isArray(result))throw new TypeError("provider must return an array");
          for(const item of result){
            add("domain",item.level||"error",item.code||`DOMAIN_${id}`,item.message||`Domain validator '${id}' failed.`,item.detail);
          }
        }catch(error){
          add("domain","error",`DOMAIN_${id}_FAILED`,`Domain validator '${id}' could not complete.`,error.message);
        }
      }

      const graph=reader?.resourceGraph;
      if(graph){
        try{
          const result=graph.validate();
          for(const unresolved of result.unresolved||[]){
            add("graph","warning","UNRESOLVED_REFERENCE",`Resource reference '${unresolved.edgeId}' is unresolved.`,`${unresolved.source}.${unresolved.field}: ${unresolved.reason}`);
          }
        }catch(error){
          add("graph","error","GRAPH_INVALID","The resource graph could not be validated.",error.message);
        }
      }else add("graph","warning","GRAPH_MISSING","No resource graph is available for this project.");

      if(reader?.memory&&typeof global.AllocationLedger==="function"){
        try{
          const ranges=AllocationLedger.forMemory(reader.memory).snapshot().slice().sort((a,b)=>a.offset-b.offset||a.length-b.length);
          for(let index=0;index<ranges.length;index++){
            const range=ranges[index],end=range.offset+range.length;
            if(range.offset<0||range.length<1||end>reader.memory.size){
              add("allocation","error","ALLOCATION_OUT_OF_BOUNDS",`Allocation '${range.owner}' is outside ROM bounds.`);
            }
            const next=ranges[index+1];
            if(next&&next.offset<end){
              add("allocation","error","ALLOCATION_OVERLAP",`Allocation '${range.owner}' overlaps '${next.owner}'.`);
            }
          }
        }catch(error){
          add("allocation","error","ALLOCATION_INVALID","The allocation ledger could not be validated.",error.message);
        }
      }else add("allocation","warning","ALLOCATION_LEDGER_MISSING","No allocation ledger is available for this project.");

      if(bytes instanceof Uint8Array&&["gb","gbc","gba"].includes(reader?.family)){
        const checksums=RomChecksum.inspect(bytes,reader.family);
        if(!checksums)add("export","error","CHECKSUM_UNAVAILABLE","The ROM is too small for its platform header.");
        else{
          if(checksums.header&&!checksums.header.valid)add("export","error","HEADER_CHECKSUM_INVALID","The export header checksum is invalid.");
          if(checksums.global&&!checksums.global.valid)add("export","error","GLOBAL_CHECKSUM_INVALID","The export global checksum is invalid.");
        }
      }
      if(snapshot){
        const ranges=snapshot.ranges||[];
        const total=ranges.reduce((sum,range)=>sum+Number(range.length||0),0);
        if(total!==snapshot.changedBytes)add("export","error","CHANGE_COUNT_INVALID","Changed-byte totals do not match the export ranges.");
        let previousEnd=-1;
        for(const range of ranges){
          if(!Number.isInteger(range.offset)||!Number.isInteger(range.length)||range.length<1||range.offset<previousEnd){
            add("export","error","CHANGE_RANGE_INVALID","Export change ranges are malformed or overlap.");
            break;
          }
          previousEnd=range.offset+range.length;
        }
      }

      const errors=diagnostics.filter(item=>item.level==="error");
      const warnings=diagnostics.filter(item=>item.level==="warning");
      return Object.freeze({
        version:1,
        valid:errors.length===0,
        categories:CATEGORIES,
        errors:Object.freeze(errors),
        warnings:Object.freeze(warnings),
        diagnostics:Object.freeze(diagnostics)
      });
    }

    static assertExportable(reader,options={}){
      const report=this.validate(reader,options);
      if(report.valid)return report;
      const summary=report.errors.slice(0,3).map(item=>item.message).join(" ");
      const error=new Error(`Project validation blocked export: ${summary}`);
      error.name="ProjectValidationError";
      error.validation=report;
      throw error;
    }
  }

  global.ValidationRegistry=ValidationRegistry;
  global.ProjectValidator=ProjectValidator;
  const core=((global.PokemonViewer||={}).core||={});
  core.ValidationRegistry=ValidationRegistry;
  core.ProjectValidator=ProjectValidator;
})(globalThis);
