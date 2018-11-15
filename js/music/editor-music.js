class EMusic{
/* GBA MUSIC
B1: ends song as far as I can tell, a song is always ended with B1, also when looping.
B2 <pointer>: loops song
B3 <pointer>: Jump to other part of song
B4: Return from other part of song
BB <byte>: set tempo (offset?)
BC <byte>: set pitch (offset)
BD <byte>: set instrument
BE <byte>: set volume
BF <byte>: set spanning
C0-CE :
CF-FF : Play a note.
this.getSongInfo = function(a){
  let songtable = this.getOffset("songtable");
  let table = songtable.offset + parseInt(songtable[a], 16) * 8;
  let header = this.getOffset(table);
  let voices = this.getOffset(header + 4);
  let tracks = [], index = header + 11;
  while(this.getByte(index) == 0x8){
    tracks.push(this.getOffset(index-3));
    index += 4;
  }
  let instruments = [], index = voices;
  for(let i = voices; i < voices + 0x600; i += 0xC){
    let type = this.getByte(i);
    let instrument = {type: type, offset: i};
    if(type % 0x40 == 0 || type == 0x3 || type == 0xB){
      let offsets = 0;
      instrument.offsets = [this.getOffset(i + 4)];
      if(type == 0x40){
        instrument.offsets.push(this.getOffset(i + 8));
      }
    }
    if(this.getByte(i+1) == 0x3C){
      instrument.adsr =[this.getByte(i+8),this.getByte(i+9),this.getByte(i+10),this.getByte(i+11)];
    }
    instruments.push(instrument);
  }

  return {table: table,
          header: {offset: header, tracks: tracks},
          voicegroup: {offset: voices, instruments: instruments}};
};

this.playMusic = function(m, k){
  let self = this;
  let f = m[k];
  let kj = {a:this.getByte(f + 8), d:this.getByte(f + 9), s:this.getByte(f + 10), r:this.getByte(f + 11)};
  let env = T("adshr", kj, T("sin")).on("ended", function() {
    this.pause();
    if(k < m.length) self.ADSR(m, k + 1);
  }).bang().play();
};
*/
}
