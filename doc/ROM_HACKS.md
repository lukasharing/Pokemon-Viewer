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
- empty resources;
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

## Remaining work

- Add a Profile/Symbols workspace to inspect and remove project manifests.
- Derive resource counts, extents, pointer kinds, signatures and ownership.
- Run compatible per-workspace validators against the loaded bytes.
- Promote independently validated resources to read-only Partial.
- Promote individual write operations only after compare-before-write,
  Undo/Redo, export/reopen and emulator evidence.
