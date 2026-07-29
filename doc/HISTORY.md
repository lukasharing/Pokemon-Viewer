# Project history

## Timeline

### 2017 — core project creation

The repository was created on 2017-04-18. Forty commits in 2017 established the application shell and most of the technical direction:

- ROM loading and game selection;
- map rendering, connected-map traversal, clicking, zoom, culling, topographic/height views, and palette fixes;
- FireRed support followed by broader GBA game metadata claims;
- context menus and early save-data work;
- an emulator experiment;
- class-based refactoring and ES6 migration;
- repeated UI and camera refinements.

Henrique Lorenzi contributed two map-editor commits covering recursive connected-map drawing and duplicate-map rendering.

### 2018 — upload, hex, and notifications

Five commits in 2018 introduced a new upload flow, image-loading optimization, notifications, GUI/hex-editor work, and an attempted removal of jQuery from the index.

The last original feature commit is dated 2018-11-15.

### 2019–2021 — no recorded commits

There are no commits in these years on the audited repository history.

### 2022 — revert sequence

Four commits on 2022-09-05 revert and then re-revert the 2018 jQuery and hex-editor changes. The final result restores both the hex/GUI work and the jQuery-based index behavior. No new feature development is recorded.

### 2023–2026 — no recorded commits before this audit

The audit documentation is the first new working-tree change observed after the 2022 revision.

## Contribution snapshot

Git author identities at the audited revision:

- Lukas Haring `<lukasharing@hotmail.com>` — 45 commits
- Lukas Haring García `<lukasharing@hotmail.com>` — 2 commits
- Henrique Lorenzi `<hlorenzi12@gmail.com>` — 2 commits

The two Lukas author strings appear to represent the same person but are reported separately by Git.

## Interpretation

Although the prompt describes four years on the project, the repository itself is older: it began more than nine years before this audit. “Four years” aligns with the gap since the final 2022 repository activity. The active feature-building period visible in Git was concentrated in roughly nineteen months from April 2017 to November 2018.
