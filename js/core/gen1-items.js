(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  class Gen1ItemData{
    static NAMES=0x472b;
    static PRICES=0x4608;
    static COUNT=83;
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      const dictionary=reader.getDictionary(reader.textDictionary);
      this.catalog=new GbcItemCatalog(this.memory,{namesOffset:this.constructor.NAMES,pricesOffset:this.constructor.PRICES,count:this.constructor.COUNT,
        decodeText:(offset,length)=>reader.getTextByOffset(dictionary,offset,length).replace(/@.*$/,"").trim()});
    }
    list(){return this.catalog.all().map(item=>Object.freeze({id:item.itemId,name:item.name||`Item #${item.itemId}`}));}
    get(id){
      if(!Number.isInteger(id)||id<1||id>this.constructor.COUNT)throw new RangeError(`Gen I item must be 1–${this.constructor.COUNT}.`);
      const item=this.catalog.get(id-1),priceOffset=this.constructor.PRICES+(id-1)*3;
      return Object.freeze({...item,id,offset:item.nameOffset,priceOffset,category:this.category(item),iconShared:true});
    }
    category(item){
      if(/BALL$/i.test(item.name))return"Poké Balls";
      if(/KEY|CARD|SCOPE|FLUTE|TICKET|BADGE|FOSSIL|AMBER/i.test(item.name))return"Key items";
      if(/STONE$/i.test(item.name))return"Evolution";
      if(/POTION|HEAL|ANTIDOTE|AWAKENING|BURN|ICE|ETHER|ELIXIR|REVIVE/i.test(item.name))return"Medicine";
      return"Items";
    }
  }
  root.gen1=Object.freeze({...root.gen1,Gen1ItemData});
})(globalThis);
