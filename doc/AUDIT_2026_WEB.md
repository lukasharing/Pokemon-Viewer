# PUSH web product audit — 2026-07-28

## Executive verdict

PUSH is no longer merely the abandoned 2017 viewer described by its old
screenshots. It now has a credible browser-local ROM foundation, automatic
cartridge detection, isolated GBA/Gen I/Gen II runtimes, reversible byte
editing, checksummed export, lazy editor loading, and a particularly promising
map-editing vertical slice.

It is **not yet a complete ROM studio**. The largest product risk is not a
single crash: it is that the navigation gives the same visual weight to
verified editors and to prototypes. Hex, map, portions of code, and verified
sprite ranges make real reversible changes. Battle is a partial data viewer,
Pokédex is partial on profiled GBA, Red/Blue and exact Crystal ROMs, Sound
includes writable Red/Blue and Crystal fixed cry records but is otherwise
principally a relationship/document viewer, Animation is synthetic,
and the emulator supports only GBA. A normal user cannot reliably tell those
states apart.

The right product direction is therefore:

1. preserve the strong byte-integrity foundation;
2. make accuracy and writability explicit per resource;
3. replace scattered offsets with generated, revision-pinned resource
   manifests derived from `pret`;
4. put one typed resource graph and one transaction history beneath every
   editor;
5. finish a small number of end-to-end authoring workflows before adding more
   editor names;
6. prove every exported ROM by reopening it and exercising it in the matching
   emulator.

“Can inspect some bytes” is not the same as “can edit a game,” and “can export a
ROM” is not the same as “the ROM remains completable.” This audit uses those
distinctions throughout.

## Scope and evidence

This is a current-state audit of the web application in the working tree at
commit base `7ef42ec`, including the uncommitted modernization work visible on
2026-07-28. It does not audit a hosted production build, mobile native apps, or
the legal status of user-supplied ROMs.

Evidence used:

- static review of the application shell, all editor fragments, family
  runtimes, structure registries, codecs, writers, tests, and documentation;
- `npm test`: 155 source/codec/structure tests when the initial audit was
  prepared; the current gate is 244 tests plus 154 syntax-checked scripts;
- `npm run audit:rom` against locally supplied Emerald, FireRed Rev 1, and Blue
  ROMs without printing or modifying their bytes;
- direct comparison with the relevant [`pret` repositories](https://github.com/pret);
- separate architecture, UI/UX/QA, and decompilation-coverage passes.

The real-ROM audit proved:

| ROM | Verified vertical slice |
| --- | --- |
| Pokémon Emerald | map `30×30`, 31 events, exact edit/undo, script decode, 246 catalogued sprites, checksum repair, export/import/undo |
| Pokémon FireRed Rev 1 | map `14×9`, 5 events, exact edit/undo, script decode, 152 catalogued sprites, checksum repair, export/import/undo |
| Pokémon Blue | 226 discovered maps, first map `10×9`, 10 events, exact edit/undo, text decode, 60 catalogued sprites, header/global checksum, export/import/undo |

This is valuable evidence for the tested paths. It does **not** prove every map,
language, revision, editor action, game progression branch, or visual result.

## Audit vocabulary

Every resource should expose one of these states in the UI and API:

| State | Meaning |
| --- | --- |
| Absent | No discovery or editor exists. |
| Scaffold | A screen or document model exists, but it is not based on decoded ROM truth. |
| Discovered | A candidate table/pointer was found, but its complete structure is not verified. |
| Decoded | The resource is read using a verified structure and bounds checks. |
| Editable | A semantic change serializes to the original allocation and undoes exactly. |
| Relocatable | Growth, pointer updates, alignment, banking, and free space are handled safely. |
| Runtime-verified | The exported result reopens and passes emulator/gameplay assertions. |

These states are deliberately stricter than “works.” They prevent a synthetic
preview, a pointer heuristic, and a verified writer from being presented as
equivalent features.

## Product quality snapshot

The following is a qualitative diagnostic, not a completion percentage. `1`
means prototype/blocking gaps, `3` means a credible but incomplete foundation,
and `5` means release-proven.

| Dimension | Rating | Reason |
| --- | ---: | --- |
| ROM mutation-safety foundation | 3.5/5 | exact expected-byte writes, global ordered undo, checksums, relocation primitives and an export validation gate are strong; complete domain ownership/reopen validation is missing |
| Semantic game coverage | 1.5/5 | maps lead; most Pokémon/battle/audio/save domains are absent or partial |
| Normal-user learnability | 1.5/5 | attractive shell and visual map tools, but Hex is the landing view and raw IDs/capability ambiguity remain |
| Nerd-user power | 2.5/5 | offsets, code/hex, pointers and family structures exist; symbols/xrefs/linker/source-build/debugger do not |
| Information architecture | 2/5 | shared shell exists; flat editor list will not scale to the complete game |
| UI consistency | 2.5/5 | common headers/help and disposable lifecycles now cover every editor; icons, panels and hand-wired descriptors still diverge |
| Accessibility | 1/5 | partial labels only; keyboard/canvas/dialog/menu/landmark and test gaps are blocking |
| Responsive/touch behavior | 1/5 | some breakpoints/focus behavior, no complete device workflow evidence |
| Automated UI quality evidence | 1/5 | useful Node suite, but almost no executed browser/a11y/visual behavior |
| Release trustworthiness | 1.5/5 | syntax/loading/lifecycle gates are repaired; over-broad capabilities, scaffold data and no gameplay gate remain |

## Current editor scorecard

| Surface | Current truth | Strongest evidence | Principal gaps | Honest product label |
| --- | --- | --- | --- | --- |
| Hex Editor | Real read/write editor | reversible single/range edits, text tables, search, paste, undo/redo, export | no schema-aware highlighting, cross-reference inspector, diff minimap, multi-range transaction authoring, or patch merge UI | **Editable** |
| Code Editor | Real CPU viewer plus partial script/text compiler | GBA opcode coverage through `0xCC`; Gen I and Crystal text/event codecs; safe stop on unknown commands; relocation when owner pointer is known | not a full decompiler, assembler, symbol browser, call graph, control-flow graph, macro project, or complete engine-code writer | **Partial editor** |
| Map Editor | Strongest semantic workspace | family-specific maps, events, connections, layout resizing, blocks/collision, selection, camera, undo/redo, typed event links; real-ROM audit | incomplete resource names/profiles; no complete encounter/weather/music/region-map/story integration; limited metatile/behavior/palette authoring; no world-wide conflict solver | **Editable vertical slice** |
| Sprite Editor | Real tile/palette editing for verified graphic sources | exact 2bpp/4bpp round trips, pixel strokes, grids, palettes, linked map graphics | not a complete sprite catalog; no universal compression, frames/OAM/subsprites, animation, import/export quantization, or safe repointing workflow | **Partial editor** |
| Battle Editor | Shared family UI with partial data adapters | some trainer-party association; GBA sprite preview for profiled assets; timeline controls | no faithful battle engine; profiles are incomplete; animations are pointer-scanned; Gen I/II preview is not decoded; AI, moves, effects, backgrounds and rules are missing | **Inspector preview** |
| Pokédex Editor | Partial GBA, Red/Blue and Crystal entry editor | profiled GBA sprite/height/weight; Gen I canonical spine with selective exact 28-byte Base Stats writer and exact front/native-scale back pictures; Crystal 251 names/corrected BaseData/four-bank entries/descriptions/six-byte cries/LZ3 front pictures/native palettes plus writable 251-move-linked evolution/learnset/egg lists with bank-safe relocation | Ruby/Sapphire profiles absent; GBA breadth incomplete; Gen I palettes/text/recompression/variable progression incomplete; Crystal back pictures/animations/recompression/deeper breeding/text relocation missing | **Partial editor** |
| Sound Editor | Typed shell plus exact fixed cry-record editing | Red/Blue three-byte and Crystal six-byte cry records resolve through named Species; shared Sound/Pokédex validation and Undo/Redo | no complete channel/audio graph, playback, instruments, loops or channel-program writers; GBA coverage incomplete | **Cry parameter editor / wider research** |
| Animation Editor | Reusable document/timeline shell | shared `AnimationDocument`, renderer/timeline concepts | current driver fabricates four illustrative frames and generic commands; no actual engine interpreter | **Scaffold** |
| Emulator | GBA dock using IodineGBA | runs a snapshot, browser-local saves, restart after changes | no GB/GBC core, no semantic memory watches, no deterministic automation, no debugger, no save schema view, no hot resource invalidation | **GBA preview** |
| Bookmarks/Settings | Useful application services | project identity guard; named/annotated browser-local bookmarks; Simple/Nerd preference | not part of a portable project file; limited resource targets; no folders/tags/search/share/export | **Usable local service** |

## Confirmed current defects

These are concrete implementation findings, not future feature requests.

### P0 resolved after audit: Pokédex syntax blocker

The audited version of `js/pokedex/editor.js` contained a JavaScript syntax
error in the property-table `replaceChildren` expression. All three family
runtimes lazily loaded that file, while the old Node suite did not parse every
first-party script; its 155 tests could therefore pass with a shipped editor
broken. The parser defect and missing syntax gate are now fixed.

A dedicated audit check parsed 127 non-vendored JavaScript files (excluding
CodeMirror and emulator vendor trees); this was the only syntax failure, which
localizes the immediate defect but also demonstrates the missing release gate.

Implemented regression gates:

- `npm test` syntax-checks all 130 non-vendored JavaScript files;
- failed assets reject, are evicted from the cache, and can retry;
- startup restores the uploader with a Retry action.

Still required: open every declared workspace for every synthetic profile in a
real-browser integration test.

### P0 resolved after audit: resource failure/retry contract

`FileHandler.load()` reports fetch failures but does not consistently reject or
complete its callback contract. A required fragment/dictionary failure can
therefore strand the bootstrap promise. Failed lazy-script promises are also
cached, making a retry require a full page reload.

`FileHandler` now always resolves or rejects, failed `AssetLoader` entries are
removed, and deterministic tests prove retry without reload. Bootstrap restores
the uploader and offers Retry. Real-browser failure injection remains in QA-001.

### P0 resolved after audit: ready-state event ordering

`RomReader.loadROM()` dispatches `romloaded` before awaiting base editor/
dictionary initialization. The shell reacts by opening Hex, so a slow load can
expose an editor before its dependencies exist.

`romloaded` now follows awaited dictionary and Hex initialization, so the
default workspace is usable when the event fires. A richer detected/loading/
ready state machine remains a worthwhile P1 refinement.

### P0 resolved after audit: editor disposal contract

Map, Code, Sprite and Hex increasingly use disposable listener scopes. Battle,
Pokédex, Sound and Animation attach persistent DOM listeners without equivalent
complete disposal. Replacing several ROMs can therefore retain prior editor
objects and multiply one user action.

All current editors and timelines now own DOM listeners/timers through
`EventScope`; Emulator also guards asynchronous completion after destruction.
Workers, observers and object URLs must adopt the same contract when introduced.

### P1: editor chrome is not actually generalized

Hex, Code, Map, Sprite and Battle receive fuller configurable headers. Pokédex
uses a menu descriptor shape inconsistent with the common header, while Sound
and Animation lack equivalent File/Edit/View/Settings/Help integration. Several
new navigation items reuse the Code icon. Bookmarks and `editorlink` routing
also preserve meaningful state for only part of the editor set.

Required: one `EditorDescriptor` registry must generate navigation, icon,
capabilities, header, commands, bookmarks, links, dirty state, Help and
disposal.

### P1: document and responsive semantics are incomplete

- the English page language, device viewport and single shell `main` are now
  structurally enforced;
- the compact rail retains Emulator and Settings and no longer hides Map
  Properties, but complete narrow-width drawer/tab journeys still need browser
  validation;
- canvas editing has no complete keyboard/nonvisual equivalent;
- menus, tabs, dialogs, notifications and floating panels do not yet meet a
  consistent accessible interaction contract.

These defects require browser, keyboard and screen-reader tests, not only CSS
source assertions.

### Product implication

The shell should not call every row an “editor” without qualification. Each
navigation item should show an accuracy badge and disabled actions should say
why. For example:

- **Animation — preview model, decoder pending**
- **Pokédex — read-only for this ROM profile**
- **Map — editable, 3 unapplied changes**
- **Sound — 18 verified cries, song table unknown**

That is more trustworthy than optimistic empty canvases.

## Consumer audit

### What already feels good

- ROM selection is local and automatic; users do not need to know a game code.
- Unsupported classic games are rejected before entering the wrong semantic
  runtime.
- The left navigation hides before a ROM is loaded and workspaces load lazily.
- Editor state is generally retained when switching workspaces.
- Map interactions increasingly resemble a visual design tool: cursor-centred
  zoom, selection, contextual controls, layers, connections, event inspection,
  and editor focus mode.
- Simple/Nerd is the correct overall concept.
- Export repairs family checksums and can produce a deterministic JSON byte
  report.
- Dirty-state guards and exact undo are much safer than the legacy editor.

### Where a normal user will struggle

1. **No project concept.** The ROM buffer, bookmarks, settings, emulator saves,
   editor drafts, and history are separate pieces. Refreshing or changing
   browsers does not reopen a coherent project.
2. **Capability is ambiguous.** A rendered form may be a writer, a read-only
   view, a heuristic, or fake sample data.
3. **Game language leaks into forms.** “pointer,” “bank,” “offset,” “kind,” and
   numeric IDs appear before the user understands the game object.
4. **Names and previews are incomplete.** “Species 288,” raw movement values,
   and unnamed sounds are not useful authoring choices.
5. **Cross-editor tasks are fragmented.** Editing a trainer should naturally
   include its overworld event, dialogue, script, party, class image, battle
   music, rewards, AI, and rematch behavior in one navigable graph.
6. **No save-safe workflow.** There is no automatic recovery snapshot, project
   file, recent-project list, or “what changed?” review before export.
7. **No gameplay validation.** Structural/domain/graph/allocation/export errors
   now block download, but success still does not show that the title boots, a
   save loads, map transitions work, or a battle completes.
8. **Incomplete documentation exposure.** Guides exist for the older core
   editors, but Sound, Pokédex, Animation, and Emulator lack equivalent
   task-focused guides in the application.
9. **Large-canvas orientation remains costly.** Map graph, current map,
   connected maps, selection, event layers, zoom and active editing mode need a
   persistent but compact status language.
10. **Failure recovery is too technical.** Errors should include the affected
    resource, why it was not safe to proceed, and one next action.

### The normal-user experience should promise

- edit by game names and previews, never by unexplained IDs;
- presets and validated forms rather than raw bytes;
- previews marked as exact, approximate, or unavailable;
- automatic allocation/repointing within verified limits;
- one global undo timeline;
- a portable `.push-project` file containing the source fingerprint, patch,
  bookmarks, editor state, manifests and notes, but not the commercial ROM
  unless explicitly requested;
- a preflight report before export;
- one-click runtime smoke tests;
- no action capable of corrupting the ROM without an explicit explanation and
  recovery path.

## Expert (“Nerd”) user audit

Nerd mode must not merely reveal more number inputs. An expert developer needs:

- exact ROM/file offsets and CPU addresses;
- bank, section, alignment, pointer kind, compression and ownership;
- symbol names imported from `.sym`, `.map`, ELF or a pinned `pret` build;
- raw bytes beside decoded fields;
- source representation and generated binary diff;
- inbound and outbound references;
- a call graph and control-flow graph for scripts/code;
- structure size, union variant, bitfield definitions and validation rules;
- allocation map, free-space provenance and repoint plan;
- batch editing, query/filter, export/import, and scripting APIs;
- command palette and keyboard-first navigation;
- diagnostics that link directly to the broken resource;
- an extension SDK for schemas, codecs, validators, renderers and editor panels.

Simple and Nerd mode must operate on the **same document and transaction**.
Otherwise fixes made in one mode will eventually diverge or overwrite the
other.

## UI and information architecture audit

### Recommended shell

```text
Project bar
  ROM profile · accuracy · dirty state · validate · run · export

Resource navigator
  World
  Story & scripts
  Pokémon
  Battles
  Items & economy
  Graphics & UI
  Audio & animation
  Save data
  System

Editor workspace
  contextual thin toolbar
  primary canvas/document
  optional inspector/reference/history panels

Status bar
  selection · address · resource state · zoom · diagnostics · focus
```

The current flat list is appropriate for a prototype but will not scale to all
game data. A resource navigator should support search, favorites, recent
resources and typed relationships without returning to a giant editor menu.

### Window and panel behavior

- Dock inspectors by default; floating windows should be an explicit layout
  option.
- Reserve at least half of the usable workspace for the editor's visual result.
  Choose the composition axis per editor: width-dependent visuals render
  full-width with controls below; height-dependent visuals use compact side
  docks. A panel below lays out horizontally, while a side dock lays out
  vertically.
- Battle's native scene is the full-width primary content. Team, source and
  engine controls belong below it and must not permanently compress it into a
  secondary right-hand preview.
- Re-evaluate panel orientation after responsive and focus/full-screen changes;
  retaining fixed sidebar dimensions while shrinking the canvas is a layout
  failure.
- Persist layout per editor and viewport class, not as absolute pixels.
- Restore a sensible layout after focus/full-screen or viewport resize.
- Use one panel primitive for header/content/footer, focus order, resize,
  minimize, maximize, close and accessibility.
- Allow panels to declare required width, preferred dock, singleton/multiple
  instances, supported families and resource context.
- Do not show controls that cannot affect the current document.
- Put zoom/navigation in a stable view-control cluster and editing tools in a
  separate contextual cluster.

### Forms and property tables

- Group fields by semantic concept, not by storage order.
- Coordinates belong together; owner pointer and source offset belong together.
- Allow full-width rows for text, references and warnings.
- Put information tooltips on ambiguous keys, not generic window chrome.
- Replace raw enums with named choices and retain the numeric value in Nerd
  mode.
- Show units, legal range, default/inherited value and whether changing the
  value reallocates data.
- Link reference values to their target editor.
- Validate continuously; do not wait for Apply to reveal an invalid pointer.

### Accessibility

Current markup includes some useful labels and canvas names, but there is no
evidence of an accessibility test gate. Before release:

- every icon-only control needs an accessible name and visible tooltip;
- the shared editor menubar and all current/dynamically mounted tablists now
  have roving focus, directional/Home/End navigation and typeahead; shared
  dialogs are named, select initial focus, restore their opener and protect
  dirty forms. Standalone context menus, listboxes, grids and floating panels
  still need the same complete keyboard interaction audit;
- canvases need a semantic alternative: selected resource summary, event list,
  coordinates, and keyboard navigation;
- status must not be communicated by color alone;
- focus indicators, contrast, text zoom and reduced-motion behavior need
  automated and manual checks;
- announcements should use restrained `aria-live` regions;
- screen-reader and keyboard-only smoke tests belong in CI.

## Professional developer and architecture audit

### Foundations worth retaining

- one mutable typed ROM buffer with immutable original/saved snapshots;
- family-specific memory classes and pointer conversion;
- lazy family/workspace loading;
- isolated structure registries;
- safe read cursors and bounds checks;
- exact expected-before write guards;
- reversible commands;
- family checksum repair;
- bank-aware relocation primitives;
- driver registries and shared UI surfaces;
- explicit project identity for persistent references.

These are the beginnings of a library. They should become the supported public
core rather than remain incidental globals.

### Structural problems

#### 1. Global script-order architecture

Most modules are IIFEs publishing globals. `AssetLoader` makes this manageable,
but dependencies are implicit, static analysis is weak, naming conflicts are
easy, and runtime errors such as “X is not defined” remain possible.

Target: ES modules with explicit imports, a build manifest, dependency-cycle
checks, and stable public packages such as:

```text
@push/core
@push/schema
@push/resources
@push/gba
@push/gen1
@push/gen2
@push/ui
@push/emulator
@push/plugin-sdk
```

#### 2. Offset profiles are scattered and incomplete

Some data still lives in runtime configuration, some in `gba-rom-assets.js` and
some in editor drivers. A post-audit `CapabilityManifest` now fingerprints the
whole ROM and prevents the broad header detector from exposing unpinned stock
tables. Exact generated table-root manifests now exist for Red, Blue, Crystal
Rev 0 and Emerald Rev 0 and are consumed by their runtime profiles. FireRed Rev
1 remains fingerprint-audited without a generated source-symbol manifest;
counts, extents, ownership and signatures are still missing.

Target: one immutable, versioned `GameProfile` generated from a reproducible
`pret` commit and keyed by exact cartridge identity/hash. It should include
symbols, tables, codecs, validators, capabilities and source citations.

#### 3. No canonical resource graph

Maps, scripts, sprites, species, cries and trainers are associated ad hoc by
individual editors. This caused visible failures such as numeric species names
and weak cry labeling.

Target: stable typed IDs and relationships:

```text
Trainer
 ├─ event
 ├─ script
 ├─ party[] ── species ── cry/front-back sprites/base stats
 ├─ class ── trainer sprite/music/payout
 └─ rematch/dialogue/flags
```

An editor should request a `TrainerDocument`; it should not rediscover five
tables independently.

#### 4. Global history with owner-scoped views

Applied semantic changes now enter the single `project_commands` journal.
Editors receive owner-scoped views for their local history panels, but those
views cannot reorder the project: local Undo/Redo is blocked when a newer
transaction belongs to another editor, while the global Edit controls preserve
the exact transaction order. Unapplied state is also centralized:
draft-capable editors register providers with the project `DraftRegistry`, and
export/replacement/import consume that fail-closed registry without a fixed
editor-name list. Applied commands use atomic compare-before-write ranges, so a
stale Undo reports a conflict without partially restoring bytes or its view
model.

Target: one project transaction log. Editors may create local preview branches,
but committing a change must produce one globally ordered, atomic transaction
with affected resources and validation results.

#### 5. Allocation is not yet a linker

`RomAllocator` finds runs of a fill byte and `RelocatablePatch` understands
several pointer forms. A shared per-ROM `AllocationLedger` now records
protected, owned and reserved ranges, prevents two pending plans from claiming
the same region, and makes Undo release/Redo reacquire a reservation safely.
Every verified node/reference byte range from the active resource graph is
merged alias-safely into a replaceable protected scope. Unmodeled source
regions still lack complete extents, and the system still cannot expand a ROM,
update all inbound references, or solve section/bank constraints globally.

Target: an allocation/link manifest with reservations, ownership, alignment,
bank/section constraints, expansion policy, deduplication and conflict
detection. Every relocation must report old target, new target, inbound
references and reclaimed/retained space.

#### 6. Huge family editors still combine responsibilities

The GBA map driver exceeds 1,300 lines and the Gen II driver approaches 800.
Parsing, resource discovery, rendering, UI state and commands need stronger
seams.

Target pipeline:

```text
bytes -> codec -> typed resource -> document -> command -> writer -> validator
                                  \-> renderer
```

Family code supplies codecs and family semantics; editor code consumes common
documents.

#### 7. No durable project or schema migration

Bookmarks and preferences use browser-local storage. ROM changes live in memory.
There is no versioned project format, schema migration, resource cache, or
recoverable autosave.

Target: portable versioned projects plus IndexedDB recovery journals. Store a
source fingerprint and byte patch, not a copyrighted ROM by default.

## Data correctness risks

### P0 — fix before expanding writers

1. **Internal species identity.** Gen I internal IDs are not Pokédex numbers and
   include unused/MissingNo values. Species names, cries, graphics, evolution
   and Pokédex tables must use explicit mappings.
2. **GBA Pokémon records.** Box/party Pokémon substructures are encrypted,
   personality-permuted and checksummed. A future save/party editor requires an
   exact codec and checksum-preserving writer.
3. **Profile truth.** A ROM title match is not sufficient evidence that every
   advertised table offset and editor is correct for its language/revision.
4. **Resource ownership.** Reallocation cannot be safe at studio scale until all
   inbound references and occupied ranges are known.
5. **Synthetic previews.** Animation/sample graphics must never be mistaken for
   decoded game assets.
6. **Unknown bytes.** Every codec must preserve unmodeled bits/bytes or refuse a
   write.

## QA audit

### What the automated suite proves

The 244 Node tests are unusually useful for a prototype. They cover detectors,
lazy runtime isolation, memory helpers, structures, codecs, pointer ownership,
bank-aware relocation, map geometry, event creation/deletion, exact undo,
checksums, atomic cross-editor conflict safety, editor source contracts, loader retry,
disposable lifecycles and real-ROM audit orchestration. The default pipeline
also syntax-checks all 154 non-vendored first-party scripts.

Many UI assertions inspect source strings rather than execute the behavior.
The syntax regression that previously allowed a broken Pokédex is now closed,
but workspace/profile behavior still needs real-browser execution.

### What it does not prove

- DOM behavior in a real browser;
- full workflows using mouse, trackpad, touch and keyboard;
- Chrome/Firefox/Safari differences;
- macOS pinch/wheel event behavior across devices;
- visual regressions and pixel-accurate previews;
- screen-reader accessibility;
- memory usage on large composed maps;
- rapid workspace switching and cancellation under slow I/O;
- every supported language and revision;
- all resources/tables in any one game;
- exported ROM boot/progression;
- save compatibility;
- collision/reference consistency after several related edits.

### Required test pyramid

| Layer | Required gate |
| --- | --- |
| Codec unit | decode/encode byte identity; unknown-bit preservation; malformed/bounds fixtures |
| Schema/property | randomized legal values; invalid-value rejection; union variants |
| Resource graph | every reference resolves to the expected type or an explicit external/unknown node |
| Transaction | exact undo/redo, conflict detection, multi-resource atomicity |
| Golden ROM | per exact profile: table counts, sampled named resources, checksums and deterministic hashes of decoded documents |
| Browser E2E | load, navigate, edit, undo, export, reopen on Chromium/Firefox/WebKit |
| Visual | native-resolution golden images for maps, sprites, battle scenes, world map and animation keyframes |
| Accessibility | axe-style automated checks plus keyboard and screen-reader scripts |
| Emulator | boot, title, new game/save/load, map transition, wild battle, trainer battle, menu, ending/progression checkpoints |
| Fuzz/property | pointers, banks, compressed inputs, script opcodes, corrupt ROMs and patch conflicts |

No editor should graduate from “editable” to “runtime-verified” without its
golden-ROM and emulator gates.

## Web privacy, security, performance and delivery

### Privacy

Client-side ROM handling is a strong product property. Document explicitly that
ROM bytes remain local. Do not add telemetry or uploads without opt-in and a
clear data contract.

The current application fetches Font Awesome from a third-party CDN, so it is
not fully offline and the browser discloses a page request to that host. Bundle
the exact icons locally, record their license, and restore a strict
content-security policy.

### Security

- Treat ROM text, imported patch JSON, project metadata and Markdown as
  untrusted input.
- Enforce strict schemas, size limits and safe DOM construction.
- Add a Content Security Policy and remove unnecessary inline style/script
  assumptions.
- Pin third-party source versions and create a notices/SBOM file.
- Run dependency and license checks in CI.
- Never execute ROM-derived source as JavaScript.

### Performance

- Keep the good lazy-loading boundary.
- Move decompression, graph discovery and large canvas composition to Workers.
- Cache decoded immutable resources by ROM fingerprint, profile and byte-range
  version.
- Invalidate cache entries through the resource graph after transactions.
- Virtualize long property, sound, trainer, map and species lists.
- Tile large map scenes and render only the viewport plus a bounded margin.
- Track time-to-ROM-ready, time-to-first-map, pan/zoom frame time, peak memory
  and export duration using local diagnostics.

## Priority findings

### P0 — trust and data integrity

- Introduce explicit capability/accuracy/writability badges.
- Create exact, revision-pinned profile manifests from `pret`.
- Fix internal species identity before connecting Pokédex, cries, trainers and
  battles.
- Create one global transaction/history/draft model and include every writer in
  export guards.
- Build a resource ownership/reference graph before broad relocation.
- Label or hide synthetic Animation/Battle/Pokédex/Sound results.
- Add reopen plus emulator smoke validation to export.

### P1 — complete coherent authoring loops

- Complete one GBA profile (Emerald is the best current candidate).
- Complete one Gen I profile (international Red/Blue).
- Complete one Gen II profile (Crystal Rev 0/1).
- Implement Species, Moves/Learnsets/Evolutions, Trainers, Encounters, Items and
  Text/Script as related documents, not isolated forms.
- Add project save/recovery.
- Add browser E2E, visual and accessibility test gates.

### P2 — production architecture

- Migrate to explicit modules/packages.
- Generate schemas/symbols/manifests from pinned `pret` builds.
- Implement allocator/linker and global validation.
- Add extension SDK and command palette.
- Add GB/GBC emulator and deterministic runtime harness.

### P3 — breadth

- Add remaining languages/revisions and Ruby/Sapphire/FRLG parity.
- Complete audio, animation, UI/font, save data, world map/fly, contests,
  minigames, mystery gift/link and engine-rule editors.
- Support source-backed decomp projects and modified ROM profile import.

## Release readiness

PUSH should currently be described as an **experimental local ROM inspection
and editing prototype**. It is appropriate for development using legal backup
ROMs and careful before/after comparison. It is not ready to promise arbitrary
ROM compatibility, complete editor coverage, save compatibility, or a
completable exported game.

The release gate is not “all menu items open.” It is the acceptance definition
in [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md).

## Authoritative comparison sources

- [`pret` organization](https://github.com/pret)
- [`pret/pokeruby`](https://github.com/pret/pokeruby)
- [`pret/pokeemerald`](https://github.com/pret/pokeemerald)
- [`pret/pokefirered`](https://github.com/pret/pokefirered)
- [`pret/pokered`](https://github.com/pret/pokered)
- [`pret/pokecrystal`](https://github.com/pret/pokecrystal)
- [GBA Pokémon structures (`pokeruby/include/pokemon.h`)](https://github.com/pret/pokeruby/blob/master/include/pokemon.h)
- [GBA battle animation scripts](https://github.com/pret/pokeruby/blob/master/data/battle_anim_scripts.s)
- [Gen I internal species constants](https://github.com/pret/pokered/blob/master/constants/pokemon_constants.asm)
- [Gen I trainer-party encodings](https://github.com/pret/pokered/blob/master/data/trainers/parties.asm)
- [Gen I cry table](https://github.com/pret/pokered/blob/master/data/pokemon/cries.asm)
- [Crystal species-indexed table references](https://github.com/pret/pokecrystal/blob/master/constants/pokemon_constants.asm)
- [Crystal trainer-party encodings](https://github.com/pret/pokecrystal/blob/master/data/trainers/parties.asm)
- [Crystal cry table](https://github.com/pret/pokecrystal/blob/master/data/pokemon/cries.asm)
