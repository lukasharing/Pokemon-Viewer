(function(global){
  "use strict";
  class RomExport{
    static changes(reader,current=reader?.ReadOnlyMemory){
      const original=reader?.OriginalMemory;
      if(!(original instanceof Uint8Array)||!(current instanceof Uint8Array)||original.length!==current.length)return[];
      const ranges=[];
      for(let offset=0;offset<current.length;){
        if(current[offset]===original[offset]){offset++;continue;}
        const start=offset,previous=[],next=[];
        while(offset<current.length&&current[offset]!==original[offset]){previous.push(original[offset]);next.push(current[offset]);offset++;}
        ranges.push({offset:start,length:offset-start,previous,next});
      }
      return ranges;
    }
    static snapshot(reader){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array))throw new Error("Load a ROM before exporting.");
      const bytes=reader.ReadOnlyMemory.slice(),liveRanges=this.changes(reader,bytes);
      const checksumBefore=liveRanges.length?RomChecksum.inspect(bytes,reader.family):null;
      const checksums=liveRanges.length?RomChecksum.repair(bytes,reader.family):checksumBefore;
      const ranges=this.changes(reader,bytes),pending=this.pending(reader);
      return Object.freeze({
        bytes,
        ranges:Object.freeze(ranges),
        pending:Object.freeze(pending),
        changedBytes:ranges.reduce((total,range)=>total+range.length,0),
        checksums:checksums?Object.freeze({before:checksumBefore,after:checksums}):null
      });
    }
    static filename(reader,suffix="edited"){
      const source=reader?.gamePath||`pokemon.${reader?.family==="gba"?"gba":"gbc"}`,dot=source.lastIndexOf("."),stem=dot>0?source.slice(0,dot):source,extension=dot>0?source.slice(dot):reader?.family==="gba"?".gba":".gbc";
      return`${stem}-${suffix}${extension}`;
    }
    static unsavedChanges(reader){
      const saved=reader?.SavedMemory;
      if(!(saved instanceof Uint8Array)||saved.length!==reader?.ReadOnlyMemory?.length)return this.changes(reader);
      return this.changes({OriginalMemory:saved},reader.ReadOnlyMemory);
    }
    static summary(reader){
      const ranges=this.unsavedChanges(reader),pending=this.pending(reader);
      return Object.freeze({ranges:ranges.length,bytes:ranges.reduce((total,range)=>total+range.length,0),pending:Object.freeze(pending),byteDirty:ranges.length>0,dirty:ranges.length>0||pending.length>0});
    }
    static markSaved(reader){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array))throw new Error("Load a ROM before creating a save checkpoint.");
      reader.SavedMemory=reader.ReadOnlyMemory.slice();
      if(typeof global.CustomEvent==="function")global.document?.dispatchEvent?.(new CustomEvent("editorsaved",{detail:{reader}}));
      return reader.SavedMemory;
    }
    static pending(reader){
      return reader?.drafts?.pending?.()||Object.freeze([]);
    }
    static async confirmDiscard(reader,{title="Replace the loaded ROM?",message}={}){
      const summary=this.summary(reader);if(!summary.dirty)return true;
      const byteMessage=summary.byteDirty?`${summary.bytes} changed ${summary.bytes===1?"byte":"bytes"} across ${summary.ranges} ${summary.ranges===1?"region":"regions"}`:"no applied byte changes";
      const draftMessage=summary.pending.length?` and ${summary.pending.length} unapplied editor ${summary.pending.length===1?"draft":"drafts"}`:"";
      return AppDialog.confirm({
        title,
        message:message||`The current project has ${byteMessage}${draftMessage}.`,
        detail:"Download the edited ROM first if you want to keep these changes.",
        confirmLabel:"Discard and replace",cancelLabel:"Keep current ROM",danger:true
      });
    }
    static async confirmWithoutDrafts(pending,artifact){
      if(!pending.length)return true;
      return AppDialog.confirm({
        title:"Unapplied editor drafts",
        message:`${pending.length} unapplied editor ${pending.length===1?"draft is":"drafts are"} not part of ROM memory yet.`,
        detail:`Apply ${pending.length===1?"it":"them"} first to include ${pending.length===1?"it":"them"} in the ${artifact}, or continue with applied byte changes only.`,
        confirmLabel:`Create ${artifact} without drafts`,
        cancelLabel:"Return to editor"
      });
    }
    static downloadBytes(bytes,filename,type="application/octet-stream"){
      const url=URL.createObjectURL(new Blob([bytes],{type})),link=document.createElement("a");
      link.href=url;link.download=filename;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    }
    static async rom(reader){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array))throw new Error("Load a ROM before exporting.");
      const pending=this.pending(reader);
      if(!await this.confirmWithoutDrafts(pending,"ROM"))return false;
      const snapshot=this.snapshot(reader);
      const validation=ProjectValidator.assertExportable(reader,{snapshot});
      if(!snapshot.ranges.length&&!pending.length){
        const proceed=await AppDialog.confirm({title:"Export unchanged ROM?",message:"No byte changes are currently applied. The downloaded file will match the loaded ROM.",confirmLabel:"Download copy",cancelLabel:"Cancel"});
        if(!proceed)return false;
      }
      this.downloadBytes(snapshot.bytes,this.filename(reader));
      this.markSaved(reader);
      const excluded=snapshot.pending.length?` · ${snapshot.pending.length} unapplied ${snapshot.pending.length===1?"draft":"drafts"} excluded`:"";
      const warnings=validation.warnings.length?` · ${validation.warnings.length} validation ${validation.warnings.length===1?"warning":"warnings"}`:"";
      NotificationHandler.pop("ROM exported",`${this.filename(reader)} · ${snapshot.changedBytes} changed bytes${excluded}${warnings}`,NotificationType.SUCCESS);
      return true;
    }
    static async report(reader){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array))throw new Error("Load a ROM before exporting.");
      const pending=this.pending(reader);
      if(!await this.confirmWithoutDrafts(pending,"change report"))return false;
      const snapshot=this.snapshot(reader),payload={
        format:"push-byte-patch",version:4,source:reader.gamePath,family:reader.family,project:ProjectIdentity.capture(reader),
        capabilityManifest:reader.capabilities?{
          id:reader.capabilities.id,
          fingerprint:reader.capabilities.fingerprint,
          provenance:reader.capabilities.provenance,
          workspaces:Object.fromEntries(CapabilityManifest.WORKSPACES.map(id=>{
            const capability=reader.capabilities.get(id);
            return[id,{state:capability.state,writable:capability.writable,reason:capability.reason,evidence:capability.evidence,resources:capability.resources}];
          }))
        }:null,
        changedBytes:snapshot.changedBytes,
        validation:ProjectValidator.assertExportable(reader,{snapshot}),
        checksums:snapshot.checksums,
        excludedDrafts:snapshot.pending.map(item=>Object.fromEntries(Object.entries(item).map(([key,value])=>[key,key==="offset"&&Number.isInteger(value)?`0x${value.toString(16).toUpperCase()}`:value]))),
        ranges:snapshot.ranges.map(range=>({offset:`0x${range.offset.toString(16).toUpperCase()}`,length:range.length,previous:range.previous.map(byte=>byte.toString(16).padStart(2,"0")).join(" "),next:range.next.map(byte=>byte.toString(16).padStart(2,"0")).join(" ")}))
      };
      this.downloadBytes(new TextEncoder().encode(JSON.stringify(payload,null,2)),`${this.filename(reader,"changes").replace(/\.(gba|gbc|gb)$/i,"")}.json`,"application/json");
      return payload;
    }
    static async importReport(reader,file){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array))throw new Error("Load a ROM before importing.");
      if(this.pending(reader).length)throw new Error("Apply or revert every editor draft before importing a change report.");
      if(!file||typeof file.text!=="function")throw new TypeError("Choose a PUSH JSON change report.");
      let payload;
      try{payload=JSON.parse(await file.text());}
      catch(error){throw new SyntaxError(`The selected change report is not valid JSON: ${error.message}`);}
      const plan=RomPatch.apply(reader,payload);
      NotificationHandler.pop("Change report imported",`${plan.total} verified ${plan.total===1?"byte":"bytes"} applied as one reversible project command.`,NotificationType.SUCCESS);
      return plan;
    }
  }
  global.RomExport=RomExport;((global.PokemonViewer ||= {}).core ||= {}).RomExport=RomExport;
})(globalThis);
