# Encounter Editor

The Encounter Editor is a shared semantic workspace with isolated production
drivers for exact English Pokémon Red, Blue and Crystal Rev 0. Other games
remain hidden until their own table manifests and codecs exist.

## Exact Red and Blue coverage

The pinned `pret/pokered` manifests bind `WildDataPointers`,
`WildMonEncounterSlotChances`, `ItemUseOldRod`, `GoodRodMons`,
`SuperRodData`, `Route12DefaultScript` and `Route16DefaultScript`. All 248
wild-data pointers are resolved in their native bank; zero-rate land/water
sections stay hidden. Together with fishing and static battles, the resulting
inventory contains 107 documents and 706 fixed slots in both exact Red and
exact Blue: 58 grass/water documents, 35 fishing documents and 14 static
battles.

Each non-empty section stores one rate byte followed by ten
`level,internal-species` pairs. The probability table is verified against the
engine's cumulative thresholds and byte offsets before any document is
accepted. The exact weights are `51/51/39/25/25/25/13/13/11/3` out of 256.
Rates, levels and internal Species IDs are editable with compare-before-write
Undo/Redo. Slot count, weights and native record width are not changed.

Fishing preserves the three distinct native representations. Old Rod is the
verified fixed `MAGIKARP`/level-5 machine-code payload in `ItemUseOldRod`.
Good Rod is the exact two-entry `GoodRodMons` table. Super Rod follows all 33
map associations in `SuperRodData` and their ten shared one-to-four-slot
groups. The editor reports the engine's 50% Good/Super bite chance and uniform
conditional slot selection; Old Rod is guaranteed after tile validation.
Species and levels are reversible for all three rods. Super Rod group sharing
and every owner map are disclosed before a write. Old/Good Rod eligibility is
runtime/tile driven and is not falsely assigned to individual maps.

Static battles include the 12 typed map object records whose native
`trainerClass`/`trainerNumber` operands carry Species/level, plus both Snorlax
machine-code payloads in the Route 12 and Route 16 scripts. This covers the
Power Plant objects, Zapdos, Mewtwo, Articuno, Moltres and both Snorlax.
Signature checks verify the script opcodes and operand positions before
exposing a write. The editor changes only the existing Species and level
bytes; event flags and surrounding control flow remain untouched.

Some maps point to the same wild-data record, notably shared sea routes.
Ownership is resolved through all 248 pointers, displayed before editing and
linked to every owner map. Editing one such record intentionally changes every
owner; the UI warns about that shared effect. The canonical Species graph
resolves normal IDs and reports MissingNo. IDs as explicit unresolved
references rather than inventing a Pokédex identity.

## Exact Crystal coverage

The generated `pret/pokecrystal` manifest binds `JohtoGrassWildMons`,
`JohtoWaterWildMons`, `KantoGrassWildMons`, `KantoWaterWildMons`,
`FishGroups`, `TimeFishGroups`, `TreeMons`, `TreeMonMaps`, `RockMonMaps`,
`ContestMons`, `InitRoamMons`, `RoamMaps` and 17 verified script/map symbol
pairs. Together these expose 224 documents and 2,486 displayed slots:
153 grass/water records, 39 rod documents, 12 common/rare Headbutt documents,
one Rock Smash document, the Bug-Catching Contest and a two-slot roamer
initialization document, plus 17 direct `loadwildmon` encounters.

Grass records are 47 bytes: map group/id, three native encounter rates, and
seven level/species pairs for each of morning, day, and night. Water records
are 9 bytes: map group/id, one native rate, and three pairs. The editor shows
the engine probabilities exactly: `30/30/20/10/5/4/1%` for grass and
`60/30/10%` for water.

Fishing follows the native seven-byte group header (bite rate plus three
same-bank list pointers), three-byte cumulative-threshold records and all 22
day/night `TimeFishGroups` pairs. Direct fishing records are intentionally
shown in both periods because the underlying species/level bytes are shared.
The model validates monotonically increasing thresholds ending at 100%.

Headbutt follows the native pointer table and six weighted slots in each
common/rare list. It preserves the engine's tree-score encounter chances
(10%, 50% or 80%) as read-only context. Rock Smash uses its separate weighted
list and 40% pre-selection chance. The Contest exposes all ten weighted
species plus editable minimum/maximum levels; its 20%/40% tile-dependent
encounter rate remains engine-owned.

The roamer document verifies the `InitRoamMons` instruction layout before
exposing Raikou/Entei species, their shared level and starting maps. It also
decodes the complete 16-map `RoamMaps` network. These ROM settings are
editable; current location, HP and DVs are explicitly identified as save/WRAM
state and are never fabricated from the ROM.

The static inventory covers every direct constant `loadwildmon` command found
in the pinned source build, including Red Gyarados, Celebi, Snorlax,
Sudowoodo, Ho-Oh, Lugia, Suicune, Lapras, the three Electrodes, trap Pokémon
and tutorial Rattata battles. Each entry is accepted only when its manifest
script symbol, relative command offset and `$5d` opcode all match. It links to
its exact map and script. Species and level are editable; surrounding flags,
battle type, disappearance logic and control flow remain byte-identical.

## Editing

Encounter editing is now part of the Map Editor's right-hand tabbed context
column and is the canonical everyday workflow.
Changing maps immediately filters the panel to definitions that actually own
that Gen I map ID or Crystal group/map pair. Method/table, time period, native
rate, weighted slots, Pokémon links and Edit actions stay beside the rendered
map. Shared definitions disclose their owner count. Gen I's global Old/Good
Rod definitions appear on every map because the ROM does not store per-map
ownership for those tables.

Methods are never hidden behind one selector. The Map tab and internal global
browser group the available records into visible method sections
(grass, water, fishing, rock smash, headbutt, static and family-specific
methods). Every record is a subtable with its own period selector when the
engine actually provides time variants. This shared presentation consumes the
same semantic documents for GBA, Gen I and Gen II while each family continues
to decode and write through its isolated driver.

Edits made from Map use the Map Editor's project-command scope, so they appear
in Map history and obey the same conflict-safe global Undo/Redo ordering. The
global Encounter workspace remains available to advanced semantic deep links
for browsing all tables, raw data and code links, but it is no longer a primary
navigation destination. Both surfaces consume the same family driver rather
than duplicating offsets or decoding rules.

Editing changes one existing level/species pair and the active period's native
rate. Fishing preserves its opposite byte order (`species, level`) and writes
time-group pairs at their real owner. Its bite rate is shared across all three
rods and maps in the group; direct records are shared across day/night. The UI
discloses both effects. Every operation uses one atomic compare-before-write
command and participates in project Undo/Redo. It cannot change slot count,
probability brackets, map ownership or native record width.

“Open map” navigates to an owning map in any supported driver; shared groups
present an owner-map chooser. A Pokémon name opens its exact
Species document in Pokédex Editor. “Open data” navigates to the fixed record
in Hex Editor. The exact Red/Blue graph contains 4,398 nodes and 10,359
resolved edges; the Crystal graph contains 7,780 nodes and 23,018 resolved
edges.

## Still missing

This is not the complete Crystal encounter engine. Variable/state-derived
script encounters, runtime swarm selection, Repel, radio modifiers and probability
simulation remain separate providers. Source audit confirms Crystal has no
`loadvarmon`: `randomwildmon` consumes an already-selected encounter context,
while `loadwildmon` carries two constant operands. Red/Blue still need exact
Old/Good Rod map-eligibility presentation, Repel/runtime scenarios,
remaining state- or machine-code-derived battle contexts and simulation.
Gold/Silver and Generation III need isolated drivers rather than reusing
Crystal or Red/Blue offsets.
