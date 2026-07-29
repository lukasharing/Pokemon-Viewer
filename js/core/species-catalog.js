(function(global){
  "use strict";
  const root=(global.PokemonViewer ||= {});

  /*
   * A species id only becomes useful to an editor when its identity and its
   * storage provenance travel together.  This catalog is deliberately
   * read-only: family drivers provide verified table locations and consumers
   * receive a stable reference instead of recreating `Species #n` strings.
   */
  class SpeciesReference {
    constructor(values={}){
      Object.assign(this,{id:0,internalId:0,dexNumber:null,isGlitch:false,name:"Unknown species",family:"",nameOffset:null,nameTable:null,accuracy:"partial",references:[],...values});
      this.references=Object.freeze(Array.from(this.references));
      Object.freeze(this);
    }
  }

  class SpeciesCatalog {
    constructor(reader,{family,count,nameTable=null,nameWidth=0,nameIndexBase=0,dexOrderTable=null,dictionary=null}={}){
      this.reader=reader;this.family=family;this.count=count||0;this.nameTable=nameTable;this.nameWidth=nameWidth;this.nameIndexBase=nameIndexBase;this.dexOrderTable=dexOrderTable;this.dictionary=dictionary||reader?.getDictionary?.(reader?.textDictionary);
      this.cache=new Map();
    }
    contains(id){return Number.isInteger(id)&&id>0&&id<=this.count;}
    nameOffset(id){return Number.isInteger(this.nameTable)&&this.nameWidth>0?this.nameTable+(id-this.nameIndexBase)*this.nameWidth:null;}
    dexNumber(id){
      if(!Number.isInteger(this.dexOrderTable)||!this.reader?.memory?.contains?.(this.dexOrderTable+id-1))return this.family==="gbc"?null:id;
      const value=this.reader.memory.u8(this.dexOrderTable+id-1);
      return value||null;
    }
    name(id){
      const offset=this.nameOffset(id);
      if(!Number.isInteger(offset)||!this.reader?.isROMOffset?.(offset))return `Species #${id}`;
      return this.reader.getTextByOffset(this.dictionary,offset,this.nameWidth).replace(/@.*$/,"").trim()||`Species #${id}`;
    }
    get(id){
      if(!this.contains(id))return null;
      if(!this.cache.has(id)){
        const nameOffset=this.nameOffset(id),dexNumber=this.dexNumber(id),verified=Number.isInteger(nameOffset)&&this.reader?.isROMOffset?.(nameOffset);
        this.cache.set(id,new SpeciesReference({
          id,internalId:id,dexNumber,isGlitch:this.family==="gbc"&&!dexNumber,name:this.name(id),family:this.family,nameOffset,
          nameTable:this.nameTable,accuracy:verified?"verified":"partial",
          references:[
            {type:"species",id,label:this.family==="gbc"?`Internal species $${id.toString(16).toUpperCase().padStart(2,"0")}`:`Species ${id}`},
            ...(dexNumber?[{type:"pokedex",id:dexNumber,label:`Pokédex #${dexNumber}`}]:[]),
            {type:"table",label:verified?"Species name table":"Species id association"},
            {type:"cry",id,label:"Cry entry uses this species id"}
          ]
        }));
      }
      return this.cache.get(id);
    }
    list(){return Object.freeze(Array.from({length:this.count},(_,index)=>this.get(index+1)));}
  }

  root.species=Object.freeze({SpeciesCatalog,SpeciesReference,forReader(reader,family){
    const count=family==="gba"?(root.gba?.assets?.profile?.(reader)?.speciesCount||0):({gbc:190,gen2:251}[family]||0);
    const profile=family==="gba"?root.gba?.assets?.profile?.(reader):null;
    const symbols=reader?.capabilities?.provenance?.symbols||{};
    const classic=family==="gbc"
      ?{nameTable:symbols.MonsterNames?.offset??null,nameWidth:10,nameIndexBase:1,dexOrderTable:symbols.PokedexOrder?.offset??null}
      :family==="gen2"
        ?{nameTable:symbols.PokemonNames?.offset??null,nameWidth:10,nameIndexBase:1}
        :{};
    return new SpeciesCatalog(reader,{
      family,count,nameTable:profile?.monsterNames??classic.nameTable??null,
      nameWidth:profile?.monsterNameSize??classic.nameWidth??11,
      nameIndexBase:classic.nameIndexBase??0,dexOrderTable:classic.dexOrderTable??null
    });
  }});
})(globalThis);
