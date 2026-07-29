(function(global){
  "use strict";

  const GAMES = {
    AXV: {base: "ruby", name: "Pokémon Ruby"},
    AXP: {base: "sapphire", name: "Pokémon Sapphire"},
    BPE: {base: "emerald", name: "Pokémon Emerald"},
    BPR: {base: "fire_red", name: "Pokémon FireRed"},
    BPG: {base: "leaf_green", name: "Pokémon LeafGreen"}
  };

  const LANGUAGES = {E: "en", S: "es", J: "jp"};
  const ascii = (memory, start, end) => String.fromCharCode(...memory.slice(start, end)).replace(/\0+$/, "").trim();
  const headerChecksum = memory => {
    let sum=0;for(let offset=0xa0;offset<=0xbc;offset++)sum=(sum+memory[offset])&0xff;
    return((0x100-(sum+0x19))&0xff)===memory[0xbd];
  };

  global.GbaRomDetector = Object.freeze({
    detect(memory){
      if(!(memory instanceof Uint8Array) || memory.length < 0xC0) return null;

      const title = ascii(memory, 0xA0, 0xAC);
      const code = ascii(memory, 0xAC, 0xB0);
      const game = GAMES[code.slice(0, 3)];
      if(!game) return null;

      const lang = LANGUAGES[code.slice(3, 4)];
      if(!lang) throw new Error(`The ${code.slice(3, 4) || "unknown"} GBA language/region is not configured yet.`);

      return Object.freeze({
        ...game,
        family: "gba",
        platform: "Game Boy Advance",
        lang,
        code,
        maker: ascii(memory, 0xB0, 0xB2),
        title,
        version: memory[0xBC],
        checksumValid: headerChecksum(memory),
        editorProfile:`gen3-${game.base}-${lang}`,
        workspaces:Object.freeze(["hex_editor","code_workspace","map_editor","sprite_editor","battle_editor","pokedex_editor","sound_editor","animation_editor","emulator_editor"]),
        supported:true
      });
    }
  });
})(globalThis);
