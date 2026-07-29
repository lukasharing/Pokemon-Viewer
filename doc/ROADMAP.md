# Revival roadmap

> This file records the original recovery sequence. Phases 0–3 are no longer a
> statement of current capability; see [AUDIT.md](AUDIT.md#current-recovery-status),
> [USAGE.md](USAGE.md), and [COMPATIBILITY.md](COMPATIBILITY.md) for the current
> editor. Remaining work should expand only from verified family structures,
> retain Simple/Nerd capability parity, and add byte-level round-trip tests.
>
> The canonical post-audit product plan is now
> [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md), and the full required
> editor inventory is
> [PERFECT_TOOL_EDITOR_CATALOG.md](PERFECT_TOOL_EDITOR_CATALOG.md).

The original goal was a trustworthy narrow tool before a broad studio.

## Phase 0 — preserve and define

- Tag the current source as a legacy baseline.
- Choose a product name and scope; avoid claiming GB/GBC support while only GBA parsers exist.
- Add a project license and third-party notices after reviewing every vendored dependency and asset.
- Add ignore rules for `roms/`, ROM extensions, and OS metadata before any staging or release work.
- Record supported game revisions by exact game code, version, region, and expected hashes where legally appropriate.

Exit condition: the repository can be redistributed and its scope is unambiguous.

## Phase 1 — recover one read-only vertical slice

- Pass loaded `games.json` metadata into the reader.
- Replace the hard-coded FireRed result with header/version validation.
- [x] Rename global `Map` to `RomMap`, rename generic `Connection` to
  `RomConnection`, and publish both through `PokemonViewer.maps` without
  replacing JavaScript's native `Map`.
- Support one known FireRed revision first.
- Make the hex viewer open reliably and show both bytes and decoded text.
- Add bounds checks and friendly parsing errors.
- Add unit tests for reads, pointer conversion, search, dictionaries, and decompression using synthetic data.

Exit condition: a supported ROM is correctly identified and browsed without mutation; unsupported input fails safely.

## Phase 2 — safe editing

- [x] Keep an immutable original byte snapshot beside mutable editor memory.
- [x] Complete byte/text editing with undo/redo in Hex Editor.
- [x] Export to a new ROM file and export a deterministic JSON byte-change report.
- [x] Add dirty-state warnings and before/after range verification.

Exit condition: a deterministic edit can be exported, reopened, and verified by an automated test.

## Phase 3 — map viewer, then editor

- Extract map parsing/rendering from UI code.
- Test palettes, tilesets, blocks, banks, connections, and entities independently.
- Re-enable read-only map navigation for the supported revision.
- Add editing only after serialization and rollback tests exist.

Exit condition: maps render reproducibly and any edit round-trips without corrupting unrelated bytes.

## Phase 4 — optional features

Evaluate the XSE editor, sprite tools, and emulator separately. Integrate only features with a clear user story, maintained dependency, legal provenance, and automated tests. The emulator should remain out of scope unless running the edited result inside PUSH is a deliberate product requirement.

## Suggested first milestone

**PUSH Legacy 0.1: FireRed Read-Only Inspector**

- local-only file handling;
- exact ROM identification;
- stable hex and text navigation;
- read-only map list if time allows;
- documented unsupported-ROM errors;
- no editing claims.

This milestone reuses the strongest existing work while minimizing corruption and compatibility risk.
