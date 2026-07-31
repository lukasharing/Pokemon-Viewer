(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).animation;

  // Generation II runs on the same CGB LCD cadence. CPU double-speed does not
  // double VBlank-driven animation playback.
  ns.GEN2_ANIMATION_TIMING=Object.freeze({
    refreshHz:4194304/(154*456),
    source:"CGB base clock / native LCD scanline timing"
  });
})(globalThis);
