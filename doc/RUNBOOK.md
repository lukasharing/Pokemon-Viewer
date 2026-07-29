# Runbook

## Requirements

- A current desktop browser.
- Python 3, or any static HTTP server.
- A legally obtained ROM for later ROM-path testing. No ROM is included.

Install development dependencies with `npm install`. Build and test with `npm test`; serving the already compiled static files does not require a build.

The historical public deployment is available at `https://lukasharing.github.io/Pokemon-Viewer/`. It was reachable during the audit and showed the expected PUSH landing screen. It runs the same prototype behavior and should not be treated as a working editor release.

## Start locally

From the repository root:

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173/
```

Do not open `index.html` directly with a `file://` URL. The application fetches editor fragments and JSON, which browsers commonly block or treat differently outside HTTP.

## Current smoke test

1. Confirm the page title is “Pokémon Ultimate Studio for Hacking (PUSH)”.
2. Confirm four sidebar entries appear: Hex, Code, Map, and Sprite.
3. Load a supported legal ROM and confirm its detected title, platform, language, and revision.
4. Open Map, Code, Sprite, and Hex from the sidebar.
5. Use **Settings** to switch between Simple and Nerd experience.
6. Apply a reversible code or map-block change and use **File → Download edited ROM…**.

## Developer checks

Syntax-check first-party and vendored JavaScript:

```bash
find js mode -name '*.js' -type f -print0 | xargs -0 -n1 node --check
```

Inspect repository state and history:

```bash
git status --short
git log --date=short --pretty=format:'%h %ad %an %s' --all
```

Validate headers only, then production map/event/sprite structures:

```bash
npm run test:rom -- /path/to/game.gba /path/to/game.gb
npm run audit:rom -- /path/to/game.gba /path/to/game.gb
```

`audit:rom` never writes a ROM file. It clones each file into an isolated memory
buffer, uses the production family memory classes,
`GbaMapHeader`/`GbcMapHeader`, event blocks, `StructureWriter`,
`CommandStack`, overworld sprite catalogs, and Code Editor script/text codecs.
It changes one real event field, requires Undo to restore the complete cloned
ROM byte-for-byte, then decompiles a map-referenced source and requires
recompilation to reproduce the exact selected byte range. Its output contains
names and aggregate counts/dimensions, never ROM bytes, text, pointers, or
offsets. Finally, it simulates one exported edit on another clone, runs the
production family checksum utility, and requires the resulting GBA header
checksum or GB/GBC header and global checksums to validate. It serializes those
differences as report ranges, imports them through `RomPatch` into another
source clone, and requires Import, Undo, and Redo to match the exported,
original, and exported images byte-for-byte respectively.

## Known behavior

- Landing page: renders.
- Game catalog: renders.
- ROM file reading: begins locally in the browser.
- Header detection and semantic map/event/sprite parsing: verified through the
  CLI for the supplied English Emerald Rev.00, FireRed Rev.01, and Blue Rev.00
  files.
- Code patches and GBA map-block painting modify the in-memory ROM with undo/redo.
- Edited ROM download and JSON changed-byte reports are available from editor File menus.
- Map, Code, Sprite, and Hex editors are active for their supported family operations; Emulator remains experimental.

## Privacy and safety

The active code reads the selected file into browser memory and has no network-upload call. Export always creates a new browser download and never overwrites the selected source file. Still, keep an untouched backup.

Keep ROMs outside the repository where possible. At minimum, add `roms/`, `*.gba`, `*.gbc`, `*.gb`, and `.DS_Store` to a local or project ignore file before staging changes. Always inspect `git status` before committing.

## Audited local fixtures

The 2026-07-28 non-destructive CLI audit found three untracked local fixtures:

- Emerald USA/Europe Rev.00: a `30×30` first map, 31 combined events, an exact
  reversible event edit, a 2-command event-script round-trip, and 246 overworld
  catalog entries; its simulated edited export has a valid GBA header checksum.
- FireRed USA/Europe Rev.01: a `14×9` first map, 5 combined events, and 152
  overworld catalog entries; its reversible event edit and referenced
  6-command event script both round-trip exactly, and its simulated edited
  export has a valid GBA header checksum.
- Blue USA/Europe Rev.00: 226 plausible map headers, a `10×9` first map, 10
  combined events, a reversible warp edit, an exact referenced text-script
  round-trip, 60 overworld catalog entries, and valid repaired header/global
  checksums after a simulated export edit.

These are local integration evidence, not distributable test fixtures. Do not
add them to Git or redistribute them.
