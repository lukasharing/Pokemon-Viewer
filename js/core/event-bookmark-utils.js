(function(global){
  "use strict";

  const IGNORED=new Set([
    "offset","sourceOffset","size","eventIndex","eventType","index","x","y",
    "scriptOffset","scriptPointer","textAddress","textPointer","textPreview",
    "textCommand","textScriptPointer","spriteOffset","spritePointer"
  ]);

  /**
   * Stable references for events inside an already identified map. Physical
   * addresses and coordinates are excluded so relocation and movement remain
   * compatible with the bookmark.
   */
  class EventBookmarkUtils{
    static fingerprint(event){
      const source={...(event?.properties||{}),...(event||{})};
      const values=Object.entries(source)
        .filter(([key,value])=>!key.startsWith("$")&&!IGNORED.has(key)&&["string","number","boolean"].includes(typeof value))
        .sort(([left],[right])=>left.localeCompare(right));
      return JSON.stringify(values);
    }

    static create(event,{type=event?.eventType,index=event?.eventIndex}={}){
      if(event===null||event===undefined||type===undefined||!Number.isInteger(index))return null;
      return Object.freeze({type,index,fingerprint:this.fingerprint(event)});
    }

    static resolve(records,reference){
      if(!reference||!Array.isArray(records))return null;
      const sameType=records.filter(record=>record.type===reference.type);
      const indexed=sameType.find(record=>record.index===reference.index);
      if(!reference.fingerprint)return indexed||null;
      if(indexed&&this.fingerprint(indexed.event)===reference.fingerprint)return indexed;
      const matches=sameType.filter(record=>this.fingerprint(record.event)===reference.fingerprint);
      return matches.length===1?matches[0]:null;
    }
  }

  global.EventBookmarkUtils=EventBookmarkUtils;
  ((global.PokemonViewer||={}).core||={}).EventBookmarkUtils=EventBookmarkUtils;
})(globalThis);
