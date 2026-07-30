import {readFile} from "node:fs/promises";
import {basename} from "node:path";
import {createHash} from "node:crypto";

await import("../js/rom/gba-detector.js");
await import("../js/rom/gb-detector.js");
await import("../js/core/source-manifest-registry.js");
await import("../js/core/capability-manifest.js");

const paths=process.argv.slice(2);
if(!paths.length){
  console.error("Usage: npm run audit:capabilities -- /path/to/game.gb[a] [...more ROMs]");
  process.exit(1);
}

let failed=false;
for(const path of paths){
  try{
    const file=await readFile(path),bytes=new Uint8Array(file.buffer,file.byteOffset,file.byteLength);
    const detected=GbaRomDetector.detect(bytes)||GbRomDetector.detect(bytes);
    if(!detected)throw new Error("unsupported ROM header");
    const fingerprint=createHash("sha1").update(file).digest("hex");
    const manifest=CapabilityManifest.resolve({...detected,fingerprint});
    const states=CapabilityManifest.WORKSPACES.map(id=>`${id.replace(/_(editor|workspace)$/,"")}:${manifest.get(id).state}`).join(" · ");
    const gaps=CapabilityManifest.WORKSPACES
      .map(id=>[id,manifest.get(id).resourceRequirements?.missing||[]])
      .filter(([,missing])=>missing.length)
      .map(([id,missing])=>`${id.replace(/_(editor|workspace)$/,"")}=[${missing.join(",")}]`)
      .join(" · ");
    const optionalGaps=CapabilityManifest.WORKSPACES
      .map(id=>[id,manifest.get(id).resourceRequirements?.missingOptional||[]])
      .filter(([,missing])=>missing.length)
      .map(([id,missing])=>`${id.replace(/_(editor|workspace)$/,"")}=[${missing.join(",")}]`)
      .join(" · ");
    console.log(`PASS ${basename(path)} | ${manifest.provenance.reference||"unpinned/modified"} | ${states}${gaps?` | missing required resources ${gaps}`:""}${optionalGaps?` | missing optional resources ${optionalGaps}`:""}`);
    if(manifest.get("hex_editor").state!=="verified")throw new Error("Hex must remain verified.");
    if(manifest.enabledWorkspaces.some(id=>manifest.get(id).state==="research"))throw new Error("Research workspace was exposed as ordinary.");
  }catch(error){
    failed=true;
    console.error(`FAIL ${basename(path)} | ${error.message}`);
  }
}
process.exitCode=failed?1:0;
