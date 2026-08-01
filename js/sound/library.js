(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={});
  ns.sound||={};
  ns.sound.registry=ns.sound.registry||new DriverRegistry("Sound");

  const COVERAGE_STATES=Object.freeze(["unavailable","reference","partial","verified"]);
  class SoundCoverage {
    constructor(values={}){
      const normalized={catalog:"reference",program:"unavailable",audio:"unavailable",writing:"unavailable",...values};
      for(const [key,value] of Object.entries(normalized))if(!COVERAGE_STATES.includes(value))throw new TypeError(`Invalid sound coverage ${key}: ${value}.`);
      Object.assign(this,normalized);Object.freeze(this);
    }
    static from(document,detail={}){
      if(detail.coverage instanceof SoundCoverage)return detail.coverage;
      const hasProgram=Boolean(detail.tracks?.length||detail.commands?.length),hasAudio=Boolean(detail.waveform?.native&&detail.waveform.samples?.length);
      return new SoundCoverage({
        catalog:document?.accuracy==="verified"?"verified":"reference",
        program:hasProgram?(detail.commands?.every(command=>command.accuracy==="verified")?"verified":"partial"):"unavailable",
        audio:hasAudio?"verified":"unavailable",
        writing:document?.editable?"verified":"unavailable"
      });
    }
  }

  class SoundDocument {
    constructor(values={}){
      Object.assign(this,{id:0,name:"Untitled sound",kind:"sound",family:"",source:"",accuracy:"partial",offset:null,tracks:[],commands:[],voices:[],references:[],metadata:{},editable:false,...values});
      this.tracks=Object.freeze(Array.from(this.tracks));
      this.commands=Object.freeze(Array.from(this.commands));
      this.voices=Object.freeze(Array.from(this.voices));
      this.references=Object.freeze(Array.from(this.references));
      this.metadata=Object.freeze({...this.metadata});
      Object.freeze(this);
    }
  }

  class SoundTrack {
    constructor(values={}){Object.assign(this,{index:0,offset:null,commands:[],channel:"unknown"},values);this.commands=Object.freeze(Array.from(this.commands));Object.freeze(this);}
  }

  class SoundCommand {
    constructor(values={}){Object.assign(this,{offset:null,opcode:0,name:"data",arguments:[],tick:0,accuracy:"partial"},values);this.arguments=Object.freeze(Array.from(this.arguments));Object.freeze(this);}
  }

  const labels=Object.freeze({song:"Song",cry:"Pokémon cry",sfx:"Sound effect",sample:"Sample",instrument:"Instrument"});
  const groups=Object.freeze({all:"All sound documents",cry:"Pokémon cries",map:"Map music references",music:"Music catalog",sfx:"Sound effects",system:"System / engine references",unclassified:"Unclassified native tracks"});
  ns.sound.SoundDocument=SoundDocument;
  ns.sound.SoundCoverage=SoundCoverage;
  ns.sound.SoundTrack=SoundTrack;
  ns.sound.SoundCommand=SoundCommand;
  ns.sound.kindLabel=kind=>labels[kind]||kind;
  ns.sound.groupLabel=group=>groups[group]||group||groups.unclassified;
  ns.sound.groups=groups;
  ns.sound.hex=(value,width=6)=>Number.isInteger(value)?`0x${value.toString(16).toUpperCase().padStart(width,"0")}`:"—";
})(globalThis);
