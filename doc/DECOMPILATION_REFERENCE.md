# Decompilation reference and data-table audit

This is the canonical gap analysis for turning PUSH into an exact editor. It
does not contain ROM bytes, extracted tables, or guessed offsets. Every binary
location must be tied to a detected game/revision profile; every format below
is tied to a public decompilation source.

The executable companion is `js/structures/reference-catalog.js`. It exposes
the same family boundaries to future tools, but deliberately contains no
unverified offsets.

## Status vocabulary

| State | Meaning |
|---|---|
| **Verified read/write** | Parsed structure and writer are covered by synthetic round-trip tests. |
| **Verified read-only** | Format is decoded, but no relocation/rebuild writer is safe yet. |
| **Profiled** | Binary format is known and at least one supported ROM profile has a verified location. |
| **Pending profile** | Format is known from pret but the supported ROM revision lacks a verified table location. |
| **Unsupported** | No family driver exists; the UI must not fabricate data. |

## Address and pointer contract

| Family | Pointer representation | Implementation | Status |
|---|---|---|---|
| GBA | `u32` little-endian address in cartridge window `0x08000000` | `GbaMemory.pointer()` | Verified read/write |
| Gen I RGB | known bank + `u16`; far `db bank, dw address` | `GbcMemory.banked()`, `pointer16()`, `farPointer()` | Verified read/write |
| Gen II Crystal | `dba`: `dw address, db bank` | `Gen2Memory` | Verified read/write |

Never pass a pointer between these families. A numeric `$4000` address means a
banked Game Boy address, not an offset; a GBA `0x08xxxxxx` value is not valid
for a Game Boy ROM.

## Generation III: Ruby, Sapphire, Emerald, FireRed, LeafGreen

Reference: [pret/pokeruby](https://github.com/pret/pokeruby), with
FireRed/LeafGreen profile differences recorded separately. `pokeruby` is the
format authority; a profile is only enabled after its locations are verified
against the matching revision.

| Data | Binary contract | Current state | Required remaining work |
|---|---|---|---|
| Map header | 28 bytes: layout/events/scripts/connections pointers, music, layout ID, region section, weather/type/flags | Verified read/write | Profile all revisions; retain unknown flag bits. |
| Layout | 24 bytes, dimensions, block pointer, primary and secondary tileset pointers | Verified read/write | Add map-layout label tables. |
| Tileset / metatiles | 24-byte header; RSE and FRLG attribute-field order differs | Verified read/write | Compressed graphics rebuild writer. |
| Connections | 12-byte records, relocatable table | Verified read/write | Profile-check all game revisions. |
| Events | header plus object/warp/coord/background arrays | Verified read/write | Decode script semantics beyond pointer ownership. |
| Object graphics | 36-byte `ObjectEventGraphicsInfo`, animation/image pointers | Verified read/write for raw fixed frames; compressed sources read-only | Decode complete animation and subsprite tables; add deterministic compression/repointing. |
| Scene graphics | LZ77 intro/title/bag/badge sheets and BGR555 palettes | Profiled read-only graphics; selected raw palettes writable on exact Emerald | Add deterministic recompression/repointing and profile other GBA revisions. |
| Items | 44-byte `struct Item` | Verified read-only | Add item editor and profile table locations. |
| Species pictures | pic/palette tables and LZ77 graphics | Profiled for listed GBA profiles | Validate every compressed image size/frame, add back/shiny variants. |
| Species / Pokédex | names, entries and text pointers | Profiled for Emerald/FRLG | Add base stats, evolutions, learnsets and regional dex order. |
| Trainers | trainer header plus party variants | Emerald EN partially profiled | Complete Ruby/Sapphire/FRLG tables and trainer class graphics. |
| Region Map / Fly | map header `regionMapSectionId`, region-map entries, map artwork, fly warp table | Pending profile | Required before Region Map Editor is enabled. |
| Audio | M4A/Sappy song headers, voicegroups, direct samples, cries | **Pending profile; decoder scaffolded** | `SoundDocument` now models songs, tracks, commands, voices and references. The M4A header/track decoder activates only when a verified `songtable` profile offset is present; direct-sound sample playback and writers remain pending. |
| Battle animation | scripts, visual tasks, sprite templates, palette effects | Pending profile | Build opcode decoder from `data/battle_anim_scripts.s`; keep timeline read-only. |

## Generation I: Red and Blue

Reference: [pret/pokered](https://github.com/pret/pokered). Only the
international Red/Blue profile is currently accepted.

| Data | Binary contract | Current state | Required remaining work |
|---|---|---|---|
| Map pointers/banks | parallel `MapHeaderPointers` and `MapHeaderBanks` | Verified read/write | Keep the official unused map slot in all validators. |
| Map header and connections | banked header with variable direction tails | Verified read/write | Add map label/source-symbol map. |
| Object block | border, warps, signs, variable people/items/trainers | Verified read/write | Script/text target resolver per object kind. |
| Tilesets / collisions | banked tiles, metatiles, collision list | Verified read/write | Rebuild compressed/shared graphics only after source format tests. |
| Overworld sprites | verified catalog and 2bpp graphics | Verified read/write fixed states | Decode movement sequencing beyond the three native graphic states. |
| Scene graphics | intro/title and Trainer Card badge 2bpp sheets | Profiled read/write on exact Red/Blue | No standalone bag illustration exists; do not fabricate one. |
| Items | separate name and BCD price tables | Verified read-only | Add effect and key-item catalogs. |
| Text | RGBDS text macros and far text targets | Verified read/write | Complete non-text assembly event associations. |
| Town Map / Fly | Town Map RLE/tile assets, entries and FlyWarp destinations | Pending profile | Required before actual in-game Fly/Town Map rendering. |
| Pokémon data | base stats, evolutions, moves, cries, front/back graphics | Pending profile | Add typed records, tables and exact name/cry mapping. |
| Audio / battle animation | `CryData`, GB sound channels, move-animation routines and video registers | Partial editor | Red/Blue cry selection/pitch/length are exact and writable; family-specific channel/engine decoders remain required before playback or channel-program editing. |

## Generation II: Crystal

Reference: [pret/pokecrystal](https://github.com/pret/pokecrystal). Crystal is
an isolated family; it must never reuse a Gen I record or writer.

| Data | Binary contract | Current state | Required remaining work |
|---|---|---|---|
| Map groups | 9-byte group entries and 12-byte attributes | Verified read/write | Profile revision-specific group pointer base. |
| Events | filler plus counted 5/8/5/13-byte arrays | Verified read/write | Resolve all script/text owners. |
| Connections | flag byte and canonical north/south/west/east 12-byte records | Verified read/write | Add source-map labels. |
| Tilesets | 15-byte header, LZ3 graphics, metatiles, collision and palette map | Verified read/write | Add reversible LZ3 graphics writer. |
| Overworld sprites | native fixed catalog and 2bpp palettes | Verified read/write fixed states and mapped raw palette words | Frame/animation command parser. |
| Scene graphics | LZ3 intro/title plus raw Pack and badge sheets | Profiled; raw Pack/badges writable, compressed scenes read-only | Add reversible LZ3 writer/repointing. |
| Landmarks / Fly | landmark constants, landmark data, flypoint flags and destinations | Pending profile | Required for the real Pokégear Fly Map editor. |
| Pokémon / Pokédex | pic, palette, dex entry, cry, 32-byte base data, `EvosAttacksPointers` and `EggMovePointers` | Partial editor | Exact 251-name/BaseData/four-bank-entry/text/six-byte-cry/front-picture/palette graph, selective BaseData writer and fixed measurement/cry writers. Progression/move roots are manifest-bound; add their decoder/graph/UI/writers plus back pictures, animations, recompression, breeding semantics and variable text relocation. |
| Audio / battle animation | `PokemonCries`, GB channel commands, battle animation engine | Partial cry records | Six-byte/three-word named cry parameters are writable; add channel target/command decoder, playback and accurate battle renderer. |

## Data-table implementation order

1. **Profile manifests** — generated from matching pret `.sym`/`.map` output
   and keyed by title, language and revision. No editor may scan arbitrary
   pointer-looking bytes as a table substitute.
2. **Region Map/Fly data** — background assets, entries/landmarks and fly
   destinations. This replaces the current map-composition overview.
3. **Pokémon data** — base stats, names, species-to-cry mapping, evolutions,
   learnsets, front/back/shiny pictures, then Pokédex entries.
4. **Trainer data** — class metadata, party layout variants, battle music and
   trainer graphics per profile.
5. **Audio** — actual song/cry samples and commands; preview must derive from
   ROM bytes, not an oscillator placeholder.
6. **Animation** — decode exactly one engine at a time: GBA battle scripts,
   Gen I tile/register routines, then Crystal battle animation commands.

## Required evidence for a new writer

Before exposing an edit button, add all of the following:

1. A `read(memory, offset)` record or catalog in the correct family folder.
2. A profile-owned location with title/language/revision constraints.
3. Bounds and malformed-pointer tests.
4. A byte-exact apply/undo round-trip test.
5. A relocation test if the table can grow.
6. An editor action routed through `MemoryUtils`/`StructureWriter` and
   `CommandStack`.

This prevents an attractive UI from silently editing a similarly shaped but
unrelated table in a modified ROM.

## Source index

- [pokeruby map and region-map data](https://github.com/pret/pokeruby/tree/master/src/data/region_map)
- [pokeruby battle animation scripts](https://github.com/pret/pokeruby/blob/master/data/battle_anim_scripts.s)
- [pokered Town Map data](https://github.com/pret/pokered/tree/master/data/maps/town_map_entries.asm)
- [pokecrystal landmarks](https://github.com/pret/pokecrystal/blob/master/data/maps/landmarks.asm)
- [pokecrystal Fly points](https://github.com/pret/pokecrystal/blob/master/data/maps/flypoints.asm)
