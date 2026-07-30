# Battle editor guide

The global visual and interaction constraints in
[`UX_GUIDELINES.md`](UX_GUIDELINES.md) apply to this editor.

The Battle Editor is a mixed-maturity battle inspector. Exact trainer parties
have a bounded editable path, while battle rendering and animation remain a
read-only first pass without pretending every battle structure is complete.

It is loaded lazily after a ROM is detected, just like Map, Code, and Sprite.
The shared editor lives under `PokemonViewer.battle`; family runtimes install a
small driver for GBA, Gen I, or Gen II. The UI is intentionally shared: the
driver supplies screen size, scene data, candidate animation streams, decoded
timeline commands, and links to related resources.

## Interaction model and design guardrails

The workspace is deliberately sparse:

1. A compact selector chooses the trainer. When the ROM contains trainers, the
   first valid one is selected instead of showing a large empty state.
2. The team is a flat visual list. Selecting a Pokémon updates the Pokémon
   scene without replacing the trainer-introduction scene; small icon actions
   open related editors.
3. Two native canvases form the primary surface: the trainer introduction and
   the selected Pokémon battle state. They share inspection/grid controls but
   keep independent semantic hit targets.
4. A thin floating toolbox,
   following Map Editor's tool convention, contains inspect, grid, and
   animation controls.
5. Timeline controls and the timeline itself disappear when the active driver
   exposes only a static scene.
6. Engine fields are collapsed and restricted to advanced mode.

The following are explicit regressions and must not be reintroduced:

- explanatory hero headings such as “Battle setup” or “Choose an opponent”;
- instructional prose that restates visible controls;
- empty-state cards when a valid default can be selected;
- disabled location/action buttons that remain visually present;
- a heading above the canvas explaining that it is a preview;
- “select a layer” badges when the inspect tool already communicates this;
- cards nested inside cards, thick ornamental borders, or repeated headings;
- generic Undo, Redo, Refresh, Help, Focus, or timeline header actions when the
  same operation is absent, contextual, or already present in the toolbox.

Information belongs in a tooltip, a contextual inspector, advanced mode, or
this guide—not permanently beside the canvas.

The shared markup and editor own this hierarchy. GBA, Gen I, and Gen II
drivers remain separate and supply only their native documents and
capabilities; family pointer layouts and codecs are never selected inside the
UI layer.

## Family boundary

Battle code is divided by responsibility:

- `battle/editor.js`, `preview.js`, `timeline.js`, and `library.js` contain
  family-neutral documents, interaction, selection, and canvas composition.
- `battle/hud-assets.js` is only a decoder registry. It contains no ROM
  offsets, tile formats, palettes, or game-family branching.
- `battle/gba/*` owns Emerald LZ77, 4bpp HUD sheets, textbox composition,
  environment resolution, background tables, monster coordinates, and the
  Generation III driver.
- `battle/gbc/*` owns the Red/Blue 1bpp HUD conversion, Gen I compressed
  pictures, banked trainer structures, and the GB/GBC runtime driver.
- `battle/gen2/*` remains an independent Crystal path. It must not silently
  reuse Gen I or GBA memory structures merely because both consoles use
  2bpp graphics.

This includes layout. GBA and GB/GBC drivers own their native healthbox text
coordinates, textbox origin, wrapping width and line height. `preview.js`
draws the supplied scene document and contains no `gen3`/`gen1` layout switch.
Moving those values back into the shared compositor is a family-boundary
regression even if both previews appear correct in one tested ROM.

The runtime loads the neutral registry followed by exactly one family HUD
module. This is intentional: an adaptable editor is shared, but binary
interpretation is never shared by coincidence.

This boundary matches the pret sources inspected for the pinned profiles.
`pokeemerald` defines `gBattleTextbox*`,
`gHealthboxSinglesPlayerGfx`, `gHealthboxSinglesOpponentGfx`, and
`InitBattlerHealthboxCoords`; `pokered` instead loads
`BattleHudTiles1` and `HpBarAndStatusGraphics` and places pictures through
tile coordinates in `engine/battle/core.asm`.

## Current MVP

- Trainer and Pokémon states are rendered as two separate native scenes rather
  than toggling one canvas between phases. Desktop places them side by side;
  narrow layouts stack them. Canvas remains authoritative because native
  screen coordinates, sprite hit targets, OAM-like overlays, fonts and the
  optional 8×8 inspection grid must share one pixel-perfect coordinate system.
- Clicking a party member updates only the Pokémon scene and its title. The
  trainer scene retains the selected trainer portrait, native introduction
  message and party indicator.
- Red/Blue reads the four real `PokeballTileGraphics` states and reproduces the
  six-slot enemy OAM order from `SetupEnemyPartyPokeballs`. Emerald reads the
  LZ77 `gBattleInterface_BallStatusBarGfx`, its native palette, and the full/
  empty status-ball tiles from `gHealthboxElementsGfxTable`. The party count
  therefore changes ROM-derived graphics rather than CSS circles.

- Detect candidate battle animation streams.
- List animations in a shared selector.
- Render a static battle scene at the native screen size.
- Show a read-only frame timeline.
- Show decompiled command bytes in the style of the loaded family.
- Open the active command offset in Code Editor.
- Open the currently associated graphic source in Sprite Editor when a stable
  source is known.
- Emerald static scenes decode all ten entries of the native
  `sBattleEnvironmentTable` directly from the ROM: grass, long grass, sand,
  underwater, water, pond, mountain, cave, building and plain. Every entry
  keeps its own compressed tileset, tilemap, entry graphics and three palette
  banks. Enemy front and player back
  pictures use `gMonFrontPicTable`, `gMonBackPicTable` and
  `gMonPaletteTable`; smoothing is disabled and the 240×160 screen remains the
  authoritative coordinate space.
- The scene is not a baked preview. The renderer retains a semantic element
  list with native-screen hit rectangles. Clicking the opponent, player or
  background selects that layer, outlines it and opens a shared `UiWindow`.
  Pokémon pictures and decoded environment tiles can then be opened in Sprite
  Editor; Pokémon also link directly to Pokédex.
- A trainer opened from Map keeps its semantic map bookmark. **Return to
  overworld** goes back to that map/event context, and every party card exposes
  **Pokédex**, **Edit** and (when supported) **Cry** navigation.
- International Red/Blue scenes decode the exact compressed front and back
  pictures referenced by each Species `BaseStats` record. Back pictures retain
  their native 2× scale, trainer teams resolve canonical internal Species IDs,
  and the active decompressed picture can be inspected in Sprite Editor. The
  static composition is available without presenting the still-unimplemented
  battle animation engine as decoded.
- Selecting a trainer opens the engine's introduction phase first. Red/Blue
  follows `TrainerPicAndMoneyPointers`; Crystal follows
  `TrainerPicPointers`; Emerald joins the `trainerPic` byte in its exact
  40-byte `gTrainers` record with `gTrainerFrontPicTable` and
  `gTrainerFrontPicPaletteTable`. All three paths decode the native compressed
  picture and retain its ROM offsets. Clicking a party member then changes the
  scene to the sent-out Pokémon phase instead of incorrectly drawing trainer
  and Pokémon at the same time.
- Introduction messages remain family-owned data: Gen I uses
  `{TRAINER_NAME} wants to fight!`, Crystal uses its
  `WantsToBattleText`, and Emerald uses
  `{TRAINER_CLASS} {TRAINER_NAME} would like to battle!`. The scene document
  records the message kind, template and substitutions, and the visible text
  uses the native family font wherever that font table is verified.
- Trainer pictures are semantic canvas elements. Inspecting one exposes the
  trainer class/picture IDs, compressed graphic offset, palette offset where
  applicable, and encoding; Sprite Editor receives the original decoded ROM
  resource rather than a screenshot.
- The Red/Blue workspace is intentionally compact: because it currently has
  one verified static scene, it hides animation, side, offset and timeline
  controls. Selecting any party card makes that Pokémon the active opponent
  and shows its exact front and native-scale back pictures together.
- Red/Blue exposes the single battle field actually used by its Generation I
  engine rather than inventing terrain variants that do not exist in
  `pokered`. Its field and both Pokémon sides participate in the same semantic
  selection model as GBA.
- Every Red/Blue encounter row now has a **Battle** action. It creates a
  transient encounter battle from the exact table Species and level, preserves
  the owning map link, and can return to that map. It never substitutes a
  trainer party for a wild encounter.
- GBA uses the same current-combatant interaction. Emerald keeps its decoded
  240×160 in-ROM battle background, while Red/Blue uses its native 160×144
  coordinate space. The shared renderer chooses family-specific sprite,
  healthbox and textbox rectangles instead of scaling one family's layout into
  another.

  Emerald uses two independent in-ROM font resources in this composition:
  `FONT_SMALL` for names and levels inside the OBJ healthboxes and
  `FONT_NORMAL` for the battle message window. The preview must decode both
  tables at native scale; shrinking the normal font is not an equivalent
  fallback.
- Compact Emerald party cards use each Pokémon's native 32×32 menu graphic
  and palette. The battle canvas still uses full front/back pictures. GBA owns
  the icon table and 4bpp decoding; the shared editor consumes only an
  optional icon resource, and Gen I retains its separate native picture path.
- Battle HUD graphics are ROM resources rather than canvas approximations.
  Emerald decodes the LZ77-compressed single-battle player/opponent healthbox
  sheets, `gHealthboxElementsGfxTable`, and the native OBJ palette. Red/Blue
  reads `HpBarAndStatusGraphics` plus `BattleHudTiles1/2/3`, preserving the
  engine's 1bpp-to-2bpp conversion and asymmetric HUD tile placement. Each
  healthbox and HP/status layer is a semantic hit target: clicking it exposes
  its source offset and opens the decoded graphic in Sprite Editor. Compressed
  or converted previews remain read-only so an assembled image is never
  mistaken for contiguous writable ROM bytes.
- Emerald also decodes `gBattleTextboxTiles`, `gBattleTextboxPalette`, and
  `gBattleTextboxTilemap`. The healthboxes use the two-sprite coordinates from
  [`InitBattlerHealthboxCoords`](https://github.com/pret/pokeemerald/blob/master/src/battle_interface.c):
  the opponent occupies `(12,14,128,32)` and the
  player occupies `(126,72,128,64)`. The player's main OBJ is changed from
  64×32 to 64×64 after creation, but `battle_interface.c` does not recalculate
  its `centerToCornerVec`; the hardware top therefore remains `88 - 16 = 72`.
  Treating it as a newly centered 64×64 object (`y=56`) is a documented
  regression. When these native layers are present, the compositor does not
  paint browser fonts, fabricated HP bars, or generic white boxes over them.
  Nickname and level placement follows the destination OBJ tiles used by
  `UpdateNickInHealthbox` and `UpdateLvlInHealthbox`: both occupy the same
  native text row. The preview must not place the level on a fabricated second
  row or position player text relative to the visible outline. The separate
  HP object follows `sHealthBar_Subsprites_Player` and
  `sHealthBar_Subsprites_Opponent`; relative to the composed healthbox it
  starts at `(32,16)` for the player and `(24,16)` for the opponent. The
  compositor reads the ROM's partial green/yellow/red HP elements rather than
  drawing a CSS bar. Poison, paralysis, sleep, freeze, and burn use the exact
  three-tile status IDs and palette slots from `UpdateStatusIconInHealthbox`;
  the player EXP strip uses the native eight element tiles at `(32,32)`.
  Status and HP values are rendered only when the scene source supplies them;
  a healthy trainer record is not given an invented condition.
- Sprite placement follows the decompiled engines as data. Emerald reads each
  retail agbcc `MonCoords` record corresponding to
  `gMonFrontPicCoords` and
  `gMonBackPicCoords`. The C structure has two semantic bytes (`size` and
  `y_offset`), but the retail ROM's array ABI stride is four bytes with two
  zero tail-padding bytes. Reading it as a packed two-byte array lands every
  odd Species—including #41—in padding. The single-battle centers are
  `(176, 40)` and `(72, 80)` and the species-specific `y_offset` is applied
  before drawing. Red/Blue uses
  the exact `hlcoord 12, 0` 7×7 front area and `hlcoord 1, 5` back area from
  `engine/battle/core.asm`; its front picture uses the same bottom alignment
  and rounded horizontal centering as `LoadUncompressedSpriteData`. HUD names
  also reproduce `CenterMonName`: one/two-letter, three/four-letter, and longer
  names begin at different tile columns, and a status condition occupies the
  level field instead of overlapping it.

The Gen I path keeps its independent
[`pokered` layout](https://github.com/pret/pokered/blob/master/engine/battle/core.asm):
enemy name/HUD starts at
tile `(1,0)`, player name/HUD at `(10,7)`, and the HP bars at `(2,2)` and
`(10,9)`. A condition replaces the `:L` level marker at the engine's
`PrintStatusCondition` field. Gen II has similar-looking but separately owned
[`pokecrystal` coordinates](https://github.com/pret/pokecrystal/blob/master/engine/battle/core.asm)
and remains explicitly unavailable for a full Pokémon battle scene until its
tilemap/WRAM composition is decoded; it must never silently reuse the Gen I
HUD.

## Trainer teams and map links

The shared `BattleTrainer` model lets a map event open its opponent team
directly. Gen I trainer events contain their class and number; Generation III
object scripts expose a `trainerbattle` ID.

For exact international Pokémon Red/Blue, the manifest supplies
`TrainerDataPointers`, `TrainerNames`, `TrainerPicAndMoneyPointers`, the
`TrainerAI` party boundary and `TrainerAIPointers`. PUSH decodes all 47 classes,
415 trainer records and 1,061 party members in both official formats. Map
`OPP_*` values resolve to real named classes, and every canonical party member
links to the shared Species resource.

Existing species/level fields use atomic compare-before-write project commands.
In the shared-level native format, the form explicitly says that changing the
level changes the whole party; in the variable-level format it changes only the
selected member. No party is relocated implicitly. The two official aliased
class pointers are exposed in the resource graph. English Pokémon Emerald now
uses the typed `GbaTrainerData` library for the profiled `gTrainers` table. It
decodes every 40-byte trainer header and all four party layouts (default,
custom moves, held items, or both). Level and species are correctly read as
16-bit fields—the earlier preview incorrectly treated level as one byte—and
project validation reports invalid party pointers, sizes, levels, species and
moves before export.

For exact English Pokémon Crystal Rev 0, the generated manifest supplies
`TrainerGroups`, `TrainerClassNames`, and `TrainerPicPointers`. The Gen II
library decodes all 67 classes, 541 named trainers and 1,254 party members
without converting their native record type. It supports all four official
encodings: level/species, moves, held item, and held item plus moves. The
resulting resource graph adds 1,385 explicit trainer-move references and grows
the complete Crystal graph to 4,683 nodes and 16,664 resolved edges.

Selecting a Crystal trainer decodes only that party's native 64×64 front
sprites and palettes; the 541-row selector does not eagerly decompress every
species graphic. A typed `OBJECTTYPE_TRAINER` map event reads its exact
class/number script header and opens the matching team. Existing fields are
editable with compare-before-write Undo/Redo. The editor never inserts a held
item or move list into a simpler native record.

Party insertion/removal and format conversion remain disabled until complete
owned-range allocation and multi-owner repointing are implemented. Other
revisions use the same driver API but deliberately remain read-only until
their table location is verified. This prevents a ROM hack from treating an
unrelated byte pattern as trainer data.

The decoded Emerald environment follows the exact table consumed by
[`pret/pokeemerald/src/battle_bg.c`](https://github.com/pret/pokeemerald/blob/master/src/battle_bg.c).
Only backgrounds with a pinned ROM profile are presented as exact; another
game never receives Emerald graphics as a visual fallback.

## Editing Boundary

Battle editing should be added only after the relevant table is proven for a
specific ROM profile. Existing trainer writes use `MemoryUtils.replaceAll()`
and the project command stack with exact expected/next bytes. Future battle and
animation writes must preserve that compare-before-write rule.

Expected later edits:

- change a move animation pointer;
- edit frame durations;
- change battle palettes;
- change a battle background;
- patch animation scripts;
- round-trip command source through a family-specific codec.

## Map-owned environments and linked graphics

## Generation I native pictures

The Generation I battle stage, hit targets, inspector and Sprite Editor share
one decoded resource per Pokémon side: the exact compressed BaseStats picture
pointer decoded into its native 2bpp tiles. Front images remain 7×7 tiles and
back images remain 4×4 tiles at their native battle positions; no placeholder
or separately reconstructed sprite is used.

For Emerald, a trainer opened from Map Editor carries a resolved battle
environment. The resolver follows the verified `BattleSetup_GetEnvironmentId`
inputs available in the ROM document: map type, weather and the trainer cell's
metatile behaviour. Runtime-only avatar/bridge state is not guessed. If the
environment cannot be proven, the GBA scene reports that limitation instead of
showing a default background.

The environment is therefore not editable in Battle Editor. Map block
properties show a native preview of the environment selected by that cell;
changing the relevant map property is the authoritative workflow.

Emerald healthbox graphics and battle backgrounds require an exact source
manifest. LZ77 decoding validates the stream header and bounds and fails closed
for revisions or hacks whose asset tables moved. Pokémon hit targets in the
scene open Sprite Editor with both native front and back resources, initially
focused on the side that was clicked.

## Native scene coordinates

Static previews use family-owned screen coordinates rather than shared visual
guesses:

- Emerald singles use the engine centres `(72, 80)` and `(176, 40)`.
  `gMonBackPicCoords` / `gMonFrontPicCoords` provide vertical displacement,
  and the opponent additionally subtracts `gEnemyMonElevation`. Trainer front
  pictures use centre X `176` and the native 64×64 mounting position.
- Red/Blue copies the opponent or trainer picture to tile `(12, 0)` and the
  player back picture to tile `(1, 5)`, through the visible 7×7 battle-picture
  area.
- Emerald message text follows `B_WIN_MSG` (`tilemapLeft = 2`,
  `tilemapTop = 15`, local Y `1`). Healthbox labels use the small-font path and
  must not be painted with full 16×16 message glyphs.
