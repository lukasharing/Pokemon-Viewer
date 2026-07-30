(function(global){
  "use strict";
  const NAMES=`Chris|Chris Bike|Gameboy Kid|Rival|Oak|Red|Blue|Bill|Elder|Janine|Kurt|Mom|Blaine|Red's Mom|Daisy|Elm|Will|Falkner|Whitney|Bugsy|Morty|Chuck|Jasmine|Pryce|Clair|Brock|Karen|Bruno|Misty|Lance|Surge|Erika|Koga|Sabrina|Cooltrainer M|Cooltrainer F|Bug Catcher|Twin|Youngster|Lass|Teacher|Beauty|Super Nerd|Rocker|Pokéfan M|Pokéfan F|Gramps|Granny|Swimmer M|Swimmer F|Big Snorlax|Surfing Pikachu|Rocket|Rocket Girl|Nurse|Link Receptionist|Clerk|Fisher|Fishing Guru|Scientist|Kimono Girl|Sage|Unused Guy|Gentleman|Black Belt|Receptionist|Officer|Cal|Slowpoke|Captain|Big Lapras|Gym Guide|Sailor|Biker|Pharmacist|Monster|Fairy|Bird|Dragon|Big Onix|Nintendo 64|Sudowoodo|Surf|Poké Ball|Pokédex|Paper|Virtual Boy|Old Link Receptionist|Rock|Boulder|SNES|Famicom|Fruit Tree|Gold Trophy|Silver Trophy|Kris|Kris Bike|Kurt Outside|Suicune|Entei|Raikou|Standing Youngster`.split("|");
  const rgb5=value=>Math.round(value*255/31),color=(r,g,b)=>`#${[r,g,b].map(rgb5).map(value=>value.toString(16).padStart(2,"0")).join("")}`;
  const DAY_PALETTES=Object.freeze([
    [[27,31,27],[31,19,10],[31,7,1],[0,0,0]],[[27,31,27],[31,19,10],[10,9,31],[0,0,0]],
    [[27,31,27],[31,19,10],[7,23,3],[0,0,0]],[[27,31,27],[31,19,10],[15,10,3],[0,0,0]],
    [[27,31,27],[31,19,10],[30,10,6],[0,0,0]],[[31,31,31],[31,31,31],[13,13,13],[0,0,0]],
    [[22,31,10],[12,25,1],[5,14,0],[7,7,7]],[[27,31,27],[24,18,7],[20,15,3],[7,7,7]]
  ].map(palette=>Object.freeze(palette.map(value=>color(...value)))));
  class Gen2OverworldSprite{
    static SIZE=6;
    static read(memory,offset,{id=1}={}){
      memory.assertRange(offset,this.SIZE);
      const address=memory.u16(offset),tiles=memory.u8(offset+2),bank=memory.u8(offset+3),type=memory.u8(offset+4),palette=memory.u8(offset+5);
      if(address<0x4000||address>0x7fff||![4,12].includes(tiles)||bank===0||bank*Gen2Memory.BANK_SIZE>=memory.size||type<1||type>3||palette>7)throw new RangeError("Invalid Crystal overworld sprite entry.");
      const graphicsOffset=memory.banked(bank,address);memory.assertRange(graphicsOffset,tiles*16);
      return Object.freeze({id,offset,address,tiles,bank,type,palette,graphicsOffset});
    }
  }
  class Gen2OverworldSpriteCatalog{
    static COUNT=102;
    static TABLES=new WeakMap();
    constructor(memory){
      if(!(memory instanceof Gen2Memory))throw new TypeError("Gen2OverworldSpriteCatalog requires Gen2Memory.");
      this.memory=memory;
      if(this.constructor.TABLES.has(memory))this.tableOffset=this.constructor.TABLES.get(memory);
      else{this.tableOffset=this.findTable();this.constructor.TABLES.set(memory,this.tableOffset);}
      this.entries=this.readEntries();
    }
    findTable(){
      const length=this.constructor.COUNT*Gen2OverworldSprite.SIZE;
      for(let offset=0;offset<=this.memory.size-length;offset++){
        let valid=true;
        for(let index=0;index<this.constructor.COUNT;index++){
          const entry=offset+index*6,address=this.memory.u16(entry),tiles=this.memory.u8(entry+2),bank=this.memory.u8(entry+3),type=this.memory.u8(entry+4),palette=this.memory.u8(entry+5);
          const graphicsOffset=bank*Gen2Memory.BANK_SIZE+(address-0x4000);
          if(address<0x4000||address>0x7fff||![4,12].includes(tiles)||bank===0||bank*Gen2Memory.BANK_SIZE>=this.memory.size||type<1||type>3||palette>7||graphicsOffset<0||graphicsOffset+tiles*16>this.memory.size){valid=false;break;}
        }
        if(valid)return offset;
      }
      return null;
    }
    readEntries(){
      if(this.tableOffset===null)return Object.freeze([]);
      return Object.freeze(Array.from({length:this.constructor.COUNT},(_,index)=>{
        const sprite=Gen2OverworldSprite.read(this.memory,this.tableOffset+index*6,{id:index+1});
        return Object.freeze({...sprite,label:NAMES[index]||`Overworld sprite ${index+1}`});
      }));
    }
    available(){return this.entries.length===this.constructor.COUNT;}
    list(){return this.entries;}
    entry(id){return this.entries[id-1]||null;}
    source(id){
      const entry=this.entry(id);if(!entry)throw new RangeError("Choose a valid Crystal overworld sprite.");
      const stateCount=entry.tiles/4,directions=["South","North","West"],views=Array.from({length:stateCount},(_,index)=>Object.freeze({
        offset:entry.graphicsOffset+index*64,count:4,columns:2,label:directions[index]||`State ${index+1}`,title:`${entry.label} · ${directions[index]||`State ${index+1}`}`,editable:true,palette:DAY_PALETTES[entry.palette],canFlipX:index===2
      }));
      if(stateCount===3)views.push(Object.freeze({...views[2],label:"East",title:`${entry.label} · East`,flipX:true}));
      return stateCount===1?Object.freeze({...views[0],title:entry.label}):Object.freeze({title:entry.label,views:Object.freeze(views)});
    }
  }
  Object.assign(global,{Gen2OverworldSprite,Gen2OverworldSpriteCatalog});
  ((global.PokemonViewer ||= {}).structures ||= {}).Gen2OverworldSpriteCatalog=Gen2OverworldSpriteCatalog;
})(globalThis);
