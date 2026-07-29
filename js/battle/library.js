(function(global){
  "use strict";
  const root=(global.PokemonViewer||={});
  const battle=root.battle||(root.battle={});

  class BattleAnimation {
    constructor({id=0,name="Animation",offset=null,commands=[],frames=[],sprite=null,properties=[]}={}) {
      this.id=id;this.name=name;this.offset=offset;this.commands=commands;this.frames=frames;this.sprite=sprite;this.properties=properties;
    }
  }


  class BattleTrainer {
    constructor({id=null,name="Trainer",classId=null,source="",party=[],editable=false}={}) {
      this.id=id;this.name=name;this.classId=classId;this.source=source;this.party=party;this.editable=editable;
    }
  }

  battle.BattleAnimation=BattleAnimation;
  battle.BattleTrainer=BattleTrainer;
  battle.registry=battle.registry||new DriverRegistry("Battle");
})(globalThis);
