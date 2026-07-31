(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).animation;

  // GBA PPU: 16,777,216 master cycles / (228 scanlines × 1,232 cycles).
  ns.GBA_ANIMATION_TIMING=Object.freeze({
    refreshHz:16777216/(228*1232),
    source:"GBA master clock / native scanline timing"
  });
})(globalThis);
