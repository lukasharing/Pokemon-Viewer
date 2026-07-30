# Audit backlog — issue-ready findings

## How to use this file

This is an implementation backlog extracted from the 2026 deep audit. It does
not replace the platform audits or product roadmap.

Priority:

- **P0:** can misrepresent/corrupt data, blocks a workspace, or invalidates
  release trust;
- **P1:** required for a coherent, safe core workflow;
- **P2:** required for professional product quality;
- **P3:** breadth or long-tail completion.

Status should be changed only when the acceptance evidence is linked. “Code
written” is not enough.

## Verified progress — 2026-07-28

| ID | State | Evidence |
| --- | --- | --- |
| WEB-001 | **Resolved** | `npm test` syntax-checks 205 first-party scripts; the Pokédex parser defect is fixed. Browser workspace-open coverage remains under QA-001. |
| WEB-002 | **Resolved for fetch contract** | `runtime-safety.test.mjs` proves failure rejects and a subsequent `FileHandler.load` succeeds; bootstrap exposes a Retry action. |
| WEB-003 | **Resolved** | The same suite proves failed script elements/promises are evicted and a cache-busted retry succeeds without duplicate execution. |
| WEB-004 | **Resolved** | Source-order regression plus `RomReader` await dictionary/Hex initialization before `romloaded`. A future explicit `projectready` state machine remains desirable. |
| WEB-005 | **Resolved for current editors** | Lifecycle regression covers Hex, Code, Sprite, all Map drivers, Battle, Pokédex, Sound, Animation, Emulator and both timelines through `EventScope`. Ten-replacement browser soak remains QA-001. |
| WEB-006 | **Partial** | Every declared editor now has common File/Settings/Help chrome and maintained help; descriptors are still hand-wired and icons remain incomplete. |
| WEB-007 | **Resolved (Sound lazy-load cache)** | GBA, Gen I and Crystal now request the same cache-busted Sound driver/editor versions. A regression rejects any new Sound dependency on `AppSettings` and checks all three runtimes. The shell also keeps a compatibility alias for an already cached legacy module, preventing “AppSettings is not defined” regardless of editor-open order. |
| EMU-001 | **Resolved (Emulator capability alias)** | The persistent dock requests runtime service `emulator`, which resolves against manifest capability `emulator_editor`; ROM load initializes mGBA immediately, controls remain disabled during startup, and reopening the dock retries a missing core instead of retaining “Load a ROM”. |
| EMU-002 | **Resolved (touch HUD and help)** | The PiP/fullscreen emulator exposes D-pad, A/B, L/R and Start/Select controls through mGBA's native button API with simultaneous pointer tracking, cancellation cleanup and disabled startup state. A header information action explains keyboard/touch controls, refresh, saves and window modes in the shared accessible dialog system. |
| SPR-001 | **Resolved (GBA linked Species source)** | Sprite now owns an isolated GBA Species catalog instead of asking the Battle renderer for scene coordinates. Every audited Emerald and FireRed Species exposes exact LZ77 front/back pictures; Emerald also exposes its second front frame and writable raw 32×32 menu icon/palette. Compressed battle pictures stay read-only. A family-boundary gate rejects any future Sprite → Battle renderer dependency, and unsupported catalog groups are hidden rather than opening empty. |
| EDT-005 | **Partial (GBA Species asset graph)** | The GBA Species provider now emits one valid resource graph covering all 411 names, front/back pictures, battle palettes, Pokédex entries/text, evolution tables, TM/HM masks and level-up lists; exact Emerald additionally owns menu icons/palettes, footprints and cry mappings. Real-ROM audit proves 4,860 nodes/5,888 edges on Emerald and 3,238/3,833 on fingerprint-audited FireRed Rev 1. Base stats, abilities/types, regional order, deterministic recompression and a reference UI remain open. |
| QA-001 | **Partial** | Syntax, retry, lifecycle, capability, export-provenance, central draft registry, global transaction ordering, validation gating, source-manifest, resource-graph, allocation-ledger, atomic cross-editor history conflicts, complete LR35902/CB decode, mandatory CodeMirror plus managed errors, Simple/Nerd logic projection, audited GBA Species/Pokédex/front-sprite/palette/evolution/machine/Move and Emerald Trainer validation, exact Gen I Species/front-back-picture/Base-Stats/bounded-progression/Move/Trainer/Encounter coverage and Crystal Species/Pokédex/BaseData/CryData/progression/Move/compatibility/trainer/encounter regressions run in the default 308-test suite; full browser/profile workspace matrix is still open. |
| MUT-001 | **Resolved (global transaction journal)** | `RomReader.project_commands` is the single applied-history journal. Every mutable editor obtains an owner-scoped view through `reader.history(owner)`, so editor panels can filter their own entries without reordering the project. A local Undo/Redo is blocked when a newer transaction belongs to another editor; the global Edit menu preserves exact project order. Behavioral coverage proves ownership, filtering, blocking and ordered Undo/Redo across editor scopes. |
| MUT-002 | **Resolved (central draft discovery)** | `DraftRegistry` is project-owned and every editor that can retain unapplied state must register a provider. Code Editor registers/unregisters its per-tab source drafts; dirty UI, replacement, close, ROM/report export and report import all consume the registry rather than a fixed editor-name list. Provider failures become blocking/disclosed `draft-provider-error` records instead of silently disappearing. Tests cover multiple present/future editors, malformed/throwing providers, lifecycle cleanup and generic report disclosure. |
| MUT-003 | **Resolved (conflict-safe global history)** | Every maintained semantic Undo/Redo path now compares its complete expected byte set before writing. `StructureWriter.replaceCommand`, `MemoryUtils.replaceAll` and `RelocatablePatch` make multi-range edits atomic. GBA/Gen I/Gen II block, collision, event, connection and layout writers plus GBA trainer-party and Pokédex edits reject stale histories. Behavioral tests alter a second range/pointer between Do and Undo and prove both ROM bytes and editor models remain unchanged; MUT-001 additionally guarantees their global ordering. |
| MUT-005 | **Partial (semantic export validation gate)** | `ProjectValidator` runs deterministic schema, registered-domain, graph, allocation and export checks against the exact export snapshot. Gen I and Crystal Species, Move, progression, Trainer and Encounter libraries self-register live validators. Audited Emerald/FireRed Species validation now re-decodes all 386 names, Pokédex records, description pointers, LZ77 front graphics and palettes; the shared GBA renderer consumes exactly one 2,048-byte 64×64 4bpp frame with correct packed-pixel order. Audited Emerald additionally validates all 855 native 40-byte trainer headers and 1,825 party members across the four party layouts. The one-byte level and following compiler padding are modeled separately; agbcc rounds the no-item layouts to 8/16-byte strides. Stable error codes block artifact emission. Tests prove the five layers, live reevaluation, stale-cache rejection, malformed compressed data, native tiled-image layout, native GBA party fields and zero-download blocking. Remaining GBA domains, gameplay/reopen validation and a Problems UI remain open. |
| MUT-004 | **Partial (shared reservation + verified-resource ledger)** | Every `RomAllocator` for the same `RomMemory` shares one `AllocationLedger`. Protected/owned/reserved ranges reject overlap; planning two relocations cannot select the same `$FF` bytes; Undo releases a reservation and Redo must reacquire it without conflict. `RelocatablePatch` and all GBA/Gen I/Gen II map event/connection writers participate. Whenever the reader receives a resource graph, its verified node and reference byte ranges are unioned alias-safely into a replaceable protected scope; the GBA Species/Sprite/Pokédex spine now contributes all of its decoded asset and table extents. Unmodeled source regions still lack extents, so an intentional `$FF` range outside the verified graph can look free and this P0 remains open. |
| DATA-001 | **Partial** | Whole-ROM fingerprints now resolve a per-workspace manifest and Research fails closed. Exact source-symbol manifests cover Red, Blue, Crystal Rev 0 and Emerald Rev 0; FireRed Rev 1 remains fingerprint-audited only. |
| DATA-004 | **Partial** | Pointer/byte-scanned Battle animations and generic Animation documents are no longer exposed in ordinary navigation. A dedicated Research workspace still needs to be built. |
| DATA-005 | **Partial** | Gen I now models all 190 internal slots and joins canonical identities to `BaseStats`/special `MewBaseStats`, real Pokédex entries/descriptions, all 151 compressed front sprites and all 151 compressed 4×4 back sprites rendered at the game's native 2× scale, `CryData`, all 165 move records/names, 72 canonical evolutions, 728 level-up entries and every official trainer party member. The exact 28-byte Base Stats writer protects identity/pointers/TM/padding. The double-terminated progression encoder edits level/item/trade evolutions and learnsets within the current byte budget, tracks all 190 pointer owners, reuses reduction padding and attempts only same-bank verified allocations. Exact Red and Blue audits prove every front/back decode plus reversible Base Stats and fixed-footprint progression edits; both stock banks correctly reject unverified growth. Simple hides glitch slots. A linker/rebuild path, palettes, deterministic sprite recompression/repointing and the audio channel graph remain open. |
| DATA-006 | **Partial** | `core/resource-graph.js` now fails closed around immutable `family:type:key` nodes and typed edges with source field/range, target or unresolved reason, kind, confidence, provenance and rewrite policy. Exact Red and Blue grow from 3,519 nodes/8,738 edges through exact grass/water/fishing/static encounters to 4,398/10,359. Crystal grows from 2,821/12,230 progression through trainers to 4,683/16,664, then through exact grass/water/fishing/Headbutt/Rock/Contest/roamer/direct-static encounters to 7,780 nodes/23,018 resolved edges. The GBA Species spine contributes 4,860/5,888 on Emerald and 3,238/3,833 on FireRed Rev 1. Remaining GBA domains, reference UI and comprehensive relocation rewriting remain open. |
| GEN1-001 | **Partial** | Exact manifests now bound `TrainerDataPointers` with names, picture/prize metadata, party end and AI roots. The typed library decodes all 47 classes, 415 trainer records and 1,061 members in both native formats, normalizes map `OPP_*` IDs, exposes real names and canonical Species links, models the two aliased class pointers, and emits atomic compare-before-write plans. Existing slots are safely editable; party insertion/removal and ownership-aware repointing remain open. |
| EDT-012 / EDT-020 | **Partial (Gen I, Gen II and GBA fixed-record vertical slices)** | Exact Red/Blue manifests bind `Moves`, `MoveNames`, `TechnicalMachines`, effect, animation, sound and progression roots. Crystal binds its seven-byte records, progression, machines and trainer references. Emerald now additionally binds `gBattleMoves`, `gMoveNames` and `gBattleAnims_Moves`: the isolated GBA driver exposes all 354 exact 12-byte records, preserves the four-byte flags while safely editing the remaining scalar fields, resolves Emerald explicit trainer-party uses and opens verified animation pointers. Emerald Rev. 0 and FireRed Rev. 1 real-ROM audits decode all 354 moves and prove reversible fixed-record writes. Generation III effect/TM/HM/learnset/audio ownership, command-stream decoding, names/variable tables, broader references and dedicated Evolution editing remain open. |
| EDT-004 | **Partial (fixed cry records; native editor architecture specified)** | Red/Blue Sound and Pokédex share the exact three-byte `CryData` writer across all 190 internal slots; Crystal shares its exact six-byte, three-word `PokemonCries` writer across 251 named Species. Values are width-bounded, compare-before-write, undoable and graph-owned. Emerald exposes verified cry ToneData and partial M4A tracks. `SOUND_EDITOR.md` now defines the arrangement-first product, separate GBA/Gen I/Gen II engines, native playback, instruments, safe command editing and structural-writing gates. The current workspace remains an inspector until track execution, synthesis and timeline editing land. |
| EDT-003 / GEN2-002 | **Partial (Crystal Species spine)** | The placeholder driver is removed. Exact Crystal manifests drive 251 names, 251 corrected 32-byte `BaseData` records, 251 four-bank Pokédex categories/measurements/descriptions, 251 six-byte `PokemonCries` records, 251 LZ3 front pictures/native palettes and writable progression/machine compatibility through a 2,821-node/12,230-edge graph. Measurements, fixed cries, verified BaseData fields, evolution/learnset/egg lists and all 60 compatibility flags are undoable; the four unused high bits and unknown/obsolete fields stay byte-identical. The fingerprinted real-ROM audit verifies every record, picture, relation and reversible edit/relocation. Back pictures, animation frames, additional Unown forms, recompression, deeper breeding semantics and cry channel streams remain open. |
| GEN2-005 | **Partial (exact progression + Move + Trainer editors)** | `Moves`, `MoveNames`, `TMHMMoves`, `EvosAttacksPointers`, `EggMovePointers`, `TrainerGroups`, `TrainerClassNames` and `TrainerPicPointers` are manifest-bound. Besides exact progression, the typed trainer library decodes 67 classes, 541 trainers, 1,254 party members and all four native party formats, contributing 1,385 explicit move references. Map opens typed trainers in Battle; Battle renders real party sprites and safely edits existing level/species/item/move fields; Move navigates inbound trainer references. Fixtures and the exact ROM audit prove reversible writes and the 4,683-node/16,664-edge combined graph. Effect/animation/audio command graphs, descriptions, trainer portraits/AI/rematches/phone, party relocation and GBA remain open. |
| GEN2-006 / EDT-014 | **Partial (exact Crystal Encounter Editor)** | Manifest roots decode 153 grass/water records, 39 rod documents, 12 common/rare Headbutt lists, Rock Smash, Contest, Raikou/Entei initialization/16-map route graph and all 17 direct constant `loadwildmon` commands: 224 documents and 2,486 displayed slots. The Map Editor now embeds the same driver and filters by the active group/map, with period/rate/slots and reversible edits in Map history. Static commands require the exact script symbol, relative opcode offset and unique map owner; the editor links to both map and script and changes only species/level operands. Source audit proves there is no `loadvarmon`; `randomwildmon` consumes selected table/runtime state. Fixtures and fingerprinted ROM audit prove counts, ownership, graph links and restoration; the combined graph is 7,780 nodes/23,018 edges. Save-state roamer state, runtime swarm selection, machine-code/state-derived battles and modifiers/simulation remain open. |
| GEN1-002 / EDT-014 | **Partial (exact Red/Blue Encounter Editor)** | Seven manifest roots drive all 248 wild pointers, the ten 256-based grass/water weights, Old/Good/Super Rod storage, all 33 Super Rod map associations, 12 typed static object battles and both signature-verified Snorlax payloads. The isolated provider exposes 107 documents/706 slots: 58 grass/water, 35 fishing and 14 static. The Map Editor now embeds that provider, filters exact map ownership and exposes global rod tables without inventing per-map ownership. Native rate/level/internal-Species writes are reversible in Map history; pointer/group aliases disclose every owner. Fixtures and exact Red/Blue audits prove both ROMs and the 4,398-node/10,359-edge graph. Old/Good Rod map eligibility, Repel/runtime scenarios, remaining state/machine-code contexts and simulation remain open. |
| DATA-008 | **Partial** | Modified/unpinned fingerprints retain Hex but stock semantic workspaces become Research. Compatible symbol/manifest import is still missing. |
| DATA-009 | **Partial** | Navigation/header badges and reports expose repository provenance. Exact manifests now show commit/build/symbol roots for Red, Blue, Crystal Rev 0 and Emerald Rev 0; resource/document-level citations remain open. |
| UX-003 | **Partial** | Standard badges and explanations appear in navigation/headers. Workspace records now name their source-backed resources and coverage, and reports embed that matrix; individual document/reference propagation remains open. |
| B0 / DATA-010 | **Partial** | Deterministic RGBDS/GNU parser, clean-checkout generator, four exact generated manifests, browser consumption, resource groupings and drift regression are complete. FireRed/Ruby/Sapphire/LeafGreen/Crystal Rev 1 plus table extents, counts, ownership and signature inventory remain open. |

## Web runtime and lifecycle

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| WEB-001 | P0 | Pokédex editor has a syntax error and cannot load. | All first-party scripts pass syntax/lint; GBA/Gen I/Gen II workspace-open tests pass. |
| WEB-002 | P0 | `FileHandler` failure can leave bootstrap pending. | Fragment/dictionary fetch-failure tests restore uploader and offer Retry. |
| WEB-003 | P0 | Rejected lazy assets remain cached. | A failed asset can retry without page reload; concurrent retry is single-flight. |
| WEB-004 | P0 | `romloaded` fires before base initialization is ready. | Delayed dictionary/Hex test proves no workspace is exposed before `projectready`. |
| WEB-005 | P0 | Battle/Pokédex/Sound/Animation lifecycles do not dispose all listeners. | Ten ROM replacements leave one action per click and no prior-generation reference. |
| WEB-006 | P1 | Editor descriptors/headers are hand-wired and inconsistent. | Registry generates navigation/header/help/history/bookmark/link/capability for every editor. |
| WEB-007 | P1 | Global loading errors lack one durable Problems surface. | Errors persist with resource, module, recovery action and Nerd details. |
| WEB-008 | P1 | Workspace failure rollback is not tested in a real browser. | E2E injects slow/failing workspaces and preserves last valid view/state. |
| WEB-009 | P2 | Global scripts depend on execution order and query-string variants. | ES-module dependency graph; duplicate module evaluation test; no undefined global startup errors. |
| WEB-010 | P2 | Large decoding/render work shares the main thread. | Worker jobs are cancellable/profile-scoped; performance budgets pass. |

## Truth, profiles and compatibility

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| DATA-001 | P0 | Header detection advertises more semantic support than exact profiles provide. | Enabled capabilities come only from an exact verified manifest. |
| DATA-002 | P0 | GBA asset profiles omit Ruby/Sapphire and are not uniformly language/revision keyed. | Separate hashed manifests exist; unprofiled workspaces/writes fail closed. |
| DATA-003 | P0 | Crystal revisions share fixed offsets without generated revision proof. | Rev 0/1 symbol manifests and signatures validate independently. |
| DATA-004 | P0 | Heuristic pointer/byte scans appear as semantic Battle/Animation content. | Ordinary editors show only verified tables; heuristics live in labeled read-only Research. |
| DATA-005 | P0 | Gen I internal species IDs are treated too much like Pokédex order. | Canonical mapping drives names, parties, cries, sprites, base data and Pokédex; MissingNo fixtures pass. |
| DATA-006 | P0 | No canonical resource graph connects repeated IDs/resources. | Every modeled resource exposes stable ID plus inbound/outbound references. |
| DATA-007 | P0 | Unknown/unmodeled bits are not governed by a universal rule. | No-op and single-field property tests preserve all unrelated bytes. |
| DATA-008 | P1 | Modified ROMs can inherit stock assumptions after only header recognition. | Modified ROM requires compatible profile/symbol import or read-only Research state. |
| DATA-009 | P1 | Profile provenance is not visible in documents. | Header/inspector displays repository, commit, manifest version, signatures and accuracy. |
| DATA-010 | P2 | No automated inventory compares modeled symbols/tables to pinned `pret`. | Generator emits covered/unmodeled resources and fails on unexplained drift. |

## Platform structure correctness

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| GBA-001 | P0 | One 24-byte map layout omits FRLG border dimensions. | Separate RSE/FRLG codecs round-trip official fixtures. |
| GBA-002 | P0 | Map-header flags are interpreted generically despite engine divergence. | Per-engine bitfield schemas preserve unknown bits and match source fixtures. |
| GBA-003 | P0 | FRLG object template normal/clone union is not modeled. | Both variants decode/edit/encode; conversion validates references. |
| GBA-004 | P0 | One event opcode table is presented across RSE/Emerald/FRLG. | Engine-specific command manifests/ASTs compile and round-trip all official commands. |
| GBA-005 | P1 | Duplicate legacy dimension parsing can truncate 32-bit values. | All paths use typed `s32`; boundary fixtures pass. |
| GEN1-001 | P0 | Gen I trainer two party formats are only partially semantic. | Both variants use canonical species identities and safe size/repoint plans. |
| GEN1-002 | P1 | Map table discovery is heuristic rather than manifest-backed. | Stock profile uses symbol tables; scanner is explicit Research-only fallback. |
| GEN1-003 | P1 | Gen I events are treated mainly as text rather than map script/assembly graph. | Script entry points, flags, trainers, text and native routines link symbolically. |
| GEN1-004 | P2 | SGB assets/palettes are not a distinct rendering/editing domain. | DMG/SGB previews and native write ownership are separated and golden-tested. |
| GEN2-001 | **Resolved for fixed records** | All four Crystal trainer-party variants round-trip, named teams render real Species sprites and typed map events navigate to Battle. | Variable party insertion/removal, trainer portraits, AI/rematches/phone and complete script ownership remain under the wider Trainer domain. |
| GEN2-002 | P1 | Cry schema and audio links are not decoded. | Cry index/pitch/length plus channel target resolve through Species. |
| GEN2-003 | P1 | LZ3 writing/allocation is incomplete. | Deterministic recompress/decode identity and relocation tests pass. |
| GEN2-004 | P1 | Time/day context is not shared by map, palette, encounter and save views. | One preview context drives all four and scenario tests cover transitions. |

## Mutation, history, allocation and export

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| MUT-001 | **Resolved** | One project-owned journal now orders every maintained semantic editor write; owner scopes provide filtered UI without creating independent histories. | Cross-editor tests prove ownership, filtering, blocked out-of-order local Undo and exact global Undo/Redo order. |
| MUT-002 | P0 | **Resolved:** project-owned `DraftRegistry` aggregates all registered editors and fails closed when enumeration breaks; export has no editor-name allowlist. | Preserve the registry contract as new draft-capable editors are added. |
| MUT-003 | **Resolved** | Stale Undo/Redo validates every affected range atomically and reports a conflict without changing ROM or view-model state; the shared journal also prevents editor-local history reordering. | Compare-before-undo and cross-editor conflict tests pass for fixed structures, layouts and relocated tables. |
| MUT-004 | P0 | A shared ledger now prevents protected/owned overlap and double reservation and imports all verified resource-graph ranges; unmodeled source regions still have no ownership extents. | Generated whole-ROM allocation ownership manifest populates every source extent before any plan; all protected/owned overlap and double-reservation tests pass. |
| MUT-005 | **Partial** | A versioned project validator gates both ROM and report export across schema, graph, allocation and artifact integrity. Exact Gen I/Crystal domains plus audited GBA Species/Pokédex/assets and Emerald Trainers register semantic providers; other GBA domains and gameplay/reopen checks are not yet complete. | Every modeled domain registers a validator; schema/domain/graph/allocation/export return zero errors and the validation result is visible before export. |
| MUT-006 | P1 | No deterministic ROM expansion/link policy. | Expanded ROM updates required size/header rules, references and reopens correctly. |
| MUT-007 | P1 | Relocation does not report/rewrite a comprehensive inbound reference set. | Plan lists and atomically updates every owner from the resource graph. |
| MUT-008 | P1 | No portable project/recovery format. | Versioned project reopens patch, manifests, bookmarks, state and validation without bundled ROM. |
| MUT-009 | P1 | Export success is not playability evidence. | Reopen plus selected emulator scenarios gate a “validated” artifact. |
| MUT-010 | P2 | Change reports explain bytes but not every semantic reason. | Each byte range links to transaction/resource/field or explicit raw patch. |

## Editor capability and data

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| EDT-001 | P0 | Synthetic Animation documents are presented under an editor name. | Real family decoder or explicit unsupported screen; no invented frames. |
| EDT-002 | P0 | Battle animations/scenes are heuristic or partial. | Verified table/command interpreter and native-source preview provenance. |
| EDT-003 | P0 | Crystal Pokédex remains a placeholder; Gen I is real but incomplete. | Crystal real entries/order/sprites/text/cries and Gen I growth/recompression complete; no generic substitutes. |
| EDT-004 | P0 | Sound is still list-first and only fixed cry records are writable. | Native headers and command control flow resolve into an arrangement occupying at least 50% of the workspace; family-accurate playback, channel/instrument inspection and validated fixed-width note/control editing work for one pinned GBA, Gen I and Gen II profile. |
| EDT-005 | P1 | GBA Pokédex exposes only a narrow field subset and incomplete names/profiles. | Species graph owns names, entries, assets, order and all writable fields. |
| EDT-006 | P1 | GBA trainer data is essentially Emerald-English-specific. | Profiled variants for supported titles/languages and exact named parties. |
| EDT-007 | P1 | Map omits complete encounters, region/fly, music/weather and story context. | Route workflow edits/validates all linked resources and runtime scenario. |
| EDT-008 | P1 | “Minimap” is not the actual Town/Region/Fly resource. | Native screen, landmarks, artwork, cursor and flypoints are decoded and editable. |
| EDT-009 | P1 | Sprite editor lacks full asset composition/compression/catalog. | Native dimensions, frames/OAM, palettes, import/export and safe recompression. |
| EDT-010 | P1 | Code CPU decoding/assembly/symbols are incomplete. | Complete platform instruction decode, symbol/xref view and clearly bounded writer. |
| EDT-011 | P1 | No Species editor. | Cross-table Species document passes platform acceptance in editor catalog. |
| EDT-012 | **Partial** | Move Editor has exact Red/Blue, Crystal and Emerald fixed-record vertical slices; Generation III effect/TM/HM/learnset/audio ownership and semantic command graphs remain missing. | Data/effect/learnset/animation/audio links and writers pass. |
| EDT-013 | P1 | No complete Trainer editor. | Map event to named party/battle workflow passes. |
| EDT-014 | **Partial** | The Map Editor embeds the shared exact Red/Blue and Crystal Encounter drivers, filters them by active map and records edits in Map history; the all-table workspace remains a secondary browser. | Add Old/Good Rod map-eligibility context, save-state roamer state, remaining runtime/state-derived contexts and sampling, plus an isolated GBA driver. |
| EDT-015 | P1 | Item records are not a complete Item/Economy editor. | Items, effects, graphics, shops and references pass. |
| EDT-016 | P2 | No Save data editor. | Family checksums/redundancy/encryption plus load-save-reset test passes. |
| EDT-017 | P2 | No UI/font/title/credits screen editor. | Profile inventory and pixel-golden key screens pass. |
| EDT-018 | P3 | Game-specific systems lack extension editors. | Each exact profile’s generated inventory has no unexplained unmodeled table. |
| EDT-019 | P1 | No Project Overview or task-oriented starting point. | Exact profile, safe tasks, recent resources, changes, validation, Test and Export are available without opening Hex. |
| EDT-020 | P1 | No dedicated Evolutions/Learnsets editor. | Every native evolution/learnset variant round-trips and reverse references update through Species. |
| EDT-021 | P1 | Town/Region/Fly resources have no real editor. | Native artwork/tilemap, landmarks, cursor, unlocks and destinations render and validate in game. |
| EDT-022 | P1 | Tileset/metatile/palette work is embedded in Map/raw Sprite paths. | Shared catalog edits composition, collision/behavior, palettes and animation with ownership-aware writes. |
| EDT-023 | P1 | Text/localization has no project-wide catalog. | Search, references, encoding limits, preview, relocation and per-language validation cover every string owner. |
| EDT-024 | P1 | Battle Rules/AI is not a semantic domain. | Effects, formulas, type chart, status, AI and battle scripts expose exact source-backed documents and traces. |
| EDT-025 | P2 | No Changes/Problems/Validation workspace. | Every transaction and diagnostic is durable, navigable, profile-scoped and included in export decisions. |
| EDT-026 | P2 | No Profile/Symbol/Schema workspace for expert projects. | Nerd users can inspect/import/build compatible manifests with signatures, owners and capability consequences. |
| EDT-027 | P2 | Gift/trade/shop/pickup resources are scattered script/item details. | Resource views edit named offers/inventories/rewards and validate every map/script/item/species link. |
| EDT-028 | P2 | Emulator is not a semantic cross-family debugger. | GB/GBC/GBA runtime bridge maps project resources to watches, refresh/restart rules, saves and deterministic scenarios. |

## Information architecture and normal-user UX

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| UX-001 | P1 | A normal user lands in Hex. | Project Overview opens with supported tasks, changes and validation state. |
| UX-002 | P1 | Flat editor list will not scale to complete game data. | Grouped resource navigator, command palette, recent/favorites and breadcrumbs. |
| UX-003 | P1 | Capability/accuracy/writability is ambiguous. | Standard badges and explanations appear in nav/header/document/export. |
| UX-004 | P1 | Simple mode is mostly a visibility filter. | Task-oriented forms/presets/previews exist over the same Nerd document. |
| UX-005 | P1 | Normal trainer/species/move workflows expose raw numeric IDs. | Searchable named resources with valid profile ranges; IDs remain optional Nerd detail. |
| UX-006 | P1 | Bookmarks/links omit meaningful state for newer editors. | Every document serializes/restores one stable typed resource reference. |
| UX-007 | P1 | No global Changes/Problems view. | Both panels navigate to resources and explain recovery/impact. |
| UX-008 | P2 | Floating panels use absolute positions and limited persistence/docking. | Responsive dock/drawer layouts persist and clamp after resize/focus. |
| UX-009 | P2 | Forms group fields by storage/order more than task meaning. | Schema UI groups coordinates/references/text, supports spans and named enums. |
| UX-010 | P2 | Errors/notifications do not consistently teach recovery. | Simple recovery action plus durable Nerd diagnostics and copyable context. |
| UX-011 | P1 | Visual editors can give most of the workspace to setup panels, lists or inspectors. | The visual result retains at least 50% of usable space at wide, narrow, focus and full-screen breakpoints; Battle is full-width with its controls below, and toolbar/panel orientation follows its dock edge. |
| UX-012 | P1 | Editor-local markup and SCSS can duplicate or diverge from the shared material system. | New UI composes shared components; editor styles only own layout and intrinsic domain geometry; duplicated patterns move to `scss/components/`; interaction states remain consistent across every editor. |
| ARCH-003 | P0 | Similar GBA and GB/GBC formats can be combined into universal codecs or hidden inside an editor. | Shared modules contain contracts/registries only; `gba/`, `gbc/` and differing `gen2/` modules own all binary logic; reusable ROM resources such as fonts have no dependency on an editor. |

## Accessibility, responsive and interaction

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| A11Y-001 | P1 | Page language does not match UI and main landmarks are nested. | HTML/landmark validator passes with one page `main` and correct locale. |
| A11Y-002 | P1 | No viewport meta and narrow layouts remove controls. | 320/375/768/1024/1440 E2E keeps every operation reachable. |
| A11Y-003 | P1 | Menus/tabs do not implement complete keyboard patterns. | APG-style arrow/Home/End/Escape/typeahead tests pass. |
| A11Y-004 | P1 | Map/Sprite canvas editing is pointer-centric. | Keyboard cursor/actions and semantic object/event list provide parity. |
| A11Y-005 | P1 | Dialogs lack consistent accessible naming/focus/dismiss policy. | Named dialogs restore focus and protect dirty forms; modal suite passes. |
| A11Y-006 | P1 | Notifications lack durable/live semantics. | Status/alert announcements, pause/persist/details and Problems panel pass. |
| A11Y-007 | P2 | Several targets are below comfortable touch size. | WCAG 2.2 target-size audit and preferred 44×44 touch profile pass. |
| A11Y-008 | P2 | Reduced motion, forced colors and enhanced contrast are absent. | Media-mode screenshots and contrast checks pass without color-only state. |
| INPUT-001 | P1 | Map and Sprite do not share one exact viewport gesture model. | Mouse/trackpad/pinch/keyboard preserve the point under the gesture. |
| INPUT-002 | P1 | Pointer cancel/lost capture can leave drag state. | Cancellation/lost-capture tests end every gesture cleanly. |
| INPUT-003 | P1 | Fullscreen/layout resize does not continuously resize every canvas/camera. | ResizeObserver-based test preserves world point, selection and panels. |

## Testing, security and delivery

| ID | Pri | Finding | Acceptance evidence |
| --- | --- | --- | --- |
| QA-001 | P0 | Green tests rely partly on source-string assertions and miss a syntax-broken editor. | Behavioral syntax/component/integration layers catch the known failure. |
| QA-002 | P1 | No browser E2E across Chromium/Firefox/WebKit. | Required load/edit/undo/export/reopen journeys pass all three. |
| QA-003 | P1 | No visual golden suite. | Native maps/sprites/battle/Town Map/animation screens pass DPR goldens. |
| QA-004 | P1 | No accessibility CI/manual gate. | Automated audit plus keyboard/screen-reader scripts pass. |
| QA-005 | P1 | No cross-device gesture matrix. | Mac/Windows trackpad, mouse, touchscreen and keyboard cases pass. |
| QA-006 | P1 | No emulator gameplay gate. | Profile scenarios from boot through representative progression pass. |
| QA-007 | P1 | No malformed-ROM/property/fuzz layer. | Bounded parser failures remain atomic and responsive under generated inputs. |
| QA-008 | P2 | No CI/lint/static types/coverage/release workflow. | Required jobs and thresholds run on every change. |
| SEC-001 | P1 | External Font Awesome CDN breaks offline/local privacy claim. | Reviewed icon subset is local; offline page makes no required network call. |
| SEC-002 | P1 | No documented CSP/untrusted input limits. | CSP plus ROM/JSON/Markdown/decompression size/schema tests pass. |
| SEC-003 | P2 | Dependency/license/SBOM state is incomplete. | Pinned inventory, notices, license scan and SBOM ship with release. |
| PERF-001 | P2 | No performance/leak budgets. | Time-to-ready, map frame, memory, long-session and replacement-leak budgets pass. |

## Completion rule

An item may be closed only with:

1. code or documentation change;
2. automated evidence at the correct layer;
3. exact profile(s) covered;
4. a user-visible capability/status change;
5. updated platform audit/compatibility matrix;
6. no regression in global validation or emulator scenarios.
