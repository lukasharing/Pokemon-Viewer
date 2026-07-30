import assert from "node:assert/strict";
import test from "node:test";

globalThis.PokemonViewer={sound:{}};
await import("../js/core/gba-wave-data.js");

class AudioParamStub{
  constructor(value=1){this.value=value;}
  setValueAtTime(value){this.value=value;}
  linearRampToValueAtTime(value){this.value=value;}
}

class AudioBufferStub{
  constructor(length,sampleRate){this.length=length;this.sampleRate=sampleRate;this.samples=null;}
  copyToChannel(samples){this.samples=new Float32Array(samples);}
}

class AudioSourceStub{
  constructor(){this.buffer=null;this.playbackRate=new AudioParamStub();this.started=false;this.stopped=false;}
  connect(node){this.connected=node;return node;}
  start(){this.started=true;}
  stop(){this.stopped=true;}
}

class GainStub{
  constructor(){this.gain=new AudioParamStub();}
  connect(node){this.connected=node;return node;}
}

class AudioContextStub{
  constructor(){this.currentTime=0;this.destination={};AudioContextStub.instance=this;}
  createBuffer(channels,length,sampleRate){assert.equal(channels,1);return new AudioBufferStub(length,sampleRate);}
  createBufferSource(){return this.source=new AudioSourceStub();}
  createGain(){return this.gain=new GainStub();}
  resume(){this.resumed=true;}
}

globalThis.AudioContext=AudioContextStub;
await import("../js/sound/audition.js");

test("GBA WaveData and Sound audition preserve the native PCM sample rate",()=>{
  const bytes=new Uint8Array(20),view=new DataView(bytes.buffer);
  view.setUint32(4,10512*1024,true);
  view.setUint32(8,0,true);
  view.setUint32(12,4,true);
  bytes.set([0,127,128,255],16);
  const memory={
    contains:(offset,length)=>offset>=0&&offset+length<=bytes.length,
    u32:offset=>view.getUint32(offset,true),
    slice:(offset,length)=>bytes.slice(offset,offset+length)
  };
  const waveform=PokemonViewer.gba.GbaWaveData.decode(memory,0);
  assert.equal(waveform.sampleRate,10512);
  assert.deepEqual([...waveform.samples],[0,127/128,-1,-1/128]);

  const duration=PokemonViewer.sound.SoundAudition.play({key:60,waveform});
  const context=AudioContextStub.instance;
  assert.equal(context.source.buffer.sampleRate,10512);
  assert.deepEqual([...context.source.buffer.samples],[...waveform.samples]);
  assert.equal(context.source.playbackRate.value,1);
  assert.ok(Math.abs(duration-4/10512)<Number.EPSILON);
  assert.equal(context.resumed,true);
});

test("Sound audition rejects an undecoded console program instead of fabricating a tone",()=>{
  assert.throws(
    ()=>PokemonViewer.sound.SoundAudition.play({family:"gbc",baseCry:1}),
    /no native ROM audio decoder/
  );
});
