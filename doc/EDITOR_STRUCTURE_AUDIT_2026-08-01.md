# Editor structure audit — 2026-08-01

## Outcome

All editor fragments now share one measurable workspace contract instead of
deciding their layout from unrelated viewport media queries. Each workspace
declares its main editing surface and its persistent panels. The main surface
keeps the majority of the usable area; panel bodies, lists, canvases and code
views own their own scrolling.

The shared `UiEditorWorkspace` class measures the width actually assigned to
the editor after the project rail, fullscreen state and focus changes. It
publishes `wide`, `medium`, and `narrow` modes to the common stylesheet. The
application only becomes one long vertical document in truly narrow mode.

## Common screen architecture

1. **Library** — compact selector/search row; never the visual focus.
2. **Main view** — map, canvas, battle, waveform, program, bytes, code or
   resource preview. It receives at least half of the usable workspace.
3. **Panels** — persistent attributes, references, history or secondary
   resources. Their body is the scroll owner, not the entire editor.
4. **Windows** — temporary contextual inspectors over a main view.
5. **Toolbox** — direct manipulation modes only; it never becomes a header or
   a large content card.

## Editor-by-editor mapping

| Editor | Main view | Persistent panels | Structural result |
| --- | --- | --- | --- |
| Hex | ROM byte/text grid | None; status is a footer | Grid fills remaining height; byte/text scrolling remains local. |
| Code | Source and ROM/disassembled program | Navigation library | Source and decoded output remain visible together at normal desktop widths. |
| Map | Connected map canvas | Tabbed map/bank/history panels | Reference implementation: full canvas plus bounded side panel and floating tools. |
| Sprite | Pixel canvas and state dock | Live result, palette, properties | Canvas remains beside a vertically scrollable inspector; state controls stay attached to the canvas bottom. |
| Battle | Trainer/Pokémon native scenes | Source, party, engine, timeline | Native scenes dominate the upper row; configuration remains a compact lower panel. |
| Pokédex | Species sprite and entry | Details, evolution, moves, habitat | Species view fills the main row; related records are bounded panels rather than a page-long dashboard. |
| Moves | Native battle animation | Move attributes and used-by references | Playback remains the focus and references scroll independently. |
| Sound | Waveform/channel arrangement | Parameters, references, engine program | Audio is the main view; technical commands stay supporting/advanced. |
| Animation | Preview or visual program | Full-width animation library | Preview/program is one interchangeable main view; the library remains a bounded bottom panel. |
| Encounters | Visual slot collection | Encounter attributes | Slots dominate; method selection is a compact grouped library. |
| Items | Native item preview | Item properties/actions | Preview remains beside the inspector until the editor is genuinely narrow. |
| Profile | Capabilities/resources/contracts | Project identity | Uses the same main/panel contract through `UiSplitView`. |

## Defects addressed

- Stopped classifying every nested `.ui-panel` as a workspace panel region.
  Only explicit `data-editor-region="panels"` hosts now participate in the
  editor-level composition contract; nested panels retain their own local
  layout and scrolling.
- Centralized wide, medium and narrow composition in the shared editor
  contract. Editor stylesheets retain only intrinsic ROM/canvas sizing and no
  longer carry competing viewport breakpoints for the same screen.
- Workspace resize events now fire for real assigned-width changes, including
  focus/fullscreen transitions that remain inside the same named mode. Canvas
  and timeline consumers can therefore resize without waiting for a breakpoint.
- Removed the false assumption that a 1000 px browser always means a narrow
  editor. With the permanent rail, this previously stacked Sprite, Pokédex,
  Sound, Battle and Encounters into clipped page-length layouts.
- Restored one explicit scroll owner per panel instead of allowing fixed-height
  workspaces to hide content below the viewport.
- Kept Sprite Canvas visible while its Live/Palette/Properties inspector
  scrolls independently.
- Kept Battle scenes horizontal and dominant in the normal desktop workspace.
- Kept Pokédex, Move, Sound and Encounter main views above bounded two-column
  panel rows.
- Kept Item preview and properties side by side at usable desktop widths.
- Kept Animation Preview/Program above a full-width library instead of turning
  the library into a narrow sidebar.

## Remaining validation gates

- Add maintained golden screenshots for wide, medium and narrow workspace
  modes with both an unmodified GBC ROM and an unmodified GBA ROM.
- Test keyboard traversal and scroll-to-end for every long panel after content
  localization and browser text zoom.
- Keep the static layout test that rejects editor-specific viewport rules when
  they try to control workspace composition. Intrinsic pixel-art, gesture and
  native-aspect behavior remains locally owned.
