(function(global){
  "use strict";
  class Gen2ConnectionUtils{
    static NAMES=Object.freeze(["north","south","west","east"]);
    static FLAGS=Object.freeze({north:8,south:4,west:2,east:1});
    static DIRECTIONS=Object.freeze(this.NAMES.map(name=>Object.freeze({name,flag:this.FLAGS[name]})));
    static direction(value){
      const name=typeof value==="number"?this.NAMES[value]:String(value||"").toLowerCase();
      if(!this.NAMES.includes(name))throw new RangeError(`Unknown Gen II connection direction '${value}'.`);
      return name;
    }
    static flag(value){return this.FLAGS[this.direction(value)];}
    static mask(connections){return connections.reduce((mask,item)=>mask|this.flag(item.direction),0);}
    static geometry(source,target,direction,offset=0){
      direction=this.direction(direction);
      for(const [label,map] of [["source",source],["target",target]])
        if(!Number.isInteger(map?.width)||!Number.isInteger(map?.height)||map.width<1||map.height<1)throw new RangeError(`Invalid ${label} Gen II map dimensions.`);
      if(!Number.isInteger(offset)||offset<-63||offset>63)throw new RangeError("Connection offset must be -63..63.");
      let sourceSkip=0,targetStart=offset+3;
      if(targetStart<0){sourceSkip=-targetStart;targetStart=0;}
      let blockDelta,mapDelta,windowDelta,y,x,length;
      if(direction==="north"){
        blockDelta=target.width*(target.height-3)+sourceSkip;mapDelta=targetStart;windowDelta=(target.width+6)*target.height+1;
        y=target.height*2-1;x=-offset*2;length=Math.min(source.width+3-offset,target.width)-sourceSkip;
      }else if(direction==="south"){
        blockDelta=sourceSkip;mapDelta=(source.width+6)*(source.height+3)+targetStart;windowDelta=target.width+7;
        y=0;x=-offset*2;length=Math.min(source.width+3-offset,target.width)-sourceSkip;
      }else if(direction==="west"){
        blockDelta=target.width*sourceSkip+target.width-3;mapDelta=(source.width+6)*targetStart;windowDelta=(target.width+6)*2-6;
        y=-offset*2;x=target.width*2-1;length=Math.min(source.height+3-offset,target.height)-sourceSkip;
      }else{
        blockDelta=target.width*sourceSkip;mapDelta=(source.width+6)*targetStart+source.width+3;windowDelta=target.width+7;
        y=-offset*2;x=0;length=Math.min(source.height+3-offset,target.height)-sourceSkip;
      }
      length-=sourceSkip;
      if(length<1||length>255||target.width>255||x<-128||x>127||y<-128||y>127)throw new RangeError("These maps cannot be represented by a Crystal connection record.");
      return Object.freeze({direction,offset,sourceSkip,targetStart,blockDelta,mapDelta,windowDelta,length,width:target.width,y,x});
    }
    static encode(connection){
      const byte=value=>Number(value)&255,word=value=>[byte(value),byte(Number(value)>>>8)];
      const required=["mapGroup","mapNumber","blocksAddress","mapAddress","length","width","y","x","windowAddress"];
      if(required.some(key=>!Number.isInteger(connection?.[key])))throw new TypeError("A complete Gen II connection is required.");
      return Uint8Array.of(byte(connection.mapGroup),byte(connection.mapNumber),...word(connection.blocksAddress),...word(connection.mapAddress),byte(connection.length),byte(connection.width),byte(connection.y),byte(connection.x),...word(connection.windowAddress));
    }
  }
  global.Gen2ConnectionUtils=Gen2ConnectionUtils;
  ((global.PokemonViewer ||= {}).structures ||= {}).Gen2ConnectionUtils=Gen2ConnectionUtils;
})(globalThis);
