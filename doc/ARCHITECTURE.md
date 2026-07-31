# Architecture

UI composition uses three separate primitives: `EditorHeader` for menus,
`UiToolbar` for zero, one, or multiple action bars, and `UiWindow` for movable
panels/dialog-like windows. `UiToolbar` reuses `UiWindow.button` rather than
maintaining a parallel button implementation.

Editor fragments can opt in declaratively with `data-ui-window` and
`data-ui-toolbar`. `UiWindow.enhanceAll()` creates docked panels with the same
header, minimization and content contract as floating windows;
`UiToolbar.enhanceAll()` upgrades existing action groups without replacing
their buttons or event handlers. This keeps family/editor logic independent
from shell rendering.

> This document explains the recovered implementation, but it is not a claim
> that every visible editor has the same maturity. The current architectural
> risk review and target design are in
> [AUDIT_2026_WEB.md](AUDIT_2026_WEB.md#professional-developer-and-architecture-audit)
> and [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md). In particular, the
> application remains a global/script-order system, exact profile coverage is
> still narrow, and the canonical resource graph currently covers only verified
> domains. Applied mutations now share one project transaction journal, but
> comprehensive resource ownership and complete per-domain/gameplay validation
> remain open.

## Driver libraries

Family-neutral editors depend on `PokemonViewer.core.DriverRegistry`. Battle,
Pokédex, Move, and map editors register only a small family driver at runtime; shared
UI never imports GBA, GB, or GBC parsing logic. Verified Generation III asset
tables (monster graphics, palettes, and Pokédex entries) live in
`core/gba-rom-assets.js`, which makes the binary profile reusable by Battle and
Pokédex instead of duplicating offsets.

Family-owned rendering metadata follows the same rule as binary data. Shared
renderers consume coordinates and text-layout descriptors; they do not branch
on `gba`, `gbc`, `gen1`, `gen2`, or `gen3`. GBA and GB/GBC modules may implement
the same semantic driver method, but their codecs, tables, anchors, HUD
geometry and message rules remain in physically separate directories.

Every reusable behavior must be a small library with one explicit contract,
not copied editor code. Editors compose those libraries; they do not become
the owner of Species pictures, trainer portraits, scene graphics, sound
programs, tables, dialogs, windows, toolbars or pixel rendering. A shared
library may own presentation and semantic interfaces only. ROM offsets,
pointer rules, codecs, engine control flow and validation remain inside the
separate `gba`, `gbc`/`gen1`, and `gen2` providers. This lets Moves, Pokédex,
Battle, Sprite and Animation reuse one decoded resource without merging
incompatible engines.

`UiResourceCard` is the shared compact material for a pictured resource and
explicit actions. The card itself is not navigation: opening, editing and
removing are separate accessible icon buttons supplied by the caller. TM/HM
compatibility and evolution resources therefore share one visual contract
without hiding destructive or cross-editor behavior behind a whole-row click.

## Runtime model

PUSH is a static single-page application. It has no backend, database, or
server-side ROM processing. SCSS and tests use npm during development; the
generated CSS is committed, so the deployed application only needs a static
HTTP server to fetch HTML fragments and JSON files.

```text
index.html
  -> loads CSS and global JavaScript in a fixed order
  -> FileHandler fetches the declared editor HTML fragments
  -> FileHandler fetches json/games.json
  -> RomReader is constructed
  -> user selects or drops a local ROM
  -> the File API creates Uint8Array memory
  -> header detection chooses family/game/language/revision metadata
  -> the family runtime, structures and dictionary load
  -> Hex initializes; other workspaces load lazily
```

The historical detector/ready-state risks are closed: `RomReader` fingerprints
the complete ROM, resolves a fail-closed capability manifest, and awaits
dictionary/Hex initialization before `romloaded`. The remaining profile risk is
coverage: only a small pinned reference set exists and compatible symbol import
for modified projects is not implemented.

## Main components

| Path | Responsibility |
|---|---|
| `index.html` | Application shell, script order, upload dialog, sidebar, and hidden shared assets. |
| `js/init.js` | Fragment loading, game-card creation, workspace switching, and upload validation. |
| `js/rom_reader.js` | ROM memory ownership, primitive reads, signature searches, dictionaries, and editor initialization. |
| `js/structures/` | Bounds-checked memory, family-specific pointers, typed records, and structure catalogs. See `STRUCTURES.md`. |
| `js/core/memory-utils.js` | Family-neutral typed reads/writes, validated atomic compare-and-replace patches, snapshots, restore, tables, comparisons, and address formatting. |
| `js/core/binary-codec-utils.js` | Shared little-endian operands, strict `$`/`0x`/decimal number parsing, width validation, and source formatting for script codecs. |
| `js/core/text-table.js` | Longest-token text-table encoding and byte decoding shared by Hex, Code, and semantic previews. Family runtimes supply the actual table. |
| `js/core/rom-fingerprint.js` | Whole-ROM SHA-1 identity separating pinned stock builds from modified/unpinned input. |
| `js/core/capability-manifest.js` | Per-workspace state, writability, evidence and `pret` provenance; only Verified/Partial states enter ordinary navigation. |
| `js/core/manual-knowledge-registry.js` | Generated, offset-free reviewed engine contracts: symbol schemas, binary structures, field positions/types, pointer kinds, ownership, resource membership, and evidence. It cannot make a ROM exact or writable. |
| `js/core/resource-graph.js` | Immutable typed resource IDs, nodes, source ranges and inbound/outbound references with confidence, provenance, unresolved state and rewrite policy. |
| `js/core/gba-species.js` | Audited Gen III Species/Pokédex/front-graphic/palette documents plus bounded LZ77 validation shared by Pokédex, Battle preview and export. |
| `js/core/gba-tilemap.js` | Shared GBA 4bpp text-background and 8bpp affine-background renderer with palette-bank, flip and screen-stride semantics. |
| `js/map/gba/region-map.js` | Exact in-ROM Region/Fly background plus Emerald `gRegionMapEntries` navigation. |
| `js/battle/gba/backgrounds.js` | Exact pinned Emerald battle-environment tiles/tilemap/palette decoder. |
| `js/core/gba-trainers.js` | Profile-driven Generation III trainer contract/reader/writer for audited Emerald and FireRed headers plus all four native party layouts; no retail offsets or game-name gate. |
| `js/moves/{library,editor}.js` | Family-neutral Move workspace, navigation and fixed-document actions. |
| `js/moves/gbc/driver.js` | Exact Red/Blue move records, graph-derived learnset references and compare-before-write fixed-record mutations. |
| `js/core/dialog.js` | Shared confirmation, choice, and validated form dialogs used instead of browser-native prompts. |
| `js/core/draft-registry.js` | Project-owned registry for every unapplied editor document; export/replacement/import consume one fail-closed source instead of editor-name lists. |
| `js/core/editor-descriptor-registry.js` | Validated source of editor identity and shell behavior: fragments, families, navigation, capabilities, headers/help, refresh events, activation, links and bookmarks. New editors must register here instead of adding another editor-name switchboard. |
| `js/core/project-validator.js` | Versioned schema/domain/graph/allocation/export validation pipeline; registered domain failures and invalid artifacts block download before emission. Exact Gen I/Crystal Species, Move, progression, Trainer and Encounter libraries register live providers when constructed. |
| `js/core/rom-allocator.js` | Per-`RomMemory` allocation ledger with alias-safe verified-graph protection, collision-free reservations, stable owners and Undo/Redo reacquisition. |
| `js/core/relocatable-patch.js` | Atomic in-place/relocated ROM patches with GBA, Gen I banked, and Gen I far-pointer updates plus exact undo. |
| `js/core/map-layout-writer.js` | Family-neutral rectangular block resizing layered on relocatable patches and typed dimension writes. |
| `js/hex/editor-hex.js` | Hex/text viewport, row virtualization, offset navigation, and selection behavior. |
| `js/map/editor-map.js` | Map loading, graphics decoding, buffers, interaction, camera, and rendering loop. |
| `js/map/controls.js` | Reusable map-tool state, mode cycling, keyboard access, and floating-panel movement. |
| `js/map/context-menu.js` | Native canvas context menu with block inspection and common map actions. |
| `js/map/{bank,map,entities}.js` | Domain objects for banks, maps, connections, and event entities. |
| `js/{camera,decompressor}.js` | Camera movement/zoom and GBA nibble/LZSS helpers. |
| `js/util/{file,utils}.js` | Fetch wrapper, formatting, color/vector utilities, and clipboard hook. |
| `json/games.json` | Game/language-specific signatures and address-chain definitions. |
| `decrypt/*.json` | Byte-to-text/code/movement dictionaries. |
| `definition/*.rbh` | XSE command and constant definitions used by the code-editor experiment. |
| `js/code`, `mode` | Vendored CodeMirror plus unfinished XSE editor integration. |
| `js/emulator/editor.js` | Always-on-top mGBA WebAssembly frontend, project-ROM refresh, save import/export, drag/minimize/fullscreen and scoped keyboard input. |
| `scripts/generate-pret-manifest.mjs` | Clean-checkout RGBDS/GNU symbol manifest generator with required-symbol, sized-symbol and commit provenance validation. |
| `scripts/sync-source-manifests.mjs` | Applies reviewed metadata to fingerprinted JSON artifacts and generates both the exact browser registry and offset-free manual engine contracts. |
| `manifests/{config,generated}` | Required-label declarations, reviewed count/stride/pointer/ownership exceptions, and deterministic exact-ROM manifests produced from pinned `pret` linker output. |
| `js/core/source-manifest-registry.js` | Generated browser mirror of the JSON manifests; default tests prohibit drift from the source artifacts. |

## Canonical resource graph

`PokemonViewer.resources` is the platform-neutral graph contract. Resource IDs
use `family:type:key` (for example `gen1:species:25`). A resolved edge records
its source node and field, optional byte range, target node, reference kind,
confidence, provenance and rewrite policy. A missing target must be represented
as an explicitly unresolved edge with a reason; it cannot silently masquerade
as a valid reference.

Verified nodes may also expose `writeRanges`. Every writable range must be
contained by one of that node's verified source ranges. The shared
`ResourceGraph.coverage(romSize)` operation unions these explicit ranges with
verified writable reference ranges, removes aliases/overlaps, and reports
modeled and semantically writable bytes over the actual cartridge size.
Profile & Resources consumes this contract; it never guesses family
writeability from an address. Sized GNU symbols provide exact extents
automatically. Reviewed schema knowledge is offset-free and visibly
provenanced; a manually supplied address is fingerprint-bound. Neither can
grant writeability. Family providers may promote an extent only where a
concrete writer and round-trip evidence also exist.

Stable engine facts that cannot be inferred safely from arbitrary bytes live
under `ManualKnowledgeRegistry.structures`, not in an editor and not in an
exact-ROM address catalog. Generation III encounters, for example, declare
the byte shape of `WildPokemon`, `WildPokemonInfo` and
`WildPokemonHeader`, plus native method counts and probability weights.
`MemoryProfile.structure(name)` exposes those facts for the selected engine.
The `gWildMonHeaders` location still comes independently from the loaded
ROM's fingerprint-bound source/project manifest. A contract can therefore
interpret a relocated hack table without copying stock addresses, but it
cannot authorize writes without an operation audit.

This boundary is executable, not merely a convention. Every generated manual
contract carries this policy:

- `addressAuthority: none`;
- `compatibilityAuthority: none`;
- `writeAuthority: operation-audit-required`.

The manifest synchronizer rejects absolute identity fields such as `offset`,
`address`, `fingerprint`, or `romOffset` anywhere in reviewed manual
knowledge. It also records the exact `pret` repository, commit, build and
profile used for every review. `ManualKnowledgeRegistry.contract(...)` and
`MemoryProfile.contract(...)` return the interpreted value together with that
provenance and policy.

At ROM load, `ManifestResourceGraph` converts every exact, sized symbol in the
active dictionary into a read-only `manifest-symbol` node. Bundled,
fingerprint-verified symbols contribute modeled-byte coverage and protected
allocation ranges immediately, before any editor opens. Project/manual
symbols remain `partial`: they are inspectable and keep their table metadata,
but do not contribute verified coverage, protection, or write authority.
Domain providers merge their semantic graph over this baseline; they remain
the only layer allowed to declare validated writable ranges and references.

Animation documents may attach native frame metadata (`canvas`, duration,
scale, rotation and flips) to a family-decoded object. The shared renderer
only composes that normalized frame state. GBA affine bytecode, Gen I frame
blocks and Gen II OAM/frame programs remain decoded in their isolated family
modules.

The first exact provider is the Red/Blue Species and Trainer spine. On exact
profiles it builds 3,519 nodes and 8,738 resolved edges for all 151 canonical
Pokémon, 165 moves, 87 effect identities/handlers, 55 machines, 165 move
animation pointers, 165 move sound records, 3,037 Species→Machine compatibility
links, 72 evolutions, 728 level-up entries, 47 trainer classes,
415 trainer records and 1,061 party members:
Species, Base Stats, Pokédex record, description text, `CryData`, compressed
front and native-scale back sprites, evolution sets, learnsets, move records/names, trainer class
metadata, parties and member→Species IDs. Pokédex, Sound and Battle share the
graph and stable IDs on the reader; Move Editor is the first dedicated inbound
reference consumer and navigates a Move back to named Pokédex documents. Two aliased
official class pointers are represented explicitly. The real-ROM audit checks
those counts for both Red and Blue.

`Gen1SpeciesData` also owns the selective fixed-width Base Stats writer.
It reconstructs the complete 28-byte record, validates the five battle stats,
two native type IDs, catch/base EXP, four starting moves and six growth curves,
and deliberately copies Pokédex identity, picture dimensions/pointers, the
seven-byte TM/HM bitset and final padding unchanged. Pokédex applies the plan
through one compare-before-write command and rebuilds the graph after Do/Undo.
The exact Red and Blue audit changes one semantic byte, checks every protected
range and restores the original record.

`Gen1ProgressionData` compiles the native evolution list, zero terminator,
level/move pairs and final zero terminator. Its pointer-owner index prevents a
shared internal Species record from being edited in place. Fixed-footprint
and shrinking writes use one reversible patch and retain any new `0xFF`
padding as that record's future byte budget. Growth or detachment uses only a
verified `gbc16` allocation in the original bank. Exact stock Red and Blue
contain no general free run in that bank, so oversized edits fail with an
explicit linker/rebuild requirement rather than crossing into code.

`CryData` is also the first graph-owned audio writer. Sound and Pokédex call the
the family encoder (three bytes in Gen I, six bytes/three words in Crystal); commands compare
expected bytes before applying or undoing. This edits cry
selection/pitch/length only and does not claim that the underlying channel
streams are decoded.

This is intentionally **partial DATA-006 coverage**. Complete trainer
map/script ownership, decoded move effect/animation/audio command streams,
items, encounters, scripts, palettes,
save data and most GBA/Crystal domains still need providers. Crystal now has a
separate 2,821-node/12,230-edge provider joining all 251 Species to exact
`BaseData`, four-bank Pokédex entry/text, `PokemonCries`, LZ3 front picture and
native palette resources plus all 251 moves, five evolution methods, level-up
learnsets and egg-move lists. Its
selective BaseData encoder reconstructs the complete 32-byte record and changes
only declared fields, preserving the unknown byte, dimensions, obsolete
picture pointers. Its eight-byte TM/HM/tutor bitset is modeled as 60 exact
flags with four preserved unused bits and 6,592 graph relations. There is not yet a global References/Problems UI,
graph-aware relocation planner or transaction-driven cache invalidation.

The Crystal trainer provider extends that same graph instead of building a
parallel index: 67 trainer classes, 541 trainers and 1,254 party-member nodes
plus 1,385 explicit move links produce 4,683 nodes and 16,664 resolved edges.
Map, Battle, Move and Pokédex retain the shared graph on the reader. Fixed
party-record writes invalidate and rebuild it; variable-length party
relocation and full script ownership remain outside the verified boundary.

Crystal encounters are another provider on that graph, not editor-local scan
results. Thirteen manifest roots produce 153 fixed grass/water records, 39 rod
documents, 12 common/rare Headbutt lists, one Rock Smash list and one Contest
document plus Raikou/Entei initialization and its 16-map route network,
totalling 224 documents and 2,486 displayed slots plus exact map ownership
nodes. Seventeen direct `loadwildmon` commands are also bound by exact
script/map symbols and verified opcode offsets. The resulting combined graph
has 7,780 nodes and 23,018
resolved edges. The shared Encounter Editor consumes those
documents; its Gen II driver owns the exact decode/write behavior and other
families fail closed until they provide their own driver.

Red/Blue encounters use a separate `Gen1EncounterData` provider. It resolves
all 248 `WildDataPointers`, verifies the ten-entry
`WildMonEncounterSlotChances` table, decodes Old/Good/Super Rod storage and all
33 Super Rod map associations, parses 12 typed static object battles, and
signature-checks both Snorlax script payloads. It emits 107 documents with 706
slots: 58 grass/water, 35 fishing and 14 static. Shared pointer/group
ownership is preserved rather than copied. Combined with Species, progression
and trainers, exact Red and Blue now expose 4,398 nodes and 10,359 edges. The
shared Encounter Editor consumes the normalized documents, while the Gen I
driver alone owns internal Species IDs, 256-based weights, fishing semantics,
static operand layouts and banked pointer rules.

## Data and trust boundaries

ROM bytes stay in the browser as a `Uint8Array`; the code contains no network upload path. That is a positive privacy property, but untrusted ROM input can still trigger large allocations, invalid offsets, long searches, or rendering loops. Every pointer read should be range-checked before use, decompressed sizes should be capped, and parsing failures should be recoverable.

ROM parsing and editing have no upload API in the active application path.
However, `index.html` currently fetches Font Awesome from a third-party CDN, so
the deployed page is not completely offline and does make an external asset
request. Bundle the reviewed icon subset locally, document its license and add
an offline/CSP test.

## Memory API

All shared editor code receives a `RomMemory`. Use `MemoryCursor` for sequential
parsing and `MemoryReader` for fixed records or tables. Use `MemoryUtils` for
mutations:

```js
const before = MemoryUtils.snapshot(memory, [{offset, length: 4}]);
MemoryUtils.write(memory, offset, "u16", value);
MemoryUtils.writeBytes(memory, offset + 2, Uint8Array.of(low, high));
MemoryUtils.restore(memory, before);
```

`MemoryUtils.patch()` validates every destination before applying any member of
a multi-range patch. Reversible editor commands use the stronger
`MemoryUtils.replaceAll()`: it validates every expected range before applying
any member. `StructureWriter.replaceCommand()`, map resizing, script relocation,
Sprite Editor history, and event/connection tables build on this contract. Do
not write through `memory.bytes.set()` in shared editor code.

`RomReader.ReadOnlyMemory` is a legacy property name for the current mutable
backing `Uint8Array`; `OriginalMemory` is the immutable comparison snapshot.
`MemoryUtils.replace()` and `replaceAll()` additionally compare the current ROM
bytes with the command's expected bytes before changing anything. A stale
Undo/Redo cannot silently overwrite a newer overlapping edit, and a multi-range
conflict never applies partially.
Map blocks, collision values, event coordinates, layouts, relocated
event/connection tables, GBA trainer parties and GBA Pokédex measurements all
use this rule.

`RomReader.project_commands` is the authoritative applied-history journal.
Mutable editors call `reader.history(owner, {label})` to obtain a
`CommandStackScope`. A scope filters its editor's rows for local UI, while all
commands remain in one global order. It refuses local Undo/Redo when a newer
transaction belongs to another editor; project-level Edit controls can then
undo or redo in the only safe order. Destroying an editor unregisters its scope,
not its applied transactions. New mutable editors must use a reader scope and
must not construct a production-local `CommandStack`.

New code must read and write through `reader.memory` and `MemoryUtils` so this
alias cannot create a second memory model. Hex edits, GBA block painting, and
sprite cache refreshes follow that rule.

Pointer translation remains format-specific: `GbaMemory.pointer()` translates
`0x08xxxxxx` ROM addresses, while `GbcMemory.banked()`, `pointer16()`, and
`farPointer()` implement Game Boy banking. A generic helper must not guess or
combine those formats.

Structure discovery is likewise family-scoped. The detected runtime installs
one of `PokemonViewer.structures.registries.gba`, `.gbc`, or `.gen2` on
`RomReader.structureRegistry`; editors use `reader.readStructure()` and
registry factories rather than selecting global classes by filename. This
keeps lazy loading intact and prevents a Crystal structure from being applied
to a Red/Blue or GBA ROM.

Movement decoding follows the same boundary. `map/movement.js` is only a
family-neutral dispatcher; `map/gba/movement-profile.js`,
`map/gbc/movement-profile.js`, and `map/gen2/movement-profile.js` own their
engine's movement IDs, initial-facing rules, frame selection, and horizontal
flip semantics. Shared UI may consume the resulting pose, but it must never
contain or combine those binary tables. In particular, East is a derived
horizontally flipped side frame in the verified engines, not a fourth graphic
that the editor may write independently.

## Project replacement boundary

`RomReader.resetLoadedState()` is the single teardown boundary for a loaded
project. It destroys Map, Code, Sprite, and Hex editor scopes before clearing
mutable/original memory, the family runtime and registry, dictionaries,
catalogs, offsets, and detected profile metadata. `loadROM()` invokes it before
the first asynchronous file read and again in its failure path.

The reset emits `romreset`. The shell responds by closing the visible
workspace, clearing the game label and dirty indicator, and disabling every
navigation entry. Only `romloaded` may re-enable entries, filtered by the
detected profile's declared workspaces. Thus internal and visible project state
cross the same boundary.

This ordering matters: a failed detector or dynamically loaded runtime must not
leave an editor from the previous family responding to document events while
the shared reader points at missing or replacement bytes. New long-lived
editors must implement `destroy()` and release every listener, animation frame,
window, cache, and transient inspector they own.

Only one complete `loadROM()` transaction may run at a time. Lazy workspace
loads use a separate single-flight map keyed by workspace, so repeated clicks
await the same promise instead of constructing duplicate editors. Every load
captures `projectGeneration`; after each script-loading boundary the runtime
checks that generation again before creating an editor. Reset increments the
generation and clears the pending map, preventing an old GBA/GB/GBC promise
from attaching an editor to the next project.

Visible navigation has its own monotonically increasing
`workspaceTransition`. The selected fragment is revealed before initialization
so canvas-based editors can measure their layout, but continuation after each
`await` is permitted only for the latest transition. A current failure rolls
back to the previously visible workspace; a superseded failure is silent and
cannot change focus or surface an irrelevant notification.

## Shared utility API

`js/core/utils.js` exposes `CoreUtils` (also available as
`PokemonViewer.core.utils`) for small format-neutral operations: validated
integers, strict decimal/hexadecimal input and ROM-offset parsing, clamping,
ranges, hexadecimal display, BGR555 color conversion, and clipboard text. Code,
Hex, and Sprite editors use the same offset parser, including `123`, `0x7B`,
and `$7B` forms. It has no prototype patches or global event handlers.

Keep responsibilities narrow:

- `CoreUtils` handles general values and display conversions.
- `BinaryCodecUtils` handles script operands and numeric source literals
  without knowing which game family owns the command.
- `MemoryUtils` handles checked reads, writes, snapshots, and patches.
- `GbaMemory`, `GbcMemory`, and `Gen2Memory` handle family-specific pointers.
- `Dom` creates elements; editors should not add element builders to
`CoreUtils`.

`js/core/project-identity.js` captures the structural identity needed by
persistent editor locations: family, runtime profile, game, language, and
revision. It deliberately excludes filenames because renaming a legally owned
ROM does not change compatibility. Bookmark navigation calls
`ProjectIdentity.assertCompatible()` before revealing a workspace; new
persistent-location features should use the same boundary rather than compare
only `.gba`/`.gbc` extensions.

`js/core/keyboard-utils.js` owns platform-neutral primary-modifier detection,
editable-target detection, and Undo/Redo intent. Hex, Code, Map, and Sprite use
the same command result. It deliberately returns no editor command for
`input`, `select`, `textarea`, or contenteditable targets, preserving native
field history and preventing document-level listeners from stealing typing.

## Editor lifecycle

Editor modules are loaded lazily after their workspace first opens. Replacing a
ROM enters `RomReader.resetLoadedState()`, which delegates editor teardown to
`destroyEditors()` before constructing family-specific instances. Editors own
an `EventScope` (`js/core/event-scope.js`) that combines
abortable DOM listeners, cleanup callbacks, and tracked animation frames behind
one idempotent `destroy()` operation. Map drivers also destroy their managed
windows. This lifecycle is required because the HTML fragments and canvases are
shared across successive ROMs rather than recreated.

Use `scope.options` when several listeners share the default options,
`scope.listen(...)` for one-off registration, `scope.frame(...)` for cancellable
render work, and `scope.cleanup(...)` for resources that do not accept an
`AbortSignal`. Do not add editor-level document/window listeners without
registering them through the owning scope.

## Progressive experience contract

Static controls and dynamically generated property rows use
`data-complexity="advanced"`. `UiWindow.properties()` and `UiWindow.table()`
accept an explicit key-to-complexity map; format drivers classify their own
technical fields instead of relying on label heuristics. Simple mode hides
those rows through CSS while keeping semantic actions in the same window.
Nerd mode reveals the rows without rebuilding editor state.

Complexity must never gate a mutation or export capability. In particular,
both experiences can edit translated text and raw bytes, apply scripts, paint
maps/sprites, Undo/Redo, download the ROM, and export a change report. Only
manual address navigation, CPU modes, byte counts, banks, pointers, and other
diagnostic presentation may be classified as `advanced`.

## Dependency inventory

- jQuery was removed during modernization. The obsolete GBA
  `legacyInitEvents()` implementation was removed as well, so no first-party
  editor path contains or depends on `$()`.
- CodeMirror and many themes/add-ons are vendored under `js/code/codemirror` and `css/codemirror`; most are not part of the active feature path.
- IodineGBA is vendored under `js/emulator` and is lazily loaded only for the
  GBA Project Emulator workspace. `ProjectEmulator` owns the mutable project
  ROM handoff, local save callbacks, canvas attachment and teardown. It is not
  advertised for GB/GBC because IodineGBA cannot execute those cartridges.
- Fontello-generated icon fonts and image assets are vendored locally.

Versions and licenses are not centrally recorded. Before redistribution, add a `LICENSE`, `THIRD_PARTY_NOTICES.md`, source links, versions/commits, and license texts as required.

## Architectural constraints to remove

1. Continue moving global classes/functions behind explicit library interfaces; map controls and context actions are now separated.
2. Continue moving legacy globals into namespaces. The domain model is now
   `RomMap`/`RomConnection` and is published as
   `PokemonViewer.maps.RomMap`/`RomConnection`; the native JavaScript `Map`
   collection is no longer shadowed.
3. Separate immutable source bytes from a mutable patch buffer; immutable reads now begin in `RomMemory`.
4. Represent each supported ROM revision with validated metadata and an explicit detector.
5. Move parsers and decompressors into pure modules testable without the DOM.
6. Make editor features register themselves instead of relying on HTML/script ordering.
7. Keep proprietary ROMs out of tests; generate small synthetic fixtures and test public algorithms independently.
