(function(global){
  "use strict";
  const frozen=value=>Object.freeze(value);

  class Gen2MapGroupEntry{
    static SIZE=9;
    static read(memory,offset,{group=0,map=0}={}){
      memory.assertRange(offset,this.SIZE);
      const attributesBank=memory.u8(offset),attributesAddress=memory.u16(offset+3);
      return frozen({
        group,map,offset,attributesBank,
        tileset:memory.u8(offset+1),environment:memory.u8(offset+2),attributesAddress,
        attributesOffset:memory.banked(attributesBank,attributesAddress),
        landmark:memory.u8(offset+5),music:memory.u8(offset+6),
        phoneAndPalette:memory.u8(offset+7),fishingGroup:memory.u8(offset+8)
      });
    }
  }

  class Gen2MapAttributes{
    static SIZE=12;
    static read(memory,offset){
      memory.assertRange(offset,this.SIZE);
      const blocksBank=memory.u8(offset+3),blocksAddress=memory.u16(offset+4),scriptsBank=memory.u8(offset+6),scriptsAddress=memory.u16(offset+7),eventsAddress=memory.u16(offset+9);
      return frozen({
        offset,borderBlock:memory.u8(offset),height:memory.u8(offset+1),width:memory.u8(offset+2),
        blocksBank,blocksAddress,blocksOffset:memory.banked(blocksBank,blocksAddress),
        scriptsBank,scriptsAddress,scriptsOffset:memory.banked(scriptsBank,scriptsAddress),
        eventsAddress,eventsOffset:memory.banked(scriptsBank,eventsAddress),
        connections:memory.u8(offset+11)
      });
    }
  }

  class Gen2MapConnection{
    static SIZE=12;
    // Bits are E=1, W=2, S=4, N=8; records remain ordered N, S, W, E.
    static DIRECTIONS=Gen2ConnectionUtils.DIRECTIONS;
    static read(memory,offset,{direction="north"}={}){
      memory.assertRange(offset,this.SIZE);
      const mapGroup=memory.u8(offset),mapNumber=memory.u8(offset+1),y=memory.s8(offset+8),x=memory.s8(offset+9);
      const perpendicularOffset=(direction==="north"||direction==="south")?-x/2:-y/2;
      return frozen({
        offset,direction,mapGroup,mapNumber,id:`${mapGroup}:${mapNumber}`,
        blocksAddress:memory.u16(offset+2),mapAddress:memory.u16(offset+4),
        length:memory.u8(offset+6),width:memory.u8(offset+7),y,x,
        windowAddress:memory.u16(offset+10),perpendicularOffset
      });
    }
    static readAll(memory,attributes){
      let offset=attributes.offset+Gen2MapAttributes.SIZE;
      return frozen(this.DIRECTIONS.flatMap(({flag,name})=>{
        if(!(attributes.connections&flag))return[];
        const connection=this.read(memory,offset,{direction:name});
        offset+=this.SIZE;
        return[connection];
      }));
    }
  }

  class Gen2WarpEvent{
    static SIZE=5;
    static read(memory,offset,index=0){memory.assertRange(offset,this.SIZE);return frozen({eventType:"Warp",eventIndex:index,offset,y:memory.u8(offset),x:memory.u8(offset+1),warp:memory.u8(offset+2),mapGroup:memory.u8(offset+3),mapNumber:memory.u8(offset+4)});}
  }
  class Gen2CoordEvent{
    static SIZE=8;
    static read(memory,offset,index=0){memory.assertRange(offset,this.SIZE);return frozen({eventType:"Coordinate",eventIndex:index,offset,scene:memory.u8(offset),y:memory.u8(offset+1),x:memory.u8(offset+2),scriptAddress:memory.u16(offset+4)});}
  }
  class Gen2BgEvent{
    static SIZE=5;
    static read(memory,offset,index=0){memory.assertRange(offset,this.SIZE);return frozen({eventType:"Background",eventIndex:index,offset,y:memory.u8(offset),x:memory.u8(offset+1),kind:memory.u8(offset+2),scriptAddress:memory.u16(offset+3)});}
  }
  class Gen2ObjectEvent{
    static SIZE=13;
    static read(memory,offset,index=0){
      memory.assertRange(offset,this.SIZE);const packed=memory.u8(offset+7);
      return frozen({eventType:"Object",eventIndex:index,offset,spriteId:memory.u8(offset),y:memory.u8(offset+1)-4,x:memory.u8(offset+2)-4,movement:memory.u8(offset+3),radius:memory.u8(offset+4),hourStart:memory.u8(offset+5),hourEnd:memory.u8(offset+6),palette:packed>>4,kind:packed&15,range:memory.u8(offset+8),scriptAddress:memory.u16(offset+9),eventFlag:memory.u16(offset+11)});
    }
  }

  class Gen2MapEvents{
    static readTable(memory,cursor,Record){
      const count=memory.u8(cursor++),items=Array.from({length:count},(_,index)=>Record.read(memory,cursor+index*Record.SIZE,index));
      return{count,items,cursor:cursor+count*Record.SIZE};
    }
    static read(memory,offset){
      memory.assertRange(offset,2);let cursor=offset+2;
      const warps=this.readTable(memory,cursor,Gen2WarpEvent);cursor=warps.cursor;
      const coords=this.readTable(memory,cursor,Gen2CoordEvent);cursor=coords.cursor;
      const backgrounds=this.readTable(memory,cursor,Gen2BgEvent);cursor=backgrounds.cursor;
      const objects=this.readTable(memory,cursor,Gen2ObjectEvent);cursor=objects.cursor;
      return frozen({offset,warps:frozen(warps.items),coordinates:frozen(coords.items),backgrounds:frozen(backgrounds.items),objects:frozen(objects.items),size:cursor-offset});
    }
  }

  class Gen2MapDirectory{
    static GROUPS=26;
    static MAP_LENGTH=Gen2MapGroupEntry.SIZE;
    // NUM_*_MAPS from pret/pokecrystal constants/map_constants.asm.
    static GROUP_COUNTS=Object.freeze([14,7,91,9,10,8,17,7,6,17,24,13,6,8,12,8,13,14,4,6,26,16,13,13,15,11]);
    constructor(memory,{tableOffset=0x94000,tableBank=0x25}={}){
      this.memory=memory;this.tableOffset=tableOffset;this.tableBank=tableBank;
      this.validate();
    }
    validate(){
      this.memory.assertRange(this.tableOffset,Gen2MapDirectory.GROUPS*2);
      for(let group=1;group<=Gen2MapDirectory.GROUPS;group++){
        const address=this.memory.u16(this.tableOffset+(group-1)*2);
        if(address<0x4000||address>0x7fff)throw new RangeError(`Invalid Gen II map group ${group} pointer.`);
        const first=Gen2MapGroupEntry.read(this.memory,this.memory.banked(this.tableBank,address),{group,map:1});
        const attributes=Gen2MapAttributes.read(this.memory,first.attributesOffset);
        if(!attributes.width||!attributes.height||attributes.width>100||attributes.height>100)throw new RangeError(`Invalid Gen II map group ${group} attributes.`);
      }
      return this;
    }
    groupOffset(group){
      if(!Number.isInteger(group)||group<1||group>Gen2MapDirectory.GROUPS)throw new RangeError("Gen II map group must be 1–26.");
      return this.memory.banked(this.tableBank,this.memory.u16(this.tableOffset+(group-1)*2));
    }
    entry(group,map){
      const count=this.groupCount(group);
      if(!Number.isInteger(map)||map<1||map>count)throw new RangeError(`Gen II map number must be 1–${count} in group ${group}.`);
      return Gen2MapGroupEntry.read(this.memory,this.groupOffset(group)+(map-1)*Gen2MapGroupEntry.SIZE,{group,map});
    }
    groupCount(group){
      if(!Number.isInteger(group)||group<1||group>Gen2MapDirectory.GROUPS)throw new RangeError("Gen II map group must be 1–26.");
      return Gen2MapDirectory.GROUP_COUNTS[group-1];
    }
    list(){
      return frozen(Gen2MapDirectory.GROUP_COUNTS.flatMap((count,index)=>Array.from({length:count},(_,map)=>frozen({group:index+1,map:map+1,id:`${index+1}:${map+1}`}))));
    }
    map(group,map){
      const entry=this.entry(group,map),attributes=Gen2MapAttributes.read(this.memory,entry.attributesOffset),connections=Gen2MapConnection.readAll(this.memory,attributes),events=Gen2MapEvents.read(this.memory,attributes.eventsOffset);
      return frozen({id:`${group}:${map}`,group,map,entry,attributes,connections,events});
    }
  }

  Object.assign(global,{Gen2MapGroupEntry,Gen2MapAttributes,Gen2MapConnection,Gen2WarpEvent,Gen2CoordEvent,Gen2BgEvent,Gen2ObjectEvent,Gen2MapEvents,Gen2MapDirectory});
})(globalThis);
