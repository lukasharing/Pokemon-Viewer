# GB and GBC audit — Red/Blue and Crystal

## Verdict

Classic Pokémon support must be described as two different engines:

```text
Classic
├─ Gen I — Pokémon Red/Blue (DMG with SGB features)
└─ Gen II — Pokémon Crystal (GBC)
```

They share banked-cartridge concepts and 2bpp graphics, but not map records,
events, text commands, compression, collision semantics, trainer parties,
audio, save data, animations, day/night systems or table identity. The current
runtime separation is directionally correct and must remain strict.

The map vertical slice is meaningful:

- international Red/Blue maps are discovered and editable;
- Crystal has a separate fixed-structure runtime;
- blocks, events, connections and collision have family-aware writers;
- bank-constrained relocation exists;
- the supplied Blue ROM passed exact edit/undo/export/import audit.

Outside maps and text/scripts, most classic-game editor surfaces are incomplete.
Red/Blue exposes real Pokédex/base-stat/front-picture/cry data. Crystal now has
a real Species/Pokédex/fixed-cry spine; its Pokémon pictures and channel
streams plus heuristic Battle/Animation surfaces remain unavailable or visibly
partial rather than shown as authoritative game data.

## Source baseline

Authoritative comparison:

- [`pret/pokered`](https://github.com/pret/pokered), audit snapshot reference
  `405b624`
- [`pret/pokecrystal`](https://github.com/pret/pokecrystal), audit snapshot
  reference `3438c70`

Every generated profile should pin the precise source commit and build
configuration. Fixed offsets copied from one build are not a portable schema.

## Current compatibility truth

### Enabled semantic profiles

- international Pokémon Red
- international Pokémon Blue
- Pokémon Crystal revisions 0 and 1

### Recognized but intentionally unsupported

- Pokémon Yellow
- Pokémon Gold
- Pokémon Silver
- Japanese classic ROMs
- other revisions/layouts that do not match the configured profiles

This conservative rejection is good. It should be strengthened with exact
profile fingerprints and table signatures. Crystal Rev 0 and Rev 1 should not
share fixed addresses unless generated manifests prove the relevant symbols are
identical.

## Non-negotiable platform constraints

### Banks are part of a pointer type

A 16-bit value in a GB/GBC ROM is not generally a unique file address. A
resource reference must know:

- MBC/bank model;
- current/explicit bank;
- near versus far pointer representation;
- byte order;
- bank-0 and switchable-bank address rules;
- whether a target may move to another bank;
- whether code/data expects a bank-switch operation.

The current `GbcMemory`, `Gen2Memory` and relocation pointer kinds are useful
foundations. The future schema must prevent plain integers from substituting
for typed banked references.

### “Free `0xFF`” is not enough

Relocation within a bank currently finds fill runs. A complete tool needs a
generated occupied/protected range manifest and inbound-reference graph.
Near-pointer resources must remain in bank; far resources can move only if all
owners can encode the new bank/address and the target bank has legal space.

### Rendering formats differ

- Gen I 2bpp graphics, tilemaps, SGB palettes/border data and battle/overworld
  composition have their own contracts.
- Crystal adds GBC palettes, LZ3-compressed graphics, time-of-day palettes,
  animated tiles, more complex object/animation data and other engine-specific
  formats.

A shared canvas/gesture service is desirable. A shared binary renderer that
ignores those formats is not.

## Classic coverage matrix

Legend: **RW** verified semantic read/write in at least one tested path, **RO**
typed read, **Partial** incomplete/fixed/heuristic, **Scaffold** illustrative
UI, **Absent** no real implementation.

The earlier shared Pokédex syntax blocker is fixed and covered by the
first-party syntax gate. Red/Blue and exact Crystal now have source-backed
drivers; only profile-proven fields become writable.

| Domain | Gen I Red/Blue | Gen II Crystal | Required next truth |
| --- | --- | --- | --- |
| Header/checksum | RW | RW | exact ROM manifest/hash |
| Hex/text bytes | RW | RW | schema overlays/xrefs |
| Map directory/groups | discovered/Partial | fixed-table Partial | generated symbols and names |
| Layout blocks | RW | RW | creation/deletion and allocation ownership |
| Connections | RW | RW | whole-world contradiction validation |
| Events | RW for object/warp/sign variants | RW for object/warp/coord/bg | all scripts/scenes/references |
| Map scripts | assembly-controlled, mostly absent | Partial event codec | complete AST/control flow |
| Collision | RW passable tiles | RW four quadrants | named semantics and engine behavior |
| Tilesets/metatiles | Partial RW | Partial decode/RW; LZ3 write incomplete | animations/palettes/compression |
| Text | Partial RW RGBDS macros | Partial RW text/event macros | localization catalog and references |
| CPU code | Complete base/CB LR35902 decode with byte-exact RGBDS `db` source | same | symbol recovery, labels and semantic RGBDS instruction assembly |
| Overworld sprites | Partial catalog/first graphics | Partial catalog | facings, frames, OAM, palettes, animation |
| Pokémon/base data | Partial RW exact 28-byte records | Partial RW exact 32-byte records plus writable exact progression with bank-safe relocation | remaining Gen I assets/variable records; remaining Crystal assets |
| Evolutions/learnsets | Partial RW exact double-terminated records within current bank budget | RW exact evolution/learnset/egg records with bank-safe relocation | Gen I linker/rebuild growth; dedicated shared view and remaining references |
| Pokédex | Partial RW measurements/Base Stats/TM-HM/cry; real entry/front + native-scale back sprites/progression | Partial RW entry measurements/BaseData/cry/progression; real names/text/LZ3 front sprite/native palette/evolutions/learnsets/egg moves | Gen I palettes/text/recompression/variable progression and Crystal back pictures/animations/recompression/text relocation |
| Moves/effects | Absent | Absent | move/effect/animation graph |
| Trainers/parties | Partial anonymous party bytes | Absent | all variants/classes/names/AI |
| Encounters | Exact Red/Blue grass/water/fishing/static: 107 documents, 706 slots | Exact Crystal production slice documented below | runtime/state-derived closure |
| Items/economy | Partial names/prices | Absent | attributes/effects/marts |
| Battle engine | Scaffold | Scaffold | real resources and simulation |
| Battle animation | Research, disabled | Research, disabled | real engine interpreter |
| Audio | Partial RO verified cry records | Research, disabled | actual channels/commands/music/SFX and writers |
| Town Map/Fly | Absent | Absent | actual in-game map/landmarks/flypoints |
| Save data | Absent | Absent | SRAM/checksum/RTC editors |
| Emulator | Absent | Absent | GB/GBC core and validation harness |

## `pret` coverage ledger

### Gen I Red/Blue

| Resource family | Representative `pokered` evidence | Current PUSH truth | Required closure |
| --- | --- | --- | --- |
| Species identity | internal constants, `MonsterNames`, `PokedexOrder` | canonical 190 slots join names, Trainer, Pokédex, base data, both picture sides, cries, progression and glitch identity | add palettes and remaining references |
| Base stats | `data/pokemon/base_stats.asm`, special Mew record | all exact 28-byte records decoded; five stats, types, catch/base EXP, four starting moves and growth are writable while identity, sprite dimensions/pointers, TM/HM bytes and padding are protected; all 55 compatibility flags remain separately editable with unused-bit preservation, including special `MewBaseStats` | battle/runtime validation and remaining linked assets |
| Evolutions/learnsets | `evos_moves.asm` plus pointers | all 190 bounded records decoded; 72 canonical level/item/trade evolutions and 728 named level-up entries shown, graphed and editable inside the current byte budget; all pointer aliases are tracked, reduction padding is reusable and same-bank relocation fails closed when stock ROM has no verified free run | dedicated Evolution view, battle/script reverse references and source-aware linker/rebuild growth |
| Pokémon pictures | front/back picture pointers and compressed `.pic` data | exact shared decoder for all 151 front and all 151 4×4 back pictures; back previews use the native game 2× scale; both sides have read-only Sprite links and exact Red/Blue audits | palette support, deterministic recompression, ownership and repoint |
| Pokédex | dex order, entry pointers, category/height/weight/text | canonical 151 view, exact pointers and reversible native measurements | category/text growth, validation and complete references |
| Cries/audio | `CryData`, audio headers/channel streams | verified base cry/pitch/length for all 190 internal slots; exact fixed-record writer in Sound and Pokédex with Undo/Redo | channel headers/streams, native playback and channel-program writer |
| Moves | move records, names, effects and animation mapping | dedicated editor; all 165 records/names, 87 named effects/handler pointers, 55 TM/HM assignments, 3,037 Species compatibility links, 165 animation pointers and 165 sound records are exact and graph-linked | decode effect/animation/audio command streams and remaining battle/script xrefs/writers |
| Trainers | class pointers/names, two party encodings, pictures | exact 47 classes, names/prize/AI roots, 415 bounded parties and 1,061 canonical Species links; safe existing-slot edits | party insertion/removal with ownership-aware repoint, portrait decode, dialogue and complete map/script links |
| Wild encounters | `WildDataPointers`, probability thresholds, rod tables/routines, map objects and route scripts | exact 248-pointer ownership plus Old/Good/Super Rod storage, all 33 Super Rod map associations, 12 typed static objects and two Snorlax payloads; 107 documents/706 slots with native rate/level/internal-Species writes and map/script links | Old/Good Rod map eligibility, Repel/runtime simulation and remaining state/machine-code contexts |
| Items/economy | names, prices, marts, effects, prizes | partial names/prices only | item documents, use routines, shops/prizes/gifts/trades |
| Maps | header pointers/banks, blocks, objects, scripts | strong editable/discovery path | generated directory only, named resources, all assembly callbacks and ownership |
| Collision/tilesets | tileset headers, blocksets, collision IDs | partial editing | named native semantics, animation, SGB/color context and complete asset ownership |
| Town Map/Fly | Town Map entries, landmarks/fly data and artwork | absent | exact screen/art, cursor, town coordinates and destination/unlock logic |
| Battle/animation | battle core and battle animation data | heuristic research | actual state/command interpreter, OAM/tilemap/register effects and runtime trace |
| Save/SRAM | SRAM declarations and save engine | absent | party/boxes/items/flags/dex/location/checksum and compatible `.sav` |
| SGB/UI | SGB border/palettes, title, menus, fonts, credits | absent as domains | exact native preview/editors and SGB runtime smoke |
| Game systems | Safari, Game Corner, trades, fishing, Hall of Fame, link | absent | generated inventory and semantic documents |

### Crystal

| Resource family | Representative `pokecrystal` evidence | Current PUSH truth | Required closure |
| --- | --- | --- | --- |
| Species core | names, base stats, evos/attacks pointers, egg moves | exact names plus all 251 32-byte `BaseData` records, writable evolution/learnset/egg lists and all 60 compatibility flags; four unused bits remain preserved | deeper breeding context and remaining tables |
| Pictures/animation | pic pointers, palettes, frames, bitmasks and animations | all 251 base front pictures decode through exact bank-fix pointers and render with normal native palettes | back pictures, all Unown forms, shiny UI, LZ3 writer and picture animation |
| Pokédex | entries, order and text tables | all 251 banked categories, measurements and descriptions; fixed measurements writable | Pokémon assets/order UI and variable text writer/repoint |
| Cries/audio | word-sized cry records, music/SFX pointers and channel engine | all 251 six-byte/three-word cry records named, graph-linked and writable | channel target/stream decoder, playback, loops/instruments and stream writer |
| Moves | move records/effects/names/descriptions | dedicated editor for all 251 names/seven-byte records with writable fields, 60 exact TM/HM/tutor assignments, 2,695 progression and 6,592 compatibility references | effect/animation/audio commands, descriptions, trainers/AI and wider xrefs |
| Trainers | four party encodings, classes, names, pictures | exact 67 classes, 541 named trainers, 1,254 party members and 1,385 explicit move references; all four native encodings, real Pokémon sprites, fixed-record edits and typed map links | trainer portraits, party insertion/removal, AI, rematches, phone/dialogue and complete script ownership |
| Encounters | Johto/Kanto grass/water, fishing, swarm, headbutt, roamers, contest, direct static battles | exact editor for 224 documents and 2,486 displayed slots across grass/water, 13 fishing groups, 22 day/night pairs, common/rare Headbutt, Rock Smash, Contest, Raikou/Entei initialization/16-map route graph and 17 verified direct `loadwildmon` commands; fixed level/species/rate/range/start-map edits, shared-owner disclosure, map, Species and script links | save-state roamer location/HP/DVs, runtime swarm selection, variable/state-derived script battles and runtime modifiers/simulation |
| Items/economy | attributes, pockets, marts, fruit, Apricorn, mail, Mom/Buena | absent | shared item model plus Crystal-specific behaviors/economies |
| Maps/events | groups, attributes, blocks, callbacks/scenes/events | partial editable path | exact Rev 0/1 manifests, complete callbacks/scenes and resource graph |
| Time/color | time palettes, RTC/day/week systems | absent as shared context | one Preview Context consumed by map, encounter, sprite, event and save views |
| Town Map/Pokégear | landmarks, flypoints and Pokégear engines | absent | exact map/phone/radio/landmark/fly views and validation |
| Battle/animation | battle engine, object/frame/OAM/subanimation tables | heuristic research | native command interpreter, scene renderer and trace |
| Save/RTC | SRAM, backups/checksums and RTC state | absent | safe redundant save/clock/daycare/phone/decorations editor |
| Game systems | breeding, phone, radio, Unown, Contest, Tower, Mystery Gift | absent | per-system semantic inventories/editors and gameplay gates |

### Current exact-manifest boundary

Red and Blue have separate reproducible source manifests and exact ROM
fingerprints. Crystal currently has an exact Rev 0 build manifest. Crystal Rev
1 must be generated and validated independently; it cannot inherit Rev 0
offsets because the title and high-level structures look similar.

The generated roots still need counts/extents, near/far pointer ownership,
section/occupied ranges and signatures before they can power broad relocation.
Research scanning remains useful for modified ROM investigation but must stay
read-only and visibly non-authoritative.

## Gen I correctness audit

### Internal species IDs are not Pokédex numbers

This is the most important current cross-editor data problem.

The Gen I internal species constant indexes tables such as names,
evolutions/moves, cries and Pokédex order. The internal ordering contains
unused/MissingNo slots and is not a direct `1..151` National Dex sequence.

Source:

- [pokered Pokémon constants and indexed tables](https://github.com/pret/pokered/blob/master/constants/pokemon_constants.asm)

Consequences of using a direct numeric catalog:

- a trainer party can display the wrong species name;
- a cry can be labeled as the wrong Pokémon;
- sprite, base-stat, evolution and Pokédex references can disagree;
- a writer can replace a valid internal ID with a different species.

Required model:

```text
Gen1SpeciesIdentity
  internalId
  internalNameIndex
  pokedexNumber | null
  baseStatsPointer
  evosMovesPointer
  cryIndex
  frontSpritePointer
  backSpritePointer
  dexEntryPointer
  valid/unused/glitch classification
```

Normal mode may hide unused entries by default but must preserve them. Nerd mode
should allow inspection and explicit glitch-resource work without pretending
they are standard Pokédex species.

### Trainer parties have two encodings

The Gen I trainer table supports:

- one shared level followed by species IDs;
- an `0xFF` marker followed by per-member level/species pairs.

Source:

- [pokered trainer parties](https://github.com/pret/pokered/blob/master/data/trainers/parties.asm)

The editor must retain the active variant, terminator, class/trainer identity,
party length and valid internal species mapping. Converting formats should be a
deliberate command with size/repoint implications.

### Cry records are actual data, not species labels

Gen I cry entries contain base cry, pitch and length. They are indexed in
internal-species order.

Source:

- [pokered cry data](https://github.com/pret/pokered/blob/master/data/pokemon/cries.asm)

The Sound Editor must decode those three fields, resolve the underlying channel
data and use the internal-species mapping. A list titled “Pokémon cries” with
generic species IDs is not sufficient.

### Events are not one modern script table

Gen I map behavior combines map headers, object data, text IDs/macros, map
scripts and assembly routines. The current text codec is useful but does not
constitute a complete event-language decompiler.

Sources:

- [Gen I map script macros](https://github.com/pret/pokered/blob/master/macros/scripts/maps.asm)
- [Gen I engine code](https://github.com/pret/pokered/tree/master/engine)

The resource graph must model script entry points, text pointers, trainer
headers, flags and assembly callbacks. Nerd source mode should use RGBDS
symbols/macros from the pinned build.

### Map discovery is a recovery technique

The current Gen I discovery/scoring path successfully found 226 maps in the
audited Blue ROM, including the official unused map slot handling. That is
impressive forensic work, but a verified profile should replace scoring with
generated map-header pointer/bank tables and symbols. Discovery can remain an
explicit Research mode for modified/unknown ROMs.

### SGB is part of accurate Red/Blue support

Red/Blue can use Super Game Boy palettes and border data. The renderer and
graphics editor should distinguish:

- DMG grayscale/native LCD palette;
- user preview palette;
- SGB game palettes and border assets.

Preview appearance must never be written back as if it were native color data
unless the selected resource truly owns those palette bytes.

## Gen II correctness audit

### Trainer parties have four encodings

Crystal trainer parties support four types:

1. level + species;
2. level + species + moves;
3. level + species + held item;
4. level + species + held item + moves.

Source:

- [pokecrystal trainer parties](https://github.com/pret/pokecrystal/blob/master/data/trainers/parties.asm)

The current fixed-record writer preserves the selected type and validates every
member. The exact Rev 0 manifest binds `TrainerGroups`, `TrainerClassNames` and
`TrainerPicPointers`; the library resolves 67 classes, 541 named trainers,
1,254 party members and 1,385 explicit moves. It renders each selected party
with the shared exact Species front sprite/palette, links typed trainer objects
from Map to Battle, and edits level/species/item/four moves only when those
fields exist in the native encoding. Party insertion/removal, class portraits,
gender, encounter music, AI, rematches, phone/dialogue and complete script
ownership remain open.

### Species links span many tables

Crystal’s species constant indexes names, base data, evolutions/attacks, egg
moves, cries, icons, pictures, palettes, Pokédex data, picture animation and
frames.

Source:

- [pokecrystal species constants and table notes](https://github.com/pret/pokecrystal/blob/master/constants/pokemon_constants.asm)

This makes the shared Species resource especially valuable. A Pokédex-only
record cannot represent the domain.

### Cry records differ from Gen I

Crystal associates a cry index, pitch and length using word-sized fields.

Source:

- [pokecrystal cry data](https://github.com/pret/pokecrystal/blob/master/data/pokemon/cries.asm)

Do not share the Gen I record codec merely because both editors display a
Pokémon cry.

### Time and color affect maps/resources

Crystal adds:

- morning/day/night palettes;
- day/night encounter variants;
- weekday/time events;
- clock and RTC state;
- animated tiles and GBC palette behavior.

The map renderer, Encounter Editor, Save Editor and runtime validator must share
an explicit preview context (time, day, story flags), not independently assume a
single state.

### LZ3 and graphics ownership

The current LZ3 decoder is a useful read foundation. Comprehensive editing
needs deterministic recompression, allocation and pointer updates with golden
decode/encode tests. If an edited resource cannot be safely recompressed and
owned, the UI must remain read-only.

## Required classic editors

### 1. Species Editor

Gen I sources:

- [base stats](https://github.com/pret/pokered/blob/master/data/pokemon/base_stats.asm)
- [evolutions and moves](https://github.com/pret/pokered/blob/master/data/pokemon/evos_moves.asm)
- [Pokédex entries](https://github.com/pret/pokered/blob/master/data/pokemon/dex_entries.asm)
- [cries](https://github.com/pret/pokered/blob/master/data/pokemon/cries.asm)

Crystal sources:

- [base stats](https://github.com/pret/pokecrystal/blob/master/data/pokemon/base_stats.asm)
- [evolutions and attacks](https://github.com/pret/pokecrystal/blob/master/data/pokemon/evos_attacks.asm)
- [picture pointers](https://github.com/pret/pokecrystal/blob/master/data/pokemon/pic_pointers.asm)
- [cries](https://github.com/pret/pokecrystal/blob/master/data/pokemon/cries.asm)

Normal user sees names, sprites, stats, types, catch/growth/breeding data,
evolutions, learnsets, Pokédex and cry. Nerd mode additionally sees internal
order, banks, pointer tables, unused values, variant formats and every
reference.

Crystal-specific fields include held items, gender, egg groups/cycles and other
Gen II mechanics; do not show empty Gen II controls on Gen I documents.

### 2. Move Editor

Sources:

- [Gen I moves](https://github.com/pret/pokered/blob/master/data/moves/moves.asm)
- [Crystal moves](https://github.com/pret/pokecrystal/blob/master/data/moves/moves.asm)

Connect move names, type, power, accuracy, PP, effect, animation, sound,
TM/HM status, learnsets and trainer parties. Normal mode uses readable
effect/target descriptions. Nerd mode exposes engine effect IDs/routines and
references.

Current Red/Blue vertical slice: all 165 fixed records, canonical type/effect
names, handler and animation pointers, sound parameters, TM/HM assignments,
graph-derived machine and level-up references, Hex navigation and guarded
in-place editing for power/accuracy/PP/type. The
remaining items in the paragraph above are still acceptance requirements, not
claims of completion. Crystal now has an isolated driver for all 251
seven-byte records, every fixed field and all named level-up/egg references;
effect/animation/audio commands, descriptions, trainer/AI and
wider script/battle references remain open.

### 3. Trainer Editor

Resolve class and trainer names, graphics, party encoding, payout, AI/special
moves, dialogue/map event and encounter music. The party builder must use the
canonical internal species mapping and active generation’s legal move/item set.

### 4. Encounter Editor

Gen I source:

- [grass/water encounters](https://github.com/pret/pokered/blob/master/data/wild/grass_water.asm)

Crystal sources include:

- [Johto grass encounters](https://github.com/pret/pokecrystal/blob/master/data/wild/johto_grass.asm)
- corresponding Kanto, water, fishing, swarm, headbutt, roaming and
  Bug-Catching Contest data under
  [`data/wild`](https://github.com/pret/pokecrystal/tree/master/data/wild)

Provide exact slot probability/level/species and preview contexts such as
morning/day/night. Validate totals, empty sentinels and species identity.

### 5. Item and Economy Editor

Gen I:

- [item names](https://github.com/pret/pokered/blob/master/data/items/names.asm)
- [prices](https://github.com/pret/pokered/blob/master/data/items/prices.asm)

Crystal:

- [item attributes](https://github.com/pret/pokecrystal/blob/master/data/items/attributes.asm)

Connect descriptions, effects, pockets, prices, held behavior, marts, field and
battle routines. Add family-specific editors for mail, Apricorn balls, fruit
trees and key-item behavior.

### 6. Town Map / Fly / Pokégear Editor

The actual in-game map is separate from the Map Editor’s composed world canvas.

Gen I:

- [Town Map entries](https://github.com/pret/pokered/blob/master/data/maps/town_map_entries.asm)

Crystal:

- [landmarks](https://github.com/pret/pokecrystal/blob/master/data/maps/landmarks.asm)
- [fly points](https://github.com/pret/pokecrystal/blob/master/data/maps/flypoints.asm)
- [Pokégear engine](https://github.com/pret/pokecrystal/tree/master/engine/pokegear)

Edit map artwork/tilemap, landmark names/coordinates/regions, cursor rules,
fly/heal destinations, unlock flags and map associations. Preview the exact
native screen, not a generic minimap thumbnail.

### 7. Script, Text and Story Editor

Gen I:

- RGBDS text macros;
- map scripts and assembly entry points;
- trainer/text/event flags;
- movement and native engine routines.

Crystal:

- event command AST;
- text command AST;
- map callbacks/scenes;
- flags, vars, specials, movements, trainers, phone/radio/time logic.

Provide symbolic references, control-flow graph, story/progression view,
compiler diagnostics and safe bank-aware relocation.

### 8. Sprite, Tileset and UI Editor

Support:

- Pokémon front/back sprites and palettes;
- trainer sprites;
- overworld facings/frames;
- icons;
- tilesets/metatiles and animated tiles;
- fonts/windows/menus/title/credits;
- Gen I SGB assets;
- Crystal time palettes and LZ3.

Every source must declare native dimensions/composition. The current generic raw
tile editor is a low-level view, not a complete asset editor.

### 9. Battle and Animation Editor

Gen I:

- [battle animation data](https://github.com/pret/pokered/tree/master/data/battle_anims)
- [battle core](https://github.com/pret/pokered/blob/master/engine/battle/core.asm)

Crystal:

- [battle animation engine](https://github.com/pret/pokecrystal/tree/master/engine/battle_anims)
- [battle animation data](https://github.com/pret/pokecrystal/tree/master/data/battle_anims)

Implement actual tilemap/OAM/register/palette commands and engine state. The
shared timeline can render normalized tracks, while family interpreters retain
native ticks and behavior. Label unsupported commands; never invent equivalent
frames.

### 10. Sound Editor

Current exact Red/Blue slice: all 190 `CryData` records resolve through the
internal-species catalog; base cry, pitch and length are safely editable from
Sound or Pokédex. The writer changes exactly three bytes, preserves graph
identity and restores exact ROM bytes under Undo. This is parameter editing,
not decoded audio playback.

Gen I:

- [audio engine](https://github.com/pret/pokered/blob/master/audio/engine_1.asm)

Crystal:

- [audio engine](https://github.com/pret/pokecrystal/blob/master/audio/engine.asm)
- [music pointers](https://github.com/pret/pokecrystal/blob/master/audio/music_pointers.asm)
- [cry pointers](https://github.com/pret/pokecrystal/blob/master/audio/cry_pointers.asm)

Decode music/SFX channel streams, commands, loops, envelopes/duty/wave/noise
data and cries. Render a channel timeline plus event/source view. Use named
species, maps, scripts and moves through the resource graph.

### 11. Save/Player/RTC Editor

Gen I:

- [SRAM layout](https://github.com/pret/pokered/blob/master/ram/sram.asm)
- [save engine](https://github.com/pret/pokered/blob/master/engine/menus/save.asm)

Crystal:

- [SRAM layout](https://github.com/pret/pokecrystal/blob/master/ram/sram.asm)

Required documents include player, party, boxes, inventory, money, Pokédex,
flags, location and checksums. Crystal additionally needs backups, RTC/time,
weekday state, daycare/eggs, phone, decorations, Mystery Gift and other
generation systems. Save import must select and validate the correct ROM
profile/fingerprint.

## Long-tail systems required for complete classic editing

### Gen I

- starters, gifts and in-game trades;
- fishing tables;
- marts and vending;
- Safari Zone;
- Game Corner and prizes;
- badges/HM progression;
- fossil/evolution flows;
- Hall of Fame;
- title/intro/ending/credits;
- link/trade/battle;
- SGB palettes and border;
- options, menus and fonts;
- glitches/unused data as an explicit expert domain.

### Crystal

- breeding, eggs, happiness and daycare;
- phone contacts/rematches;
- radio;
- clock, day/night and weekday events;
- roamers and swarms;
- Apricorns and Kurt;
- mail;
- decorations and room;
- Unown forms, puzzles and Pokédex;
- Bug-Catching Contest;
- Battle Tower;
- Mystery Gift;
- Mobile features where present in the profile;
- title/intro/ending/credits and cutscenes;
- link/trade/battle.

## Classic profile design

Create separate generated manifests:

```text
gen1-rgb-intl/<revision>/<hash>
gen2-crystal-intl-rev0/<hash>
gen2-crystal-intl-rev1/<hash>
```

Each records symbols, banks, file addresses, sections, table schemas/counts,
pointer owners, occupied/protected ranges, compression, capabilities and source
commit. Modified ROMs may import a compatible `.sym`/`.map` manifest or enter
Research mode; they must not silently inherit stock offsets.

## Validation gates

Before export:

- every banked pointer resolves using its declared kind;
- near pointers remain in their owning bank;
- no allocation overlaps owned/protected data;
- table terminators/counts are intact;
- scripts/text decode and link;
- compressed graphics decode;
- map connections/events/layout/collision are consistent;
- internal species mappings are valid;
- trainer party variants are intact;
- GB header/global checksums are correct;
- output reopens to identical semantic documents.

Before “playable”:

- boot in an accurate GB/GBC emulator;
- title/new game/save/load;
- edited maps and connections;
- edited text/events/trainers;
- wild and trainer battles;
- party/items/Pokédex/Town Map;
- save/reset/reload;
- Gen I SGB smoke where applicable;
- Crystal clock/day/night/RTC scenarios;
- representative progression checkpoints through the ending.

## Immediate GB/GBC priorities

1. Extend the connected Gen I Species/Pokédex spine beyond its completed
   selective Base Stats and bounded progression writers with a linker/rebuild
   growth path, picture palettes, deterministic picture recompression/repointing
   and the audio channel graph.
2. Extend the pinned Red/Blue and Crystal Rev 0 table-root manifests with
   extents, pointer ownership and signatures; add Crystal Rev 1 independently.
3. Keep heuristic Battle/Animation and unmodeled Crystal picture/channel states
   explicit or unavailable.
4. Extend completed Red/Blue Species, Trainer and
   grass/water/fishing/static Encounter documents with Old/Good map
   eligibility, Repel, remaining runtime/state-derived contexts and
   deterministic simulation.
5. Extend the completed four Crystal fixed trainer-party variants with
   insertion/removal, portraits and AI/rematches/phone ownership; extend the
   completed grass/water time slots with fishing/trees/Contest/swarms/roamers
   and one shared time-aware Preview Context.
6. Implement the actual Town Map/Fly/Pokégear resource.
7. Add a GB/GBC emulator bridge and golden visual/runtime tests.
8. Add Yellow and Gold/Silver only as new engine profiles, never as a label
   alias for Red/Blue or Crystal.
