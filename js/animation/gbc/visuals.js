(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  const DMG=Object.freeze(["#e0f8cf","#86c06c","#306850","#071821"]);
  const signed=value=>value>127?value-256:value;
  const paintTile=(image,width,pixels,originX,originY,attributes)=>{
    const flipX=Boolean(attributes&0x20),flipY=Boolean(attributes&0x40);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const colorIndex=pixels[(flipY?7-y:y)*8+(flipX?7-x:x)],px=originX+x,py=originY+y;
      if(colorIndex===0||px<0||py<0||px>=width||py>=image.height)continue;
      const color=Number.parseInt(DMG[colorIndex].slice(1),16),target=(py*width+px)*4;
      image.data.set([color>>16&255,color>>8&255,color&255,255],target);
    }
  };
  class Gen1BattleAnimationVisuals{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=reader.memoryProfile;this.cache=new Map();
      this.tilesets=this.require("MoveAnimationTilesPointers");
      this.subanimations=this.require("SubanimationPointers");
      this.frameBlocks=this.require("FrameBlockPointers");
      this.baseCoords=this.require("FrameBlockBaseCoords");
    }
    require(name){
      const symbol=this.profile?.symbol(name);
      if(!Number.isInteger(symbol?.offset))throw new Error(`Red/Blue source dictionary is missing ${name}.`);
      return symbol;
    }
    pointer(symbol,at){return this.memory.banked(symbol.bank,this.memory.u16(at));}
    tileset(id){
      const at=this.tilesets.offset+id*4;this.memory.assertRange(at,4);
      const count=this.memory.u8(at),offset=this.pointer(this.tilesets,at+1);
      this.memory.assertRange(offset,count*16);
      return Object.freeze({id,count,offset,bytes:this.memory.slice(offset,count*16)});
    }
    frame(frameBlockId,baseCoordId,tileset,transform){
      const pointerAt=this.frameBlocks.offset+frameBlockId*2,frameOffset=this.pointer(this.frameBlocks,pointerAt);
      const count=this.memory.u8(frameOffset),baseAt=this.baseCoords.offset+baseCoordId*2;
      this.memory.assertRange(frameOffset+1,count*4);this.memory.assertRange(baseAt,2);
      let baseY=this.memory.u8(baseAt),baseX=this.memory.u8(baseAt+1);
      const canvas=document.createElement("canvas");canvas.width=160;canvas.height=112;
      const context=canvas.getContext("2d"),image=context.createImageData(canvas.width,canvas.height),source=new RomMemory(tileset.bytes);
      for(let item=0;item<count;item++){
        const entry=frameOffset+1+item*4,dy=signed(this.memory.u8(entry)),dx=signed(this.memory.u8(entry+1));
        const tile=this.memory.u8(entry+2),attributes=this.memory.u8(entry+3);
        let y=baseY+dy-16,x=baseX+dx-8,flags=attributes;
        if(transform===1){y=120-(baseY+dy)-16;x=160-(baseX+dx)-8;flags^=0x60;}
        else if(transform===2){y=baseY+dy+24;x=160-(baseX+dx)-8;flags^=0x20;}
        else if(transform===3){y=120-baseY+dy-16;x=160-baseX+dx-8;}
        if(tile>=tileset.count)continue;
        paintTile(image,canvas.width,GbcSpriteCodec.decodeTile(source,tile*16),x,y,flags);
      }
      context.putImageData(image,0,0);
      return Object.freeze({canvas,width:canvas.width,height:canvas.height,frameBlockId,baseCoordId,count});
    }
    subanimation(id,tilesetId){
      const key=`${id}:${tilesetId}`;if(this.cache.has(key))return this.cache.get(key);
      const pointerAt=this.subanimations.offset+id*2,offset=this.pointer(this.subanimations,pointerAt),header=this.memory.u8(offset);
      const count=header&0x1f,transform=header>>>5,tileset=this.tileset(tilesetId);
      this.memory.assertRange(offset+1,count*3);
      const frames=Array.from({length:count},(_,index)=>{
        const at=offset+1+index*3;
        return this.frame(this.memory.u8(at),this.memory.u8(at+1),tileset,transform);
      });
      const source=ns.sourceCatalog?.gen1?.[id],asset=Object.freeze({
        id,tilesetId,offset,transform,frames,canvas:frames[0]?.canvas||null,width:160,height:112,sceneOverlay:true,
        name:source?.name||`Subanimation ${id}`,symbol:source?.symbol||null,
        sourceEncoding:"SubanimationPointers → FrameBlockPointers → FrameBlockBaseCoords + MoveAnimationTilesPointers · native 2bpp/OAM"
      });
      this.cache.set(key,asset);return asset;
    }
    decorate(commands){
      return commands.map(command=>{
        if(command.opcode>=0xc0)return command;
        const event={...(command.event||{})},asset=this.subanimation(Number(command.args?.[3]),Number(command.args?.[1])),
          frameDuration=Math.max(1,Number(command.duration)||1),
          frames=Object.freeze(asset.frames.map(frame=>Object.freeze({...frame,duration:frameDuration}))),
          timedAsset=Object.freeze({...asset,frames});
        // PlaySubanimation draws every three-byte frame record, then waits the
        // delay encoded in the battle_anim command. The command therefore
        // lasts frameCount × delay, not merely one delay.
        event.value=Object.freeze({...event.value,asset:timedAsset,label:asset.name,frames});
        event.asset=asset;event.transient=true;
        return Object.freeze({...command,duration:Math.max(1,frames.length)*frameDuration,event:Object.freeze(event)});
      });
    }
  }
  ns.Gen1BattleAnimationVisuals=Gen1BattleAnimationVisuals;
})(globalThis);
