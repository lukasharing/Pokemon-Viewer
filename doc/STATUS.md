# Project status

> Evidence snapshot: 2026-07-31 05:17 KST
> Implementation baseline: `28297af491269cda0b539c3485ceb6c37231e3dd`
> (`Generalize GBA trainer contracts`)
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
| `npm run test:syntax` | PASS — 232 first-party scripts | Syntax only. |
| `npm run test:boundaries` | PASS — 16 shared modules and 104 isolated family modules across 3 groups | Proves the enforced dependency rules covered by the boundary script; it does not prove every codec is correct. |
| `node --test test/*.test.mjs` | PASS — 405/405 tests | Unit, structure, manifest, manual-contract authority, editor-contract, native animation composition, and bounded integration fixtures. It is not a browser, visual-golden, or gameplay proof. |
| `npm run audit:capabilities -- <Blue> <Emerald> <FireRed Rev 1>` | PASS for all three supplied local ROMs | Confirms whole-ROM fingerprint routing and fail-closed workspace states. It does not mutate or boot the ROMs. |
| `npm run audit:rom -- <Blue> <Emerald> <FireRed Rev 1>` | PASS for all three supplied local ROMs | Performs bounded map/script/sprite/species/trainer/move checks and restores reversible edits byte-exactly. Emerald decoded 855 trainers/1,825 party members; FireRed decoded 743/1,754. It is not a complete-domain or gameplay proof. |
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

Reviewed manual knowledge is now a versioned engine contract with pinned
`pret` review commits. Its machine-readable policy grants no address or
compatibility authority and requires an operation audit before a writer can
be promoted. The generator rejects absolute ROM identity inside this layer;
Profile & Resources exposes the active policy in Nerd mode.

## Current capability summary

The operation-level details and blockers are in
[EDITOR_MATRIX.md](EDITOR_MATRIX.md).

### Red and Blue

- **Verified bounded workspaces:** Hex, Code, Map, and Sprite.
- **Partial workspaces:** Battle, Pokédex, Moves, Sound, Animation,
  Encounters, Items, and Emulator.
- Battle supports existing trainer-party formats but not complete resizing,
  AI, animation, or battle-engine simulation.
- Battle HUD graphics no longer use stock fallback offsets. Red and Blue
  manifests now own the exact native HUD, status/HP, text-box and party-ball
  roots plus reviewed byte extents. A derived hack must provide all four roots
  from its own symbols before this resource group is available.
- The shared Gen I font renderer now resolves `FontGraphics` through the
  active memory profile. Battle, Sprite and Animation therefore use the
  loaded ROM's 1bpp glyph table; a relocated hack font is supported by its own
  symbol and never silently reads the retail Blue address.
- The Gen I Map driver now requires both `MapHeaderPointers` and
  `MapHeaderBanks` from the active profile. It no longer assumes the retail
  `0x1AE` pointer table or guesses a bank table for an unidentified hack.
- Pokédex/Species joins exact native resources and has selective writers;
  deterministic picture recompression and unrestricted bank growth are not
  complete.
- Sound writes exact cry parameters and resolves map-song references, but does
  not execute or write the complete audio program.
- Animation decodes native move roots and exact visual resources, but does not
  provide a verified general writer or complete special-effect execution.
  Red/Blue subanimations now apply the attacker-side transform selection and
  hardware OAM origins used by `pokered`, rather than treating the stored
  transform as unconditional.

### Crystal Rev 0

- **Verified bounded workspace:** Hex.
- **Partial workspaces:** Code, Map, Sprite, Battle, Pokédex, Moves, Sound,
  Animation, Encounters, Items, and Emulator.
- Items now resolves all 255 usable names, native description pointers, and
  exact seven-byte attributes through an isolated Gen II driver. Fixed
  attributes are writable; shops, effect programs, text relocation, and
  Gen II-specific item systems remain incomplete.
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
  graphs, arbitrary visual tasks, most callbacks, and complex scene writers
  remain incomplete. The exact Emerald symbol dictionary now names global
  sprite templates and seven bounded hit/impact callback contracts. Their
  anchors, offsets, affine programs and lifetimes execute without treating
  arbitrary callback arguments as coordinates; unresolved callbacks remain
  visibly partial.
- Animation objects are now mounted into the family battle scene before the
  native overlays, HUD and text box, so move particles cannot paint over the
  health boxes. Callback adapters distinguish fixed battler coordinates from
  picture-adjusted coordinates. Bullet Seed follows its exact deterministic
  20-tick flight and stops before the RNG-dependent rebound. Petal Dance now
  uses the correct coordinate spaces and per-tick path, but remains Partial
  until the renderer models its native per-frame battler subpriority changes.
- Sound reads the bounded M4A catalog and native WaveData subsets; it does not
  yet mix and safely rewrite the complete M4A engine.
- Battle renders profiled native resources but is not a faithful full battle
  engine or AI simulator.
- Trainer data now combines the exact `gTrainers` manifest root with a
  reviewed, offset-free Generation III ABI. All 855 headers and 1,825 party
  members decode on the supplied ROM; existing level, Species, held-item and
  custom-move fields are writable through exact per-format ranges. Header
  metadata, format conversion, party resizing, AI editing and repointing
  remain unavailable.

### FireRed Rev 1

The capability audit correctly returns:

- **Verified bounded workspaces:** Hex, Code, Map, and Sprite.
- **Partial workspaces:** Battle, Pokédex, Moves, Sound, Animation,
  Encounters, Items, and Emulator.
- Encounters now uses a FireRed-specific, offset-free engine contract plus
  the fingerprint-bound `gWildMonHeaders` address. The supplied Rev 1 ROM
  exposes 132 headers, 227 grass/surfing/Rock Smash/fishing documents and
  2,176 slots; fixed rate/species/level edits restore byte-exactly.
- Generation III Encounter field positions, ABI padding, pointer types,
  terminator, method counts and native weights now come through
  `MemoryProfile.structure(...)` from reviewed manual engine knowledge. The
  parser contains no stock encounter offsets or private record layout.
- The real-ROM audit decoded a 14×9 map with five events, six script commands,
  152 overworld sprites, the 411-entry Species catalog with Front/Back/Menu
  icon resources, 743 trainers with 1,754 party members, 354 moves, and 227
  encounter documents; its bounded edit/export/import/Undo cycle restored
  the complete ROM exactly.
- FireRed trainer parties now use the same family API as Emerald but the
  independent FireRed manual ABI and exact FireRed address. Existing fields
  are writable; class labels remain generic until a FireRed-specific name
  table is reviewed. Party resizing, AI editing and repointing remain
  unavailable. FireRed Sound lacks a complete named song/map catalog and
  native mixer. FireRed Animation is read-only and does not execute the
  complete engine scene.

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
  complete known resource groups. Reviewed roots can also be declared manually
  for one exact fingerprint; their origin, kind and optional byte extent stay
  explicit, partial groups remain incomplete, and manual/mixed dictionaries
  never inherit stock write audits. The shared Profile & Resources workspace now
  exposes identity, provenance, independent editor capabilities, resource
  groups and exact source symbols, calculates live ROM-byte, resource, and
  system write coverage from the active graph, and can export/remove browser
  project manifests. Compatible
  per-workspace operation audits remain incomplete.
- Source dictionaries now preserve exact GNU sized-symbol extents and reviewed
  count, stride, pointer-encoding and ownership metadata. The browser registry
  is generated from the five fingerprinted JSON artifacts with
  `npm run manifest:sync`; it no longer owns an independently edited address
  catalog. The same command now generates four family/profile-specific,
  offset-free manual engine contracts, including nested binary structures and
  engine constants. Hacks can reuse reviewed schemas, structure layouts and
  resource membership while supplying their own fingerprint-bound symbols;
  stock addresses and write audits are never inherited. Audited fixed move
  tables are typed for Red/Blue, Crystal, Emerald
  and FireRed, together with the verified Emerald/FireRed trainer, item,
  evolution, name and move-animation pointer tables.
- Emerald intro, title, bag and Trainer Card badge sheets now resolve through
  four independent manifest resource groups. Their reusable manual catalog
  contains relationships, compression and tile layout only; all addresses
  come from the active profile. The previous consumer-owned retail offsets
  were removed, and the title Rayquaza palette now resolves from the exact
  `gTitleScreenBgPalettes + 0x1C0` subpalette. These are native constituent
  sheets, not complete scene execution.
- Exact sized symbols now seed a read-only manifest resource graph at ROM load.
  Bundled fingerprint-verified ranges contribute modeled-byte coverage and
  allocation protection before an editor opens. Project/manual symbols remain
  partial and cannot inflate verified coverage or authorize writes.

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
3. Extend manifests with structural signatures and complete the semantic
   resource graph by family on top of the typed read-only range baseline.
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
