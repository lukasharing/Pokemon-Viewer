# Event scripts and text

The code editor separates engine machine code from event data.

Presentation is separated from decoding. `ScriptLogicGraph` consumes the same
lossless command records as the source renderer and exposes a family-neutral
visual document for Simple mode. It translates only verified command names
into readable actions and omits offsets and hexadecimal. Nerd mode retains the
native syntax documented below. The graph has no external UI dependency, so
the ROM codecs remain usable as standalone libraries and typed visual editing
can later be added as an explicit writer layer.

Its UI depends only on a small codec contract (`decompile` and `compile`).
`gba-event-script.js` and `gbc-text-script.js` implement that contract
independently and are lazy-loaded only for the detected ROM family. Opening a
Gen I project therefore never downloads the GBA event-command table, and
opening a GBA project never downloads the Gen I character map.

## Views

- **Event script** renders GBA field-event bytecode using XSE-compatible and `pret` event-macro command names. Recognized commands can be compiled back into the current ROM region.
- **Text script (RGBDS)** renders and compiles Gen I text data with the macro names used by `pret/pokered`, including `text`, `next`, `line`, `para`, `cont`, `text_ram`, `text_bcd`, `text_move`, `text_box`, `text_decimal`, `text_far`, sound commands, and `text_end`. It also preserves the official special dispatchers for Pokémon Centers, PCs, prize/cable/vending handlers, and variable-length `script_mart` item lists.
- **Original CPU code** shows ARM/Thumb for GBA or complete base/CB LR35902
  decompilation for GB/GBC. Red/Blue executable map logic is RGBDS assembly,
  not an event bytecode; source is emitted as byte-exact RGBDS `db` records
  annotated with decoded instructions.
- **Crystal event script** uses all 170 `pret/pokecrystal` event macros
  (`$00–$A9`) independently from the Gen II text-command table.

GBC is therefore not assigned one fictional universal language: Crystal uses
its real event/text macros, while Red/Blue uses real text macros plus RGBDS
LR35902 for executable logic. A future high-level Gen I visual language must
compile through verified engine-specific templates and retain an RGBDS escape
node; it must never reinterpret arbitrary CPU bytes as field-event opcodes.

Unknown commands are emitted as `db` instead of being assigned a guessed meaning.

## Safe compilation

The GBA compiler covers the complete `pret/pokeruby` event-command table
(`0x00–0xCC`), from flow control and local variables through sound, warps,
inventory, Pokémon, shops, money, weather, field effects, virtual scripts,
objects, messages, choices, and picture boxes. It also decodes and recompiles every variable-size
`trainerbattle` form (`0–8`) using the pointer count selected by its battle
type. The `givemon` macro preserves its reserved zero bytes; modified ROMs with
non-zero reserved data are represented losslessly as `givemon_raw`. `msgbox`
remains available as the familiar XSE shorthand for
`loadword 0, text` followed by `callstd`.

An unknown opcode or unsupported dynamic form is emitted as one editable `db`
and stops semantic decoding at that byte. Continuing with an unknown argument
length would make operand bytes look like commands and could produce a
corrupting patch; the Original CPU/raw-directive view remains available for
intentional byte-level work.

When a script is opened from a map event, its pointer metadata travels with the
editor tab. Output larger than the detected region is moved to an aligned
`$FF` free-space run and the pointer is updated in the same undoable command.
GBA pointers remain `0x08xxxxxx`; Gen I near pointers remain inside their
original 16 KiB bank, while `text_far` updates its address and bank byte.

Compilation from a manually entered offset is rejected if it grows because no
owning pointer can be proven. PUSH never guesses which references should move.

## Referenced text

Decoded commands can expose semantic resources without embedding their bytes
inside the event source. GBA message commands and Crystal
`writetext`/`jumptext` commands show a shared resource bar below the tabs.
Selecting a resource opens a separate editable TEXT tab, keeping event
bytecode and game strings in their native formats.

The same bar exposes referenced event scripts. On GBA, `call`, `goto`,
`goto_if`, and `call_if` open their target in another EVENT tab. On Crystal,
same-bank and far calls/jumps plus conditional branches, `sdefer`, and
`stopandsjump` do the same. These are not address-only shortcuts: every tab
retains the exact operand that owns the reference. If compiled source grows,
relocation updates that 32-bit GBA pointer or the appropriate Gen II near/far
fields and Undo restores both pointer and bytes.

GBA text is represented as:

```text
#org 0x001234
text "Hello!"
text_end
```

Compilation uses the loaded profile's character table and always preserves the
native `$FF` terminator. The originating 32-bit pointer stays attached to the
tab, allowing safe relocation when text grows. Crystal retains the equivalent
near or far banked pointer.

Generation III Western English/Spanish and Japanese profiles select different
tables. Ambiguous or unmapped bytes are emitted as `[XX]` inside the quoted
text and the compiler accepts that notation as an exact raw byte. Therefore
decompile/compile remains byte-identical even when two table entries render the
same visible character.

The Gen I compiler uses the English `pret/pokered` character map and preserves
the little-endian parameters and exact command sizes used by the ROM. Unknown
bytes remain editable through `db $xx`; character data encountered without a
`text` prefix is emitted as `raw_text` so recompilation does not insert an
extra `$00`. Bytes `$F6–$FF` mean digits while decoding a quoted text payload,
but some of them are special script IDs at the top level; the decoder tracks
that context instead of assigning one global meaning to the bytes.

`text_far` produces a navigable text resource with the original 16-bit address
and bank-byte owner. A relocated edit therefore updates both native fields
rather than converting the reference to a guessed flat address.

The Crystal event compiler preserves each macro's byte/word/far operand width.
Its variable `givepoke` command reads and writes the two extra 16-bit name
pointers only when the trainer flag is non-zero. Unknown opcodes stop semantic
decoding at one `db` byte so following operands are never guessed.

## Source basis

- `pret/pokeemerald`: `asm/macros/event.inc` and `data/script_cmd_table.inc`
- `pret/pokered`: `macros/scripts/text.asm`
- `pret/pokecrystal`: `engine/overworld/scripting.asm` and
  `macros/scripts/events.asm`
- Historical binary-hacking syntax: eXtreme Script Editor (XSE)
