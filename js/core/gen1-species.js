(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});
  const TYPE_NAMES=Object.freeze({
    0x00:"Normal",0x01:"Fighting",0x02:"Flying",0x03:"Poison",
    0x04:"Ground",0x05:"Rock",0x07:"Bug",0x08:"Ghost",
    0x14:"Fire",0x15:"Water",0x16:"Grass",0x17:"Electric",
    0x18:"Psychic",0x19:"Ice",0x1a:"Dragon"
  });
  const GROWTH_NAMES=Object.freeze([
    "Medium Fast","Slightly Fast","Slightly Slow","Medium Slow","Fast","Slow"
  ]);
  const ZERO_RUN_BASE=Object.freeze([
    0x0001,0x0003,0x0007,0x000f,0x001f,0x003f,0x007f,0x00ff,
    0x01ff,0x03ff,0x07ff,0x0fff,0x1fff,0x3fff,0x7fff,0xffff
  ]);
  const GRAY_CODES=Object.freeze([
    Object.freeze([0x0,0x1,0x3,0x2,0x7,0x6,0x4,0x5,0xf,0xe,0xc,0xd,0x8,0x9,0xb,0xa]),
    Object.freeze([0xf,0xe,0xc,0xd,0x8,0x9,0xb,0xa,0x0,0x1,0x3,0x2,0x7,0x6,0x4,0x5])
  ]);

  class Gen1BitReader {
    constructor(memory,offset){
      if(!(memory instanceof RomMemory))throw new TypeError("Gen I picture decoder requires RomMemory.");
      memory.assertRange(offset);this.memory=memory;this.offset=offset;this.bit=0;
    }
    read(){
      const byte=this.offset+(this.bit>>3);this.memory.assertRange(byte);
      const value=this.memory.u8(byte)>>(7-(this.bit&7))&1;this.bit++;return value;
    }
    integer(count){
      if(!Number.isInteger(count)||count<0||count>24)throw new RangeError("Invalid compressed-picture integer width.");
      let value=0;while(count--)value=value<<1|this.read();return value;
    }
    get consumed(){return Math.ceil(this.bit/8);}
  }

  class Gen1PicCodec {
    static fillPlane(bits,width){
      const groupCount=width*width*0x20,groups=new Uint8Array(groupCount);
      let literal=Boolean(bits.read()),length=0;
      while(length<groupCount){
        if(literal){
          while(length<groupCount){
            const group=bits.integer(2);
            if(group===0)break;
            groups[length++]=group;
          }
        }else{
          let prefix=0;
          while(bits.read()){
            if(++prefix>=ZERO_RUN_BASE.length)throw new Error("Invalid Gen I picture zero run.");
          }
          let count=ZERO_RUN_BASE[prefix]+bits.integer(prefix+1);
          if(count<1||length+count>groupCount)throw new Error("Gen I picture zero run exceeds its plane.");
          length+=count;
        }
        literal=!literal;
      }
      const ordered=new Uint8Array(groupCount);let cursor=0;
      for(let y=0;y<width;y++)for(let x=0;x<width*8;x++)for(let part=0;part<4;part++){
        ordered[cursor++]=groups[(y*4+part)*width*8+x];
      }
      const plane=new Uint8Array(width*width*8);
      for(let index=0;index<groupCount;index+=4){
        plane[index>>2]=ordered[index]<<6|ordered[index+1]<<4|ordered[index+2]<<2|ordered[index+3];
      }
      return plane;
    }

    static uncompressPlane(plane,width){
      for(let x=0;x<width*8;x++){
        let bit=0;
        for(let y=0;y<width;y++){
          const index=y*width*8+x,high=GRAY_CODES[bit][plane[index]>>4&0xf];
          bit=high&1;
          const low=GRAY_CODES[bit][plane[index]&0xf];bit=low&1;
          plane[index]=high<<4|low;
        }
      }
    }

    static transpose(bytes,width){
      const tileCount=width*width;
      for(let index=0;index<tileCount;index++){
        const target=(index*width+Math.floor(index/width))%tileCount;
        if(index>=target)continue;
        for(let byte=0;byte<16;byte++){
          const left=index*16+byte,right=target*16+byte,value=bytes[left];
          bytes[left]=bytes[right];bytes[right]=value;
        }
      }
    }

    static decode(memory,offset){
      const bits=new Gen1BitReader(memory,offset),width=bits.integer(4),height=bits.integer(4);
      if(width<1||width>15||height!==width)throw new Error("Gen I Pokémon pictures must be square and 1–15 tiles wide.");
      const order=bits.read(),planes=[],modeBits=[];
      planes[order]=this.fillPlane(bits,width);
      let mode=bits.read();if(mode)mode+=bits.read();
      planes[order^1]=this.fillPlane(bits,width);
      this.uncompressPlane(planes[order],width);
      if(mode!==1)this.uncompressPlane(planes[order^1],width);
      if(mode!==0)for(let index=0;index<planes[0].length;index++)planes[order^1][index]^=planes[order][index];
      const bytes=new Uint8Array(width*width*16);
      for(let index=0;index<planes[0].length;index++){
        bytes[index*2]=planes[0][index];bytes[index*2+1]=planes[1][index];
      }
      this.transpose(bytes,width);
      modeBits.push(mode);
      return Object.freeze({width,height,bytes,consumed:bits.consumed,mode,order});
    }
  }

  class Gen1SpeciesData {
    static BASE_SIZE=28;
    static INTERNAL_MEW=0x15;
    static TYPE_IDS=Object.freeze(Object.keys(TYPE_NAMES).map(Number));

    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.catalog=root.species.forReader(reader,"gbc");
      this.text=new global.GbcTextCodec(this.memory,reader.getDictionary(reader.textDictionary));
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["BaseStats","MewBaseStats","PokedexEntryPointers","PokedexOrder","CryData"]){
        if(!Number.isInteger(this.symbols[name]?.offset))throw new Error(`Gen I source manifest is missing ${name}.`);
      }
      this.byDex=new Map();
      for(const species of this.catalog.list())if(species.dexNumber&&!this.byDex.has(species.dexNumber))this.byDex.set(species.dexNumber,species);
      global.ProjectValidator?.registerDomain(reader,"gen1-species",()=>this.validate());
    }

    static encodeMeasurements({feet,inches,weight}={}){
      const safeFeet=CoreUtils.integer(Number(feet),{name:"Height (feet)",min:0,max:255});
      const safeInches=CoreUtils.integer(Number(inches),{name:"Height (inches)",min:0,max:11});
      const safeWeight=CoreUtils.integer(Number(weight),{name:"Weight",min:0,max:65535});
      return Uint8Array.of(safeFeet,safeInches,safeWeight&0xff,safeWeight>>8);
    }

    static encodeBase(before,values={}){
      if(!(before instanceof Uint8Array)||before.length!==this.BASE_SIZE)throw new TypeError("Gen I base data requires one exact 28-byte record.");
      const after=before.slice(),byte=(name,label=name)=>CoreUtils.integer(Number(values[name]),{name:label,min:0,max:255});
      after[1]=byte("hp","HP");after[2]=byte("attack","Attack");after[3]=byte("defense","Defense");
      after[4]=byte("speed","Speed");after[5]=byte("special","Special");
      for(const [name,index,label] of [["type1",6,"Primary type"],["type2",7,"Secondary type"]]){
        const value=byte(name,label);
        if(!this.TYPE_IDS.includes(value))throw new RangeError(`${label} is not a valid Red/Blue type.`);
        after[index]=value;
      }
      after[8]=byte("catchRate","Catch rate");after[9]=byte("baseExperience","Base experience");
      for(let index=0;index<4;index++){
        const value=byte(`move${index+1}`,`Starting move ${index+1}`);
        if(value>165)throw new RangeError(`Starting move ${index+1} must be NO_MOVE (0) or a valid move ID (1–165).`);
        after[15+index]=value;
      }
      const growth=byte("growthRate","Growth rate");
      if(growth>=GROWTH_NAMES.length)throw new RangeError("Growth rate must be one of the six Red/Blue growth curves.");
      after[19]=growth;
      return after;
    }

    speciesByDex(dexNumber){return this.byDex.get(dexNumber)||null;}
    validate(){
      for(let dexNumber=1;dexNumber<=151;dexNumber++){
        const document=this.document(dexNumber),base=document.base;
        if(!this.constructor.TYPE_IDS.includes(base.type1)||!this.constructor.TYPE_IDS.includes(base.type2))throw new Error(`${document.name} has an invalid type.`);
        if(base.growthRate>=GROWTH_NAMES.length)throw new Error(`${document.name} has an invalid growth rate.`);
        if(base.startingMoves.some(move=>move>165))throw new Error(`${document.name} has an invalid starting move.`);
        this.frontSprite(document.species,base);this.backSprite(document.species,base);
      }
      return[];
    }
    typeName(value){return TYPE_NAMES[value]||`Type ${MemoryUtils.hex(value)}`;}
    growthName(value){return GROWTH_NAMES[value]||`Growth ${value}`;}

    machineCompatible(base,index){
      if(!base||!Number.isInteger(index)||index<1||index>55)throw new RangeError("Gen I machine index must be 1–55.");
      const bit=index-1;return Boolean(base.tmHm[bit>>3]&(1<<(bit&7)));
    }

    machineIndexes(base){
      return Object.freeze(Array.from({length:55},(_,index)=>index+1).filter(index=>this.machineCompatible(base,index)));
    }

    encodeMachines(base,indexes){
      if(!base?.tmHm||base.tmHm.length!==7)throw new TypeError("Gen I base stats require seven TM/HM bytes.");
      const selected=new Set(Array.from(indexes||[],Number));
      for(const index of selected)if(!Number.isInteger(index)||index<1||index>55)throw new RangeError("Gen I machine index must be 1–55.");
      const bytes=new Uint8Array(7);
      for(const index of selected){const bit=index-1;bytes[bit>>3]|=1<<(bit&7);}
      bytes[6]|=base.tmHm[6]&0x80;
      return bytes;
    }

    baseStats(species){
      if(!species?.dexNumber)return null;
      const offset=species.dexNumber===151
        ?this.symbols.MewBaseStats.offset
        :this.symbols.BaseStats.offset+(species.dexNumber-1)*this.constructor.BASE_SIZE;
      this.memory.assertRange(offset,this.constructor.BASE_SIZE);
      const dexNumber=this.memory.u8(offset);
      if(dexNumber!==species.dexNumber)throw new Error(`Base stats at ${MemoryUtils.hex(offset,6)} belong to Pokédex #${dexNumber}, not #${species.dexNumber}.`);
      return Object.freeze({
        offset,dexNumber,
        hp:this.memory.u8(offset+1),attack:this.memory.u8(offset+2),defense:this.memory.u8(offset+3),
        speed:this.memory.u8(offset+4),special:this.memory.u8(offset+5),
        type1:this.memory.u8(offset+6),type2:this.memory.u8(offset+7),
        catchRate:this.memory.u8(offset+8),baseExperience:this.memory.u8(offset+9),
        dimensions:this.memory.u8(offset+10),
        frontAddress:this.memory.u16(offset+11),backAddress:this.memory.u16(offset+13),
        startingMoves:Object.freeze(Array.from({length:4},(_,index)=>this.memory.u8(offset+15+index))),
        growthRate:this.memory.u8(offset+19),
        tmHm:Object.freeze(Array.from(this.memory.slice(offset+20,7)))
      });
    }

    baseEditPlan(species,values){
      const base=this.baseStats(species);
      if(!base)throw new TypeError("Gen I Base Stats require a canonical species.");
      const before=this.memory.slice(base.offset,this.constructor.BASE_SIZE);
      const after=this.constructor.encodeBase(before,values);
      return Object.freeze({species,base,offset:base.offset,before,after});
    }

    pictureBank(internalId){
      if(internalId===this.constructor.INTERNAL_MEW)return 0x01;
      if(internalId<=0x1e)return 0x09;
      if(internalId<=0x49)return 0x0a;
      if(internalId<0x74)return 0x0b;
      if(internalId<0x99)return 0x0c;
      return 0x0d;
    }

    frontSprite(species,base=this.baseStats(species)){
      if(!base)return null;
      const bank=this.pictureBank(species.internalId),offset=this.memory.banked(bank,base.frontAddress);
      const decoded=Gen1PicCodec.decode(this.memory,offset);
      const expectedWidth=base.dimensions&0xf,expectedHeight=base.dimensions>>4;
      if(decoded.width!==expectedWidth||decoded.height!==expectedHeight)throw new Error(`Front sprite dimensions disagree with base stats for ${species.name}.`);
      return Object.freeze({...decoded,offset,bank,address:base.frontAddress});
    }

    backSprite(species,base=this.baseStats(species)){
      if(!base)return null;
      const bank=this.pictureBank(species.internalId),offset=this.memory.banked(bank,base.backAddress);
      const decoded=Gen1PicCodec.decode(this.memory,offset);
      if(decoded.width!==4||decoded.height!==4)throw new Error(`Back sprite dimensions disagree with the native 4×4 layout for ${species.name}.`);
      return Object.freeze({...decoded,offset,bank,address:base.backAddress,nativeScale:2});
    }

    cry(species){
      const offset=this.symbols.CryData.offset+(species.internalId-1)*3;
      this.memory.assertRange(offset,3);
      return Object.freeze({offset,baseCry:this.memory.u8(offset),pitch:this.memory.u8(offset+1),length:this.memory.u8(offset+2)});
    }

    static encodeCry({baseCry,pitch,length}={}){
      const values=[baseCry,pitch,length].map((value,index)=>{
        const number=Number(value),label=["base cry","pitch","length"][index];
        if(!Number.isInteger(number)||number<0||number>0xff)throw new RangeError(`Gen I ${label} must be an unsigned byte.`);
        return number;
      });
      return Uint8Array.from(values);
    }

    cryEditPlan(species,values){
      const current=this.cry(species),before=this.memory.slice(current.offset,3),after=this.constructor.encodeCry(values);
      return Object.freeze({species,current,offset:current.offset,before,after});
    }

    dexEntry(species){
      const pointerOffset=this.symbols.PokedexEntryPointers.offset+(species.internalId-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const bank=this.symbols.PokedexEntryPointers.bank,address=this.memory.u16(pointerOffset),offset=this.memory.banked(bank,address);
      let cursor=offset;
      while(this.memory.u8(cursor)!==0x50){
        if(++cursor-offset>32)throw new Error(`Pokédex category at ${MemoryUtils.hex(offset,6)} is not terminated.`);
        this.memory.assertRange(cursor);
      }
      const category=this.reader.getTextByOffset(this.reader.getDictionary(this.reader.textDictionary),offset,cursor-offset).trim();
      const measurementOffset=cursor+1;this.memory.assertRange(measurementOffset,9);
      const feet=this.memory.u8(measurementOffset),inches=this.memory.u8(measurementOffset+1),weight=this.memory.u16(measurementOffset+2);
      const command=this.memory.u8(measurementOffset+4);
      if(command!==0x17)throw new Error(`Pokédex entry at ${MemoryUtils.hex(offset,6)} has unsupported text command ${MemoryUtils.hex(command)}.`);
      const descriptionAddress=this.memory.u16(measurementOffset+5),descriptionBank=this.memory.u8(measurementOffset+7);
      const descriptionOffset=this.memory.banked(descriptionBank,descriptionAddress);
      if(this.memory.u8(measurementOffset+8)!==0x50)throw new Error(`Pokédex entry at ${MemoryUtils.hex(offset,6)} has no text_end.`);
      const description=this.text.decode(descriptionOffset,{limit:512});
      return Object.freeze({
        offset,pointerOffset,category,measurementOffset,feet,inches,weight,
        descriptionOffset,descriptionAddress,descriptionBank,description
      });
    }

    document(dexNumber){
      const species=this.speciesByDex(dexNumber);if(!species)return null;
      const base=this.baseStats(species),entry=this.dexEntry(species),cry=this.cry(species);
      return Object.freeze({
        id:dexNumber,internalId:species.internalId,name:species.name,species,
        offset:entry.offset,category:entry.category,feet:entry.feet,inches:entry.inches,weight:entry.weight,
        measurementOffset:entry.measurementOffset,descriptionOffset:entry.descriptionOffset,description:entry.description,
        base,cry
      });
    }

    resourceGraph({dexNumbers=null}={}){
      const resources=root.resources;
      if(!resources?.ResourceGraphBuilder)throw new Error("Resource graph library is not loaded.");
      const builder=new resources.ResourceGraphBuilder(),family="gen1";
      const source={repository:this.reader.capabilities?.provenance?.repository||"pret/pokered",manifest:this.reader.capabilities?.provenance?.id||null};
      const id=(type,key)=>resources.ResourceId.create(family,type,key);
      const edge=(sourceId,field,target,options={})=>builder.addEdge({
        id:`${sourceId}/${field}`,source:sourceId,target,field,
        confidence:"verified",provenance:source,rewritePolicy:"immutable",...options
      });

      const selected=dexNumbers==null
        ?Array.from({length:151},(_,index)=>index+1)
        :Array.from(new Set(dexNumbers.map(Number)));
      for(const dexNumber of selected){
        if(!Number.isInteger(dexNumber)||dexNumber<1||dexNumber>151)throw new RangeError(`Invalid Gen I Pokédex number ${dexNumber}.`);
        const species=this.speciesByDex(dexNumber);
        if(!species)throw new Error(`Gen I Pokédex #${dexNumber} has no canonical internal species mapping.`);
        const document=this.document(species.dexNumber),key=String(species.dexNumber);
        const speciesId=id("species",key),baseId=id("base-stats",key),dexId=id("pokedex-entry",key);
        const cryId=id("cry",String(species.internalId)),spriteId=id("front-sprite",key),backSpriteId=id("back-sprite",key),textId=id("text",`pokedex-${key}`);
        const base=document.base,entry=this.dexEntry(species),cry=document.cry;
        const sprite=this.frontSprite(species,base),backSprite=this.backSprite(species,base);
        builder.addNode({id:speciesId,label:species.name,accuracy:"verified",provenance:source,data:{dexNumber:species.dexNumber,internalId:species.internalId}});
        builder.addNode({
          id:baseId,label:`${species.name} base stats`,accuracy:"verified",provenance:source,
          ranges:[{offset:base.offset,length:this.constructor.BASE_SIZE}],
          writeRanges:[
            {offset:base.offset+1,length:9},
            {offset:base.offset+15,length:12}
          ],
          data:{dexNumber:species.dexNumber}
        });
        builder.addNode({id:dexId,label:`${species.name} Pokédex entry`,accuracy:"verified",provenance:source,ranges:[
          {offset:entry.pointerOffset,length:2},{offset:entry.offset,length:entry.measurementOffset+9-entry.offset}
        ],data:{dexNumber:species.dexNumber,descriptionOffset:entry.descriptionOffset}});
        builder.addNode({id:textId,label:`${species.name} Pokédex description`,accuracy:"verified",provenance:source,ranges:[
          {offset:entry.descriptionOffset,length:Math.max(1,entry.description.length)}
        ],data:{dexNumber:species.dexNumber,encoding:"gen1-text"}});
        builder.addNode({
          id:cryId,label:`${species.name} cry`,accuracy:"verified",provenance:source,
          ranges:[{offset:cry.offset,length:3}],writeRanges:[{offset:cry.offset,length:3}],
          data:{internalId:species.internalId}
        });
        builder.addNode({id:spriteId,label:`${species.name} front sprite`,accuracy:"verified",provenance:source,ranges:[{offset:sprite.offset,length:sprite.consumed}],data:{width:sprite.width,height:sprite.height,bank:sprite.bank}});
        builder.addNode({id:backSpriteId,label:`${species.name} back sprite`,accuracy:"verified",provenance:source,ranges:[{offset:backSprite.offset,length:backSprite.consumed}],data:{width:backSprite.width,height:backSprite.height,bank:backSprite.bank,nativeScale:2}});
        edge(speciesId,"baseStats",baseId,{kind:"contains",range:{offset:base.offset,length:this.constructor.BASE_SIZE},rewritePolicy:"in-place"});
        edge(speciesId,"pokedexEntry",dexId,{kind:"contains"});
        edge(speciesId,"cry",cryId,{kind:"id",range:{offset:cry.offset,length:3},rewritePolicy:"in-place"});
        edge(speciesId,"frontSprite",spriteId,{kind:"pointer",range:{offset:base.offset+11,length:2},rewritePolicy:"rewrite-pointer"});
        edge(speciesId,"backSprite",backSpriteId,{kind:"pointer",range:{offset:base.offset+13,length:2},rewritePolicy:"rewrite-pointer"});
        edge(dexId,"description",textId,{kind:"banked-pointer",range:{offset:entry.measurementOffset+5,length:3},rewritePolicy:"rewrite-pointer"});
        edge(dexId,"species",speciesId,{kind:"id",range:{offset:entry.pointerOffset,length:2}});
        edge(cryId,"species",speciesId,{kind:"id"});
        edge(spriteId,"species",speciesId,{kind:"derived"});
        edge(backSpriteId,"species",speciesId,{kind:"derived"});
      }
      return builder.build();
    }
  }

  root.gen1=Object.freeze({Gen1PicCodec,Gen1SpeciesData,TYPE_NAMES,GROWTH_NAMES});
})(globalThis);
