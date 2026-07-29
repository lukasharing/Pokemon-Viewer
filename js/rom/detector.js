(function(global){
  "use strict";

  global.PokemonRomDetector = Object.freeze({
    async detect(memory, fileName = ""){
      const extension = fileName.split(".").pop().toLowerCase();
      const isGba = extension === "gba";
      const detectorPath = isGba ? "js/rom/gba-detector.js?v=3" : "js/rom/gb-detector.js?v=3";
      await AssetLoader.loadScript(detectorPath);
      const detector = isGba ? global.GbaRomDetector : global.GbRomDetector;
      const result = detector.detect(memory);
      if(result?.supported===false)throw new Error(result.unsupportedReason);
      if(result){
        const fingerprint=await RomFingerprint.sha1(memory);
        return Object.freeze({...result,fingerprint});
      }
      throw new Error("This is not a supported Pokémon GB, GBC, or GBA ROM.");
    }
  });
})(globalThis);
