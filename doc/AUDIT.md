# Project audit

> **Historical baseline:** the findings below describe revision `7ef42ec`
> before the recovery work in this working tree. They are retained to explain
> what was repaired, not as the current capability statement. The current
> deep capability statement is [AUDIT_2026_WEB.md](AUDIT_2026_WEB.md), with
> separate [GBA](AUDIT_GBA_2026.md) and
> [GB/GBC](AUDIT_GB_GBC_2026.md) audits. Current workflows are indexed by
> [README.md](README.md), and the automated recovery suite is run with
> `npm test`.

Audit date: 2026-07-28
Audited revision: `7ef42ec` on `master`
Repository: `https://github.com/lukasharing/Pokemon-Viewer`

## Current recovery status

The remainder of this document is the immutable pre-recovery audit. It is not
the current product state. As of the working tree on 2026-07-28:

> The table below records intended/recovered feature work, not uniform release
> readiness. The deep audit's Pokédex syntax, loading-retry and current-editor
> lifecycle blockers have been repaired and regression-tested. Incomplete exact
> profiles, several heuristic/scaffold editors, and real-browser/gameplay
> quality gates remain. Consult the 2026 audit suite before interpreting any
> row as a compatibility promise.

| Requirement | Current evidence |
|---|---|
| Local ROM lifecycle | Header-driven GB/GBC/GBA detection; immutable source, mutable editor, and last-downloaded checkpoints; project dirty guards; and edited-ROM/report exports produced from one detached byte snapshot. A successful ROM download clears only changes saved at that checkpoint while reports retain the full original-ROM diff. Edited snapshots repair family-native cartridge checksums and reports include those exact byte ranges. Reports can be imported only after identity, bounds, overlap, and all original bytes pass atomic validation; import is one project Undo/Redo command. Unapplied source drafts require confirmation and are declared explicitly when excluded from a report. |
| Supported profiles | International Red/Blue, Crystal revisions 0–1, and the supported Ruby/Sapphire/Emerald/FireRed/LeafGreen profiles listed in [COMPATIBILITY.md](COMPATIBILITY.md). Other recognized classic games fail before semantic editors load. |
| Hex editing | Byte/nibble editing, raw-byte or family-text paste, translated and mirrored layouts controlled from the header, selection, bookmarks, undo/redo, and export in both experiences. |
| Map editing | Shared workspace and camera contract with family-specific parsers; connected maps, blocks, native collision/attributes, entities, warps, resize, connection/event changes, sprite/script navigation, and reversible commands. |
| Code editing | GBA event macros and game text, Red/Blue RGBDS text macros and LR35902 bytes, separate Crystal event/text codecs, referenced-resource tabs, safe in-place patches, and proven-pointer relocation. The header controls semantic and Original CPU views. |
| Sprite editing | Linked GB/GBC 2bpp and GBA 4bpp graphics, palette workflow, pixel strokes, shared header zoom/grid controls, and undo/redo; non-contiguous or assembled previews remain protected unless a byte-identical writable source is known. |
| Experience parity | Simple hides addresses, byte counts, CPU-mode configuration, and structure identifiers. Nerd reveals them. Semantic editing, Undo/Redo, draft preservation, and export remain available in both. |
| Documentation | Each active editor header links its guide; [USAGE.md](USAGE.md) indexes the complete workflow and [STRUCTURES.md](STRUCTURES.md) documents the family boundaries. |
| Automated evidence | `npm test` builds SCSS and runs synthetic byte-level, structure, codec, relocation, editor-contract, and documentation tests. `npm run audit:rom` additionally proves a production event edit and exact Undo on an isolated in-memory clone before script round-trip checks. No commercial ROM bytes are committed or written as fixtures. |

Known boundaries are deliberate rather than silently simulated: the vendored
emulator is not advertised as an active editor, unsupported game revisions do
not borrow another game's offsets, unknown script opcodes stop semantic
decoding, and edits without a proven owner cannot grow into adjacent data.

## Executive summary

PUSH is an ambitious browser-native Pokémon ROM hacking studio prototype. It has a polished 2018-era shell, a ROM byte reader, a virtualized hex viewer, GBA graphics decompression helpers, map/bank/entity models, map rendering and camera code, text dictionaries, game metadata, an XSE-oriented CodeMirror experiment, and a vendored GBA emulator.

The repository is not currently production-ready and should not be described as a working editor. The initial screen renders correctly, but the normal upload path cannot reach a reliable editor state. The most important regression is that parsed `games.json` data is collected in `pokemon_bases` but never passed to `RomReader`; `setGameBases(...)` is commented out. In addition, ROM identification is hard-coded to English FireRed inside a commented-out comparison, write methods are empty, and code/sprite/emulator integration is inactive.

The best description is: **a substantial proof of concept with a working presentation layer and valuable parsing/rendering research, currently blocked at ROM initialization.**

## Scope and method

The audit covered:

- all 213 tracked files at the current revision;
- Git history, contributors, branches, and remote state;
- HTML entry points, first-party JavaScript, JSON definitions, styles, and vendored libraries;
- JavaScript syntax checks with `node --check`;
- a local HTTP runtime test in a real browser at `http://127.0.0.1:4173/`;
- first-load visual inspection and browser console errors.

Two local ROM files were later supplied under the untracked `roms/` directory. Their GBA headers were inspected locally and the current loader path was evaluated against them; no ROM content was copied into the documentation or transmitted. Because the initialization defect occurs before editor startup, neither file can reach a correctly identified editor state in the audited revision.

## What exists

| Area | Status | Evidence and assessment |
|---|---|---|
| Application shell | Working | `index.html` loads local assets and dynamically inserts five editor fragments. The sidebar and game chooser render in-browser. |
| Game catalog | Working UI | `json/games.json` and bundled box art populate GBA/GBC choices and language options. Selection does not complete configuration. |
| Local ROM upload | Partial | Drag/drop and file input accept `.gba`, `.gbc`, and `.gb`; `FileReader` loads bytes locally. Downstream detection/initialization is broken. |
| ROM byte access | Implemented foundation | `RomReader` exposes byte, short, pointer, signature-search, dictionary-search, and table helpers. Bounds/validation are limited. |
| Hex viewer | Most developed editor | Virtualized rows, offset navigation, selection, clipboard text, and translated byte display exist. Editing is not implemented because memory write methods are empty. |
| Map system | Substantial but unreachable | Bank/map/entity parsing, palettes, tilesets, connections, event rendering, zoom, camera, culling, and UI panels exist. Current startup never initializes it. |
| Code editor | Prototype/inactive | XSE mode, hints, definitions, and an `ECode` class exist, but `editor-code.js` is not loaded and construction is commented out. `code.html` uses `xse_editor`, while navigation expects `code_editor`. |
| Sprite editor | Placeholder | Palette and tileset helpers exist, but `sprite.js` is empty and the fragment duplicates code-editor markup. |
| Emulator | Vendored but inactive | IodineGBA sources are included, but all emulator script tags are commented out. The tab contains only a canvas. |
| Music editor | Orphaned prototype | `js/music/editor-music.js` exists but has no HTML fragment, script include, or navigation entry. |
| Notifications | Working UI | Local notification classes load and the initial Spanish announcement is triggered. |
| Build/test tooling | Missing | No package manifest, build, linter configuration, automated tests, CI, or release workflow. |
| Documentation/license | Missing before this audit | No README at HEAD and no project license or third-party notices file. |

## Confirmed blockers and defects

### P0 — ROM metadata never reaches the reader

`js/init.js` fills `pokemon_bases`, constructs `RomEditor` before the JSON request completes, and leaves `RomEditor.setGameBases(pokemon_bases)` commented out. `RomReader.loadROM()` therefore iterates an empty object and falls back to the selection screen for every upload.

### P0 — ROM detection is hard-coded

In `js/rom_reader.js`, the intended version-string comparison is commented out. Any populated metadata entry with a positive version offset sets the result to `{lang: "en", base: "fire_red"}`. This would misidentify Ruby, Sapphire, Emerald, LeafGreen, Japanese releases, and other supported catalog entries.

### P0 — editor naming mismatch

Navigation calls `change_workspace(index, "code")`, which looks for `#code_editor`, but `code.html` defines `#xse_editor`. The inner element also uses `#code_editor`. This prevents the code workspace from being selected cleanly and creates confusing identifier ownership.

### P1 — global `Map` is shadowed

`js/map/map.js` declares `class Map` in global scope, replacing the browser's built-in `Map` constructor. The app itself may tolerate this, but it breaks third-party scripts and browser instrumentation that expect the native collection. This was observed during runtime inspection.

### P1 — editing does not persist

`RomReader.write_hex_memory()` and `write_char_memory()` are empty. `ReadOnlyMemory` is appropriately named: the checked-in implementation provides viewing/parsing foundations, not a complete editing-and-export workflow.

### P1 — advertised platform support exceeds implementation

The picker accepts GB, GBC, and GBA files and displays GBC games, while parsing, offsets, compression, map structures, and emulator plans are principally GBA-specific. Support claims should be narrowed until separate readers exist.

### P1 — inactive feature code increases risk

The large IodineGBA tree, CodeMirror bundle/themes, music prototype, XSE mode, and editor experiments are checked in without a dependency manifest, provenance inventory, or active integration. They account for much of the repository and obscure the maintained core.

### P2 — maintainability and compatibility

- First-party code is globally scoped and depends on script order.
- Some DOM collection iteration and event APIs reflect older browser assumptions.
- Errors are often strings or console messages rather than structured failures.
- ROM pointers and offsets are used with little validation.
- Mixed Spanish/English UI and comments make the product voice inconsistent.
- There is no accessibility, responsive, or keyboard-navigation test baseline.
- There is no test fixture strategy for legally distributable synthetic ROM data.

## Runtime verification result

The app was served with Python's static HTTP server and opened in a browser. The following were verified:

- the document title loads;
- the sidebar lists Hex, Code, Map, Sprite, and Emulator editors;
- the GBA game cards and language selector render;
- local static resources needed for the landing screen return successfully;
- no browser console error appeared on the untouched landing state.

### Supplied ROM test matrix

| Local test file | Header | Revision | Metadata present | Result at current loader |
|---|---|---:|---|---|
| Pokémon Emerald (USA/Europe) | `BPEE01` / `POKEMON EMER` | 0 | `games.json` has an English Emerald entry | Blocked: `RomReader.game_bases` remains empty. If that is manually connected without fixing detection, the ROM is misidentified as English FireRed. |
| Pokémon FireRed (USA/Europe) | `BPRE01` / `POKEMON FIRE` | 1 | `games.json` has an English FireRed entry | Blocked: `RomReader.game_bases` remains empty. If that is manually connected, the hard-coded detector selects FireRed without actually verifying the configured signature. |

Both files are valid-looking 16 MiB GBA images by header and match catalog families represented in `games.json`. This makes them useful manual regression inputs after the P0 fixes, but they must remain untracked and must not be redistributed.

## Repository health snapshot

- 49 commits total: 45 authored as Lukas Haring, 2 as Lukas Haring García, and 2 by Henrique Lorenzi.
- Activity by commit year: 40 in 2017, 5 in 2018, 4 in 2022.
- One branch (`master`) tracking `origin/master`; working tree was clean before documentation was added.
- Approximately 51,409 lines represented in the final tree versus the initial commit, much of it vendored emulator/CodeMirror code.
- No package lock, automated test suite, CI configuration, release artifact, license, or security policy.
- The local `roms/` directory and `.DS_Store` files are currently untracked, and there is no `.gitignore`; this creates a serious risk of accidentally committing copyrighted ROM data.

## Overall rating

| Dimension | Rating | Comment |
|---|---:|---|
| Historical/learning value | High | Significant original experimentation in browser ROM parsing and map visualization. |
| UI completeness | Medium | Strong shell and map/hex presentation for its era. |
| Functional completeness | Low | Core initialization and write/export workflows are missing or disconnected. |
| Maintainability | Low | Global architecture, vendored code, no tests/tooling, and unclear dependency ownership. |
| Revival feasibility | Medium | Static architecture is simple, and the core can be recovered incrementally with fixtures and tests. |
| Release readiness | Not ready | Requires correctness, legal, security, and testing work first. |

## Recommended decision

Preserve the current revision as a historical `legacy` baseline, then revive only the hex-reader vertical slice first. Do not begin by modernizing every UI or reconnecting the emulator. A small tested path—identify one legally obtained FireRed revision, display bytes/text, edit a copy, and export it—would prove the architecture before map and script features are migrated.

## Modernization update

After the baseline audit, the recovery work added a tokenized SCSS architecture, generated `css/style.css`, a responsive material-inspired refresh, npm scripts, Node-based smoke tests, ROM ignore rules, and a local ROM-header checker compatible with `pret/pokeruby` outputs. The four legacy feature stylesheets were consolidated into the SCSS entry point.

The next change removed the manual game selector and repaired the P0 metadata handoff. PUSH now detects supported Generation III games, configured languages, and revisions from the standard GBA header. The supplied FireRed Rev.01 and Emerald Rev.00 files both opened successfully in the browser and displayed ROM bytes in the hex viewer. Editing/export and the incomplete editor surfaces remain unresolved.

The loader was subsequently split by ROM family. `.gba` files use a dedicated GBA detector, while `.gb` and `.gbc` files use a separate classic Game Boy detector. The shell, DOM helper, asset loader, and detector router are the only relevant startup modules; detectors and the hex viewer load on demand, and GBA map/graphics modules wait until the Map workspace is requested. A synthetic checksum-valid Pokémon Red header was verified through the browser upload flow, with GBA-only editors disabled and no GBA map code loaded. jQuery was removed from the shipped dependency tree.
