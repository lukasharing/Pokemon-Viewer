# PUSH project documentation

PUSH (Pokémon Ultimate Studio for Hacking) is a client-side editor for inspecting and editing supported Pokémon Game Boy, Game Boy Color, and Game Boy Advance ROMs in a web browser. The repository began in April 2017 and is being modernized around shared editor UI with family-specific ROM codecs.

This folder contains the living project contract plus dated audit snapshots. It
distinguishes completed foundations from partially connected UI and inactive
experiments.

## Documents

- [STATUS.md](STATUS.md) — canonical evidence snapshot, exact profiles,
  completed foundations, open blockers, and immediate priorities.
- [EDITOR_MATRIX.md](EDITOR_MATRIX.md) — canonical operation-level matrix for
  Red, Blue, Crystal, Emerald, FireRed, and the missing product domains.
- [UX_GUIDELINES.md](UX_GUIDELINES.md) — mandatory interaction and visual
  constraints for every editor, panel, window, toolbar, and dialog.
- [PERFECT_TOOL_AUDIT_2026.md](PERFECT_TOOL_AUDIT_2026.md) — master product
  decision, Normal/Nerd journey audit, missing surface, target architecture and
  definition of “100% playable.”
- [AUDIT_2026_WEB.md](AUDIT_2026_WEB.md) — current deep web product,
  architecture, UX, accessibility and QA audit.
- [AUDIT_GBA_2026.md](AUDIT_GBA_2026.md) — current GBA engine/data/editor
  comparison against `pokeruby`, `pokeemerald` and `pokefirered`.
- [AUDIT_GB_GBC_2026.md](AUDIT_GB_GBC_2026.md) — separate Gen I Red/Blue and
  Gen II Crystal coverage/correctness audit.
- [PERFECT_TOOL_EDITOR_CATALOG.md](PERFECT_TOOL_EDITOR_CATALOG.md) — complete
  editor requirements for Simple and Nerd users.
- [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md) — canonical plan and
  acceptance gates for a complete, playable studio.
- [AUDIT_BACKLOG_2026.md](AUDIT_BACKLOG_2026.md) — issue-ready P0–P3 findings
  with acceptance evidence.
- [AUDIT.md](AUDIT.md) — executive summary, evidence, risks, and current readiness.
- [ARCHITECTURE.md](ARCHITECTURE.md) — runtime flow, modules, data, and dependencies.
- [EDITOR_PERFORMANCE_2026.md](EDITOR_PERFORMANCE_2026.md) — editor-by-editor
  loading audit, progressive-render contract, current boundaries and budgets.
- [HISTORY.md](HISTORY.md) — development timeline and contribution summary.
- [RUNBOOK.md](RUNBOOK.md) — how to run and manually verify the current prototype.
- [IMPLEMENTATION_PASS_2026-07-29.md](IMPLEMENTATION_PASS_2026-07-29.md) —
  verified 411-ID GBA Pokédex, native Region/Fly Map, Emerald battle scene and
  mGBA picture-in-picture integration.
- [DEVELOPMENT.md](DEVELOPMENT.md) — SCSS, automated tests, and the `pret/pokeruby` fixture workflow.
- [SCRIPT_LANGUAGE.md](SCRIPT_LANGUAGE.md) — event/text decompilation, original-code view, and safe compilation.
- [COMPATIBILITY.md](COMPATIBILITY.md) — supported cartridge profiles and why recognized incompatible games are rejected safely.
- [CAPABILITY_MODEL.md](CAPABILITY_MODEL.md) — exact ROM fingerprints,
  Verified/Partial/Research states, provenance and fail-closed behavior.
- [ROM_HACKS.md](ROM_HACKS.md) — exact project-manifest import, validation,
  persistence, and the deliberately fail-closed path from symbols to audited
  operations.
- [PROFILE_WORKSPACE.md](PROFILE_WORKSPACE.md) — project identity, provenance,
  capability/resource/symbol inspection, and safe project-manifest management.
- [ROADMAP.md](ROADMAP.md) — legacy recovery snapshot; use
  [PERFECT_TOOL_ROADMAP.md](PERFECT_TOOL_ROADMAP.md) for current planning.
- [USAGE.md](USAGE.md) — current user guide and links to each editor guide.
- [MAP_EDITOR.md](MAP_EDITOR.md), [CODE_EDITOR.md](CODE_EDITOR.md),
  [SPRITE_EDITOR.md](SPRITE_EDITOR.md), [HEX_EDITOR.md](HEX_EDITOR.md),
  [BATTLE_EDITOR.md](BATTLE_EDITOR.md), [POKEDEX_EDITOR.md](POKEDEX_EDITOR.md),
  [SOUND_EDITOR.md](SOUND_EDITOR.md), and
  [ANIMATION_EDITOR.md](ANIMATION_EDITOR.md) — task-focused guides available
  from editor headers.

## Current status in one sentence

PUSH has credible bounded editing paths but is not yet a complete game studio;
use [STATUS.md](STATUS.md) and [EDITOR_MATRIX.md](EDITOR_MATRIX.md), rather than
dated audits, for the current capability statement.

Local development URL: [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The repository may also be published through its configured static host.

## Legal and safety note

No commercial ROM is included. Test only with ROM images that you are legally permitted to use. The repository does not currently include a project license or a third-party notices inventory, so redistribution should wait until ownership and dependency licensing are reviewed.
