class GbaStructure {
  static record(offset, fields) { return Object.freeze({offset, ...fields}); }
}
globalThis.GbaTileset = class GbaTileset extends GbaStructure {
  static SIZE=24;
  static read(m,o,{frlg=false}={}){
    m.assertRange(o,24);
    const first=m.pointer(o+16),second=m.pointer(o+20);
    return this.record(o,{isCompressed:Boolean(m.u8(o)),isSecondary:Boolean(m.u8(o+1)),tiles:m.pointer(o+4),palettes:m.pointer(o+8),metatiles:m.pointer(o+12),metatileAttributes:frlg?second:first,callback:frlg?first:second,frlg});
  }
};
globalThis.GbaTilesetHeader = globalThis.GbaTileset;
globalThis.GbaMapLayout = class GbaMapLayout extends GbaStructure {
  static SIZE=24;
  static read(m,o,{deep=false,frlg=false}={}){
    m.assertRange(o,frlg?28:24);
    const c=m.cursor(o),record=this.record(o,{width:c.s32(),height:c.s32(),border:c.pointer(),map:c.pointer(),primaryTileset:c.pointer(),secondaryTileset:c.pointer(),borderWidth:frlg?m.u8(o+24):2,borderHeight:frlg?m.u8(o+25):2});
    return deep?Object.freeze({...record,primaryTilesetData:record.primaryTileset===null?null:GbaTilesetHeader.read(m,record.primaryTileset,{frlg}),secondaryTilesetData:record.secondaryTileset===null?null:GbaTilesetHeader.read(m,record.secondaryTileset,{frlg})}):record;
  }
};
globalThis.GbaObjectEventTemplate = class GbaObjectEventTemplate extends GbaStructure { static SIZE=24; static read(m,o){m.assertRange(o,24);const range=m.u8(o+10);return this.record(o,{localId:m.u8(o),graphicsId:m.u8(o+1),kind:m.u8(o+2),x:m.s16(o+4),y:m.s16(o+6),elevation:m.u8(o+8),movementType:m.u8(o+9),movementRangeX:range&15,movementRangeY:range>>4,trainerType:m.u16(o+12),trainerRangeOrBerryTreeId:m.u16(o+14),script:m.pointer(o+16),flagId:m.u16(o+20)});} };
globalThis.GbaWarpEvent = class GbaWarpEvent extends GbaStructure { static SIZE=8; static read(m,o){const c=m.cursor(o);return this.record(o,{x:c.s16(),y:c.s16(),elevation:c.u8(),warpId:c.u8(),mapNum:c.u8(),mapGroup:c.u8()});} };
globalThis.GbaCoordEvent = class GbaCoordEvent extends GbaStructure { static SIZE=16; static read(m,o){m.assertRange(o,16);return this.record(o,{x:m.s16(o),y:m.s16(o+2),elevation:m.u8(o+4),trigger:m.u16(o+6),index:m.u16(o+8),script:m.pointer(o+12)});} };
globalThis.GbaBgEvent = class GbaBgEvent extends GbaStructure { static SIZE=12; static read(m,o){m.assertRange(o,12);const value=m.u32(o+8);return this.record(o,{x:m.u16(o),y:m.u16(o+2),elevation:m.u8(o+4),kind:m.u8(o+5),value,script:m.pointer(o+8),hiddenItem:{item:value&0xffff,hiddenItemId:value>>>16},secretBaseId:value});} };
globalThis.GbaMapEvents = class GbaMapEvents extends GbaStructure {
  static SIZE=20;
  static read(m,o){m.assertRange(o,20);return this.record(o,{objectEventCount:m.u8(o),warpCount:m.u8(o+1),coordEventCount:m.u8(o+2),bgEventCount:m.u8(o+3),objectEvents:m.pointer(o+4),warps:m.pointer(o+8),coordEvents:m.pointer(o+12),bgEvents:m.pointer(o+16)});}
  static expand(m,e){return Object.freeze({...e,objects:e.objectEvents===null?[]:m.table(e.objectEvents,e.objectEventCount,GbaObjectEventTemplate.SIZE,p=>GbaObjectEventTemplate.read(m,p)),warpEntries:e.warps===null?[]:m.table(e.warps,e.warpCount,GbaWarpEvent.SIZE,p=>GbaWarpEvent.read(m,p)),coords:e.coordEvents===null?[]:m.table(e.coordEvents,e.coordEventCount,GbaCoordEvent.SIZE,p=>GbaCoordEvent.read(m,p)),backgrounds:e.bgEvents===null?[]:m.table(e.bgEvents,e.bgEventCount,GbaBgEvent.SIZE,p=>GbaBgEvent.read(m,p))});}
};
globalThis.GbaMapScripts = class GbaMapScripts extends GbaStructure {
  static TYPES=Object.freeze({
    1:Object.freeze({name:"On load",phase:"After the layout is loaded, before the first draw."}),
    2:Object.freeze({name:"On frame",phase:"After the map fade, while the field is active.",conditional:true}),
    3:Object.freeze({name:"On transition",phase:"During the transition into the map."}),
    4:Object.freeze({name:"On warp into map",phase:"After map objects are loaded.",conditional:true}),
    5:Object.freeze({name:"On resume",phase:"After map loading or returning from a menu or battle."}),
    6:Object.freeze({name:"On dive warp",phase:"When entering through a dive or emerge warp."}),
    7:Object.freeze({name:"On return to field",phase:"When returning to the field without a full map load."})
  });
  static readConditions(m,o,{maxEntries=128}={}){
    const entries=[];let cursor=o,terminated=false;
    for(let index=0;index<maxEntries;index++){
      m.assertRange(cursor,2);const variable=m.u16(cursor);
      if(variable===0){terminated=true;cursor+=2;break;}
      m.assertRange(cursor,8);const comparison=m.u16(cursor+2),script=m.pointer(cursor+4);
      if(script===null)throw new RangeError(`Invalid GBA conditional map-script pointer at 0x${(cursor+4).toString(16)}.`);
      entries.push(this.record(cursor,{index,variable,comparison,script,pointerOffset:cursor+4}));cursor+=8;
    }
    if(!terminated)throw new RangeError("GBA conditional map-script table has no bounded terminator.");
    return Object.freeze({offset:o,entries:Object.freeze(entries),endOffset:cursor});
  }
  static read(m,o,{maxEntries=16,maxConditions=128}={}){
    const entries=[];let cursor=o,terminated=false;
    for(let index=0;index<maxEntries;index++){
      m.assertRange(cursor,1);const type=m.u8(cursor);
      if(type===0){terminated=true;cursor++;break;}
      const definition=this.TYPES[type];
      if(!definition)throw new RangeError(`Unknown GBA map-script type ${type} at 0x${cursor.toString(16)}.`);
      m.assertRange(cursor,5);const script=m.pointer(cursor+1);
      if(script===null)throw new RangeError(`Invalid GBA map-script pointer at 0x${(cursor+1).toString(16)}.`);
      const conditions=definition.conditional?this.readConditions(m,script,{maxEntries:maxConditions}):null;
      entries.push(this.record(cursor,{index,type,name:definition.name,phase:definition.phase,script,pointerOffset:cursor+1,conditional:Boolean(definition.conditional),conditions}));cursor+=5;
    }
    if(!terminated)throw new RangeError("GBA map-script table has no bounded terminator.");
    return Object.freeze({offset:o,entries:Object.freeze(entries),endOffset:cursor});
  }
};
globalThis.GbaMapConnection = class GbaMapConnection extends GbaStructure { static SIZE=12; static read(m,o){m.assertRange(o,12);return this.record(o,{direction:m.u8(o),relativeOffset:m.s32(o+4),mapGroup:m.u8(o+8),mapNum:m.u8(o+9)});} };
globalThis.GbaMapConnections = class GbaMapConnections extends GbaStructure { static SIZE=8; static read(m,o){m.assertRange(o,8);const count=m.s32(o),pointer=m.pointer(o+4);return this.record(o,{count,pointer,entries:pointer===null?[]:m.table(pointer,count,GbaMapConnection.SIZE,p=>GbaMapConnection.read(m,p))});} };
globalThis.GbaMapHeader = class GbaMapHeader extends GbaStructure {
  static SIZE=28;
  static read(m,o,{deep=false,frlg=false}={}){m.assertRange(o,28);const r=this.record(o,{layout:m.pointer(o),events:m.pointer(o+4),scripts:m.pointer(o+8),connections:m.pointer(o+12),music:m.u16(o+16),mapLayoutId:m.u16(o+18),regionMapSectionId:m.u8(o+20),cave:m.u8(o+21),weather:m.u8(o+22),mapType:m.u8(o+23),escapeRope:Boolean(m.u8(o+25)),flags:m.u8(o+26),battleType:m.u8(o+27)});return deep?Object.freeze({...r,layoutData:r.layout===null?null:GbaMapLayout.read(m,r.layout,{deep:true,frlg}),eventData:r.events===null?null:GbaMapEvents.expand(m,GbaMapEvents.read(m,r.events)),connectionData:r.connections===null?null:GbaMapConnections.read(m,r.connections)}):r;}
};
