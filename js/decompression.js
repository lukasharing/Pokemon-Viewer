/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is written by Lukas Häring and
    idea is taken from some other hacking programs.
*/
class Decompression{
  /* [0] GBA_Decompress
    This is one of the most used decompression algorithm for the GBA,
    Each byte of memory is splitted into two new bytes, half of the parent size,
    then each slice is stored in a buffer consecutively, the size of the buffer
    is two times bigger than the uncompressed.
  */
  static GBA_Decompress(compressed_array){
    let uncompressed_array = new Array(2 * compressed_array.length);
    for(let k = 0; k < compressed_array.length; k++){
      uncompressed_array[2 * k]     = compressed_array[k] & 0xf;
      uncompressed_array[2 * k + 1] = compressed_array[k] >> 4;
    }
    return uncompressed_array;
  };

  static GBA_Compress(uncompressed_array){
    let compressed = new Array(uncompressed_array.length/2);
    for(let k = 0; k < uncompressed_array.length; k += 2){
      compressed[k/2] = uncompressed_array[k] | uncompressed_array[k + 1] << 4;
    }
    return compressed;
  };

  /* [1] LZSS_Decompress
    This Algorithm is similar to other well known but slightly changed, it has a
    header where they stored the number of bytes compressed, the method used to uncompress
    the array is pretty simple, first you read the first byte (8bits), on the one hand,
    if the bit is a zero, then the following byte is uncompressed like the GBA compression,
    on the other hand, if it is an one, the next two bytes called short (16bits),
    contains information about the compression, the first 12 bits contains the position
    of which two bytes are going to be repeated, the last 4 bits store how many times
    these two byte will be repeated.
    Formullas:
    Repeated element  = ((first 12 bits in decimal) + 1) * 2.
    Times Repeated    = ((last 4 bits in decimal) + 3) * 2.
    Finally if the un compressed size is less than the expected size, the
    remaineded size will be filled with zeros.
  */
  static LZSS_Decompress(compressed_array, expected_size){
    let uncompressed_array = new Array(expected_size);
    let i = 0, k = 0;
    while(i < compressed_array.length){
      let compression_byte = compressed_array[k++];
      for(let bit = 7; bit >= 0 && i < compressed_array.length; bit--){
        if(compression_byte >> bit & 1){
          let short =  compressed_array[k++] | compressed_array[k++] << 8;
          let position_rept = i + (((short >> 12) + 3) * 2);
          let position_copy = ((short & 0xFFF) + 1) * 2;
          for (let u = i; u < position_rept; u += 2){
            uncompressed_array[u]     = uncompressed_array[u - position_copy];
            uncompressed_array[u + 1] = uncompressed_array[u + 1 - position_copy];
          }
          i = position_rept;
        }else{
          let b = compressed_array[k++];
          uncompressed_array[i++] = b & 0xf;
          uncompressed_array[i++] = b >> 4;
        }
      }
    }
    return uncompressed_array.fill(0, position, expected_size);
  };
}
