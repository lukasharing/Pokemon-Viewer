(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const TYPES=Object.freeze(["Normal","Fighting","Flying","Poison","Ground","Rock","Bug","Ghost","Steel","Mystery","Fire","Water","Grass","Electric","Psychic","Ice","Dragon","Dark"]);
  const TARGETS=Object.freeze(["Selected target","Depends on move","User or selected target","Random opponent","Both opponents","User","All except user","Opponents' field"]);
  const MACHINES=Object.freeze([
    ["TM01","Focus Punch",264],["TM02","Dragon Claw",337],["TM03","Water Pulse",352],["TM04","Calm Mind",347],["TM05","Roar",46],
    ["TM06","Toxic",92],["TM07","Hail",258],["TM08","Bulk Up",339],["TM09","Bullet Seed",331],["TM10","Hidden Power",237],
    ["TM11","Sunny Day",241],["TM12","Taunt",269],["TM13","Ice Beam",58],["TM14","Blizzard",59],["TM15","Hyper Beam",63],
    ["TM16","Light Screen",113],["TM17","Protect",182],["TM18","Rain Dance",240],["TM19","Giga Drain",202],["TM20","Safeguard",219],
    ["TM21","Frustration",218],["TM22","Solar Beam",76],["TM23","Iron Tail",231],["TM24","Thunderbolt",85],["TM25","Thunder",87],
    ["TM26","Earthquake",89],["TM27","Return",216],["TM28","Dig",91],["TM29","Psychic",94],["TM30","Shadow Ball",247],
    ["TM31","Brick Break",280],["TM32","Double Team",104],["TM33","Reflect",115],["TM34","Shock Wave",351],["TM35","Flamethrower",53],
    ["TM36","Sludge Bomb",188],["TM37","Sandstorm",201],["TM38","Fire Blast",126],["TM39","Rock Tomb",317],["TM40","Aerial Ace",332],
    ["TM41","Torment",259],["TM42","Facade",263],["TM43","Secret Power",290],["TM44","Rest",156],["TM45","Attract",213],
    ["TM46","Thief",168],["TM47","Steel Wing",211],["TM48","Skill Swap",285],["TM49","Snatch",289],["TM50","Overheat",315],
    ["HM01","Cut",15],["HM02","Fly",19],["HM03","Surf",57],["HM04","Strength",70],["HM05","Flash",148],["HM06","Rock Smash",249],
    ["HM07","Waterfall",127],["HM08","Dive",291]
  ].map(([label,name,moveId],index)=>Object.freeze({index,label,name,moveId})));

  class GbaMoveData{
    constructor(reader){
      this.reader=reader;this.memory=reader.memory;this.profile=root.gba.assets.profile(reader);this._moves=null;
      this.structure=reader.memoryProfile?.structure?.("GbaMove");
      if(!this.structure)throw new Error("The GBA Move manual structure contract is unavailable.");
      this.recordSize=this.requiredInteger("size");this.nameBytes=this.requiredInteger("nameBytes");
      this.accuracyScale=this.requiredInteger("accuracyScale");
      for(const name of ["battleMoves","moveNames","moveCount"]){
        if(!Number.isInteger(this.profile?.[name]))throw new Error(`The GBA Move profile is missing ${name}.`);
      }
      global.ProjectValidator?.registerDomain(reader,"gba-moves",()=>this.validate());
    }
    requiredInteger(name){
      const value=this.structure?.[name];
      if(!Number.isInteger(value)||value<=0)throw new Error(`The GBA Move contract has invalid ${name}.`);
      return value;
    }
    field(name){
      const value=this.structure?.fields?.[name];
      if(!Number.isInteger(value?.byte)||!["u8","s8","u32"].includes(value.type))throw new Error(`The GBA Move contract has invalid field '${name}'.`);
      return value;
    }
    read(offset,name){
      const field=this.field(name),value=field.type==="u32"?this.memory.u32(offset+field.byte):this.memory.u8(offset+field.byte);
      return field.type==="s8"&&value>127?value-256:value;
    }
    assertId(id){if(!Number.isInteger(id)||id<1||id>this.profile.moveCount)throw new RangeError(`GBA move ID must be 1–${this.profile.moveCount}.`);}
    name(id){
      this.assertId(id);const offset=this.profile.moveNames+id*this.nameBytes;
      this.memory.assertRange(offset,this.nameBytes);
      return this.reader.getTextByOffset(this.reader.getDictionary("text_table_en"),offset,this.nameBytes).trim()||`Move #${id}`;
    }
    get(id){
      this.assertId(id);const offset=this.profile.battleMoves+id*this.recordSize,nameOffset=this.profile.moveNames+id*this.nameBytes;
      this.memory.assertRange(offset,this.recordSize);
      const accuracy=this.read(offset,"accuracy"),chance=this.read(offset,"effectChance");
      return Object.freeze({
        id,name:this.name(id),offset,nameOffset,effect:this.read(offset,"effect"),power:this.read(offset,"power"),
        type:this.read(offset,"type"),accuracy,accuracyPercent:accuracy,pp:this.read(offset,"pp"),
        effectChance:chance,effectChancePercent:chance,target:this.read(offset,"target"),
        priority:this.read(offset,"priority"),flags:this.read(offset,"flags")
      });
    }
    list(){if(!this._moves)this._moves=Object.freeze(Array.from({length:this.profile.moveCount},(_,index)=>this.get(index+1)));return this._moves;}
    typeName(id){return TYPES[id]||`Unknown type ${id}`;}
    targetName(id){return TARGETS[id]||`Target ${id}`;}
    encode(move,values={}){
      const integer=(name,fallback,min=0,max=255)=>{const value=values[name]===undefined?fallback:Number(values[name]);if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`GBA move ${name} must be ${min}–${max}.`);return value;};
      const bytes=MemoryUtils.bytes(this.memory,move.offset,this.recordSize),set=(name,value)=>{bytes[this.field(name).byte]=value&255;};
      set("effect",integer("effect",move.effect));set("power",integer("power",move.power));
      set("type",integer("type",move.type,0,TYPES.length-1));
      set("accuracy",integer("accuracy",move.accuracy,0,this.accuracyScale));set("pp",integer("pp",move.pp,1,40));
      set("effectChance",integer("effectChance",move.effectChance,0,this.accuracyScale));
      set("target",integer("target",move.target));set("priority",integer("priority",move.priority,-128,127));
      return bytes;
    }
    validate(){
      this.invalidate();
      for(const move of this.list()){
        if(move.pp<1||move.pp>40)throw new Error(`${move.name} has invalid PP ${move.pp}.`);
        if(move.type>=TYPES.length)throw new Error(`${move.name} has invalid type ${move.type}.`);
        if(move.accuracy>this.accuracyScale)throw new Error(`${move.name} has invalid accuracy ${move.accuracy}.`);
        if(move.effectChance>this.accuracyScale)throw new Error(`${move.name} has invalid effect chance ${move.effectChance}.`);
      }
      return[];
    }
    resourceGraph(baseGraph=new root.resources.ResourceGraph(),{speciesData=null}={}){
      const resources=root.resources,builder=new resources.ResourceGraphBuilder().addGraph(baseGraph);
      const provenance=this.reader.capabilities?.provenance||{};
      const rid=(type,key)=>resources.ResourceId.create("gba",type,String(key));
      const addNode=value=>builder.nodes.has(value.id)?builder.nodes.get(value.id):builder.addNode(value);
      const addEdge=value=>builder.edges.has(value.id)?builder.edges.get(value.id):builder.addEdge(value);

      for(const move of this.list())addNode({
        id:rid("move",move.id),label:move.name,accuracy:"verified",provenance,
        ranges:[
          {offset:move.offset,length:this.recordSize},
          {offset:move.nameOffset,length:this.nameBytes}
        ],
        writeRanges:[{offset:move.offset,length:8}],
        data:{
          moveId:move.id,effect:move.effect,power:move.power,type:move.type,
          accuracy:move.accuracy,pp:move.pp,effectChance:move.effectChance,
          target:move.target,priority:move.priority,flags:move.flags
        }
      });

      const configuredMachineCount=Number(speciesData?.profile?.tmHmCount);
      const machineCount=Math.min(
        Number.isInteger(configuredMachineCount)?configuredMachineCount:MACHINES.length,
        MACHINES.length
      );
      for(const machine of MACHINES.slice(0,machineCount)){
        const machineId=rid("machine",machine.label.toLowerCase());
        addNode({
          id:machineId,label:`${machine.label} · ${machine.name}`,
          accuracy:"verified",provenance,
          data:{machineIndex:machine.index,label:machine.label,moveId:machine.moveId}
        });
        addEdge({
          id:`${machineId}/move`,source:machineId,target:rid("move",machine.moveId),
          field:"move",kind:"id",confidence:"verified",provenance,
          rewritePolicy:"immutable"
        });
      }

      if(speciesData){
        builder.fillGraph(speciesData.resourceGraph());
        for(const species of speciesData.catalog.list()){
          if(Number.isInteger(speciesData.profile.levelUpLearnsets)){
            const learnsetId=rid("learnset",species.id);
            speciesData.levelUpMoves(species.id).forEach((entry,index)=>addEdge({
              id:`${learnsetId}/move-${index+1}`,source:learnsetId,
              target:rid("move",entry.moveId),field:`moves[${index}]`,
              range:{offset:entry.offset,length:2},kind:"id",
              confidence:"verified",provenance,rewritePolicy:"rewrite-id",
              data:{level:entry.level}
            }));
          }
          if(Number.isInteger(speciesData.profile.tmHmLearnsets)){
            const compatibilityId=rid("machine-compatibility",species.id);
            for(const machineIndex of speciesData.machineIndexes(species.id)){
              const machine=MACHINES[machineIndex];
              if(!machine||machineIndex>=machineCount)continue;
              addEdge({
                id:`${compatibilityId}/machine-${machineIndex+1}`,
                source:compatibilityId,target:rid("machine",machine.label.toLowerCase()),
                field:`machines[${machineIndex}]`,
                range:{
                  offset:speciesData.profile.tmHmLearnsets+
                    species.id*speciesData.constructor.TM_HM_SIZE+(machineIndex>>3),
                  length:1
                },
                kind:"id",confidence:"verified",provenance,
                rewritePolicy:"rewrite-id",data:{bit:machineIndex&7}
              });
            }
          }
        }
      }
      return builder.build();
    }
    invalidate(){this._moves=null;return this;}
  }
  root.gba=Object.freeze({...root.gba,GbaMoveData,GBA_MOVE_TYPES:TYPES,GBA_MOVE_TARGETS:TARGETS,GBA_MACHINES:MACHINES});
})(globalThis);
