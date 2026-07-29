# Hex editor guide

Hex Editor displays raw ROM bytes and a translated text mirror. It is useful for verifying pointers, structures, patches, and data not yet covered by a semantic editor.

The **View** menu and the two compact buttons above the data control the same
state:

- **Text translation** shows or hides the character-table column.
- **Mirror layout** places translated text on the left and hexadecimal bytes on
  the right, or restores the normal order.

Both controls preserve the current address, range, edits, and command history.
Mirroring is purely visual. If translation is hidden while its column owns the
selection cursor, the cursor safely moves to the byte side so typing and paste
remain unambiguous. The buttons expose `aria-pressed`, and the checked state in
the header stays synchronized.

Click a byte or translated character to select it. Shift-click or Shift+Arrow extends the selection. Arrow keys move by one byte, Up/Down by one row, and Page Up/Page Down by one page. `Cmd/Ctrl+C` copies the selected hexadecimal bytes or translated text.

Typing in the translated-text side writes characters through the loaded game's text table and is available in Simple and Nerd experiences. Delete clears a selected byte. Every write is a command with undo/redo and is included in edited-ROM export.

`Cmd/Ctrl+V` or **Edit → Paste** writes several values as one undoable command:

- On the Translation side, pasted text is encoded with the loaded family
  charmap. Gen I Red/Blue uses the `pret/pokered` English character values,
  including multi-character tokens such as `<PLAYER>` and `<RIVAL>`.
- On the byte side in either experience, hexadecimal accepts complete pairs such
  as `A9 00 FF`, `0xA9, 0x00, 0xFF`, or `A900FF`.

The complete destination range is validated before any byte is written. An
unavailable character, malformed byte pair, or paste beyond the ROM end leaves
memory unchanged.

In Nerd experience, the compact **Offset or text** field accepts decimal,
`0x...`, or `$...` offsets and jumps directly to that byte. Any other input is
encoded through the loaded game's same text table and searched as a byte
sequence. Enter and the search button perform the same action, select the whole
match, and search again from its end; reaching the ROM end wraps once to the
beginning. Invalid characters and missing matches produce a visible error
instead of an uncaught event exception.

Hex, Code, and map-event text previews share `TextTableCodec`, so the same ROM
byte cannot silently acquire different meanings between editors. The stored
table follows [`pret/pokered`'s charmap](https://github.com/pret/pokered/blob/master/constants/charmap.asm):
source tokens such as `#` remain round-trippable, while the event preview may
present that token as the familiar `POKé` glyph sequence and control tokens as
line breaks.

Simple experience hides raw offset search but retains byte/text navigation,
two-nibble byte entry, paste, deletion, Undo/Redo, and export. Nerd experience
reveals direct offset navigation and additional technical context. Both modes
can produce the same byte edits.

Prefer Map, Code, or Sprite Editor when a typed structure is available; they preserve meaning that raw bytes cannot show.
