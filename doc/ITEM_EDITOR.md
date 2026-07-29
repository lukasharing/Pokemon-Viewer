# Item Editor

The Item Editor exposes verified item data without pretending that every game
stores the same resources.

## GBA (Emerald and FireRed Rev 1)

- Lists the usable `gItems` records for the exact audited ROM profile.
- Renders each native 24×24 compressed bag icon from `gItemIconTable`.
- Groups items by their native pocket, including Berries.
- Safely edits price, pocket, and importance in the existing 44-byte record.
- Opens the exact icon in Sprite Editor. World-object graphics remain separate
  because a bag icon and a map object are different engine resources.

## GB / GBC (Red and Blue)

- Lists all 83 fixed `ItemNames` and reads the exact three-byte BCD prices.
- Safely edits prices with compare-before-write Undo/Redo.
- Shows the shared Poké Ball field object used by Gen I. Red/Blue do not store
  one unique inventory icon per item and do not contain a Berry pocket.

GBA and GB/GBC use separate data drivers and codecs. Never reuse offsets,
record layouts, palettes, compression, or icon assumptions across families.
