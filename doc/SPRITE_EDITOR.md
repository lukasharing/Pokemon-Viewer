# Sprite editor guide

The workspace now follows the shared editor shell: a thin reusable toolbar,
a source panel, the central pixel canvas, and a contextual palette/properties
inspector. Undo/Redo, zoom, actual pixels, grid, refresh, help, and focus mode
stay in the same predictable toolbar positions used throughout the application.

Opening and painting are bounded operations. Overworld catalog discovery is
cached per active ROM, Gen I/II scans reject candidates from their first typed
record before validating a whole table, and each group list is materialized
once. Palette colors are converted once per canvas render and pointer painting
is coalesced to one render per animation frame instead of repainting for every
raw pointer event.

The GBA Pokémon catalog also avoids building the complete species resource
graph during construction. It decodes only the selected front/back/icon asset;
reference-oriented editors remain responsible for populating the full graph.

Generation III Pokémon links use one normalized `GraphicSource`: the selected
front/back species frame supplies its exact decompressed 64×64 bytes and its
own 16-color ROM palette. The catalog shows a temporary **Linked · …** entry
instead of incorrectly claiming that the first overworld sprite is selected.
Compressed Pokémon graphics and palettes remain exact read-only previews until
deterministic LZ77 recompression and pointer-safe writing are available.

The shared Sprite Editor consumes a codec installed by its family runtime:

- GB/GBC: 2 bits per pixel.
- GBA: 4 bits per pixel, including decompressed linked graphics when available.

Overworld state and direction choices occupy one persistent dock at the bottom
of the workspace, leaving the canvas as the primary view. Native states are
named by meaning (South, North, West, walk frames), not anonymous State 1/2/3.
When the engine derives East from the West image, the dock exposes a rightmost
**Horizontal flip** control and selects it automatically. Flipped painting maps
the pointer back to the unflipped source coordinate, so the editor changes the
real shared ROM pixels rather than inventing a duplicate east-facing frame.
GBA, Gen I, and Gen II catalogs each determine their own state list and flip
capability; the shared editor only renders that contract.

For supported GBA and international Red/Blue ROMs, the **Graphic** selector
opens the verified overworld-sprite catalog directly; opening Map Editor first
is not required. Gen I entries resolve their banked 2bpp address and remain
editable. GBA entries resolve `sprite_header`, the first image descriptor, and
the linked palette tag. `SpriteFrameImage` stores a pointer and fixed byte
length for raw 4bpp graphics; it is not an LZ stream. The catalog verifies that
exact range and permits in-place pixel editing while palette colors remain
editable at their verified BGR555 address.

Pokémon Crystal uses the isolated Gen II runtime and its complete 102-entry
`OverworldSprites` catalog. Entries preserve the native six-byte
address/length/bank/type/palette record, resolve their uncompressed 2bpp
graphics, and use the official daytime NPC palette. They are directly editable
and Map Editor refreshes every visible object using the changed sprite.

When a map entity supplies its palette, that linked palette is selected
automatically and the redundant palette-source selector is hidden. GBA
overworld colors come from the sprite's decoded 16-color palette tag; Gen I
uses the four colors of its classic display palette. For raw graphics without
a linked palette, changing **Palette source** changes only how color indexes
are displayed. Painting still writes the selected pixel index, so preview
choices never rewrite palette data implicitly.

The palette itself is the paint-color control; there is no duplicate ink
dropdown. Colors form a square grid derived from the codec color depth:
four-color graphics use 2×2 and sixteen-color graphics use 4×4. Selecting a
swatch chooses that exact pixel index and exposes its index and hexadecimal
color through the accessible name and tooltip.

When a GBA overworld supplies a verified palette address, **Palette color**
and **Apply palette color** edit its BGR555 color in ROM. The change is one
undoable History command and every map sprite using that shared palette slot
refreshes immediately. A palette can be shared by several sprites, so changing
one color may intentionally affect all of them. Gen I's display palette has no
per-sprite ROM palette pointer; the write controls stay hidden instead of
claiming that preview colors are editable.

Simple experience describes the palette as editable, linked, or preview-only.
Nerd experience additionally shows the verified palette ROM offset. The color
grid and palette editing action are available in both experiences.

Open graphics from a map entity or double-click a tileset block. Adjust zoom
and palette, select a color square, then click or drag on a pixel to paint. A
complete pointer stroke is one History command and can be undone with
Ctrl/Cmd+Z.

The header **View** menu and the sidebar slider share one zoom state:

- **Zoom in** and **Zoom out** move through the supported `1×–8×` range.
- **Actual pixels** returns to `1×`.
- **Pixel / tile grid** overlays subtle pixel boundaries at useful zoom levels
  and stronger eight-pixel tile boundaries at every zoom.

The grid is rendered after the decoded image and is never encoded into the ROM.
Changing zoom or grid visibility does not clear the selected graphic, palette,
paint color, command history, or edits. These controls are identical in Simple
and Nerd experiences.

The global **★ bookmark** action remembers the current catalog entry or
verified ROM segments together with tile count, columns, palette selection,
zoom, and grid. Opening it restores that visual workspace after verifying the
loaded game identity. Bookmarks never contain copied ROM bytes. A temporary
decompressed preview with no stable catalog/segment reference must be reopened
from its map or event, and PUSH reports that limitation instead of decoding a
different raw offset.

Graphics decoded directly from a contiguous ROM address are editable and are
included in ROM export. Linked bytes are compared with the claimed ROM range
before painting is enabled. This makes Gen I overworld sprites and GBA
overworld frames editable: the legacy GBA path only unpacked the two 4bpp
nibbles for rendering, so repacking them reproduces the original contiguous
bytes exactly.

International Red/Blue metatile blocks are also editable even though their 16
tiles are not necessarily contiguous. The shared `GraphicSource` utility
verifies a ROM segment for every displayed tile, including repeated tile IDs,
and translates each painted virtual tile back to its real 2bpp address.
Undo/Redo updates both the assembled canvas and every affected ROM segment.

A raw GBA tileset block uses the same segmented contract. Each metatile entry
selects a primary or secondary 32-byte tile through its `0x200` tile bit, and
the editor verifies every resulting ROM range before enabling painting. A
stroke refreshes the decoded tileset and all cached metatile images
immediately. If even one referenced source has `Tileset.isCompressed`, the
whole assembled block remains **Preview only** rather than mixing safe and
unsafe writes.

A Crystal metatile or a genuinely compressed GBA tileset remains labelled
**Preview only**. Its displayed bytes came from decompression and cannot safely
be written back without a verified recompression and pointer-relocation path.
The editor deliberately does not pretend that the decompressed order is a
linear ROM range.

Applying, undoing, or redoing a sprite stroke emits a graphics-change event.
Open Map Editors invalidate their overworld sprite caches immediately, so an
edited entity updates without reloading the ROM. The GBA map renderer rebuilds
that cache from mutable `RomMemory` with the same `GbaSpriteCodec` used by
Sprite Editor; it does not keep a second nibble decoder or read the original
snapshot.

Simple experience focuses on the linked graphic, palette, ink, and visual canvas. Nerd experience additionally exposes the source ROM offset, tile count, and column layout for manual decoding. Both experiences have the same painting and undo/redo capability.

## Multiple linked views

A sprite request can now contain several related `GraphicSource` documents.
The editor renders them as explicit view tabs while keeping one active editing
source. Battle Editor uses this contract for a Pokémon's front and back
pictures; direct map and tileset links still open a single source by default.
Each view retains its own palette and write-safety metadata, so switching views
cannot accidentally reuse the previous source's colors or ROM range.

Catalogued overworld graphics use that same contract for their native states.
Red/Blue divides each verified `0xC0`-byte banked sprite into its three
four-tile states, Crystal divides twelve-tile records into three states, and
Generation III enumerates the contiguous `SpriteFrameImage` records declared
by `ObjectEventGraphicsInfo`. The state strip changes the active editable ROM
range without changing the selected graphic. Bookmarks retain the active
state.

Generation III palette ownership follows the pret structure exactly:
`paletteTag` is the key stored in `gObjectEventSpritePalettes`, while
`paletteSlot` is only a four-bit runtime allocation slot. They are not
interchangeable. A catalog entry with no matching native tag fails explicitly
instead of silently displaying a grayscale palette.

The canvas, source list and toolbox participate in one focus contract. Pointer
focus is visible, non-focused panes are subdued, and toolbar actions always
operate on the current view. The GBA environment palette path also preserves
the native background palette bank before creating a linked source, preventing
undefined palette entries from reaching the color decoder.

## Groups and mounted live result

The source panel now divides assets by intent: overworld graphics, Pokémon,
speech boxes, battle scenes and minimaps. `sprites.Compositors` is the common
registry contract; it contains no family geometry. The GBA compositor lives in
`sprite/gba/`, the GB/GBC compositor in `sprite/gbc/`, and Crystal keeps an
independent `sprite/gen2/` implementation. Each family owns its native screen
dimensions, dialogue geometry, font selection, colors and scene layout. The
shared editor asks the registered compositor for a semantic composition and
only mounts the returned canvas/status.

Do not restore `family === "gba"` branches to `sprite/editor.js` or
`sprite/compositor.js`. Similar-looking window sizes are separate engine facts,
not a reason to merge family implementations. A regression test enforces this
boundary and checks that every runtime loads exactly one family compositor.
This is also the intended bridge for Battle Editor’s background, HUD and
front/back sprites; the battle canvas itself remains its authoritative
interactive composition.

Catalog availability is data-driven. The shared editor displays only groups
whose active family provider can return native resources; it does not leave an
empty Items, Berries, Battle or Minimap choice visible as a promise. This is a
view concern only: the shared editor never discovers family offsets or imports
a different editor's decoder to make a group appear.

Generation III Pokémon are supplied directly by
`sprite/gba/pokemon-catalog.js` and `gba.GbaSpeciesData`. The Sprite workspace
does not load or call the Battle sprite catalog. A species exposes its exact
LZ77 front picture, optional Emerald second front frame, back picture, and
native raw 32×32 menu icon when the matched profile owns that table. The
compressed battle pictures remain exact read-only sources; the raw menu icon
and its verified BGR555 palette remain editable. This boundary is enforced by
the family-dependency check so scene coordinates can never become a
prerequisite for browsing Pokémon graphics again.

The **Battle scene** group lazily initializes the Battle Editor and mounts its
current native scene rather than constructing an empty generic canvas. Its
**Scene item** selector lists only layers with a verified ROM resource:
background, Pokémon pictures, healthboxes, textbox and other family-owned
assets when present. Selecting an item opens that source in the pixel canvas
without discarding the mounted scene. Graphic writes, palette writes,
Undo/Redo and external `romgraphicschange` events repaint both the focused
source and the Battle/Sprite live views on the next animation frame.

Speech boxes expose the native screen geometry immediately: Generation III
dialogue uses the 30×6-tile field window family while GB/GBC dialogue uses its
20×4-tile field window family; menu variants use taller layouts. These are
engine-layout previews, clearly marked as such. Frame graphics are not
presented as editable ROM bytes until a manifest supplies a verified graphics
table for the loaded game. Pokémon and minimap groups likewise require a
native source opened by Pokédex, Map or Battle rather than guessing a raw ROM
offset.

## Native scene resource catalogs

The scene groups are profile-owned catalogs, not address scanners. Their
manual schema is offset-free: it names the native graphics/palette
relationships, compression and tile layout, while `MemoryProfile` supplies
every address. Exact stock manifests obtain those symbols from pinned source
builds; a derived ROM can provide its own symbols. A missing group fails
locally and selecting a group never imports resources from another family:

| Family/profile | Intro and title | Bag | Badges |
|---|---|---|---|
| Emerald EN Rev 0 | Volbeat, Torchic, Manectric, Flygon, Brendan, May, Rayquaza, clouds, lightning, bubbles, title Rayquaza, title shine/clouds and Press Start frames | Brendan and May pocket-state sheets plus the bag-menu tiles | Native Hoenn Trainer Card sheet |
| Red/Blue INTL Rev 0 | Gengar, Nidorino/Jigglypuff states, logo, player and Game Freak title graphics | Not exposed: these games do not contain a standalone bag illustration equivalent to the later Pack screens | Native Kanto Trainer Card sheet |
| Crystal INTL Rev 0 | Suicune, Pichu/Wooper, background, Unown/pulse and Crystal title assets | Male Pack, female Pack and Pack menu tiles | Native Johto Trainer Card sheet |

Raw GB/GBC 2bpp resources are editable in place. Emerald scene graphics and
the compressed Crystal intro/title assets remain read-only because their
display bytes are decompressed; PUSH will not overwrite compressed input with
an unrelated linear tile buffer. Verified raw BGR555 palette words remain
independently editable where the catalog supplies their ownership.

These entries are native resource sheets, not a claim that PUSH executes the
complete intro, title, bag, or Trainer Card state machine. A mounted 1:1 scene
still requires the corresponding engine interpreter, tilemaps/OAM, task flow,
timing, blending and input-independent branches.

The palette is always a compact, border-light 2×2 or 4×4 color grid. It is both
the color selector and, when an exact palette word exists, the palette editor.
There is no numbered duplicate grid and no permanent palette dropdown. A
synthetic transparent/preview color has no ROM owner and therefore cannot be
written.

The **Minimap** group lazily opens the family Map workspace and consumes its
native Region/Town/Fly-map composition. It does not decode an arbitrary tile
range or require the user to visit Map Editor first. The **Pokémon** group uses
the exact species picture/icon catalogs: a miniature is the game's native icon
resource, never a resized battle sprite.

The verified symbols and relative layouts were reproduced from clean builds of
`pret/pokeemerald` (`83df84e40623b79281f2397faa611cbf044170bd`),
`pret/pokered` (`405b6246372d7e5a2cb029cbb65219b13286b8c9`) and
`pret/pokecrystal` (`3438c7003a57fa2987fcb223d14b660761b33c64`).
Bundled stock manifests still require the matching ROM SHA-1. Other revisions
and hacks must import or manually declare their own complete scene resource
groups and remain Partial until an operation audit promotes them.
