# PUSH usage guide

PUSH edits supported Pokémon Game Boy, Game Boy Color, and Game Boy Advance ROM images locally in the browser. The ROM is not uploaded. Use a backup of a ROM you are legally allowed to modify.

> **Experimental build:** Map, Hex, selected Code/Text paths and verified Sprite
> ranges have real editing behavior. Battle, Pokédex, Sound, Animation and
> Emulator do not yet have uniform profile coverage; Animation currently uses
> illustrative documents. The Pokédex startup blocker found by the audit is
> fixed, but its classic-family data remains incomplete. Read
> [AUDIT_2026_WEB.md](AUDIT_2026_WEB.md) before relying on an export.

## Start

1. Open PUSH and choose a `.gb`, `.gbc`, or `.gba` file.
2. The game family, title, language, and revision are detected from its header.
3. Choose an editor from the left navigation.
4. Use the sidebar **Settings** control, or a configured editor header, to
   select **Simple** or **Nerd** experience.

Editor links begin disabled and are enabled only after a supported profile has
finished loading. During replacement the current workspace closes and the
button returns to **Open ROM**. A successful `romloaded` transition enables
only the Verified or Partial workspaces declared by the exact fingerprint
manifest; Research and Unavailable entries stay disabled. A failed transition
leaves every workspace disabled rather than displaying the previous game's
name or tools. See [CAPABILITY_MODEL.md](CAPABILITY_MODEL.md).

Simple experience favors game concepts and hides raw offsets and CPU details.
It does not hide semantic editor actions: painting, property forms, map resize,
connection editing, event creation/deletion, script/text compilation, sprite
editing, Undo/Redo, and ROM download remain available.

Nerd experience adds bank numbers, raw pointers, structure addresses, byte
counts, CPU modes, and manual navigation controls. Dynamic property tables use
the same complexity rules as static forms, so changing experience updates
already-open map and event windows without resetting editor state.

## Editors

- [Map editor](MAP_EDITOR.md): maps, connected areas, blocks, events, warps, collisions, undo/redo, and linked sprites/scripts.
- [Code editor](CODE_EDITOR.md): event scripts, text, original CPU instructions, and reversible source patches.
- [Sprite editor](SPRITE_EDITOR.md): GB/GBC 2bpp and GBA 4bpp graphics.
- [Hex editor](HEX_EDITOR.md): raw memory and translated text inspection.
- [Battle editor](BATTLE_EDITOR.md): partial trainer/scene/timeline inspection;
  availability and accuracy depend on the exact profile.
- [Pokédex editor](POKEDEX_EDITOR.md): stable shared workspace, partial
  profiled GBA entries, and incomplete classic-family data.
- [Move editor](MOVE_EDITOR.md): exact Red/Blue move records, named type and
  learnset references, raw-data navigation, and safe fixed-record editing.
- [Sound editor](SOUND_EDITOR.md): partial document/reference and command
  inspection; discovered does not imply decoded or writable.
- [Animation editor](ANIMATION_EDITOR.md): reusable document/timeline UI whose
  current generic frames are not yet decoded game animations.
- [Encounter editor](ENCOUNTER_EDITOR.md): exact Red/Blue
  grass/water/fishing/static and Crystal grass/water/fishing/tree/Contest/
  roamer/direct-static data, shared-owner disclosure, Species/map/script
  links, and reversible native-field editing.
- [Emulator](EMULATOR.md): always-on-top mGBA runtime for GBA, GB and GBC,
  synchronized with applied project bytes and browser-local save data.

Every declared editor now has File/Settings/Help integration. The remaining
descriptor duplication and incomplete domain coverage are tracked in the audit.

An mGBA WebAssembly dock is available for GBA, GB and GBC profiles. It stays
above editors, supports drag/minimize/fullscreen, imports and exports `.sav`
data, and reloads from the current project buffer after applied edits. It is a
play-test surface, not yet a semantic breakpoint debugger or an automatic
playthrough validation gate.

## Shared behavior

- `Cmd/Ctrl+Z` undoes an editor change; `Shift+Cmd/Ctrl+Z` (or
  `Ctrl+Y`) redoes it. When focus is inside an input, select, editable source,
  or text field, PUSH leaves the shortcut to the browser's native field
  history. Outside fields it controls the visible editor's ROM command stack.
- Bookmarks remember maps, events, code, sprites, or offsets with a title and
  description. Use **★** to save the current location, **✎** to rename or update
  its notes, and **×** to remove it after confirmation.
- When Event properties is open, a Map bookmark also stores the event type,
  table index, and a semantic fingerprint without coordinates or ROM offsets.
  Opening it selects the owning map, centers that event, and opens its current
  properties again. It can follow one uniquely shifted entry after a table
  edit; a missing, replaced, or ambiguous entry is reported as stale instead of
  selecting a different object.
- A Sprite bookmark restores its catalog entry or verified ROM segments,
  offset, tile layout, palette choice, zoom, and grid. It stores references and
  display settings rather than ROM bytes. A decompressed preview without a
  stable catalog or verified segment explains that it must be reopened from its
  owning map instead of silently showing unrelated raw bytes.
- New bookmarks also store the detected family, editor profile, game, language,
  and revision, displayed below their title. Opening first verifies that
  identity; an Emerald location cannot be interpreted as FireRed merely because
  both are GBA, and a Red bookmark cannot be interpreted as Crystal. A mismatch
  leaves the current editor untouched and explains which project differs.
  Legacy bookmarks without the expanded identity retain their older
  family-only check.
- Opening linked code or graphics keeps the state of the other editors.
- Double-clicking a connected map opens it. If edits are pending, PUSH asks before discarding them.
- The **Open ROM** button shows an amber status dot whenever an editor has
  changed ROM bytes or retains an unapplied draft. Selecting or dropping
  another ROM opens a project-wide confirmation separating applied byte
  changes from drafts.
- After replacement is confirmed, PUSH destroys every active editor before
  reading or detecting the new file. If reading, detection, or lazy runtime
  loading fails, no listener, map render loop, pointer registry, dictionary, or
  memory object from the previous game remains active; the file chooser is
  restored for a clean retry.
- Every registered unapplied editor draft counts as unsaved project work. It
  triggers replacement/close warnings and is listed separately from applied
  ROM bytes. Code Editor source tabs are the first draft-producing documents;
  future editors use the same central registry rather than an export allowlist.
- ROM-family modules are loaded only when the relevant editor opens.
- Opening editors quickly is safe: repeated requests for one workspace share
  its initialization, and the most recent workspace choice wins. A slow module
  from an earlier choice cannot steal focus when it finishes. If the current
  choice fails to initialize, PUSH restores the previously visible editor;
  failures from an already superseded choice are ignored.

## Saving and safety

Use **File → Download edited ROM…** or `Cmd/Ctrl+S` to download a new ROM containing the currently applied byte changes. PUSH never overwrites the source file. If no bytes changed, it asks before downloading an identical copy.

Before either a ROM or change report is emitted, PUSH validates the exact
snapshot that would be downloaded. The versioned gate checks ROM/source shape,
registered semantic domains, unresolved graph references, allocation ownership,
change-range integrity and repaired cartridge checksums. An error stops the
download before any file is created. Warnings remain disclosed, and the JSON
change report embeds the complete validation result and stable diagnostic codes.
This structural gate is not yet a claim that the edited game passed emulator
playthrough scenarios.

When an exact Red/Blue or Crystal domain has been initialized, its library
registers a live project validator. Export then re-decodes the current Species,
Move, evolution/learnset, Trainer and Encounter structures rather than trusting
an old editor cache. Invalid types, PP, IDs, parties, terminators, banked
pointers, bounded records or native Species sprite streams become blocking
domain diagnostics. Audited Emerald and FireRed also revalidate all 411
internal Species names, front graphics and palettes plus all 386 independent
Pokédex records; Emerald validates its complete trainer table and all four
party formats. Battle-animation scans and unpinned Sound candidates are deliberately
excluded because they are not authoritative data models. Remaining semantic
domains are still being added to this contract.

A successful ROM download creates a local save checkpoint from the editor's
current applied bytes. The unsaved indicator and close/replacement warning then
clear unless a registered unapplied editor draft remains. Later edits—and Undo after
the download—become unsaved relative to that checkpoint. This does not replace
the immutable source snapshot: change reports still describe every difference
from the originally loaded ROM, including work saved in an earlier download.

Both experiences provide **Export change report…**, a JSON document containing
every changed byte range with its original and replacement values. ROM downloads
and reports use one immutable export snapshot, so the bytes and the reported diff
cannot describe different moments. If any editor contains registered unapplied
drafts, both exports ask before continuing; a report created without them lists
the excluded editor, kind, label, location and other document identity fields.
If a draft provider fails, the failure itself is disclosed as a pending record
so export cannot silently assume the editor is clean.

When applied bytes exist, the export snapshot also repairs the cartridge
checksums: GBA's header checksum, or GB/GBC's header and big-endian global
checksums. The open editor memory is not mutated merely by downloading. Checksum
bytes are included in the JSON ranges and its `checksums` record, so applying the
report produces the same cartridge bytes as downloading the edited ROM. An
unchanged ROM is copied byte-for-byte rather than being modified as a side effect
of export. The browser warns before closing a page with unapplied-to-disk byte
changes.

Use **File → Import change report…** to apply a report to another byte-identical
base ROM. Import validates the detected game/profile identity when the report
provides it, rejects another ROM family, parses every range strictly, rejects
overlap or out-of-bounds data, and verifies every original byte before making
the first write. A mismatch cancels the complete import; partial patches are
never left behind. The accepted report becomes one project command. **Undo
imported report** and **Redo imported report** are available from the File menu
of every editor in both Simple and Nerd experience. All registered drafts must
first be applied or reverted so an import cannot silently invalidate visible
unapplied work. Undo/Redo rechecks the patched ranges as well: if a later
editor command changed one of those bytes, project history reports the conflict
instead of overwriting the newer edit.

Editor headers listen to the shared history and pending-draft events. Menu
checks and enabled states therefore update after synchronous editor commands and
after asynchronous report imports; reopening a File or Edit menu never leaves
Undo/Redo disabled from an earlier state.

Byte-writing commands in Hex, Code, Sprite, and typed structure/event forms
record both the bytes they expect and the replacement bytes. Undo/Redo validates
all affected ranges before writing. If another editor changed an overlapping
range later, the older command remains in History and a visible conflict message
is shown instead of silently overwriting newer work.

The command history shows in-memory edits and supports undo. Keep the original ROM as a backup. Features that only inspect data do not change ROM bytes; actions described as patching or editing do.
