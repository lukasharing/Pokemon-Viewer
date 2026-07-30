(function(global){
  "use strict";
  const root=global.PokemonViewer,ns=root.sound;
  const source=()=>ns.sourceCatalog||{};
  const title=value=>String(value||"").replace(/_/g," ").replace(/\b\w/g,letter=>letter.toUpperCase());
  const reference=(label,values={})=>Object.freeze({type:"map",label,...values});

  class MapMusicCatalog{
    constructor(reader,family){this.reader=reader;this.family=family;this.memory=reader.memory;}
    symbol(name){return this.reader.memoryProfile?.symbol(name)||null;}
    songName(id){
      const family=this.family==="gba"?"gba":"gen2";
      return source()[family]?.songs?.find(song=>song.id===id)?.name||`Song ${ns.hex(id,2)}`;
    }
    document({key,id,name,offset=null,maps=[],sourceName,accuracy="verified",extra={}}){
      return new ns.SoundDocument({
        id:`map:${key}`,name,kind:"song",family:this.family,source:sourceName,accuracy:Number.isInteger(offset)?accuracy:"partial",offset,
        metadata:{group:"map",songId:id,mapCount:maps.length,mapNames:maps.map(map=>map.label),...extra},
        references:maps
      });
    }
    aggregate(entries,{keyOf=entry=>String(entry.id),nameOf=entry=>this.songName(entry.id),offsetOf=()=>null,sourceName}={}){
      const groups=new Map();
      for(const entry of entries){
        const key=keyOf(entry),group=groups.get(key)||{...entry,maps:[]};
        group.maps.push(entry.map);groups.set(key,group);
      }
      return [...groups.entries()].map(([key,entry])=>this.document({
        key,id:entry.id,name:nameOf(entry),offset:offsetOf(entry),maps:entry.maps,sourceName,
        extra:{bank:entry.bank??null}
      }));
    }
    gen1(){
      const rootSymbol=this.symbol("MapSongBanks"),maps=source().gen1?.maps||[];
      if(!rootSymbol||!this.memory.contains(rootSymbol.offset,maps.length*2))return[];
      const entries=maps.map((map,index)=>({
        id:this.memory.u8(rootSymbol.offset+index*2),bank:this.memory.u8(rootSymbol.offset+index*2+1),
        song:map.song,songName:map.songName,map:reference(map.mapName,{id:index,offset:rootSymbol.offset+index*2})
      }));
      return this.aggregate(entries,{
        keyOf:entry=>`${entry.bank}:${entry.id}`,
        nameOf:entry=>`${entry.songName||title(entry.song.replace(/^MUSIC_/,""))} · map music`,
        sourceName:"pret/pokered MapSongBanks"
      });
    }
    gen2(){
      const mapsRoot=this.symbol("MapGroupPointers"),musicRoot=this.symbol("Music");
      if(!mapsRoot||!musicRoot||typeof global.Gen2MapDirectory!=="function")return[];
      let directory;try{directory=new Gen2MapDirectory(this.memory,{tableOffset:mapsRoot.offset,tableBank:mapsRoot.bank});}catch{return[];}
      const entries=[];
      for(const locator of directory.list()){
        try{
          const map=directory.entry(locator.group,locator.map);
          entries.push({id:map.music,map:reference(`Group ${locator.group} · Map ${locator.map}`,{id:locator.id,offset:map.offset+6})});
        }catch{}
      }
      return this.aggregate(entries,{
        nameOf:entry=>`${this.songName(entry.id)} · map music`,
        offsetOf:entry=>{
          const table=musicRoot.offset+entry.id*3;
          if(!this.memory.contains(table,3))return null;
          try{return this.memory.banked(this.memory.u8(table+2),this.memory.u16(table));}catch{return null;}
        },
        sourceName:"pret/pokecrystal map group music byte → Music"
      });
    }
    gba(){
      const mapsRoot=this.symbol("gMapGroups"),songRoot=this.symbol("gSongTable"),groups=source().gba?.groups||[];
      if(!mapsRoot||!songRoot)return[];
      const entries=[];
      for(const group of groups){
        let groupOffset;try{groupOffset=this.memory.pointer(mapsRoot.offset+group.index*4);}catch{continue;}
        for(let index=0;index<group.maps.length;index++){
          try{
            const header=this.memory.pointer(groupOffset+index*4);
            if(!this.memory.contains(header,28))continue;
            const id=this.memory.u16(header+16),map=group.maps[index];
            entries.push({id,map:reference(`${group.name} · ${map.label}`,{id:`${group.index}:${index}`,offset:header+16})});
          }catch{}
        }
      }
      return this.aggregate(entries,{
        nameOf:entry=>`${this.songName(entry.id)} · map music`,
        offsetOf:entry=>{try{return this.memory.pointer(songRoot.offset+entry.id*8);}catch{return null;}},
        sourceName:"pret/pokeemerald MapHeader.music → gSongTable"
      });
    }
    list(){
      if(this.family==="gba")return this.gba();
      if(this.family==="gen2")return this.gen2();
      return this.gen1();
    }
  }

  ns.MapMusicCatalog=MapMusicCatalog;
})(globalThis);
