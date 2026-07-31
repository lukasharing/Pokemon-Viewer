(function(global){
  "use strict";
  const ns=(global.PokemonViewer||={}).animation;

  // DMG/CGB PPU: 4,194,304 base cycles / (154 scanlines × 456 cycles).
  // CGB double-speed mode changes CPU timing, not the LCD frame cadence.
  ns.GBC_ANIMATION_TIMING=Object.freeze({
    refreshHz:4194304/(154*456),
    source:"DMG/CGB base clock / native LCD scanline timing"
  });
})(globalThis);
