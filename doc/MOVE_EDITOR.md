# Move Editor

The Move Editor is a shared workspace for one move document and its references.
It is enabled for exact, fingerprint-pinned English Pokémon Red/Blue,
Pokémon Crystal and Pokémon Emerald ROMs. FireRed Rev. 1 also passes the
fixed-record ROM audit, but remains outside the advertised exact semantic
capability until its independent generated source manifest is committed.
All families use the same document UI with isolated binary drivers.

## What is exact today

- all 165 records from `Moves`;
- all 165 names from `MoveNames`;
- the native six-byte layout: animation, effect, power, type, accuracy and PP;
- type names for every Generation I type ID;
- all 87 effect identities and their handler pointers;
- all 55 TM/HM assignments and 3,037 Species compatibility links;
- manifest coverage and the canonical 151-species graph are composed before
  TM/HM edges are emitted. Opening Move Editor first therefore preserves
  manifest resources while guaranteeing every compatibility source exists;
- all 165 native animation pointers and three-byte sound parameter records;
- inbound references from all 728 canonical level-up entries and 55 machines;
- source ranges and stable `gen1:move:<id>` resource IDs;
- compare-before-write editing and project Undo/Redo for power, accuracy, PP
  and the canonical type field.

For Crystal:

- all 251 names and seven-byte `Moves` records;
- animation, effect, power, type, native accuracy, PP and effect-chance fields;
- named reverse references from 2,215 level-up and 480 egg-move entries;
- the exact 50 TM, 7 HM and 3 Move Tutor assignments from `TMHMMoves`;
- 6,592 Species compatibility links, with each Move reference navigating back
  to the compatible Pokédex entry;
- stable `gen2:move:<id>` resources in the 2,821-node/12,230-edge progression
  graph, extended to 4,683 nodes/16,664 resolved edges when exact trainer
  parties are loaded;
- 1,385 explicit move references from Crystal trainer party formats that store
  moves, with the decoded class/name, native 7×7-tile trainer picture and
  navigation back to the trainer in Battle Editor;
- compare-before-write editing of every byte in the fixed record;
- immediate graph/cache refresh shared with Pokédex progression.

For Generation III:

- all 354 `gBattleMoves` records and `gMoveNames` entries in Emerald;
- the exact 12-byte `BattleMove` layout: effect, power, type, accuracy, PP,
  secondary-effect chance, target, signed priority and the four-byte flags;
- safe fixed-record editing of every scalar field except the engine flag mask,
  which is preserved byte-for-byte until each bit has a verified semantic UI;
- named reverse references from native level-up learnsets, the 58 TM/HM
  assignments and Emerald trainer party formats that explicitly store moves;
- stable `gba:move:<id>` and `gba:machine:<index>` resources are provided by
  `GbaMoveData` itself. Pokédex and Trainer providers fill that same subgraph
  and attach exact byte-ranged references, so opening Battle, Move or Pokédex
  first produces the same canonical graph;
- each move exposes its 12-byte source record while only the first eight
  semantic bytes are writable; the unverified four-byte engine flag mask is
  intentionally excluded from `writeRanges`;
- Pokémon compatibility links back to Pokédex Editor and the exact 24×24
  TM/HM bag icon decoded from `gItemIconTable`;
- direct navigation to the verified `gBattleAnims_Moves` pointer when the
  selected move has a valid script target;
- real-ROM validation of all 354 records and reversible edit/restore on both
  Emerald Rev. 0 and FireRed Rev. 1. Their complete audited graphs currently
  contain 7,952 nodes/24,171 edges and 7,768 nodes/23,959 edges respectively.

Select a move to inspect its battle profile, concise details, animation source
and references. The profile puts type, power/status, accuracy, PP and relevant
family-specific fields first; offsets, IDs, flags and raw records stay in Nerd
mode. “References” is generated from the canonical resource graph rather than
from a second UI-specific data model. The animation/effect destination is the
primary visual surface; the smaller profile summarizes the values that users
most often edit. References use the shared sortable table and distinguish
Pokémon, machines, trainers and other verified data owners. Opening a reference
navigates to the corresponding Pokédex or Battle document. Emerald trainer
references show the decoded class/name and native trainer portrait rather than
an unexplained numeric ID. “Raw record” navigates to the exact record offset in
Hex Editor.

Every family now exposes an embedded native-program timeline and an Animation
Editor route. GBA opens the verified
`gBattleAnims_Moves` pointer; Red/Blue and Crystal route their native animation
ID (and the Gen I verified pointer) into the family animation workspace. The
Move Editor reuses the shared family decoder, timeline and renderer: Play,
Pause, previous/next and the scrubber follow the decoded native commands, and
Nerd mode can inspect the command list. The accuracy chip remains explicit.
This is not misrepresented as complete battle playback: task/sprite/OAM,
tilemap and palette execution remains partial until each family runtime exists.

## Editing and safety

Editing compares and replaces the existing six-byte Gen I, seven-byte Gen II,
or 12-byte Generation III record and never resizes or repoints a table. Power
is `0–255`, native accuracy is `0–255`, and PP is restricted to `1–40`.
Type is restricted to the canonical family set. Gen I effect/animation IDs stay
read-only; Crystal exposes them as bounded raw fields because they are part of
the exact record, while clearly not claiming their command streams are decoded.
The editor preserves unrelated
bytes, uses compare-before-write protection, invalidates cached move/progression
documents after commit, and rebuilds the current Gen I resource graph.

The animation controls are enabled whenever the active family driver resolves
a native animation document. The embedded preview uses the same family
document as Animation Editor, so changing the selected move changes the
program and active commands immediately. Availability does not imply complete
visual playback: Gen I, Gen II and Generation III each report decoder accuracy
next to the canvas.

## Interaction contract

- Select/search and the fixed-record edit action stay in the compact document
  bar; there is no duplicate animation action in that bar.
- The animation surface owns at least half of the primary window. Profile
  values remain adjacent on wide layouts and stack below it on narrow layouts.
- “Used by” is a sortable table, not a collection of anonymous cards. Its
  source column uses a semantic icon or a verified ROM image, its reference
  column uses a human-readable owner, and its final column contains the only
  navigation action.
- Missing references use one concise empty state. They never produce guessed
  Pokémon, trainer or machine ownership.
- Shared layout and interaction code remains in `moves/editor.js`; GBA, Gen I
  and Gen II discovery, offsets, pictures and writers remain isolated in their
  respective drivers and lazy runtime bundles.

## Normal user vs Nerd user

Normal users get names, type, power, accuracy, PP, readable effects, machines
and named Pokémon/level
references. Nerd users additionally need the raw type/effect/animation IDs,
record/name offsets and stable resource ID; these remain visible while the
global experience system is still evolving toward per-field complexity.

## Still missing

- decoded effect-handler behavior and battle formula/AI references;
- script, item and enemy-use reverse references;
- complete visual execution of decoded battle-animation commands and native
  sound command playback;
- move name editing/relocation;
- safe effect/animation command editing;
- Generation III effect/audio ownership graphs, move name writer and safe
  learnset/TM writers from this workspace;
- Crystal effect-handler, description, trainer AI and battle/script
  reference graphs;
- export/reopen/emulator scenarios proving the edited move in battle.

Source authority: exact generated manifests from pinned
[`pret/pokered`](https://github.com/pret/pokered) and
[`pret/pokecrystal`](https://github.com/pret/pokecrystal), especially `Moves`,
`MoveNames`, `EvosMovesPointerTable`, `EvosAttacksPointers` and
`EggMovePointers`, plus Crystal's `TMHMMoves`; and the pinned
[`pret/pokeemerald`](https://github.com/pret/pokeemerald) `gBattleMoves`,
`gMoveNames` and `gBattleAnims_Moves` symbols.

## GB/GBC implementation status

The shared Move Editor is implemented for both supported classic runtimes but
loads a separate family driver. Red/Blue exposes all 165 exact six-byte move
records, names, TM/HM assignments, animation pointers, sound parameters and
canonical level-up references. Crystal exposes all 251 exact seven-byte
records, its 60 machine/tutor assignments and evolution, learnset, egg-move
and compatibility links. Fixed semantic fields are reversible writes with
native range validation; neither driver fabricates a Generation III layout.
The 251 moves and 60 machine/tutor assignments are also published as a
standalone canonical resource subgraph. Trainer and progression providers
fill that subgraph when necessary, preserving manifest-enriched nodes while
making editor initialization order irrelevant.
