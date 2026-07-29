(function(global){
  "use strict";

  /**
   * Small, format-neutral helpers shared by every editor.
   *
   * ROM addressing and binary writes deliberately live in MemoryUtils and the
   * family memory classes: CoreUtils must never guess whether an address is
   * GBA, GB, or GBC.
   */
  class CoreUtils{
    static clamp(value,min,max){
      const number=Number(value);
      if(!Number.isFinite(number))throw new TypeError("Expected a finite number.");
      if(min>max)throw new RangeError("Minimum cannot be greater than maximum.");
      return Math.min(max,Math.max(min,number));
    }

    static integer(value,{name="Value",min=Number.MIN_SAFE_INTEGER,max=Number.MAX_SAFE_INTEGER}={}){
      const number=Number(value);
      if(!Number.isInteger(number)||number<min||number>max)throw new RangeError(`${name} must be an integer from ${min} to ${max}.`);
      return number;
    }

    static parseInteger(value,{name="Value",min=Number.MIN_SAFE_INTEGER,max=Number.MAX_SAFE_INTEGER}={}){
      const source=String(value??"").trim();
      const match=source.match(/^([+-]?)(?:(?:0x|\$)([0-9a-f]+)|([0-9]+))$/i);
      if(!match)throw new RangeError(`${name} must be a decimal, 0x hexadecimal, or $ hexadecimal integer.`);
      const sign=match[1]==="-"?-1:1;
      const number=sign*Number.parseInt(match[2]??match[3],match[2]===undefined?10:16);
      return this.integer(number,{name,min,max});
    }

    static parseOffset(value,size,{name="ROM offset"}={}){
      const length=this.integer(size,{name:"ROM size",min:1});
      return this.parseInteger(value,{name,min:0,max:length-1});
    }

    static isObject(value){
      return value!==null&&typeof value==="object";
    }

    static range(length,map=index=>index){
      const size=this.integer(length,{name:"Length",min:0});
      if(typeof map!=="function")throw new TypeError("Range mapper must be a function.");
      return Array.from({length:size},(_,index)=>map(index));
    }

    static hex(value,width=2){
      const number=this.integer(value,{name:"Hex value"});
      const digits=this.integer(width,{name:"Hex width",min:1});
      const sign=number<0?"-":"";
      return `${sign}0x${Math.abs(number).toString(16).toUpperCase().padStart(digits,"0")}`;
    }

    static bgr555ToRgb(value){
      const color=this.integer(value,{name:"BGR555 color",min:0,max:0xffff});
      const expand=channel=>Math.round(channel*255/31);
      return Object.freeze([
        expand(color&0x1f),
        expand((color>>5)&0x1f),
        expand((color>>10)&0x1f)
      ]);
    }

    static bgr555ToHex(value){
      const [red,green,blue]=this.bgr555ToRgb(value);
      return (red<<16)|(green<<8)|blue;
    }

    static async copyText(text){
      const value=String(text??"");
      if(global.navigator?.clipboard?.writeText){
        await global.navigator.clipboard.writeText(value);
        return value;
      }
      if(!global.document)throw new Error("Clipboard is unavailable.");
      const field=global.document.createElement("textarea");
      field.value=value;
      field.setAttribute("readonly","");
      field.style.position="fixed";
      field.style.opacity="0";
      global.document.body.append(field);
      field.select();
      try{
        if(!global.document.execCommand("copy"))throw new Error("Clipboard copy failed.");
      }finally{
        field.remove();
      }
      return value;
    }
  }

  global.CoreUtils=CoreUtils;
  ((global.PokemonViewer ||= {}).core ||= {}).utils=CoreUtils;
})(globalThis);
