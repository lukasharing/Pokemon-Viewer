# ROM hacks and project source manifests

PUSH never assumes that a ROM hack preserves stock table addresses. Choosing a
base game selects only the CPU/runtime and family codecs. Semantic editors stay
Research until the hack supplies its own exact source dictionary and a
workspace operation is audited.

## Current workflow

1. Build the hack from its clean source checkout.
2. Compute the complete SHA-1 of that exact output ROM.
3. Load that exact ROM in PUSH and choose **File → Import source symbols
   (.sym/.map)…**.
4. Supply the clean source repository, complete Git commit, and build name.
5. PUSH parses only ROM labels for the selected family, checks every offset
   against the loaded ROM, and compares the labels with the engine's known
   resource groups.
6. Review which resource groups are complete and which remain unavailable,
   then import and reload.

For CI or reproducible build pipelines, the equivalent JSON artifact can be
generated ahead of time:

   ```bash
   npm run manifest:pret -- \
     --repo /path/to/hack/source \
     --symbols /path/to/hack/build.sym \
     --config /path/to/hack-profile.json \
     --output /path/to/hack-manifest.json
   ```

7. Add `engineProfile` to the output when its semantic profile name differs
   from the selected base engine.
8. In any editor, choose **File → Import ROM source manifest (JSON)…**.
9. PUSH validates the artifact, stores it under the exact fingerprint, and
   reloads the same local ROM.

The ROM and source files never leave the browser.

## Required JSON contract

```json
{
  "schemaVersion": 1,
  "profile": "my-emerald-hack",
  "engineProfile": "gen3-emerald-en",
  "fingerprint": "40-character-complete-rom-sha1",
  "platform": "gba",
  "source": {
    "repository": "owner/my-emerald-hack",
    "commit": "40-character-source-commit",
    "build": "my-emerald.gba"
  },
  "symbols": {
    "gMapGroups": {
      "offset": 123456,
      "address": 134341184,
      "format": "gnu"
    }
  },
  "resources": {
    "maps": {
      "coverage": "table-root",
      "symbols": ["gMapGroups"],
      "notes": null
    }
  }
}
```

Validation rejects:

- a fingerprint different from the loaded ROM;
- a different selected engine or platform;
- incomplete source provenance;
- malformed or out-of-ROM offsets;
- empty resources for generated source-build manifests;
- resources that reference symbols not selected by the manifest;
- unsupported schema versions.

Persisted manifests are revalidated before use. Bundled exact-reference
manifests take precedence and cannot be shadowed through local project data.

## Capability consequences

An imported manifest provides exact symbol and resource identity to
`MemoryProfile`:

- `memoryProfile.exact === true`;
- `memoryProfile.manifestOrigin === "project"`;
- named symbols can be inspected;
- `memoryProfile.verified === false` until a bundled/audited reference proves
  the operation.

Importing symbols alone does **not** make an editor writable. Layout
compatibility, counts, extents, pointer types, ownership and writer round trips
must still be proven per workspace. This prevents an Emerald-derived hack from
silently receiving Emerald stock offsets or write guarantees.

## Manual exceptions

When a build has no usable `.sym` or linker `.map`, choose **File → Set manual
ROM symbol…**. This records one known semantic root against the complete SHA-1
of the loaded ROM. A declaration can include the ROM offset, CPU address or
bank, a bounded byte extent, count/stride, pointer encoding, ownership, its
data kind, and human review notes.

Manual declarations are never treated as generic family offsets and are never
copied to another ROM. **Profile & resources** marks their origin as `Manual`.
A resource group remains incomplete until every root expected by the selected
engine template has been declared. Even a complete manual group remains
Research/read-only: it cannot inherit a stock operation audit or authorize a
writer.

This is the supported escape hatch for the small number of structures that
cannot be discovered safely. Prefer a generated source dictionary whenever
one exists.

## Reviewed engine knowledge

Some facts cannot be rediscovered from a relocated address alone. PUSH keeps
these reviewed facts in `ManualKnowledgeRegistry`: table count and stride,
pointer encoding, fixed binary structures, field byte positions/types,
terminators, native method constants, ownership, expected resource groups,
and the source evidence used to review them. This registry is generated from the same profile
configuration as the exact manifests, but it is deliberately offset-free and
fingerprint-free.

For a ROM hack, the selected base engine may supply that structural contract.
The exact address must still come from the hack's `.sym`/`.map` output or a
manual declaration bound to the loaded whole-ROM SHA-1. Import combines the
two layers and rejects a source extent that conflicts with the reviewed
contract. It never copies the stock game's address.

Reviewed knowledge is interpretation evidence, not compatibility evidence. A
hack symbol remains project-origin, Partial, read-only, and excluded from the
verified modification percentage until a workspace-specific audit proves the
layout and writer against that exact ROM.

Generation III encounters demonstrate the intended workflow. An
Emerald-derived hack may reuse the reviewed `WildPokemonHeader`,
`WildPokemonInfo`, `WildPokemon` and native method contracts after selecting
the Emerald engine, but it must import or manually declare its own
`gWildMonHeaders`. The parser rejects missing or malformed structure
contracts. The writer remains unavailable for that hack until a compatible
operation audit explicitly promotes it.

## Remaining work

- Profile & Resources now inspects identity, per-editor capability evidence,
  exact resource groups and source symbols, and can export/remove browser
  project manifests without touching bundled references.
- Derive resource counts, extents, pointer kinds, signatures and ownership.
- Run compatible per-workspace validators against the loaded bytes.
- Promote independently validated resources to read-only Partial.
- Promote individual write operations only after compare-before-write,
  Undo/Redo, export/reopen and emulator evidence.
