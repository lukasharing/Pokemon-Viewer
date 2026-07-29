# ROM structure library

The full source-to-structure/table matrix, including unimplemented records and
profile gaps, is maintained in [DECOMPILATION_REFERENCE.md](DECOMPILATION_REFERENCE.md).

The `js/structures/` tree is the domain boundary between raw cartridge bytes and editors. Editors should request typed structures from this layer instead of doing pointer arithmetic themselves.

```text
js/structures/
├── memory.js             shared checked integer and table reads
├── gba/
│   ├── memory.js         32-bit 0x08000000 ROM pointers
│   ├── item.js           44-byte Generation III Item and catalog
│   ├── map.js            headers, layouts, tilesets, connections, and four event types
│   └── sprite.js         overworld graphics metadata and pointers
│   └── registry.js       GBA-only discoverable structure catalog
├── gbc/
    ├── memory.js         16-bit banked and 3-byte far pointers
    ├── item.js           connected name and BCD-price tables
    ├── map.js            banked headers, object blocks, warps, signs, and objects
    ├── sprite.js         verified 60-entry overworld graphics catalog
    └── registry.js       GB/GBC-only discoverable structure catalog
└── gen2/
    ├── memory.js         Gen II banked and address-first far pointers
    ├── connection-utils.js canonical direction flags, geometry, and encoding
    ├── connection-writer.js reversible attribute-tail rebuild and relocation
    ├── map.js            map groups, attributes, and four counted event tables
    ├── tileset.js        tiles, 4×4 metatiles, collision, and palette maps
    ├── sprite.js         102 native overworld records and daytime palettes
    └── registry.js       Crystal-only discoverable structure catalog
```

Crystal connection bits are `EAST=1`, `WEST=2`, `SOUTH=4`, `NORTH=8`, although
their records are serialized north/south/west/east. `Gen2ConnectionUtils` keeps
that distinction, the official connection geometry formulas, validation, and
12-byte encoding in one reusable API.

`Gen2ConnectionWriter` creates and removes records by rebuilding the complete
attribute tail in canonical order. When it grows, it relocates the attributes
and atomically updates the owning map-group `dba` pointer; undo restores the
original bytes and pointer.

## GBA sprite frames

`GbaOverworldSpriteCatalog` resolves the `ObjectEventGraphicsInfo.images`
pointer and reads its first six-byte `SpriteFrameImage` descriptor. The
descriptor contains a 32-bit ROM pointer followed by a fixed byte length. Its
payload is raw tiled 4bpp data: the historical `GBA_Decompress` helper merely
split each byte into two color-index nibbles and was not decompression.

Sprite Editor now receives the exact declared range. `GraphicSource` compares
those bytes with ROM before enabling painting, and `GbaSpriteCodec` preserves
the same 32 bytes per tile when encoding. Pixel edits therefore stay in-place,
participate in Undo/Redo, and never change the image descriptor or adjacent
frames. A descriptor with a zero or non-tile-aligned length is rejected.

Generation III tileset compression comes from `Tileset.isCompressed` at byte
zero of the tileset header. It must never be inferred from the first graphics
byte, which is pixel data for an uncompressed tileset. Raw primary/secondary
tiles are addressable in 32-byte units and may participate in segmented Sprite
Editor sources; compressed tiles remain read-only until a writer can rebuild
their stream safely.

`GbaTilesetHeader` is the public, explicit alias for the compatible
`GbaTileset` record. It validates the 24-byte header and resolves `tiles`,
`palettes`, `metatiles`, `metatileAttributes`, and `callback` through
`GbaMemory`. `GbaMapLayout.read(memory, offset, {deep:true})` returns both
`primaryTilesetData` and `secondaryTilesetData`, so new tools do not need to
repeat `layout + 16/+20` or tileset-field arithmetic. The GBA Map Editor uses
this same record.

`GbaTileset.read(..., {frlg})` accounts for the real family layout:
Ruby/Sapphire/Emerald store the metatile-attribute pointer at `+0x10` and the
callback at `+0x14`, while FireRed/LeafGreen reverse those two fields.
`GbaMetatileAttribute` decodes and rewrites the corresponding 16-bit RSE or
32-bit FRLG record field-by-field, preserving every unrelated and unknown bit.

## Address rules

`GbaMemory.pointer(offset)` reads a little-endian 32-bit address, accepts only the cartridge ROM window, translates it to a file offset, and rejects out-of-range pointers.

`GbcMemory.banked(bank, address)` preserves the fixed `$0000-$3fff` area and translates the switchable `$4000-$7fff` area. `pointer16` applies a known bank; `farPointer` reads the pret `bank, address` representation.

`Gen2Memory` keeps the same hardware banking rules but remains a distinct type.
Its far pointers follow Crystal's `dw address, db bank` order rather than the
Gen I helper's representation.

Every primitive read is bounds-checked by `RomMemory`. Use `memory.contains` for optional data and allow `RangeError` to surface malformed mandatory structures.

`GbcMapDiscovery` centralizes Gen I map-header plausibility and parallel
`MapHeaderBanks` discovery for both the editor and CLI audit. Its score excludes
the official zero-sized `UNUSED_MAP_0B` slot from `pret/pokered`; consumers
must not maintain private copies of this heuristic or silently fall back merely
because that declared hole has no valid header.

Use `memory.cursor(offset)` for sequential structures. `MemoryCursor` provides `u8`, `s8`, `u16`, `s16`, `u24`, `u32`, `s32`, `bytes`, `seek`, `skip`, `align`, and family-aware pointer methods. `memory.reader()` builds frozen records and fixed-stride tables without repeating offset arithmetic.

`GbaStructureRegistry` and `GbcStructureRegistry` expose independent typed catalogs. Only the registry for the detected ROM family is loaded and stored on `RomReader`.

`Gen2StructureRegistry` provides Crystal's independent catalog.
`Gen2MapDirectory` validates all 26 `MapGroupPointers` before exposing a map.
Each 9-byte group entry resolves a 12-byte attribute record containing
dimensions, blocks, scripts, events, and connection flags. `Gen2MapEvents`
preserves the `pret/pokecrystal` order: two filler bytes followed by counted
warp (5-byte), coordinate (8-byte), background (5-byte), and object (13-byte)
tables. Stored object coordinates are converted from their `+4` representation.
`Gen2MapConnection` reads the 12-byte records immediately following attributes
in canonical north, south, west, east flag order. The canonical 26 group
lengths expose all 388 map entries without scanning into adjacent data.

## Public family namespaces

New editors should discover structures through the family registry rather than
referencing compatibility globals:

```js
const registry = reader.structureRegistry;
const header = reader.readStructure("tilesetHeader", offset);
const available = reader.availableStructures;
```

Once its lazy structure bundle loads, each family publishes the same registry
at:

- `PokemonViewer.structures.registries.gba`
- `PokemonViewer.structures.registries.gbc`
- `PokemonViewer.structures.registries.gen2`

Their frozen manifests are also available as `PokemonViewer.structures.gba`,
`.gbc`, and `.gen2`. A manifest contains only that family's record types.
Every registry implements `list()`, `get()`, `createMemory()`, and
`createOverworldSpriteCatalog()`; optional factories such as
`createMapDirectory()` or `createTileset()` remain family-specific. Runtimes
and shared consumers use this API. Global registry names remain only for
compatibility with older extensions.

Crystal tilesets are also isolated. `GscLz` implements the seven bounded LZ3
commands used by GSC graphics: literal, repeated byte, alternating bytes,
zeroes, lookback, bit-flipped lookback, and reverse lookback.
`Gen2TilesetHeader` resolves the three `dba` pointers in each 15-byte entry.
`Gen2TilesetCodec` exposes 192 hardware 2bpp tiles, 4×4 metatiles, 2×2
collision values, packed even/odd palette-map nibbles, and a pure 32×32 RGBA
metatile renderer. It never calls the unrelated GBA LZSS decoder.

Existing Crystal map blocks and fixed-size events are written through the
shared `StructureWriter`. Object coordinates serialize back to the cartridge's
`+4` storage convention, and its palette/type nibbles are recombined into one
byte. Logical schema limits are validated before serialization so a value such
as palette 16 cannot silently wrap to palette 0.

`Gen2EventBlockWriter` handles variable event counts. It preserves both event
filler bytes, copies untouched records byte-for-byte, rebuilds the four counted
tables, allocates `$FF` space only inside the map's `scriptsBank`, and changes
`MapAttributes.eventsAddress`. Apply/restore cover allocation and pointer as one
undoable plan.

Crystal layout resize uses `MapLayoutWriter` with the distinct `gen2Far`
reference. Unlike Gen I near pointers or address-first text references, the
map attribute stores `blocks` as `db bank, dw address`. A growing layout may
therefore move to another ROM bank; apply and restore update all three pointer
bytes and the height/width pair together.

Loaded projects expose the same API through `RomEditor.availableStructures` and `RomEditor.readStructure(name, offset, options)`. For example, `readStructure("mapHeader", offset, {deep: true})` returns a GBA header together with its resolved layout, event arrays, warps, and connections.

## Item models

`GbaItem` follows `struct Item` in pret/pokeruby. Its fields are `name`, `itemId`, `price`, `holdEffect`, `holdEffectParam`, `description`, `importance`, `exitsBagOnUse`, `pocket`, `type`, `fieldUseFunc`, `battleUsage`, `battleUseFunc`, and `secondaryId`.

Red/Blue does not store those fields as one record. `GbcItemCatalog` joins the fixed-width `ItemNames` table and three-byte BCD `ItemPrices` table. Future key-item and use-effect adapters should extend the catalog with their separate tables, not copy the GBA record.

## Adding structures

1. Put family-neutral contracts in `js/structures/` and binary layouts in `gba/` or `gbc/`.
2. Give each record a `read(memory, offset)` entry point and a declared byte size when records are fixed-width.
3. Put table traversal in a catalog; keep UI code out of structures.
4. Register the catalog in the matching `GbaStructureRegistry` or `GbcStructureRegistry`.
5. Load it from `RomReader.loadStructureLibrary` only for the detected family.
6. Add synthetic tests for bounds, pointer translation, and every decoded field.

ROM revisions still need symbol/offset manifests. The structure layer deliberately separates those locations from the binary layouts so a future manifest generated from pret `.sym`/`.map` output can connect the whole project without rewriting parsers.

## Upstream references

- [pret/pokeruby](https://github.com/pret/pokeruby): Generation III C structures and data tables.
- [pret/pokered](https://github.com/pret/pokered): Generation I banked pointers, item constants, names, and prices.
- [pret/pokecrystal](https://github.com/pret/pokecrystal): Generation II map groups, attributes, counted events, and address-first far pointers.

The repositories are format references; no ROM content is copied into this project.
# Structured writes

`StructureWriter` is the shared little-endian writer used when an editor changes typed ROM data. It validates signed/unsigned field ranges, writes through the family memory object, and wraps an apply/undo pair in the editor's scoped project journal. `replaceCommand()` receives all affected ranges, compares all of them before writing any, and updates the decoded view-model only after the ROM transaction succeeds. Production callers obtain that scope through `RomReader.history(owner)`; they must not create an independent applied-history stack.

GBA map-event movement uses the same X/Y schema for objects, warps, coordinate triggers, and background events, with the object template's four-byte header accounted for. This keeps visual state, decoded structures, command history, and exported ROM bytes synchronized.
# Shared editing utilities

`EditUtils` (`js/core/edit-utils.js`) contains the small, format-independent
parts of an edit: selecting schema values, detecting a real change, reducing a
UI schema to its binary fields, and executing an undoable command. Use
`StructureWriter.edit()` for ordinary in-place structure forms. It validates
every value before touching the ROM, writes the complete edit as one command,
and restores both bytes and the editor model on undo through `afterWrite`.
Use `StructureWriter.replaceCommand()` when one logical operation affects
multiple non-contiguous fixed ranges. A stale command throws before any byte or
view-model update; callers must not implement Undo as a series of blind
`write()` calls.

Format modules still own their schemas and pointer rules. The utility deliberately
does not guess whether a field belongs to GB/GBC or GBA.

`RomAllocator` finds aligned `$FF` runs without expanding the loaded ROM. Every
allocator for the same `RomMemory` shares one `AllocationLedger`: writers give
each planned range a stable owner, simultaneous plans cannot reserve the same
bytes, registered protected/owned ranges are excluded, Undo releases a
reservation, and Redo must reacquire it without conflict. When the canonical
resource graph changes, `RomReader` unions all verified node/reference ranges
into a replaceable protected scope; aliases and nested semantic documents do
not create false conflicts. Unmodeled source regions still lack extents, so
the ledger closes cross-writer and modeled-resource allocation hazards but is
not yet a complete linker map.
`GbaEventTableWriter` uses it for the four fixed-stride map-event tables.
It produces reversible insertion/removal plans containing the original count
and pointer, the relocated bytes, and the new GBA ROM address. Allocation is
format-agnostic; pointer encoding and table strides remain in the GBA module.

`GbcEventBlockWriter` handles the different Gen I layout: border byte, warp
count/table, sign count/table, then a variable-size object table containing
people, items, and trainers. It rebuilds that complete sequence and constrains
allocation to the header's existing 16 KiB bank so its 16-bit pointer remains
valid.

`MapLayoutWriter` is shared by both map drivers. It copies the overlapping
top-left rectangle with the family's byte stride, prepares a `RelocatablePatch`,
and updates width and height alongside the block pointer. For GBA it writes two
signed 32-bit dimensions and a `0x08xxxxxx` pointer. For Gen I it writes two
bytes and keeps the new layout in the map header's bank. Apply and restore
always cover dimensions, pointer, allocation, and original block bytes.

Existing connections use `StructureWriter` because their record sizes do not
change. A GBA connection writes its direction byte, signed 32-bit relative
offset, map group, and map number. A Gen I connection writes only the safe
fields inside its direction-specific 11-byte record; direction flags and
derived block/map/window addresses remain untouched.

`GbaConnectionTableWriter` adds and removes records by relocating a complete
eight-byte connection header plus its 12-byte entries and changing the owning
map header pointer atomically. `GbcConnectionHeaderWriter` rebuilds the
variable-size Gen I map header in canonical north/south/west/east order,
preserves the object pointer, allocates inside the same bank, and changes the
map entry in `MapHeaderPointers`. Its driver derives the protected block,
overworld-map, and window addresses with the formulas from
`pret/pokered/macros/scripts/maps.asm`.
