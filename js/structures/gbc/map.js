globalThis.GbcMapHeader = class GbcMapHeader {
  static BASE_SIZE=10;static CONNECTION_SIZE=11;
  static read(m,o,bank){
    const c=m.cursor(o),header={offset:o,bank,tileset:c.u8(),height:c.u8(),width:c.u8(),blocks:c.pointer16(bank),textPointers:c.pointer16(bank),script:c.pointer16(bank),connectionFlags:c.u8()};
    const directions=[[8,"north"],[4,"south"],[2,"west"],[1,"east"]],connections=[];
    for(const [flag,direction] of directions)if(header.connectionFlags&flag){const start=c.position;connections.push(Object.freeze({offset:start,direction,mapId:c.u8(),blocksAddress:c.u16(),mapAddress:c.u16(),length:c.u8(),width:c.u8(),y:c.s8(),x:c.s8(),windowAddress:c.u16()}));}
    return Object.freeze({...header,connectionCount:connections.length,connections:Object.freeze(connections),objects:c.pointer16(bank),size:c.position-o});
  }
};
globalThis.GbcWarpEvent = class GbcWarpEvent { static SIZE=4; static read(m,o){const c=m.cursor(o);return Object.freeze({offset:o,y:c.u8(),x:c.u8(),destinationWarpId:c.u8(),destinationMap:c.u8()});} };
globalThis.GbcBgEvent = class GbcBgEvent { static SIZE=3; static read(m,o){m.assertRange(o,3);return Object.freeze({offset:o,y:m.u8(o),x:m.u8(o+1),textId:m.u8(o+2)});} };
globalThis.GbcObjectEvent = class GbcObjectEvent {
  static TRAINER=0x40;static ITEM=0x80;
  static read(m,o){
    m.assertRange(o,6);
    const packedText=m.u8(o+5),kind=packedText&0xc0;
    const eventType=kind===this.TRAINER?"Trainer":kind===this.ITEM?"Item":"Object";
    // pret/pokered's object_event macro emits 6 bytes for people, 7 for
    // items, and 8 for trainers. Treating every typed object as 8 bytes
    // shifts the parser after an item and corrupts every following event.
    const size=eventType==="Trainer"?8:eventType==="Item"?7:6;
    m.assertRange(o,size);
    const extra=size>6?m.u8(o+6):null;
    return Object.freeze({
      offset:o,size,eventType,spriteId:m.u8(o),y:m.u8(o+1)-4,x:m.u8(o+2)-4,
      movement:m.u8(o+3),rangeOrDirection:m.u8(o+4),
      textId:eventType==="Object"?packedText&0x3f:0,kind,
      trainerClass:eventType==="Trainer"?extra:null,
      trainerNumber:eventType==="Trainer"?m.u8(o+7):null,
      itemId:eventType==="Item"?extra:null
    });
  }
};
globalThis.GbcMapObjectBlock = class GbcMapObjectBlock {
  static read(m,o){let p=o;const border=m.u8(p++),warpCount=m.u8(p++),warps=m.table(p,warpCount,4,x=>GbcWarpEvent.read(m,x));p+=warpCount*4;const bgCount=m.u8(p++),backgrounds=m.table(p,bgCount,3,x=>GbcBgEvent.read(m,x));p+=bgCount*3;const objectCount=m.u8(p++),objects=[];for(let i=0;i<objectCount;i++){const object=GbcObjectEvent.read(m,p);objects.push(object);p+=object.size;}return Object.freeze({offset:o,border,warpCount,warps,bgCount,backgrounds,objectCount,objects,endOffset:p});}
};
