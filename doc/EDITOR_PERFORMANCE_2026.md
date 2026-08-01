# Editor performance audit · 2026-08-01

## Rule

Opening a workspace must paint its primary editing surface before building
cross-ROM indexes or decoding related resources. A selection change owns a
revision: work started for an older selection is cancelled and may not update
the DOM.

`EditorRenderPipeline` is the shared implementation. It uses
`ProjectScheduler.afterPaint()` for the first useful secondary phase and
`ProjectScheduler.idle()` for catalogs and reverse references. Loading uses the
shared `UiLoading` material. Family parsers remain separate; the scheduler and
loading presentation are family-neutral.

## Audit

| Workspace | Previous blocking work | Current boundary | Remaining work |
| --- | --- | --- | --- |
| Hex | One bounded visible page | Already bounded | Add browser latency budget |
| Code | One requested disassembly/source document | CodeMirror viewport is bounded | Move unusually large graph layout to a worker |
| Map | Connected scene and overlays | Viewport-plus-overscan rendering already exists | Profile worst connected worlds and cache decoded blocks by revision |
| Sprite | Active catalog and selected graphic | Only selected resource is decoded | Virtualize exceptionally large custom catalogs |
| Battle | Full trainer enumeration | Shared lazy trainer repository and background index worker | Measure native background/sprite first composition |
| Pokédex | Graph, cry, evolution family, machines, learnset, icon and footprint in the opening frame | Main entry and battle sprite first; accessories, cry, evolutions and moves are cancellable phases | Worker-backed family progression index |
| Moves | Whole resource graph and every `Used by` preview before first interaction | Fixed record first; animation and references are cancellable phases; GBA references scan in idle chunks and cache per move | Move Gen I/II graph construction to the project worker |
| Sound | Selected native decoder ran in `select()` | Catalog shell first; selected waveform/arrangement decodes after paint | Make large song-channel decode worker-backed |
| Animation | Every animation program decoded before the editor existed | Shell first; entry providers decode in cancellable chunks | Add persistent per-program byte-range cache and worker-safe decoders |
| Encounters | Complete encounter directory | Eager directory remains acceptable for reviewed stock profiles | Share one lazy encounter repository with the Map panel |
| Items | Lightweight fixed catalog, selected icon only | Already selection-scoped | Add a virtual selector for large hack manifests |
| Emulator | Core boot | Separate runtime and frame scheduler | Keep editor indexes off the emulation/audio clock |

## Budgets to automate

- Primary editor shell visible in one paint after its required scripts load.
- No resource-graph build in an editor constructor.
- No stale selection may replace current content.
- Long catalogs yield at least every 6–32 records depending on decoder cost.
- Map work remains bounded to viewport plus overscan.
- Local diagnostics record phase duration without uploading ROM data.

Browser E2E timing thresholds and long-session memory budgets remain open; the
application currently has unit/static validation but no cross-browser
performance gate.
