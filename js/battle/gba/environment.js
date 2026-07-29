(function(global){
  "use strict";
  const ns=(((global.PokemonViewer||={}).battle||={}).gba||={});
  const LABELS=Object.freeze(["Grass","Long grass","Sand","Underwater","Water","Pond","Mountain","Cave","Building","Plain"]);
  // Exact TILE_FLAG_SURFABLE members in pokeemerald's
  // sTileBitAttributes. Keep this engine-owned predicate isolated here.
  const WATER=new Set([16,17,18,19,20,21,25,34,42,80,81,82,83,108,109,111]);
  const DEEP_WATER=new Set([17,18,21]);

  // Map-state portion of pokeemerald BattleSetup_GetEnvironmentId. Runtime-only
  // surfing/bridge state is intentionally not guessed by the editor.
  class GbaBattleEnvironmentResolver{
    static resolve({mapType,behavior,weather,bank,map,x,y}={}){
      mapType=Number(mapType);behavior=Number(behavior);
      let id,reason;
      if(behavior===2){id=0;reason="MB_TALL_GRASS";}
      else if(behavior===3){id=1;reason="MB_LONG_GRASS";}
      else if(behavior===6||behavior===33){id=2;reason="MB_DEEP_SAND / MB_SAND";}
      else if(mapType===4){id=behavior===11?8:WATER.has(behavior)?5:7;reason="MAP_TYPE_UNDERGROUND";}
      else if(mapType===8||mapType===9){id=8;reason="MAP_TYPE_INDOOR / SECRET_BASE";}
      else if(mapType===5){id=3;reason="MAP_TYPE_UNDERWATER";}
      else if(mapType===6){id=WATER.has(behavior)?4:9;reason="MAP_TYPE_OCEAN_ROUTE";}
      else if(DEEP_WATER.has(behavior)){id=4;reason="deep/ocean water behavior";}
      else if(WATER.has(behavior)){id=5;reason="surfable water behavior";}
      else if(behavior===12){id=6;reason="MB_MOUNTAIN_TOP";}
      else if(Number(bank)===0&&Number(map)===28){id=2;reason="MAP_ROUTE113";}
      else if(Number(weather)===8){id=2;reason="WEATHER_SANDSTORM";}
      else{id=9;reason="BattleSetup_GetEnvironmentId default";}
      return Object.freeze({id,label:LABELS[id],reason,source:"pokeemerald BattleSetup_GetEnvironmentId",mapType,behavior,weather,bank,map,x,y});
    }
    static fromEditor(editor,event){
      const map=editor?.current_map;if(!map)return null;
      const x=Number(event?.getX?.()),y=Number(event?.getY?.());
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=map.getWidth()||y>=map.getHeight())return null;
      const behavior=editor.metatileAttribute(map.getBlockIndex(x,y),map).attribute.behavior;
      return this.resolve({mapType:map.getMapType(),behavior,weather:map.getWeather(),bank:map.getBankIndex(),map:map.getMapIndex(),x,y});
    }
  }
  ns.EnvironmentResolver=GbaBattleEnvironmentResolver;
})(globalThis);
