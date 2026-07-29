(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  const counts=Object.freeze({gba:386,gbc:190,gen2:251});

  class GenericSoundDriver {
    constructor({reader,family}){this.reader=reader;this.family=family;this.count=counts[family]||151;this.species=PokemonViewer.species.forReader(reader,family);}
    list(){
      const cries=this.species.list().map(species=>new ns.SoundDocument({
        id:species.id,name:`${species.name} cry`,kind:"cry",family:this.family,
        source:"Species id → cry entry",accuracy:species.accuracy,metadata:{group:"cry",speciesId:species.id,speciesName:species.name,dexNumber:species.dexNumber,isGlitch:species.isGlitch,cryTable:"Cry data / cry command table"},
        references:[
          {type:"species",id:species.id,label:`${species.name} (#${species.id})`,offset:species.nameOffset},
          {type:"table",label:"Cry data table (family-specific decoder pending)"},
          ...species.references.filter(reference=>reference.type==="table")
        ]
      }));
      const system=[
        new ns.SoundDocument({id:"map-music",name:"Map music references",kind:"song",family:this.family,source:"Map headers",accuracy:"partial",metadata:{group:"map"},references:[{type:"map",label:"Map header music field"}]}),
        new ns.SoundDocument({id:"event-sfx",name:"Event sound references",kind:"sfx",family:this.family,source:"Event and script commands",accuracy:"partial",metadata:{group:"sfx"},references:[{type:"script",label:"playse / sound command"}]})
      ];
      return [...system,...cries];
    }
    describe(document){
      if(document.kind==="cry")return {summary:`${document.metadata.speciesName} is linked through species id ${document.metadata.speciesId}. The species association is available; decoding its actual cry parameters waits for a verified ${this.family.toUpperCase()} cry-table profile.`,tracks:[],commands:[],voices:[]};
      return {summary:"This reference is discovered from game structures; load a profile with audio tables to decode its commands.",tracks:[],commands:[],voices:[]};
    }
  }
  ns.GenericSoundDriver=GenericSoundDriver;

  class Gen1SoundDriver extends GenericSoundDriver {
    constructor(context){
      super({...context,family:"gbc"});
      this.data=this.reader.gen1SpeciesData||=new PokemonViewer.gen1.Gen1SpeciesData(this.reader);
      this.reader.resourceGraph||=this.data.resourceGraph();
    }
    resourceGraph(){return this.reader.resourceGraph;}
    list(){
      const cries=this.species.list().map(species=>{
        const cry=this.data.cry(species);
        const resourceId=PokemonViewer.resources.ResourceId.create("gen1","cry",String(species.internalId));
        const speciesResourceId=species.dexNumber?PokemonViewer.resources.ResourceId.create("gen1","species",String(species.dexNumber)):null;
        return new ns.SoundDocument({
          id:species.id,name:`${species.name} cry`,kind:"cry",family:"gbc",
          source:"pret/pokered CryData",accuracy:"verified",offset:cry.offset,editable:true,
          metadata:{
            speciesId:species.id,speciesName:species.name,dexNumber:species.dexNumber,isGlitch:species.isGlitch,
            group:"cry",cryTable:"CryData",resourceId,speciesResourceId,baseCry:cry.baseCry,pitch:cry.pitch,length:cry.length
          },
          references:[
            {type:"species",id:species.id,resourceId:speciesResourceId,label:`${species.name} (internal #${species.id})`,offset:species.nameOffset},
            ...(species.dexNumber?[{type:"pokedex",id:species.dexNumber,label:`Pokédex #${species.dexNumber}`}]:[]),
            {type:"table",label:"CryData · 3-byte internal-species record",offset:cry.offset}
          ]
        });
      });
      return[
        new ns.SoundDocument({id:"map-music",name:"Map music references",kind:"song",family:"gbc",source:"Map headers",accuracy:"partial",metadata:{group:"map"},references:[{type:"map",label:"Map header music field"}]}),
        new ns.SoundDocument({id:"event-sfx",name:"Event sound references",kind:"sfx",family:"gbc",source:"Text/assembly commands",accuracy:"partial",metadata:{group:"sfx"},references:[{type:"script",label:"sound command / native routine"}]}),
        ...cries
      ];
    }
    describe(document){
      if(document.kind!=="cry")return super.describe(document);
      const {baseCry,pitch,length,speciesName}=document.metadata;
      return{
        summary:`Verified Gen I CryData record for ${speciesName}: base cry ${MemoryUtils.hex(baseCry)}, pitch ${MemoryUtils.hex(pitch)}, length ${MemoryUtils.hex(length)}. These three parameters are writable; channel-stream playback remains unavailable until the audio-header graph is decoded.`,
        tracks:[],
        commands:[new ns.SoundCommand({offset:document.offset,opcode:baseCry,name:"mon_cry",arguments:[`base=${MemoryUtils.hex(baseCry)}`,`pitch=${MemoryUtils.hex(pitch)}`,`length=${MemoryUtils.hex(length)}`],tick:0,accuracy:"verified"})],
        voices:[]
      };
    }
    editFields(document){
      if(document.kind!=="cry")return[];
      return[
        {name:"baseCry",label:"Base cry",type:"number",value:document.metadata.baseCry,min:0,max:255},
        {name:"pitch",label:"Pitch",type:"number",value:document.metadata.pitch,min:0,max:255},
        {name:"length",label:"Length",type:"number",value:document.metadata.length,min:0,max:255}
      ];
    }
    edit(document,values,stack){
      if(document.kind!=="cry"||!document.editable)return false;
      const species=this.data.catalog.get(Number(document.metadata.speciesId));
      if(!species)throw new RangeError("The selected Gen I cry has no canonical internal species identity.");
      const plan=this.data.cryEditPlan(species,values);
      if(plan.before.every((value,index)=>value===plan.after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.reader.memory,plan.offset,expected,next,{message:"CryData changed after this command"});
      stack.execute({
        label:`Edit ${document.metadata.speciesName} cry`,
        description:`base ${MemoryUtils.hex(plan.after[0])} · pitch ${MemoryUtils.hex(plan.after[1])} · length ${MemoryUtils.hex(plan.after[2])}`,
        do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)
      });
      let graph=this.data.resourceGraph();
      const progression=this.reader.gen1ProgressionData;
      if(progression)graph=progression.resourceGraph(graph);
      const trainers=this.reader.gen1TrainerData;
      if(trainers)graph=trainers.resourceGraph(graph);
      this.reader.resourceGraph=graph;
      return true;
    }
  }

  class Gen2SoundDriver extends GenericSoundDriver{
    constructor(context){
      super({...context,family:"gen2"});
      this.data=this.reader.gen2SpeciesData||=new PokemonViewer.gen2.Gen2SpeciesData(this.reader);
      this.reader.resourceGraph||=this.data.resourceGraph();
    }
    list(){
      const cries=this.data.catalog.list().map(species=>{
        const cry=this.data.cry(species.id);
        return new ns.SoundDocument({
          id:species.id,name:`${species.name} cry`,kind:"cry",family:"gen2",
          source:"pret/pokecrystal PokemonCries",accuracy:"verified",offset:cry.offset,editable:true,
          metadata:{group:"cry",speciesId:species.id,speciesName:species.name,dexNumber:species.id,cryTable:"PokemonCries",resourceId:`gen2:cry:${species.id}`,speciesResourceId:`gen2:species:${species.id}`,baseCry:cry.baseCry,pitch:cry.pitch,length:cry.length},
          references:[
            {type:"species",id:species.id,resourceId:`gen2:species:${species.id}`,label:`${species.name} (#${species.id})`,offset:species.nameOffset},
            {type:"pokedex",id:species.id,label:`Pokédex #${species.id}`},
            {type:"table",label:"PokemonCries · 6-byte species record",offset:cry.offset}
          ]
        });
      });
      return[
        new ns.SoundDocument({id:"music-root",name:"Music command root",kind:"song",family:"gen2",source:"pret/pokecrystal Music",accuracy:"partial",metadata:{group:"music"},references:[{type:"table",label:"Music root; channel decoder pending"}]}),
        ...cries
      ];
    }
    describe(document){
      if(document.kind!=="cry")return super.describe(document);
      const {baseCry,pitch,length,speciesName}=document.metadata;
      return{
        summary:`Verified Crystal PokemonCries record for ${speciesName}: base cry ${MemoryUtils.hex(baseCry,4)}, pitch ${MemoryUtils.hex(pitch,4)}, length ${MemoryUtils.hex(length,4)}. The six-byte parameters are writable; channel streams remain explicit pending work.`,
        tracks:[],voices:[],
        commands:[new ns.SoundCommand({offset:document.offset,opcode:baseCry,name:"mon_cry",arguments:[`base=${MemoryUtils.hex(baseCry)}`,`pitch=${MemoryUtils.hex(pitch,4)}`,`length=${MemoryUtils.hex(length,4)}`],tick:0,accuracy:"verified"})]
      };
    }
    editFields(document){return document.kind==="cry"?[
      {name:"baseCry",label:"Base cry",type:"number",value:document.metadata.baseCry,min:0,max:65535},
      {name:"pitch",label:"Pitch",type:"number",value:document.metadata.pitch,min:0,max:65535},
      {name:"length",label:"Length",type:"number",value:document.metadata.length,min:0,max:65535}
    ]:[];}
    edit(document,values,stack){
      if(document.kind!=="cry"||!document.editable)return false;
      const plan=this.data.cryEditPlan(Number(document.metadata.speciesId),values);
      if(plan.before.every((value,index)=>value===plan.after[index]))return false;
      const write=(expected,next)=>MemoryUtils.replace(this.reader.memory,plan.offset,expected,next,{message:"Crystal PokemonCries changed after this command"});
      stack.execute({label:`Edit ${document.metadata.speciesName} cry`,description:`Pokédex #${document.metadata.speciesId}`,do:()=>write(plan.before,plan.after),undo:()=>write(plan.after,plan.before)});
      this.reader.resourceGraph=this.data.resourceGraph();
      return true;
    }
  }

  ns.registry.register("gbc",context=>new Gen1SoundDriver(context));
  ns.registry.register("gen2",context=>new Gen2SoundDriver(context));
})(globalThis);
