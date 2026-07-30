(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  // Offset-free engine contract reviewed against pret/pokeemerald and
  // pret/pokefirered. Both engines expose 289 sequential compressed sheets
  // and palettes beginning at ANIM_SPRITES_START. ROM hacks may relocate the
  // tables; their complete record invariants remain the discovery authority.
  const ASSET_CONTRACT=Object.freeze({
    firstTag:10000,count:289,recordSize:8,
    picture:Object.freeze({pointer:0,size:4,tag:6}),
    palette:Object.freeze({pointer:0,tag:4}),
    // gBattleAnimSpritePal_SapDrip2 deliberately reuses ANIM_TAG_SAP_DRIP.
    paletteTagAliases:Object.freeze({47:46}),
    maximumSheetBytes:0x10000,maximumPaletteBytes:0x400
  });
  const ANIM_LOOP=0xfffd,ANIM_JUMP=0xfffe,ANIM_END=0xffff;
  const AFFINE_LOOP=0x7ffd,AFFINE_JUMP=0x7ffe,AFFINE_END=0x7fff;
  const signed8=value=>value&0x80?value-0x100:value;
  const signed16=value=>value&0x8000?value-0x10000:value;
  const dimensions=(shape,size)=>{
    const table=[
      [[8,8],[16,16],[32,32],[64,64]],
      [[16,8],[32,8],[32,16],[64,32]],
      [[8,16],[8,32],[16,32],[32,64]]
    ];
    return table[shape]?.[size]||[32,32];
  };
  const bestDimensions=tiles=>{
    const choices=[[1,1],[2,1],[1,2],[2,2],[4,2],[2,4],[4,4],[8,4],[4,8],[8,8]];
    return choices.filter(([w,h])=>w*h<=tiles).at(-1)||[1,1];
  };
  const freezeSequence=(frames,{loopStart=null,terminal="hold"}={})=>{
    Object.defineProperties(frames,{
      loopStart:{value:Number.isInteger(loopStart)?loopStart:null,enumerable:false},
      terminal:{value:terminal,enumerable:false}
    });
    return Object.freeze(frames);
  };
  const frameTicks=frames=>frames.flatMap(frame=>Array.from({length:Math.max(1,Number(frame.duration)||1)},()=>frame));
  const frameAt=(frames,ticks,index)=>{
    if(index<ticks.length)return ticks[index];
    if(Number.isInteger(frames.loopStart)){
      const loopTick=frames.slice(0,frames.loopStart).reduce((total,frame)=>total+Math.max(1,Number(frame.duration)||1),0);
      const cycle=ticks.length-loopTick;
      if(cycle>0)return ticks[loopTick+(index-loopTick)%cycle];
    }
    return ticks.at(-1)||null;
  };
  const toCanvas=(bytes,palette,width,height)=>{
    const required=width*height/2,source=bytes.length>=required?bytes.slice(0,required):bytes;
    const pixels=GbaSpriteCodec.decodeImage(source,{width,height}),canvas=document.createElement("canvas"),context=canvas.getContext("2d");
    canvas.width=width;canvas.height=height;const image=context.createImageData(width,height);
    for(let index=0;index<pixels.length;index++){
      const colorIndex=pixels[index],hex=palette[colorIndex]||"#000000",rgb=Number.parseInt(hex.slice(1),16),target=index*4;
      image.data.set([rgb>>16&255,rgb>>8&255,rgb&255,colorIndex===0?0:255],target);
    }
    context.putImageData(image,0,0);return canvas;
  };
  class GbaBattleAnimationVisuals{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.cache=new Map();
      this.callbacks=new ns.GbaAnimationCallbackRegistry(reader);
      this.tasks=new ns.GbaAnimationTaskRegistry(reader);
      const reviewed=reader.memoryProfile?.structure?.("GbaBattleAnimationAssets");
      this.contract=Object.freeze({
        ...ASSET_CONTRACT,...(reviewed||{}),
        picture:Object.freeze({...ASSET_CONTRACT.picture,...(reviewed?.picture||{})}),
        palette:Object.freeze({...ASSET_CONTRACT.palette,...(reviewed?.palette||{})})
      });
      this.pictureTable=this.findPictureTable();this.paletteTable=this.findPaletteTable();
      if(!Number.isInteger(this.pictureTable)||!Number.isInteger(this.paletteTable))throw new Error("Generation III battle-animation graphic tables were not detected.");
    }
    learnTasks(commands,context){this.tasks.learn(commands,context);return commands;}
    symbolOffset(name){
      const offset=this.reader.capabilities?.provenance?.symbols?.[name]?.offset;
      return Number.isInteger(offset)?offset:null;
    }
    validPictureTable(offset){
      const {count,recordSize,firstTag,picture}=this.contract||ASSET_CONTRACT;
      if(!this.memory.contains(offset,count*recordSize))return false;
      for(let index=0;index<count;index++){
        const record=offset+index*recordSize,size=this.memory.u16(record+picture.size);
        if(this.memory.u16(record+picture.tag)!==firstTag+index||size===0||size>ASSET_CONTRACT.maximumSheetBytes||size&0x1f)return false;
        const pointer=this.memory.pointer(record+picture.pointer);
        if(pointer===null||!this.memory.contains(pointer,4)||this.memory.u8(pointer)!==0x10)return false;
      }
      return true;
    }
    validPaletteTable(offset){
      const {count,recordSize,firstTag,palette}=this.contract||ASSET_CONTRACT;
      if(!this.memory.contains(offset,count*recordSize))return false;
      for(let index=0;index<count;index++){
        const record=offset+index*recordSize;
        const expected=firstTag+Number(this.contract.paletteTagAliases?.[index]??index);
        if(this.memory.u16(record+palette.tag)!==expected)return false;
        const pointer=this.memory.pointer(record+palette.pointer);
        if(pointer===null||!this.memory.contains(pointer,4)||this.memory.u8(pointer)!==0x10)return false;
      }
      return true;
    }
    uniqueTable(validate){
      let match=null;
      for(let offset=0;offset<=this.memory.size-this.contract.count*this.contract.recordSize;offset+=4){
        if(!validate.call(this,offset))continue;
        if(match!==null)throw new Error("Ambiguous GBA battle-animation asset tables.");
        match=offset;
      }
      return match;
    }
    findPictureTable(){
      const exact=this.symbolOffset("gBattleAnimPicTable");
      if(exact!==null&&this.validPictureTable(exact))return exact;
      return this.uniqueTable(this.validPictureTable);
    }
    findPaletteTable(){
      const exact=this.symbolOffset("gBattleAnimPaletteTable");
      if(exact!==null&&this.validPaletteTable(exact))return exact;
      return this.uniqueTable(this.validPaletteTable);
    }
    paletteRecord(tag){
      const {count,recordSize,palette}=this.contract||ASSET_CONTRACT;
      for(let index=0;index<count;index++){
        const offset=this.paletteTable+index*recordSize;
        if(!this.memory.contains(offset,recordSize))break;
        if(this.memory.u16(offset+palette.tag)!==tag)continue;
        const paletteOffset=this.memory.pointer(offset+palette.pointer);
        return paletteOffset===null?null:Object.freeze({offset,paletteOffset,tag,index});
      }
      return null;
    }
    record(tag,paletteTag=tag){
      const contract=this.contract||ASSET_CONTRACT,{firstTag,count,recordSize,picture}=contract,index=tag-firstTag;
      if(!Number.isInteger(index)||index<0||index>=count)return null;
      const pictureRecord=this.pictureTable+index*recordSize,paletteRecord=this.paletteRecord(paletteTag);
      const graphic=this.memory.pointer(pictureRecord+picture.pointer),declaredSize=this.memory.u16(pictureRecord+picture.size),pictureTag=this.memory.u16(pictureRecord+picture.tag);
      if(pictureTag!==tag||graphic===null||!paletteRecord)return null;
      return Object.freeze({tag,index,pictureRecord,paletteRecord:paletteRecord.offset,graphic,paletteOffset:paletteRecord.paletteOffset,paletteTag:paletteRecord.tag,declaredSize});
    }
    template(offset){
      if(!Number.isInteger(offset)||!this.memory.contains(offset,24))return null;
      const tileTag=this.memory.u16(offset),paletteTag=this.memory.u16(offset+2),oam=this.memory.pointer(offset+4),
        anims=this.memory.pointer(offset+8),images=this.memory.pointer(offset+12),
        affineAnims=this.memory.pointer(offset+16),callback=this.memory.pointer(offset+20);
      if(oam===null||!this.memory.contains(oam,4))return Object.freeze({offset,tileTag,paletteTag,width:32,height:32});
      const attr0=this.memory.u16(oam),attr1=this.memory.u16(oam+2),[width,height]=dimensions(attr0>>>14&3,attr1>>>14&3);
      return Object.freeze({
        offset,tileTag,paletteTag,oam,anims,images,affineAnims,callback,width,height,
        affine:Boolean(attr0&0x0100),objectMode:attr0>>>10&3
      });
    }
    affineFrames(template,index){
      if(!template?.affine||!Number.isInteger(template.affineAnims)||!Number.isInteger(index)||index<0||index>31)return Object.freeze([]);
      const pointerAt=template.affineAnims+index*4;
      if(!this.memory.contains(pointerAt,4))return Object.freeze([]);
      const start=this.memory.pointer(pointerAt);
      if(!Number.isInteger(start)||!this.memory.contains(start,8))return Object.freeze([]);
      const commands=[],frames=[],loopMarkers=[];let cursor=start,xScale=0x100,yScale=0x100,rotation=0;
      const loopRemaining=new Map();
      for(let step=0;step<64&&this.memory.contains(cursor,8);step++){
        const type=this.memory.u16(cursor);
        if(type===AFFINE_END)break;
        if(type===AFFINE_JUMP){
          const target=this.memory.u16(cursor+2);
          if(target>=64)break;
          cursor=start+target*8;continue;
        }
        if(type===AFFINE_LOOP){
          const count=this.memory.u16(cursor+2);
          if(count===0){
            if(!loopMarkers.includes(cursor))loopMarkers.push(cursor);
            cursor+=8;continue;
          }
          const marker=loopMarkers.filter(offset=>offset<cursor).at(-1);
          if(!Number.isInteger(marker))break;
          if(!loopRemaining.has(cursor))loopRemaining.set(cursor,count);
          const remaining=loopRemaining.get(cursor);
          if(remaining>0){
            loopRemaining.set(cursor,remaining-1);
            cursor=marker+8;continue;
          }
          loopRemaining.delete(cursor);cursor+=8;continue;
        }
        const dx=signed16(type),dy=signed16(this.memory.u16(cursor+2)),dr=signed8(this.memory.u8(cursor+4)),duration=this.memory.u8(cursor+5);
        commands.push(Object.freeze({offset:cursor,dx,dy,dr,duration}));
        if(duration===0){
          xScale=dx||xScale;yScale=dy||yScale;rotation=dr;
        }else{
          for(let tick=0;tick<duration;tick++){
            xScale+=dx;yScale+=dy;rotation=(rotation+dr)&0xff;
            frames.push(Object.freeze({duration:1,scaleX:0x100/Math.max(1,Math.abs(xScale)),scaleY:0x100/Math.max(1,Math.abs(yScale)),rotation:rotation/256*Math.PI*2}));
          }
        }
        cursor+=8;
      }
      return Object.freeze(frames);
    }
    spriteFrames(template,asset,index=0){
      if(!asset||!Number.isInteger(template?.anims)||!Number.isInteger(index)||index<0||index>31)return Object.freeze([]);
      const pointerAt=template.anims+index*4;
      if(!this.memory.contains(pointerAt,4))return Object.freeze([]);
      const start=this.memory.pointer(pointerAt);
      if(!Number.isInteger(start)||!this.memory.contains(start,4))return Object.freeze([]);
      const frames=[],loopMarkers=[],frameOffsets=new Map();let cursor=start,loopStart=null,terminal="hold";
      const loopRemaining=new Map();
      for(let step=0;step<64&&this.memory.contains(cursor,4);step++){
        frameOffsets.set(cursor,frames.length);
        const imageValue=this.memory.u16(cursor),flags=this.memory.u16(cursor+2);
        if(imageValue===ANIM_END)break;
        if(imageValue===ANIM_JUMP){
          const target=flags&0x3f;
          if(target>=64)break;
          const targetOffset=start+target*4;
          // A jump back is a persistent Sprite anim cycle. Preserve the cycle
          // boundary instead of fabricating 64 repeated frames; the native
          // callback decides how many ticks the object actually lives.
          if(targetOffset<=cursor){
            loopStart=frameOffsets.get(targetOffset)??0;terminal="loop";break;
          }
          cursor=targetOffset;continue;
        }
        if(imageValue===ANIM_LOOP){
          const count=flags&0x3f;
          if(count===0){
            if(!loopMarkers.includes(cursor))loopMarkers.push(cursor);
            cursor+=4;continue;
          }
          const marker=loopMarkers.filter(offset=>offset<cursor).at(-1);
          if(!Number.isInteger(marker))break;
          if(!loopRemaining.has(cursor))loopRemaining.set(cursor,count);
          const remaining=loopRemaining.get(cursor);
          if(remaining>0){
            loopRemaining.set(cursor,remaining-1);
            cursor=marker+4;continue;
          }
          loopRemaining.delete(cursor);cursor+=4;continue;
        }
        let bytes=null;
        if(Number.isInteger(template.images)){
          // SpriteFrameImage is {const void *data; u16 size; padding}. When a
          // template supplies this table AnimCmd.imageValue is an array index,
          // not a tile offset (pret/pokeemerald include/sprite.h).
          const imageRecord=template.images+imageValue*8;
          if(!this.memory.contains(imageRecord,6))break;
          const imageOffset=this.memory.pointer(imageRecord),imageSize=this.memory.u16(imageRecord+4);
          if(!Number.isInteger(imageOffset)||!imageSize||!this.memory.contains(imageOffset,imageSize))break;
          bytes=this.memory.slice(imageOffset,imageSize);
        }else{
          const byteOffset=imageValue*32,byteLength=asset.width*asset.height/2;
          if(byteOffset+byteLength>asset.bytes.length)break;
          bytes=asset.bytes.slice(byteOffset,byteOffset+byteLength);
        }
        const hFlip=Boolean(flags&0x40),vFlip=Boolean(flags&0x80),duration=Math.max(1,flags&0x3f);
        frames.push(Object.freeze({
          canvas:toCanvas(bytes,asset.palette,asset.width,asset.height),
          duration,hFlip,vFlip,imageValue
        }));
        cursor+=4;
      }
      return freezeSequence(frames,{loopStart,terminal});
    }
    visualFrames(template,asset,{spriteIndex=0,affineIndex=null,lifetime=null,transforms=[]}={}){
      if(!asset)return Object.freeze([]);
      const sprites=this.spriteFrames(template,asset,spriteIndex),affine=this.affineFrames(template,affineIndex);
      if(!sprites.length){
        if(affine.length||transforms.length){
          const length=Math.max(affine.length,transforms.length),frames=Array.from({length},(_,index)=>Object.freeze({
            ...(affine[Math.min(index,affine.length-1)]||{}),
            ...(transforms[Math.min(index,transforms.length-1)]||{}),
            canvas:asset.canvas,duration:1
          }));
          return Object.freeze(frames);
        }
        return Number.isInteger(lifetime)&&lifetime>0?Object.freeze(Array.from({length:lifetime},()=>Object.freeze({canvas:asset.canvas,duration:1}))):Object.freeze([]);
      }
      const ticks=frameTicks(sprites),verifiedLifetime=Number.isInteger(lifetime)&&lifetime>0?Math.min(1200,lifetime):null,
        length=verifiedLifetime||Math.max(ticks.length,affine.length,transforms.length);
      const combined=Array.from({length},(_,index)=>{
        const sprite=frameAt(sprites,ticks,index)||{canvas:asset.canvas,duration:1},
          affineTransform=affine[Math.min(index,affine.length-1)]||{},
          callbackTransform=transforms[Math.min(index,transforms.length-1)]||{},
          hFlip=callbackTransform.hFlip??sprite.hFlip,vFlip=callbackTransform.vFlip??sprite.vFlip;
        return Object.freeze({...sprite,...affineTransform,...callbackTransform,hFlip,vFlip,duration:1,
          scaleX:(affineTransform.scaleX||1)*(hFlip?-1:1),scaleY:(affineTransform.scaleY||1)*(vFlip?-1:1)});
      });
      return Object.freeze(combined);
    }
    asset(tag,{template=null}={}){
      const paletteTag=Number.isInteger(template?.paletteTag)&&template.paletteTag!==0xffff?template.paletteTag:tag,
        key=`${tag}:${paletteTag}:${template?.width||0}:${template?.height||0}`;if(this.cache.has(key))return this.cache.get(key);
      const record=this.record(tag,paletteTag);if(!record)return null;
      const graphic=global.PokemonViewer.gba.GbaLz77.decode(this.memory,record.graphic,{maxOutput:0x10000}).bytes;
      const paletteBytes=global.PokemonViewer.gba.GbaLz77.decode(this.memory,record.paletteOffset,{maxOutput:0x400}).bytes;
      const palette=Object.freeze(Array.from({length:16},(_,index)=>GbaSpriteCodec.decodeColor(paletteBytes[index*2]|paletteBytes[index*2+1]<<8)));
      let width=template?.width,height=template?.height;
      if(!width||!height||width*height/2>graphic.length){const [columns,rows]=bestDimensions(Math.floor(graphic.length/32));width=columns*8;height=rows*8;}
      const source=ns.sourceCatalog?.gba?.[tag],asset=Object.freeze({...record,width,height,bytes:graphic,palette,canvas:toCanvas(graphic,palette,width,height),
        name:source?.name||`Battle effect ${tag-this.contract.firstTag}`,symbol:source?.symbol||null,sourceEncoding:"gBattleAnimPicTable + gBattleAnimPaletteTable · LZ77 · native 4bpp"});
      this.cache.set(key,asset);return asset;
    }
    decorate(commands){
      const loaded=new Map();
      return commands.map(command=>{
        const event={...(command.event||{})};
        if(command.opcode===0x00){
          const tag=Number(command.args?.[0]),asset=this.asset(tag);if(asset){loaded.set(tag,asset);event.value=asset;event.asset=asset;}
        }else if(command.opcode===0x01){
          const tag=Number(command.args?.[0]);event.value=loaded.get(tag)||`Battle effect ${tag-this.contract.firstTag}`;event.remove=true;
        }else if(command.opcode===0x02){
          const template=this.template(Number(command.args?.[0])),asset=this.asset(template?.tileTag,{template});
          const behavior=this.callbacks.resolve(template,command.native),frames=this.visualFrames(template,asset,{
            spriteIndex:behavior.spriteAnimationIndex||0,
            affineIndex:behavior.affineAnimationIndex,
            lifetime:behavior.lifetime,
            transforms:behavior.transforms
          });
          const visualAsset=behavior.verifiedCallback&&asset
            ?(frames.length?Object.freeze({...asset,frames}):asset)
            :null;
          event.value=Object.freeze({
            id:`sprite-${command.offset}`,label:asset?.name||`Sprite template ${MemoryUtils.hex(template?.offset||0,6)}`,
            asset:visualAsset,template,x:behavior.x,y:behavior.y,anchor:behavior.anchor,
            callback:behavior.callbackSymbol||MemoryUtils.hex(template?.callback||0,6),
            accuracy:behavior.accuracy,diagnostic:behavior.diagnostic||null
          });
          event.transient=behavior.transient;
          event.unresolved=!behavior.verifiedCallback;
          if(behavior.diagnostic)event.note=behavior.diagnostic;
          event.asset=asset;
        }else if(command.opcode===0x03){
          const task=this.tasks.resolve(command);
          if(task){
            event.value=task;
            event.transient=true;
            event.note=`${task.label} · verified native ${task.channel?.startsWith("palette:")?"palette effect":"battler transform"}`;
          }
        }
        return Object.freeze({...command,event:Object.freeze(event)});
      });
    }
  }
  ns.GBA_BATTLE_ANIMATION_ASSET_CONTRACT=ASSET_CONTRACT;
  ns.GbaBattleAnimationVisuals=GbaBattleAnimationVisuals;
})(globalThis);
