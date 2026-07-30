(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={});
  ns.pokedex||={};

  const Registry=global.DriverRegistry||class{
    constructor(){this.factories=new Map();}
    register(id,factory){this.factories.set(id,factory);return this;}
    create(id,context){
      const factory=this.factories.get(id);
      if(!factory)throw new Error(`Pokédex driver '${id}' is not registered.`);
      return factory(context);
    }
  };

  class CryAudition{
    static context=null;
    static source=null;

    static stop(){
      if(!this.source)return;
      try{this.source.stop();}
      catch(error){if(error.name!=="InvalidStateError")throw error;}
      this.source=null;
    }

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

    static play({baseCry,pitch=0,length=0,key=null,attack=0,decay=0,sustain=0,release=0,family="gbc",waveform=null}={}){
      const gba=family==="gba",seed=gba?key:baseCry;
      if(!Number.isInteger(seed))throw new Error("This species has no verified cry parameters to audition.");
      const Audio=global.AudioContext||global.webkitAudioContext;
      if(!Audio)throw new Error("Web Audio is unavailable in this browser.");
      const context=this.context||=new Audio();
      this.stop();
      context.resume?.();
      const source=this.nativeSource(context,waveform,key)||context.createOscillator(),gain=context.createGain(),now=context.currentTime,wide=family==="gen2";
      const native=Boolean(source.buffer),rate=native?source.buffer.sampleRate*(source.playbackRate.value||1):0;
      const duration=native?Math.max(.04,Math.min(2.5,waveform.samples.length/rate)):Math.max(.12,Math.min(1.2,(Number(length)||24)/(wide?220:64)));
      const frequency=gba?440*Math.pow(2,((key-60)/12)):110+((baseCry&0xff)*(wide?2.2:3.1))+(Number(pitch)/(wide?340:2));
      if(!native){
        source.type=family==="gba"?"sawtooth":"square";
        source.frequency.setValueAtTime(frequency,now);
        source.frequency.exponentialRampToValueAtTime(Math.max(55,frequency*.55),now+duration);
      }
      gain.gain.setValueAtTime(.0001,now);
      const envelope=gba?Math.max(.006,Math.min(.08,(attack+1)/512)):.012;
      gain.gain.exponentialRampToValueAtTime(.14,now+envelope);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001,.14*((sustain+1)/256)),now+duration*.55);
      gain.gain.exponentialRampToValueAtTime(.0001,now+duration+Math.min(.08,(decay+release)/1024));
      source.connect(gain).connect(context.destination);
      source.start(now);
      source.stop(now+duration+.03);
      source.onended=()=>{if(this.source===source)this.source=null;};
      this.source=source;
      return duration;
    }
  }

  class FootprintCodec{
    static decode(bytes,{lsbFirst=false}={}){
      if(!(bytes instanceof Uint8Array)||bytes.length!==32)throw new TypeError("A native footprint requires exactly four 8×8 1bpp tiles.");
      const pixels=new Uint8Array(16*16);
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){
        const tile=(y>>3)*2+(x>>3),row=bytes[tile*8+(y&7)];
        const bit=lsbFirst?(x&7):7-(x&7);
        pixels[y*16+x]=(row>>bit)&1;
      }
      return pixels;
    }
    static source(resource,{color="#273f50"}={}){
      if(!resource?.bytes)return null;
      const lsbFirst=resource.bitOrder==="lsb",pixels=this.decode(resource.bytes,{lsbFirst}),canvas=document.createElement("canvas");
      canvas.width=canvas.height=16;
      const context=canvas.getContext("2d"),image=context.createImageData(16,16);
      const value=Number.parseInt(color.slice(1),16),rgb=[value>>16&255,value>>8&255,value&255];
      for(let index=0;index<pixels.length;index++)if(pixels[index])image.data.set([...rgb,255],index*4);
      context.putImageData(image,0,0);
      return Object.freeze({...resource,width:16,height:16,count:4,columns:2,canvas,palette:["#ffffff",color],codec:lsbFirst?GbaFootprintTileCodec:FootprintTileCodec,sourceEncoding:`native 2×2 tiles · 1bpp · ${lsbFirst?"GBA LSB-first":"RGBDS MSB-first"}`});
    }
  }
  const FootprintTileCodec=Object.freeze({
    id:"native-1bpp",label:"Native 1bpp",bytesPerTile:8,colors:2,
    decodeTile(memory,offset){
      memory.assertRange(offset,8);const pixels=new Uint8Array(64);
      for(let y=0;y<8;y++){const row=memory.u8(offset+y);for(let x=0;x<8;x++)pixels[y*8+x]=(row>>(7-x))&1;}
      return pixels;
    },
    encodeTile(pixels){
      if(!pixels||pixels.length!==64)throw new RangeError("A 1bpp tile requires 64 pixels.");
      const bytes=new Uint8Array(8);
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const value=Number(pixels[y*8+x]);if(value!==0&&value!==1)throw new RangeError("1bpp pixels must be 0 or 1.");
        bytes[y]|=value<<(7-x);
      }
      return bytes;
    }
  });
  const GbaFootprintTileCodec=Object.freeze({
    id:"gba-native-1bpp",label:"GBA native 1bpp",bytesPerTile:8,colors:2,
    decodeTile(memory,offset){
      memory.assertRange(offset,8);const pixels=new Uint8Array(64);
      for(let y=0;y<8;y++){const row=memory.u8(offset+y);for(let x=0;x<8;x++)pixels[y*8+x]=(row>>x)&1;}
      return pixels;
    },
    encodeTile(pixels){
      if(!pixels||pixels.length!==64)throw new RangeError("A 1bpp tile requires 64 pixels.");
      const bytes=new Uint8Array(8);
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const value=Number(pixels[y*8+x]);if(value!==0&&value!==1)throw new RangeError("1bpp pixels must be 0 or 1.");
        bytes[y]|=value<<x;
      }
      return bytes;
    }
  });

  ns.pokedex.registry=ns.pokedex.registry||new Registry("Pokédex");
  ns.pokedex.CryAudition=CryAudition;
  ns.pokedex.FootprintCodec=FootprintCodec;
  ns.pokedex.FootprintTileCodec=FootprintTileCodec;
  ns.pokedex.GbaFootprintTileCodec=GbaFootprintTileCodec;
})(globalThis);
