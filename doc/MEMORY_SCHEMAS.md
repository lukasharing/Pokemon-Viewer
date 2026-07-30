# Memory schemas

The canonical structure documentation is
[STRUCTURES.md](STRUCTURES.md). It defines the checked family memory types,
typed record libraries, writers and the separation between:

- exact, fingerprint-bound ROM symbols; and
- reviewed, offset-free manual engine structures.

ROM-hack import and authorization rules are maintained in
[ROM_HACKS.md](ROM_HACKS.md). The canonical memory/resource ownership model is
[memory-data-model.md](memory-data-model.md).

This index exists so architecture references use one stable filename without
duplicating the schema catalog.

## Evidence layers

Every semantic memory access must combine two independent layers:

1. **Reviewed engine knowledge** is offset-free. It may define a record size,
   field type, table extent, pointer encoding, ownership rule, or the complete
   symbol membership of a resource group.
2. **ROM identity** supplies addresses. A bundled exact manifest gets them
   from a pinned reproducible `pret` build. A ROM hack gets them from its own
   `.sym`/`.map` file or an explicit manual symbol bound to the complete ROM
   SHA-1.

Renderers, readers, and writers consume `MemoryProfile`; they must not contain
retail fallback offsets. Missing evidence disables only the dependent
subdomain and reports the missing symbol.

## Current reviewed visual example

The Generation I `battleHud` contract contains:

| Symbol | Native meaning | Reviewed extent |
| --- | --- | ---: |
| `BattleHudTiles1` | battle HUD 1bpp tiles expanded by the engine | 24 bytes |
| `HpBarAndStatusGraphics` | HP bar, status and battle-font extension tiles | 480 bytes |
| `TextBoxGraphics` | text-box border and extra font tiles | 512 bytes |
| `PokeballTileGraphics` | occupied, status, fainted and empty party states | 64 bytes |

The contract contains no address. Red and Blue exact manifests resolve the
four addresses independently. A hack unlocks this group only when its own
source symbols provide all four roots.

The `nativeFont` contract follows the same model. `FontGraphics` is a complete
128-glyph, 1bpp table with an extent of 1,024 bytes. The renderer obtains its
address from `MemoryProfile`; it contains no retail fallback address. This
keeps native text shared across Battle, Sprite and Animation while allowing a
derived ROM to relocate or replace the table.
