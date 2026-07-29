# Memory data model

Editors consume typed documents rather than loose offsets. A document keeps the
ROM family, table/record provenance, references to related records, and an
accuracy state. `verified` means the profile has a confirmed structure and
offset; `partial` means that the relationship is known but the binary table is
not decoded yet. Editors must not imply that partial data is writable or
playable.

## Shared relationships

`SpeciesCatalog` is the common identity layer used by Pokédex, Battle and
Sound. It produces immutable `SpeciesReference` objects:

- numeric species id;
- decoded name plus its source offset when a verified name table exists;
- family and accuracy;
- semantic links to the species and cry records.

For Emerald, `gSpeciesNames` is a verified 11-byte table at `0x3185C8`.
Exact Red/Blue and Crystal drivers use their pinned name tables; other classic
profiles do not invent a name-table address until independently verified.

Crystal's current Species provider joins 251 identities to seven owned
documents per species: identity/name, 32-byte `BaseData`, four-bank Pokédex
entry, description, six-byte `PokemonCries`, LZ3 front picture and native
normal/shiny palette. The BaseData writer reconstructs:

```text
00 Pokédex species id
01..06 stats         07..08 types       09 catch       10 base EXP
11..12 held items    13 gender          14 unknown     15 hatch cycles
16 unknown           17 dimensions      18..21 obsolete picture pointers
22 growth            23 egg-group nibbles
24..31 TM/HM/tutor compatibility
```

Only verified semantic fields are changed. Unknown bytes, dimensions and
obsolete pointers stay preserved. A dedicated compatibility owner interprets
bits 0–59 as the exact 50 TM, 7 HM and 3 tutor order from `TMHMMoves`; its
writer changes only those selected bits and preserves unused bits 60–63.

`Gen2ProgressionData` extends the same graph with the exact seven-byte `Moves`
records and fixed-width names, banked `EvosAttacksPointers`, and banked
`EggMovePointers`. Its bounded reader recognizes all five Crystal evolution
methods and links their target Species, level-up entries and egg entries to
named Move resources. It also owns 60 machine nodes and 6,592
Species→Machine→Move relations. The pinned ROM audit locks 251 moves, 122 evolutions,
2,215 level-up entries, 480 egg-move entries and the complete compatibility
graph. These variable records remain
writable through one ownership-aware command. Growth uses only the verified
zero-filled tail after the complete source table, remains in the near-pointer
bank, and restores that native fill on Undo. Shared `NoEggMoves` aliases are
detached to a private allocation before mutation.

`Gen2TrainerData` extends the same graph with manifest-bound
`TrainerGroups`, `TrainerClassNames`, and `TrainerPicPointers`. A class owns
ordered, `0x50`-terminated trainer names and parties ending in `0xFF`.
Each party preserves one of the four discriminated native layouts:

```text
normal      level, species
moves       level, species, move1, move2, move3, move4
item        level, species, item
item-moves  level, species, item, move1, move2, move3, move4
```

The exact Crystal Rev 0 model contains 67 classes, 541 trainers and 1,254
members. Its graph links every member to Species and contributes 1,385
explicit Move references, producing 4,683 nodes/16,664 resolved edges when
combined with progression. Fixed-record edits reconstruct the original width,
compare expected bytes, and cannot silently add fields. Variable party
insertion/removal, trainer portrait decode, AI/rematches/phone and full script
ownership still require separate verified providers.

`Gen2EncounterData` adds four exact Johto/Kanto grass/water tables plus
`FishGroups`, `TimeFishGroups`, `TreeMons`, the tree-map ownership tables and
`ContestMons`, `InitRoamMons`, `RoamMaps` and 17 exact direct `loadwildmon`
commands. Grass owns three rates and 21 slots; water
owns one rate and three slots. Fishing owns a shared bite rate, three rod
pointers, cumulative thresholds and optional day/night indirection. Explicit
level/species offsets preserve the terrestrial `level,species` and fishing
`species,level` layouts. The pinned Rev 0 inventory contains 224 documents and
2,486 displayed slot→Species relations across 224 documents. Combined with
progression and trainers, it yields 7,780 nodes and 23,018 resolved edges. Its writer
atomically changes stored rates, species, fixed levels and Contest ranges
without resizing. The roamer initializer and its 16-map transition graph are
ROM-owned, while mutable location/HP/DVs remain correctly outside the provider
until a save-state model exists. Direct static encounters verify the script
symbol, relative command offset and `$5d` opcode before exposing their two
operands. Variable/state-derived script encounters and runtime modifier
simulation remain outside this provider.

`Gen1EncounterData` deliberately does not reuse the Crystal layout. Its
manifest roots cover `WildDataPointers`, `WildMonEncounterSlotChances`,
`ItemUseOldRod`, `GoodRodMons`, `SuperRodData` and both Snorlax route scripts.
It resolves all 248 same-bank wild pointers; reads the conditional
rate-plus-ten-pair grass/water sections; decodes the fixed Old Rod payload,
two-entry Good Rod table and 33-entry Super Rod map/group table; parses 12
typed static object battles; and signature-checks both Snorlax payloads.
Exact Red and Blue each yield 107 documents and 706 displayed slots: 58
grass/water, 35 fishing and 14 static. Pointer and Super Rod aliases remain
shared owners. The fixed writer changes only existing rate, level and internal
Species bytes. Its graph extends the exact Gen I model from 3,519 nodes/8,738
edges to 4,398 nodes/10,359 edges.

## Sound documents

`SoundDocument` now has immutable `metadata` and `references`. A cry document
records its Pokémon id/name and points back to the species relation and the
family's cry-data table. This lets the UI show “Pikachu (#25) cry” where a
verified species-name table exists, while honestly reporting when the actual
cry parameter/sample table still needs a decoder.

Fixed cry-record decoders now exist for Red/Blue and Crystal:

| Family | Source project | Needed verified data |
| --- | --- | --- |
| GBA | pokeruby | `gCryTable`, M4A voicegroup/sample references |
| Gen I | pokered | `CryData` exact/writable; sound command/channel data pending |
| Gen II | pokecrystal | `PokemonCries` exact/writable; cry header and channel scripts pending |

Once those profiles exist, the decoder can attach the exact record offset,
pitch, length, sample/instrument and channel commands to the same document
without changing the editor UI.
