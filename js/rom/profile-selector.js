(function(global){
  "use strict";

  const GBA=Object.freeze([
    Object.freeze({value:"ruby",label:"Pokémon Ruby",code:"AXVE",profile:"gen3-ruby-en"}),
    Object.freeze({value:"sapphire",label:"Pokémon Sapphire",code:"AXPE",profile:"gen3-sapphire-en"}),
    Object.freeze({value:"emerald",label:"Pokémon Emerald",code:"BPEE",profile:"gen3-emerald-en"}),
    Object.freeze({value:"fire_red",label:"Pokémon FireRed",code:"BPRE",profile:"gen3-fire_red-en"}),
    Object.freeze({value:"leaf_green",label:"Pokémon LeafGreen",code:"BPGE",profile:"gen3-leaf_green-en"})
  ]);
  const CLASSIC=Object.freeze([
    Object.freeze({value:"red",label:"Pokémon Red",profile:"gen1-rgb-intl",platform:"Game Boy"}),
    Object.freeze({value:"blue",label:"Pokémon Blue",profile:"gen1-rgb-intl",platform:"Game Boy"}),
    Object.freeze({value:"crystal",label:"Pokémon Crystal",profile:"gen2-crystal-intl",platform:"Game Boy Color"})
  ]);

  class RomProfileSelector{
    static candidates(fileName=""){
      return /\.gba$/i.test(fileName)?GBA:CLASSIC;
    }
    static async choose(memory,fileName=""){
      const candidates=this.candidates(fileName),gba=candidates===GBA;
      const selected=await AppDialog.choose({
        title:"Choose the ROM hack base",
        message:"The cartridge header is not recognized. Select the original game whose engine this hack was built from.",
        detail:"This opens the ROM in safe byte-editing and emulator mode. Table editors stay locked until a matching symbol manifest verifies their relocated addresses.",
        choices:[
          ...candidates.map(candidate=>({value:candidate.value,label:candidate.label})),
          {value:null,label:"Cancel"}
        ]
      });
      const candidate=candidates.find(entry=>entry.value===selected);
      if(!candidate)throw new Error("ROM loading was cancelled because no base game was selected.");
      const version=gba&&memory.length>0xbc?memory[0xbc]:memory.length>0x14c?memory[0x14c]:0;
      return Object.freeze({
        family:gba?"gba":"gb",
        platform:gba?"Game Boy Advance":candidate.platform,
        base:candidate.value,
        name:candidate.label,
        lang:gba?"en":"intl",
        code:candidate.code||"USER-SELECTED",
        maker:"",
        title:"Unrecognized ROM hack",
        version,
        checksumValid:false,
        editorProfile:candidate.profile,
        selection:"user-base",
        profileConfidence:"engine-only",
        supported:true
      });
    }
  }

  global.RomProfileSelector=Object.freeze(RomProfileSelector);
})(globalThis);
