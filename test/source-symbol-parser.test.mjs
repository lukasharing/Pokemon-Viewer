import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  parseSymbolDocument,
  buildProjectManifestFromSymbols
} from "../js/core/source-symbol-parser.mjs";

const fingerprint="0123456789abcdef0123456789abcdef01234567";
const commit="abcdef0123456789abcdef0123456789abcdef01";

test("shared source parser isolates RGBDS ROM labels from RAM and local symbols",()=>{
  const result=parseSymbolDocument([
    "00:0150 Start",
    "0E:5D3B TrainerDataPointers",
    "01:C000 WorkRam",
    "02:5000 @local",
    "not a symbol"
  ].join("\n"),{platform:"gb",romSize:0x80000});
  assert.deepEqual(
    [...result.symbols],
    [
      ["Start",{offset:0x150,bank:0,address:0x150,format:"rgbds"}],
      ["TrainerDataPointers",{offset:0x39d3b,bank:0x0e,address:0x5d3b,format:"rgbds"}]
    ]
  );
  assert.equal(result.diagnostics.ignored,3);
});

test("shared source parser isolates GBA ROM labels from RAM and rejects escaped offsets",()=>{
  const result=parseSymbolDocument([
    "08310030 gTrainers",
    "                0x08486578                gMapGroups",
    "02000000 gSaveBlock",
    "not a symbol"
  ].join("\n"),{platform:"gba",romSize:0x800000});
  assert.equal(result.symbols.get("gTrainers").offset,0x310030);
  assert.equal(result.symbols.get("gMapGroups").offset,0x486578);
  assert.equal(result.symbols.has("gSaveBlock"),false);
  assert.throws(
    ()=>parseSymbolDocument("09000000 Escaped",{platform:"gba",romSize:0x800000}),
    /outside the loaded ROM/
  );
});

test("shared source parser preserves exact GNU symbol sizes and bounds their extents",()=>{
  const result=parseSymbolDocument([
    "0000000008310030 00000020 D gTrainers",
    "0x083185C8 0x0000000B gSpeciesNames"
  ].join("\n"),{platform:"gba",romSize:0x800000});
  assert.deepEqual(result.symbols.get("gTrainers"),{
    offset:0x310030,address:0x08310030,extent:0x20,format:"gnu"
  });
  assert.deepEqual(result.symbols.get("gSpeciesNames"),{
    offset:0x3185c8,address:0x083185c8,extent:0x0b,format:"gnu"
  });
  assert.throws(
    ()=>parseSymbolDocument("087FFFF8 00000010 D Escaped",{platform:"gba",romSize:0x800000}),
    /extent is outside/
  );
});

test("source import completes only whole family resource groups",()=>{
  const template={
    resources:{
      maps:{coverage:"root",symbols:["gMapGroups"]},
      species:{coverage:"pictures",symbols:["gSpeciesNames","gMonFrontPicTable"]},
      audio:{coverage:"songs",symbols:["gSongTable"]}
    }
  };
  const result=buildProjectManifestFromSymbols({
    symbolText:"08486578 gMapGroups\n083185C8 gSpeciesNames\n",
    platform:"gba",romSize:0x800000,fingerprint,
    engineProfile:"gen3-emerald-en",profile:"my-hack",
    source:{repository:"owner/hack",commit,build:"hack.gba"},
    template
  });
  assert.deepEqual(Object.keys(result.manifest.resources),["maps"]);
  assert.deepEqual(Object.keys(result.manifest.symbols),["gMapGroups"]);
  assert.deepEqual(result.report.missing.species,["gMonFrontPicTable"]);
  assert.deepEqual(result.report.missing.audio,["gSongTable"]);
  assert.match(result.manifest.resources.maps.notes,/structural operation audit pending/);
});

test("source import rejects a file that completes no known family resource",()=>{
  assert.throws(()=>buildProjectManifestFromSymbols({
    symbolText:"08310030 UnknownRoot\n",
    platform:"gba",romSize:0x800000,fingerprint,
    engineProfile:"gen3-emerald-en",profile:"my-hack",
    source:{repository:"owner/hack",commit,build:"hack.gba"},
    template:{resources:{maps:{coverage:"root",symbols:["gMapGroups"]}}}
  }),/completes no known/);
});

test("the editor offers direct family-aware symbol import",async()=>{
  const source=await readFile(new URL("../js/init.js",import.meta.url),"utf8");
  assert.match(source,/Import source symbols \(\.sym\/\.map\)/);
  assert.match(source,/buildProjectManifestFromSymbols/);
  assert.match(source,/ManualKnowledgeRegistry\.get/);
  assert.match(source,/ProjectManifestRegistry\.register/);
  assert.match(source,/structural operation audit|does not authorize semantic writes/i);
});
