# Project status

> Evidence snapshot: 2026-07-31 01:41 KST
> Implementation baseline: `764efc4fa9cbfb498d685c3d90f6fe8156b169b4`
> (`Inspect ROM project profiles`)
> The documentation update itself is intentionally not included in that
> implementation hash.

PUSH is an experimental, local Pokémon ROM authoring environment with several
credible, bounded editing paths. It is **not** a complete GB/GBC/GBA game
studio. No profile currently has complete semantic coverage, complete native
audio/animation execution, a complete ownership-aware linker, or an
emulator-backed proof for every editable domain.

The status words in this document use
[CAPABILITY_MODEL.md](CAPABILITY_MODEL.md):

- **Verified** means an exact profile and a bounded operation have structural
  or round-trip evidence.
- **Partial** means only the stated subset is supported.
- **Research** is not exposed as an ordinary semantic editor.
- **Unavailable** means no safe implementation is registered.

“Verified editor” never means “the complete game domain is finished.” It means
the bounded operations stated in the capability record are verified.

## Documentation authority

When two documents disagree, use this order:

1. Current code, generated manifests, and freshly executed test/audit output.
2. This status snapshot and [EDITOR_MATRIX.md](EDITOR_MATRIX.md).
3. [ARCHITECTURE.md](ARCHITECTURE.md),
   [CAPABILITY_MODEL.md](CAPABILITY_MODEL.md),
   [COMPATIBILITY.md](COMPATIBILITY.md), and
   [UX_GUIDELINES.md](UX_GUIDELINES.md).
4. Family audits and individual editor guides.
5. [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md) and
   [AUDIT_BACKLOG_2026.md](AUDIT_BACKLOG_2026.md).
6. Dated audits and implementation-pass notes. These are historical evidence,
   not current capability declarations.

In particular, older audit statements that call Animation “disabled,”
“Research,” or a synthetic scaffold have been superseded by the current
capability manifest and native decoder tests. Animation remains **Partial**,
not Verified.

## Last validation

The following checks were executed against the baseline commit above:

| Check | Result | Scope and limitation |
| --- | --- | --- |
| `npm run test:syntax` | PASS — 228 first-party scripts | Syntax only. |
| `npm run test:boundaries` | PASS — 16 shared modules and 103 isolated family modules across 3 groups | Proves the enforced dependency rules covered by the boundary script; it does not prove every codec is correct. |
| `node --test test/*.test.mjs` | PASS — 372/372 tests | Unit, structure, manifest, editor-contract, and bounded integration fixtures. It is not a browser, visual-golden, or gameplay proof. |
| `npm run audit:capabilities -- <Blue> <Emerald> <FireRed Rev 1>` | PASS for all three supplied local ROMs | Confirms whole-ROM fingerprint routing and fail-closed workspace states. It does not mutate or boot the ROMs. |
| `npm run audit:rom -- <Blue> <Emerald> <FireRed Rev 1>` | PASS for all three supplied local ROMs | Performs bounded map/script/sprite/species/move checks and restores reversible edits byte-exactly. It is not a complete-domain or gameplay proof. |
| Generated/project manifest, direct symbol-parser, and Profile workspace tests | PASS inside the automated suite | Browser registry matches the five committed manifests; project manifests remain fingerprint-bound and fail closed; RGBDS and GNU parsing select only complete family resource groups; live modeled and semantic-write percentages union verified ranges over the actual ROM size and exclude raw Hex access. |
| Browser/device matrix | Not executed for this snapshot | Desktop, tablet, mobile, keyboard, pointer, and gesture usability remain unproven at this commit. |
| Visual golden suite | Not implemented | Native rendering claims rely on codec/structure tests and previous manual evidence, not a maintained screenshot gate. |
| Export/import/Undo audit | PASS for Blue, Emerald, and FireRed Rev 1 | The bounded audit restores the complete in-memory ROM exactly; it does not boot the exported result. |
| Emulator gameplay scenarios | Not executed for this snapshot | Emulator workspaces are Partial. No deterministic boot/progression/battle gate was run here. |

## Exact profile evidence

| Profile | Whole-ROM SHA-1 | Generated source manifest | Upstream source |
| --- | --- | --- | --- |
| Red, English reference | `ea9bcae617fdf159b045185467ae58b2e4a48b9a` | `manifests/generated/gen1-red.json` | `pret/pokered` at `405b6246372d7e5a2cb029cbb65219b13286b8c9` |
| Blue, English reference | `d7037c83e1ae5b39bde3c30787637ba1d4c48ce2` | `manifests/generated/gen1-blue.json` | `pret/pokered` at `405b6246372d7e5a2cb029cbb65219b13286b8c9` |
| Crystal, English Rev 0 reference | `f4cd194bdee0d04ca4eac29e09b8e4e9d818c133` | `manifests/generated/gen2-crystal.json` | `pret/pokecrystal` at `3438c7003a57fa2987fcb223d14b660761b33c64` |
| Emerald, English Rev 0 reference | `f3ae088181bf583e55daf962a92bb46f4f1d07b7` | `manifests/generated/gen3-emerald.json` | `pret/pokeemerald` at `83df84e40623b79281f2397faa611cbf044170bd` |
| FireRed, English Rev 1 | `dd5945db9b930750cb39d00c84da8571feebf417` | `manifests/generated/gen3-firered-rev1.json` | `pret/pokefirered` at `df4449a27cd78dd747ce269e47d3ab4a0149d8f4` |

Red, Blue, Crystal, Emerald, and FireRed manifests currently pin selected table roots.
They do not yet describe all counts, extents, pointer kinds, owned ranges,
signatures, or every resource in their games.

Crystal Rev 1, Ruby, Sapphire, LeafGreen, other languages/revisions, and ROM
hacks do not have equivalent generated manifests. Selecting a base engine for
an unknown hack selects the runtime only; it must not grant the stock semantic
addresses.

## Current capability summary

The operation-level details and blockers are in
[EDITOR_MATRIX.md](EDITOR_MATRIX.md).

### Red and Blue

- **Verified bounded workspaces:** Hex, Code, Map, and Sprite.
- **Partial workspaces:** Battle, Pokédex, Moves, Sound, Animation,
  Encounters, Items, and Emulator.
- Battle supports existing trainer-party formats but not complete resizing,
  AI, animation, or battle-engine simulation.
- Pokédex/Species joins exact native resources and has selective writers;
  deterministic picture recompression and unrestricted bank growth are not
  complete.
- Sound writes exact cry parameters and resolves map-song references, but does
  not execute or write the complete audio program.
- Animation decodes native move roots and exact visual resources, but does not
  provide a verified general writer or complete special-effect execution.

### Crystal Rev 0

- **Verified bounded workspace:** Hex.
- **Partial workspaces:** Code, Map, Sprite, Battle, Pokédex, Moves, Sound,
  Animation, Encounters, and Emulator.
- **Unavailable:** Items, because a dedicated Gen II item driver is not
  implemented.
- Trainer, Species/progression, Move, cry, and Encounter fixed/owned records
  have meaningful compare-before-write paths. Code, Map, and Sprite remain
  read-only at the workspace capability layer until a stock-ROM
  edit/export/reload audit proves their complete boundary.
- Native animation command flow is decoded only for the documented subset;
  complete tilemap/palette/object composition and writing remain incomplete.

### Emerald Rev 0

- **Verified bounded workspaces:** Hex, Code, Map, and Sprite.
- **Partial workspaces:** Battle, Pokédex, Moves, Sound, Animation,
  Encounters, Items, and Emulator.
- The exact `pret/pokeemerald` build was reproduced at the pinned commit and
  produced the reference ROM SHA-1. Its linker map now supplies
  `gWildMonHeaders`, `gObjectEventGraphicsInfoPointers`, `gItems`, and
  `gItemIconTable`; Encounter and Item no longer depend on historical stock
  fallback addresses for capability promotion.
- Move and Animation support is tied to verified table roots, but effect/audio
  graphs, arbitrary visual tasks, callbacks, and complex scene writers remain
  incomplete.
- Sound reads the bounded M4A catalog and native WaveData subsets; it does not
  yet mix and safely rewrite the complete M4A engine.
- Battle renders profiled native resources but is not a faithful full battle
  engine or AI simulator.

### FireRed Rev 1

The capability audit correctly returns:

- **Verified bounded workspaces:** Hex, Code, Map, and Sprite.
- **Partial workspaces:** Battle, Pokédex, Moves, Sound, Animation, Items, and
  Emulator.
- **Unavailable:** Encounters. Its table root is pinned, but the FireRed
  implementation has not passed an isolated fixed-record round trip, so the
  ordinary editor stays closed.
- The real-ROM audit decoded a 14×9 map with five events, six script commands,
  152 overworld sprites, the 411-entry Species catalog with Front/Back/Menu
  icon resources, and 354 moves; its bounded edit/export/import/Undo cycle
  restored the complete ROM exactly.
- Battle party writing remains Emerald-specific. FireRed Sound lacks a
  complete named song/map catalog and native mixer. FireRed Animation is
  read-only and does not execute the complete engine scene.

## Foundations with current automated evidence

- Complete-ROM fingerprint routing and fail-closed Research behavior.
- Deterministic source-manifest generation and browser-registry mirroring.
- Enforced shared/GBA/Gen I/Gen II module boundaries.
- A central `EditorCapabilityGuard` that disables unsupported write controls
  and rechecks capability immediately at command/write boundaries.
- Checked memory reads, compare-before-write commands, project Undo/Redo,
  protected allocation ranges, relocation primitives, checksum repair, and
  export validation infrastructure.
- A typed resource graph with stable IDs, ranges, resolved/unresolved
  references, confidence, and rewrite policy.
- Shared editor descriptors, cross-editor links, project invalidation events,
  tables, pixel canvases, panels, split views, and interaction contracts.
- Family-specific map, text/script, sprite, trainer, Species/progression, Move,
  Encounter, Sound, and Animation subsets covered by the tests named in
  [EDITOR_MATRIX.md](EDITOR_MATRIX.md).

These foundations are reusable infrastructure. They do not prove complete
content coverage or playability.

## Known partial or unproven areas

- Generated manifests cover roots, not a complete resource ownership graph.
- Workspace promotion is now isolated by family, editor, fingerprint, pret
  repository/commit, and required resource groups. Emerald now declares exact
  Encounter, Item, and Overworld Sprite roots. A missing group in another
  profile still fails only its dependent workspace closed.
- Relocation is bounded and domain-specific, not a complete ROM linker.
- Simple and Nerd share documents, but task completeness and accessibility
  have not been revalidated across the required device matrix.
- Native previews are not protected by a current visual-golden suite.
- Sound playback is incomplete for GB/GBC channel programs and GBA M4A mixing.
- Animation visual execution and writing are incomplete across all families.
- Battle, save-state-dependent encounters, AI, weather, field effects, and
  progression are not simulated as a complete game runtime.
- The emulator is not yet a semantic cross-family debugger and has no
  deterministic gameplay gate.
- Exact JSON source-manifest import for intentional ROM hacks is implemented:
  it validates the loaded ROM SHA-1, selected engine, platform, source
  provenance, symbol bounds, and resource ownership; persists by fingerprint;
  and revalidates on every load. Imported dictionaries are deliberately
  read-only and do not inherit stock operation audits. Direct RGBDS `.sym` and
  GNU linker `.map` import now shares one parser with the CLI and promotes only
  complete known resource groups. The shared Profile & Resources workspace now
  exposes identity, provenance, independent editor capabilities, resource
  groups and exact source symbols, calculates live ROM-byte, resource, and
  system write coverage from the active graph, and can export/remove browser
  project manifests. Compatible
  per-workspace operation audits remain incomplete.

## Missing product domains

The following required surfaces are absent or exist only as fragments inside
another editor:

- Project Overview and task-oriented project home.
- Dedicated Species and Trainer/Party editors.
- Dedicated Text/Localization catalog.
- Dedicated Tileset/Metatile/Palette editor.
- Dedicated Evolution/Learnset editor.
- Battle Rules, formulas, Types, Abilities, Status, and AI.
- Shop, gift, trade, pickup, economy, and reward editors.
- Save Data, party/box/bag/flags/RTC authoring.
- UI, HUD, font, window-frame, title, intro, cutscene, credits, and screen
  composition editors.
- Changes, Problems, Validation, and Export workspace.
- Game-specific extensions such as contests, berries/soil, secret bases,
  decorations, phone/radio, Unown, Battle facilities, minigames, and link
  systems.

Fragments must not be counted as complete editors. Their current disposition
is recorded in the final section of [EDITOR_MATRIX.md](EDITOR_MATRIX.md).

## Immediate priorities

1. Make `EDITOR_MATRIX.md` mechanically derivable from manifests,
   `CapabilityManifest`, executed tests, and validation artifacts.
2. Extend Profile & Resources with compatible per-workspace audits on top of
   the fail-closed JSON and direct `.sym`/`.map` importers.
3. Extend manifests with counts, extents, pointer kinds, ownership, and
   structural signatures; then complete the resource graph by family.
4. Finish one coherent authoring spine per family with export/reopen and
   emulator proof before expanding UI breadth.
5. Add browser E2E, accessibility, device/gesture, visual-golden, malformed-ROM,
   and deterministic emulator scenario gates.
6. Complete native Sound and Animation execution before enabling broad writers.
7. Implement the missing project, validation, profile, save, and
   game-specific domains listed above.

The persistent goal remains active until the acceptance criteria in
[PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md) are proven for every
supported exact profile.
