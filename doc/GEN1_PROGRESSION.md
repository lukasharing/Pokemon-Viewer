# Generation I moves, evolutions and level-up learnsets

Exact international Pokémon Red/Blue profiles expose this domain through
`PokemonViewer.gen1.Gen1MoveData` and `Gen1ProgressionData`.

## Verified source model

The implementation follows the pinned `pret/pokered` structures:

- `Moves`: 165 fixed six-byte battle records;
- `MoveNames`: 165 fixed encoded names;
- `EvosMovesPointerTable`: one near pointer for each of 190 internal species
  slots;
- `HealEffect_`: verified exclusive end of the final progression record.

Each progression record contains zero or more native evolution entries,
followed by a zero terminator, then `(level, move)` pairs and another zero
terminator. The supported methods are exactly:

- level: method, minimum level, target species;
- item: method, item, minimum level, target species;
- trade: method, minimum level, target species.

Every pointer, terminator, method, level, move ID and target species is bounded
and validated. Exact audits of both games prove 165 moves, 72 canonical
evolutions and 728 canonical level-up entries. Pokédex displays the named data,
and the resource graph connects Species → Evolution/Learnset → Species/Move.

## Editing boundary

This slice is deliberately read-only. Replacing a move ID in an existing pair
would be mechanically small, but a complete editor must treat evolution and
learnset changes as one variable-length owned record. Adding/removing entries
requires:

- complete occupied/free-range ownership;
- same-bank allocation;
- all inbound pointer owners;
- atomic relocation and exact undo;
- domain validation and emulator scenarios.

Until `MUT-004`, `MUT-005` and `MUT-007` satisfy those requirements, PUSH must
not advertise progression resizing as safe.
