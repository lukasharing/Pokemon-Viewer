# Native font library

Game fonts are ROM resources, not Battle Editor assets. Any editor that renders
game-owned text must consume the shared `GameFontRegistry` contract and request
the implementation for the active ROM family.

## Architecture

- `js/fonts/library.js` contains only the format-free registry.
- `js/fonts/gba/decoder.js` contains GBA glyph and width decoding.
- `js/fonts/gbc/decoder.js` contains GB/GBC tile-font decoding.
- A family runtime loads only its own decoder.
- Editors receive a font instance and do not read font offsets themselves.
- Font binary layouts, offsets and pointer rules must never move into the shared
  registry.

This resource is intended for battle HUDs, speech boxes, menus, map labels,
Pokédex text, code previews that represent in-game text, and any future native
screen compositor.

The font does not define screen layout. A native compositor must still follow
the owning engine's tilemap coordinates, line breaks and dedicated non-font
tiles (for example Gen I's level marker, HP bar and text-box border).

## Verified sources

| Family | Game/profile | Decompiled source | ROM data |
| --- | --- | --- | --- |
| GB/GBC | Pokémon Red/Blue | `FontGraphics` | 128 8×8 1bpp glyphs at `0x011A80` |
| GBA | Pokémon Emerald | `gFontNormalLatinGlyphs`, `gFontNormalLatinGlyphWidths` | 512 16×16 2bpp glyphs at `0x64C2E4`; widths at `0x6542E4` |
| GBA | Pokémon FireRed Rev 1 | `sFontNormalLatinGlyphs`, `sFontNormalLatinGlyphWidths` | 512 16×16 2bpp glyphs at `0x1F3170`; widths at `0x1FB170` |

The FireRed base profile records the unrevised offsets and applies the known
Rev 1 `+0x70` relocation. LeafGreen remains unavailable until its font tables
are verified against an exact matching ROM; do not infer its offsets.

## Rules

1. Render pixels from the loaded ROM at integer coordinates with smoothing off.
2. Use native glyph widths and the active game's text-table codec.
3. Unsupported profiles or characters produce a visible application error;
   do not silently substitute a browser font or a guessed glyph.
4. Add new families in their own directories. GBA and GB/GBC binary decoding
   must remain physically separate even when they expose the same interface.
5. Editor-specific layout belongs to the editor; glyph decoding and measurement
   belong to this library.
