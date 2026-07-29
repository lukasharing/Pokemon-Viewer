# Perfect Tool audit — product, developer and QA closure plan

## Decision

PUSH is a credible experimental ROM-authoring platform, but it is not yet the
complete Pokémon development studio suggested by its editor list. Its strongest
work is the checked memory layer, reversible byte changes, exact-ROM
fingerprinting, generated source manifests and the map-editing vertical slice.
Its weakest area is semantic breadth: several visible workspaces are partial
inspectors or research scaffolds, while large parts of the games have no
document model at all.

The product should not measure progress by pages, controls or decoded offsets.
The unit of completion is a **verified resource type for an exact ROM profile**:

```text
pret declaration
  → generated profile/schema
  → stable semantic document
  → references and ownership
  → renderer and editor
  → reversible writer/relocation
  → whole-project validation
  → exported-ROM reopen
  → emulator/gameplay assertion
```

If any link is absent, the UI must name the resource as read-only, partial,
research or unsupported. A simulated preview must never be presented as native
game output.

This report is the entry point for the detailed audits:

- [AUDIT_2026_WEB.md](AUDIT_2026_WEB.md) — current web product, architecture,
  UI, accessibility, reliability and QA;
- [AUDIT_GBA_2026.md](AUDIT_GBA_2026.md) — Ruby/Sapphire/Emerald and FRLG;
- [AUDIT_GB_GBC_2026.md](AUDIT_GB_GBC_2026.md) — Red/Blue and Crystal;
- [PERFECT_TOOL_EDITOR_CATALOG.md](PERFECT_TOOL_EDITOR_CATALOG.md) — final
  editor behavior for Simple and Nerd experiences;
- [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md) — delivery workstreams and
  release gates;
- [AUDIT_BACKLOG_2026.md](AUDIT_BACKLOG_2026.md) — issue-ready work.

## Evidence and limits

The audit reviewed the current uncommitted web working tree, its first-party
JavaScript, HTML/SCSS, tests, generated manifests and documentation. It compared
the data model with local pinned snapshots of:

| Engine | Repository | Audited commit |
| --- | --- | --- |
| Gen I | `pret/pokered` | `405b6246372d7e5a2cb029cbb65219b13286b8c9` |
| Gen II | `pret/pokecrystal` | `3438c7003a57fa2987fcb223d14b660761b33c64` |
| RSE baseline | `pret/pokeruby` | `63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1` |
| Emerald | `pret/pokeemerald` | `83df84e40623b79281f2397faa611cbf044170bd` |
| FRLG | `pret/pokefirered` | `df4449a27cd78dd747ce269e47d3ab4a0149d8f4` |

Generated exact roots currently exist for reference Red, Blue, Crystal Rev 0
and Emerald. Exact roots are necessary but not sufficient: most entries still
need extents, schemas, reference kinds, owners, protected ranges, signatures
and runtime evidence. FireRed has a known fingerprint in the capability layer
but not yet an equivalent generated manifest in `manifests/generated`.

This was a code and data audit, not a browser interaction pass. Assertions
about touch, screen readers, browser engines and visual layout remain findings
to verify through the browser QA matrix rather than claims that those scenarios
were executed.

## Quality scorecard

The score is deliberately strict. `5` means a release-proven professional tool,
not “a UI exists.”

| Dimension | Now | Release target | Blocking evidence |
| --- | ---: | ---: | --- |
| Exact ROM identity | 3/5 | 5/5 | four exact source manifests; revisions/languages and modified-project import are incomplete |
| Safe bounded memory access | 3.5/5 | 5/5 | good checked reads/writes and expected bytes; no complete owner/protected-range graph |
| Semantic data coverage | 1.5/5 | 5/5 | maps lead; species, moves, items, encounters, save, audio and engine systems are incomplete |
| Reversible authoring | 2.5/5 | 5/5 | command primitives exist; drafts/direct writes/history are not one universal transaction model |
| Relocation/linking | 1.5/5 | 5/5 | pointer patch primitives exist; allocator is not an ownership-aware linker |
| Normal-user usability | 1.5/5 | 5/5 | no project dashboard/task flows; many IDs/offsets and ambiguous capability states remain |
| Nerd-user tooling | 2.5/5 | 5/5 | useful raw/code views; no universal symbols, xrefs, CFG, structure overlay, build/debug workflow |
| UI consistency | 2.5/5 | 5/5 | shared components exist; descriptors, panels, icons and editor contracts remain hand-wired |
| Accessibility/responsive | 1/5 | 5/5 | no executed WCAG/browser/device evidence and incomplete keyboard/canvas alternatives |
| Automated correctness | 2.5/5 | 5/5 | valuable unit/structure tests; browser, golden visual, fuzz and gameplay suites are missing |
| Playability proof | 1/5 | 5/5 | GBA emulator preview only; no deterministic cross-family progression gates |

## What each audience expects

### Normal user

A normal user thinks in game concepts, not ROM structures. Their expected flow
is:

```text
Open ROM
  → see exact game/support status
  → choose a task
  → edit named resources with a native preview
  → see affected resources and warnings
  → undo/review changes
  → test the edited game
  → export a validated ROM/project
```

They should be able to:

- find “Brock”, “Pikachu”, “Route 3”, “Thunderbolt” or a line of dialogue;
- change a trainer team with searchable names and legal choices;
- change a species, learnset, encounter, map, text, item or sound without
  knowing an internal ID;
- see the exact in-game sprite, tilemap, palette, sound or screen;
- understand whether a change also affects evolutions, AI, scripts, shops,
  saves or progression;
- receive actionable validation such as “this warp has no return destination”;
- test and export without learning banks, pointers or compression.

The present shell does not yet deliver this workflow. It lands near low-level
editors, exposes a flat technical navigation list and cannot make the support
level of every visible editor obvious enough.

### Nerd user

An expert expects the same semantic documents plus all underlying evidence:

- exact profile, source commit, symbol, section and ROM range;
- structure layout, field types, units, enums, unknown bits and padding;
- pointer kind, bank, owner and every incoming/outgoing reference;
- original/current bytes and semantic diff;
- disassembly or native macro language with labels and xrefs;
- allocation and relocation plan before apply;
- batch query/transform and reproducible patch/source export;
- debugger breakpoints/watchpoints tied to semantic resources;
- validation diagnostics and emulator trace;
- profile/schema/plugin authoring for a modified ROM or decomp project.

The current Hex and Code workspaces are useful foundations but not yet this
environment. Nerd mode is currently closer to “show more fields” than a real
reverse-engineering and build workspace.

## Task-journey audit

| User goal | Current experience | Missing closure |
| --- | --- | --- |
| Change one trainer team | Partial in Battle; profile/party formats and names vary | canonical Trainer document, all party variants, species/moves/items, script/map link, preview, validation, runtime battle |
| Rebalance one species | no complete Species editor | stats, types, abilities where present, growth, catch, breeding, evos, learnsets, graphics, cry, dex, encounters/trainers xrefs |
| Redesign a route | Map is the strongest path | encounters, music/weather, map scripts, tileset/palette animation, world progression and runtime transition suite |
| Change story dialogue | partial Code/Text path | string catalog, exact owners, language limits, references, flow graph, relocation/linking and preview |
| Replace a sprite | raw tile editing is partial | catalog, compression, OAM/subsprites, palette ownership, frames, import quantization and every consumer link |
| Create a move | absent as a domain editor | move record, effect, animation, sound, descriptions, AI, learnsets, TM/HM/tutor, battle validation |
| Edit Town/Fly map | current minimap concept is not the resource | native tilemap/art, landmarks, cursor, region sections, fly/heal points and unlock logic |
| Change music or cry | Red/Blue and Crystal base cry/pitch/length are exact writable records in Sound and Pokédex; wider Sound remains research | channel/stream decoder, playback, instruments, loops, music/SFX writers and audio validation |
| Edit a battle animation | generic timeline exists | actual family command interpreters, tasks/OAM/tilemap/palette/camera/sound and verified writers |
| Edit a save | absent | family save schemas, redundancy/checksums/encryption, party/boxes/bag/flags/time and ROM compatibility |
| Test the whole change | GBA snapshot preview only | GB/GBC core, deterministic inputs, semantic watches, save/load and progression assertions |
| Ship/share a project | ROM/report export foundation | portable project schema, migrations, source/patch formats, conflict resolution, provenance and recovery |

## Current editor disposition

The navigation should derive these labels from the exact profile and resource,
not hard-code them globally.

| Workspace | Keep visible now? | Current honest role | Graduation requirement |
| --- | --- | --- | --- |
| Project Overview | missing; build first | normal-user home | exact identity, capabilities, recent tasks, changes, validation and Test/Export |
| Hex | yes | verified low-level editor | ownership/xrefs/typed structures/global transactions |
| Code | yes, labelled partial | CPU/script/text inspector and limited compiler | complete per-engine AST/ISA, symbols, CFG, linker and diagnostics |
| Map | yes | editable vertical slice | all maps/properties/resources, graph validator, encounters, native Town Map link and runtime suite |
| Sprite | yes, per verified source | raw graphic editor | asset catalog, compression, composition, palettes, import/export and references |
| Battle | only as partial/research | trainer/battle inspector | true battle documents, engine rules, actual animations/scenes and simulation |
| Pokédex | only where profile proves it | partial GBA; Red/Blue exact entries/measurements/selective 28-byte Base Stats/TM-HM/cries/front and native-scale back pictures plus bounded writable evolution/learnset records; Crystal exact names/banked entries/text/fixed cries/front pictures/palettes plus writable evolutions/learnsets/egg moves and selective BaseData writer | finish palettes/recompression, Gen I linker/rebuild growth, variable text, deeper breeding semantics and localized variants |
| Moves | exact Red/Blue, Crystal and Emerald fixed records | shared editor with isolated Gen I/II/GBA drivers; Emerald exposes all 354 exact 12-byte records/names, preserves engine flags, links explicit trainer moves and verified animation pointers; FireRed Rev. 1 passes the same fixed-table ROM audit but awaits its independent source manifest | Generation III effects/TM-HM/learnsets/audio ownership, command-stream decoding, broader battle/script/AI graphs and name/description writers |
| Encounters | exact Red/Blue grass/water/Old Rod/Good Rod/Super Rod/static roots plus Crystal Rev 0 grass/water/fishing/tree/Contest/roamer/direct-static roots | shared editor with isolated drivers; Red/Blue expose 107 documents/706 slots (58 grass/water, 35 fishing, 14 static) with exact 256-based weights and shared ownership, while Crystal exposes 224 documents/2,486 slots including 17 verified direct `loadwildmon` commands; reversible native-field edits and map/Species/script links | Red/Blue Old/Good map eligibility and runtime contexts, Crystal save-state roamer state and runtime modifiers/simulation, plus GBA driver |
| Sound | Red/Blue and Crystal fixed cries partial; research elsewhere | verified named fixed records and safe parameter writers | real engine streams, playback, instruments, loops, stream writers and reverse links |
| Animation | research | reusable timeline shell | real family command interpreters; no synthetic native claims |
| Emulator | separate bottom tool | GBA preview | matching GB/GBC/GBA cores, semantic bridge, debugger and deterministic tests |
| Changes/Validation/Export | missing as workspace | project commands scattered in menus | universal transaction journal, problems, validation, patch plan and artifacts |
| Profile/Symbols | missing | manifests are developer-facing | inspect/import/build profile, symbols, schemas, signatures and ownership |

## The missing product surface

### Shared editors required for all families

1. Project Overview.
2. Resource Navigator and command palette.
3. Changes, Problems, Validation and Export.
4. Species.
5. Evolutions and Learnsets.
6. Moves.
7. Types, abilities where present, status and core battle constants.
8. Trainers, parties, classes, rematches and AI.
9. Wild Encounters.
10. Items, pockets, effects and economy.
11. Shops, pickups, gifts and trades.
12. Town/Region/Fly Map.
13. Tilesets, metatiles, collision/behavior and palettes.
14. Text/localization catalog.
15. Scripts, flags, variables, movements, specials and story graph.
16. Graphics catalog including Pokémon, trainers, overworld, UI and fonts.
17. Battle Rules and deterministic battle inspector.
18. Audio.
19. Animation, scenes and movies.
20. Save Data.
21. UI, title, menus, options, credits and fonts.
22. Emulator/Debugger.
23. Profile, Symbols, Schemas and Plugins.

These do not need to be 23 unrelated pages. They should be views over a shared
resource graph. Species, Pokédex, cry, sprite and learnset are one connected
resource family; map, encounters, scripts, music and fly data are another.

Implementation status: the shared graph contract and the exact Red/Blue
Species→Base Stats/Pokédex/Text/Cry/Front Sprite/Evolution/Learnset/Move,
Trainer Class→Trainer→Party Member→Species and Map→Encounter→Species spines
now exist. Each exact ROM produces 4,398 immutable nodes and 10,359 typed
edges, covering 165
moves, 72 evolution relations, 728 level-up entries, 47 classes, 415 trainer
records, 1,061 party members, 107 encounter documents and 706 slots. This proves the model on
one coherent vertical slice; it does not yet satisfy the global graph exit gate
because the other domains/families, map/script trainer owners and the
References/Problems UI remain unimplemented.

### GBA-specific product domains

- contests, condition, ribbons and Pokéblocks;
- berries, soil, RTC/time events;
- Secret Bases, decorations and records;
- TV, outbreaks and news;
- PokéNav, Match Call/rematches;
- Battle Tower/Tents/Frontier facilities;
- Safari, roaming, fishing and weather systems;
- Mystery Event/Gift and link/wireless systems;
- FRLG Sevii progression, Fame Checker, Teachy TV and VS Seeker;
- game-specific minigames and menus.

### Gen I-specific product domains

- internal 190-slot species identity including explicit MissingNo handling;
- SGB palettes, border and multiplayer presentation;
- Safari/Game Corner/prizes;
- badges/HM progression and map-specific assembly scripts;
- title, intro, ending, Hall of Fame and link/trade/battle;
- glitch/unused content as an opt-in expert domain.

### Crystal-specific product domains

- morning/day/night palettes and encounters;
- RTC, weekday events and time-based preview contexts;
- breeding, eggs, happiness and daycare;
- phone, radio, rematches and swarms;
- Apricorn/Kurt, mail, decorations and bedroom;
- Unown forms/puzzles/dex;
- Bug-Catching Contest, Battle Tower and Mystery Gift;
- mobile content where the exact profile contains it.

## Architecture decision

The code should become a library around this core:

```text
RomProject
├─ ExactGameProfile
├─ TypedMemory
├─ SchemaRegistry
├─ ResourceGraph
├─ SymbolIndex
├─ OwnershipMap
├─ TransactionJournal
├─ LinkerAllocator
├─ ValidationService
├─ PreviewContext
├─ ArtifactService
└─ FamilyPlugin
   ├─ readers
   ├─ writers
   ├─ codecs
   ├─ renderers
   ├─ validators
   └─ runtime bridge
```

Editors consume `ResourceDocument` objects. A document carries identity,
provenance, fields, unknown bytes, references, capabilities, diagnostics,
changes and renderers. Editors must not scan raw ROM independently or maintain
private copies of the same concept.

The family plugins remain distinct where the games are distinct:

```text
GBA
├─ RSE common
│  ├─ Ruby/Sapphire
│  └─ Emerald
└─ FRLG

Classic
├─ Red/Blue
├─ Yellow
├─ Gold/Silver
└─ Crystal
```

Shared UI does not imply shared binary structures. Family codecs normalize to
the same document interfaces while retaining native units, variants, unknown
fields and pointer rules.

## Web shell recommendation

The application shell should become:

```text
Top: project identity · active resource breadcrumb · capability · Test · Export
Left: resource groups, favorites and recent resources
Center: one active editor/document
Right: properties, references, validation and context actions
Bottom: changes/problems/timeline/debug console
Dock: Emulator and Settings
```

Requirements:

- one descriptor registry generates navigation, icons, menus, commands,
  bookmarks, help, capabilities and lifecycle;
- panels dock/resize/persist on desktop and become drawers/tabs on touch;
- selection survives editor switches because documents outlive views;
- every cross-editor action uses a typed resource reference and back stack;
- Map and Sprite share a tested viewport/gesture service;
- all canvases have a list/table/keyboard alternative;
- dialogs, menus, tabs, tooltips, notifications and windows meet one accessible
  contract;
- local icon assets and a CSP preserve offline behavior;
- Simple/Nerd changes presentation, never the underlying data.

## QA model

### Required pyramid

1. Syntax, formatting, type/static checks and SCSS build.
2. Codec/schema property tests and malformed-input fuzzing.
3. Reader/writer/relocation round trips with expected-byte conflicts.
4. Generated-manifest drift and source provenance checks.
5. Resource-graph identity/reference/ownership tests.
6. Cross-editor transaction and undo conflict tests.
7. DOM component tests for dialogs, menus, tabs, forms and windows.
8. Browser workspace tests in Chromium, Firefox and WebKit.
9. Keyboard, screen-reader, axe, contrast and forced-color tests.
10. Mouse, Mac trackpad, precision touchpad, touch, pinch and pen tests.
11. Golden native-render screenshots at DPR 1 and 2.
12. Export/reopen semantic equality.
13. Matching emulator boot, task and save/load scenarios.
14. Representative progression tests through the ending.
15. Performance, worker, memory and repeated-ROM lifecycle budgets.

### Minimum golden profiles

| Sequence | Profile | What it proves |
| ---: | --- | --- |
| 1 | Emerald English | richest current GBA source/manifest path |
| 2 | Red and Blue international | banked pointers and 190-slot identity |
| 3 | Crystal Rev 0, then Rev 1 separately | Gen II maps/events/LZ3/time/RTC |
| 4 | FireRed English Rev 1 | FRLG structural divergence |
| 5 | Ruby and Sapphire exact revisions | RSE baseline differences |
| 6 | LeafGreen, remaining revisions/languages | profile generation scales |
| 7 | Yellow and Gold/Silver | new engines, not renamed aliases |

### “100% playable” acceptance

For one exact profile, completion requires:

- every source/data resource classified as modeled, deliberately opaque or
  engine code outside semantic editing;
- all modeled tables have counts/extents and every pointer kind is known;
- all incoming/outgoing references are indexed;
- all writers round-trip and preserve unknown data;
- all growth uses owned relocation with overlap/bank/alignment validation;
- every changed byte is explained by a semantic transaction;
- the output reopens to the expected semantic graph;
- title/new game/save/load work;
- edited maps, scripts, text, encounters, trainers, species, moves, items,
  Pokédex, audio and menus execute;
- save/reset/reload works;
- family-specific systems used by the changes execute;
- representative progression checkpoints reach the ending without softlock.

“The ROM boots” is only the first runtime gate, not playability proof.

## Prioritized closure

### P0 — truth and data integrity

1. Make every resource display accuracy/read/write/relocate/runtime state.
2. Hide authoritative-looking synthetic data.
3. Finish exact manifests with extents, schemas, ownership and signatures.
4. Build one Resource Graph and one Transaction Journal.
5. Replace filler scanning with an ownership-aware linker.
6. Add whole-project validation and export/reopen equality.

### P1 — complete three coherent spines

1. Species → graphics → cry → Pokédex → evolution/learnset.
2. Trainer → party → moves/items/AI → map event/script → battle.
3. Map → connections/events → encounters → tileset/palette → Town Map/fly.

Complete these for Emerald, Red/Blue and Crystal before multiplying profiles.

### P2 — professional web product

1. Project Overview and resource-oriented navigation.
2. Shared editor/document/descriptor framework.
3. Complete Normal and Nerd workflows.
4. Browser, accessibility, responsive and visual release gates.
5. Portable project/recovery/artifact format.
6. Matching semantic emulator/debugger bridge.

### P3 — complete game breadth

Moves, items/economy, save data, audio, real animation, UI/fonts/title,
game-specific systems, remaining profiles/languages and source-project mode.

## Governance

Every backlog item closes only when it records:

1. exact profile(s);
2. `pret` source and pinned commit;
3. decoded schema and preservation rules;
4. read/write/relocate/runtime state;
5. automated evidence at the appropriate layer;
6. documentation/capability update;
7. no regression in whole-project validation.

This prevents the editor list from expanding faster than the verified game
model beneath it.
