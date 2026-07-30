(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  class SoundAudition{
    static context=null;
    static source=null;
    static stop(){if(!this.source)return;try{this.source.stop();}catch(error){if(error.name!=="InvalidStateError")throw error;}this.source=null;}
    static nativeSource(context,waveform,key){
      if(!waveform?.native||!(waveform.samples instanceof Float32Array)||!waveform.samples.length)return null;
      const sampleRate=Math.max(3000,Math.min(96000,Number(waveform.sampleRate)||Number(waveform.frequency)/1024||10512));
      const buffer=context.createBuffer(1,waveform.samples.length,sampleRate);
      buffer.copyToChannel(waveform.samples,0);
      const source=context.createBufferSource();
      source.buffer=buffer;
      source.playbackRate.setValueAtTime(Math.pow(2,(60-(Number(key)||60))/12),context.currentTime);
      return source;
    }
    static play({key=null,waveform=null}={}){
      if(!waveform?.native)throw new Error("This sound has no native ROM audio decoder yet.");
      const Audio=global.AudioContext||global.webkitAudioContext;if(!Audio)throw new Error("Web Audio is unavailable in this browser.");
      const context=this.context||=new Audio();this.stop();context.resume?.();
      const source=this.nativeSource(context,waveform,key);
      if(!source)throw new Error("The native ROM sample is invalid.");
      const gain=context.createGain(),now=context.currentTime,rate=source.buffer.sampleRate*(source.playbackRate.value||1),duration=waveform.samples.length/rate,fade=Math.min(.004,duration/4);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.linearRampToValueAtTime(.72,now+fade);
      gain.gain.setValueAtTime(.72,now+Math.max(fade,duration-fade));
      gain.gain.linearRampToValueAtTime(.0001,now+duration);
      source.connect(gain).connect(context.destination);source.start(now);source.stop(now+duration);source.onended=()=>{if(this.source===source)this.source=null;};this.source=source;return duration;
    }
  }
  ns.SoundAudition=SoundAudition;
})(globalThis);
