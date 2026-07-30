(function(global){
  "use strict";
  const ns=global.PokemonViewer.animation;
  const START=10000,COUNT=289;
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
      this.pictureTable=this.findPictureTable();this.paletteTable=this.findPaletteTable();
      if(!Number.isInteger(this.pictureTable)||!Number.isInteger(this.paletteTable))throw new Error("Emerald battle-animation graphic tables were not detected.");
    }
    findPictureTable(){
      for(let offset=0;offset<=this.memory.size-16;offset+=4){
        if(this.memory.u16(offset+4)===0x200&&this.memory.u16(offset+6)===START&&this.memory.u16(offset+12)===0x300&&this.memory.u16(offset+14)===START+1)return offset;
      }
      return null;
    }
    findPaletteTable(){
      for(let offset=0;offset<=this.memory.size-24;offset+=4){
        if(this.memory.u16(offset+4)===START&&this.memory.u16(offset+12)===START+1&&this.memory.u16(offset+20)===START+2)return offset;
      }
      return null;
    }
    paletteRecord(tag){
      for(let index=0;index<COUNT;index++){
        const offset=this.paletteTable+index*8;
        if(!this.memory.contains(offset,8))break;
        if(this.memory.u16(offset+4)!==tag)continue;
        const paletteOffset=this.memory.pointer(offset);
        return paletteOffset===null?null:Object.freeze({offset,paletteOffset,tag,index});
      }
      return null;
    }
    record(tag){
      const index=tag-START;if(!Number.isInteger(index)||index<0||index>=COUNT)return null;
      const pictureRecord=this.pictureTable+index*8,palette=this.paletteRecord(tag);
      const graphic=this.memory.pointer(pictureRecord),declaredSize=this.memory.u16(pictureRecord+4),pictureTag=this.memory.u16(pictureRecord+6);
      if(pictureTag!==tag||graphic===null||!palette)return null;
      return Object.freeze({tag,index,pictureRecord,paletteRecord:palette.offset,graphic,paletteOffset:palette.paletteOffset,paletteTag:palette.tag,declaredSize});
    }
    template(offset){
      if(!Number.isInteger(offset)||!this.memory.contains(offset,24))return null;
      const tileTag=this.memory.u16(offset),paletteTag=this.memory.u16(offset+2),oam=this.memory.pointer(offset+4),
        anims=this.memory.pointer(offset+8),affineAnims=this.memory.pointer(offset+16),callback=this.memory.pointer(offset+20);
      if(oam===null||!this.memory.contains(oam,4))return Object.freeze({offset,tileTag,paletteTag,width:32,height:32});
      const attr0=this.memory.u16(oam),attr1=this.memory.u16(oam+2),[width,height]=dimensions(attr0>>>14&3,attr1>>>14&3);
      return Object.freeze({offset,tileTag,paletteTag,oam,anims,affineAnims,callback,width,height,affine:Boolean(attr0&0x0100)});
    }
    affineFrames(template,index){
      if(!template?.affine||!Number.isInteger(template.affineAnims)||!Number.isInteger(index)||index<0||index>31)return Object.freeze([]);
      const pointerAt=template.affineAnims+index*4;
      if(!this.memory.contains(pointerAt,4))return Object.freeze([]);
      const start=this.memory.pointer(pointerAt);
      if(!Number.isInteger(start)||!this.memory.contains(start,8))return Object.freeze([]);
      const commands=[],frames=[];let cursor=start,xScale=0x100,yScale=0x100,rotation=0,loops=0;
      for(let step=0;step<64&&this.memory.contains(cursor,8);step++){
        const type=this.memory.u16(cursor);
        if(type===AFFINE_END)break;
        if(type===AFFINE_JUMP){
          const target=this.memory.u16(cursor+2);
          if(target>=64)break;
          cursor=start+target*8;continue;
        }
        if(type===AFFINE_LOOP){
          if(++loops>4)break;
          cursor=start;continue;
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
    asset(tag,{template=null}={}){
      const key=`${tag}:${template?.width||0}:${template?.height||0}`;if(this.cache.has(key))return this.cache.get(key);
      const record=this.record(tag);if(!record)return null;
      const graphic=global.PokemonViewer.gba.GbaLz77.decode(this.memory,record.graphic,{maxOutput:0x10000}).bytes;
      const paletteBytes=global.PokemonViewer.gba.GbaLz77.decode(this.memory,record.paletteOffset,{maxOutput:0x400}).bytes;
      const palette=Object.freeze(Array.from({length:16},(_,index)=>GbaSpriteCodec.decodeColor(paletteBytes[index*2]|paletteBytes[index*2+1]<<8)));
      let width=template?.width,height=template?.height;
      if(!width||!height||width*height/2>graphic.length){const [columns,rows]=bestDimensions(Math.floor(graphic.length/32));width=columns*8;height=rows*8;}
      const source=ns.sourceCatalog?.gba?.[tag],asset=Object.freeze({...record,width,height,bytes:graphic,palette,canvas:toCanvas(graphic,palette,width,height),
        name:source?.name||`Battle effect ${tag-START}`,symbol:source?.symbol||null,sourceEncoding:"gBattleAnimPicTable + gBattleAnimPaletteTable · LZ77 · native 4bpp"});
      this.cache.set(key,asset);return asset;
    }
    decorate(commands){
      const loaded=new Map();
      return commands.map(command=>{
        const event={...(command.event||{})};
        if(command.opcode===0x00){
          const tag=Number(command.args?.[0]),asset=this.asset(tag);if(asset){loaded.set(tag,asset);event.value=asset;event.asset=asset;}
        }else if(command.opcode===0x01){
          const tag=Number(command.args?.[0]);event.value=loaded.get(tag)||`Battle effect ${tag-START}`;event.remove=true;
        }else if(command.opcode===0x02){
          const template=this.template(Number(command.args?.[0])),asset=this.asset(template?.tileTag,{template});
          const values=(command.args||[]).slice(2).map(Number),x=(values[0]<<16>>16)||0,y=(values[1]<<16>>16)||0;
          const relativeTo=values.length===4?values[2]:null,affineIndex=values.length===4?values[3]:null,
            affineFrames=this.affineFrames(template,affineIndex),transient=Boolean(affineFrames.length&&values.length===4);
          const visualAsset=asset&&affineFrames.length?Object.freeze({...asset,frames:Object.freeze(affineFrames.map(frame=>Object.freeze({...frame,canvas:asset.canvas})))}):asset;
          event.value=Object.freeze({id:`sprite-${command.offset}`,label:asset?.name||`Sprite template ${MemoryUtils.hex(template?.offset||0,6)}`,asset:visualAsset,template,x,y,anchor:relativeTo===0?"user":"target"});
          event.transient=transient;
          event.asset=asset;
        }
        return Object.freeze({...command,event:Object.freeze(event)});
      });
    }
  }
  ns.GbaBattleAnimationVisuals=GbaBattleAnimationVisuals;
})(globalThis);
