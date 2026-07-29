(function(global){
  "use strict";

  const POKEMON_TITLES = [
    ["POKEMON RED", "red", "Pokémon Red"],
    ["POKEMON BLUE", "blue", "Pokémon Blue"],
    ["POKEMON YELLOW", "yellow", "Pokémon Yellow"],
    ["POKEMON GOLD", "gold", "Pokémon Gold"],
    ["POKEMON SILVER", "silver", "Pokémon Silver"],
    ["POKEMON CRYSTAL", "crystal", "Pokémon Crystal"]
  ];

  const ascii = (memory, start, end) => String.fromCharCode(...memory.slice(start, end)).replace(/[\0 ]+$/, "").trim();

  const headerChecksum = (memory) => {
    let checksum = 0;
    for(let offset = 0x134; offset <= 0x14C; offset++) checksum = (checksum - memory[offset] - 1) & 0xFF;
    return checksum === memory[0x14D];
  };

  global.GbRomDetector = Object.freeze({
    detect(memory){
      if(!(memory instanceof Uint8Array) || memory.length < 0x150) return null;

      const colorFlag = memory[0x143];
      const titleEnd = colorFlag === 0x80 || colorFlag === 0xC0 ? 0x143 : 0x144;
      const title = ascii(memory, 0x134, titleEnd);
      const match = POKEMON_TITLES.find(([prefix]) => title.startsWith(prefix));
      if(!match) return null;

      const colorCapable = colorFlag === 0x80 || colorFlag === 0xC0;
      const japanese = memory[0x14A] === 0;
      const editorProfile=!japanese&&["red","blue"].includes(match[1])
        ?"gen1-rgb-intl"
        :!japanese&&match[1]==="crystal"&&memory[0x14c]<=1
          ?"gen2-crystal-intl"
          :null;
      const workspaces=editorProfile==="gen2-crystal-intl"
        ?["hex_editor","code_workspace","map_editor","sprite_editor","battle_editor","pokedex_editor","sound_editor","animation_editor"]
        :editorProfile?["hex_editor","code_workspace","map_editor","sprite_editor","battle_editor","pokedex_editor","sound_editor","animation_editor"]:["hex_editor"];
      return Object.freeze({
        family: "gb",
        platform: colorCapable ? "Game Boy Color" : "Game Boy",
        base: match[1],
        name: match[2],
        lang: japanese ? "jp" : "intl",
        code: title,
        maker: ascii(memory, 0x144, 0x146),
        title,
        version: memory[0x14C],
        checksumValid: headerChecksum(memory),
        editorProfile,
        workspaces:Object.freeze(workspaces),
        supported:Boolean(editorProfile),
        unsupportedReason:editorProfile?null:`${match[2]} ${japanese?"Japanese":"uses a ROM structure or revision"} that is recognized but not yet supported by the semantic editors. Supported classic games: international Pokémon Red/Blue and Crystal revisions 0–1.`
      });
    }
  });
})(globalThis);
