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

Manual does not mean arbitrary. It means reviewed engine semantics that the
linker cannot express directly. The generated registry forbids absolute ROM
identity inside this layer and assigns it no address, compatibility, or write
authority. `MemoryProfile.contract(category, name)` exposes both the value and
its pinned review evidence, while `MemoryProfile.symbol(name)` remains the
independent address layer.

## Required manual engine knowledge

Some behavior cannot be reconstructed from addresses alone. Native selector
enums, task argument meanings, frame-step state machines, packed flag
semantics, palette routing and hardware wrap rules are deliberately recorded
as manual engine knowledge when the decompiled source is their only complete
authority. Every such contract must:

- live in the owning family module or manifest config, never in a shared
  renderer as a retail-game special case;
- name the pinned `pret` repository, source file and symbol that define it;
- contain no stock ROM offset; a semantic script locator or imported symbol
  resolves the active ROM address independently;
- state the preview scope when live runtime state is absent (for example, a
  neutral one-on-one battle);
- preserve verified native no-ops instead of moving a different object; and
- fail closed for unmodeled runtime inputs, partner actors or write semantics.

`GbaBattleAnimationTasks` is the current concrete example. Its manifest
locators identify C task pointers from exact script commands, then
`js/animation/gba/tasks.js` executes reviewed per-tick state machines from
`pret/pokeemerald` / `pret/pokefirered`. The same adapter therefore survives a
relocated ROM hack after that hack supplies its own symbols or retains the
semantic anchor. Generation I and II animation contracts remain in their own
family drivers; sharing UI and timeline components never merges their engine
ABIs.

`GbaBattleAnimationBackgrounds` is a second offset-free manual structure
contract. `GbaAnimationBackgrounds` consumes it to find the 27-record
`gBattleAnimBackgroundTable` through the repeated `BG_NONE` / `BG_DARK`
record and validates every image, palette and tilemap as a bounded LZ77 stream
before rendering. It never substitutes the ordinary map battle environment
when a move script requests a special background.

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

The Generation I `maps` resource is complete only when the active profile
provides both `MapHeaderPointers` and `MapHeaderBanks`. These two roots are
distinct because the pointer table stores bank-local addresses while the bank
table supplies their ROM banks. The Map driver consumes only those profiled
roots: the retail `0x1AE` address and heuristic bank-table discovery are not
compatibility evidence.

Generation III scene sheets use the same two-layer model. The reviewed
`sceneIntro`, `sceneTitle`, `sceneBag`, and `sceneBadges` contracts define
which graphic and palette symbols belong together, their compression, and
their native tile columns. The Emerald manifest obtains every base address
from the exact `pret/pokeemerald` linker symbols. The title-screen Rayquaza
palette is the final 16-color subpalette at byte `+0x1C0` inside
`gTitleScreenBgPalettes`; that relative layout is reviewed engine knowledge,
not a retail ROM address. Each scene group fails independently.

## Current reviewed data example: Generation III trainers

Emerald and FireRed each expose an offset-free `GbaTrainer` contract. The
reviewed ABI defines the 40-byte header, 12-byte name, four held battle items,
double-battle flag, AI flags, party count and GBA pointer. It also defines all
four `agbcc`-aligned party records:

| Flags | Native fields | ROM stride |
| ---: | --- | ---: |
| `0` | IV, level, Species | 8 bytes |
| `1` | IV, level, Species, four moves | 16 bytes |
| `2` | IV, level, Species, held item | 8 bytes |
| `3` | IV, level, Species, held item, four moves | 16 bytes |

`GbaTrainerContract` combines that structure with the active profile's own
`gTrainers` symbol. It never checks a retail address or the string
`"emerald"`. An exact FireRed manifest therefore uses the FireRed table with
the FireRed review, while an Emerald-derived hack can relocate its table by
supplying its own symbol. If the symbol is absent, only the trainer subdomain
is unavailable.

The reader and writer obtain every field position, stride, party limit,
record count, name width and move limit from the contract/profile. Verified
party fields contribute exact write ranges to the live Resource Graph:
level, Species, optional item and optional four moves. IVs, padding, header
metadata, party resizing and pointers are not counted as writable.
