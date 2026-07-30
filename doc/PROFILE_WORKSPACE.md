# Profile & Resources workspace

Profile & Resources is the shared, read-only project identity surface. It
explains which ROM is loaded, which engine profile was selected, where its
source evidence came from, and which editor capabilities are actually
available.

The overview calculates its percentages from the live capability manifest; no
progress value is hard-coded:

- **Available**: ordinary workspaces divided by all registered workspaces;
- **Writable**: workspaces with at least one authorized write path divided by
  all registered workspaces;
- **Exact resources**: exact manifest resource groups divided by the union of
  required and optional resources declared for the active family.

These values are evidence coverage, not an estimate of total game completion.
They recalculate whenever the workspace activates and when profile/resource
events change. Each capability also reports the percentage of its required
resource groups present, and each resource reports the percentage of its
declared roots resolved.

It deliberately contains no Gen I, Gen II, or GBA offsets and does not decode
family data. It consumes only `MemoryProfile`, `CapabilityManifest`,
`ProjectManifestRegistry`, and the source/resource dictionaries supplied by
the active family.

## Views

### Capabilities

Shows every registered workspace independently:

- `Verified`, `Partial`, `Research`, or `Unavailable`;
- read-only versus writable;
- exact resources available to that editor;
- required resources still missing;
- the evidence boundary in Nerd mode.

An imported symbol manifest can therefore identify a resource without
silently inheriting a stock operation audit or write permission.

### Resources

Shows complete resource groups promoted by the active exact manifest:

- semantic resource ID;
- declared coverage;
- number of source roots;
- editors that require or optionally consume it;
- exact root symbols in Nerd mode.

The current schema describes roots and coverage. Counts, extents, pointer
kinds, ownership, relocatability, and structural signatures remain future
manifest fields.

### Symbols

Shows the exact source labels registered for the loaded whole-ROM fingerprint.
Simple mode exposes symbol and resource identity. Nerd mode also exposes ROM
offset, bank, address, and source format. The table is sortable and can be
filtered by name, resource, or address.

## Project-manifest management

When the active manifest was imported for this exact ROM:

- **Export manifest** downloads the validated JSON dictionary;
- **Remove project manifest** deletes only the browser-stored dictionary and
  reloads the same ROM;
- unsaved ROM changes must be resolved before removal;
- capabilities that depended on those project symbols close safely after
  reload.

Bundled reference manifests cannot be removed or shadowed from this workspace.
Selecting a base engine without an exact manifest does not fabricate symbols.

## Family boundary

`js/profile/editor.js` is shared UI and may depend on:

- `MemoryProfile`;
- `CapabilityManifest`;
- `ProjectManifestRegistry`;
- common UI, dialog, notification, and lifecycle services.

It must not depend on:

- `GbaMemory` or GB/GBC memory structures;
- source symbols such as `gMapGroups` or `MapGroupPointers`;
- family codecs, writers, offsets, opcodes, or table layouts.

The automated profile-workspace contract checks that boundary.

## Current limitations

- It does not infer counts, extents, pointer kinds, ownership, or signatures.
- It does not run compatibility audits for a ROM hack.
- It does not promote project-manifest resources to writable operations.
- Browser/device and accessibility validation remain pending.
- Bundled manifests are not downloadable from this view because the committed
  manifest files already provide their canonical export.

These limits keep the workspace honest: it presents identity and evidence but
does not claim that exact labels alone prove safe semantic writes.
