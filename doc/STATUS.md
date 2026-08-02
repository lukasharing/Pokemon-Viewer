# Project status

The Animation Editor now exposes Crystal's complete 278-entry native battle
animation table contract: 251 moves, three preserved reserved indices and 23
real engine programs for ball/send-out transitions, status and damage effects.
They reuse the exact Gen II command interpreter and remain independent from
the GBA implementation. The Emerald Animation Editor also exposes the complete native move, status,
general and special pointer-table catalogs. This adds the 23 engine-general
and 7 engine-special programs (weather, held items, switching, Poké Ball and
substitute transitions) without pretending their runtime-only arguments are
known. It also replaces the misleading intro-sheet playback
with one ROM-composited 240×160 Groudon/Kyogre/Rayquaza scene. Discovery is
anchored to the fingerprinted manifest and the exact `intro_scene.h` LZ block;
the renderer fails closed when a hack no longer matches it. Major timing and
layers are available, while scanline/OBJ/audio task simulation remains partial.

## 2026-08-01 continuation

- Heavy editor startup now uses one revisioned `EditorRenderPipeline`: Pokédex,
  Moves, Sound and Animation paint their primary workspace first, then decode
  related graphics, reverse references, cries, progression and catalogs in
  cancellable paint/idle phases. A shared accessible spinner material reports
  those secondary phases. Eager constructor graph builds were removed from
  the affected family drivers; GBA move references now scan in yielding chunks
  and cache per move. The complete workspace audit and remaining performance
  gates are recorded in [EDITOR_PERFORMANCE_2026.md](EDITOR_PERFORMANCE_2026.md).
- Generalized Animation discovery around a family-neutral entry-provider
  contract. A malformed resource now produces an isolated diagnostic instead
  of removing a whole domain. Red/Blue exposes its complete 165-move table
  plus 86 independently inspectable native subanimations; Crystal additionally
  exposes 188 native battle-object components. Generation III derives its
  standalone effects from verified `createsprite` invocations found while
  decoding the complete move/status tables, so relocated templates and their
  real argument tuples replace a manually maintained effect list. GBA, Gen I
  and Gen II still own separate codecs, pointer rules and writers.
- Simple visual programs now render every decoded operand as its own typed
  input node connected to the operation's matching input port. Control-flow
  edges remain separate, so the graph reads as data inputs → operation →
  execution output rather than one alternating chain.
- Animation links now use one family-neutral document contract based on stable
  identity, domain or typed references. Invalid links fail closed instead of
  silently selecting the first move; legacy move/species links remain adapters.
- Validation for this continuation passes 490 automated checks, family
  boundaries for 110 isolated modules, and the supplied Pokémon Blue ROM audit
  (226 maps, reversible edit/export/import and valid checksums). Browser and
  visual-golden validation remain outstanding.

## 2026-07-31 continuation

- Fixed the GBA Animation Driver bootstrap regression where the scene-catalog
  path referenced an undeclared `root` namespace. The driver now owns an
  explicit `PokemonViewer` root and the GBA runtime requests cache version 21.
- Profile & Resources now has an **Engine rules** view. It exposes reviewed,
  offset-free manual structure schemas, table shapes, invariants and resource
  membership separately from exact fingerprint-bound symbols. This preserves
  necessary manual engine knowledge without treating it as address or write
  authority.
- The long-running completion goal remains open. Complete animation
  simulation/writers, native sound-engine execution, semantic emulator proof,
  the broader editor catalog, responsive/browser QA and visual golden coverage
  remain incomplete.

> Evidence snapshot: 2026-07-31 15:39 KST
> Implementation baseline: `f3abb84e87623f4f4a39eb79f121dc076f002adb`
> (`Expose reviewed engine rules`)
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
| `npm run test:syntax` | PASS — 240 first-party scripts | Syntax only. |
| `npm run test:boundaries` | PASS — 16 shared modules and 109 isolated family modules across 3 groups | Proves the enforced dependency rules covered by the boundary script; it does not prove every codec is correct. |
| `node --test test/*.test.mjs` | PASS — 490/490 tests | Unit, structure, manifest, manual-contract authority, editor-contract, native animation composition, interaction-target accessibility, battle-direction semantics, and bounded integration fixtures. It is not a browser, visual-golden, or gameplay proof. |
| `npm run audit:capabilities -- <Blue> <Emerald> <FireRed Rev 1>` | PASS for all three supplied local ROMs | Confirms whole-ROM fingerprint routing and fail-closed workspace states. It does not mutate or boot the ROMs. |
| `npm run audit:rom -- <Blue> <Emerald> <FireRed Rev 1>` | PASS for the audited supplied ROMs | Performs bounded map/script/sprite/species/trainer/move checks and restores reversible edits byte-exactly. Emerald additionally validates all 39 status/general/special engine programs through their native pointer tables, 855 trainers/1,825 party members and 504/771 decoded visual-task commands. The audit also validates the 27-record native animation-background table. `--animation-tasks` groups remaining task pointers, moves and argument signatures for source review without promoting them to supported behavior. It is not a complete-domain or gameplay proof. |
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

Move record layouts are no longer embedded in editor classes. Red/Blue,
Crystal and GBA consume independent `Gen1Move`, `Gen2Move` and `GbaMove`
contracts (6, 7 and 12 bytes respectively, with family-specific accuracy
scales and fields). These contracts are offset-free; exact manifests or a
hack's imported symbols still own addresses and counts. Writers preserve
undeclared bytes and missing contracts fail closed.

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
  transform as unconditional. Crystal applies its exact rival-coordinate
  transform only to objects carrying the native `FIX_COORDS` bit. Emerald
  keeps attacker/target semantic until composition, so side-sensitive
  callbacks, palettes, filters and visibility resolve to the correct physical
  battler instead of mirroring the completed canvas.

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
- POUND, BODY SLAM and SUPERSONIC supply offset-free semantic locators for
  `AnimTask_ShakeMon`, `AnimTask_ShakeMonInPlace` and `AnimTask_ShakeMon2`.
  Their exact task steps execute as reusable battler transform tracks, so any
  move referencing a learned native function moves the attacker or target
  picture without baking or duplicating the battle scene. Unidentified visual
  tasks remain explicit unresolved tracks.
- FIRE BLAST supplies an offset-free semantic locator for
  `AnimTask_BlendBattleAnimPal`. The renderer preserves its delay, coefficient
  ramp, final palette state, selector targets, and native five-bit blend
  equation as a reusable palette track. CALM MIND adds the verified
  single-battle exclusion selectors, and FLAME WHEEL adds the exact
  battler-palette in/out cycle with final restoration. CONFUSION adds exact
  inverse-affine scale/restore frames; SWORDS DANCE and WING ATTACK add the
  respect-side and direct fixed-point elliptical paths reconstructed from
  `gSineTable`; SCREECH adds the native fixed-point sway task. FISSURE adds the
  exact specific-battler branch of the decaying horizontal shake. ACID adds
  the exact normal-palette cycle clock, including alternating BG/OBJ updates,
  coefficient steps of two, positive delays, accelerated negative-delay
  steps, restoration cycles and finalization. THUNDER PUNCH adds the immediate
  `InvertPlttBuffer` contract: selected battle BG and battler OBJ palettes use
  the native five-bit complement, persist after task destruction, and cancel
  exactly when a later command inverts the same layer again.
  Per-layer coefficients keep the object palette one native half-step behind
  the background when required. These
  contracts preserve their integer asymmetry, delay transitions and
  destruction ticks. Fixed-power target shake receives an explicit family
  playback context, while BG3 platform shake uses the complete 32×32 ROM
  tilemap through a hardware-style wrapped viewport. The supplied Emerald and
  FireRed ROM audits now resolve 479 of 771 decoded visual-task commands; the
  other 292 remain explicit unresolved tracks. Runtime-damage,
  isolated animation-background palette selectors, double-battle partner
  targets and enemy-side attacker reversal are not yet represented by the
  standalone single-battle scene.
- The GBA animation field now uses the ROM's complete
  `gBattleAnimBackgroundTable`. All 27 image/palette/tilemap records are found
  by semantic structure rather than stock offsets. Native Psychic palette
  rotation and independent Q8.8 sliding-background tasks share the program
  clock and stop on their real `setarg` signals.
- Animation objects are now mounted into the family battle scene before the
  native overlays, HUD and text box, so move particles cannot paint over the
  health boxes. Callback adapters distinguish fixed battler coordinates from
  picture-adjusted coordinates. Bullet Seed follows its exact deterministic
  20-tick flight and native shared-`Random2` rebound. Petal Dance now
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
- Red/Blue's opening battle no longer exposes Gengar or Jigglypuff/Nidorino as
  independent linear sheets. Its family scene library mounts the three Gengar
  tilemaps, the three 6×6 OAM pictures, native black bars, scroll steps,
  picture changes, movement lists and delays into one 160×144 document. A
  supplied Pokémon Blue ROM produced 107 bounded visual states. Native BGP
  ordering and `OAM_PRIO` composition are applied, and its three semantic
  layers can be selected and played in isolation. Intro audio is still not
  executed, so the overall document remains Partial.
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
