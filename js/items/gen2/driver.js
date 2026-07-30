(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});

  class Gen2ItemDriver{
    constructor({reader}){
      this.reader=reader;this.memory=reader.memory;this.editable=true;
      this.data=reader.gen2ItemData||=new root.gen2.Gen2ItemData(reader);
      this.baseGraph=reader.resourceGraph||new root.resources.ResourceGraph();
      this.refresh();
    }
    list(){return this.data.list();}
    category(entry){return this.data.category(entry);}
    read(id){const item=this.data.get(id);return Object.freeze({...item,category:this.category(item),iconShared:true});}
    icon(){return null;}
    iconNote(){return"Crystal stores item names, attributes and descriptions, but no per-item bag icon table.";}
    properties(item){return[
      ["Price",`${item.price} ₽`],["Pocket",item.category],["Description",item.description.text],
      ["Held effect",item.heldEffect],["Parameter",item.parameter],
      ["Selectable",item.canSelect?"Yes":"No"],["Tossable",item.canToss?"Yes":"No"],
      ["Field menu",root.gen2.ITEM_MENUS.get(item.fieldMenu)||item.fieldMenu],
      ["Battle menu",root.gen2.ITEM_MENUS.get(item.battleMenu)||item.battleMenu],
      ["Item ID",item.id],["Record offset",MemoryUtils.hex(item.offset,6)]
    ];}
    editFields(item){
      const menuOptions=[...root.gen2.ITEM_MENUS].map(([value,label])=>({value,label}));
      return[
        {name:"price",label:"Price",type:"number",value:item.price,min:0,max:65535,fullWidth:false},
        {name:"pocket",label:"Pocket",valueType:"number",value:item.pocket,options:root.gen2.ITEM_POCKETS.flatMap((label,value)=>label?[{label,value}]:[])},
        {name:"canSelect",label:"Can be selected",type:"checkbox",value:item.canSelect,fullWidth:false},
        {name:"canToss",label:"Can be tossed",type:"checkbox",value:item.canToss,fullWidth:false},
        {name:"fieldMenu",label:"Field action",valueType:"number",value:item.fieldMenu,options:menuOptions},
        {name:"battleMenu",label:"Battle action",valueType:"number",value:item.battleMenu,options:menuOptions},
        {name:"heldEffect",label:"Held effect ID",type:"number",value:item.heldEffect,min:0,max:255,fullWidth:false},
        {name:"parameter",label:"Effect parameter",type:"number",value:item.parameter,min:-128,max:255,fullWidth:false}
      ];
    }
    edit(item,values,stack){
      const before=MemoryUtils.bytes(this.memory,item.offset,root.gen2.Gen2ItemData.RECORD_SIZE),after=this.data.encode(item,values);
      if(before.every((value,index)=>value===after[index]))return false;
      const replace=(expected,next)=>MemoryUtils.replace(this.memory,item.offset,expected,next,{message:"Crystal ItemAttributes record changed after this command"});
      stack.execute({
        label:`Edit ${item.name}`,description:`Crystal item #${item.id}`,
        do:()=>{replace(before,after);this.refresh();},
        undo:()=>{replace(after,before);this.refresh();}
      });
      return true;
    }
    spriteLink(){return null;}
    refresh(){
      this.data.invalidate();
      this.reader.resourceGraph=this.data.resourceGraph(this.baseGraph);
      global.ProjectEvents?.resources?.(this.reader.resourceGraph);
    }
  }

  root.items.registry.register("gen2",context=>new Gen2ItemDriver(context));
})(globalThis);
