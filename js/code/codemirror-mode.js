(function(global){
  "use strict";
  if(!global.CodeMirror)return;
  const commands=/^(?:call|goto|end|return|message|msgbox|writetext|farwritetext|trainerbattle|startbattle|setwildbattle|givepoke|givemon|giveitem|takeitem|applymovement|faceplayer|warp|playmusic|playsound|playse|cry|checkflag|setflag|clearflag|compare|ifequal|ifnotequal|iftrue|iffalse|scall|sjump|farscall|farsjump|db|dw|dl)\b/i;
  global.CodeMirror.defineMode("push-rom",()=>({
    startState:()=>({lineStart:true}),
    token(stream,state){
      if(stream.sol())state.lineStart=true;
      if(stream.eatSpace())return null;
      if(stream.match(/^(?:;|#(?!org\b)).*$/i)){state.lineStart=false;return"comment";}
      if(stream.match(/^"(?:[^"\\]|\\.)*"?/)){state.lineStart=false;return"string";}
      if(stream.match(/^(?:0x[0-9a-f]+|\$[0-9a-f]+|%[01]+|\b\d+)\b/i)){state.lineStart=false;return"number";}
      if(stream.match(/^[A-Za-z_.$][\w.$]*:/)){state.lineStart=false;return"def";}
      if(stream.match(/^(?:#org|\.(?:byte|hword|word)|text(?:_end)?|raw_text)\b/i)){state.lineStart=false;return"meta";}
      if(state.lineStart&&stream.match(commands)){state.lineStart=false;return"keyword";}
      if(stream.match(/^[(),[\]+\-*/]/)){state.lineStart=false;return"operator";}
      stream.next();state.lineStart=false;return null;
    }
  }));
  global.CodeMirror.defineMIME("text/x-push-rom","push-rom");
})(globalThis);
