# Development workflow

## Prerequisites

- Node.js 20 or newer
- npm
- Python 3 or another static HTTP server

Install the development dependency once:

```bash
npm install
```

## SCSS workflow

The browser continues to load `css/style.css`, but that file is now generated. Edit only the sources under `scss/`:

```text
scss/app.scss        entry point
scss/_tokens.scss    color, spacing, radius, elevation, and mixins
scss/_base.scss      reset, typography, utilities, and scrollbars
scss/_shell.scss     sidebar, navigation, chooser, cards, and responsive layout
scss/_material.scss  shared inputs, menus, windows, buttons, and notifications
scss/editors/        active hex, map, code, and sprite surfaces
```

Build once:

```bash
npm run build
```

Build continuously while editing:

```bash
npm run watch
```

The compiled CSS is committed so the static GitHub Pages deployment does not require a server-side build.

## Automated checks

`npm test` runs a family-boundary gate after syntax validation. The gate
rejects GBA/GB(C)/Gen II selectors in shared Battle and Sprite UI/renderers,
and rejects cross-family references inside their isolated driver/compositor
directories. When a native difference is discovered, add it to the relevant
family module and extend the semantic document contract; never silence the
gate by moving a binary/layout branch to another shared helper.

Run the complete zero-ROM test suite:

```bash
npm test
```

It compiles SCSS, syntax-checks 145 non-vendored first-party scripts, and runs
199 Node tests covering memory, structures, codecs, writers, retry behavior,
editor disposal and source contracts. A real-browser matrix that opens every
workspace for every supported profile is still missing; that remaining gate is
tracked by `WEB-008`/`QA-001` in
[AUDIT_BACKLOG_2026.md](AUDIT_BACKLOG_2026.md).
The suite does not need copyrighted game data.

Audit the truthful workspace matrix of locally owned ROMs:

```bash
npm run audit:capabilities -- /absolute/path/to/game.gba
```

Audit the complete currently modeled Species spine of an exact locally owned
Crystal ROM:

```bash
npm run audit:gen2-species -- /absolute/path/to/pokecrystal.gbc manifests/generated/gen2-crystal.json
```

This hashes the complete ROM locally, resolves its capability manifest and
verifies all 251 names/BaseData/Pokédex/cries/front pictures/palettes, all 251
move records, all five evolution methods, every level-up entry and every egg
move, plus the exact typed graph totals. It does not upload or modify the ROM.

Audit every canonical Red/Blue Species/Pokédex record and front picture:

```bash
npm run audit:gen1-species -- /absolute/path/to/pokered.gbc manifests/generated/gen1-red.json
```

The command requires the exact manifest fingerprint, reads all 151 entries,
base records, cry records and compressed pictures, and never writes or prints
ROM content.

Generate a source-pinned table manifest after building a clean `pret` checkout:

```bash
npm run manifest:pret -- --repo /path/to/pret \
  --symbols /path/to/build.sym \
  --config /path/to/profile.json \
  --output /path/to/manifest.json
```

The generator understands RGBDS and GBA/GNU symbol formats, normalizes ROM
offsets, preserves exact sizes from GNU `nm -S`/linker-map rows, records the
exact git commit, rejects dirty sources and fails when a required symbol is
absent. GNU linker-map addresses with or without `0x` are accepted. Configured
metadata may add reviewed count, stride, pointer encoding and ownership facts;
it must never estimate them from adjacent labels.

After changing reviewed metadata, run:

```bash
npm run manifest:sync
```

This updates the fingerprinted JSON artifacts and generates the browser
registry from them. Parser/provenance behavior and registry drift are part of
`npm test`. See [`../manifests/README.md`](../manifests/README.md) for the exact
profiles already generated.

Check one or more locally owned or locally built ROMs:

```bash
npm run test:rom -- /absolute/path/to/game.gba
```

The command reads the GBA header, validates supported game codes and plausible size, and recognizes exact upstream `pret/pokeruby` Ruby/Sapphire reference builds by their published SHA-1 values. It never modifies or uploads a ROM.

## Using pret projects

Keep `pokeruby` as a sibling checkout instead of copying it into this repository:

```text
parent/
  Pokemon-Viewer/
  pokeruby/
```

Follow the upstream `INSTALL.md` for the current platform and build Ruby or Sapphire there. Then verify the output from this repository:

```bash
npm run test:rom -- ../pokeruby/pokeruby.gba
npm run test:rom -- ../pokeruby/pokesapphire.gba
```

The upstream reference hashes are:

- Ruby: `f28b6ffc97847e94a6c21a63cacf633ee5c8df1e`
- Sapphire: `3ccbbd45f8553c36463f13b938e833f652b793e4`

This gives PUSH a reproducible source-based compatibility target. Later parser tests should derive small, non-copyrightable structural fixtures from documented formats rather than committing full generated ROMs.

For Game Boy, keep [`pret/pokered`](https://github.com/pret/pokered) as another sibling checkout and follow its upstream `INSTALL.md`. It builds reference Red and Blue ROMs that can be checked locally:

```bash
npm run test:rom -- ../pokered/pokered.gbc
npm run test:rom -- ../pokered/pokeblue.gbc
```

PUSH recognizes the upstream reference SHA-1 values for Red (`ea9bcae617fdf159b045185467ae58b2e4a48b9a`) and Blue (`d7037c83e1ae5b39bde3c30787637ba1d4c48ce2`). The actual output filenames may follow upstream naming; pass whichever `.gb` or `.gbc` files the build produces.

## Runtime module boundaries

The initial page deliberately avoids editor-family code:

- shell: notifications, file loading, asset loading, detector router, reader, and bootstrap;
- `.gba`: GBA detector and shared hex viewer; GBA decompression/graphics/map modules are deferred again until the Map workspace is opened;
- `.gb`/`.gbc`: GB detector and shared hex viewer only;
- CodeMirror and IodineGBA: not loaded because those editors are not active yet.

`js/core/asset-loader.js` loads scripts sequentially and caches each exact URL.
Repeated requests for the same version are reused, while a new `?v=` revision
is evaluated so a previously opened lazy editor cannot retain stale globals
after an application update.

Shared binary mutations go through `js/core/memory-utils.js`. It validates
ranges before writes and validates complete patch sets before applying them.
Use `MemoryCursor` for sequential parsing and retain pointer translation in
`GbaMemory` or `GbcMemory`; do not add platform assumptions to `MemoryUtils`.

Script codecs share `js/core/binary-codec-utils.js` for sequential
little-endian command operands. `BinaryCodecUtils.read()` returns values,
original operand offsets, and the next cursor; `append()` validates and writes
one-to-four-byte operands; `number()` strictly parses `$FF`, `0xFF`, and
decimal literals with line-aware overflow errors; `format()` emits consistently
padded source values.
This helper deliberately does not translate pointers or mutate ROM memory.
Use the family memory classes and `MemoryReferenceUtils` for address ownership,
and `MemoryUtils`/`StructureWriter` for actual editor mutations.

jQuery is no longer shipped or loaded. Active UI, notifications, sizing,
uploads, module orchestration, and both map drivers use native DOM APIs.
`js/core/dom.js` simplifies element construction and `js/core/event-scope.js`
owns abortable listeners, cleanup callbacks, and animation frames. Every
long-lived editor must destroy its scope when a ROM is replaced.

## Manual UI verification

Start the site:

```bash
npm start
```

Open `http://127.0.0.1:4173/` and verify:

1. the white sidebar, green Select Game action, and blue material chooser retain the original PUSH identity;
2. game cards populate after initial loading;
3. the selected game has a circular check indicator;
4. the chooser remains usable without horizontal page overflow;
5. below 820 px, the sidebar collapses to icons.

The game selector is intentionally absent. The ROM detector router chooses a family module from the selected extension and validates the file header before opening it.

Detection is now split across `js/rom/gba-detector.js` and `js/rom/gb-detector.js`, coordinated by `js/rom/detector.js`. GBA uses header offsets `0xA0`–`0xBC`; GB/GBC uses `0x134`–`0x14D`, including the color flag, destination code, revision, and header checksum. Non-Japanese GB/GBC headers do not encode a reliable language, so they are reported honestly as `INTL` instead of guessed as English.
