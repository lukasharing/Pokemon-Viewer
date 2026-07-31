(function(global){
  "use strict";
  const ns=((global.PokemonViewer||={}).battle||={});
  class BattleTrainerRepository{
    constructor(driver,reader){this.driver=driver;this.reader=reader;this.items=[];this.promise=null;this.cancelled=false;}
    async load(){
      if(this.promise)return this.promise;
      this.promise=(async()=>{
        await ProjectScheduler.afterPaint();if(this.cancelled)return[];
        const service=ProjectIndexService.forReader(this.reader);
        const result=this.driver.listTrainerSummaries
          ?await this.driver.listTrainerSummaries(service)
          :await Promise.resolve().then(()=>this.driver.listTrainers?.()||[]);
        if(this.cancelled)return[];
        this.items=Array.from(result||[]);return this.items;
      })();return this.promise;
    }
    resolve(key){const summary=this.items.find(item=>String(item.key??item.id)===String(key));return summary?this.driver.resolveTrainer?.(summary)||summary:null;}
    destroy(){this.cancelled=true;}
  }
  ns.BattleTrainerRepository=BattleTrainerRepository;
})(globalThis);
