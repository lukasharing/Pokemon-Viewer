(function(global){
  "use strict";
  class EmulatorPerformance{
    static settings(){
      return Object.freeze({
        videoSync:false,
        audioSync:true,
        timestepSync:false,
        threadedVideo:true,
        audioSampleRate:48000,
        audioBufferSize:2048,
        showFpsCounter:false,
        rewindEnable:false,
        autoSaveStateEnable:true,
        restoreAutoSaveStateOnLoad:true
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
