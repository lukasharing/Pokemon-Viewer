# Sound Editor

## August 2026 decoder and capability pass

The Sound Editor no longer collapses every limitation into the ambiguous
**Partial decoder** label. Each document now resolves four independent
capabilities: catalog identity, native program decoding, playable audio and
safe writing. The visible state is consequently one of **Native audio**,
**Program decoded**, **Program incomplete**, **Record verified** or
**Reference only**. A verified table entry is never presented as playable
audio, and a decoded program is never presented as mixer-accurate playback.

The Generation III decoder now covers every command declared by Emerald's
`MPlayDef.s`, including running status, `PATT`/`PEND`, `REPT`, `GOTO`, tempo,
voice, volume, pan, bend, LFO, modulation, tuning, extended commands, ties and
notes. A bounded interpreter follows calls, returns, repeats and loops with
explicit command, tick, call-depth and visit limits. This produces a real
arrangement from the ROM instead of stopping at the first branch.

Crystal now has its own physically isolated `sound/gen2` decoder. It reads the
native channel-count/header records and the Gen II command language defined by
`pokecrystal/macros/scripts/audio.asm`, including notes, rests, octave, tempo,
duty, envelope, pitch, stereo, conditions, calls, loops and returns. It does
not reuse M4A or the Red/Blue binary grammar. Hardware APU synthesis and
structural writers are still separate capabilities and remain unavailable
until they can be verified end to end.

Red/Blue now owns its separate native channel-header and stream decoder. The
generated source dictionary contains all 206 `music_const` music/SFX entries,
Crystal contains all 103 music entries plus all 207 `SFX_*` constants, and
Emerald retains all 479 named music/SFX IDs. Catalog completeness does not
pretend that an unavailable hardware mixer is playable.

Placeholder “event sound references” were removed from the catalog. The
library contains only resources backed by a ROM table or an imported source
dictionary.

## Earlier August 2026 workspace pass

The visible editor now treats playback support as a typed capability rather
than inferring it from a catalog entry. Every selected resource reports one of
three states beside its name:

- **ROM sample** — a bounded sample payload was decoded and can be auditioned;
- **Structure only** — native channels/commands were decoded but no complete
  family mixer exists yet;
- **No playback** — the verified record can be inspected or edited, but its
  underlying channel program is not decoded.

The waveform/arrangement remains the primary full-width surface. Transport,
timeline zoom, horizontal navigation and channel focus live on that surface;
parameters and references remain below it. Selecting a decoded channel fades
unrelated lanes without changing the ROM. Engine commands and offsets remain
Nerd-only.

Emerald cry audition applies the selected `ToneData` root key to the decoded
signed `WaveData` sample. Length and ADSR remain visible source parameters but
are deliberately not approximated: reproducing them requires the M4A envelope
and mixer state. The result is labelled **ROM sample audition**, not complete
M4A playback. Map music and structurally decoded tracks stay silent rather
than falling back to a generic oscillator.

## Product decision

The workspace is now an **arrangement-first sound program editor**. It is not
yet a complete tracker: Red/Blue and Crystal expose exact writable cry
parameters, Emerald can draw verified PCM `WaveData`, Emerald executes bounded
M4A programs, and Crystal decodes its native channel streams. Complete native
mixing and note/program writing still require the family engines described
below.

The target experience is a small tracker/DAW adapted to Pokémon ROM data:

```text
┌ Library / search ──────────────────────────────────────────────────────────┐
├ Native arrangement (at least 50% of the visible workspace) ───────────────┤
│ ruler │ channel 1 notes / waits / calls                                    │
│       │ channel 2 notes / waits / calls                                    │
│       │ wave / direct-sound / noise                                        │
│       │ automation: volume, pan, pitch, tempo                               │
├ Piano roll or event list ─────────────┬ Inspector ─────────────────────────┤
│ selected channel and loop region      │ note, instrument, envelope, source │
└ Transport · loop · tempo · zoom · native/solo/mute · Undo/Redo ────────────┘
```

The arrangement is the main content. Library, inspector and references are
secondary panels. Commands and offsets belong to Nerd mode; Simple mode uses
notes, instruments, duration, volume and loops.

The implemented hierarchy follows the shared editor material:

- library selectors form one thin bar above the document;
- waveform or channel arrangement occupies at least 60% of the first viewport;
- transport is attached to that primary view;
- editable parameters are visible inline below the audio instead of hidden in
  a modal dialog;
- references remain a secondary panel;
- engine commands, source names, ROM offsets, internal IDs and accuracy details
  appear only in Nerd mode.

An empty decoder produces a compact explicit unavailable state, not decorative
fake tracks or a generic oscillator. Gen I/II cry records remain inspectable
and editable, but Play stays unavailable until their native channel programs
are decoded. Emerald cries decode and play the distinct signed 8-bit PCM
payload from the verified 16-byte `WaveData` header when its size and loop
bounds are valid. The fixed-point `WaveData.freq` field is converted to Hz by
dividing by 1024, matching the 10,512 Hz cry WAV assets in `pret/pokeemerald`.

## Family architecture

The UI consumes a shared, format-free `SoundDocument`, timeline and command
contract. Binary parsing, execution, synthesis and writing stay physically
separate:

- `sound/gba/`: M4A/Sappy song headers, tracks, voicegroups, WaveData, CGB
  voices, DirectSound samples and mixer-accurate rendering.
- `sound/gbc/`: Pokémon Red/Blue audio headers and four Game Boy APU channels
  (pulse 1, pulse 2, wave and noise).
- `sound/gen2/`: Crystal music/SFX headers and its expanded channel command
  language. It must not reuse the Gen I binary decoder merely because both use
  Game Boy audio hardware.

Shared code may define documents, selection, timeline geometry, transport
state, editing commands and Web Audio output nodes. It must not contain family
offsets, opcodes, pointer arithmetic, note encodings or synthesis rules.

## What the decompilations prove

### GBA / Emerald

Emerald uses M4A/Sappy:

- `gSongTable` selects a song header.
- A song header owns track count, priority/reverb, voicegroup and track
  pointers.
- `MPlayDef.s` defines waits, notes, `FINE`, `GOTO`, `PATT`, `PEND`, `REPT`,
  tempo, voice, volume, pan, bend, LFO and modulation commands.
- Voicegroups can select DirectSound samples, programmable-square/noise
  voices, key splits and drum sets.
- `ToneData` contains voice type, root key, sample/wave pointer and envelope.

Therefore a correct GBA editor needs a control-flow-aware track interpreter,
running status, call/repeat expansion with cycle guards, voicegroup decoding,
sample decoding and an M4A mixer. A flat command scan cannot calculate the real
timeline.

Useful verified editing operations, in increasing risk order:

1. Change tempo, volume, pan, bend range and an existing voice operand.
2. Change a note key, velocity or duration without changing byte width.
3. Edit an existing loop count/target with control-flow validation.
4. Edit ADSR and root key for an exclusively owned voice.
5. Replace/relocate tracks, voicegroups or samples through the allocation
   ledger and rewrite every graph owner atomically.

### GB/GBC / Red and Blue

Red/Blue stores separate music, SFX and cry headers. Headers select one or more
hardware channels; channel streams program pulse duty/envelope, wave patterns
or noise and use note/rest, tempo, octave, loop and call commands. Pokémon
`CryData` only chooses a base cry and applies pitch/length modifiers; it is not
the cry program itself.

The editor should expose:

- four APU lanes with the real hardware channel names;
- duty and envelope automation for pulse channels;
- the selected 4-bit wave pattern for channel 3;
- noise mode/frequency/envelope for channel 4;
- base-cry program plus the per-species pitch/length transform;
- songs, jingles, cries and SFX as distinct library groups.

Playback must model Game Boy frame timing and channel registers. A generic
oscillator audition is useful only when labelled as a parameter audition; it
is not native playback.

### GBC / Crystal

Crystal retains the four-channel APU model but adds its own headers, commands,
drumkits, wave samples, stereo/panning and richer control flow. It needs an
isolated Gen II decoder, interpreter and writer. The editor can share lanes and
controls with Gen I only after both family drivers have converted their data
into the common document model.

## Required document model

```text
SoundDocument
  identity, family, kind, native timing, loop region, source graph
  ├─ SoundTrack[]       channel, entry pointer, commands, control-flow graph
  ├─ SoundEvent[]       note/rest/control/sample/call/loop with start+duration
  ├─ Instrument[]       voice/wave/noise/drum/key-split and ownership
  ├─ Automation[]       tempo/volume/pan/pitch/duty/envelope
  └─ SoundAsset[]       PCM sample, wave pattern or noise definition
```

Decoded commands remain lossless source records. Timeline events are a derived
execution view and retain their source command IDs. Editing either view must
produce one validated patch plan and one project-level Undo/Redo command.

## UX requirements

- The visual arrangement or piano roll occupies at least half of the visible
  workspace.
- Selecting a note highlights its source command and instrument; selecting a
  command focuses the corresponding note.
- Track controls are compact: enable, mute, solo, channel/instrument and
  volume. Do not use nested cards or explanatory paragraphs.
- Transport contains play/pause, stop, loop, previous/next marker, tempo and
  zoom. Disabled controls are hidden unless their state teaches something
  necessary.
- A waveform/sample panel appears only for sample-backed GBA voices. A duty/
  wave/noise panel appears for GB/GBC hardware channels.
- References open the owning Map, Pokémon, Move, Battle, Animation or Code
  resource directly.
- Map music can be opened from Map Editor and changed there; Sound Editor edits
  the referenced song rather than silently changing every map owner.
- Cries opened from Pokédex retain the Pokémon context and show both the species
  transform and shared base-cry ownership.
- Playback accuracy is always explicit: `native`, `structurally decoded`, or
  `parameter audition`. Never fall back silently.

## Validation and safe writing

Before a patch is accepted:

1. Decode the edited bytes again with the family decoder.
2. Execute the control-flow graph with bounded call depth, repeat count and
   timeline length.
3. Validate channel compatibility, note range, instrument index, pointers and
   bank constraints.
4. Validate ownership before editing shared voices, waves, samples or cries.
5. Compare the expected source bytes, reserve relocation ranges and update all
   graph references atomically.
6. Render or synthesize the edited document and show any fidelity limitation.
7. Undo must restore every byte, pointer, allocation and reference.

## Delivery order

### MVP 1 — honest native viewer (partial)

- Arrangement-first lanes and waveform-first cries are implemented.
- Resolve real names/groups for songs, map music, fanfares, SFX and cries.
- Execute track control flow and produce a deterministic timeline.
- Solo/mute channels, scrub and inspect active commands.
- Implement native playback for one pinned profile per family.

### MVP 2 — fixed-width editing

- GBA: tempo, volume, pan, voice, note, velocity and duration operands.
- Gen I/II: notes/rests, octave, tempo, duty, envelope and safe loop counts.
- Exact field forms, piano-roll drag editing and project Undo/Redo.

### MVP 3 — structural editing

- Insert/delete notes, resize tracks and relocate programs safely.
- Voicegroup/instrument editor, Game Boy wave editor and drum/noise editor.
- PCM waveform trim/loop/import for verified GBA DirectSound assets.
- Ownership-aware duplicate/detach flow for shared resources.

### MVP 4 — integrated game audio

- Map music/ambience preview using the selected map.
- Battle music and move-SFX timelines connected to Battle/Animation Editor.
- Pokémon cry design connected to Pokédex and evolution/capture scenes.
- Export/import native assembly notation plus MIDI/WAV as explicitly lossy
  interchange formats.

The Sound Editor is an arrangement/structure viewer for discovered sound
documents and an exact fixed-record editor for verified Red/Blue and Crystal
cries. It
can filter songs, cries and effects; show family, accuracy, source, ROM offset,
tracks, decoded commands and cross-editor references.

The editor reads the shared `editorPreferences` contract directly and has no
dependency on the removed `AppSettings` global. The application shell exposes
`AppSettings` only as a compatibility alias for an already cached legacy lazy
module; new editor code must use `editorPreferences`. Its lazy module is versioned
independently; the asset loader now honors a changed version even when an older
Sound Editor was already evaluated in the same page session.

## Reading the result

- **Verified** means the selected profile supplies a confirmed table/command
  layout.
- **Partial** means only part of the document is structurally decoded.
- **Read-only** means PUSH will not write that document.

A discovered pointer is not automatically a song, cry, or effect. Unknown
commands remain explicit rather than being simulated. Species cries should
show the Pokémon identity and cry table only when the resource graph proves
that association.

For exact Red/Blue profiles, the editor now decodes the real three-byte
`CryData` record for every internal species slot: base cry, pitch and length.
It preserves MissingNo. slots in Nerd mode and maps canonical entries back to
their Pokédex identity. Canonical cries now carry stable graph IDs and resolve
bidirectionally to the shared Species node. Glitch-slot cry records remain
visible in Nerd mode but are deliberately outside the canonical 151-node spine.
This is a verified parameter editor, not yet native audio playback: the
underlying headers/channel streams remain unmodeled and the record is writable
through visible inline controls with unsigned-byte validation,
compare-before-write and project Undo/Redo. The same writer is available from
Pokédex Editor. Opening a
cry from Pokédex resolves the canonical Pokédex number to the correct Gen I
internal species slot, rather than assuming both numbering systems are equal.

Editing these three bytes changes the base cry selection, pitch and length. It
does not imply that PUSH has decoded or can play the underlying channel
program.

## Missing before editing is trustworthy

The project still needs mixer-accurate instruments/waveforms/noise, audible
channel execution, channel-program writers, allocation and reference-safe
relocation. The GBA control-flow program and the separate Red/Blue and Crystal
command grammars are decoded; that program coverage must not be confused with
hardware synthesis.
These are tracked by `EDT-004`, `GEN2-002`, `DATA-004` and `DATA-006`.

## Generation III catalog

For the pinned Emerald reference, each Pokémon cry is now a verified source
chain rather than a generic species placeholder: `SpeciesToCryId` routes the
internal species ID through `gSpeciesIdToCryId` where required, then resolves
the selected 12-byte `gCryTable` `ToneData` record. Sound Editor shows its
type, root key, length, `WaveData` pointer and ADSR bytes. These are real ROM
fields and cross-link to the species; they are read-only because changing a
tone safely requires a full M4A waveform/voice ownership writer. Sound Editor
and Pokédex audition decode the signed samples from a valid bounded `WaveData`
header and play them at the ROM's fixed-point sample rate. They therefore play
the selected Pokémon's native ROM waveform while explicitly remaining browser
previews rather than complete M4A mixing.

The pinned Emerald profile exposes the exact `gSongTable` symbol and 610 native
eight-byte song records. Sound Editor lists those entries, resolves the song
header and bounded track roots. Its isolated GBA driver uses the exact command
values and widths from `MPlayDef.s` and executes bounded running status,
branches, loops, calls and returns. The UI therefore reports **Program
decoded** independently from the still-unavailable M4A mixer and writer.
Unsupported bytes stay visible as raw commands rather than receiving invented
semantics. Non-pinned GBA profiles do not scan for a lookalike table.

## Map music catalog

Map music is no longer represented by one placeholder row.

- Red/Blue reads the two-byte `MapSongBanks` entry for every one of the 248
  native map IDs and groups owners by song ID plus audio bank.
- Crystal reads each map-group entry's music byte and resolves it through the
  three-byte `Music` dba table. The catalog uses all 103 music names plus all
  207 SFX constants.
- Emerald reads `MapHeader.music` at its native `+16` field for all 518 source
  maps and resolves it through `gSongTable`. Names come from
  `include/constants/songs.h`; the source catalog contains 479 named music and
  SFX constants.

Each map reference is shown in **Used by** and opens the owning Map Editor
location. These references, IDs, banks, headers, track roots, and M4A command
rows come from the ROM/source dictionaries.

Map songs deliberately remain silent when the family mixer is not decoded.
The Play button is enabled only for a real decoded waveform (currently verified
Emerald Pokémon `WaveData`), never for a fabricated oscillator. Native map
music playback still requires the Gen I/II APU synthesizers and the Generation
III M4A voicegroup/sample mixer described above.

The catalog generator is:

```sh
node scripts/generate-audio-source-catalog.mjs \
  --pokered /path/to/pokered \
  --pokecrystal /path/to/pokecrystal \
  --pokeemerald /path/to/pokeemerald \
  --output js/sound/source-catalog.js
```
