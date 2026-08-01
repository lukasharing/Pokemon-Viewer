(function(global){
  "use strict";
  class EmulatorPerformance{
    static settings(){
      return Object.freeze({
        videoSync:false,
        audioSync:true,
        timestepSync:false,
        // mGBA's optional threaded presenter can race the GB/GBC framebuffer
        // while fast-forwarding, producing interleaved columns from adjacent
        // frames. Keep emulation and presentation on the core's deterministic
        // default path; fast-forward still runs through its native multiplier.
        threadedVideo:false,
        audioSampleRate:48000,
        audioBufferSize:2048,
        showFpsCounter:false,
        rewindEnable:false,
        autoSaveStateEnable:true,
        // A project ROM is mutable. Restoring an emulator save-state also
        // restores the old WRAM/VRAM snapshot, so maps and graphics that were
        // already loaded by the game appear unchanged after a project refresh.
        // SRAM remains persisted independently and is still available in-game.
        restoreAutoSaveStateOnLoad:false
      });
    }
    static resumeAudio(core){
      core?.resumeAudio?.();
      const context=core?.SDL2?.audioContext;
      if(context?.state==="suspended")return context.resume();
      return Promise.resolve();
    }
  }
  global.EmulatorPerformance=EmulatorPerformance;
})(globalThis);
