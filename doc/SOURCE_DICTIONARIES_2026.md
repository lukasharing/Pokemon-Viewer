# Source dictionaries and ROM hacks

PUSH treats a decompilation as a schema source, not as a universal list of
addresses. A symbol offset is enabled only when the complete ROM fingerprint
matches the manifest built from the pinned pret source.

## Current generated dictionaries

| Family | Source | Generated data |
| --- | --- | --- |
| Red/Blue | `pret/pokered` `data/maps/songs.asm` plus the built `.sym` | all 248 `MapSongBanks` owners, song IDs/audio banks, and exact semantic symbols |
| Crystal | `pret/pokecrystal` constants, map structures, and `.sym` | 103 named music IDs, map music bytes, `Music` dba roots, and exact semantic symbols |
| Emerald | exact `pret/pokeemerald` linker map plus source dictionaries | 479 named music/SFX constants, 518 map owners, `gSongTable`, `gMapGroups`, `gWildMonHeaders`, `gObjectEventGraphicsInfoPointers`, `gItems`, `gItemIconTable`, and the existing exact semantic roots |

The animation catalog is generated separately by
`scripts/generate-animation-source-catalog.mjs`. It currently records 289
Emerald `ANIM_TAG_*` resources, 188 Crystal battle-animation objects, 41
Crystal animation graphic groups and 86 Red/Blue subanimation symbols. These
names decorate ROM-owned records; the visual decoders still resolve every
pointer, frame, OAM record, graphic and palette from the loaded ROM.

Regenerate it from explicit pinned checkouts; the script never assumes a
developer-specific clone or temporary directory:

```sh
node scripts/generate-animation-source-catalog.mjs \
  --pokered /path/to/pret/pokered \
  --pokecrystal /path/to/pret/pokecrystal \
  --pokeemerald /path/to/pret/pokeemerald
```

`scripts/generate-audio-source-catalog.mjs` converts source names and map
ownership into `js/sound/source-catalog.js`. Runtime code reads IDs, pointers,
headers, and channel roots from the loaded ROM. The generated catalog does not
contain replacement ROM bytes.

`scripts/generate-pret-manifest.mjs` converts linker/RGBDS symbols into
fingerprint-bound manifests. `MemoryProfile` is the single runtime dictionary
API; family editors ask it for symbols instead of copying offsets into editor
code.

## ROM-hack policy

1. A stock fingerprint activates its exact generated symbol dictionary.
2. A recognized but modified ROM loads its engine, Hex Editor, and Emulator,
   but semantic editors stay locked because tables may have moved.
3. An unrecognized header asks which original engine the hack uses. The
   selected base only chooses the runtime; it never imports stock addresses.
4. A relocated hack can import a PUSH JSON source manifest generated from its
   own `.sym` or linker `.map`. The importer requires the loaded ROM's complete
   SHA-1, selected engine, platform, source commit, in-range offsets, and
   resource-to-symbol ownership to match.
5. Imported symbols become an exact read-only `MemoryProfile` dictionary.
   They do not inherit stock fallbacks and do not authorize semantic writes.
   Each workspace still needs its own structural/round-trip audit before it
   can become an ordinary editor.

This fail-closed rule is intentional. Searching for pointer-like bytes or
silently applying Emerald offsets to an Emerald hack can corrupt valid data.
See [ROM_HACKS.md](ROM_HACKS.md) for the import format and workflow.

## Remaining work

- Generate a source manifest directly from user-supplied RGBDS `.sym` or GBA
  linker `.map` inside the application; the current UI imports the JSON
  artifact produced by `npm run manifest:pret`.
- Add per-workspace structural audits that can safely promote compatible hack
  resources to read-only Partial and then bounded writable operations.
- Add a Profile/Symbols workspace that shows imported resources, missing
  requirements, and audit consequences.
- Add additional pinned source builds for Ruby/Sapphire, FireRed/LeafGreen,
  and localized revisions.
- Generate more semantic catalogs (scripts, audio programs, animation task
  metadata, map names, item tables) from source rather than hand-maintaining
  labels.
