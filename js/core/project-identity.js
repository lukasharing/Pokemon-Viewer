(function(global){
  "use strict";

  /**
   * Stable identity attached to persistent editor locations.
   * ROM filenames are deliberately excluded: compatibility follows the
   * detected structure profile, game, language and revision.
   */
  class ProjectIdentity{
    static capture(reader){
      if(!(reader?.ReadOnlyMemory instanceof Uint8Array)||!reader.family)return null;
      const identity={
        family:reader.family,
        profile:reader.editorProfile||reader.family,
        game:reader.type||"",
        lang:reader.lang||"",
        revision:String(reader.version??"")
      };
      if(reader.fingerprint)identity.fingerprint=reader.fingerprint;
      identity.label=[identity.game.replaceAll("_"," "),identity.lang&&identity.lang.toUpperCase(),identity.revision!==""&&`Rev ${identity.revision}`].filter(Boolean).join(" · ");
      return Object.freeze(identity);
    }

    static assertCompatible(saved,reader){
      const current=this.capture(reader);
      if(!current)throw new Error("Load a ROM before opening a bookmark.");
      // Bookmarks made by older PUSH builds only carried family.
      if(!saved){
        return current;
      }
      const labels={family:"platform family",profile:"editor profile",game:"game",lang:"language",revision:"revision",fingerprint:"ROM fingerprint"};
      for(const key of Object.keys(labels)){
        if(saved[key]===undefined||saved[key]===null||saved[key]==="")continue;
        if(String(saved[key])!==String(current[key]))throw new Error(`This bookmark belongs to a different ${labels[key]} (${saved.label||saved.game||saved.profile||saved.family}).`);
      }
      return current;
    }
  }

  global.ProjectIdentity=ProjectIdentity;
  ((global.PokemonViewer||={}).core||={}).ProjectIdentity=ProjectIdentity;
})(globalThis);
