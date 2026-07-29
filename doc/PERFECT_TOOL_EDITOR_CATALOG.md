# Perfect Tool editor catalog

## Product principle

PUSH should not become a collection of unrelated pages that each scan the ROM.
It should be a project workspace over one typed resource graph. An “editor” is
a view and command set for one or more shared resources.

The two experiences are progressive disclosure over the same data:

- **Simple** is task-oriented, named, visual, guided and safe.
- **Nerd** adds exact structures, symbols, pointers, code, references,
  allocation and batch tools.

They must use the same document, validation and transaction. A field hidden in
Simple mode is never reset, fabricated or maintained in a second model.

## Resource-centered navigation

```text
Project
├─ Overview
├─ Changes & history
├─ Validation
└─ Build / test / export

World
├─ Maps
├─ Encounters
├─ Town/Region/Fly map
├─ Tilesets & metatiles
└─ World progression

Story
├─ Scripts
├─ Text & localization
├─ Flags / variables / specials
└─ Quests / scenes / cutscenes

Pokémon
├─ Species
├─ Pokédex
├─ Evolutions & learnsets
├─ Moves
└─ Types / abilities / status

Battles
├─ Trainers & parties
├─ Battle rules / AI
├─ Battle scenes
└─ Animations

Items & economy
├─ Items
├─ Shops
├─ Pickups / gifts / trades
└─ Game-specific systems

Media
├─ Sprites & graphics
├─ Palettes
├─ UI / fonts / title
├─ Audio
└─ Animation / movies

System
├─ Save data
├─ Code / disassembly
├─ Hex / structures
├─ Emulator / debugger
└─ Profile / symbols / plugins
```

Users may still pin editors to a short left rail. The complete hierarchy belongs
in a resource navigator and command palette.

## Common editor contract

Every editor descriptor should declare:

```text
id and title
icon
supported document types
family/profile capabilities
accuracy/read/write/relocate/runtime status
default Simple and Nerd layouts
commands and shortcuts
panels and minimum sizes
bookmark/resource serialization
dirty drafts
help document
validators
cross-editor links
preview renderer
destroy/dispose lifecycle
```

Every document shown in an editor should expose:

- stable resource ID and human name;
- game/profile/source provenance;
- exact or unknown ROM range;
- decoded fields with units/enums;
- unmodeled bytes/bits;
- outgoing and incoming references;
- read/write/relocate capability;
- accuracy level;
- validation diagnostics;
- pending/applied changes;
- associated renderers and actions.

## Current editors: required final specification

### Project Overview

**Purpose:** Replace Hex as the normal-user landing page.

Simple:

- game artwork/name, language, revision and checksum;
- support/capability summary;
- common tasks and recent resources;
- changed-resource summary;
- Test and Export buttons;
- recovery/autosave state;
- unsupported-profile explanation.

Nerd:

- hashes, game code, ROM size/MBC, exact profile, source commit;
- loaded symbol/schema manifests;
- memory/section/allocation summary;
- diagnostics and plugin versions.

Done when opening a ROM immediately answers “what can I safely do with this
exact file?”

### Hex and Structure Inspector

**Purpose:** Exact byte editing and the lowest-level synchronized view.

Simple:

- normally reached from “Show bytes” on a resource;
- byte/text search;
- original/current diff;
- safe range edit with undo.

Nerd:

- address/file/bank views;
- typed structure overlay and field boundaries;
- symbols and xrefs;
- data/code/compressed/free/unknown ownership map;
- multi-pattern search, bookmarks and annotations;
- patch staging and multi-range transaction;
- original/current/saved/base comparisons.

Done when selecting bytes always explains known ownership and every write enters
global history.

### Code, Script and Text Editor

**Purpose:** One source workspace with separate document types.

Simple:

- readable event steps or flow blocks;
- named maps, trainers, items, species, moves, flags and text;
- localized text editor with preview;
- safe templates for dialogue, gift, warp, battle, shop and condition;
- diagnostics before Apply.

Nerd:

- original macro/assembly representation;
- complete engine-specific script AST;
- labels, control-flow graph, definitions/references;
- CPU disassembly with complete instruction decode;
- symbols/constants/autocomplete;
- assembler/compiler and exact byte diff;
- bank/section/relocation plan;
- native-call links and debugger.

Done when source round-trips without losing unknown constructs, grown documents
link safely, and every branch/reference validates.

### Map Editor

**Purpose:** Edit a complete connected world and each map’s content.

Simple:

- exact rendered maps and connections;
- pan/zoom/fit with consistent gestures;
- paint/fill/select/move tools;
- layer switch for art, collision/elevation, events and connections;
- map properties, resize/create/delete;
- object/warp/trigger/sign templates;
- named destinations and one-click warp navigation;
- encounter/music/weather links;
- undo history and change list.

Nerd:

- bank/group/header/layout/tileset structures;
- raw block/metatile/behavior/elevation values;
- connection offsets and graph conflicts;
- event records and pointer owners;
- scripts, flags, variables and references;
- allocation/repoint plan;
- collision/pathfinding/progression overlays.

Done when all maps in the profile render reproducibly, edits round-trip, graph
contradictions are reported, and runtime transitions pass.

### Town/Region/Fly Map Editor

**Purpose:** Edit the actual in-game map screen used for Town Map, Fly, Pokégear
or region navigation. It is not a thumbnail/minimap of the map canvas.

Simple:

- native screen preview;
- landmark names and cursor positions;
- map regions;
- fly/unlock/heal destinations;
- artwork/tilemap editing;
- link to associated world map.

Nerd:

- landmark/flypoint tables;
- region IDs, coordinate transforms, flags and scripts;
- tile/palette/pointer ownership;
- engine callbacks and special cases.

Done when the preview matches native screenshots pixel-for-pixel and edited fly
destinations function in the emulator.

### Tileset, Metatile and Palette Editor

**Purpose:** Own every map visual building block and collision behavior.

Simple:

- primary/secondary tilesets;
- tile/metatile canvas with selection and import;
- collision/passability/elevation/behavior choices with names;
- palette and animation preview;
- usage list before changing shared assets.

Nerd:

- exact tile words, flips, palette indices, behavior bits;
- compression and section/bank ownership;
- metatile composition and attributes;
- animation commands/frame sources;
- reverse map/block references;
- repoint/recompress diagnostics.

Done when shared-asset impact is visible, compression round-trips, and every
family’s native collision semantics remain distinct.

### Sprite and Graphic Editor

**Purpose:** Edit native raster assets, not merely arbitrary raw tile ranges.

Simple:

- catalog by species/trainer/object/UI asset;
- exact native preview at integer zoom;
- pencil, fill, select, move, flip and frame tools;
- palette-aware PNG import/export;
- front/back/facing/frame tabs;
- usage and animation preview.

Nerd:

- 2bpp/4bpp, tile order, OAM/subsprites and coordinates;
- compression, bank/section and graphic/palette tags;
- segmented graphic sources;
- raw tile/palette view;
- references, aliases and allocation.

Done when imported assets produce the exact native bytes/appearance, all frames
compose correctly, and compressed growth is safe.

### Species Editor

**Purpose:** Canonical Pokémon record spanning every related table.

Simple:

- searchable name/sprite list;
- stats, types, abilities where present;
- catch/growth/gender/breeding properties;
- held items and yields;
- evolutions and learnsets;
- Pokédex, sprites, cry and encounter links;
- balance comparison.

Nerd:

- internal ID versus Pokédex order;
- every engine table/index and union;
- unused/glitch entries;
- experience/stat formulas;
- bulk query/transform;
- inbound trainer/script/encounter references.

Done when every species relationship resolves through one stable identity and a
round-trip edit never confuses internal and display order.

### Pokédex Editor

**Purpose:** Edit the in-game presentation/index of Species documents.

Simple:

- regional/national order;
- category, descriptions, height, weight, habitat/color where present;
- native Pokédex screen preview;
- front sprite, footprint, palette and cry;
- localized entry variants.

Nerd:

- entry pointer tables and order maps;
- description terminators/banks;
- display calculations and flags;
- missing/unused dex entries.

Done when all supported generations show real names/assets/text, edits serialize
through the profile, and the native screen matches the game.

### Evolution and Learnset Editor

**Purpose:** Visualize and edit progression across species and moves.

Simple:

- evolution tree with named methods/parameters;
- level-up move timeline;
- egg/TM-HM/tutor compatibility;
- legality and loop/conflict warnings;
- “who learns this move?” reverse view.

Nerd:

- raw variant records and terminators;
- engine method constants;
- table packing/repointing;
- batch operations and graph queries.

Done when every method variant round-trips and the graph validator catches
cycles, impossible parameters and dangling IDs.

### Move Editor

**Purpose:** Own move data, effect, animation and sound.

Simple:

- name/description;
- type, power, accuracy, PP, priority and target;
- readable effect/status summary;
- animation/sound preview;
- Pokémon and trainer usage;
- balance filters and comparisons.

Nerd:

- effect routine/script, flags and engine constants;
- AI scoring interactions;
- animation command and SFX references;
- contest data where present;
- batch transforms and formula trace.

Done when the selected move is consistent across battle data, learnsets, AI,
text, animation and sound.

### Type, Ability and Battle-Status Editor

**Purpose:** Edit foundational battle taxonomies and mechanics.

Simple:

- type chart matrix;
- ability descriptions/effects where the generation supports abilities;
- status/volatile behavior summaries;
- previews of matchup impact.

Nerd:

- engine tables/routines, constants and scripts;
- immunities/special cases;
- damage/formula hooks;
- reference and regression analysis.

Done when rule edits are validated by deterministic battle simulations.

### Trainer and Party Editor

**Purpose:** Edit a trainer as one connected game character.

Simple:

- map character, class/name/portrait;
- party cards with real species images/names;
- level, moves, held items and variant-specific fields;
- AI difficulty, battle type and items;
- intro/defeat/after text;
- rematch and reward;
- exact battle preview.

Nerd:

- party encoding variant, pointers and terminators;
- flags/scripts/native AI;
- class tables, payout, transition/music;
- map event and story references;
- allocation impact.

Done when opening a trainer from a map resolves the correct named party and all
changes can be tested in the linked battle.

### Encounter Editor

**Purpose:** Edit wild encounter distributions and special encounter systems.

Current production slices include exact Red/Blue grass/water, Old/Good/Super
Rod and static-battle records (107 documents/706 slots: 58 grass/water, 35
fishing and 14 static, with exact 256-based weights and shared
pointer/group ownership) plus exact Crystal Rev 0 Johto/Kanto grass/water
tables, all 13
fishing groups, 22 time-fish pairs, common/rare Headbutt sets, Rock
Smash, Bug-Catching Contest, the Raikou/Entei initializer/route graph and 17
direct constant `loadwildmon` battles (224 documents, 2,486 displayed slots),
official slot probabilities, fixed level/species/rate/range edits and links to
Map, Pokédex, script and raw data. Runtime swarm selection,
variable/state-derived script battles, save-state roamer state, Gen I
Old/Good Rod map eligibility, remaining runtime contexts/simulation and the
GBA driver remain open.

Simple:

- map/method/time/condition selector;
- named species, level range and probability;
- distribution visualization and random simulation;
- land/water/fishing/headbutt/swarm/roamer/etc. views as supported.

Nerd:

- source table/slot format and rate math;
- condition flags, routines and special encounter owners;
- deduplication/shared-table references;
- batch balance/query tools.

Done when probabilities are exact, all variants are modeled, and sampled
runtime encounters match the configured distribution.

### Item and Economy Editor

**Purpose:** Edit item identity, behavior and economic references.

Simple:

- name/description/icon/palette;
- pocket, price, sell value and held effect;
- field/battle use summary;
- shops, pickups, gifts and Pokémon references;
- item presets and economy balance views.

Nerd:

- raw attributes, effect routines/scripts and parameters;
- constants, IDs and table ownership;
- shop/list terminators and reference graph;
- batch pricing and query tools.

Done when an item remains consistent across bag UI, shops, battle, field use,
held behavior, text and graphics.

### Shop, Gift and Trade Editor

**Purpose:** Author acquisition flows without hand-editing scripts.

Simple:

- mart inventory and price preview;
- pickups and recurring gifts;
- starters/static gifts;
- in-game trades and required/received Pokémon;
- prerequisites/flags.

Nerd:

- list/script owners, terminators and constants;
- native routine parameters;
- story/progression references.

Done when every list and linked script validates and each acquisition is tested
in game.

### Battle Editor

**Purpose:** Configure and inspect a real battle, not fabricate one.

Simple:

- player/opponent parties;
- trainer/wild/battle-type/background selection;
- native sprites, palettes, UI and text;
- step/play through turn and animation previews;
- damage/status/accuracy summary;
- links to trainer, species, move and animation.

Nerd:

- battle state inspector;
- deterministic RNG seed;
- command/task/script trace;
- AI decisions and score trace;
- registers/memory/resource references;
- breakpoints and watchpoints.

Done when a scene and its data match the real engine and simulation results are
verified against the emulator.

### Battle Rules and AI Editor

**Purpose:** Modify type chart, formulas, move effects, AI and global battle
behavior.

Simple:

- named rule switches and difficulty presets;
- visual type chart;
- AI behavior profiles;
- regression scenarios.

Nerd:

- scripts/routines, constants and formulas;
- symbolic code patches;
- test vectors and trace comparison;
- source-project build mode for executable changes.

Done when every supported rule change has deterministic tests and guarded code
patch provenance.

### Animation Editor

**Purpose:** Reusable exact timeline for sprite, tile, battle, scene,
palette/camera, text and sound animation.

Simple:

- native-resolution preview;
- play/pause/frame step/scrub;
- tracks, markers and named assets;
- safe frame/duration/palette edits where verified;
- open linked sprite/sound/code.

Nerd:

- native ticks and command stream;
- command interpreter state;
- tasks/callbacks/OAM/register/tilemap/palette tracks;
- control flow, loops and branches;
- source symbols and exact writer support.

Done when the current frame is derived from actual ROM commands, unsupported
commands are explicit, and writers exist only for proven command formats.

### Sound Editor

**Purpose:** Edit music, SFX, instruments/samples and species cries.

Simple:

- named library grouped by music/SFX/cry;
- playback with native channels;
- species name/sprite for cries;
- track/channel mixer;
- loop and duration view;
- safe pitch/length/assignment edits.

Nerd:

- command/event list and source;
- voicegroup/instrument/envelope/sample ownership;
- channel registers, wave/noise data;
- pointer/bank/section/loop graph;
- import/re-encode/repoint diagnostics.

Done when playback is produced from decoded ROM data and the modified result
matches emulator audio.

### UI, Font and Screen Editor

**Purpose:** Edit menus and presentation assets that do not fit Sprite alone.

Simple:

- title screen, intro, menus, windows, HUD, fonts, credits;
- native screen preview and state variants;
- text fit/overflow warnings;
- palette and tilemap editing.

Nerd:

- tilemaps, OAM, window registers, code callbacks;
- font charmaps/width tables;
- compression and memory constraints;
- source/routine links.

Done when key screens have pixel-golden tests and remain navigable in the
emulator.

### Save Data Editor

**Purpose:** Inspect and safely modify `.sav` data matched to the active ROM.

Simple:

- player, location, party, boxes, bag, Pokédex, money/time;
- backup before write;
- clear warnings for story flags or illegal Pokémon;
- compare primary/backup slots.

Nerd:

- SRAM sections/banks, counters, signatures/checksums;
- encrypted/permuted Pokémon data;
- flags/vars/raw structures;
- RTC and generation-specific systems;
- corruption recovery and diff.

Done when a written save passes every checksum/structure rule and loads,
saves, resets and reloads in the matching game.

### Emulator and Semantic Debugger

**Purpose:** Make testing a first-class project operation.

Simple:

- Run/Pause/Restart;
- controls and save import/export;
- “apply changes and restart safely”;
- test scenarios and results;
- open the resource visible at the current game state.

Nerd:

- CPU/RAM/VRAM/register debugger;
- symbols, breakpoints and typed watchpoints;
- project resource to runtime-address mapping;
- script/battle/map trace;
- deterministic input/RNG recording;
- screenshot/audio/state assertions.

Done when GBA and GB/GBC profiles boot, saves persist safely, and automated
scenarios can gate export.

### Changes, Validation and Export

**Purpose:** One trustworthy end to every workflow.

Simple:

- human change list grouped by resource;
- global undo/redo;
- warnings/errors with “Go to problem”;
- automatic test selection;
- download ROM/patch/project only after preflight.

Nerd:

- byte ranges and semantic owners;
- allocation/repoint plan;
- patch conflicts/dependencies;
- validator details;
- reproducible manifest/source commit/build log;
- IPS/BPS/UPS or other deliberately supported patch formats;
- JSON/API export.

Done when every changed byte has an owner/reason and the generated artifact can
be reopened and runtime-verified.

### Profile, Symbols and Source Project

**Purpose:** Support exact stock ROMs, modified ROMs and expert source workflows.

Simple:

- normally hidden;
- show exact supported profile and verified capabilities;
- guided import when a known hack supplies a profile.

Nerd:

- import `.sym`, `.map`, ELF and generated schema manifests;
- pin `pret` repository/commit/build configuration;
- inspect/edit profile signatures and table schemas;
- source-backed mode: edit documents/source, rebuild, diff and test;
- plugin development and diagnostics.

Done when modified ROM support is explicit and reproducible instead of falling
back to stock offsets.

## Game-specific extension editors

The common document system should allow profile plugins to add:

### Ruby/Sapphire/Emerald

- Contests, moves and condition;
- Pokéblocks;
- berries/soil;
- Secret Bases/decorations;
- TV/outbreaks/records;
- PokéNav/Match Call;
- weather;
- Battle Tower/Frontier;
- Safari/minigames;
- clock events.

### FireRed/LeafGreen

- Sevii progression;
- Fame Checker;
- Teachy TV;
- VS Seeker/rematches;
- wireless/link features;
- game-specific minigames.

### Gen I

- SGB palettes/border;
- Safari/Game Corner;
- glitch/unused data research;
- Hall of Fame.

### Crystal

- clock/day/night/weekday;
- phone/rematches;
- radio;
- breeding/eggs/happiness;
- Apricorns;
- mail;
- decorations;
- roamers/swarms;
- Unown puzzles/forms;
- Bug-Catching Contest;
- Mystery Gift/Mobile where present.

Each plugin must use the same resource, transaction, validation, help and
capability contracts.

## Cross-editor workflows a Pokémon developer will love

### Rebuild one trainer encounter

```text
Map object
 -> trainer script/dialogue/flag
 -> trainer identity/class/portrait
 -> party/species/moves/items
 -> battle AI/background/music/animation
 -> test at the map entrance
```

One history entry can span these resources, and “Test this encounter” launches
the exact scenario.

### Create a new evolution family

```text
Species
 -> stats/types/growth
 -> sprites/palettes/icons/cries
 -> evolutions/learnsets
 -> Pokédex order/text
 -> encounters/trainers/gifts
 -> validation and battle preview
```

### Redesign a route

```text
Map/layout/tileset
 -> collision/elevation
 -> connections/warps
 -> events/scripts/text
 -> encounters
 -> Town Map landmark
 -> music/weather
 -> reachability and runtime test
```

### Rebalance the game

Query and batch tools should connect:

- species stats and experience curves;
- moves, effects and type chart;
- learnsets/evolutions;
- trainer levels/parties/AI;
- encounter levels/distributions;
- item prices/rewards.

The system should generate before/after balance reports and a deterministic
test suite.

## UX acceptance rules for every new editor

- Do not ship a navigation entry backed by fabricated data.
- State accuracy and write capability in the header.
- Show names/previews in Simple mode and IDs plus names in Nerd mode.
- Preserve editor state while switching.
- Provide bookmark, Help, Settings, File and history integration.
- Use one icon system bundled locally.
- Fully dispose listeners/timers/workers on ROM replacement.
- Support mouse, Mac/Windows trackpad, touch and keyboard.
- Preserve the inspected point through zoom/layout changes.
- Provide a non-canvas semantic path to every object.
- Use one accessible dialog/menu/tab/panel system.
- Include a real browser integration test and a profile-specific codec test.
