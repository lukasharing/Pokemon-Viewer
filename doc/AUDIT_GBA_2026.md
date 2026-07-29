# GBA audit — Ruby, Sapphire, Emerald, FireRed and LeafGreen

## Verdict

The GBA implementation has a useful editable foundation, but “GBA” is currently
treated as a more uniform format than the games actually provide. The map
vertical slice works on the audited Emerald and FireRed ROMs, yet several
structures and command tables differ between Ruby/Sapphire, Emerald, and
FireRed/LeafGreen. Those differences must become explicit engine profiles
before PUSH can safely advertise semantic editing across all five titles,
languages and revisions.

The recommended engine split is:

```text
Gen III
├─ RSE common
│  ├─ Ruby/Sapphire
│  └─ Emerald overrides
└─ FRLG
```

Language and cartridge revision are additional profile dimensions. A profile
must be selected by exact cartridge identity and verified signatures/hash, not
only by the four-character game code.

## Source baseline

This audit compared the editor with:

- [`pret/pokeruby`](https://github.com/pret/pokeruby)
- [`pret/pokeemerald`](https://github.com/pret/pokeemerald)
- [`pret/pokefirered`](https://github.com/pret/pokefirered)

The repositories are living projects. PUSH should pin a commit for every
generated manifest; the review snapshot used the local comparison references
recorded as `pokeruby 63a8cbf`, `pokeemerald 83df84e`, and `pokefirered
df4449a`.

## Current compatibility truth

The detector recognizes:

- Ruby (`AXV`)
- Sapphire (`AXP`)
- Emerald (`BPE`)
- FireRed (`BPR`)
- LeafGreen (`BPG`)
- English, Spanish and Japanese language codes
- any header revision that otherwise matches

It then advertises Hex, Code, Map, Sprite, Battle, Pokédex, Sound, Animation
and Emulator.

The semantic profiles do not match that breadth:

- `gba-rom-assets.js` has only Emerald, FireRed and LeafGreen;
- Ruby and Sapphire have no equivalent asset profile;
- Emerald is the only listed profile with a monster-name offset;
- trainer-party support has a special hard-coded Emerald English path;
- sound tables are not populated in the active profiles;
- profile offsets are not uniformly keyed by language/revision;
- Animation is not a ROM decoder.

Therefore current detection means “recognized GBA Pokémon cartridge,” not “all
shown editors are supported.” The capability set must be derived from the
validated exact profile.

## High-risk structural divergences

These are not optional polish. They affect byte interpretation and writing.

### Map layout

Ruby/Sapphire/Emerald use the 24-byte layout form. FireRed/LeafGreen add
`borderWidth` and `borderHeight`, yielding a 28-byte form. The current
`GbaMapLayout` exposes one 24-byte record and ignores the FRLG extension.

Sources:

- [pokeruby field-map structures](https://github.com/pret/pokeruby/blob/master/include/global.fieldmap.h)
- [pokeemerald field-map structures](https://github.com/pret/pokeemerald/blob/master/include/global.fieldmap.h)
- [pokefirered field-map structures](https://github.com/pret/pokefirered/blob/master/include/global.fieldmap.h)

Required:

- separate `RseMapLayoutCodec` and `FrlgMapLayoutCodec`;
- exact size and field metadata in the profile;
- round-trip fixtures for both variants;
- no writer may silently drop the two FRLG bytes.

### Map header flags

Header bytes do not have identical meanings across the engines. Emerald packs
cycling/escape/running/map-name behavior differently from FRLG; FRLG also has a
floor field. A generic `escapeRope` byte and generic `flags` byte are
insufficient.

Required:

- typed per-engine bitfields;
- unknown-bit preservation;
- named Simple-mode choices;
- raw bit view in Nerd mode;
- per-engine write tests proving unrelated bits remain unchanged.

### Object event template

FRLG object templates include normal/clone union semantics. The current
structure always reads the common normal record.

Required:

- a discriminated union codec;
- explicit clone target/reference;
- validation of the active variant;
- safe conversion only when all required fields can be produced.

### Event script opcodes

One table through opcode `0xCC` cannot be called the complete Gen III language:

- Ruby/Sapphire ends at a different point;
- Emerald has later commands;
- FRLG has later commands;
- some shared numeric opcodes do not have identical semantics.

Sources:

- [pokeruby script command table](https://github.com/pret/pokeruby/blob/master/data/script_cmd_table.inc)
- [pokeemerald script command table](https://github.com/pret/pokeemerald/blob/master/data/script_cmd_table.inc)
- [pokefirered script command table](https://github.com/pret/pokefirered/blob/master/data/script_cmd_table.inc)

Required:

- one command-definition manifest per engine;
- typed argument variants and control-flow effects;
- labels, branch targets, text/movement/resource references;
- exact compiler/decompiler round trips;
- no cross-engine fallback when an opcode is unknown.

### Dimensions and legacy reads

Layout dimensions are 32-bit signed fields. Every remaining legacy path must
use the 32-bit codec rather than `getShort`. The typed structure already reads
`s32`; duplicate legacy parsing should be removed.

## GBA editor coverage

Legend: **RW** verified semantic read/write in at least one tested path, **RO**
typed read, **Partial** incomplete/profile-specific/heuristic, **Scaffold**
non-authoritative UI, **Absent** no real domain implementation.

The earlier shared Pokédex syntax blocker is fixed and the first-party syntax
gate now covers every application script. That makes the workspace reachable;
it does not upgrade the accuracy or breadth of the underlying Pokédex data.

| Domain | Current | Emerald | Ruby/Sapphire | FRLG | Required next truth |
| --- | --- | --- | --- | --- | --- |
| Header/checksum | RW | audited | detector only | FireRed audited | exact hash/profile manifest |
| Hex/text bytes | RW | yes | generic only | yes | schema overlay and xrefs |
| Maps/layout | Partial RW | strong | unverified profile | strong but format divergences | split RSE/FRLG codecs |
| Connections | RW | audited path | unverified | audited path | full graph validation |
| Events | Partial RW | objects/warps/coord/bg | unverified | clone union missing | all variants and linked scripts |
| Blocks/collision/elevation | Partial RW | yes | unverified | yes | behaviors, permissions and names |
| Tilesets/metatiles/palettes | Partial | decode/edit selected bytes | profile missing | profile partial | complete compressed asset ownership |
| Text/event scripts | Partial RW | shared table is incomplete | wrong breadth claim | wrong breadth claim | engine-specific AST/compiler |
| CPU code | Partial RO/raw directives | partial ARM/Thumb | same | same | symbols, full decode, assembler/linker |
| Overworld graphics | Partial | catalog subset | absent profile | catalog subset | frames/OAM/subsprites/animations |
| Species/base data | Absent | — | — | — | shared Species document |
| Evolutions/learnsets | Absent | — | — | — | tables plus reverse references |
| Pokédex | Partial | height/weight/profiled sprite | absent profile | partial, names incomplete | full entries/order/assets |
| Moves/effects | Partial RW | 354 exact fixed records/names | FireRed Rev. 1 fixed records audited | Ruby/Sapphire/LeafGreen unprofiled | effects, TM/HM, learnsets, audio and command graph |
| Trainers/parties | Partial | Emerald EN subset | absent | absent | variants, AI, class, rematch |
| Encounters | Partial RW | 124 exact map headers and shared editor | absent | absent | swarms, runtime modifiers and simulation |
| Items | RO structure/catalog | partial | unverified | partial | complete editor/effects/economy |
| Battle engine | Scaffold | partial trainer preview | no | no | real documents/simulation |
| Battle animation | Research, disabled | pointer scan retained only as inactive research code | disabled | disabled | real command interpreter |
| Audio | Research, disabled | M4A discovery lacks pinned song table | no | no | song/voicegroup/sample/cry codecs |
| Region/Fly map | Absent | — | — | — | actual in-game region map editor |
| Save data | Absent | — | — | — | dual-slot/section/Pokémon codecs |
| Emulator | Partial GBA | boots snapshot | should be profile-gated | boots snapshot | deterministic validation/debug bridge |

Post-audit capability gate: only the complete audited Emerald EN Rev 0 and
FireRed EN Rev 1 fingerprints receive the table above as ordinary
Verified/Partial workspaces. Other recognized GBA builds fail closed to Hex
plus the partial emulator; heuristic Battle Animation and Sound are Research
and disabled.

## `pret` coverage ledger

This ledger prevents “we support Pokémon data” from meaning that one pointer
table was found. Each row is a connected resource family that needs a generated
schema, stable documents, references, writers and validation.

| Resource family in Gen III | Representative `pret` evidence | Current PUSH truth | Required document/editor closure |
| --- | --- | --- | --- |
| Species core | `species_info.h`, names, constants | exact Emerald name/graphic roots; no complete species document | all fields, enums, unknown preservation, cross-table identity |
| Evolution/learnsets | `evolution.h`, level-up, TM/HM, tutor and egg tables | exact five-slot evolution and TM/HM tables are readable/writable in Pokédex; 184 visible evolution edges and 8,927 compatibility links validate in stock Emerald | level-up/egg/tutor tables, ordered references, broader graph and relocation |
| Pokédex | entry/order/text/measurement tables | narrow profiled fields and sprite path | localized entries, regional/national order, category, habitat/body metadata, footprints and all assets |
| Pokémon graphics | front/back/icon/footprint, normal/shiny palettes and coordinates | selected front sprite/profile access | exact compression, dimensions, palette owners, forms, frame/animation and safe repoint |
| Moves | move records, names/descriptions, effects, targets | shared editor with isolated GBA driver; all 354 Emerald `gBattleMoves`/`gMoveNames`, fixed-field writer, explicit trainer uses and animation-pointer navigation | effect summary/AST, TM/HM and learnset ownership, audio, AI, descriptions/names and wider battle references |
| Types/abilities/status | constants, charts, ability data and battle routines | absent | named records, formulas, references and engine-specific availability |
| Trainers | trainer records, parties, classes, graphics, rematches | all 855 Emerald headers and 1,825 existing party members decode; all four aligned party unions expose species/level/item/moves and fixed-record Undo/Redo | party resizing, AI/items/double battle metadata, portrait, payout, dialogue/map/script/rematch |
| Encounters | wild encounter data and special methods | Emerald `gWildMonHeaders`, `WildPokemonInfo` and `WildPokemon` decode 124 exact map headers; grass, surfing, Rock Smash and fishing slots expose pret weights and reversible fixed-record edits | swarms, runtime modifiers, conditions and encounter simulation |
| Items/economy | item records, descriptions, icons, use effects, marts | partial catalog/typed record | pockets/prices/held and use behavior, shops, pickup, gifts/trades and xrefs |
| Maps/layouts | map groups, headers, layouts, connections | strongest editable path | per-engine variants, creation/deletion, full properties, graph validation |
| Events/story | event scripts, map scripts, texts, movements, flags/vars/specials | partial opcode/text handling | per-engine AST, symbols, references, source/visual views and safe linker |
| Tilesets/metatiles | tiles, palettes, metatile attributes/behavior and animations | partial selected editing | complete catalog, native behavior semantics, animated tiles and compression ownership |
| Region/Fly map | region-map art, sections, coordinates, fly/heal data | absent | exact in-game screen, landmarks, cursor, unlock and destination validation |
| Battle engine | scripts, move effects, AI scripts, formulas and tables | trainer-oriented preview scaffold | deterministic state model, trace, rules/AI editor and native scene |
| Battle animation | scripts/macros, sprite templates, tasks, palettes and sounds | pointer-scan research | verified interpreter/decompiler and normalized timeline with native command fidelity |
| Audio | song table, tracks, voicegroups, samples, cry tables | unpinned discovery/research | M4A documents, playback, loop/envelope/instrument editor, cry graph and writer |
| Save/player | save sections, encrypted Pokémon, storage, bag/flags | absent | redundant slot validation, encryption/checksum, semantic editor and `.sav` artifacts |
| UI/screens | title, menus, windows, fonts, summary/bag/dex graphics | raw assets only when manually opened | screen documents, tilemaps/OAM/palettes, previews and references |
| Game systems | contests, berries, decorations, TV, facilities, link etc. | absent | generated per-game inventory and purpose-built views over shared documents |

### Current exact-manifest boundary

The generated Emerald manifest proves a useful set of table roots and source
provenance. It does not yet prove record extent or ownership for the complete
rows above. FireRed Rev 1 is fingerprint-gated and has real-ROM audit evidence,
but still needs a generated source manifest equivalent to Emerald. Ruby,
Sapphire, LeafGreen, other revisions and languages remain recognized
cartridges, not complete semantic profiles.

No GBA editor should infer support from family alone. Capability must be the
intersection of:

```text
exact cartridge identity
∩ generated resource manifest
∩ verified codec/schema
∩ writer/relocator evidence
∩ runtime test level
```

## The canonical GBA resource graph

A complete editor cannot keep separate copies of “species 25” in Battle,
Pokédex, Sound and Sprite. The profile should create stable resources:

```text
Species
├─ name and localized strings
├─ base stats / types / abilities / held items
├─ gender / growth / egg / EV metadata
├─ evolutions
├─ level-up / egg / TM-HM / tutor learnsets
├─ Pokédex order / category / descriptions / measurements
├─ front / back / normal / shiny graphics and palettes
├─ icon / footprint / coordinates / animation
└─ cry

Trainer
├─ class / name / gender / portrait / palette
├─ items / AI flags / battle type / payout
├─ party[] -> Species + level + moves + item + IV metadata
├─ intro / defeat / after-battle text
├─ map object / script / flag
├─ rematch data
└─ battle music / transition
```

All editors should navigate and transact on those same nodes.

## Required editors and expected behavior

### 1. Species Editor

Authoritative inputs include:

- [species info](https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/species_info.h)
- [evolutions](https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/evolution.h)
- [level-up learnsets](https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/level_up_learnsets.h)
- [TM/HM learnsets](https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/tmhm_learnsets.h)
- [Pokédex entries](https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/pokedex_entries.h)
- [graphics tables](https://github.com/pret/pokeemerald/tree/master/src/data/pokemon_graphics)

Normal user:

- choose Pokémon by name/sprite;
- edit stats, types, abilities, catch/growth/gender/egg properties;
- edit evolutions and learnsets with named choices;
- preview Pokédex, summary and battle sprite;
- receive warnings for impossible evolution loops, duplicate learnset entries or
  unavailable abilities.

Nerd user:

- inspect every table/index, bitfield, symbol and pointer;
- compare internal species ID, National Dex ID and engine-specific constants;
- edit raw unknown/reserved fields;
- batch transform/query species;
- inspect every incoming reference.

### 2. Move Editor

Use [battle move records](https://github.com/pret/pokeemerald/blob/master/src/data/battle_moves.h)
plus name, description, effect, target, contest, animation and sound resources.

Normal user edits power, accuracy, PP, type, category/effect/priority/target and
sees a readable effect summary plus affected Pokémon.

Nerd user sees the effect script/function, flags, AI implications, animation
script, constants and every learnset/TM/trainer reference.

### 3. Trainer Editor

Use:

- [trainer records](https://github.com/pret/pokeemerald/blob/master/src/data/trainers.h)
- [party variants](https://github.com/pret/pokeemerald/blob/master/src/data/trainer_parties.h)

Support every party structure variant, explicit/default moves, held items,
AI flags, class, trainer name, portrait, palette, double battle, encounter
music, items, payout, rematches and linked event/script/text.

Never ask a normal user for an unrestricted numeric species ID.

### 4. Encounter Editor

Use [wild encounter data](https://github.com/pret/pokeemerald/blob/master/src/data/wild_encounters.json).

Show map, method, rate, time/condition if applicable, slot probability, level
range and species. Validate probabilities and link every species/map. Provide
encounter simulation and distribution visualization.

Implemented July 2026: the shared GBA/GB/GBC interface is a flat source list
plus compact visual slot rows. Emerald reads the pinned `gWildMonHeaders`
root at `0x552D48`, validates the terminating header and every referenced
fixed slot, and uses the source-defined land/water/Rock Smash/fishing weights.
Species, level ranges and native rate edits are byte-bounded and reversible.
The remaining simulation and runtime-modifier work stays explicit rather than
being represented by illustrative fallback data.

### 5. Item and Economy Editor

Use [item records](https://github.com/pret/pokeemerald/blob/master/src/data/items.h)
and linked strings, icons, palettes, effects, held effects, pockets, prices,
marts, Pickup, field use and battle use.

Editing a mart should be a view of Item references, not a list of anonymous
halfwords.

### 6. World/Map Editor completion

Add:

- map creation/deletion and group management;
- complete headers, scripts and scene callbacks;
- encounters;
- map names and region sections;
- music, weather, cave/map/battle type;
- tileset animation, metatile behavior and palette editing;
- fly/heal destinations;
- graph validation and overlapping/contradictory connection diagnostics.

The “minimap” must be the actual in-game region/Town Map/Fly resource, not a
thumbnail of the current rendered map.

Sources:

- [region map data](https://github.com/pret/pokeemerald/tree/master/src/data/region_map)
- [region-map API structures](https://github.com/pret/pokeruby/blob/master/include/region_map.h)

### 7. Script, Text and Story Editor

Build engine-specific script ASTs. Index flags, vars, specials, movements,
text, trainers, gifts, marts, warps, field effects and native calls. Provide:

- story/control-flow graph;
- definition/reference navigation;
- localized string catalog;
- symbolic completion;
- compiler diagnostics;
- safe relocation;
- progression validation for unreachable or contradictory flag states.

Source mode may expose the original `pret` macro language. A visual normal-user
view and a source Nerd view must compile to the same AST.

### 8. Graphics, UI and Tile Editor

Unify:

- Pokémon front/back/icon/footprint assets;
- trainer and overworld sprites;
- tilesets, metatiles and animated tiles;
- battle backgrounds;
- fonts, windows, menus, title screen and UI graphics;
- palettes and compression.

Every graphic must declare dimensions, bit depth, tile order, palette ownership,
compression, frame/OAM composition, references and write policy. PNG import
must quantize predictably and preview the exact native result before applying.

### 9. Battle and Rules Editor

The current Battle Editor should become a consumer of real resources:

- party/team builder using the Trainer and Species documents;
- real battle scene at `240×160`;
- moves, effects, target, type chart and formulas;
- trainer/wild/double battle configuration;
- AI flags and scripts;
- backgrounds, transitions, sprites, palettes, audio;
- deterministic simulation/debug trace.

Battle engine sources include:

- [battle scripts](https://github.com/pret/pokeemerald/blob/master/data/battle_scripts_1.s)
- [AI scripts](https://github.com/pret/pokeemerald/blob/master/data/battle_ai_scripts.s)

### 10. Animation Editor

Use the actual engine:

- [battle animation scripts](https://github.com/pret/pokeemerald/blob/master/data/battle_anim_scripts.s)
- [battle animation macros](https://github.com/pret/pokeemerald/blob/master/asm/macros/battle_anim_script.inc)

Interpret load/free graphics, sprites, tasks, waits, loops, branches, palette
effects, sound and callbacks into shared timeline tracks. Accuracy must be
reported per command. Do not generate representative rectangles and call them
ROM animation.

### 11. Sound Editor

Use:

- [song table](https://github.com/pret/pokeemerald/blob/master/sound/song_table.inc)
- [cry tables](https://github.com/pret/pokeemerald/blob/master/sound/cry_tables.inc)

Required documents: song, track, command, voicegroup, instrument, sample,
envelope, loop, SFX and cry. Provide native-channel playback, piano roll/event
list, loop validation, sample import constraints and reverse references from
maps, scripts, moves, species and UI.

### 12. Save/Player Editor

Use:

- [save structures](https://github.com/pret/pokeemerald/blob/master/include/save.h)
- [Pokémon storage](https://github.com/pret/pokeemerald/blob/master/include/pokemon_storage_system.h)
- [Pokémon structures](https://github.com/pret/pokeruby/blob/master/include/pokemon.h)

This is safety-critical. Box/party Pokémon use personality-based substructure
ordering, encryption and checksum rules. Saves also use sections, signatures,
checksums, counters and redundancy. Required views include player, party,
boxes, bag, flags/vars, Pokédex state, clock, location and game-specific
systems. The writer must create a valid redundant save, not patch an arbitrary
slot in isolation.

### 13. Long-tail systems required for “100%”

For Ruby/Sapphire/Emerald:

- contests, conditions, ribbons and Pokéblocks;
- berries, soil, clock and time events;
- Secret Bases and decorations;
- TV, outbreaks and records;
- daycare/breeding;
- trades, gifts and starters;
- fishing and roaming Pokémon;
- weather;
- link/multiplayer;
- PokéNav, Match Call and rematches;
- Battle Tower/Frontier facilities;
- Safari and minigames;
- Mystery Event/Gift where present.

For FRLG:

- Sevii progression;
- Fame Checker;
- Teachy TV;
- VS Seeker/rematches;
- wireless/link systems;
- game-specific menus, scripts and minigames.

An inventory generated from each pinned `pret` symbol/data build should track
these rather than relying on a permanently hand-written list.

## Profile and manifest design

Every exact GBA profile should contain:

```text
identity
  game code, language, revision, ROM size, hash/fingerprint
source
  repository, commit, build configuration
engines
  map/schema variant, event command set, audio, compression
symbols
  name, file offset, CPU address, size, section
tables
  entry schema, count/terminator, owner, references
protected ranges
  header, code, tables, compressed assets, checksums
capabilities
  read/write/relocate/runtime-verified per resource type
signatures
  bytes/relationships that must match before enabling a writer
```

Generate this from `pret` `.map`, `.sym`, ELF and data declarations where
possible. Hand-maintained offsets should be temporary migration inputs with a
visible confidence level.

## GBA validation gates

Before export:

- exact profile signatures still match;
- all GBA pointers resolve and have correct alignment/type;
- table counts and terminators are legal;
- allocations do not overlap protected or owned data;
- compressed resources decode after writing;
- scripts decode, link and terminate;
- map layouts/events/connections reference valid resources;
- species, moves, trainers, items and encounters use valid IDs/variants;
- unknown bits/bytes are preserved;
- header checksum is correct;
- reloading the output produces the exact semantic documents expected.

Before declaring “playable”:

- boot to title;
- start a new game;
- load a save;
- enter/leave edited maps;
- trigger edited scripts/text/events;
- complete wild and trainer battles using edited data;
- open party, bag, Pokédex and save menus;
- save, reset and reload;
- exercise engine-specific edited systems;
- reach defined progression checkpoints without softlock.

## Immediate GBA priorities

1. Fail closed for profile/language/revision combinations without exact
   manifests.
2. Split RSE/Emerald/FRLG map and script schemas.
3. Extend the generated Emerald English table-root manifest with record counts,
   table extents, pointer kinds, owned ranges and engine signatures.
4. Build the canonical Species catalog and fix every Battle/Pokédex/Sound link.
5. Build one project transaction journal and reference graph.
6. Complete Trainer and Encounter editors on Emerald.
7. Add golden-ROM plus browser/emulator validation.
8. Only then replicate the manifest/editor set for FRLG and Ruby/Sapphire.
