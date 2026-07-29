globalThis.MapSelection = class MapSelection {
  constructor(anchor) { this.anchor={...anchor}; this.focus={...anchor}; }
  update(point){this.focus={...point};return this;}
  get bounds(){return{left:Math.min(this.anchor.x,this.focus.x),top:Math.min(this.anchor.y,this.focus.y),right:Math.max(this.anchor.x,this.focus.x),bottom:Math.max(this.anchor.y,this.focus.y)};}
  get width(){const b=this.bounds;return b.right-b.left+1;}
  get height(){const b=this.bounds;return b.bottom-b.top+1;}
  cells(){const b=this.bounds,result=[];for(let y=b.top;y<=b.bottom;y++)for(let x=b.left;x<=b.right;x++)result.push({x,y});return result;}
};
((globalThis.PokemonViewer ||= {}).maps ||= {}).Selection=globalThis.MapSelection;
