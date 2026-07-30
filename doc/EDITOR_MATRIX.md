# Editor capability matrix

> Evidence snapshot: 2026-07-31 04:18 KST
> Implementation baseline: `cf5143f22c7b2041c6706e60390a21d7bf40ccdb`

This matrix records **profile- and operation-specific** evidence. It is not a
general promise that an editor works for every game in a family.

## Legend and evidence rules

| Mark | Meaning |
| --- | --- |
| **V** | Verified for the bounded scope described in the row. |
| **P** | Partial: useful real behavior exists, but the named domain is incomplete. |
| **R** | Research: heuristic or unpinned; hidden from ordinary navigation. |
| **U** | Unavailable: no safe implementation is registered. |
| **—** | Not applicable or not proven. |

- **Discovery** requires an exact manifest root, exact fixed structure, or
  equivalent source-backed identity. A pointer scan alone is Research.
- **Native preview** requires actual ROM tiles, sprites, palettes, fonts,
  samples, or command data. A placeholder does not count.
- **Write** covers only the named fixed fields or owned records. It never
  implies arbitrary growth or complete-domain writing.
- **Undo/Redo** means the supported write path is command-backed. It does not
  prove that every field shown by the editor is writable.
- **Emulator proof** means an exported change was exercised in game. Merely
  opening the emulator or rendering an editor preview is not proof.
- The overall **Accuracy** cell is the workspace state returned by
  `CapabilityManifest`; operation cells may be narrower.

### Test references

| ID | Current evidence |
| --- | --- |
| `T-CORE` | `test/project.test.mjs`, `test/runtime-safety.test.mjs`, `test/resource-graph.test.mjs` |
| `T-MANIFEST` | `test/pret-manifest.test.mjs`, `test/project-manifest-registry.test.mjs`, `test/source-symbol-parser.test.mjs` |
| `T-WRITE` | `test/editor-capability-guard.test.mjs` |
| `T-CODE` | `test/gbc-codec.test.mjs`, `test/code-logic-graph.test.mjs` |
| `T-MAP` | Map and structure cases in `test/project.test.mjs`, `test/map-movement-profiles.test.mjs`, `test/encounter-map-panel.test.mjs` |
| `T-SPRITE` | `test/gba-sprite-catalog.test.mjs`, sprite and codec cases in `test/project.test.mjs` |
| `T-TRAINER` | `test/gen1-trainers.test.mjs`, `test/gen2-trainers.test.mjs`, GBA trainer cases in `test/gba-domains.test.mjs` |
| `T-SPECIES` | `test/gen1-species.test.mjs`, `test/gen2-species.test.mjs`, `test/gen2-progression.test.mjs`, `test/gba-domains.test.mjs`, `test/species-catalog.test.mjs` |
| `T-MOVE` | `test/gen1-moves.test.mjs`, move cases in `test/gen2-progression.test.mjs` and `test/project.test.mjs` |
| `T-ENCOUNTER` | `test/gen1-encounters.test.mjs`, `test/gen2-encounters.test.mjs`, Generation III encounter cases in `test/gba-domains.test.mjs`, and encounter cases in `test/project.test.mjs` |
| `T-SOUND` | `test/gba-sound-codec.test.mjs`, `test/sound-audition.test.mjs` |
| `T-ANIMATION` | Animation and native visual cases in `test/project.test.mjs`, `test/code-logic-graph.test.mjs` |
| `T-UI` | `test/editor-descriptor-registry.test.mjs`, `test/editor-view-models.test.mjs`, `test/ui-layout.test.mjs`, UI contract cases in `test/project.test.mjs` |

At this snapshot, syntax passed for 232 first-party scripts, family-boundary
validation passed for 16 shared modules and 104 isolated family modules across
3 groups, and 399/399 Node tests passed. No current browser/device, visual-golden, or
deterministic emulator gameplay suite was executed, so Emulator proof remains
unproven throughout the semantic editor rows below.

## Generation I — Red, English reference

Manifest: `manifests/generated/gen1-red.json`
SHA-1: `ea9bcae617fdf159b045185467ae58b2e4a48b9a`
Source: `pret/pokered` at
`405b6246372d7e5a2cb029cbb65219b13286b8c9`

| Editor/domain | Discovery | Read | Native preview | Edit UI | Write | Undo/Redo | Emulator proof | Accuracy | Tests/evidence | Principal blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hex | V | V | V byte/text view | V | V bounded bytes/checksum | V | — | **Verified** | T-CORE | No typed ownership overlay or xrefs for the complete ROM. |
| Code / scripts / text | V | V bounded LR35902 and family codecs | V source/disassembly | V | V only proven codec/owner paths | V | — | **Verified** | T-CODE, T-CORE | Not a complete symbol/CFG/linker or all-engine source writer. |
| Map / events / connections | V | V | V native tiles/maps | V | V supported structures | V | — | **Verified** | T-MAP, T-CORE | Full story/music/weather/world validation is incomplete. |
| Sprite / graphics | V | V owned 2bpp sources | V | V | V only proven ownership | V | — | **Verified** | T-SPRITE | Complete catalog, compression, animation, import/repointing are incomplete. |
| Battle / trainers | V trainer and native HUD roots/formats | P | P exact HUD/status/text-box/party tiles plus supported pictures | P existing members | P fixed existing formats | P | — | **Partial** | T-TRAINER, T-SPECIES, T-MANIFEST | Party resize, AI, engine rules, animation, and complete battle scene are incomplete. |
| Pokédex / Species | V | P broad joined subset | P exact supported pictures/text | P | P measurements/base fields/cries/TM-HM/progression | P | — | **Partial** | T-SPECIES, T-MOVE | Picture recompression and general progression-bank growth need a linker/rebuild path. |
| Moves | V | P all 165 fixed records plus known links | P semantic record/animation link | P | P power/accuracy/PP/type | P | — | **Partial** | T-MOVE | Effect streams, wider compatibility, descriptions, and complete animation/audio ownership. |
| Sound | V CryData/map songs | P | P cry parameters; no complete song playback | P | P three-byte cries | P | — | **Partial** | T-SOUND, T-SPECIES | APU channel execution, instruments, song playback, and stream writing. |
| Animation | V move roots/visual tables | P | P native bounded visuals | P timeline/nodes | U general writer | — | — | **Partial** | T-ANIMATION, T-MANIFEST | Complete special effects, scene execution, and verified encoders. |
| Encounters | V | P 107 documents/706 displayed slots | P native Species rows/battle link | P | P fixed records and owned static operands | P | — | **Partial** | T-ENCOUNTER, T-MAP | Repel/runtime state, Old/Good Rod eligibility, and machine-code contexts. |
| Items | V names/prices | P 83 records | P shared field sprite only | P | P BCD prices | P | — | **Partial** | T-CORE | Effects, inventory/economy, shops, and per-item asset ownership. |
| Emulator | — | P cartridge execution | P runtime screen | P controls | — | — | P runtime only; no semantic scenario | **Partial** | T-CORE | Semantic refresh/debug bridge and deterministic gameplay tests. |

## Generation I — Blue, English reference

Manifest: `manifests/generated/gen1-blue.json`
SHA-1: `d7037c83e1ae5b39bde3c30787637ba1d4c48ce2`
Source: `pret/pokered` at
`405b6246372d7e5a2cb029cbb65219b13286b8c9`

The Blue capability audit was executed against the supplied local ROM and
returned the states below.

| Editor/domain | Discovery | Read | Native preview | Edit UI | Write | Undo/Redo | Emulator proof | Accuracy | Tests/evidence | Principal blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hex | V | V | V byte/text view | V | V bounded bytes/checksum | V | — | **Verified** | T-CORE, live capability audit | No typed ownership overlay or xrefs for the complete ROM. |
| Code / scripts / text | V | V bounded LR35902 and family codecs | V source/disassembly | V | V only proven codec/owner paths | V | — | **Verified** | T-CODE, T-CORE | Not a complete symbol/CFG/linker or all-engine source writer. |
| Map / events / connections | V | V | V native tiles/maps | V | V supported structures | V | — | **Verified** | T-MAP, T-CORE | Full story/music/weather/world validation is incomplete. |
| Sprite / graphics | V | V owned 2bpp sources | V | V | V only proven ownership | V | — | **Verified** | T-SPRITE | Complete catalog, compression, animation, import/repointing are incomplete. |
| Battle / trainers | V trainer and native HUD roots/formats | P | P exact HUD/status/text-box/party tiles plus supported pictures | P existing members | P fixed existing formats | P | — | **Partial** | T-TRAINER, T-SPECIES, T-MANIFEST, live capability audit | Party resize, AI, engine rules, animation, and complete battle scene are incomplete. |
| Pokédex / Species | V | P broad joined subset | P exact supported pictures/text | P | P measurements/base fields/cries/TM-HM/progression | P | — | **Partial** | T-SPECIES, T-MOVE | Picture recompression and general progression-bank growth need a linker/rebuild path. |
| Moves | V | P all 165 fixed records plus known links | P semantic record/animation link | P | P power/accuracy/PP/type | P | — | **Partial** | T-MOVE | Effect streams, wider compatibility, descriptions, and complete animation/audio ownership. |
| Sound | V CryData/map songs | P | P cry parameters; no complete song playback | P | P three-byte cries | P | — | **Partial** | T-SOUND, T-SPECIES | APU channel execution, instruments, song playback, and stream writing. |
| Animation | V move roots/visual tables | P | P native bounded visuals | P timeline/nodes | U general writer | — | — | **Partial** | T-ANIMATION, T-MANIFEST | Complete special effects, scene execution, and verified encoders. |
| Encounters | V | P 107 documents/706 displayed slots | P native Species rows/battle link | P | P fixed records and owned static operands | P | — | **Partial** | T-ENCOUNTER, T-MAP | Repel/runtime state, Old/Good Rod eligibility, and machine-code contexts. |
| Items | V names/prices | P 83 records | P shared field sprite only | P | P BCD prices | P | — | **Partial** | T-CORE | Effects, inventory/economy, shops, and per-item asset ownership. |
| Emulator | — | P cartridge execution | P runtime screen | P controls | — | — | P runtime only; no semantic scenario | **Partial** | T-CORE | Semantic refresh/debug bridge and deterministic gameplay tests. |

## Generation II — Crystal, English Rev 0

Manifest: `manifests/generated/gen2-crystal.json`
SHA-1: `f4cd194bdee0d04ca4eac29e09b8e4e9d818c133`
Source: `pret/pokecrystal` at
`3438c7003a57fa2987fcb223d14b660761b33c64`

| Editor/domain | Discovery | Read | Native preview | Edit UI | Write | Undo/Redo | Emulator proof | Accuracy | Tests/evidence | Principal blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hex | V | V | V byte/text view | V | V bounded bytes/checksum | V | — | **Verified** | T-CORE | No complete typed ownership/xref overlay. |
| Code / scripts / text | V | P bounded event/text codecs | P source view | P inspector | U at workspace gate | — | — | **Partial** | T-CODE, T-MANIFEST | Complete command ownership, compilation, and relocation audit. |
| Map / events / connections | V group roots/typed layouts | P | P native Gen II rendering | P inspector | U at workspace gate | — | — | **Partial** | T-MAP, T-MANIFEST | Fresh stock-ROM edit/export/reload proof and complete ownership. |
| Sprite / graphics | V graphics roots | P overworld/partial LZ | P | P inspector | U at workspace gate | — | — | **Partial** | Pokémon/trainer compressed graphics ownership and writers. |
| Battle / trainers | V | P 67 classes/541 trainers/four formats | P native owned pictures | P | P existing members/items/moves | P | — | **Partial** | Party resize, AI/rematches, complete scene and animation engine. |
| Pokédex / Species | V | P broad 251-Species graph | P front pictures/palettes/text | P | P base fields/measurements/cries/progression/TM-HM | P | — | **Partial** | Back pictures, extra Unown forms, animations, text growth, and broader species tables. |
| Moves | V | P all 251 fixed records and known links | P semantic/animation links | P | P fixed fields and compatibility | P | — | **Partial** | Effect handlers, full command streams, descriptions, and wider references. |
| Sound | V cries/music/map references | P | P cries/catalog; no native program execution | P | P six-byte cries | P | — | **Partial** | APU playback, channels, instruments, loops, and stream writers. |
| Animation | V command/object/visual roots | P | P bounded native objects/flow | P timeline/nodes | U | — | — | **Partial** | Complete object movement callbacks, tilemap/palette composition, and writers. |
| Encounters | V | P 224 documents/2,486 displayed slots | P native Species rows/battle link | P | P fixed records and 17 owned direct commands | P | — | **Partial** | Roamer save state, runtime modifiers, machine-code/state-derived contexts. |
| Items | V exact names/attributes/description roots | P 255 usable records | P no fabricated per-item icon | P properties/description | P seven-byte fixed attributes | P | — | **Partial** | T-CORE, T-MANIFEST, exact ROM audit | Names/descriptions, shops, effect code, mail/Apricorn systems, and broader economy graph. |
| Emulator | — | P cartridge execution | P runtime screen | P controls | — | — | P runtime only; no semantic scenario | **Partial** | T-CORE | Semantic refresh/debug bridge and deterministic gameplay tests. |

Crystal Rev 1 is not covered by this table. It needs its own fingerprint,
generated manifest, and validation evidence.

## Generation III — Emerald, English Rev 0

Manifest: `manifests/generated/gen3-emerald.json`
SHA-1: `f3ae088181bf583e55daf962a92bb46f4f1d07b7`
Source: `pret/pokeemerald` at
`83df84e40623b79281f2397faa611cbf044170bd`

The Emerald capability audit was executed against the supplied local ROM and
returned the states below.

| Editor/domain | Discovery | Read | Native preview | Edit UI | Write | Undo/Redo | Emulator proof | Accuracy | Tests/evidence | Principal blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hex | V | V | V byte/text view | V | V bounded bytes/checksum | V | — | **Verified** | T-CORE, live capability audit | No complete typed ownership/xref overlay. |
| Code / scripts / text | V | V bounded ARM/THUMB/event/text | V source/disassembly | V | V proven owner/relocation paths | V | — | **Verified** | T-CODE, T-CORE | Complete symbols/CFG/source rebuild and all opcode ownership. |
| Map / events / connections | V | V bounded vertical slice | V native map resources | V | V supported structures | V | — | **Verified** | T-MAP, T-CORE | Complete encounters/weather/music/story/world validation and all maps. |
| Sprite / graphics | V | V owned 4bpp sources | V | V | V only proven ownership | V | — | **Verified** | T-SPRITE, T-SPECIES | Full catalog, OAM/composition, import/recompression/repointing. |
| Battle / trainers | V | P | P native profiled resources | P | P Emerald-owned fields | P | — | **Partial** | T-TRAINER, T-SPECIES | Full battle engine, AI, effects, trainer variants, and scene validation. |
| Pokédex / Species | V | P names/entries/front/evolution/TM-HM/cry routing | P | P | P measurements/evolution slots/machine bits | P | — | **Partial** | T-SPECIES | Base stats, learnsets, egg moves, back sprites, cry writing, and wider references. |
| Moves | V | P all 354 fixed records and known links | P semantic/animation view | P | P fixed fields with flags preserved | P | — | **Partial** | T-MOVE, T-ANIMATION | Effects, audio ownership, complete command execution, descriptions/wider writers. |
| Sound | V song/map/cry roots | P bounded M4A headers/tracks/WaveData | P native WaveData and decoded commands | P inspector | U | — | — | **Partial** | T-SOUND | Complete M4A mixing, voicegroups/instruments, loops, and stream writing. |
| Animation | V move/species roots | P command flow/picture sequences | P native scene and bounded visuals | P timeline/nodes | P species picture/duration/movement assignment only | P bounded commands | — | **Partial** | T-ANIMATION, T-MANIFEST | Visual tasks/callbacks, complete scene execution, and complex writers. |
| Encounters | V exact manifest root | P 124 map headers and native methods | P native Species rows/battle links | P | P rates/species/level ranges | P | — | **Partial** | T-ENCOUNTER, T-MAP, T-MANIFEST, live capability audit | Swarms, runtime modifiers, conditions, full ownership graph, and emulator simulation. |
| Items | V exact record/icon roots | P 376 usable records | P native 24×24 LZ77 bag icons | P | P price/pocket/importance | P | — | **Partial** | T-SPRITE, T-CORE, T-MANIFEST, live capability audit | Effects, descriptions, shops/economy graph, icon recompression and broader ownership. |
| Emulator | — | P snapshot execution | P runtime screen | P controls | — | — | P runtime only; no semantic scenario | **Partial** | T-CORE | Semantic hot refresh/debug bridge and deterministic gameplay tests. |

## Generation III — FireRed, English Rev 1

Manifest: `manifests/generated/gen3-firered-rev1.json`
SHA-1: `dd5945db9b930750cb39d00c84da8571feebf417`
Source: `pret/pokefirered` at
`df4449a27cd78dd747ce269e47d3ab4a0149d8f4`

The generated manifest is byte-identical to the supplied Rev 1 ROM and pins 40
symbols grouped into 11 resources. The real-ROM audit decoded a 14×9 map with
five events, six script commands, 152 overworld sprites, 411 Species, 354
moves, and 227 encounter documents with 2,176 slots, then restored the
complete edit/export/import/Undo cycle exactly.

| Editor/domain | Discovery | Read | Native preview | Edit UI | Write | Undo/Redo | Emulator proof | Accuracy | Tests/evidence | Principal blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hex | V | V | V byte/text view | V | V bounded bytes/checksum | V | — | **Verified** | T-CORE, live capability audit | No complete typed ownership/xref overlay. |
| Code / scripts / text | V | V bounded ARM/THUMB/event/text | V source/disassembly | V | V proven owner/relocation paths | V | — | **Verified** | T-CODE, T-CORE, real-ROM audit | Complete symbols/CFG/source rebuild and all opcode ownership. |
| Map / events / connections | V | V bounded vertical slice | V native map resources | V | V supported structures | V | — | **Verified** | T-MAP, T-CORE, real-ROM audit | Complete encounters/weather/music/story/world validation and all maps. |
| Sprite / graphics | V | V owned 4bpp sources | V | V | V only proven ownership | V | — | **Verified** | T-SPRITE, real-ROM audit | Full catalog, OAM/composition, import/recompression/repointing. |
| Battle / trainers | V roots | P read/scene resources | P native profiled resources | P | U FireRed party writer | — | — | **Partial** | T-TRAINER, T-SPRITE | FireRed party formats/writers, AI, effects, and complete scene validation. |
| Pokédex / Species | V | P names/front/back/menu icon and joined tables | P | P | P only shared verified fixed fields | P bounded paths | — | **Partial** | T-SPECIES, T-MANIFEST, real-ROM audit | FireRed-specific field ownership, progression, descriptions, cries and full writer audit. |
| Moves | V | P all 354 fixed records and known links | P semantic/animation view | P | P shared fixed fields with flags preserved | P | — | **Partial** | T-MOVE, T-ANIMATION, real-ROM audit | Effects, descriptions, compatibility ownership, and complete animation/audio execution. |
| Sound | V roots | P bounded M4A structures | P decoded structural data | P inspector | U | — | — | **Partial** | T-SOUND, T-MANIFEST | FireRed song count/names/map index, mixer, voicegroups and safe stream writer. |
| Animation | V roots | P structural command roots | P bounded visuals | P timeline/nodes | U | — | — | **Partial** | T-ANIMATION, T-MANIFEST | FireRed-native complete interpreter, scene composition and verified writers. |
| Encounters | V exact manifest root and source contract | P 132 headers/227 documents/2,176 slots | P native Species rows/battle links | P | P rates/species/level ranges | P | — | **Partial** | T-ENCOUNTER, T-MANIFEST, real-ROM audit, live capability audit | Altering Cave switching, Tanoby runtime gates, encounter modifiers, full ownership graph, and emulator simulation. |
| Items | V roots | P shared Gen III fixed records | P native icons | P | P shared bounded fields | P | — | **Partial** | T-SPRITE, T-MANIFEST | FireRed-specific effects/economy/shops and complete ownership graph. |
| Emulator | — | P snapshot execution | P runtime screen | P controls | — | — | P runtime only; no semantic scenario | **Partial** | T-CORE | Semantic bridge and deterministic gameplay tests. |

## Domains required by the goal but not yet complete editors

This table prevents fragments embedded in existing workspaces from being
mistaken for complete domains.

| Required domain | Current disposition | Family separation | Evidence or current host | Required closure |
| --- | --- | --- | --- | --- |
| Project Overview | **Unavailable** | Shared UI, profile-neutral | No workspace descriptor | Exact identity, tasks, recent resources, changes, validation, Test and Export home. |
| Standalone Species Editor | **Partial fragment** | Separate Gen I/Gen II/GBA providers | Hosted mainly by Pokédex and resource graph | Complete species document and task UI without coupling it to Pokédex presentation. |
| Trainer / Party Editor | **Partial fragment** | Separate Gen I/Gen II/GBA battle drivers | Battle workspace and trainer tests | Dedicated named trainer/party workflow, all formats, resizing, AI/rematches, map/script links. |
| Text / Localization catalog | **Partial fragment** | Family text codecs are separate | Code and event links | Project-wide strings, owners/xrefs, search, preview, relocation and language validation. |
| Tileset / Metatile / Palette | **Partial fragment** | Family map/sprite codecs are separate | Map Blocks and Sprite | Dedicated catalog, composition, behavior/collision, palettes, animation and ownership-aware writes. |
| Evolution / Learnset | **Partial fragment** | Gen I and Gen II progression; GBA subset | Pokédex and Moves | Dedicated editor for every method/list variant and reverse-reference validation. |
| Battle Rules / Types / Abilities / Status / AI | **Unavailable as a domain** | Must remain family-specific behind shared documents | Scattered fixed fields only | Exact formulas, type charts, effects, AI scripts/traces, statuses, writers and battle tests. |
| Shop / Gift / Trade / Pickup / Economy | **Unavailable as a domain** | Must use family-specific item/script owners | Item prices and raw scripts are fragments | Named offers/inventories/rewards, ownership graph, validation and runtime proof. |
| Save Data / Player / Party / Boxes / Bag / RTC | **Unavailable** | Separate save formats mandatory | No editor | Checksums, redundancy/encryption, complete schemas, safe import/export and ROM compatibility checks. |
| Flags / Variables / Progression | **Partial fragment** | Family script/save semantics differ | Code and progression resources | Semantic catalog, xrefs, task UI, save/runtime state and validation. |
| Weather / Field effects / NPC movement | **Partial fragment** | Family map/engine drivers differ | Map attributes/events | Dedicated semantic documents, previews, writers, and runtime behavior tests. |
| UI / HUD / Fonts / Window frames / Screens | **Partial rendering libraries** | Family graphics/font drivers are separate | Native font, Battle and Sprite rendering | Resource catalog, mounted screen editor, safe composition/writers and visual goldens. |
| Intro / Title / Cutscenes / Credits | **Partial Animation fragment** | Family animation engines differ | Animation catalog | Complete scene documents, deterministic interpreters, native mounted preview and verified writers. |
| Changes / Problems / Validation / Export | **Partial infrastructure; no workspace** | Shared project layer | Command journal, validators and export tests | Durable navigable UI, diagnostics, patch plan and artifact decisions. |
| Profile / Symbols / Schemas / ROM hacks | **Partial workspace** | Shared inspector consumes family-neutral contracts; RGBDS GB/GBC and GNU GBA parsing remain isolated behind one source module | Generated manifests, exact JSON/direct-symbol project import, `MemoryProfile`, live workspace/write/resource coverage percentages, sortable capability/resource/symbol views, project-manifest export/removal, `test/profile-workspace.test.mjs` | Counts, extents, pointer kinds, structural signatures/owners, compatible operation audits and schema migration. |
| Semantic emulator/debugger | **Partial** | GB/GBC/GBA cores remain isolated | Emulator workspace | Resource watches, correct refresh/restart rules, saves, breakpoints/traces and deterministic scenarios. |
| GBA-specific systems | **Unavailable or scattered** | GBA-only | No complete domain editors | Contests, condition/ribbons/Pokéblocks, berries/soil, Secret Bases, decorations, TV/outbreaks, facilities and title-specific systems. |
| Gen I-specific systems | **Unavailable or scattered** | Gen I-only | No complete domain editors | SGB presentation, Safari/Game Corner, badge/HM progression, Hall of Fame, link/trade/battle and opt-in glitch content. |
| Crystal-specific systems | **Unavailable or scattered** | Gen II-only | No complete domain editors | Time palettes/events, RTC, breeding/daycare, phone/radio, Apricorn/mail/decorations, Unown, Contest/Tower/Mystery Gift. |

## Matrix maintenance rule

An entry may be promoted only when the same change provides:

1. an exact profile and source/table identity;
2. bounded structural evidence;
3. the appropriate read/preview/write/Undo tests;
4. browser evidence for user-interface claims;
5. export/reopen evidence for writer claims that alter a ROM;
6. emulator scenario evidence before “runtime verified” is stated;
7. updated `CapabilityManifest`, this matrix, and
   [STATUS.md](STATUS.md).

If evidence is absent or indirect, retain Partial, Research, or Unavailable.
