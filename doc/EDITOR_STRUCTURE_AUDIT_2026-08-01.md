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

### Canonical markup contract

The screen architecture is now expressed directly in every editor fragment.
These classes are product API, not editor-local decoration:

| Class | Responsibility |
| --- | --- |
| `.editor-shell` | Root of every workspace and the common responsive scope. |
| `.editor-shell__library` | Compact search/selection strip; it never owns the page scroll. |
| `.editor-shell__stage` | Remaining editor document after the library. |
| `.editor-shell__stage--document` | Header, main view, bounded panel rail and optional status in one predictable grid. |
| `.editor-shell__header` | One compact identity row for the selected resource. |
| `.editor-shell__main` | Primary editable/visual surface and minimum 50% allocation target. |
| `.editor-shell__panels` | Persistent attributes and references with local scrolling. |
| `.editor-shell__status` | Thin non-interactive status footer; hidden when empty. |

The class vocabulary is paired with a semantic data contract:

| Attribute | Responsibility |
| --- | --- |
| `data-editor-layout="surface"` | One dominant canvas/document without a persistent panel rail. |
| `data-editor-layout="document"` | Main view followed by bounded, full-width supporting panels. |
| `data-editor-layout="split"` | Main view and side panels sharing the assigned width. |
| `data-editor-layout="stack"` | Main view above a full-width persistent panel rail. |
| `data-editor-frame` | The element whose direct regions are composed by the shared contract. |
| `data-editor-region="main"` | The measurable, dominant editing surface. |
| `data-editor-region="panels"` | The persistent supporting region; omitted when the editor has none. |

Move, Pokédex, Sound and Encounters no longer define parallel copies of the
library, field, stage, header or panel geometry. Items and Code reuse the same
library and main-view vocabulary while retaining only their intrinsic domain
grid. Map, Sprite, Battle, Animation, Hex and Profile use the same semantic
regions even where their specialized canvas or split layout needs a different
composition. Docked window headers are neutral product chrome; blue title bars
remain reserved for truly floating contextual windows.

An editor stylesheet may size its native canvas, waveform, byte grid or code
surface. It must not redefine the shell, common fields, docked window chrome,
panel gaps, radii, or breakpoint behavior. Tests assert semantic roles rather
than exact class-string ordering so shared components can evolve without
encouraging copied markup.

## Editor-by-editor mapping

| Editor | Main view | Persistent panels | Structural result |
| --- | --- | --- | --- |
| Hex | ROM byte/text grid | None; status is a footer | Grid fills remaining height; byte/text scrolling remains local. |
| Code | Source and ROM/disassembled program | Navigation library | Source and decoded output remain visible together at normal desktop widths. |
| Map | Connected map canvas | Tabbed map/bank/history panels | Reference implementation: full canvas plus bounded side panel and floating tools. |
| Sprite | Pixel canvas and state dock | Live result, palette, properties | Canvas remains beside a vertically scrollable inspector; state controls stay attached to the canvas bottom. |
| Battle | Trainer/Pokémon native scenes | Opponent, Team and Engine tabs; timeline | Native scenes dominate the upper row; one full-width tab panel sits directly below without duplicate headings. |
| Pokédex | Species sprite and entry | Details, evolution, moves, habitat | Species view fills the main row; related records are bounded panels rather than a page-long dashboard. |
| Moves | Native battle animation | Move attributes and used-by references | Playback remains the focus and references scroll independently. |
| Sound | Waveform/channel arrangement | Parameters, references, engine program | Audio is the main view; technical commands stay supporting/advanced. |
| Animation | Preview or visual program | Full-width animation library | Preview/program is one interchangeable main view; the library remains a bounded bottom panel. |
| Encounters | Visual slot collection | Encounter attributes | Slots dominate; method selection is a compact grouped library. |
| Items | Native item preview | Item properties/actions | Preview remains dominant above one full-width property rail. |
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
- Moved Item properties below the native preview so it follows the same
  stage-first composition as every other resource editor.
- Kept Animation Preview/Program above a full-width library instead of turning
  the library into a narrow sidebar.
- Migrated every current editor root and primary region to the canonical
  `.editor-shell` vocabulary, removed duplicated per-editor shell SCSS, and
  placed Sound engine commands inside its bounded supporting panel rail.
- Pokédex, Move and Sound now use the same `UiPanelTabs` component for their
  supporting records. Tabs never replace or shrink the primary view: they only
  switch bounded secondary panels, retain one local scroll owner, expose proper
  tab/tabpanel relationships and support arrow, Home and End navigation.
- Battle no longer caps its main scene with a viewport-height guess. Both native
  canvases use `PixelCanvas.fit`, preserving integer pixel scaling whenever the
  assigned workspace permits it and reacting to editor/fullscreen resizing.
- Removed Battle's legacy three-column medium-width override. `Opponent`,
  `Team` and `Engine` now share one accessible rail; the active panel occupies
  the entire row below it and no internal title is repeated.
- Sprite now exposes Live, Palette and Properties through the same secondary
  tab rail instead of three permanently stacked windows. Animation library
  domains reuse the same horizontal tab material; neither editor owns a
  private navigation style or repeats a tab title inside its panel.
- Gen I intro steps no longer invent semantic narration such as “enters” or
  “hops”. The scene may retain its verified title, while program nodes use
  neutral ROM-derived operations (`Step`, `Delay`, `Translate sprite`,
  `Motion sequence`) and generic `Sprite 1 / Sprite 2` layer names.

## Remaining validation gates

- Desktop validation at 1440×1000 now confirms that exactly one editor is
  visible, every root stays within its assigned 1200×1000 workspace, and all
  document/stack editors keep their main view above their panels. Tablet
  validation at 900×900 confirms the same lifecycle and region contract.
- Add maintained golden screenshots for wide, medium and narrow workspace
  modes with both an unmodified GBC ROM and an unmodified GBA ROM.
- Test keyboard traversal and scroll-to-end for every long panel after content
  localization and browser text zoom.
- Keep the static layout test that rejects editor-specific viewport rules when
  they try to control workspace composition. Intrinsic pixel-art, gesture and
  native-aspect behavior remains locally owned.
