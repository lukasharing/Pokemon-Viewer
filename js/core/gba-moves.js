(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const TYPES=Object.freeze(["Normal","Fighting","Flying","Poison","Ground","Rock","Bug","Ghost","Steel","Mystery","Fire","Water","Grass","Electric","Psychic","Ice","Dragon","Dark"]);
  const TARGETS=Object.freeze(["Selected target","Depends on move","User or selected target","Random opponent","Both opponents","User","All except user","Opponents' field"]);

  class GbaMoveData{
    static RECORD_SIZE=12;
    static NAME_SIZE=13;
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=root.gba.assets.profile(reader);this._moves=null;
      for(const name of ["battleMoves","moveNames","moveCount"]){
        if(!Number.isInteger(this.profile?.[name]))throw new Error(`The GBA Move profile is missing ${name}.`);
      }
      global.ProjectValidator?.registerDomain(reader,"gba-moves",()=>this.validate());
    }
    assertId(id){if(!Number.isInteger(id)||id<1||id>this.profile.moveCount)throw new RangeError(`GBA move ID must be 1–${this.profile.moveCount}.`);}
    name(id){
      this.assertId(id);const offset=this.profile.moveNames+id*this.constructor.NAME_SIZE;
      this.memory.assertRange(offset,this.constructor.NAME_SIZE);
      return this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),offset,this.constructor.NAME_SIZE).trim()||`Move #${id}`;
    }
    get(id){
      this.assertId(id);const offset=this.profile.battleMoves+id*this.constructor.RECORD_SIZE,nameOffset=this.profile.moveNames+id*this.constructor.NAME_SIZE;
      this.memory.assertRange(offset,this.constructor.RECORD_SIZE);
      const accuracy=this.memory.u8(offset+3),chance=this.memory.u8(offset+5),priorityRaw=this.memory.u8(offset+7);
      return Object.freeze({id,name:this.name(id),offset,nameOffset,effect:this.memory.u8(offset),power:this.memory.u8(offset+1),type:this.memory.u8(offset+2),accuracy,accuracyPercent:accuracy,pp:this.memory.u8(offset+4),effectChance:chance,effectChancePercent:chance,target:this.memory.u8(offset+6),priority:priorityRaw>127?priorityRaw-256:priorityRaw,flags:this.memory.u32(offset+8)});
    }
    list(){if(!this._moves)this._moves=Object.freeze(Array.from({length:this.profile.moveCount},(_,index)=>this.get(index+1)));return this._moves;}
    typeName(id){return TYPES[id]||`Unknown type ${id}`;}
    targetName(id){return TARGETS[id]||`Target ${id}`;}
    encode(move,values={}){
      const integer=(name,fallback,min=0,max=255)=>{const value=values[name]===undefined?fallback:Number(values[name]);if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`GBA move ${name} must be ${min}–${max}.`);return value;};
      const bytes=MemoryUtils.bytes(this.memory,move.offset,this.constructor.RECORD_SIZE);
      bytes[0]=integer("effect",move.effect);bytes[1]=integer("power",move.power);bytes[2]=integer("type",move.type,0,TYPES.length-1);
      bytes[3]=integer("accuracy",move.accuracy);bytes[4]=integer("pp",move.pp,1,40);bytes[5]=integer("effectChance",move.effectChance);
      bytes[6]=integer("target",move.target);bytes[7]=integer("priority",move.priority,-128,127)&255;
      return bytes;
    }
    validate(){this.invalidate();for(const move of this.list()){if(move.pp<1||move.pp>40)throw new Error(`${move.name} has invalid PP ${move.pp}.`);if(move.type>=TYPES.length)throw new Error(`${move.name} has invalid type ${move.type}.`);}return[];}
    invalidate(){this._moves=null;return this;}
  }
  root.gba=Object.freeze({...root.gba,GbaMoveData,GBA_MOVE_TYPES:TYPES,GBA_MOVE_TARGETS:TARGETS});
})(globalThis);
