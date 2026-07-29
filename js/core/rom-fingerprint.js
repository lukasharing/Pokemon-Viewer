(function(global){
  "use strict";
  const hex=buffer=>Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,"0")).join("");
  const sha1=async bytes=>{
    if(!(bytes instanceof Uint8Array))throw new TypeError("ROM fingerprinting expects Uint8Array bytes.");
    if(!global.crypto?.subtle)throw new Error("This browser cannot verify the ROM fingerprint.");
    return hex(await global.crypto.subtle.digest("SHA-1",bytes));
  };
  global.RomFingerprint=Object.freeze({hex,sha1});
  ((global.PokemonViewer||={}).core||={}).RomFingerprint=global.RomFingerprint;
})(globalThis);
