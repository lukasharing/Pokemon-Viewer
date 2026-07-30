# Capability and accuracy model

PUSH separates cartridge recognition from semantic editor support. A valid
Pokémon header identifies a game family; it does not prove that stock table
addresses, commands or resource ownership match the loaded bytes.

## States

| State | Meaning | Visible in ordinary navigation |
| --- | --- | --- |
| **Verified** | The exact ROM fingerprint and operation have structural/round-trip evidence. Writes may still be limited to named verified fields. | Yes |
| **Partial** | A useful subset is confirmed and every missing part is stated. `writable` is declared independently. | Yes |
| **Research** | Heuristic discovery, pointer scanning, illustrative data or an unpinned/modified ROM. | No |
| **Unavailable** | The structure is not implemented or cannot be identified safely. | No |

The navigation and each editor header display the state. Hovering the header
badge explains the reason and provenance. Internal editor links pass through
the same gate, so a disabled Research workspace cannot be opened by bypassing
the sidebar. Exported change reports embed the exact manifest ID, fingerprint,
provenance and every workspace state/writability/evidence record.

## Exact identity

`RomFingerprint` computes SHA-1 over the complete loaded byte view. The
capability manifest matches that fingerprint together with editor profile,
game, language and revision. Current pinned references:

- `pret/pokered` reference Red and Blue;
- `pret/pokecrystal` English Crystal revision 0;
- `pret/pokeemerald` English Emerald revision 0;
- `pret/pokefirered` English FireRed revision 1.

Hashes are identifiers, not ROM content or table evidence. A profile is pinned
only when its complete fingerprint and generated source artifact agree.

The source audit itself is pinned to:

- `pret/pokered` `405b6246372d7e5a2cb029cbb65219b13286b8c9`;
- `pret/pokecrystal` `3438c7003a57fa2987fcb223d14b660761b33c64`;
- `pret/pokeruby` `63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1`;
- `pret/pokeemerald` `83df84e40623b79281f2397faa611cbf044170bd`;
- `pret/pokefirered` `df4449a27cd78dd747ce269e47d3ab4a0149d8f4`.

These remain `auditCommits` for profiles without generated artifacts. Red,
Blue, Crystal Rev 0, Emerald Rev 0, and FireRed Rev 1 carry source manifests whose
commit, build, ROM fingerprint and selected linker symbols are verified.

## Reproducible source manifests

`npm run manifest:pret` consumes a clean `pret` checkout, its linker-produced
`.sym`, and a profile configuration. It accepts RGBDS `bank:address` symbols
and GBA/GNU ROM addresses, normalizes them to cartridge offsets, requires a
full 40-character source commit, and refuses output if any declared required
symbol is missing or the checkout is dirty. Output JSON is deterministic and
contains profile, fingerprint, build, repository, commit and selected symbols.

```bash
npm run manifest:pret -- \
  --repo /path/to/pokeemerald \
  --symbols /path/to/pokeemerald/pokeemerald.map \
  --config /path/to/profile.json \
  --output /path/to/generated-manifest.json
```

The committed generated manifests cover exact Red, Blue, Crystal Rev 0,
Emerald Rev 0, and FireRed Rev 1 builds. The browser registry mirrors those
JSON artifacts, and a
regression test compares every field. Runtime profiles consume the manifest
roots for Gen I maps/trainers, Crystal map groups, and Emerald graphics,
trainers, Pokédex, map, sound, animation and Town Map table identities, plus
the corresponding bounded FireRed roots. A
symbol being present does not itself promote an incomplete editor to Verified.

Each manifest also groups labels by resource (`maps`, `species`, `trainers`,
`pokedex`, `audio`, `battleAnimations`, `townMap`, and platform variants).
Coverage is explicit (`table-root`, `table-roots`, `partial-roots` or
`cry-root`). Workspace capabilities carry only their relevant resource
declarations; headers expose them in the status explanation and change reports
serialize them. This is provenance, not proof of complete counts, ownership or
safe writes.

Every resolved workspace now also carries `resourceRequirements`: the
workspace-specific required groups, each group's declared symbols, unresolved
symbols, and a deterministic `complete` result. This keeps Map, Sprite, Sound,
Animation, and other domains independently diagnosable. The current GBA
promotion policy still requires the production audit set as an additional
profile gate; replacing that coarse gate with per-workspace promotion requires
isolated real-ROM tests for each missing-resource combination.

For Gen I, species provenance is deliberately keyed by the 190-slot internal
index, not National Pokédex number. `MonsterNames` supplies the per-slot label
and `PokedexOrder` supplies a nullable dex number; zero entries remain explicit
MissingNo. slots. Simple mode excludes those glitch slots from sound choices,
while Nerd mode may inspect them. Trainer editing validates internal IDs
against this catalog.

An unrecognized fingerprint is treated as modified/unpinned. Hex remains
available because it is bounded by the cartridge itself. Stock semantic
workspaces become Research and fail closed until PUSH supports a compatible
symbol/manifest import. The GBA emulator may remain Partial because it executes
the supplied snapshot without asserting semantic table locations.

If the cartridge title/code is also unrecognized, the base-engine chooser
creates an explicit `selection: "user-base"` /
`profileConfidence: "engine-only"` profile. It chooses the CPU/runtime only.
`MemoryProfile.verified` remains false and semantic symbol lookups fail closed.

Source-backed addresses are consumed through `MemoryProfile`, a read-only
dictionary produced from the exact artifact in `manifests/generated/`. Family
modules request named symbols such as `gMonFrontPicTable`,
`PokemonPicPointers`, or `MapGroupPointers`; UI code does not own those
addresses. `npm run manifest:pret` reads RGBDS `.sym` or GNU linker/map symbols
from the matching pret build, allowing a ROM hack to supply relocated symbols
without copying its offsets into editor code.

## Write authorization

Visibility and writability are independent. `ordinary` controls whether a
workspace is exposed; only `writable === true` authorizes a semantic mutation.
`EditorCapabilityGuard` is the shared fail-closed gate used by editor controls
and again at write entrypoints. A disabled control is not the security
boundary: every write handler must call `requireWritable` immediately before
planning or applying a patch.

The guard rejects missing manifests, unknown workspaces, Research profiles,
and Partial/Verified workspaces whose supported subset is read-only. Drivers
still validate structure ownership, ranges, encodings, and
compare-before-write rules; capability authorization does not replace those
family-specific checks.

## Current gaps

- Crystal Rev 1 still needs its own fingerprint and symbol-derived manifest.
- Ruby/Sapphire/LeafGreen and remaining GBA languages/revisions need their own
  generated manifests.
- A project must be able to import symbols for intentional hacks.
- FireRed Encounters, trainer-party writing, named map music, native sound
  mixing, and complete animation execution still need isolated evidence even
  though their candidate source roots are pinned.
- Generated manifests still need entry counts, extents, pointer kinds, owned
  ranges and signatures; current artifacts pin table roots only.
- Accuracy must propagate into documents, references, transactions and export
  validation—not only workspace chrome.

Use `npm run audit:capabilities -- <ROM...>` to print the effective matrix and
assert that Research is never exposed as an ordinary editor.

## Source dictionaries and unknown hacks

Source manifests are memory dictionaries. `MemoryProfile` is the only shared
lookup API exposed to editors; GBA, Gen I, and Gen II drivers retain separate
parsers and pointer rules. `SourceManifestRegistry.profiles(profile)` lists
candidate source builds for a selected engine, but those candidates are never
activated without a matching complete fingerprint.

For an unknown ROM hack the base-game dialog selects only the compatible
runtime. The ROM remains usable in Hex Editor and Emulator while semantic
editors stay closed. A future user-manifest importer will bind the hack's own
RGBDS `.sym` or GBA linker `.map` to its fingerprint. See
`SOURCE_DICTIONARIES_2026.md`.
