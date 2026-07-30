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
  returning use human-readable titles.
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
Command decoding is verified. The visual resolver now locates the native
`gBattleAnimPicTable` and `gBattleAnimPaletteTable` by their tagged record
shape, follows each loaded `SpriteTemplate`, decodes its OAM dimensions and
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
without granting stock offsets to an unknown build. Playback advances at
native 60 Hz delays and projects the decoded runtime into separate graphics,
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
command duration in native 60 Hz ticks, and can safely change the selected
picture, duration and movement assignment. Writes are fixed-width,
compare-before-write operations with project undo/redo; command insertion,
affine callback code and back-animation sets remain locked until their writers
are verified.

Trainer and Poké Ball sequences are intentionally represented as separate
future catalog providers. The reference code exposes trainer front/back
`AnimCmd` tables, trainer slide callbacks and Poké Ball launch/release tasks;
they must be decoded as their real engine operations rather than flattened
into invented generic frames.

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
  invented ticks. Rendering remains partial until each referenced task and
  sprite callback is interpreted.
- **GB / Red and Blue:** every move resolves through
  `AttackAnimationPointers`. The family driver distinguishes the three-byte
  subanimation records (tileset, delay, sound and subanimation ID) from
  two-byte special effects and the native terminator. Its visual resolver
  follows `MoveAnimationTilesPointers → SubanimationPointers →
  FrameBlockPointers → FrameBlockBaseCoords`, decodes native 2bpp tiles and
  applies the engine's normal, HV-flip, horizontal-flip/translation and
  coordinate-flip OAM transforms. Multi-frame subanimations become real
  timeline frames. The command delay is applied after **each** native
  three-byte subanimation frame, matching `PlaySubanimation`, and objects are
  removed when their command ends rather than accumulated as duplicated
  overlays. Stored `sound_id - 1` bytes are restored to semantic SFX IDs in
  the Nerd listing and audio track.
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
