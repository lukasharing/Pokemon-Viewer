(function(global){
  "use strict";
  const ns=global.PokemonViewer.sound;
  class SoundWaveform{
    static draw(context,width,height,{samples=null,tracks=[],commands=[],label="",activeTrack=null}={}){
      context.clearRect(0,0,width,height);context.fillStyle="#fbfcfd";context.fillRect(0,0,width,height);
      if(samples?.length)return this.wave(context,width,height,samples,label);
      if(tracks.length||commands.length)return this.arrangement(context,width,height,tracks,commands,label,activeTrack);
      return false;
    }
    static grid(context,width,height){context.strokeStyle="#e2e8ed";context.lineWidth=1;for(let x=0;x<=width;x+=width/12){context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();}}
    static wave(context,width,height,samples,label){this.grid(context,width,height);const middle=height/2;context.strokeStyle="#cbd6de";context.beginPath();context.moveTo(0,middle);context.lineTo(width,middle);context.stroke();context.strokeStyle="#287fc5";context.lineWidth=2;context.beginPath();for(let x=0;x<width;x++){const start=Math.floor(x*samples.length/width),end=Math.max(start+1,Math.floor((x+1)*samples.length/width));let low=1,high=-1;for(let i=start;i<end;i++){const value=Math.max(-1,Math.min(1,Number(samples[i])||0));low=Math.min(low,value);high=Math.max(high,value);}const y1=middle-high*(middle-30),y2=middle-low*(middle-30);context.moveTo(x,y1);context.lineTo(x,y2);}context.stroke();context.fillStyle="#5e6c78";context.font="700 14px Inter, system-ui, sans-serif";context.fillText(label,16,24);return true;}
    static arrangement(context,width,height,tracks,commands,label,activeTrack=null){const lanes=Math.max(1,tracks.length||1),top=34,laneHeight=(height-top-20)/lanes,maxTick=Math.max(1,...commands.map(command=>Number(command.tick)||0));for(let lane=0;lane<lanes;lane++){const track=tracks[lane],selected=activeTrack===null||activeTrack===track?.index,y=top+lane*laneHeight;context.fillStyle=selected?(lane%2?"#f3f7f9":"#ffffff"):"#eef1f3";context.fillRect(0,y,width,laneHeight);context.strokeStyle=activeTrack===track?.index?"#287fc5":"#d8e0e6";context.lineWidth=activeTrack===track?.index?2:1;context.strokeRect(0,y,width,laneHeight);context.fillStyle=selected?"#667582":"#9aa5ad";context.font="700 13px Inter, system-ui, sans-serif";context.fillText(tracks.length?`Channel ${track?.index||lane+1}`:"Events",12,y+22);}const source=tracks.length?tracks.flatMap((track,lane)=>track.commands.map(command=>({command,lane,track}))):commands.map(command=>({command,lane:0,track:null}));for(const {command,lane,track} of source){const x=110+(width-130)*(Number(command.tick)||0)/maxTick,y=top+lane*laneHeight+8,w=Math.max(10,Math.min(96,18+String(command.name).length*6)),selected=activeTrack===null||activeTrack===track?.index;context.fillStyle=selected?(command.accuracy==="verified"?"#287fc5":"#9dce3c"):"#b5bdc3";context.fillRect(x,y,w,Math.max(18,laneHeight-16));}context.fillStyle="#24313d";context.font="800 14px Inter, system-ui, sans-serif";context.fillText(label,12,22);return true;}
  }
  ns.SoundWaveform=SoundWaveform;
})(globalThis);
