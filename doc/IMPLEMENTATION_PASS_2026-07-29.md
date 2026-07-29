# ROM-accurate editor integration pass — 2026-07-29

This note records the implementation and verification completed for the
Pokédex, Minimap, Battle, Emulator and Move surfaces.

## Family-boundary enforcement

- Battle's shared preview now consumes family-owned HUD/textbox coordinates;
  GBA and GB/GBC geometry and message composition remain in their respective
  drivers.
- Sprite composition now uses a neutral registry plus physically separate
  `gba/`, `gbc/`, and `gen2/` compositors. The shared editor contains no
  family-size or speechbox-layout switch.
- `npm run test:boundaries` is part of `npm test`. It rejects family switches
  in shared Battle/Sprite modules and cross-family dependencies inside the
  isolated implementations.
- Architecture, UX, Battle, Sprite, and development guides now treat this as
  an enforced invariant rather than a naming convention.

## Delivered

### Generation III Species and Pokédex

- The shared GBA Species domain is now the complete internal ID range
  **1–411**.
- The 25 engine slots at 252–276 remain real Species documents with their own
  name, pictures, palette, evolutions and machine flags, but do not borrow a
  National Pokédex record.
- IDs 277–411 map to National Pokédex 252–386.
- Emerald Rev. 0 and FireRed Rev. 1 use separately verified table locations.
  FireRed Rev. 1 no longer applies one guessed global shift: graphics, names,
  Pokédex, evolution and TM/HM tables use their independently checked
  addresses.
- Front and back pictures are decoded as native 64×64, tiled 4bpp frames with
  ROM palettes and no interpolation.

### Minimap

- The former normal-map thumbnail is removed.
- Emerald renders the real Hoenn 240×160 Minimap background from its ROM
  palette, LZ77 8bpp tiles and affine tilemap.
- Emerald `gRegionMapEntries` provides section names, rectangles, current-map
  highlighting and section-to-map navigation.
- FireRed Rev. 1 renders the real Kanto screen through the same GBA tilemap
  library using its native 4bpp text-background format.
- Unsupported profiles disable Minimap view; they do not display a
  substitute map.

### Battle

- Emerald's tall-grass battle environment is decoded from the ROM's compressed
  graphics, tilemap and three palette banks.
- Enemy front and player back pictures use the same Species library as the
  Pokédex.
- A verified static ROM scene is available when Battle opens directly.
- Trainer party cards link to Pokédex and Sound.
- A trainer opened from a map retains a semantic map bookmark; **Return to
  overworld** restores that context.
- Battle navigation was reduced to a trainer selector, flat team list, native
  canvas and a thin Map-style toolbox. Valid trainers select by default;
  unavailable actions and empty panels are hidden. Hero copy, instructional
  badges, nested cards and the generic editor toolbar were removed.
- `doc/UX_GUIDELINES.md` records these decisions as mandatory constraints for
  every subsequent editor change, not as Battle-specific styling.

### Emulator

- The invalid historical BIOS/emulator experiment is replaced by the
  `@thenick775/mgba-wasm` mGBA core for GBA, GB and GBC.
- The emulator is a body-level, always-on-top picture-in-picture surface, so
  responsive navigation and editor fullscreen cannot clip it.
- It supports drag, viewport clamping, minimize, fullscreen, explicit
  hide/restore, scoped keyboard input and project-consistent styling.
- Applied project edits trigger a debounced ROM refresh while preserving the
  previous play/pause state.
- Browser-persistent save data can be imported and exported as `.sav`.
- The local server supplies WebAssembly MIME and cross-origin-isolation
  headers.

### Generation III Move Editor

- Emerald's generated source manifest now binds `gBattleMoves`, `gMoveNames`
  and `gBattleAnims_Moves` to the pinned `pret/pokeemerald` build.
- The shared Move workspace loads an isolated GBA driver only when a GBA ROM
  opens it.
- It decodes all 354 native 12-byte records and safely edits effect, power,
  type, accuracy, PP, secondary-effect chance, target and signed priority.
- The four-byte engine flag mask remains byte-identical until a source-backed
  control exists for every bit.
- Emerald party formats with explicit moves provide navigable trainer/battle
  references; valid animation pointers open the Animation workspace.
- Emerald Rev. 0 and FireRed Rev. 1 ROM audits validate all 354 records and a
  reversible edit/restore without changing the ROM on disk.

## Library boundaries

| Library | Responsibility |
|---|---|
| `js/core/gba-rom-assets.js` | revision-aware verified GBA table profiles |
| `js/core/gba-species.js` | 411-ID Species documents, Pokédex join, pictures, palettes, evolution and machine tables |
| `js/core/gba-moves.js` | exact Generation III fixed move records and selective encoder |
| `js/moves/gba/driver.js` | shared-UI adapter, references and reversible Move commands |
| `js/core/gba-tilemap.js` | reusable GBA 4bpp text and 8bpp affine background rendering |
| `js/map/gba/region-map.js` | Minimap decoding and section navigation |
| `js/battle/gba/backgrounds.js` | verified battle-environment decoding |
| `js/battle/gba/sprites.js` | shared front/back monster sprite source |
| `js/emulator/editor.js` | family-neutral mGBA project runtime |

## Verification

- `npm test`: **283/283** tests pass.
- Syntax validation: **177** first-party scripts pass.
- Family-boundary validation: **7** shared modules and **3** isolated family
  groups pass.
- Real-ROM semantic audits pass for:
  - Pokémon Emerald;
  - Pokémon FireRed Rev. 1;
  - Pokémon Blue, matching the exact `pret/pokered` reference fingerprint.
- Emerald and FireRed Rev. 1 both decode and validate all 411 internal Species,
  386 independent Pokédex entries, fixed names, front pictures, palettes,
  evolutions and TM/HM bitsets. Bulbasaur resolves to `SEED`, height 7 and
  weight 69 in both tested ROMs.

## Deliberate remaining boundaries

- Exact battle environments beyond the pinned Emerald profile still need their
  own verified table profiles.
- FireRed's Minimap graphic is exact, but semantic section navigation is
  currently pinned only for Emerald.
- Minimap editing and safe graphics recompression are not yet enabled.
- mGBA refresh currently reloads the project ROM after a semantic edit. The
  resource graph must reach full write coverage before mutations can be
  classified safely into graphics-only, map-only and full-reset refreshes.

## Consolidated editor material and responsive audit

- Added one explicit editor composition contract: primary view, attributes,
  actions and toolbox.
- Added `UiPanel` for persistent full-axis structure instead of treating every
  section as a floating titled window.
- Tokenized the editor layer order as panel, contextual window and toolbox;
  product overlays remain above all three.
- Migrated Sprite history, zoom, grid and pencil controls into a floating
  canvas toolbox.
- Minimap now hides normal map windows, history, encounters and navigation;
  its location attributes replace map attributes until Map view is restored.
- Sound now treats audio as its primary object. Playback/audition, native
  channel/command timeline and tracks lead the document; sound parameters and
  references are supporting panels.
- Hex translation tokens no longer bleed into adjacent byte cells.
- Moves and Pokédex now contain long tablet labels without visible overflow.
- `doc/UI_AUDIT_2026-07-29.md` records the per-editor desktop/tablet matrix for
  Pokémon Emerald and Pokémon Blue.

## Exactness and integration follow-up

- Emerald battle HUD LZ77 assets now fail closed unless both the pinned
  reference profile and the native `0x10` stream marker are present. A
  modified ROM no longer attempts to decode unrelated data at `0x41F46C`.
- Generation III battle environment ownership moved to Map Editor. The exact
  Emerald resolver mirrors the ROM's metatile-behaviour, map-type and weather
  branches; Battle Editor receives the resolved environment and no longer
  offers a misleading local background selector.
- Sprite Editor accepts a set of linked views. Battle navigation opens front
  and back Pokémon graphics together, preserves the active side and gives the
  focused toolbox/pane an explicit visual state.
- The Emerald sound catalog now reads all 610 `gSongTable` records from the
  pinned manifest. Track roots are bounded and command decoding remains
  explicitly partial and read-only.
- Crystal Minimap view now consumes the real `TownMapGFX`, `JohtoMap`,
  `KantoMap`, `TownMapPals`, Pokégear palettes, landmarks and flypoints from
  the exact pinned ROM. Landmark coordinate edits write the native record;
  compressed graphics remain preview-only until safe recompression exists.
- The visual scripting view now has execution input/output ports, separate
  True/False condition exits and connection paths. It visualizes the verified
  decoded command flow; arbitrary graph compilation is still not claimed.
- GBA Pokédex requests reject IDs outside the native internal Species domain
  (1–411) before reading memory, and a bad cross-editor link no longer replaces
  the last valid document.

## Map panel and Gen I border pass

- Added a reusable `ui-panel-stack` composition. Intrinsic panels keep their
  natural height, the navigation panel owns the remaining space, and bounded
  property panels scroll internally.
- Map History, Encounters, Maps and Properties can no longer overlap when a ROM
  exposes hundreds of maps. Desktop and tablet layouts use the same ownership
  rule; narrower layouts change width without collapsing the panel contents.
- The Generation I border editor now represents the exact native object: one
  4 × 4-tile block stored by the map header. Its window is compact, previews
  the selected block at pixel-perfect scale, and opens the shared Blocks
  browser for broader selection instead of embedding a second atlas.
- A static regression contract verifies the bounded panel stack and rejects a
  return to the former oversized border canvas.

## Split native battle scenes

- Battle Editor now keeps trainer introduction and selected-Pokémon combat as
  two simultaneous native canvases. Desktop uses an equal horizontal split;
  narrow screens stack the scenes.
- Selecting another party member updates the Pokémon scene and leaves the
  trainer scene intact.
- Red/Blue party indicators decode the exact four-state
  `PokeballTileGraphics` sheet and six-slot opponent OAM order.
- Emerald party indicators decode the exact LZ77
  `gBattleInterface_BallStatusBarGfx`, the ball-display palette and the
  full/empty status tiles from `gHealthboxElementsGfxTable`.
- Both scenes retain semantic hit targets, Sprite Editor links, native fonts,
  pixel-perfect rendering and the shared optional 8 × 8 inspection grid.

## Editor-by-editor overflow and accessibility pass

- Revalidated all nine available editors from fresh Emerald and Blue uploads.
- Shared panels and docked windows now own bounded, contained scrolling.
- Shared controls expose consistent keyboard focus instead of editor-local
  outlines.
- Battle uses its native 3:2 or 10:9 scene geometry without allocating an
  unusable full-height canvas row; source, party and engine controls remain
  directly below both scenes.
- The shared gesture loader now invalidates stale cached implementations, so
  Map, Sprite, Pokédex, Battle and Encounters no longer inherit a global pinch
  initialization failure.
- No tested editor creates page-level horizontal overflow at the 1028 × 904
  validation viewport; all detected long lists reached their final content.
- Repeated the geometry audit at 842 × 904, where the fixed project rail leaves
  only 602 px for an editor. Battle, Sprite, Pokédex, Sound and Encounters now
  enter their stacked composition before a column can collapse or disappear.
- Long Sound/Pokédex status values wrap inside their inspector, and shared
  sortable table headings truncate only their visible label while preserving
  the complete accessible sort name.
- The shared layout guide now treats usable editor width—not physical viewport
  width—as the responsive input and forbids preserving nominal columns by
  squeezing a sibling below its usable width.

## Encounter workspace density pass

- The encounter library no longer mounts every map in every method at once.
  It exposes compact method tabs and renders only the selected method's tables,
  reducing DOM size and making Grass, Water, Fishing and special encounters
  immediately distinguishable.
- Map/script/data links moved into the selected table's contextual toolbox.
  They no longer appear as an unrelated control group beside the library.
- Encounter slots changed from oversized cards to compact visual rows containing
  the native miniature, Species, probability, level and contextual actions.
  The slot surface remains the primary view while technical table properties
  stay in the secondary details window.
- GBA, Gen I and Gen II retain separate data drivers and lazy runtime loading;
  only the reusable editor composition is shared.

## Encounter-to-battle handoff

- Wild encounter links now activate an explicit Battle Editor `wild` mode.
  A wild encounter renders one native combat scene; it no longer duplicates
  that scene in the trainer-introduction slot.
- The source selector names the active wild Species instead of claiming that
  no trainer/source is selected.
- Returning to a trainer restores the two-scene trainer introduction plus
  selected-Pokémon composition.
- Battle stage and supporting source/team/engine panels explicitly span the
  complete editor width, preventing narrow or overlapping grid columns.

## Encounter and battle controller extraction

- `EncounterBrowserModel` now owns search, method ordering, labels, icons,
  grouping and active-table selection without touching the DOM or ROM memory.
  The editor is limited to rendering and invoking the selected family driver.
- `BattleSourceState` owns the trainer/wild transition, temporary source label,
  accessibility state and layout mode. Battle rendering no longer contains
  selector and CSS bookkeeping.
- Both helpers are lazy shared UI modules. GBA, Gen I and Gen II decoding and
  writing remain in their isolated drivers.
- Added isolated model/controller tests in addition to integration and family
  boundary validation.

## Cross-editor navigation service

- Replaced 32 hand-written `CustomEvent("editorlink")` call sites with one
  validated `EditorLinks` service.
- Semantic helpers now create Species, Move, Sound, Sprite, Map, Battle, Code
  and Hex links consistently across Map, Battle, Encounters, Pokédex and Moves.
- Optional links have an explicit no-op path; malformed required links fail
  immediately instead of emitting an unusable navigation event.
- Event inspectors now express their actions as readable link calls rather
  than one large nested event-construction expression.

## Reusable collection views

- Extracted trainer portraits and party-member rows from `BattleEditor` into
  `BattlePartyView`. The controller now owns source selection and scene state;
  the view owns accessible rows, native images and contextual actions.
- Extracted native encounter rows from `EncounterEditor` into
  `EncounterSlotView`. Species links, probability meters, levels and edit or
  battle actions now share one family-neutral renderer.
- Both views consume the existing family driver contracts. No GBA, Gen I or
  Gen II decoding was moved into shared UI code.
- Runtime manifests load each view only with its editor, and an architecture
  regression test prevents their DOM construction from returning to the
  controller.

## Typed project invalidation events

- Added `ProjectEvents` as the single emitter for resource-graph and ROM
  graphics invalidation.
- Battle and Encounter family drivers now publish rebuilt graphs without
  directly depending on browser event construction.
- Sprite palette/pixel writes and Minimap destination writes use the same
  normalized graphics payload, including de-duplicated integer offsets.
- Consumers continue listening to semantic `resourcegraphchange` and
  `romgraphicschange` events; only event construction and payload validation
  are centralized.

## Pixel-perfect canvas utility

- Added `PixelCanvas` to own canvas creation, positive native dimensions,
  accessible labels, nearest-neighbour contexts, clearing and image copying.
- Battle party art, encounter miniatures, Pokédex previews and Sprite live
  compositions no longer repeat slightly different canvas setup sequences.
- Native family decoders still produce their own pixels and palettes. The
  utility only standardizes presentation after a family driver has returned a
  verified canvas.

## Emulator timing and audio performance

- Removed competing video, audio and fixed-timestep synchronization. mGBA now
  uses the audio clock, variable timing and its supported threaded renderer.
- Increased the Web Audio buffer to 2,048 samples to absorb normal browser
  scheduling jitter without introducing a visibly delayed control path.
- Disabled unused rewind capture while keeping project auto-save states.
- Save-memory callbacks are debounced and serialized. Rapid SRAM/Flash writes
  no longer trigger an IndexedDB synchronization for every individual write.
- Play and input gestures explicitly resume both mGBA audio and the underlying
  browser `AudioContext`, avoiding silent or malformed startup buffers.
- Removed the application hint overlay from the native framebuffer and
  explicitly disabled mGBA's FPS overlay. The touch HUD is now rendered only
  on coarse-pointer devices, so the 160×144 GB/GBC and 240×160 GBA pictures
  remain unobstructed on desktop.
- Added a compact 1×/2×/5×/10× speed switch over the emulator viewport. It
  calls mGBA's native fast-forward multiplier, preserves a single accessible
  active state and returns exactly to native timing at 1×.
