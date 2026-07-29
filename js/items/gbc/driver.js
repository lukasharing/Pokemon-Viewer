(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  class GbcItemDriver{
    constructor({reader}){this.reader=reader;this.memory=reader.memory;this.data=reader.gen1ItemData||=new root.gen1.Gen1ItemData(reader);this.overworld=reader.structureRegistry.createOverworldSpriteCatalog(this.memory);this.editable=true;}
    list(){return this.data.list();}
    category(entry){return this.data.category(entry);}
    read(id){return this.data.get(id);}
    icon(){try{return this.overworld.source(0x3d).views[0];}catch{return null;}}
    properties(item){return[["Price",`${item.price} ₽`],["Category",item.category],["Field graphic","Shared Poké Ball object"],["Item ID",item.id],["Name offset",MemoryUtils.hex(item.offset,6)],["Price offset",MemoryUtils.hex(item.priceOffset,6)]];}
    editFields(item){return[{name:"price",label:"Price",type:"number",value:item.price,min:0,max:999999}];}
    edit(item,values,stack){
      const before=MemoryUtils.bytes(this.memory,item.priceOffset,3),after=this.data.catalog.encodePrice(values.price);
      if(before.every((value,index)=>value===after[index]))return false;
      const replace=(expected,next)=>MemoryUtils.replace(this.memory,item.priceOffset,expected,next,{message:"Item price changed after this command"});
      stack.execute({label:`Edit ${item.name}`,description:`Gen I item #${item.id}`,do:()=>replace(before,after),undo:()=>replace(after,before)});return true;
    }
    spriteLink(){return{workspace:"sprite_editor",group:"objects",sprite:0x3d};}
  }
  root.items.registry.register("gbc",context=>new GbcItemDriver(context));
})(globalThis);
