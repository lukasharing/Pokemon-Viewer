(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  class SoundAudition{
    static context=null;
    static source=null;
    static stop(){if(!this.source)return;try{this.source.stop();}catch(error){if(error.name!=="InvalidStateError")throw error;}this.source=null;}
    static play({baseCry,pitch=0,length=0,key=null,attack=0,decay=0,sustain=0,release=0,family="gbc"}={}){
      const gba=family==="gba",seed=gba?key:baseCry;if(!Number.isInteger(seed))throw new Error("This sound has no verified parameters to audition.");
      const Audio=global.AudioContext||global.webkitAudioContext;if(!Audio)throw new Error("Web Audio is unavailable in this browser.");
      const context=this.context||=new Audio();this.stop();const source=context.createOscillator(),gain=context.createGain(),now=context.currentTime,wide=family==="gen2";
      const duration=Math.max(.12,Math.min(1.2,(Number(length)||24)/(wide?220:64))),frequency=gba?440*Math.pow(2,((key-60)/12)):110+((baseCry&0xff)*(wide?2.2:3.1))+(Number(pitch)/(wide?340:2));
      source.type=gba?"sawtooth":"square";source.frequency.setValueAtTime(frequency,now);source.frequency.exponentialRampToValueAtTime(Math.max(55,frequency*.55),now+duration);gain.gain.setValueAtTime(.0001,now);
      const envelope=gba?Math.max(.006,Math.min(.08,(attack+1)/512)):.012;gain.gain.exponentialRampToValueAtTime(.14,now+envelope);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,.14*((sustain+1)/256)),now+duration*.55);gain.gain.exponentialRampToValueAtTime(.0001,now+duration+Math.min(.08,(decay+release)/1024));
      source.connect(gain).connect(context.destination);source.start(now);source.stop(now+duration+.03);source.onended=()=>{if(this.source===source)this.source=null;};this.source=source;return duration;
    }
  }
  ns.SoundAudition=SoundAudition;
})(globalThis);
