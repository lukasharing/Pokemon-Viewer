"use strict";
let bytes=null,generation=0,revision=0;
const width=type=>({u8:1,u16:2,u32:4}[type]||0);
const value=(offset,type)=>{
  if(type==="u8")return bytes[offset];
  if(type==="u16")return bytes[offset]|bytes[offset+1]<<8;
  if(type==="u32")return (bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16|bytes[offset+3]<<24)>>>0;
  throw new TypeError(`Unsupported index field ${type}.`);
};
const scan=schema=>{
  const {offset,count,stride,fields={},filter=null}=schema;
  if(!Number.isInteger(offset)||!Number.isInteger(count)||!Number.isInteger(stride)||offset<0||count<0||stride<1)throw new RangeError("Invalid fixed-record schema.");
  if(offset+count*stride>bytes.length)throw new RangeError("Fixed-record table exceeds the ROM.");
  const records=[];
  for(let id=0;id<count;id++){
    const base=offset+id*stride,record={id};
    for(const [name,field] of Object.entries(fields)){
      if(field.type==="bytes"){
        if(!Number.isInteger(field.byte)||!Number.isInteger(field.count)||field.byte<0||field.count<0||field.byte+field.count>stride)throw new RangeError(`Invalid field ${name}.`);
        record[name]=Array.from(bytes.slice(base+field.byte,base+field.byte+field.count));
      }
      else{const size=width(field.type);if(!size||field.byte<0||field.byte+size>stride)throw new RangeError(`Invalid field ${name}.`);record[name]=value(base+field.byte,field.type);}
    }
    if(!filter||record[filter.field]!==filter.equals)records.push(record);
  }
  return records;
};
self.addEventListener("message",event=>{
  const message=event.data||{};
  try{
    if(message.operation==="init"){bytes=new Uint8Array(message.payload.bytes);generation=message.projectGeneration;revision=message.romRevision;}
    else if(message.operation==="patch"){
      if(message.projectGeneration!==generation)return;
      for(const patch of message.payload.patches)bytes.set(patch.bytes,patch.offset);revision=message.romRevision;return;
    }
    else if(!bytes)throw new Error("Project index is not initialized.");
    const result=message.operation==="init"?{size:bytes.length}:message.operation==="scan-fixed-records"?scan(message.payload):null;
    self.postMessage({requestId:message.requestId,projectGeneration:generation,romRevision:message.romRevision,result});
  }catch(error){self.postMessage({requestId:message.requestId,projectGeneration:message.projectGeneration,romRevision:message.romRevision,error:error.message||String(error)});}
});
