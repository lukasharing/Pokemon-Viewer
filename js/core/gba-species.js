(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});

  class GbaLz77{
    static decode(memory,offset,{maxOutput=0x20000,maxInput=0x20000}={}){
      memory.assertRange(offset,4);
      if(memory.u8(offset)!==0x10)throw new Error(`Expected GBA LZ77 data at ${MemoryUtils.hex(offset,6)}.`);
      const length=memory.u8(offset+1)|memory.u8(offset+2)<<8|memory.u8(offset+3)<<16;
      if(length<1||length>maxOutput)throw new RangeError(`GBA LZ77 output length ${length} is outside the verified limit.`);
      const bytes=new Uint8Array(length);let source=offset+4,target=0;
      while(target<length){
        if(source-offset>=maxInput)throw new RangeError("GBA LZ77 input exceeds its verified limit.");
        const flags=memory.u8(source++);
        for(let bit=7;bit>=0&&target<length;bit--){
          if(flags>>bit&1){
            memory.assertRange(source,2);
            const a=memory.u8(source++),b=memory.u8(source++),count=(a>>>4)+3,back=((a&15)<<8|b)+1;
            if(back>target)throw new Error(`GBA LZ77 back-reference escapes output at ${MemoryUtils.hex(source-2,6)}.`);
            for(let index=0;index<count&&target<length;index++)bytes[target]=bytes[target++-back];
          }else{
            memory.assertRange(source);bytes[target++]=memory.u8(source++);
          }
        }
      }
      return Object.freeze({offset,bytes,consumed:source-offset});
    }
  }

  class GbaSpeciesData{
    static NAME_SIZE=11;
    static EVOLUTIONS_PER_SPECIES=5;
    static EVOLUTION_SIZE=8;
    static TM_HM_SIZE=8;
    static CRY_TONE_SIZE=12;
    static CRY_COUNT=388;
    static CELEBI=251;
    static UNOWN_CRY=200;
    static TREECKO=277;
    static EVOLUTION_METHODS=Object.freeze([
      "None","Friendship","Friendship (day)","Friendship (night)","Level","Trade",
      "Trade holding item","Use item","Level · Attack > Defense","Level · Attack = Defense",
      "Level · Attack < Defense","Level · Silcoon personality","Level · Cascoon personality",
      "Level · Ninjask","Level · Shedinja","Beauty"
    ]);
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      this.iconCanvases=new Map();
      this.profile=root.gba.assets.profile(reader);
      this.catalog=root.species.forReader(reader,"gba");
      if(!this.profile)throw new Error("No verified Generation III Species profile is available.");
      for(const name of ["monsterPics","monsterPalettes","monsterNames","pokedexEntries","pokedexEntrySize","speciesCount","pokedexCount"]){
        if(!Number.isInteger(this.profile[name]))throw new Error(`The GBA Species profile is missing ${name}.`);
      }
      global.ProjectValidator?.registerDomain(reader,"gba-species",()=>this.validate());
    }
    requireProfile(...names){
      for(const name of names)if(!Number.isInteger(this.profile[name]))throw new Error(`This GBA profile has no verified ${name}.`);
    }
    assertId(id){
      if(!Number.isInteger(id)||id<1||id>this.profile.speciesCount)throw new RangeError(`GBA species must be 1–${this.profile.speciesCount}.`);
    }
    terminated(offset,length,label){
      this.memory.assertRange(offset,length);
      for(let index=0;index<length;index++)if(this.memory.u8(offset+index)===0xff)return index;
      throw new Error(`${label} is not terminated inside its ${length}-byte field.`);
    }
    name(id){
      this.assertId(id);
      const offset=this.profile.monsterNames+id*this.constructor.NAME_SIZE;
      this.terminated(offset,this.constructor.NAME_SIZE,`Species ${id} name`);
      return this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),offset,this.constructor.NAME_SIZE).trim()||`Species #${id}`;
    }
    nationalDex(id){
      this.assertId(id);
      if(id<=251)return id;
      if(id<=276)return null;
      const dex=id-25;
      return dex<=this.profile.pokedexCount?dex:null;
    }
    pokedexSpecies(){
      return Object.freeze(this.catalog.list().filter(species=>this.nationalDex(species.id)!==null));
    }
    document(id){
      this.assertId(id);
      const dexNumber=this.nationalDex(id);
      if(dexNumber!==null)return this.entry(id);
      return Object.freeze({
        id,dexNumber:null,name:this.name(id),species:this.catalog.get(id),offset:null,
        category:"Internal species slot",height:null,weight:null,descriptionOffset:null,
        description:"This is a real Generation III internal species slot, but it has no independent National Pokédex entry in this ROM."
      });
    }
    entry(id){
      this.assertId(id);
      const dexNumber=this.nationalDex(id);
      if(dexNumber===null)throw new RangeError(`Internal species ${id} has no independent National Pokédex entry.`);
      const offset=this.profile.pokedexEntries+dexNumber*this.profile.pokedexEntrySize;
      this.memory.assertRange(offset,this.profile.pokedexEntrySize);
      this.terminated(offset,12,`Species ${id} Pokédex category`);
      const descriptionOffset=this.memory.pointer(offset+16);
      if(descriptionOffset===null)throw new Error(`Species ${id} Pokédex description pointer is invalid.`);
      this.memory.assertRange(descriptionOffset);
      return Object.freeze({
        id,dexNumber,name:this.name(id),species:this.catalog.get(id),offset,
        category:this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),offset,12),
        height:this.memory.u16(offset+12),weight:this.memory.u16(offset+14),
        descriptionOffset,
        description:this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),descriptionOffset,256).replace(/\[b\]/gi,"\n")
      });
    }
    compressedRecord(table,id,label){
      this.assertId(id);
      const recordOffset=table+id*8,offset=this.memory.pointer(recordOffset);
      if(offset===null)throw new Error(`${label} ${id} has an invalid data pointer.`);
      const declaredSize=this.memory.u16(recordOffset+4),tag=this.memory.u16(recordOffset+6);
      return Object.freeze({recordOffset,offset,declaredSize,tag,...GbaLz77.decode(this.memory,offset)});
    }
    front(id){
      const value=this.compressedRecord(this.profile.monsterPics,id,"Front sprite");
      if(value.bytes.length<0x800)throw new Error(`Front sprite ${id} is shorter than one native 64×64 frame.`);
      return value;
    }
    back(id){
      if(!Number.isInteger(this.profile.monsterBackPics))throw new Error("This ROM profile has no verified back-sprite table.");
      const value=this.compressedRecord(this.profile.monsterBackPics,id,"Back sprite");
      if(value.bytes.length<0x800)throw new Error(`Back sprite ${id} is shorter than one native 64×64 frame.`);
      return value;
    }
    palette(id){
      const value=this.compressedRecord(this.profile.monsterPalettes,id,"Palette");
      if(value.bytes.length<32)throw new Error(`Species palette ${id} contains fewer than 16 colors.`);
      return value;
    }
    evolutions(id){
      this.assertId(id);
      this.requireProfile("evolutions");
      const size=this.constructor.EVOLUTIONS_PER_SPECIES*this.constructor.EVOLUTION_SIZE;
      const base=this.profile.evolutions+id*size,result=[];
      this.memory.assertRange(base,size);
      for(let index=0;index<this.constructor.EVOLUTIONS_PER_SPECIES;index++){
        const offset=base+index*this.constructor.EVOLUTION_SIZE,method=this.memory.u16(offset);
        if(method===0)continue;
        if(method>=this.constructor.EVOLUTION_METHODS.length)throw new Error(`${this.name(id)} has unknown evolution method ${method}.`);
        const param=this.memory.u16(offset+2),targetId=this.memory.u16(offset+4);
        this.assertId(targetId);
        result.push(Object.freeze({index,offset,method,methodName:this.constructor.EVOLUTION_METHODS[method],param,targetId,target:this.catalog.get(targetId)}));
      }
      return Object.freeze(result);
    }
    machineIndexes(id){
      this.assertId(id);
      this.requireProfile("tmHmLearnsets","tmHmCount");
      const offset=this.profile.tmHmLearnsets+id*this.constructor.TM_HM_SIZE;
      this.memory.assertRange(offset,this.constructor.TM_HM_SIZE);
      const result=[];
      for(let index=0;index<this.profile.tmHmCount;index++)if(this.memory.u8(offset+(index>>3))&(1<<(index&7)))result.push(index);
      return Object.freeze(result);
    }
    cryId(id){
      this.assertId(id);
      this.requireProfile("speciesIdToCryId","cryTable");
      // gCryTable is zero-based while Species IDs are one-based. The 25
      // obsolete Unown-form slots share Unown's zero-based cry ID, and the
      // Hoenn routing table begins at Treecko itself.
      if(id<=this.constructor.CELEBI)return id-1;
      if(id<this.constructor.TREECKO)return this.constructor.UNOWN_CRY;
      const offset=this.profile.speciesIdToCryId+(id-this.constructor.TREECKO)*2;
      this.memory.assertRange(offset,2);
      const cryId=this.memory.u16(offset);
      if(cryId<0||cryId>=this.constructor.CRY_COUNT)throw new RangeError(`Species ${id} resolves to invalid GBA cry ${cryId}.`);
      return cryId;
    }
    cry(id){
      const cryId=this.cryId(id),offset=this.profile.cryTable+cryId*this.constructor.CRY_TONE_SIZE;
      this.memory.assertRange(offset,this.constructor.CRY_TONE_SIZE);
      const waveOffset=this.memory.pointer(offset+4);
      if(waveOffset===null)throw new Error(`GBA cry ${cryId} has an invalid WaveData pointer.`);
      this.memory.assertRange(waveOffset,1);
      return Object.freeze({
        speciesId:id,cryId,offset,type:this.memory.u8(offset),key:this.memory.u8(offset+1),length:this.memory.u8(offset+2),panSweep:this.memory.u8(offset+3),waveOffset,
        attack:this.memory.u8(offset+8),decay:this.memory.u8(offset+9),sustain:this.memory.u8(offset+10),release:this.memory.u8(offset+11)
      });
    }
    icon(id){
      this.assertId(id);
      for(const name of ["monIconTable","monIconPaletteIndices","monIconPaletteTable"])if(!Number.isInteger(this.profile[name]))throw new Error(`This GBA profile has no verified ${name}.`);
      const graphicRecord=this.profile.monIconTable+id*4,paletteIndexOffset=this.profile.monIconPaletteIndices+id;
      this.memory.assertRange(graphicRecord,4);this.memory.assertRange(paletteIndexOffset,1);
      const graphicOffset=this.memory.pointer(graphicRecord),paletteIndex=this.memory.u8(paletteIndexOffset),paletteRecord=this.profile.monIconPaletteTable+paletteIndex*8;
      if(graphicOffset===null)throw new Error(`GBA icon ${id} has an invalid graphics pointer.`);
      this.memory.assertRange(graphicOffset,0x200);this.memory.assertRange(paletteRecord,8);
      const paletteOffset=this.memory.pointer(paletteRecord);
      if(paletteOffset===null)throw new Error(`GBA icon ${id} has an invalid palette pointer.`);
      this.memory.assertRange(paletteOffset,32);
      return Object.freeze({speciesId:id,width:32,height:32,graphicRecord,graphicOffset,paletteIndexOffset,paletteIndex,paletteRecord,paletteOffset,bytes:MemoryUtils.bytes(this.memory,graphicOffset,0x200),palette:MemoryUtils.bytes(this.memory,paletteOffset,32)});
    }
    iconSource(id){
      this.assertId(id);
      if(this.iconCanvases.has(id))return this.iconCanvases.get(id);
      const icon=this.icon(id),pixels=GbaSpriteCodec.decodeImage(icon.bytes,{width:32,height:32}),canvas=document.createElement("canvas");
      canvas.width=canvas.height=32;
      const context=canvas.getContext("2d"),image=context.createImageData(32,32);
      for(let index=0;index<pixels.length;index++){
        const color=icon.palette[pixels[index]*2]|icon.palette[pixels[index]*2+1]<<8,target=index*4;
        image.data.set([(color&31)*255/31,(color>>5&31)*255/31,(color>>10&31)*255/31,pixels[index]===0?0:255].map(Math.round),target);
      }
      context.putImageData(image,0,0);
      const source=Object.freeze({...icon,canvas,title:`${this.name(id)} · native GBA menu icon`,editable:false,sourceEncoding:"gMonIconTable · 32×32 4bpp"});
      this.iconCanvases.set(id,source);return source;
    }
    levelUpMoves(id){
      this.assertId(id);
      if(!Number.isInteger(this.profile.levelUpLearnsets))return Object.freeze([]);
      const tableOffset=this.profile.levelUpLearnsets+id*4,pointer=this.memory.pointer(tableOffset);
      if(pointer===null)throw new Error(`Species ${id} has an invalid level-up learnset pointer.`);
      const moves=[];
      for(let index=0;index<20;index++){
        const offset=pointer+index*2,value=this.memory.u16(offset);
        if(value===0xffff)return Object.freeze(moves);
        const moveId=value&0x1ff,level=value>>>9;
        if(moveId<1||moveId>this.profile.moveCount||level>100)throw new Error(`Species ${id} has an invalid level-up move at ${MemoryUtils.hex(offset,6)}.`);
        moves.push(Object.freeze({index,offset,moveId,level}));
      }
      throw new Error(`Species ${id} level-up learnset exceeds the native 20-entry limit.`);
    }
    footprint(id){
      this.assertId(id);
      if(!Number.isInteger(this.profile.monFootprintTable))return null;
      const record=this.profile.monFootprintTable+id*4,offset=this.memory.pointer(record);
      if(offset===null)throw new Error(`Species ${id} has an invalid footprint pointer.`);
      this.memory.assertRange(offset,32);
      // The GBA graphics converter stores each 1bpp row least-significant
      // pixel first. This differs from RGBDS' Gen II 1bpp tile convention.
      return Object.freeze({speciesId:id,record,offset,width:16,height:16,bitOrder:"lsb",bytes:MemoryUtils.bytes(this.memory,offset,32)});
    }
    encodeMachines(id,indexes){
      this.assertId(id);
      this.requireProfile("tmHmLearnsets","tmHmCount");
      const offset=this.profile.tmHmLearnsets+id*this.constructor.TM_HM_SIZE,bytes=MemoryUtils.bytes(this.memory,offset,this.constructor.TM_HM_SIZE);
      const selected=new Set(indexes);
      for(let index=0;index<this.profile.tmHmCount;index++){
        const byte=index>>3,mask=1<<(index&7);
        bytes[byte]=selected.has(index)?bytes[byte]|mask:bytes[byte]&~mask;
      }
      return bytes;
    }
    evolutionEditBytes(id,evolutions){
      this.assertId(id);
      this.requireProfile("evolutions");
      if(!Array.isArray(evolutions)||evolutions.length>this.constructor.EVOLUTIONS_PER_SPECIES)throw new RangeError("Generation III supports at most five evolution slots per species.");
      const size=this.constructor.EVOLUTIONS_PER_SPECIES*this.constructor.EVOLUTION_SIZE,offset=this.profile.evolutions+id*size;
      const before=MemoryUtils.bytes(this.memory,offset,size),after=Uint8Array.from(before);
      for(let index=0;index<this.constructor.EVOLUTIONS_PER_SPECIES;index++){
        const value=evolutions[index]||{method:0,param:0,targetId:0},at=index*this.constructor.EVOLUTION_SIZE;
        for(const [label,number] of [["method",value.method],["parameter",value.param],["target",value.targetId]])if(!Number.isInteger(number)||number<0||number>0xffff)throw new RangeError(`Evolution ${label} must be an unsigned 16-bit integer.`);
        after[at]=value.method&255;after[at+1]=value.method>>>8;
        after[at+2]=value.param&255;after[at+3]=value.param>>>8;
        after[at+4]=value.targetId&255;after[at+5]=value.targetId>>>8;
      }
      return Object.freeze({offset,before,after});
    }
    list(){return this.catalog.list();}
    validate(){
      for(let id=1;id<=this.profile.speciesCount;id++){
        if(this.nationalDex(id)!==null)this.entry(id);
        this.front(id);this.palette(id);
        if(Number.isInteger(this.profile.evolutions))this.evolutions(id);
        if(Number.isInteger(this.profile.tmHmLearnsets)&&Number.isInteger(this.profile.tmHmCount))this.machineIndexes(id);
      }
      return[];
    }
  }

  root.gba=Object.freeze({...root.gba,GbaLz77,GbaSpeciesData});
})(globalThis);
