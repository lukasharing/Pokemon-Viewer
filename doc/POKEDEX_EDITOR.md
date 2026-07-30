# Pokédex Editor

The Pokédex Editor is a shared workspace backed by a family driver. It lists
the entries the active ROM profile can identify, renders verified front/back
sprites at their native in-game scale, and links the entry
to Text, Sprite and Sound.

Every supported family now uses the same visible **Evolution line** and
**Compatible TM/HM moves** sections. Evolution cards use the ROM's real sprite,
branch where a species has multiple outcomes, and navigate directly to the
selected species. Machine rows show only enabled bits, use the shared disc
symbol, open their exact Move document, and expose a separate remove action.
Removing compatibility requires a named confirmation, changes only the
family driver's verified bitset, and participates in project Undo/Redo. The
adjacent add/change action opens the complete exact compatibility writer.

The shared view also has a **Level-up moves** panel. Its entries are native
learnset records, not a guessed move list, and each one opens the exact move
in Move Editor. Emerald renders the native 1bpp footprint from
`gMonFootprintTable`; profiles without a verified table simply hide it rather
than substituting another graphic. `gLevelUpLearnsets` uses the engine's packed
`(level << 9) | move` format, terminates at `0xFFFF`, and is bounded by the
native 20-entry maximum.

## Encounter areas and the fly map

The ROM does not contain a precomputed “species → map” list. It contains
encounter headers keyed by map. `pokeemerald`'s `gWildMonHeaders` stores a map
group/map number and pointers to land, water, Rock Smash and fishing tables;
the original `pokedex_area_screen.c` constructs the reverse view by scanning
those headers and then maps qualifying overworld maps to region-map sections.
The editor must follow that model: build a reverse index from verified native
tables and highlight the same fly-map sections. It must not infer locations by
rendering every map or colouring arbitrary tiles. Gen I already has exact
map-indexed grass/water tables; the verified area-link panel can consume that
model. Generation III highlighting remains unavailable until
`gWildMonHeaders` and its map/region-section bridge are present in the verified
manifest and decoder.

## Current safe behavior

- Selecting a species keeps its game identity rather than treating every
  internal species ID as National Dex order.
- Generation III lists all **411 internal Species IDs**, numbered **1–411**.
  IDs 252–276 are the real legacy Unown-form slots in the engine: they retain
  their ROM name, front/back pictures, palette, evolution slots and TM/HM
  bitset, but intentionally show “No independent entry” instead of borrowing a
  National Pokédex record. IDs 277–411 map to National Dex 252–386.
- Generation III height/weight use native decimetre/hectogram values.
- Audited Emerald and FireRed share one exact GBA Species library. It validates
  all 411 fixed-width names/front-picture records/palettes and the 386
  independent Pokédex records before export. Emerald also binds
  `gMonBackPicTable`, so both sides come from the ROM. Battle and
  Pokédex now consume the same bounded LZ77 decoder, so a malformed stream
  cannot be hidden by a preview-only fallback.
- Generation III front pictures now pass through the shared tiled 4bpp image
  decoder. Each 64×64 frame consumes exactly 64 tiles/2,048 bytes, each packed
  byte contributes its low and high pixel in the correct order, and palette
  index zero remains transparent. Emerald's stacked animation data is not
  allowed to spill into the static preview: Pokédex and Battle render only the
  first native idle frame, then CSS may scale that finished 64×64 canvas with
  nearest-neighbour pixels.
- Emerald binds `gEvolutionTable` as five fixed, compiler-aligned slots per
  internal species and `gTMHMLearnsets` as an eight-byte bitset. The editor
  reads all evolution methods and all 50 TM/8 HM assignments, renders the full
  connected family, and edits both tables with compare-before-write Undo/Redo.
  Evolution alignment bytes and unused machine bits are preserved exactly.
  FireRed/LeafGreen use the same structures with their native 50 TM/7 HM range.
- Red/Blue resolves the official 151-entry Pokédex through the 190-slot
  internal species order. It shows the real category, feet/inches, tenths of a
  pound, description, base statistics, types, growth, cry record and compressed
  front/back sprites. The side selector decodes the stored back picture as 4×4
  tiles and applies the game's native 2× `ScaleSpriteByTwo` presentation, producing
  a pixel-exact 64×64 battle preview without interpolation. It also renders every verified level/item/trade evolution
  and the complete named level-up learnset, plus every compatible TM/HM with
  its machine number and move name.
- Red/Blue measurement edits preserve the native four-byte record and use
  compare-before-write Undo/Redo.
- Red/Blue Base Data edits the five battle stats, two verified type IDs, catch
  rate, base experience, four starting moves and one of the six native growth
  curves in the exact 28-byte record. The Pokédex identity, sprite dimensions
  and pointers, seven TM/HM bytes and final padding are protected and verified
  byte-identical by fixture and real-ROM audits.
- Red/Blue Progression edits level, item and trade evolutions plus named
  level-up moves using the exact double-terminated `EvosMoves` format. Existing
  records can be rewritten or shortened atomically, and padding created by a
  reduction remains available to that owner. Shared pointers are detected and
  detached only through a verified same-bank allocation. The stock Red and
  Blue progression banks contain no general free run, so a record that exceeds
  its current byte budget fails closed with a linker/rebuild requirement
  instead of overwriting adjacent code.
- Red/Blue exposes a dedicated compatibility form for all 55 TM/HM flags. It
  writes the existing seven-byte bitset, preserves the unused bit 56 exactly,
  refreshes the canonical graph and participates in project Undo/Redo.
- Exact Red/Blue entries expose a stable `gen1:species:<dex>` resource ID and
  share a verified graph with Base Stats, entry text, CryData and both picture sides.
  Pokédex can edit the exact three-byte cry record (base cry, pitch and length)
  through the same validated writer used by Sound Editor.
- A Red/Blue compressed front or back sprite opens in Sprite Editor as a decompressed,
  read-only 2bpp preview. Editing is intentionally disabled until deterministic
  recompression, ownership and repointing are implemented.
- Applied edits use the project command stack and can be undone/redone.
- Missing offsets, descriptions or sprite tables are shown as unavailable; the
  editor does not fabricate a preview.
- Exact Crystal now lists all 251 real names and joins each one to its
  32-byte `BaseData`, banked `PokedexDataPointerTable` entry, category,
  feet/inches word, weight, full description and six-byte `PokemonCries`
  record. Measurements, all six battle stats, types, catch/base EXP, held-item
  IDs, gender ratio, hatch cycles, growth and both egg-group nibbles use
  exact-width compare-before-write Undo/Redo. The unknown byte, dimensions,
  obsolete picture pointers are reconstructed byte-identically. The exact
  eight-byte compatibility field now exposes 50 TMs, 7 HMs and 3 tutors,
  preserves the four unused high bits, refreshes all 6,592 graph links and is
  editable through compare-before-write Undo/Redo. Every base front picture is decoded from the exact LZ3
  pointer and rendered at native 1:1 with its ROM palette. Back pictures,
  animation frames, extra Unown forms and graphic writing remain unavailable
  rather than being substituted.

## Accuracy limits

## Workspace, miniature and cry audition

The Pokédex workspace groups the source, native sprite, entry text, cry,
semantic details, edit tools, evolution line and machine compatibility into
independent docked windows. On pinned Emerald, its miniature is the real
32×32 menu graphic resolved through `gMonIconTable`,
`gMonIconPaletteIndices`, and `gMonIconPaletteTable`; the large preview remains
the full front/back battle picture. The GBA Species library caches this
decoded resource so evolution cards and other compact UI can reuse it.

The primary species window owns the large visual and entry. Front/back
selection, exact sprite editing and animation navigation live inside that
visual rather than being repeated in a global action row. Measurement and base
data actions belong to Attributes; progression belongs to Evolution; machine
editing belongs to Compatible TM/HM moves. The same fact or action must not be
rendered in two places. Supporting sections use a two-column desktop grid and
collapse to one column when width no longer permits readable controls.

The shared Pokédex editor only asks its active family driver for an optional
icon. It contains no GBA pointers, palette rules, or 4bpp decoding. Red/Blue
does not expose the Generation III per-Species icon tables, so its isolated
driver keeps the genuine Gen I picture rather than fabricating a GBA-style
miniature.

For Gen I and Crystal entries with verified CryData/PokemonCries parameters,
the Cry panel provides an audible parameter audition. It maps the stored base,
pitch and length values to Web Audio so edits can be heard immediately. This
is deliberately labelled as an audition, not hardware-faithful game audio:
the channel-stream engines have not been fully decoded yet. The Sound Editor
remains the source view for those verified cry records.

For pinned Emerald, the same panel resolves the real `SpeciesToCryId` path and
the selected `gCryTable` 12-byte `ToneData` record, including its `WaveData`
pointer and ADSR fields. It is surfaced as a verified, read-only data reference;
the short Web Audio cue is explicitly not claimed to emulate the M4A engine.

## Generation I progression contract

Generation I evolution lines are built from
`Gen1ProgressionData.canonicalDocuments()`. This is the canonical collection
of species progression records; it deliberately does not use a generic list
API, so opening the Pokédex cannot fail because that API is absent.

Generation III coverage depends on an exact asset profile. Ruby/Sapphire,
language/revision variants, footprints, cries, level-up/egg/tutor learnsets,
base data, Dex ordering and the wider Species graph are not uniformly modeled.
Red/Blue still needs category/text
growth, sprite recompression, a source-aware linker/rebuild path for
progression-bank expansion and additional incoming references from scripts
and move effects. Red/Blue picture palettes, deterministic recompression,
compressed-data ownership and safe repointing are not implemented, so both
verified sides remain read-only.
Crystal now displays all five evolution methods, named level-up moves and egg
moves from the exact pointer tables. The Progression dialog accepts names or
IDs and can add/remove/reorder entries. Growth relocates inside the verified
table bank; shared `NoEggMoves` storage is detached before writing, and the
whole operation is one Undo/Redo command. Crystal Move records now open in the
shared Move Editor. Crystal still needs back-picture/animation composition,
graphic recompression, deeper
breeding semantics and remaining species tables. Until those items are complete, an entry being visible
does not mean every field is safe to edit.

See `EDT-003`, `EDT-005`, `DATA-002`, `DATA-005` and `DATA-006` in
[AUDIT_BACKLOG_2026.md](AUDIT_BACKLOG_2026.md).
# Pokédex Editor

## Interaction rules

- Show each fact once. Evolution, level-up moves, machine compatibility and cry controls belong to their dedicated sections and must not be repeated in the generic Attributes window.
- Every listed move is a navigation target to the Moves Editor. Native visual assets use a pencil affordance and open their exact ROM-backed source in the Sprite Editor.
- Family data stays separate: Emerald reads `gMonFootprintTable`; Crystal reads the packed `Footprints` atlas; Red/Blue does not expose a footprint resource and therefore hides that control.
- Footprints are four 8×8 1bpp tiles in a 2×2 layout. They must never be decoded as one flat 256-bit scanline.
