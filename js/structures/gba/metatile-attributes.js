(function(global){
  "use strict";

  const RSE=Object.freeze({
    stride:2,type:"u16",
    fields:Object.freeze({
      behavior:Object.freeze({label:"Behavior",mask:0x00ff,shift:0}),
      layerType:Object.freeze({label:"Layer type",mask:0xf000,shift:12})
    })
  });
  const FRLG=Object.freeze({
    stride:4,type:"u32",
    fields:Object.freeze({
      behavior:Object.freeze({label:"Behavior",mask:0x000001ff,shift:0}),
      terrain:Object.freeze({label:"Terrain",mask:0x00003e00,shift:9}),
      attribute2:Object.freeze({label:"Attribute 2",mask:0x0003c000,shift:14}),
      attribute3:Object.freeze({label:"Attribute 3",mask:0x00fc0000,shift:18}),
      encounterType:Object.freeze({label:"Encounter type",mask:0x07000000,shift:24}),
      attribute5:Object.freeze({label:"Attribute 5",mask:0x18000000,shift:27}),
      layerType:Object.freeze({label:"Layer type",mask:0x60000000,shift:29}),
      attribute7:Object.freeze({label:"Attribute 7",mask:0x80000000,shift:31})
    })
  });

  class GbaMetatileAttribute{
    static profile(frlg=false){return frlg?FRLG:RSE;}

    static read(memory,offset,{frlg=false}={}){
      const profile=this.profile(frlg);memory.assertRange(offset,profile.stride);
      const raw=profile.type==="u32"?memory.u32(offset):memory.u16(offset),values={};
      for(const [key,field] of Object.entries(profile.fields))values[key]=(raw&field.mask)>>>field.shift;
      return Object.freeze({offset,raw,frlg,stride:profile.stride,type:profile.type,...values});
    }

    static encode(current,values={}){
      const profile=this.profile(current.frlg),source=Number(current.raw)>>>0;let raw=source;
      for(const [key,field] of Object.entries(profile.fields)){
        if(values[key]===undefined)continue;
        const maximum=field.mask>>>field.shift,value=values[key];
        if(!Number.isInteger(value)||value<0||value>maximum)throw new RangeError(`${field.label} must be 0..${maximum}.`);
        raw=((raw&~field.mask)|((value<<field.shift)&field.mask))>>>0;
      }
      return raw;
    }

    static fields(attribute){
      const profile=this.profile(attribute.frlg);
      return Object.entries(profile.fields).map(([key,field])=>({key,label:field.label,value:attribute[key],min:0,max:field.mask>>>field.shift}));
    }

    static write(memory,attribute,raw){
      MemoryUtils.write(memory,attribute.offset,attribute.type,raw);
      return this.read(memory,attribute.offset,{frlg:attribute.frlg});
    }
  }

  global.GbaMetatileAttribute=GbaMetatileAttribute;
  ((global.PokemonViewer ||= {}).structures ||= {}).GbaMetatileAttribute=GbaMetatileAttribute;
})(globalThis);
