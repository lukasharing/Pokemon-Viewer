(function(global){
  "use strict";
  class TextTableCodec{
    constructor(dictionary=[]){
      this.dictionary=Array.isArray(dictionary)||ArrayBuffer.isView(dictionary)
        ?Array.from(dictionary)
        :Object.entries(dictionary||{}).reduce((table,[key,value])=>{
          const byte=Number.parseInt(key,16);
          if(Number.isInteger(byte)&&byte>=0&&byte<=0xff)table[byte]=value;
          return table;
        },[]);
      this.entries=this.dictionary.map((token,byte)=>token?[byte,String(token)]:null).filter(Boolean).sort((a,b)=>b[1].length-a[1].length);
      this.bytesByToken=new Map();
      for(const [byte,token] of this.entries){
        const bytes=this.bytesByToken.get(token)||[];bytes.push(byte);this.bytesByToken.set(token,bytes);
      }
    }
    decodeByte(byte){return this.dictionary[byte]??"";}
    decode(bytes,{unknown=byte=>`[${byte.toString(16).padStart(2,"0")}]`}={}){
      return Array.from(bytes,byte=>this.decodeByte(byte)||unknown(byte)).join("");
    }
    encode(source){
      const bytes=[],text=String(source);
      for(let cursor=0;cursor<text.length;){
        const raw=text.slice(cursor).match(/^\[([0-9a-f]{2})\]/i);
        if(raw){bytes.push(Number.parseInt(raw[1],16));cursor+=raw[0].length;continue;}
        const match=this.entries.find(([,token])=>text.startsWith(token,cursor));
        if(!match)throw new SyntaxError(`'${text[cursor]}' at character ${cursor+1} is not available in this game's text table.`);
        bytes.push(match[0]);cursor+=match[1].length;
      }
      return Uint8Array.from(bytes);
    }
    decodeLossless(bytes){
      return Array.from(bytes,byte=>{
        const token=this.decodeByte(byte);
        if(!token)return`[${byte.toString(16).toUpperCase().padStart(2,"0")}]`;
        const alternatives=this.bytesByToken.get(String(token))||[];
        return alternatives.length>1&&alternatives[0]!==byte?`[${byte.toString(16).toUpperCase().padStart(2,"0")}]`:token;
      }).join("");
    }
  }
  global.TextTableCodec=TextTableCodec;
  ((global.PokemonViewer ||= {}).core ||= {}).TextTableCodec=TextTableCodec;
})(globalThis);
