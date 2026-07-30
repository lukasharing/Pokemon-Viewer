(function(global){
  "use strict";

  const root=(global.PokemonViewer||={});
  const POCKETS=Object.freeze([null,"Items","Key items","Poké Balls","TM / HM"]);
  const MENUS=Object.freeze(new Map([[0,"No use"],[4,"Current"],[5,"Party"],[6,"Close"]]));

  class Gen2ItemData{
    static COUNT=255;
    static TABLE_COUNT=256;
    static RECORD_SIZE=7;
    static TEXT_END=0x50;

    constructor(reader){
      this.reader=reader;this.memory=reader.memory;
      this.symbols=reader.capabilities?.provenance?.symbols||{};
      for(const name of ["ItemNames","ItemAttributes","ItemDescriptions"]){
        const symbol=this.symbols[name];
        if(!Number.isInteger(symbol?.offset)||!Number.isInteger(symbol?.bank))throw new Error(`Crystal source manifest is missing banked ${name}.`);
      }
      this.dictionary=reader.getDictionary(reader.textDictionary);
      this._items=null;this._nameOffsets=null;
      global.ProjectValidator?.registerDomain(reader,"gen2-items",()=>this.validate());
    }

    assertId(id){
      if(!Number.isInteger(id)||id<1||id>this.constructor.COUNT)throw new RangeError(`Crystal item ID must be 1–${this.constructor.COUNT}.`);
    }

    nameOffsets(){
      if(this._nameOffsets)return this._nameOffsets;
      const offsets=[],start=this.symbols.ItemNames.offset,extent=this.symbols.ItemNames.extent;
      if(!Number.isInteger(extent)||extent<1)throw new Error("Crystal ItemNames requires an exact source extent.");
      const end=start+extent;this.memory.assertRange(start,extent);
      for(let cursor=start;cursor<end&&offsets.length<this.constructor.TABLE_COUNT;){
        offsets.push(cursor);
        while(cursor<end&&this.memory.u8(cursor)!==this.constructor.TEXT_END)cursor++;
        if(cursor>=end)throw new Error(`Crystal ItemNames entry ${offsets.length} is not terminated inside its source extent.`);
        cursor++;
      }
      if(offsets.length!==this.constructor.TABLE_COUNT)throw new Error(`Crystal ItemNames contains ${offsets.length} entries; expected ${this.constructor.TABLE_COUNT}.`);
      this._nameOffsets=Object.freeze(offsets);return this._nameOffsets;
    }

    name(id){
      this.assertId(id);
      const offsets=this.nameOffsets(),offset=offsets[id-1],end=offsets[id]??(this.symbols.ItemNames.offset+this.symbols.ItemNames.extent);
      return this.reader.getTextByOffset(this.dictionary,offset,end-offset).replace(/@.*$/,"").trim()||`Item #${id}`;
    }

    description(id){
      this.assertId(id);
      const table=this.symbols.ItemDescriptions,pointerOffset=table.offset+(id-1)*2;
      this.memory.assertRange(pointerOffset,2);
      const address=this.memory.u16(pointerOffset),offset=this.memory.banked(table.bank,address);
      const bankEnd=Math.min(this.memory.size,(table.bank+1)*Gen2Memory.BANK_SIZE);
      let end=offset;
      while(end<bankEnd&&this.memory.u8(end)!==this.constructor.TEXT_END)end++;
      if(end>=bankEnd)throw new Error(`${this.name(id)} description is not terminated in bank ${MemoryUtils.hex(table.bank)}.`);
      const text=this.reader.getTextByOffset(this.dictionary,offset,end-offset+1)
        .replace(/@.*$/,"").replace(/<(?:NEXT|LINE|PARA|CONT|SCROLL|_CONT)>/g," ").replace(/\s+/g," ").trim();
      return Object.freeze({pointerOffset,address,bank:table.bank,offset,end:end+1,length:end+1-offset,text});
    }

    get(id){
      this.assertId(id);
      const offset=this.symbols.ItemAttributes.offset+(id-1)*this.constructor.RECORD_SIZE;
      const nameOffset=this.nameOffsets()[id-1],nextNameOffset=this.nameOffsets()[id];
      this.memory.assertRange(offset,this.constructor.RECORD_SIZE);
      const parameterRaw=this.memory.u8(offset+3),permissions=this.memory.u8(offset+4),help=this.memory.u8(offset+6);
      return Object.freeze({
        id,name:this.name(id),offset,nameOffset,nameLength:nextNameOffset-nameOffset,description:this.description(id),
        price:this.memory.u16(offset),heldEffect:this.memory.u8(offset+2),
        parameterRaw,parameter:parameterRaw>0x7f?parameterRaw-0x100:parameterRaw,
        permissions,canSelect:!(permissions&0x40),canToss:!(permissions&0x80),
        pocket:this.memory.u8(offset+5),fieldMenu:help&0x0f,battleMenu:help>>4,help
      });
    }

    list(){
      if(!this._items)this._items=Object.freeze(Array.from({length:this.constructor.COUNT},(_,index)=>{
        const id=index+1;return Object.freeze({id,name:this.name(id)});
      }));
      return this._items;
    }

    category(item){
      const value=Number.isInteger(item?.pocket)?item:this.get(item.id);
      return POCKETS[value.pocket]||`Pocket ${value.pocket}`;
    }

    encode(item,values={}){
      if(!item||!Number.isInteger(item.id))throw new TypeError("A decoded Crystal item is required.");
      const integer=(name,fallback,min,max)=>{
        const value=values[name]===undefined?fallback:Number(values[name]);
        if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`Crystal item ${name} must be ${min}–${max}.`);
        return value;
      };
      const next=this.memory.slice(item.offset,this.constructor.RECORD_SIZE);
      const price=integer("price",item.price,0,65535);
      next[0]=price&0xff;next[1]=price>>8;
      next[2]=integer("heldEffect",item.heldEffect,0,255);
      next[3]=integer("parameter",item.parameter,-128,255)&0xff;
      const canSelect=values.canSelect===undefined?item.canSelect:Boolean(values.canSelect);
      const canToss=values.canToss===undefined?item.canToss:Boolean(values.canToss);
      next[4]=(item.permissions&0x3f)|(canSelect?0:0x40)|(canToss?0:0x80);
      next[5]=integer("pocket",item.pocket,1,4);
      const fieldMenu=integer("fieldMenu",item.fieldMenu,0,15),battleMenu=integer("battleMenu",item.battleMenu,0,15);
      next[6]=battleMenu<<4|fieldMenu;
      return next;
    }

    validate(){
      this._items=null;this._nameOffsets=null;
      for(let id=1;id<=this.constructor.COUNT;id++){
        const item=this.get(id);
        if(item.pocket<1||item.pocket>4)throw new Error(`${item.name} has invalid Crystal pocket ${item.pocket}.`);
        if(!MENUS.has(item.fieldMenu))throw new Error(`${item.name} has invalid field menu ${item.fieldMenu}.`);
        if(!MENUS.has(item.battleMenu))throw new Error(`${item.name} has invalid battle menu ${item.battleMenu}.`);
      }
      return[];
    }

    invalidate(){this._items=null;this._nameOffsets=null;return this;}

    resourceGraph(baseGraph=new root.resources.ResourceGraph()){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder().addGraph(baseGraph);
      const provenance={repository:this.reader.capabilities?.provenance?.repository||"pret/pokecrystal",manifest:this.reader.capabilities?.provenance?.id||null};
      for(let id=1;id<=this.constructor.COUNT;id++){
        const item=this.get(id),resourceId=resources.ResourceId.create("gen2","item",String(id));
        builder.addNode({
          id:resourceId,label:item.name,accuracy:"verified",provenance,
          ranges:[
            {offset:item.offset,length:this.constructor.RECORD_SIZE},
            {offset:item.nameOffset,length:item.nameLength},
            {offset:item.description.pointerOffset,length:2},
            {offset:item.description.offset,length:item.description.length}
          ],
          writeRanges:[{offset:item.offset,length:this.constructor.RECORD_SIZE}],
          data:{itemId:id,pocket:item.pocket,price:item.price}
        });
      }
      return builder.build();
    }
  }

  root.gen2=Object.freeze({...root.gen2,Gen2ItemData,ITEM_POCKETS:POCKETS,ITEM_MENUS:MENUS});
})(globalThis);
