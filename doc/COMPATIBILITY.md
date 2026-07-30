# ROM compatibility

PUSH identifies a cartridge from its internal header. The filename and file
extension select a detector but never select a game profile.

> **Capability rule:** “recognized” is not the same as “verified for every
> editor.” PUSH fingerprints the complete ROM and exposes only Verified or
> Partial workspaces from its exact manifest. Modified/unpinned stock
> assumptions become disabled Research. The current truth is documented in
> [AUDIT_2026_WEB.md](AUDIT_2026_WEB.md),
> [AUDIT_GBA_2026.md](AUDIT_GBA_2026.md), and
> [CAPABILITY_MODEL.md](CAPABILITY_MODEL.md). This file must not be used as a
> release-support promise until exact generated manifests replace the current
> offsets and heuristics.

## Semantic editor profiles

| Cartridge family | Header recognition | Verified current evidence |
|---|---|---|
| Generation III GBA | Ruby, Sapphire, Emerald, FireRed and LeafGreen headers in configured EN/ES/JP codes | Real-ROM audit passed a map/event/script/sprite/checksum/export vertical slice on Emerald and FireRed Rev 1. Exact table/asset coverage is incomplete and not uniformly language/revision keyed; Ruby/Sapphire have no equivalent active asset profile. |
| Generation I GB | International Red and Blue | Real-ROM audits pass the map/event/text/sprite/checksum/export vertical slice and the exact Species/Move/Trainer/Encounter resource graph. Pokédex has selective exact Base Stats plus bounded evolution/learnset writers; stock progression growth fails closed pending a linker/rebuild path. Encounter Editor resolves 107 documents and 706 slots: 58 grass/water, 35 Old/Good/Super Rod fishing documents and 14 static battles. Repel/runtime simulation, Old/Good map eligibility and remaining state/machine-code contexts remain incomplete. |
| Generation II GBC | International Crystal Rev 0 and Rev 1 | Rev 0 has a pinned exact manifest and real-ROM audit for 251 Species/BaseData/Pokédex/cries/front pictures/palettes, 251 writable Move records, writable evolution/learnset/egg lists, 541 trainers/1,254 party members in all four native formats, and 224 grass/water/fishing/Headbutt/Rock Smash/Contest/roamer/direct-static documents with 2,486 displayed slots. The 17 direct `loadwildmon` commands have verified script/map ownership and reversible operands. Isolated map/event/text/2bpp paths remain partial; Rev 1 still lacks an equivalent generated manifest and broad game completeness is not established. |
| Other classic titles | Japanese Red/Blue/Crystal, Yellow, Gold, Silver and unknown Crystal revisions | Header is recognized, but incompatible semantic editors are rejected before any family structures load |

Generation III Map editing distinguishes the 16-bit metatile attributes used
by Ruby/Sapphire/Emerald from FireRed/LeafGreen's 32-bit records and reversed
tileset header fields. Cell elevation and shared metatile
behavior/terrain/layer data are editable together without discarding unknown
bits.

Crystal does not load any Gen I structures. Its Code Editor uses the
`pret/pokecrystal` text command table (`TX_START=$00` through `TX_FAR=$16`),
the complete event `ScriptCommandTable` (`$00–$A9`), and the Gen II English
charmap. Event and text views remain separate codecs. Its Map Editor uses verified group entries,
attributes, connections, events, LZ3 graphics, metatiles, collision values,
palette maps, and the complete native 102-entry overworld sprite table. Block
layouts, sprite pixels, and existing fixed-size event records are
editable with Undo/Redo. Event insertion/removal rebuilds the complete counted
event block inside `scriptsBank` and updates its near pointer reversibly.
Resize is supported through the bank-first block `dba`. Connection creation,
editing, deletion and Undo/Redo use the official geometry formulas and a
round-trip-tested variable attribute-tail writer.

The `.gbc` filename extension does not imply a compatible Generation I layout.
Conversely, a legally obtained Red/Blue image named `.gbc` can still use the
same Generation I profile because detection comes from its cartridge header.

Red/Blue bank-table discovery accounts for `pret/pokered`'s official
`UNUSED_MAP_0B` entry. That zero-sized map must be excluded from plausibility
scoring; treating it as an invalid early sample previously rejected the real
`MapHeaderBanks` table and forced a less reliable per-map bank scan.

## Why Generation II is not silently accepted

Gold, Silver and Crystal use different map headers, event formats, text
commands, graphics rules and bank tables. The current classic driver is built
from `pret/pokered`; the new Crystal profile therefore has its own memory,
registry, runtime, dictionary, and text codec based on `pret/pokecrystal`.
Yellow and Gold/Silver still require their own verified profiles. None of these
titles share the Red/Blue map writer. Exact English Crystal Rev 0 has a pinned
manifest and exposes only its partial, profile-backed workspaces; other
revisions remain Research.

At runtime, only pinned Red/Blue references and the audited English Emerald
Rev 0 and FireRed Rev 1 fingerprints receive bundled semantic workspace
capabilities. Other recognized GBA builds retain bounded Hex (and the partial
emulator) while semantic stock editors fail closed as Research. A hack may
import an exact JSON source manifest for its own fingerprint; that exposes its
symbols and resources to `MemoryProfile`, but does not borrow stock operation
audits or authorize writes.

Adding a profile requires:

1. a family-specific structure registry and memory tests;
2. verified header/table locations or symbol-derived manifests;
3. round-trip tests for every write operation;
4. a matching map, script/text and sprite driver;
5. an entry in this matrix.

## Modified ROMs

A differing header checksum is reported but does not by itself reject an
otherwise supported profile, because legitimate hacks commonly change ROM
bytes. Structural readers still perform pointer and bounds checks. This does
not make an arbitrary hack semantically compatible: if tables, code, expansion,
language, or layouts differ, stock offsets may be wrong. Use **Import ROM
source manifest…** with an artifact generated from the hack's own build to
bind relocated symbols to its exact fingerprint. Imported dictionaries remain
Research/read-only until each semantic operation passes a compatible
structural audit; they never silently borrow a stock profile.

If a hack also changes the cartridge title/code so its base cannot be detected,
PUSH asks which original engine it uses. This choice is deliberately
**engine-only**: it permits bounded Hex editing and the emulator, but it never
assigns the original game's semantic addresses to the hack. Map, Species,
trainer, audio and other table editors unlock only after an exact symbol
manifest for that build has been generated and fingerprinted.

Commercial ROM files remain local to the browser and are excluded by
`.gitignore`; they must not be committed or redistributed.

Generation III event scripts expose proven text pointers as editable resource
links. Text is decoded and compiled with the selected game's loaded table,
always includes its `$FF` terminator, and can relocate through the owning
32-bit ROM pointer when it grows. English and Spanish select the Western table;
Japanese selects its own table. Ambiguous table entries use lossless `[XX]`
source tokens rather than being normalized to a different byte.
