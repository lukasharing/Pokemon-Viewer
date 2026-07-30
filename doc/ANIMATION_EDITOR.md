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
the native battle-animation command stream. The decoder covers the command
forms used by the `battle_anim_script.inc` macros, including sprite/task
creation, waits, blending, sound, background changes and flow commands; an
unknown or truncated opcode stops decoding safely.

For example, **POUND** resolves through the table to its script around
`0x2C9398` in the pinned Emerald build. The source list reports operations such
as `loadspritegfx`, `monbg`, `setalpha`, `createvisualtask`,
`waitforvisualfinish`, `clearmonbg`, `blendoff` and `end` from real bytes.
Command decoding is verified; full task, temporary sprite and palette runtime
emulation is still reported as **partial** by the renderer rather than shown as
a fabricated animation.

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
come from ROM; timing is deliberately reported as undecoded. This provides a
real visual source without pretending to emulate the complete intro movie.

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
  and control flow. Rendering remains partial until each referenced task and
  sprite template is interpreted.
- **GB / Red and Blue:** every move resolves through
  `AttackAnimationPointers`. The family driver distinguishes the three-byte
  subanimation records (tileset, delay, sound and subanimation ID) from
  two-byte special effects and the native terminator.
- **GBC / Crystal:** the move record selects an animation in
  `BattleAnimations`. Its own driver decodes `anim_wait` and the complete
  `$d0`–`$ff` `BattleAnimCommands` widths, including objects, graphics,
  background effects, palettes, sound, jumps, loops, calls and returns.

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

The Gen I and Gen II move documents resolve verified family pointer tables and
command widths, but their rendered visuals remain partial. Generation III battle
animation scripts require a command interpreter with sprite tasks, palettes
and waits; Gen I/II combine tilemaps, OAM and video-register effects. PUSH
must label these as partial until a pinned family interpreter
reproduces the official sequence.

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
