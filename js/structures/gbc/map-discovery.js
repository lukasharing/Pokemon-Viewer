(function(global){
  "use strict";

  class GbcMapDiscovery{
    static UNUSED_MAP_IDS=Object.freeze(new Set([0x0b]));

    static plausibleHeader(memory,bank,address){
      if(bank<=0||address<0x4000||address>0x7fff)return false;
      try{
        const offset=memory.banked(bank,address),tileset=memory.u8(offset),height=memory.u8(offset+1),width=memory.u8(offset+2),blocks=memory.u16(offset+3);
        return tileset<0x30&&width>0&&width<=80&&height>0&&height<=80&&blocks>=0x4000&&blocks<=0x7fff;
      }catch{return false;}
    }

    static findBankTable(memory,pointerTable,{sample=40,unused=this.UNUSED_MAP_IDS}={}){
      sample=Math.min(sample,Math.floor((memory.size-pointerTable)/2));
      const bankCount=Math.floor(memory.size/GbcMemory.BANK_SIZE),eligible=sample-[...unused].filter(id=>id<sample).length;
      let best=null;
      for(let offset=0;offset<memory.size-0xf8;offset++){
        let score=0;
        for(let id=0;id<sample;id++){
          const bank=memory.u8(offset+id);
          if(bank<=0||bank>=bankCount){if(!unused.has(id))break;continue;}
          if(unused.has(id))continue;
          const address=memory.u16(pointerTable+id*2);
          if(this.plausibleHeader(memory,bank,address))score++;else if(id<12)break;
        }
        if(!best||score>best.score)best={offset,score};
        if(score===eligible)break;
      }
      return best?.score>=Math.floor(eligible*.9)?Object.freeze({...best,sample,eligible}):null;
    }
  }

  global.GbcMapDiscovery=GbcMapDiscovery;
  ((global.PokemonViewer||={}).structures||={}).gbcMapDiscovery=GbcMapDiscovery;
})(globalThis);
