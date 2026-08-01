(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  const counts=Object.freeze({gba:386,gbc:190,gen2:251});

  class GenericSoundDriver {
    constructor({reader,family}){this.reader=reader;this.family=family;this.count=counts[family]||151;this.species=PokemonViewer.species.forReader(reader,family);}
    mapMusic(){return typeof ns.MapMusicCatalog==="function"?new ns.MapMusicCatalog(this.reader,this.family).list():[];}
    list(){
      const cries=this.species.list().map(species=>new ns.SoundDocument({
        id:species.id,name:`${species.name} cry`,kind:"cry",family:this.family,
        source:"Species id → cry entry",accuracy:species.accuracy,metadata:{group:"cry",speciesId:species.id,speciesName:species.name,dexNumber:species.dexNumber,isGlitch:species.isGlitch,cryTable:"Cry data / cry command table"},
        references:[
          {type:"species",id:species.id,label:`${species.name} (#${species.id})`,offset:species.nameOffset},
          {type:"table",label:"Cry data table (family-specific decoder pending)"},
          ...species.references.filter(reference=>reference.type==="table")
        ]
      }));
      return [...this.mapMusic(),...cries];
    }
    describe(document){
      if(document.kind==="cry")return {summary:`${document.metadata.speciesName} is linked through species id ${document.metadata.speciesId}. The species association is available; decoding its actual cry parameters waits for a verified ${this.family.toUpperCase()} cry-table profile.`,tracks:[],commands:[],voices:[]};
      return {summary:"This reference is discovered from game structures; load a profile with audio tables to decode its commands.",tracks:[],commands:[],voices:[]};
    }
  }
  ns.GenericSoundDriver=GenericSoundDriver;

})(globalThis);
