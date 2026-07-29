# Sound Editor

## Product decision

The current workspace is a **sound catalog and structure inspector**, not yet a
complete sound editor. Renaming a list of decoded commands or adding a Play
button would not close that gap. An actual editor must let a user hear, select,
change and validate native musical events while preserving the semantics of the
loaded engine.

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

### MVP 1 — honest native viewer

- Replace the current list-first layout with arrangement-first lanes.
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

The Sound Editor is an inspector for discovered sound documents and an exact
fixed-record editor for verified Red/Blue cries. It
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
This is a verified record inspector, not yet audio
playback: the underlying headers/channel streams remain unmodeled and the
record is writable with unsigned-byte validation, compare-before-write and
project Undo/Redo. The same writer is available from Pokédex Editor. Opening a
cry from Pokédex resolves the canonical Pokédex number to the correct Gen I
internal species slot, rather than assuming both numbering systems are equal.

Editing these three bytes changes the base cry selection, pitch and length. It
does not imply that PUSH has decoded or can play the underlying channel
program.

## Missing before editing is trustworthy

The project still needs engine-specific command coverage, tempo/channel
semantics, instruments/waveforms/noise, loop/call flow, accurate playback,
Crystal channel targets/programs, channel-program writers, allocation and
reference-safe relocation.
These are tracked by `EDT-004`, `GEN2-002`, `DATA-004` and `DATA-006`.

## Generation III catalog

For the pinned Emerald reference, each Pokémon cry is now a verified source
chain rather than a generic species placeholder: `SpeciesToCryId` routes the
internal species ID through `gSpeciesIdToCryId` where required, then resolves
the selected 12-byte `gCryTable` `ToneData` record. Sound Editor shows its
type, root key, length, `WaveData` pointer and ADSR bytes. These are real ROM
fields and cross-link to the species; they are read-only because changing a
tone safely requires a full M4A waveform/voice ownership writer. The Pokédex
audition is deliberately labelled as a parameter cue, not native M4A playback.

The pinned Emerald profile exposes the exact `gSongTable` symbol and 610 native
eight-byte song records. Sound Editor lists those entries, resolves the song
header and bounded track roots, and labels the result **Partial**. Its isolated
GBA driver uses the exact command values and widths from `MPlayDef.s`, including
wait/note durations, pointers and control operands. It does not yet execute
running status, voices, branches, loop/call paths or mixer behavior, so playback
and writes remain disabled. Unsupported bytes stay visible as raw commands
rather than receiving invented semantics. Non-pinned GBA profiles do not scan
for a lookalike table.
