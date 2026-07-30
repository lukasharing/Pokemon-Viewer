(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  class GbaItemDriver{
    constructor({reader}){this.reader=reader;this.memory=reader.memory;this.data=reader.gbaItemData||=new root.gba.GbaItemData(reader);this.editable=true;}
    list(){return this.data.list();}
    category(entry){const offset=this.data.profile.items+entry.id*root.gba.GbaItemData.RECORD_SIZE,pocket=this.memory.u8(offset+26);return /BERRY$/i.test(entry.name)?"Berries":(["Items","Items","Key items","Poké Balls","TMs / HMs","Berries"][pocket]||"Items");}
    read(id){return this.data.get(id);}
    icon(item){return this.data.iconSource(item.id);}
    properties(item){return[["Price",`${item.price} ₽`],["Pocket",item.category],["Importance",item.importance?"Key item":"Standard"],["Held effect",item.holdEffect],["Battle use",item.battleUsage?"Yes":"No"],["Item ID",item.id],["Record offset",MemoryUtils.hex(item.offset,6)]];}
    editFields(item){return[
      {name:"price",label:"Price",type:"number",value:item.price,min:0,max:65535},
      {name:"pocket",label:"Pocket",valueType:"number",value:item.pocket,options:[["Items",1],["Key items",2],["Poké Balls",3],["TMs / HMs",4],["Berries",5]].map(([label,value])=>({label,value}))},
      {name:"importance",label:"Importance",valueType:"number",value:item.importance,options:[{label:"Standard",value:0},{label:"Key item",value:1},{label:"Special",value:2}]}
    ];}
    edit(item,values,stack){
      const before=MemoryUtils.bytes(this.memory,item.offset,root.gba.GbaItemData.RECORD_SIZE),after=this.data.encode(item,values);
      if(before.every((value,index)=>value===after[index]))return false;
      const replace=(expected,next)=>MemoryUtils.replace(this.memory,item.offset,expected,next,{message:"Item record changed after this command"});
      stack.execute({label:`Edit ${item.name}`,description:`GBA item #${item.id}`,do:()=>replace(before,after),undo:()=>replace(after,before)});return true;
    }
    spriteLink(item){return item.icon?{workspace:"sprite_editor",group:"items",sprite:item.id}:null;}
  }
  root.items.registry.register("gba",context=>new GbaItemDriver(context));
})(globalThis);
