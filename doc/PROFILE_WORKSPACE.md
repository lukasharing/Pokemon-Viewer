# Profile & Resources workspace

Profile & Resources is the shared, read-only project identity surface. It
explains which ROM is loaded, which engine profile was selected, where its
source evidence came from, and which editor capabilities are actually
available.

The overview calculates its percentages from the live resource graph and the
actual byte length of the loaded ROM; no progress value is hard-coded:

- **ROM safely editable**: unique verified semantic write ranges divided by
  the complete ROM size;
- **ROM understood**: unique verified resource and reference ranges divided by
  the complete ROM size;
- **Writable resources**: verified graph nodes with a proven write range or
  writable outgoing reference divided by all verified graph nodes;
- **Writable systems**: workspaces with at least one authorized write path
  divided by all registered workspaces.

Raw Hex editing is deliberately excluded from semantic write coverage:
otherwise every ROM would misleadingly report 100%. Overlapping aliases,
pointers, and shared records are unioned before bytes are counted.

The write percentage is a conservative lower bound. A node contributes
explicit `writeRanges` only when a verified writer exists. A verified edge
contributes its source bytes only when its policy is `in-place`,
`rewrite-id`, `rewrite-pointer`, or `repoint`. Read-only previews, `manual`
references, heuristics, and unknown bytes contribute nothing.

Some extents cannot be inferred safely from symbols. Family drivers may
declare those ranges manually, but each declaration must be contained by an
already verified resource range and backed by a real writer and round-trip
evidence. This retains necessary engine knowledge without putting stock
offsets in shared UI.

Values recalculate whenever the workspace activates and whenever the active
resource graph changes. Opening another semantic editor can increase coverage
because that editor adds its verified family graph. Each capability still
reports required-resource coverage, and each manifest resource still reports
the percentage of its source roots resolved.

The prominent percentage answers one precise question: **what percentage of
the actual loaded ROM bytes can PUSH currently modify through verified
semantic writers?** It is not a project-completion score. An unopened provider
may make the conservative value rise later, while a merely detected table,
read-only preview, or raw byte editor cannot.

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

Exact manifests may describe roots, extents, counts, strides, pointer kinds,
ownership, and coverage. Reviewed engine contracts expose the structural facts
without addresses. Relocatability and complete structural signatures remain
incomplete.

### Engine rules

Shows the manual, reviewed knowledge that cannot be derived reliably from an
arbitrary ROM byte stream:

- fixed structure sizes and named fields;
- table counts, strides and extents;
- pointer and ownership schemas;
- resource-group membership and required roots;
- native invariants documented by the selected `pret` review.

This view deliberately contains no addresses. Its **Authority** column makes
the boundary explicit: a rule may describe a layout, shape, or membership,
but it cannot identify the loaded ROM or authorize a writer. Nerd mode expands
the exact field/root names and evidence notes. The corresponding ROM addresses
remain independently visible under **Symbols** only when the complete
fingerprint has a bundled, imported, or manually declared dictionary.

### Symbols

Shows the exact source labels registered for the loaded whole-ROM fingerprint.
Simple mode exposes symbol and resource identity. Nerd mode also exposes ROM
offset, extent, count, stride, pointer kind, ownership, bank, address, and
source format. The table is sortable and can be filtered by name, resource, or
address.

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

- Coverage includes only domains currently loaded into the live graph. It is
  not a claim that unmodeled bytes are safe to edit.
- Existing providers still need explicit write ranges for every fixed-field
  writer, so the percentage intentionally under-reports support.
- It does not infer all counts, extents, pointer kinds, ownership, or
  signatures.
- A reviewed manual engine contract can fill declared schema facts, but never
  an exact address or a write audit.
- It does not run compatibility audits for a ROM hack.
- It does not promote project-manifest resources to writable operations.
- Browser/device and accessibility validation remain pending.
- Bundled manifests are not downloadable from this view because the committed
  manifest files already provide their canonical export.

These limits keep the workspace honest: it presents identity and evidence but
does not claim that exact labels alone prove safe semantic writes.
