(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});

  class Gen2SpeciesData{
    static COUNT=251;
    static BASE_SIZE=32;
    static CRY_SIZE=6;
    static TEXT_END=0x50;
    static PICS_FIX=0x36;
    static TYPES=Object.freeze(new Map([[0,"Normal"],[1,"Fighting"],[2,"Flying"],[3,"Poison"],[4,"Ground"],[5,"Rock"],[6,"Bird (unused)"],[7,"Bug"],[8,"Ghost"],[9,"Steel"],[20,"Fire"],[21,"Water"],[22,"Grass"],[23,"Electric"],[24,"Psychic"],[25,"Ice"],[26,"Dragon"],[27,"Dark"]]));
    static GROWTH_RATES=Object.freeze(["Medium Fast","Slightly Fast","Slightly Slow","Medium Slow","Fast","Slow"]);
    static EGG_GROUPS=Object.freeze(["None","Monster","Water 1","Bug","Flying","Field","Fairy","Grass","Human-Like","Water 3","Mineral","Amorphous","Water 2","Ditto","Dragon","Undiscovered"]);

    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["BaseData","PokemonNames","PokedexDataPointerTable","GetDexEntryPointer.PokedexEntryBanks","PokemonPalettes","PokemonPicPointers","UnownPicPointers","FixPicBank.PicsBanks","PokemonCries"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Crystal source manifest is missing ${name}.`);
      }
      this.catalog=root.species.forReader(reader,"gen2");
      this.dictionary=reader.getDictionary?.(reader.textDictionary)||[];
      this._frontSprites=new Map();
      global.ProjectValidator?.registerDomain(reader,"gen2-species",()=>this.validate());
    }

    assertId(id){
      if(!Number.isInteger(id)||id<1||id>this.constructor.COUNT)throw new RangeError(`Crystal species must be 1–${this.constructor.COUNT}.`);
    }
    validate(){
      this._frontSprites.clear();
      for(let id=1;id<=this.constructor.COUNT;id++){
        const document=this.document(id),base=document.base;
        if(base.dexNumber!==id)throw new Error(`${document.name} BaseData belongs to Pokédex #${base.dexNumber}.`);
        if(!this.constructor.TYPES.has(base.type1)||!this.constructor.TYPES.has(base.type2))throw new Error(`${document.name} has an invalid type.`);
        if(base.growthRate>=this.constructor.GROWTH_RATES.length)throw new Error(`${document.name} has an invalid growth rate.`);
        this.frontSprite(id);this.palette(id);this.palette(id,{shiny:true});
      }
      return[];
    }

    typeName(id){return this.constructor.TYPES.get(id)||`Unknown (${id})`;}
    growthName(id){return this.constructor.GROWTH_RATES[id]||`Unknown (${id})`;}
    eggGroupName(id){return this.constructor.EGG_GROUPS[id]||`Unknown (${id})`;}

    decode(offset,length){
      this.memory.assertRange(offset,length);
      let result="";
      for(const byte of this.memory.slice(offset,length)){
        if(byte===this.constructor.TEXT_END)break;
        result+=this.dictionary[byte]??"";
      }
      return result.replace(/<(?:NEXT|LINE|PARA|CONT|SCROLL|_CONT)>/g," ").replace(/\s+/g," ").trim();
    }

    base(id){
      this.assertId(id);
      const offset=this.symbols.BaseData.offset+(id-1)*this.constructor.BASE_SIZE;
      this.memory.assertRange(offset,this.constructor.BASE_SIZE);
      return Object.freeze({
        offset,dexNumber:this.memory.u8(offset),
        hp:this.memory.u8(offset+1),attack:this.memory.u8(offset+2),
        defense:this.memory.u8(offset+3),speed:this.memory.u8(offset+4),
        specialAttack:this.memory.u8(offset+5),specialDefense:this.memory.u8(offset+6),
        type1:this.memory.u8(offset+7),type2:this.memory.u8(offset+8),
        catchRate:this.memory.u8(offset+9),baseExperience:this.memory.u8(offset+10),
        item1:this.memory.u8(offset+11),item2:this.memory.u8(offset+12),
        genderRatio:this.memory.u8(offset+13),unknown1:this.memory.u8(offset+14),
        hatchCycles:this.memory.u8(offset+15),unknown2:this.memory.u8(offset+16),
        frontDimensions:this.memory.u8(offset+17),
        unusedPicturePointers:this.memory.slice(offset+18,4),
        growthRate:this.memory.u8(offset+22),eggGroups:this.memory.u8(offset+23),
        tmHm:this.memory.slice(offset+24,8)
      });
    }

    machineCompatible(base,index){
      if(!base||!Number.isInteger(index)||index<1||index>60)throw new RangeError("Crystal machine index must be 1–60.");
      const bit=index-1;
      return Boolean(base.tmHm[bit>>3]&(1<<(bit&7)));
    }

    machineIndexes(base){
      return Object.freeze(Array.from({length:60},(_,index)=>index+1).filter(index=>this.machineCompatible(base,index)));
    }

    encodeMachines(base,indexes){
      if(!base?.tmHm||base.tmHm.length!==8)throw new TypeError("Crystal machine compatibility requires an exact eight-byte BaseData bitset.");
      const selected=new Set(indexes),result=Uint8Array.from(base.tmHm);
      for(const index of selected)if(!Number.isInteger(index)||index<1||index>60)throw new RangeError("Crystal machine index must be 1–60.");
      for(let bit=0;bit<60;bit++){
        const mask=1<<(bit&7),byte=bit>>3;
        result[byte]=selected.has(bit+1)?result[byte]|mask:result[byte]&~mask;
      }
      return result;
    }

    entryPointer(id){
      this.assertId(id);
      const symbol=this.symbols.PokedexDataPointerTable,pointerOffset=symbol.offset+(id-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const bankTable=this.symbols["GetDexEntryPointer.PokedexEntryBanks"].offset,bankIndex=Math.floor((id-1)/64);
      this.memory.assertRange(bankTable+bankIndex);
      const bank=this.memory.u8(bankTable+bankIndex),address=this.memory.u16(pointerOffset),offset=this.memory.banked(bank,address);
      return Object.freeze({pointerOffset,bankOffset:bankTable+bankIndex,bank,address,offset});
    }

    entryEnd(id,start){
      const bank=this.entryPointer(id).bank,bankEnd=Math.min(this.memory.size,(bank+1)*Gen2Memory.BANK_SIZE);
      const candidates=[bankEnd];
      for(let next=1;next<=this.constructor.COUNT;next++){
        const pointer=this.entryPointer(next);
        if(pointer.bank===bank&&pointer.offset>start)candidates.push(pointer.offset);
      }
      return Math.min(...candidates);
    }

    findEnd(offset,limit,label){
      for(let cursor=offset;cursor<limit;cursor++)if(this.memory.u8(cursor)===this.constructor.TEXT_END)return cursor;
      throw new Error(`Crystal ${label} is not terminated inside its verified entry extent.`);
    }

    entry(id){
      const pointer=this.entryPointer(id),end=this.entryEnd(id,pointer.offset);
      const categoryEnd=this.findEnd(pointer.offset,end,`Pokédex #${id} category`);
      const measurementOffset=categoryEnd+1;
      this.memory.assertRange(measurementOffset,4);
      const descriptionOffset=measurementOffset+4;
      const descriptionEnd=this.findEnd(descriptionOffset,end,`Pokédex #${id} description`);
      return Object.freeze({
        pointerOffset:pointer.pointerOffset,offset:pointer.offset,end:descriptionEnd+1,
        category:this.decode(pointer.offset,categoryEnd-pointer.offset),
        measurementOffset,height:this.memory.u16(measurementOffset),weight:this.memory.u16(measurementOffset+2),
        descriptionOffset,description:this.decode(descriptionOffset,descriptionEnd-descriptionOffset)
      });
    }

    cry(id){
      this.assertId(id);
      const offset=this.symbols.PokemonCries.offset+(id-1)*this.constructor.CRY_SIZE;
      this.memory.assertRange(offset,this.constructor.CRY_SIZE);
      return Object.freeze({offset,baseCry:this.memory.u16(offset),pitch:this.memory.u16(offset+2),length:this.memory.u16(offset+4)});
    }

    footprint(id){
      this.assertId(id);
      const base=this.symbols.Footprints?.offset;
      if(!Number.isInteger(base))return null;
      const index=id-1,group=index>>3,column=index&7,top=base+group*0x100+column*0x10,bottom=top+0x80;
      this.memory.assertRange(top,16);this.memory.assertRange(bottom,16);
      const bytes=new Uint8Array(32);
      bytes.set(this.memory.slice(top,16),0);bytes.set(this.memory.slice(bottom,16),16);
      return Object.freeze({speciesId:id,offset:top,segments:Object.freeze([{offset:top,length:16},{offset:bottom,length:16}]),width:16,height:16,bitOrder:"msb",bytes});
    }

    picturePointer(id,{back=false}={}){
      this.assertId(id);
      const pointerOffset=id===201?this.symbols.UnownPicPointers.offset+(back?3:0):this.symbols.PokemonPicPointers.offset+(id-1)*6+(back?3:0);
      this.memory.assertRange(pointerOffset,3);
      const storedBank=this.memory.u8(pointerOffset),address=this.memory.u16(pointerOffset+1);
      const bankTable=this.symbols["FixPicBank.PicsBanks"].offset,firstBank=this.memory.u8(bankTable);
      const firstStored=(firstBank-this.constructor.PICS_FIX)&0xff,index=storedBank-firstStored;
      if(index<0||index>=24)throw new RangeError(`Crystal picture bank code ${storedBank} is outside FixPicBank.PicsBanks.`);
      const bank=this.memory.u8(bankTable+index),offset=this.memory.banked(bank,address);
      return Object.freeze({pointerOffset,storedBank,address,bank,index,offset});
    }

    frontSprite(id){
      this.assertId(id);
      if(this._frontSprites.has(id))return this._frontSprites.get(id);
      if(typeof GscLz!=="function")throw new Error("Crystal Pokémon pictures require the GSC LZ3 codec.");
      const base=this.base(id),pointer=this.picturePointer(id),width=base.frontDimensions>>>4,height=base.frontDimensions&0xf;
      if(width<1||width>7||height<1||height>7)throw new RangeError(`Crystal species ${id} has invalid picture dimensions ${width}×${height}.`);
      const decoded=GscLz.decompress(this.memory,pointer.offset,{maxOutput:0x4000,maxInput:0x4000});
      const frameBytes=width*height*16;
      if(decoded.bytes.length<frameBytes)throw new RangeError(`Crystal species ${id} front picture is shorter than its ${width}×${height} base frame.`);
      const result=Object.freeze({id,pointer,width,height,offset:pointer.offset,consumed:decoded.consumed,bytes:decoded.bytes,frameBytes});
      this._frontSprites.set(id,result);return result;
    }

    palette(id,{shiny=false}={}){
      this.assertId(id);
      const entryOffset=this.symbols.PokemonPalettes.offset+id*8,offset=entryOffset+(shiny?4:0);
      this.memory.assertRange(offset,4);
      const color=value=>{
        const expand=component=>Math.round(component*255/31);
        const red=expand(value&31),green=expand(value>>>5&31),blue=expand(value>>>10&31);
        return`#${[red,green,blue].map(component=>component.toString(16).padStart(2,"0")).join("")}`;
      };
      return Object.freeze({offset,entryOffset,shiny,colors:Object.freeze(["#ffffff",color(this.memory.u16(offset)),color(this.memory.u16(offset+2)),"#000000"])});
    }

    document(id){
      this.assertId(id);
      const species=this.catalog.get(id),entry=this.entry(id);
      return Object.freeze({id,name:species.name,species,base:this.base(id),cry:this.cry(id),...entry});
    }

    static encodeMeasurements({height,weight}={}){
      const values=[height,weight].map((value,index)=>{
        const number=Number(value),label=index?"weight":"height";
        if(!Number.isInteger(number)||number<0||number>0xffff)throw new RangeError(`Crystal Pokédex ${label} must be an unsigned word.`);
        return number;
      });
      return Uint8Array.of(values[0]&0xff,values[0]>>>8,values[1]&0xff,values[1]>>>8);
    }

    static encodeCry({baseCry,pitch,length}={}){
      const base=Number(baseCry),words=[Number(pitch),Number(length)];
      if(!Number.isInteger(base)||base<0||base>0xffff)throw new RangeError("Crystal base cry must be an unsigned word.");
      if(words.some(value=>!Number.isInteger(value)||value<0||value>0xffff))throw new RangeError("Crystal cry pitch and length must be unsigned words.");
      return Uint8Array.of(base&0xff,base>>>8,words[0]&0xff,words[0]>>>8,words[1]&0xff,words[1]>>>8);
    }

    static encodeBase(current,values={}){
      if(!current||!Number.isInteger(current.offset))throw new TypeError("Crystal BaseData writer requires a decoded record.");
      const next=Uint8Array.from([
        current.dexNumber,current.hp,current.attack,current.defense,current.speed,current.specialAttack,current.specialDefense,
        current.type1,current.type2,current.catchRate,current.baseExperience,current.item1,current.item2,
        current.genderRatio,current.unknown1,current.hatchCycles,current.unknown2,current.frontDimensions,
        ...current.unusedPicturePointers,current.growthRate,current.eggGroups,...current.tmHm
      ]);
      if(next.length!==this.BASE_SIZE)throw new Error("Crystal BaseData did not reconstruct to 32 bytes.");
      const byteFields={hp:1,attack:2,defense:3,speed:4,specialAttack:5,specialDefense:6,type1:7,type2:8,catchRate:9,baseExperience:10,item1:11,item2:12,genderRatio:13,hatchCycles:15,growthRate:22};
      for(const [field,offset] of Object.entries(byteFields)){
        if(!(field in values))continue;
        const value=Number(values[field]);
        if(!Number.isInteger(value)||value<0||value>0xff)throw new RangeError(`Crystal ${field} must be an unsigned byte.`);
        next[offset]=value;
      }
      if("eggGroup1" in values||"eggGroup2" in values){
        const first=Number(values.eggGroup1),second=Number(values.eggGroup2);
        if(!Number.isInteger(first)||first<0||first>15||!Number.isInteger(second)||second<0||second>15)throw new RangeError("Crystal egg groups must be 0–15.");
        next[23]=first<<4|second;
      }
      return next;
    }

    baseEditPlan(id,values){
      const current=this.base(id),before=this.memory.slice(current.offset,this.constructor.BASE_SIZE),after=this.constructor.encodeBase(current,values);
      return Object.freeze({current,offset:current.offset,before,after});
    }

    cryEditPlan(id,values){
      const cry=this.cry(id);
      return Object.freeze({offset:cry.offset,before:this.memory.slice(cry.offset,this.constructor.CRY_SIZE),after:this.constructor.encodeCry(values)});
    }

    resourceGraph(){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder();
      const provenance={repository:this.reader.capabilities?.provenance?.repository||"pret/pokecrystal",manifest:this.reader.capabilities?.provenance?.id||null};
      const rid=(type,key)=>resources.ResourceId.create("gen2",type,String(key));
      for(let id=1;id<=this.constructor.COUNT;id++){
        const document=this.document(id),sprite=this.frontSprite(id),palette=this.palette(id),speciesId=rid("species",id),baseId=rid("base-stats",id),entryId=rid("pokedex-entry",id),textId=rid("text",`pokedex-${id}`),cryId=rid("cry",id),spriteId=rid("front-sprite",id),paletteId=rid("palette",id);
        builder.addNode({id:speciesId,label:document.name,accuracy:"verified",provenance,ranges:[{offset:document.species.nameOffset,length:10}],data:{speciesId:id}});
        builder.addNode({id:baseId,label:`${document.name} base data`,accuracy:"verified",provenance,ranges:[{offset:document.base.offset,length:this.constructor.BASE_SIZE}],data:{speciesId:id}});
        builder.addNode({id:entryId,label:`${document.name} Pokédex entry`,accuracy:"verified",provenance,ranges:[{offset:document.offset,length:document.end-document.offset}],data:{speciesId:id}});
        builder.addNode({id:textId,label:`${document.name} Pokédex description`,accuracy:"verified",provenance,ranges:[{offset:document.descriptionOffset,length:document.end-document.descriptionOffset}],data:{speciesId:id}});
        builder.addNode({id:cryId,label:`${document.name} cry`,accuracy:"verified",provenance,ranges:[{offset:document.cry.offset,length:this.constructor.CRY_SIZE}],data:{speciesId:id}});
        builder.addNode({id:spriteId,label:`${document.name} front sprite`,accuracy:"verified",provenance,ranges:[{offset:sprite.pointer.pointerOffset,length:3},{offset:sprite.offset,length:sprite.consumed}],data:{speciesId:id,width:sprite.width,height:sprite.height,compressed:true}});
        builder.addNode({id:paletteId,label:`${document.name} normal/shiny palettes`,accuracy:"verified",provenance,ranges:[{offset:palette.entryOffset,length:8}],data:{speciesId:id}});
        for(const [field,target,range] of [
          ["baseStats",baseId,{offset:document.base.offset,length:this.constructor.BASE_SIZE}],
          ["pokedexEntry",entryId,{offset:document.pointerOffset,length:2}],
          ["cry",cryId,{offset:document.cry.offset,length:this.constructor.CRY_SIZE}]
        ])builder.addEdge({id:`${speciesId}/${field}`,source:speciesId,target,field,range,kind:field==="pokedexEntry"?"banked-pointer":"id",confidence:"verified",provenance,rewritePolicy:field==="pokedexEntry"?"rewrite-pointer":"in-place"});
        builder.addEdge({id:`${entryId}/description`,source:entryId,target:textId,field:"description",range:{offset:document.descriptionOffset,length:document.end-document.descriptionOffset},kind:"contains",confidence:"verified",provenance,rewritePolicy:"repoint"});
        builder.addEdge({id:`${cryId}/species`,source:cryId,target:speciesId,field:"species",kind:"id",confidence:"verified",provenance,rewritePolicy:"immutable"});
        builder.addEdge({id:`${speciesId}/frontSprite`,source:speciesId,target:spriteId,field:"frontSprite",range:{offset:sprite.pointer.pointerOffset,length:3},kind:"banked-pointer",confidence:"verified",provenance,rewritePolicy:"repoint"});
        builder.addEdge({id:`${speciesId}/palette`,source:speciesId,target:paletteId,field:"palette",range:{offset:palette.entryOffset,length:8},kind:"offset",confidence:"verified",provenance,rewritePolicy:"in-place"});
        builder.addEdge({id:`${spriteId}/palette`,source:spriteId,target:paletteId,field:"palette",kind:"id",confidence:"verified",provenance,rewritePolicy:"immutable"});
      }
      return builder.build();
    }
  }

  root.gen2=Object.freeze({...root.gen2,Gen2SpeciesData});
})(globalThis);
