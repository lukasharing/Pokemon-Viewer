(function(global){
  "use strict";
  const DISPLAY_PALETTE=Object.freeze(["#E0F8CF","#86C06C","#306850","#071821"]);
  class GbcOverworldSpriteCatalog{
    static ENTRY_SIZE=4;
    static WALKING_COUNT=60;
    static COUNT=72;
    constructor(memory){
      if(!(memory instanceof GbcMemory))throw new TypeError("GbcOverworldSpriteCatalog requires GbcMemory.");
      this.memory=memory;const table=this.findTable();this.tableOffset=table?.offset??null;this.count=table?.count??0;
    }
    findTable(){
      for(const count of [this.constructor.COUNT,this.constructor.WALKING_COUNT]){
       const length=count*this.constructor.ENTRY_SIZE;
       for(let offset=0;offset<=this.memory.size-length;offset++){
        let valid=true;
        for(let index=0;index<count;index++){
          const entry=offset+index*4,address=this.memory.u16(entry),size=this.memory.u8(entry+2),bank=this.memory.u8(entry+3);
          const expected=index<this.constructor.WALKING_COUNT?0xc0:0x40;
          if(address<0x4000||address>0x7fff||size!==expected||bank===0||bank*GbcMemory.BANK_SIZE>=this.memory.size){valid=false;break;}
        }
        if(valid)return Object.freeze({offset,count});
       }
      }
      return null;
    }
    available(){return this.tableOffset!==null;}
    list(){return this.available()?Object.freeze(Array.from({length:this.count},(_,index)=>Object.freeze({id:index+1,label:`Overworld sprite ${index+1}`,kind:index<this.constructor.WALKING_COUNT?"actor":"object"}))):Object.freeze([]);}
    source(id){
      if(!this.available()||!Number.isInteger(id)||id<1||id>this.count)throw new RangeError("Choose a valid Gen I overworld sprite.");
      const entry=this.tableOffset+(id-1)*this.constructor.ENTRY_SIZE,address=this.memory.u16(entry),size=this.memory.u8(entry+2),bank=this.memory.u8(entry+3),offset=this.memory.banked(bank,address);
      this.memory.assertRange(offset,size);
      const states=size===0xc0?3:1,title=`Overworld sprite ${id}`,directions=["South","North","West"],views=Array.from({length:states},(_,index)=>Object.freeze({
        offset:offset+index*64,count:4,columns:2,label:directions[index]||`State ${index+1}`,title:`${title} · ${directions[index]||`State ${index+1}`}`,editable:true,palette:DISPLAY_PALETTE,canFlipX:index===2
      }));
      if(states===3)views.push(Object.freeze({...views[2],label:"East",title:`${title} · East`,flipX:true}));
      return Object.freeze({title,views:Object.freeze(views)});
    }
  }
  global.GbcOverworldSpriteCatalog=GbcOverworldSpriteCatalog;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbcOverworldSpriteCatalog=GbcOverworldSpriteCatalog;
})(globalThis);
