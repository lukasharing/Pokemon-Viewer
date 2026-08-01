# Map editor guide

## Interface roles

The map workspace separates three UI roles. **Toolboxes** form one thin,
bottom-centred bar: grouped separators distinguish editing, layers and camera
without making users chase several floating controls. **Windows** are movable,
closable inspectors such as Blocks, Minimap data and event details. **Panels**
are persistent context in the right dock. Maps, Details, Encounters and History
are tabs of one panel region, so a large list can never squeeze another panel
into an unusable strip. Their state is preserved while another editor is open.

The Encounters tab is map-aware. Map-owned grass, water, static and Super Rod
sources are ordered before global rod data. Global Old/Good Rod sources remain
available because the Gen I engine reuses them on every valid fishing tile,
but they are explicitly labelled as global. Period is hidden when there is no
real time choice, engine-defined rates never display `null/256`, and each exact
Species row shows a ROM-derived miniature and readable name, then links to
Pokédex, Battle and its bounded encounter edit. Chance, Pokémon and level
columns use the shared sortable-table behavior; compact actions use the common
small button scale so the panel never grows wider than its dock.

The Details tab uses the selected map name as its panel header,
keeps attributes in one compact key/value table, and separates the event list
from map metadata. Coordinates stay secondary, actions live in the panel
footer, and technical offsets continue to follow Simple/Nerd visibility
instead of competing with the map name.

The map editor uses one interface for GBA and GB/GBC. The visible windows and fields adapt to the structures supported by the loaded game.

The initial tool is always **Move / Grab** for every ROM family. Painting and
event movement require an explicit tool selection, so opening a map and
dragging it cannot accidentally modify ROM data.

## Navigate

- Select a map in the right-hand map list.
- Double-click any rendered connected map to enter it.
- Open a warp event and choose **Enter warp** to follow its destination.
- Every successful map change fits and centers the newly active map in the
  middle of the viewport. Connected maps remain rendered around it, but never
  determine the initial camera position. GBA applies this after its camera
  canvas is rendered; GB/GBC and Crystal share `focusCanvasRect`.
- Drag with the move tool to pan. Wheel/zoom controls zoom around the pointer.
- Trackpad, mouse-wheel and pointer deltas are normalized and capped. Zoom is
  continuous and anchored beneath the pointer; pan uses reduced gain for
  precise positioning on Retina trackpads and conventional pointing devices.
- **View → Center map** restores focus to the selected map.
- The thin **Map / Minimap** switch is not a zoomed-out map canvas.
  **Map** is the editable, connection-composed world. **Minimap** is the
  240×160 map used by Fly and wall-map screens, decoded from the loaded ROM's
  native tiles, tilemap and palette. The active `regionMapSectionId` is
  highlighted; clicking a known section opens its first matching outdoor map.
  Unsupported profiles disable this switch instead of drawing a substitute.
  Fly overlays show only destinations present in the game's Fly table; ordinary
  route landmarks remain part of the Town Map data but are not presented as
  Fly destinations.

### Minimap

This view is the game's actual Town/Region Map shown by Fly and compatible
wall-map interactions. It is independent from the editable overworld map and
is reconstructed directly from the ROM's native graphics structures.

The view switches the contents of the Map Editor's single left toolbox; it
never creates a second bottom toolbar. The Minimap tool set starts with three
document tools: **Select**, **Paint tile**, and **Pick tile**. It also exposes two explicit
layers: **Tiles** edits the 8×8-cell tilemap and **Fly locations** selects the
destinations drawn over it. Choosing a tile activates Paint; click or drag
paints complete native cells. Select and Pick remain non-destructive. A single click selects a cell or destination,
double-click opens an associated outdoor map, and **Edit location** changes its
native tile rectangle with normal project Undo/Redo. Local-map paint, event, block,
collision, encounter, and tileset HUD panels are hidden because they do not
operate on the Minimap resource. Wheel and pinch zoom remain pointer-anchored.
Zoom-out stops at a content-derived minimum: the native Minimap always keeps a
useful share of the viewport instead of shrinking into empty workspace. The
limit is recalculated when the editor is resized.
While Minimap is active, the local-map sidebar is removed from the editor grid
and the main surface becomes one full-width column. Hiding a panel must never
leave its grid track behind or crop the right side of the native Minimap.
The family driver owns all writes. Generation I recompresses its nibble RLE
tilemap only when the result fits the original allocation. Crystal writes its
native 20×18 `JohtoMap` or `KantoMap` byte cell directly. GBA writes the real
affine-8bpp (Emerald) or text-4bpp (FireRed) tilemap entry, then recompresses
the complete LZ77 document. The writer is allocation-bounded: it commits only
when the new stream fits the original compressed resource, including the
verified 4-byte padding owned by the source `u32` array. Padding is used only
when the ROM actually contains filler bytes, which keeps modified ROM layouts
safe. Otherwise the editor shows an explicit relocation-required error without
changing ROM bytes. Destination
tables remain independently editable. Every cell edit owns an atomic byte plan:
Undo restores the original compressed stream byte-for-byte and Redo reapplies
the already validated stream. No family silently falls back to pixels.

**Open map** and double-click resolve the selected Minimap section through the
active family driver, return to Map View and focus the matching outdoor map in
the connected-world renderer. If unsaved navigation is cancelled, the Minimap
view remains open.

The local-map renderers share the same overlay primitives in every family:
event colors and glyphs, bottom-centred overworld sprites, grid alignment,
selection rectangles and layer visibility. Events remain
visible at every useful zoom instead of disappearing below a GBA-only cutoff.
Canvas output remains nearest-neighbour while continuous gesture scaling gives
trackpads, touchscreens and mouse wheels precise control.

The Minimap toolbar can show an 8×8 tile grid. Two movable windows keep the
canvas as the main view: **Minimap tiles** is the selectable native tile palette,
while **Minimap selection** shows either cell/tile properties or destination
geometry and its contextual actions. Gen I tile graphics open directly in
Sprite Editor. Selecting a border-pattern preview is deliberately separate from
painting it: a click only selects the pattern cell; **Use selected block** is
the sole write action.

Changing maps after editing offers three explicit choices:

- **Open and keep changes** keeps the applied ROM bytes and History, then opens
  the destination map.
- **Discard and open** undoes only commands made since the current map was
  opened; accepted edits from earlier maps remain intact.
- **Keep editing** cancels navigation.

This allows a single session to edit several maps without repeatedly discarding
previous work. The same navigation contract applies to the map list,
double-clicked connected maps, and warp navigation in both ROM families.

## Inspect and edit

- Open **Details → Map scripts** to inspect scripts owned by the map lifecycle,
  independently from coordinate/object/background events. Selecting a row opens
  its real ROM target in Code Editor with the owning pointer retained for safe
  relocation.
- GBA follows `MapHeader.mapScripts`: `On load`, `On frame`, `On transition`,
  `On warp into map`, `On resume`, `On dive warp`, and `On return to field`.
  `On frame` and `On warp into map` point to conditional var/var tables rather
  than event bytecode; the panel expands those tables and opens only their real
  script targets. This prevents table bytes from being decompiled as commands.
- Crystal follows its two counted resources: scene scripts are indexed by the
  map scene state, while callbacks are typed as Tiles, Objects, Command queue,
  Sprites, or New map. They stay visibly distinct in the shared panel.
- Red/Blue does not have the same event-script table. Its map-header pointer is
  an LR35902 map controller that commonly dispatches a map-specific state
  variable. The panel therefore opens native disassembly, not fabricated GBA
  event syntax.
- Click an event or its entry in the Events list to inspect its typed properties.
- Objects use their overworld sprite when graphics can be resolved.
- Warps, signs/background events, scripts, trainers, and items retain their game-specific fields.
- Double-click a tileset block or use **Open sprite** on an entity to continue
  in Sprite Editor. Red/Blue blocks retain a verified ROM segment per displayed
  tile, so their assembled 4×4 graphic can be painted and undone safely even
  when tile IDs repeat. Compressed GBA/Crystal block previews remain read-only
  until a family-specific recompression writer is available.

The picker always reveals the existing **Blocks** window, restores it when
minimized, switches to the correct primary/secondary group, and scrolls the
chosen block into view. GBA, GB and GBC use the same `MapWindowManager.reveal`
contract instead of implementing independent window-opening behavior.
- Use the context menu to pick a block, fill a region, center the view, copy coordinates, or inspect events.
- GBA supports painting, selections, event creation, elevations, and reversible commands.
- Right-click a GBA map cell and choose **Edit block properties** to change its
  native 0–63 elevation. The shared packed-block utility preserves the
  metatile's lower 10 bits, writes the real 16-bit layout word, refreshes the
  collision/height layer, and records one Undo/Redo command.
- The same GBA dialog edits the selected metatile's native behavior and layer
  attributes. Ruby/Sapphire/Emerald preserve a 16-bit record (`behavior` in
  bits 0–7 and `layer type` in bits 12–15). FireRed/LeafGreen preserve their
  full 32-bit record and expose behavior, terrain, two unknown fields,
  encounter type, another unknown field, layer type, and bit 31 independently.
  Unknown bits are never cleared when another field changes. Metatile
  attributes are shared by every map using that tileset; elevation remains
  local to the clicked cell. Both byte ranges are committed as one Undo/Redo
  command, and the collision layer labels cells with their native behavior ID.
- **Event → New…** creates a persistent GBA object, warp, coordinate trigger, or signpost. The fixed-stride table is copied to aligned `$FF` free space, then its count and ROM pointer are updated together. Existing events are rebound to their relocated offsets.
- **Delete event** in a GBA event inspector rebuilds the same table without that entry. Creation and deletion restore the original count, pointer, bytes, and model when undone.
- GB/GBC supports painting one-byte Gen I blocks, picking a block from either the map or tileset, and flood-filling a connected region. Every operation writes the block layout in ROM and can be undone.
- Gen I objects, warps, and signs can be created and deleted. Because their records share one variable-size object block, the editor rebuilds the whole block in `$FF` space inside the map header's original bank and updates its 16-bit pointer. The GBA-only coordinate-trigger command is hidden for GB/GBC.
- Drag with **Selection** to mark a rectangular area; hold Shift to add another area. **Fill selected areas** changes all unique selected blocks as one history command.
- Move a GB/GBC warp, sign, person, trainer, or item with **Move events**. Object coordinates are automatically converted to and from the `+4` representation used by `pret/pokered`.
- **Edit properties** exposes safe fixed-size GB/GBC fields: position, warp destination, text ID, sprite and movement data, item ID, or trainer identifiers according to the event type. Variable record sizes and packed type bits are preserved.
- Moving a GBA object, warp, script trigger, or signpost writes its signed X/Y fields back to the event structure. The move appears in History, supports undo/redo, and is included in ROM export.
- **Edit properties** in the GBA event inspector changes safe in-place fields without pointer relocation: coordinates, elevation, object sprite/movement/trainer data, warp destination, coordinate-trigger values, and signpost type. Applying the form creates one undoable command.
- Adding a global **★ bookmark** while Event properties is open remembers the
  map, typed table index, and a semantic fingerprint that excludes coordinates
  and physical ROM offsets. Reopening it selects the map, follows a uniquely
  shifted event when possible, centers the camera, and restores Event
  properties. A deleted, replaced, or ambiguous event is reported as stale and
  is never substituted with an unrelated record.
- Event properties and map dimensions use the same validated typed-form
  dialog. Numeric limits come from the structure schema, zero remains a valid
  value, and drivers receive numbers rather than reparsing input strings.
- GB/GBC exposes its real Gen I collision model without inventing GBA elevation data.
- Right-click a Red/Blue cell and choose **Edit block properties** to edit the
  native passable-tile list for the tiles used by that metatile. Checkboxes
  represent real 8×8 tile IDs. Because the list belongs to the tileset, the
  dialog warns that a tile reused by other blocks or maps changes there too.
  Growing the `FF`-terminated list safely relocates it inside its original
  16 KiB bank and updates the tileset pointer; Undo restores both bytes and
  pointer.
- Choose **Map → Resize…** or **Resize map** in Properties to change the block
  dimensions. Both families preserve the top-left overlap and initialize new
  cells with block 0. GBA relocates the 16-bit block layout and updates its
  32-bit layout pointer when required; Gen I relocates its one-byte layout
  inside the original 16 KiB bank. Dimensions, pointer, block bytes, rendering,
  and Undo/Redo are one atomic operation.
- Choose **Map → Connections…** or **Connections** in Properties to edit an
  existing neighbour. GBA exposes direction, signed perpendicular offset,
  destination bank, and destination map. Gen I exposes destination map,
  connection length/width, and signed X/Y placement while keeping its
  direction flag and internal block/window addresses protected. Applying or
  undoing a connection immediately rebuilds the composed world.
- The same **Connections** dialog creates and removes neighbours. On GBA the
  editor relocates the count/header and fixed 12-byte connection table, then
  updates the map-header pointer. On Gen I it follows the `pret/pokered`
  connection macro (north, south, west, east), calculates the block, overworld
  buffer, window, width and signed placement fields, relocates the complete
  variable-size map header inside its original 16 KiB bank, and updates
  `MapHeaderPointers`. Existing bytes are never expanded in place.
- Connection fields use the same typed schema controls as event properties and
  resize. Direction selectors resolve to numbers, signed offsets obey their
  declared ranges, and invalid input is stopped before a writer runs.
- Gen I and Crystal permit one neighbour per cardinal direction. The creation form only
  offers directions not already present. Creation, deletion and Undo/Redo
  rebuild the composed world immediately.

## Pokémon Crystal

International Pokémon Crystal revisions 0 and 1 use an independent Gen II
driver. Opening Map Editor lazily loads only the common map UI and Gen II
structures; it does not load the Gen I or GBA map driver.

Available today:

- browse all 388 maps in the 26 canonical map groups;
- render native 4×4 metatiles from Crystal's compressed 2bpp tilesets;
- apply the official per-tile palette map with the standard day palettes;
- compose north, south, west, and east map connections;
- inspect warp, coordinate, background, and object events;
- render Crystal object events with their real overworld sprite and palette;
- enter a warp or double-click a connected map to navigate;
- zoom at the pointer, pan, fit, show the grid, and inspect collision values;
- right-click a map cell and choose **Edit block properties** to edit the
  metatile's four native collision bytes (northwest, northeast, southwest, and
  southeast). The values remain raw Crystal collision IDs rather than being
  reduced to an inaccurate passable/blocked switch; applying them is one
  reversible History command;
- double-click a block in Blocks to open its assembled graphics in Sprite
  Editor.

An Object inspector also exposes **Open sprite**. It opens the corresponding
entry from Crystal's verified 102-record `OverworldSprites` table in Sprite
Editor. Pixel changes are written to the native 2bpp tiles and invalidate the
map sprite cache immediately.

Crystal supports reversible painting, block picking, flood fill, multiple
selections, moving existing events, and editing the fixed fields of warps,
coordinate events, background events, and objects. Object coordinates preserve
their stored `+4` form, and palette/type edits preserve the packed nibble byte.
Every operation appears in History and ROM export.

**Event → New…** creates any of Crystal's four event kinds at the most recently
hovered map block. **Delete event** removes the selected record. Both operations
preserve the two leading filler bytes and every untouched record, rebuild the
four counted tables in canonical warp/coordinate/background/object order,
allocate within the original `scriptsBank`, and update the 16-bit event pointer.
Undo restores the former pointer and clears the temporary allocation.

**Map → Resize…** changes Crystal dimensions with the same shared dialog. The
top-left overlap is preserved, new cells use block 0, and a growing layout is
relocated to free space. The attribute's bank-first `dba` block pointer, width,
height, bytes, scene and Undo state are updated atomically.

**Map → Connections…** uses the same shared connection dialog as GBA and Gen I.
It edits destination group/map and the perpendicular offset, recalculating the
official `pokecrystal` block, overworld-buffer, window, length, width and signed
placement fields. Creation and deletion rebuild the variable attribute tail in
north/south/west/east order with the canonical `E=1, W=2, S=4, N=8` mask. If
the tail grows, the complete attributes structure is relocated and the owning
map-group `dba` pointer is updated. All three operations redraw the composed
world immediately and support exact Undo/Redo.

## Layers and windows

The Tools window switches between combined, map, event, and collision views. Grid controls are independent. **View → Windows** toggles Blocks, Tools, Properties, and other available panels.

Connected maps use the same compact boundary and name treatment in both
families. In GBA the label and border compensate for camera zoom, so names stay
readable without growing over the map; in GB/GBC the same renderer is applied
to the composed `MapScene`.

### Generation I border pattern

The composed Generation I map canvas is intentionally a base-world view: event
sprites are only drawn in **Events focus**, so an object cannot be mistaken for
map artwork or be duplicated over an animated/map tile. Empty space in the
bounding rectangle of connected maps is filled with the real `border` byte at
the start of the current map's object block—the same repeating metatile used by
the engine when there is no connected map at that side. In `pokered` each map
block expands to 4 × 4 hardware tiles; the editor therefore presents **View →
Windows → Border pattern** as one compact 4 × 4 preview, not as a second
tileset atlas. Clicking the preview selects the border cell only; it never
changes the active block or paints the map. **Open block** reveals that cell's
native block in the shared Blocks window. The user can then choose another
block and press **Use selected block**; the verified border byte is written
with Undo/Redo.

Generation II exposes the same workflow over `MapAttributes.border_block`.
Its renderer and writer remain in the Gen II driver; it does not reuse Gen I
offsets. GBA exposes every native border-pattern cell independently. Selecting
a cell only marks it; **Open block** opens its metatile in Blocks, and applying
the selected block replaces only that cell's metatile index while preserving
the remaining 16-bit border attributes.

The Minimap implementation follows the official engines rather than map
connections. Emerald uses the 28×15 Region Map grid, 8bpp affine background
and `gRegionMapEntries` described by
[`pret/pokeemerald/src/region_map.c`](https://github.com/pret/pokeemerald/blob/master/src/region_map.c).
FireRed uses its separate Kanto 4bpp background and 22×15 navigation grid from
[`pret/pokefirered/src/region_map.c`](https://github.com/pret/pokefirered/blob/master/src/region_map.c).
Both games load compressed background graphics and tilemaps independently;
the editor mirrors that ownership by changing tilemap entries, not rasterized
preview pixels.

Crystal uses the exact pinned `pokecrystal` Town Map resources rather than a
scaled overworld canvas: LZ3 `TownMapGFX`, the 20×18 `JohtoMap` and `KantoMap`
tilemaps, `TownMapPals`, Pokégear palettes, `Landmarks` and `Flypoints`.
Selecting a landmark can navigate to its associated map. Editing a landmark
coordinate updates only the two verified coordinate bytes; compressed tiles
remain read-only until a recompressor and relocation writer are proven.

## Overworld movement and trainer sight

Object overlays use the engine's initial-facing semantics instead of always
showing frame zero. Generation I reads the fixed direction from the native
`range-or-direction` byte and uses the down, up, or side 16×16 ROM image (the
right-facing pose mirrors the native left-facing image). Its exact fixed values
are `$D0` down, `$D1` up, `$D2` left and `$D3` right; they must not be decoded as
packed direction bits. Generation II instead derives the initial pose from its
movement-type IDs (`6` down, `7` up, `8` left and `9` right). Generation III
resolves the initial direction from `gInitialMovementTypeFacingDirections` and
selects the corresponding image in the object's `ObjectEventGraphicsInfo`
image table. Emerald's east animations reuse the west/side frame and set
`hFlip`, just as Red/Blue's `FlippedOAM` reuses its left frame with `OAM_XFLIP`.

These rules live in three isolated movement profiles under `map/gba/`,
`map/gbc/`, and `map/gen2/`. The shared movement service only dispatches to the
active profile. Never merge their numeric movement tables: identical numbers
do not have identical meanings across the three engines. The contracts are
verified against `pokeemerald`'s `object_event_anims.h` and
`event_object_movement.c`, `pokered`'s `facings.asm` and
`map_object_constants.asm`, and `pokecrystal`'s
`map_object_constants.asm`.

Trainer sight is drawn as an eye on each detectable cell only when the event
contains a verified trainer range. The map remains on the initial pose even for
turning or moving behaviors. Inspecting the object opens a reusable 7×7 preview
which samples the actual local map artwork, runs at the hardware VBlank cadence
(approximately 59.73 Hz), advances one pixel per tick during each native 16-tick
step, and simulates facing, idle cadence, movement radius, collision, and the
current sight direction. The preview never draws editor grids, collision colors,
map frames, selections, or event markers. Gen I and II compose the current map
over its native repeated border block, so cells outside the layout remain game
artwork rather than an editor boundary. Generation I samples the tileset collision list;
Generation III reads the map cell collision and elevation bits. The simulation is a deterministic inspection
of the ROM behavior parameters; it does not mutate ROM or emulator state.

## Experience

Simple experience shows named maps, typed events, visual tools, semantic
actions, and the width/height resize form. Nerd experience additionally exposes
ROM offsets, banks, pointers, structure sizes, raw IDs, and detailed script
associations. Both modes execute the same resize command.

For pinned Emerald maps, block properties also show the battle environment
that the engine derives at that cell. This preview uses the same resolver and
ROM background decoder as Battle Editor, so the map—not a battle-local
dropdown—owns environment changes.

## Bounded world rendering

The logical connection graph and the rasterized canvas are deliberately
separate:

- GBA renders connected maps through its camera and caps corrupt or cyclic
  traversal at 128 scheduled headers.
- Gen I and Gen II retain the discovered connection graph, while the canvas
  accepts at most 64 nearest maps, an 8192-pixel axis, and roughly 12
  megapixels of backing storage. A malformed connection can no longer request
  an unbounded browser allocation.
- Only map nodes intersecting the viewport plus a small overscan are painted.
- Within an intersecting map, only visible 32 × 32 blocks are decoded into
  `ImageData`; collision and grid overlays use the same visible bounds.
- Scroll repaint is coalesced through one animation frame. Rapid trackpad
  movement cannot queue an independent full-world render for every event.

Canvas bounds are a rendering safety policy, not a binary-data fallback. Map
structures and connections remain exact family-driver data. An individual map
whose native dimensions exceed the safety budget fails explicitly instead of
crashing the tab.
# Native border patterns

The local-map canvas paints the active layout’s native border before connected
maps. Emerald follows `GetBorderBlockAt`: its border is always a 2 × 2
metatile pattern. FireRed/LeafGreen reads `MapLayout.borderWidth` and
`borderHeight` instead. The compact **Border pattern** window shows that exact
ROM data; selecting a cell only marks the target. **Open block** reveals the
corresponding metatile in Blocks and **Use selected block** writes that selected
cell through project Undo/Redo.
Events, collision overlays and map frames are never copied into the repeated
background.
