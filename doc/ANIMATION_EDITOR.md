# Animation Editor

The Animation Editor provides one reusable document, renderer and timeline UI
for sprite, battle, tile, scene, palette, camera, text and sound tracks. It
supports selection, play/pause, frame stepping, scrubbing and active-command
display at the native game viewport.

## Simple and Nerd programs

Animation commands are code. They use the same visual-program material as the
Code Editor instead of inventing a second command presentation:

- **Simple** renders semantic nodes with execution inputs and outputs.
  Selecting a node moves the timeline to its corresponding step. Loading an
  effect, creating a sprite, waiting, blending, playing sound, looping and
  returning use human-readable titles. Every decoded command is a node with an
  execution input, and every decoded operand is a typed data input on that
  node. A data input becomes editable only when its family driver supplies a
  compare-before-write encoder; inspection-only operands remain visibly
  read-only instead of pretending that an unsafe change can be saved.
- **Nerd** renders the lossless native command list, arguments and engine
  terminology. ROM addresses, pointer tables, animation IDs and decoder
  accuracy are advanced properties.

The graph is a projection of the same command records, not another binary
model. Unsupported opcodes therefore remain explicit.

## Important accuracy rule

An editor must never present a pointer scan or an invented frame list as a
native animation. Every document therefore records its decoder and rendering
accuracy alongside its source address.

## Emerald native move scripts

For the verified Emerald profile, the Animation Editor reads each four-byte
entry in `gBattleAnims_Moves` directly rather than scanning pointer-like ROM
data. A move document records its table root, its resolved script address and
the native battle-animation command stream. The decoder covers all **48
opcodes (`0x00`–`0x2f`)** registered by
`src/battle_anim.c::sScriptCmdTable`, including the three variable-width
sprite, visual-task and sound-task forms. It also covers waits, blending,
sound, background changes, visibility, team movement and flow commands. An
unknown or truncated opcode rejects only that resource; it cannot disable the
rest of the catalog.

For example, **POUND** resolves through the table to its script around
`0x2C9398` in the pinned Emerald build. The source list reports operations such
as `loadspritegfx`, `monbg`, `setalpha`, `createvisualtask`,
`waitforvisualfinish`, `clearmonbg`, `blendoff` and `end` from real bytes.
Command decoding is verified. The visual resolver now uses the reviewed,
offset-free `CompressedSpriteSheet` / `CompressedSpritePalette` engine
contract for all 289 native resources. It prefers exact
`gBattleAnimPicTable` and `gBattleAnimPaletteTable` symbols; a relocated hack
is accepted only when one unique candidate validates all 289 sequential tags,
record sizes, ROM pointers and LZ77 headers. A two-record signature is no
longer enough to misidentify arbitrary ROM bytes as animation data. The
reviewed contract also preserves the engine's intentional Sap Drip palette-tag
alias at entry 47 instead of incorrectly demanding a nonexistent palette.
It then
follows each loaded `SpriteTemplate`, decodes its OAM dimensions and
renders its real LZ77 4bpp graphics and palette over a mounted ROM battle
scene. Graphics use the native `tileTag` and palettes independently use the
SpriteTemplate `paletteTag`; their table indices and tags are never assumed to
match. Affine SpriteTemplates expose the
template's native affine-program ticks to the shared compositor. The
compositor applies per-tick scale and rotation around the sprite center and
removes verified transient hit effects after their finite sequence instead of
leaving every created object on screen. Ordinary SpriteTemplate `AnimCmd`
programs now resolve native tile offsets, durations, horizontal/vertical
flips, jumps, and paired loop markers. A zero-count loop starts a region and
the later non-zero loop repeats only that region, matching `AnimateSprite`;
it is not treated as a restart of the whole sheet. This keeps
moved-but-structurally-compatible tables usable in ROM hacks
without granting stock offsets to an unknown build. Playback advances at the
native GBA VBlank cadence (approximately 59.7275 Hz) and projects the decoded runtime into separate graphics,
object, task, audio and video tracks. Full execution of referenced C tasks,
most temporary sprite callbacks, and palette callbacks is still reported as
**partial**; the canvas never invents their output.

The family drivers feed one shared native-clock compositor after decoding.
Instant resource/object commands do not consume invented time: `delay`,
Gen I record durations and `waitforvisualfinish` advance every live object on
the same clock. Multiple flowers, leaves or hit objects therefore overlap and
expire together as they do in the engine instead of each playing its complete
sequence before the next `createsprite`.

The image resolver follows both native SpriteTemplate storage modes. When
`images == NULL`, `AnimCmd.imageValue` is a 32-byte tile offset in the loaded
sheet. When `images` points to `SpriteFrameImage[]`, that field is an array
index and the resolver follows the entry's pointer and byte size. Conflating
these modes produced plausible but incorrect graphic fragments.

`createsprite` arguments are deliberately **not** interpreted as a universal
`x, y` tuple. `Cmd_createsprite` initially creates every object at the native
target coordinate; the selected C callback gives the argument array its real
meaning. The generated Emerald dictionary now carries all 352 source-named
global `SpriteTemplate` symbols and exact symbols for the bounded callback
adapters. The first adapter set covers basic, persistent, side-dependent,
random-position and edge hit splats, cross impact and flashing hit splat. It
uses the callback's verified anchor, offsets, affine animation and lifetime.
The plant-effect adapters additionally execute Petal Dance's large/small
flower trajectories and Razor Leaf's rising/swaying particles per tick. Their
signed arguments, fixed-point translation, 256-step sine/cosine phases and
lifetimes follow `src/battle_anim_effects_1.c`; position now belongs to the
native frame document instead of one static overlay coordinate.
`waitforvisualfinish` clears completed visual objects and tasks just as the
native script gate does, so effects no longer accumulate across a move.

For any template without an adapter, the preview reports the callback
unresolved and does not draw a fabricated effect. The native engine's initial
creation coordinate is retained as metadata, but it is not treated as a
visible frame because the callback runs before composition. The renderer no
longer draws the most recently loaded graphics resource as a fallback object.
It never reuses raw arguments as guessed coordinates or animation indices. Exact ROM hacks
can import their own source manifest and callback/template symbols; selecting
Emerald as a base engine alone does not grant stock callback addresses.

The GBA driver also consumes the nine real entries of
`gBattleAnims_StatusConditions`: poison, confusion, burn, infatuation, sleep,
paralysis, frozen, curse and nightmare. They remain separate `status`
documents. The unused wrapped-status constant is not fabricated as a tenth
animation.

## Animation catalog, not a move-only editor

Animation Editor is the shared home for every native animation source found in
the games. Documents are grouped by purpose:

- Pokémon front/back picture sequences and their movement callbacks;
- trainer entrance, trainer back sprites, Poké Ball throw/release/capture;
- move and status animation scripts;
- battle and map transitions, intros and cutscenes;
- animated tiles, interface elements, palettes, camera and sound tracks.

The shared UI owns selection, playback, tick-accurate timing, timeline and
undo/redo. Family modules own all addresses, decoding and writing. GBA and
GB/GBC implementations must remain separate; a shared renderer is not
permission to share ROM assumptions.

The Scene catalog consumes family-owned graphics instead of duplicating their
decoders:

- Red/Blue: one mounted 160×144 Gengar-versus-Nidorino/Jigglypuff scene follows
  the three native Gengar tilemaps, OAM picture changes, scroll steps, black
  bars, movement lists and delays from `PlayIntroScene`. Its palette follows
  native `rBGP` color-number order and the front monster respects `OAM_PRIO`.
  Background, Gengar and the front monster are selectable timed layers:
  clicking one isolates it and clearing selection restores the whole scene.
  The Pokémon logo,
  player title picture and Game Freak graphic remain separately inspectable;
- Crystal: Suicune, Pichu/Wooper, intro background, Unown, pulse, title logo
  and title ornament;
- Emerald: every verified intro/title resource present in the pinned
  `GbaSceneCatalogs` manifest, including the trainer, Pokémon, weather and
  title layers.

`AnimationAssetCatalog` is deliberately only a presentation adapter. It has no
ROM offsets and no family branches; each isolated scene catalog supplies the
native source and codec. Generic source documents are labelled **partial**
because their graphics are exact while the scene tilemap, task program,
timing, transitions and sound are not yet executed. Red/Blue uses a dedicated
family simulator instead of that adapter because its source sheets require
tilemap/OAM composition; treating the Gengar tiles or three front pictures as
independent scenes produced scrambled and duplicated output. Its visual
program is verified, while unexecuted intro audio keeps the overall document
partial.

Graph nodes are projections of the current decoded program, never a second
hard-coded catalog. Nodes use decoded opcodes or mnemonics, operands and
control-flow edges. An unnamed resource receives a stable neutral identifier
such as `sprite-1`, `task-2` or `step-4`; rebuilding an edited document also
rebuilds its graph. Human labels are reserved for scene navigation and never
replace the underlying command data. Red/Blue subanimation duration and
Emerald `delay` are the first verified typed node writers. Both preserve the
rest of their packed command byte and participate in project undo/redo.

The workspace follows the same visual-editor material as Map and Sprite:
preview plus timeline own more than half of the initial viewport, while the
full-width library is below them. Domain tabs replace a long mixed selector;
search filters only the active domain. Commands and safe edits are mutually
exclusive detail tabs, so raw command lists do not compete with the animation
being inspected. Properties remain compact supporting data.

### Emerald Pokémon pictures

The verified Emerald decoder follows `gMonFrontAnimsPtrTable`, where every
Species points to one or more native `AnimCmd` sequences. The animated front
graphic contains two 64×64 pictures. `sMonFrontAnimIdsTable` independently
selects the movement callback (stretch, jump, wobble, flash, and so on).

The editor now renders those real pictures without smoothing, respects each
command duration in native 59.7275 Hz VBlank ticks, and can safely change the selected
picture, duration and movement assignment. Writes are fixed-width,
compare-before-write operations with project undo/redo; command insertion,
affine callback code and back-animation sets remain locked until their writers
are verified.

Trainer and Poké Ball sequences are intentionally represented as separate
future catalog providers. The reference code exposes trainer front/back
`AnimCmd` tables, trainer slide callbacks and Poké Ball launch/release tasks;
they must be decoded as their real engine operations rather than flattened
into invented generic frames.

### Native display timing

The UI does not label either hardware family as an exact 60 Hz system:

- GBA uses `16,777,216 / (228 × 1,232)`, approximately `59.7275 Hz`.
- GB and GBC use `4,194,304 / (154 × 456)`, also approximately `59.7275 Hz`.

Those values live in separate family timing modules. CGB double-speed mode
changes CPU timing, not the LCD/VBlank cadence. Documents without a verified
native timing source show no rate instead of falling back to an invented
60 Hz value.

The shared timeline does not contain a 60 Hz fallback. Every family document
must provide its reviewed native rate; a document without timing evidence is
not autoplayed. Coincidentally similar LCD rates therefore do not merge the
engines.

### Battle direction is engine context

The Player → Rival / Rival → Player control does not mirror the finished
canvas. It rebuilds the document with the owning engine's native direction
rules:

- **Red/Blue:** `hWhoseTurn` selects different coordinates and horizontal-flip
  flags in `engine/battle/animations.asm`. The Gen I decoder owns those
  transforms.
- **Crystal:** `engine/battle_anims/core.asm` transforms only animation
  objects whose `BATTLEANIMSTRUCT_OAMFLAGS_FIX_COORDS_F` bit is set. The
  decoder applies the exact native X/Y equations and leaves unmarked objects
  unchanged.
- **Emerald:** `gBattleAnimAttacker` and `gBattleAnimTarget` are semantic
  battlers. Sprite callbacks, palette selectors and visibility commands act
  on those roles. The shared compositor resolves them to the physical
  player/opponent layers only after the GBA decoder has interpreted the
  command or callback.

This is deliberately a small shared semantic contract (`user`, `target`,
physical scene roles). Coordinate formulas, callback behavior, flags and ROM
structures remain in separate Gen I, Gen II and GBA modules. Direction-aware
palette effects and visibility are projected to the correct physical battler;
they are not applied to both layers or left attached to the original side.

Native `call`, `return`, conditional jump, unconditional jump and loop
commands are also explicit control-flow records. Simple mode renders their
branch/call/loop edges. When a branch depends on live battle state that the
standalone editor does not own, both paths remain visible and the preview is
marked partial instead of guessing which path ran.

Editing follows a schema supplied by the owning family driver. The shared
editor renders declared fields and frame controls, collects values and sends
them back to that driver's verified patcher. It no longer contains an
Emerald-specific form branch. Current verified writing remains limited to the
bounded GBA Pokémon front-picture sequence; GB/GBC move, object and scene
streams remain read-only until their family writers have round-trip evidence.

### Intro and story scenes

Exact Red and Blue fingerprints expose the three native 48×48 Nidorino or
Jigglypuff intro pictures as one partial scene document. Their order and pixels
come from ROM. The `pokered` build marks each source with
`RGBGFXFLAGS += --columns`, so the GB/GBC image codec reconstructs these
particular 6×6-tile pictures in column-major order; treating them like ordinary
row-major sheets visibly scrambles every picture. Timing is deliberately
reported as undecoded. This provides a real visual source without pretending
to emulate the complete intro movie.

Professor Oak presenting a Pokémon, trainer throws, Poké Ball release/capture,
title movies and Emerald/Crystal intros are composite programs rather than
ordinary sprite animations. Their complete editors require a family-specific
control-flow decoder plus background/tilemap, OAM, palette/camera, text, sound,
timing and branch tracks. Sprite Editor exposes several exact constituent
sheets, but Animation Editor must not convert those sheets into invented
frames. Oak's scene therefore remains an explicit next decoder in this pass.

## Attack animation sources by family

- **GBA / Emerald:** every move resolves through `gBattleAnims_Moves`. The
  editor decompiles the native battle-animation bytecode, including resource
  loads, temporary sprites, visual tasks, waits, blending, sound, backgrounds
  and control flow. `SpriteTemplate` animation commands now preserve backward
  `ANIMCMD_JUMP` cycles instead of expanding an arbitrary 64-command loop.
  Verified callback lifetime is the sole bound for a cyclic object, so a leaf
  or flower neither disappears after one cycle nor survives hundreds of
  invented ticks. The template also preserves native OAM object mode; ordinary
  effects are no longer rendered through a cosmetic editor-wide opacity.
  Bullet Seed follows the native 20-tick attacker-to-target translation and
  the subsequent 16-tick sine rebound. The standalone preview owns the same
  shared `Random2` linear-congruential stream, zero-initialized like
  `gRng2Value`; consecutive seeds therefore consume different values rather
  than collapsing into one target overlay. A future emulator bridge may inject
  a captured live seed, but the renderer's geometry and lifetime already
  follow `AnimBulletSeed`, `AnimBulletSeed_Step1` and
  `AnimBulletSeed_Step2` exactly.
  `createvisualtask` is no longer treated as descriptive text. The editor
  learns the exported `AnimTask_ShakeMon`, `AnimTask_ShakeMon2` and
  `AnimTask_ShakeMonInPlace` functions from POUND, SUPERSONIC and BODY SLAM's
  reviewed native command shapes, without storing ROM addresses, and reuses
  those learned pointers throughout the loaded cartridge. Their immediate
  constructor steps, delay counters, alternating `x2/y2` offsets and
  destruction ticks now move the actual battler on the shared native clock.
  Every move that calls one of these tasks therefore retains its particles,
  HUD and text while the attacker or target picture shakes at source-defined
  coordinates.
  The same offset-free task registry now learns
  `AnimTask_BlendBattleAnimPal` from FIRE BLAST. Its native delay counter,
  coefficient ramp and terminal palette-buffer state are preserved as a
  persistent scene track. Background, user, target and effect layers are
  selected independently from the task bitmask and blended with the engine's
  five-bit channel equation,
  `source + (((target - source) * coefficient) >> 4)`. HUD and text are not
  accidentally tinted. Partner-position selector bits remain visible but
  cannot be previewed faithfully in the current single-battle scene.
  CALM MIND anchors `AnimTask_BlendBattleAnimPalExclude`, including each
  verified single-battle include/exclude selector. FLAME WHEEL anchors
  `AnimTask_BlendMonInAndOut`; its battler-only palette, initial delay,
  coefficient ramp, repeated in/out cycles and final restoration now execute
  on the same timeline. Partner-only selectors fail closed instead of tinting
  the wrong battler.
  CONFUSION and SWORDS DANCE provide two further semantic anchors.
  `AnimTask_ScaleMonAndRestore` reproduces the inverse 8.8 affine coefficients,
  restoration phase and center-anchored battler scaling.
  `AnimTask_TranslateMonEllipticalRespectSide` uses the exact
  `gSineTable` Q8.8 values, integer shifts, speed clamp, loop counter and
  same-tick origin reset from `battle_anim_mon_movement.c`; it does not use
  browser trigonometry or a guessed curve. WING ATTACK anchors the direct
  `AnimTask_TranslateMonElliptical` contract, while SCREECH anchors
  `AnimTask_SwayMon` with its signed accumulator, exact sine samples,
  half-cycle transitions and horizontal/vertical side rules. FISSURE also
  anchors the specific-battler branch of
  `AnimTask_HorizontalShake`: its two-tick cadence, asymmetric integer
  offsets, fixed-duration phase and four-alternation decay execute exactly.
  The all-battler branch stays unresolved because partner battlers are not
  represented by this single-battle document. ACID anchors
  `AnimTask_BlendColorCycle`. Its native
  `BeginNormalPaletteFade` clock preserves the immediate first BG update,
  alternating BG/OBJ halves, coefficient steps of two, delay counters,
  negative-delay accelerated coefficient steps, repeated blend/restore
  segments and the four-tick software-fade tail.
  Separate per-layer coefficients prevent a target sprite from changing on
  the earlier BG half. Selectors for isolated animation-background subpalettes
  remain unresolved because the mounted scene does not expose those native
  subpalettes as independent layers; tinting the complete background would be
  incorrect. THUNDER PUNCH also anchors
  `AnimTask_InvertScreenColor`. The renderer complements the selected native
  five-bit BG 1–3 and battler OBJ colors, retains each immediate task result,
  and composes later calls as XOR, so the second identical inversion restores
  the original palette exactly. Repeated identical macro calls are accepted as
  one offset-free symbol anchor only when every occurrence resolves to the same
  function pointer.
  DEFENSE CURL now anchors
  `AnimTask_SetGrayscaleOrOriginalPal`. The preview computes the native
  five-bit channel average from the unfaded battler palette and keeps that
  palette state until a matching restore command replaces it. Restore is an
  identity over the original ROM pixels, not a second cosmetic filter.
  Attacker and target are isolated on separate persistent channels.
  Double-battle palette selectors remain unresolved because mapping a missing
  partner palette onto the visible battler would color the wrong object.
  RAPID SPIN provides the semantic anchor for
  `AnimTask_ShakeTargetBasedOnMovePowerOrDmg`. This task cannot be decoded from
  script operands alone: the native controller supplies `gAnimMovePower` and
  `gAnimMoveDmg` from live battle state. Move documents therefore carry an
  explicit family-owned playback context. A neutral preview may use the ROM
  move record only when its power is fixed; the task then applies the exact
  `/ 12` clamp, asymmetric positive/negative amplitude, delay, axis flags and
  destruction clock. Power value `1` is treated as a runtime-computed sentinel,
  and damage-driven calls remain unresolved without captured battle state.
  This resolves fixed-power paths without fabricating Flail, Reversal,
  Spit Up, Endeavor or Rage behavior.
  `AnimTask_ShakeBattlePlatforms` is learned from the exact move-317 macro.
  Battle backgrounds now retain their complete 32×32 BG3 tilemap alongside
  the visible 30×20 viewport. The task reproduces the constructor's immediate
  step, signed X alternation, down/origin Y sequence, delay counter and final
  register reset. The renderer applies those values as hardware HOFS/VOFS over
  a wrapped 256×256 surface, so shaking never exposes fabricated edge pixels.
  `AnimTask_ShakeMon2` now projects every native battler selector into the
  neutral one-on-one scene: attacker-force and visible fixed positions resolve
  to their real side, while partner/right-position selectors preserve the
  engine's immediate absent-sprite no-op. `AnimTask_HorizontalShake` supports
  individual battlers, both visible battlers, BG3 platforms and the native
  move-power intensity branch. A `both` scene track is accumulated by the
  shared renderer for player and opponent without duplicating the engine task.
  The move-specific field is no longer a generic striped battle backdrop.
  `js/animation/gba/backgrounds.js` discovers the complete 27-record
  `gBattleAnimBackgroundTable` by its source-derived structure, validates all
  81 LZ77 pointers, and composes each native image, 4bpp palette and text
  tilemap. `fadetobg`, `changebg`, `fadetobgfromset` and `restorebg` now mount
  or unmount that real ROM layer beneath the battlers and HUD. The neutral
  single-battle document selects the opponent-target branch of
  `fadetobgfromset`; contest and player-target branches are not guessed.
  PSYBEAM anchors `AnimTask_SetPsychicBackground`: palette entries 1–11 rotate
  once every four ticks, the spawned task stays independent of
  `waitforvisualfinish`, loops, and is destroyed only by
  `setarg 7, 0xFFFF`. BODY SLAM anchors `AnimTask_StartSlidingBg`; its signed
  Q8.8 remainder, accumulated HOFS/VOFS, independent lifetime and argument-7
  stop signal run over the complete 32×32 ROM tilemap when that native
  surface exists.
  The standalone scene represents the attacker on the player side,
  so the native
  enemy-attacker direction reversal of the respect-side variant remains
  outside the current scene contract.
  Native animation objects are composited after the battler sprites and before
  the battle overlays, HUD and text box. This matches the battle-field layer
  boundary and prevents effects from covering health boxes. Callback adapters
  also distinguish fixed `BATTLER_COORD_X/Y` anchors from the
  species-adjusted `BATTLER_COORD_X_2/Y_PIC_OFFSET` anchors. Petal Dance uses
  its correct coordinate spaces and motion path, but remains **partial**
  because its per-frame battler subpriority switch is not yet modeled.
  Pain Split now resolves all six native
  `AnimTask_PainSplitMovement(battler, transform)` calls. Its thirteen-tick
  affine sequence includes X reversal every three ticks, C-truncated
  `SetBattlerSpriteYOffsetFromYScale`, the player-side angled offset, rotation,
  scale, and the final transform reset.
  `AnimTask_RotateMonSpriteToSide` now executes its native signed affine angle,
  player-side reversal, two-phase return mode and sine-derived lower-edge
  anchor. This covers the shared task used by Fury Attack, Double-Edge, Low
  Kick and Arm Thrust. `AnimTask_SetGrayscaleOrOriginalPal` now understands
  attacker, target and the four fixed battle positions; absent partner/right
  sprites remain the engine's verified no-op instead of recoloring the visible
  battler. `AnimTask_ShakeTargetInPattern` executes the two exact ten-entry
  alternation tables from `battle_anim_fire.c`, including the native absolute
  vertical displacement and final offset reset. Calls that omit the native
  pattern argument remain unresolved because the standalone editor does not
  guess the live value left in `gBattleAnimArgs`.
  Rendering remains partial until each referenced task, sprite callback and
  semi-transparent OBJ blend is interpreted. The current real-ROM audit
  resolves 504 of 771 decoded visual-task commands in each supplied Emerald
  and FireRed cartridge; the remaining 267 calls are explicit unresolved task
  tracks rather than invented motion. Both cartridges are audited
  independently: the shared source-derived semantic locators learn each ROM's
  own function addresses instead of assuming FireRed matches Emerald.
- **GB / Red and Blue:** every move resolves through
  `AttackAnimationPointers`. The family driver distinguishes the three-byte
  subanimation records (tileset, delay, sound and subanimation ID) from
  two-byte special effects and the native terminator. Its visual resolver
  follows `MoveAnimationTilesPointers → SubanimationPointers →
  FrameBlockPointers → FrameBlockBaseCoords`, decodes native 2bpp tiles and
  applies the engine's normal, HV-flip, horizontal-flip/translation and
  coordinate-flip OAM transforms. The stored transform is resolved through
  `GetSubanimationTransform1/2` for the selected attacker side, and the canvas
  coordinates apply the hardware OAM X/Y origins exactly once. Multi-frame
  subanimations become real
  timeline frames. The command delay is applied after **each** native
  three-byte subanimation frame, matching `PlaySubanimation`, and objects are
  removed when their command ends rather than accumulated as duplicated
  overlays. Stored `sound_id - 1` bytes are restored to semantic SFX IDs in
  the Nerd listing and audio track. The animation workspace mounts the native
  family battle compositor in a lightweight scene-only mode: trainer and
  progression catalogs cannot make a valid Pokémon/HUD scene fall back to the
  generic striped canvas. The decoded effect is therefore layered over the
  ROM front/back pictures, HUD and textbox rather than displayed alone.
- **GBC / Crystal:** the move record selects an animation in
  `BattleAnimations`. Its own driver decodes `anim_wait` and the complete
  `$d0`–`$ff` `BattleAnimCommands` widths, including objects, graphics,
  background effects, palettes, sound, jumps, loops, calls and returns. Native
  objects resolve through `BattleAnimObjects → BattleAnimFrameData →
  BattleAnimOAMData → AnimObjGFX`; the renderer decompresses the referenced
  GSC LZ graphics and composes every concrete frameset/OAM frame with its
  native duration, palette, frame-level flips and per-tile flips.
  `anim_obj` coordinates remain absolute screen coordinates as in the native
  macro. Wait/restart/delete/end frameset controls are distinct: wait emits a
  transparent timed frame, restart records a cycle, delete destroys the
  object and end holds its final frame. They are never treated as visible OAM
  records or target-relative offsets.

These three formats deliberately live in different family directories. They
share `AnimationDocument`, timeline and UI only; no GBA opcode, pointer rule or
rendering assumption is reused for GB/GBC.

The move domain enumerates the complete native move table for each enabled
profile rather than stopping at a demonstration subset: 355 Generation III
move-animation roots (including the table's zero entry), 165 Red/Blue attack
animations, and 251 Crystal move records. “Complete list” describes discovery
and command-source ownership; the accuracy badge on each document still
distinguishes a decoded command stream from a partially simulated visual
runtime.

The shared scene simulator keeps the family's verified battle scene as
separate native layers, including its ROM background, HUD, font and Pokémon
pictures, then applies animation objects above it. It derives user and target
anchors from the actual decoded battler bounds; it no longer bakes the scene
into a canvas and substitutes hard-coded centers. This is necessary for
species-specific picture offsets and future task-driven battler movement.
Red/Blue frame blocks and Crystal object framesets are rendered completely;
Crystal movement callbacks remain explicit. Generation III still delegates
many visual operations to native C callbacks. PUSH must label these remaining
program projections as partial until each pinned family interpreter reproduces
the official composed sequence.

## Failure isolation and cross-editor links

Opening an animation from Moves uses the canonical `moveId`; an explicit
animation link uses the document's family-local `animationId`. Gen I and
Crystal therefore do not accidentally treat an animation ID as a move ID.
Pokémon links resolve by `speciesId`.

Catalog providers and individual move roots fail independently. A corrupt
pointer in a ROM hack is reported through the notification system and omitted
from the picker, while every other verified document remains usable. The
editor validates its markup contract at initialization, so a missing control
produces one actionable error instead of a later null-property crash.

## Safe path to editing

Writers should be enabled command-by-command only after decode/encode
round-trips, reference ownership, allocation and emulator scenarios pass.
Frame duration, palette and verified pointer edits can arrive before arbitrary
scene scripting. See `EDT-006`, `DATA-004`, `MUT-004` and `MUT-005`.

## Verified source provenance

Current exact-profile animation and scene research was reproduced from clean
builds of:

- `pret/pokeemerald` commit
  `83df84e40623b79281f2397faa611cbf044170bd`;
- `pret/pokered` commit
  `405b6246372d7e5a2cb029cbb65219b13286b8c9`;
- `pret/pokecrystal` commit
  `3438c7003a57fa2987fcb223d14b660761b33c64`.

Those commits document structures and symbols. Runtime activation remains
bound to the complete supported-ROM fingerprint; a similarly sized or modified
ROM does not inherit the table addresses.

## Executed control flow

The derived timeline no longer stops at the first unconditional subroutine:

- Emerald executes native `call`, `return`, and `goto` addresses.
- Crystal executes `anim_call`, `anim_ret`, `anim_jump`, and bounded
  `anim_loop` paths.
- repeated addresses, call depth, and total decoded commands are bounded so a
  native loop cannot freeze the editor.

Conditional branches and commands requiring input remain visible but are not
guessed because they depend on live battle state. “Working” here means the
exact move domain opens, its native program is decoded, the battle scene and
verified referenced graphics are composed, play/pause/step/scrub operate, and
unconditional flow advances in engine order. Each visual node uses the same
executed command record as the timeline, carries its call depth, and selects
the corresponding rendered step. C tasks, unresolved callbacks, later
Crystal frameset control, tilemap effects and video-register effects stay
marked Partial until their actual family interpreter exists.
