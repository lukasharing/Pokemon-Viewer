(function(global){
  "use strict";

  const WIDTHS=Object.freeze({byte:1,word:2,dword:4});

  /**
   * Shared little-endian argument helpers for ROM codecs.
   * Keeps bounds, widths and source formatting consistent without coupling a
   * script language to a particular game family.
   */
  class BinaryCodecUtils{
    static width(type){
      const width=Number.isInteger(type)&&type>=1&&type<=4?type:WIDTHS[type];
      if(!width)throw new TypeError(`Unsupported binary argument type '${type}'.`);
      return width;
    }

    static read(memory,offset,types){
      const values=[],offsets=[];let cursor=offset;
      for(const type of types){
        const width=this.width(type);
        memory.assertRange?.(cursor,width);offsets.push(cursor);
        if(width===1)values.push(memory.u8(cursor));
        else if(width===2)values.push(memory.u16(cursor));
        else if(width===4)values.push(memory.u32(cursor));
        else{
          let value=0;
          for(let byte=0;byte<width;byte++)value+=memory.u8(cursor+byte)*2**(byte*8);
          values.push(value);
        }
        cursor+=width;
      }
      return{values,offsets,cursor,size:cursor-offset};
    }

    static append(target,types,values,{line}={}){
      if(types.length!==values.length)throw new SyntaxError(`${line?`Line ${line}: `:""}expected ${types.length} argument(s).`);
      types.forEach((type,index)=>{
        const width=this.width(type),value=values[index],maximum=2**(width*8);
        if(!Number.isInteger(value)||value<0||value>=maximum)throw new RangeError(`${line?`Line ${line}: `:""}${value} does not fit ${type}.`);
        for(let byte=0;byte<width;byte++)target.push(value>>>(byte*8)&0xff);
      });
      return target;
    }

    static number(token,{line,width,min=0,max}={}){
      const source=String(token??"").trim();
      const radix=/^\$/i.test(source)||/^0x/i.test(source)?16:10;
      const digits=radix===16?source.replace(/^(\$|0x)/i,""):source;
      const value=Number.parseInt(digits,radix);
      const label=line===undefined?"":`Line ${line}: `;
      const valid=radix===16?/^[0-9a-f]+$/i.test(digits):/^[+-]?\d+$/.test(digits);
      if(!valid||!Number.isInteger(value))throw new SyntaxError(`${label}invalid number '${source}'.`);
      const upper=max??(width===undefined?Number.MAX_SAFE_INTEGER:2**(this.width(width)*8)-1);
      if(value<min||value>upper){
        const range=width===undefined?`${min}..${upper}`:`${this.width(width)} byte(s)`;
        throw new RangeError(`${label}'${source}' does not fit ${range}.`);
      }
      return value;
    }

    static format(values,types,{prefix="$"}={}){
      return values.map((value,index)=>`${prefix}${value.toString(16).padStart(this.width(types[index])*2,"0")}`).join(", ");
    }
  }

  global.BinaryCodecUtils=BinaryCodecUtils;
  ((global.PokemonViewer||={}).core||={}).BinaryCodecUtils=BinaryCodecUtils;
})(globalThis);
