import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createHash } from "node:crypto";

await import("../js/rom/gba-detector.js");
await import("../js/rom/gb-detector.js");

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("Usage: npm run test:rom -- /path/to/pokeruby.gba [...more.gba]");
  process.exit(1);
}

const pretReferenceBuilds = {
  f28b6ffc97847e94a6c21a63cacf633ee5c8df1e: "pret/pokeruby reference Ruby",
  "3ccbbd45f8553c36463f13b938e833f652b793e4": "pret/pokeruby reference Sapphire",
  ea9bcae617fdf159b045185467ae58b2e4a48b9a: "pret/pokered reference Red",
  d7037c83e1ae5b39bde3c30787637ba1d4c48ce2: "pret/pokered reference Blue",
  "5b1456177671b79b263c614ea0e7cc9ac542e9c4": "pret/pokered debug Blue"
};

let failed = false;
for (const path of paths) {
  const rom = await readFile(path);
  const sha1 = createHash("sha1").update(rom).digest("hex");
  const reference = pretReferenceBuilds[sha1];
  const info = GbaRomDetector.detect(rom) || GbRomDetector.detect(rom);
  const validSize = rom.length >= 32 * 1024 && rom.length <= 32 * 1024 * 1024;
  const ok = validSize && Boolean(info);
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${basename(path)} | ${info?.name ?? "unknown"} | ${info?.platform ?? "unknown platform"} | ${info?.code ?? "unknown header"} rev.${info?.version ?? "?"} | ${rom.length} bytes${reference ? ` | exact ${reference}` : ""}`);
}

process.exitCode = failed ? 1 : 0;
