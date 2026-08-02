(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.animation;
  const canvasFor=(reader,codec,source)=>{
    const columns=Math.max(1,Number(source.columns)||1),count=Math.max(1,Number(source.count)||1),
      rows=Math.ceil(count/columns),canvas=document.createElement("canvas"),context=canvas.getContext("2d"),
      image=context.createImageData(columns*8,rows*8),memory=source.bytes?new RomMemory(source.bytes):reader.memory,
      base=source.bytes?0:Number(source.offset),palette=source.palette||["#ffffff","#aaaaaa","#555555","#000000"];
    canvas.width=columns*8;canvas.height=rows*8;
    for(let tile=0;tile<count;tile++){
      const pixels=codec.decodeTile(memory,base+tile*codec.bytesPerTile),tileX=tile%columns,tileY=Math.floor(tile/columns);
      for(let pixel=0;pixel<64;pixel++){
        const ink=pixels[pixel],rgb=Number.parseInt((palette[ink]||palette.at(-1)||"#000000").slice(1),16),
          x=tileX*8+pixel%8,y=tileY*8+Math.floor(pixel/8),at=(y*canvas.width+x)*4;
        image.data.set([rgb>>16&255,rgb>>8&255,rgb&255,ink===0?0:255],at);
      }
    }
    context.putImageData(image,0,0);return canvas;
  };
  class AnimationAssetCatalog{
    constructor(reader,{catalog,codec,prefix,group="Scene",fps=null,repository="pret",file="native scene graphics"}={}){
      this.reader=reader;this.catalog=catalog;this.codec=codec;this.prefix=prefix;this.group=group;this.fps=fps;
      this.repository=repository;this.file=file;
    }
    list(){return this.catalog?.list?.().map(item=>{try{return this.document(item);}catch(error){console.warn("Animation scene asset could not be decoded.",{item,error});return null;}}).filter(Boolean)||[];}
    document(item){
      const source=this.catalog.source(item.id),views=Array.isArray(source.views)?source.views:[source],
        images=views.map(view=>canvasFor(this.reader,this.codec,view)),
        commands=views.map((view,index)=>Object.freeze({
          label:views.length>1?`View ${index+1}`:item.label,
          source:view.title||item.label,offset:view.offset,duration:12
        })),
        frames=commands.map((command,index)=>Object.freeze({
          command:index,label:command.label,duration:command.duration,image:images[index],
          regions:Object.freeze([Object.freeze({id:"layer-1",x:0,y:0,width:images[index].width,height:images[index].height})])
        }));
      return new ns.AnimationDocument({
        id:`scene:${this.prefix}:${item.id}`,name:item.label,domain:"scene",type:"scene-source",fps:this.fps,
        offset:views[0]?.offset,commands,frames,accuracy:"partial",layers:Object.freeze([{id:"layer-1"}]),
        source:{repository:this.repository,file:this.file},
        properties:[
          {label:"Group",value:this.group},
          {label:"Views",value:views.length},
          {label:"Accuracy",value:"Exact ROM graphics; scene timing, tilemap and control program are not decoded"},
          {label:"Graphics",value:MemoryUtils.hex(views[0]?.offset||0,this.reader.family==="gba"?6:5),complexity:"advanced"}
        ]
      });
    }
  }
  ns.AnimationAssetCatalog=AnimationAssetCatalog;
})(globalThis);
