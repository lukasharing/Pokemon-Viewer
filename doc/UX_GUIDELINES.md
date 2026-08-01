# Editor UX and style rules

These rules apply whenever an editor, panel, window, toolbar, dialog, or empty
state is created or changed.

## The interface must explain itself

Hierarchy, placement, icons, labels, selection state, and immediate feedback
must make the next action obvious. Do not add paragraphs to compensate for an
unclear layout.

- Use the shortest unambiguous label.
- Put help in a tooltip or guide, not permanently in the workspace.
- Do not repeat the editor name, selected object, or visible control in prose.
- Do not add “setup”, “preview”, “choose”, or instructional hero sections when
  the actual control can occupy that space.

## Start in a useful state

- Select the first valid record when there is no meaningful reason to remain
  empty.
- Preserve a semantic link passed from another editor.
- Hide unavailable actions. Do not leave disabled decorative controls visible.
- Use a short empty row only when the source genuinely contains no records.
- Never render invented data or placeholder graphics as if they were real.

## Reuse the product language

- Use the existing `UiPanel`, `UiToolbar`, `UiWindow`, toolbox, tabs,
  properties, and dialog primitives.
- `editor-view` is the object being edited. It is the dominant surface and
  owns the remaining workspace.
- `editor-attributes` contains the current selection's key/value state. It is
  never the visual centre of an editor.
- `editor-actions` contains commands that change, open, save or apply the
  current object. An action strip fills its parent axis and may reflow.
- `editor-context-header` is the fixed-height resource selector directly below
  the editor menu. Search, group, resource and compact actions stay in one
  horizontal row. It is visually quieter than the menu and never wraps: on a
  narrow viewport the header scrolls horizontally so the primary surface does
  not jump or lose height. Do not rebuild this row with editor-local grids.
- A toolbox contains direct-manipulation modes and view controls: select,
  pan, paint, pick, grid, zoom, undo and redo. It belongs on or beside the
  surface it controls, never in an editor title header.
- Prefer one toolbox per visual surface. Its default placement is centred on
  the bottom edge; a narrow vertical surface may use a vertically centred left
  edge. When commands require categories, keep one toolbox and separate its
  groups instead of scattering several floating bars around the canvas.
- A tool with multiple native states shows a small corner disclosure marker.
  Activating the selected tool opens a shared `UiToolFlyout` beside it (or on
  the opposite side when the viewport edge is near). The current state remains
  the primary tool; alternate states do not permanently consume canvas space.
- `UiPanel` contains persistent navigation, attributes or supporting data. A
  panel fills 100% of its parent's cross-axis; it is not a floating card.
- Several panels on one edge use `ui-panel-stack`. Intrinsic panels retain
  their header and natural height, one `ui-panel--fill` receives the remaining
  space, and bounded inspectors scroll inside their own body. Never scroll the
  complete stack as one undifferentiated column: a long Maps list must not
  cover or visually merge with Encounters, History or Properties.
- When several large contextual datasets compete for the same edge, use
  `UiPanelTabs`: only the selected panel owns the bounded scroll region. A map
  sidebar, for example, exposes Maps, Details, Encounters and History as tabs
  rather than four compressed panels.
- Pokédex, Move and Sound are the reference for document-style editors: their
  main visual remains continuously visible while `UiPanelTabs` switches only
  the supporting attributes, relationships and engine data below it. Tabs must
  have short domain labels, keyboard navigation and one scrollable tabpanel;
  they must never be used to hide the editor's primary canvas or waveform.
- A tab label is the only heading for its active panel. Do not repeat the same
  title in a nested window header. Sprite uses the same tab material for Live,
  Palette and Properties, while Animation reuses it horizontally for library
  domains; category tabs must not invent a vertical navigation style.
- `UiWindow` contains contextual detail that can be closed or moved. Do not
  turn every fixed panel into a titled window.
- A closable `UiWindow` has exactly one close action: its header control.
  Content and footers must not repeat Close/Cerrar. `UiWindow` enforces this
  invariant for both generated and pre-existing window markup. A footer close
  action is allowed only when the header close control is disabled.
- A dialog is reserved for a decision or bounded edit.
- Do not introduce a new card or toolbar pattern when an existing primitive
  already expresses the interaction.

### Editor layout contract

- Every editor root declares exactly one `data-editor-layout`: `surface` for a
  single native canvas, `document` for a visual main view with supporting
  panels below, `split` for a dominant view plus a side rail, or `stack` for a
  dominant view plus a full-width bottom rail.
- Every editor declares one `data-editor-frame`. Inside it,
  `data-editor-region="main"` identifies the primary surface and
  `data-editor-region="panels"` identifies persistent supporting content.
  Headers and context selectors are chrome, not panel regions.
- `UiEditorWorkspace` is the only component allowed to turn those semantic
  declarations into wide, medium, narrow, fullscreen, and focus layouts.
  Editor-local styles may arrange content inside a region but must not compete
  with the workspace composition.
- Workspace visibility is runtime state. Shared layout classes must never
  override `.hide` or make an inactive editor participate in page layout.
- The primary surface receives at least half of the assigned workspace. Split
  proportions may shrink without fixed panel minimums; if the workspace is too
  narrow, the shared contract stacks the regions instead of overflowing.

### Accordion

Use `UiAccordion` for expandable navigation groups and disclosures. Its whole
header is a keyboard-accessible button, exposes `aria-expanded`, hides its
labelled region semantically, and can be composed as an exclusive group.
Never reproduce it with a fixed-height container, a clickable `div`, or a
CSS-only chevron. Long bodies own their scroll region; opening an item may
reveal the active child without stretching the complete editor panel.

### Layer contract

Editor layers use shared tokens; editor-local numeric `z-index` values are not
allowed:

1. panels and the primary surface form the document layer;
2. contextual windows sit above panels;
3. toolboxes sit above windows so manipulation never becomes unreachable;
4. context menus, dialogs and notifications are product overlays above the
   editor layer.

In short: **panel < window < toolbox < product overlay**. A docked
`UiWindow` participates in the panel layer. A floating `UiWindow` participates
in the window layer.

### Context changes

An editor must update its complete composition when its document mode changes.
It is not enough to swap the canvas.

- Hide panels, windows and toolboxes that do not apply to the new mode.
- Preserve their state so returning restores the previous document.
- Replace attributes with attributes for the new document type.
- Do not leave map block windows, map history or encounter panels visible in
  Minimap mode.
- Do not keep controls visible merely because the family-specific driver does
  not use them.

### Component-first policy

All editors belong to one product and must look and behave as parts of the
same material system. A new editor is a composition of shared components, not
an opportunity to create a new visual language.

Before writing markup or CSS:

1. Check the shared components and a maintained editor with the same
   interaction.
2. Reuse or extend the closest shared component.
3. If the behavior will occur in two editors, implement it as a shared
   component immediately.
4. Create an editor-local element only when its behavior is genuinely unique
   to that game domain.

The shared component owns its complete visual contract: spacing, typography,
border, radius, focus, hover, selected, disabled, loading, empty and error
states. Editors provide content, capabilities, orientation and size; they do
not restyle the component from scratch.

Preferred shared primitives include:

- editor header and contextual menus;
- `UiToolbar` and toolbox tool groups;
- `UiWindow`, docked panels and contextual inspectors;
- tabs, buttons, icon buttons, fields, selects and checkboxes;
- property/key-value tables and data tables;
- searchable resource lists and selection rows;
- canvas/preview frames, zoom controls and gesture handling;
- dialogs, notifications, tooltips and status feedback;
- history, empty, loading and error presentations.

### CSS ownership and exceptions

- Product tokens and shared component SCSS are the default source of visual
  decisions.
- Editor SCSS may define semantic grid areas and domain-specific intrinsic
  canvas geometry. Shared workspace composition and responsive reflow belong
  to `scss/components/_editor-contract.scss`; editor files must not introduce
  a second viewport-based layout authority.
- Editor SCSS must not redefine shared button, field, window, toolbar, tab,
  table or notification appearance.
- Do not copy a shared selector into multiple editor stylesheets. Move the
  rule into `scss/components/` and expose a modifier or configuration.
- Prefer a documented component modifier over descendant-specific overrides
  and `!important`.
- A local override is acceptable only for a small intrinsic requirement, such
  as pixel-art image rendering, a native aspect ratio, an icon transform, or
  a ROM-defined tile dimension.
- A local override must remain scoped, must not alter the component's general
  interaction states, and must not become a second theme.

If a screen needs several local overrides to look correct, the shared
component contract is missing a capability and should be improved centrally.

### Shared rendering behavior

Equivalent information must be rendered using the same interaction grammar
across editors:

- selected resources use the same selected-row treatment;
- clicking a visual resource selects it before opening its inspector;
- double-click/navigation, context actions and keyboard focus follow the same
  conventions;
- sprites and tiles use the shared pixel-art canvas behavior;
- property groups use the same key/value layouts and complexity rules;
- edit actions open the same dialog pattern and report through the same
  notification/history system;
- unavailable actions are hidden, errors are explicit, and no editor invents
  fallback content;
- GBA, Gen I and Gen II drivers return family-specific data to the same shared
  view contract rather than producing separate interfaces.

Differences should communicate a real domain capability, not the identity of
the developer or the order in which an editor was built.

Resource-heavy editors use the same browsing grammar:

- categories are short tabs, never a prose-heavy dashboard;
- a selected category immediately selects its first valid native resource;
- related states become view tabs inside one document;
- the mounted/live result shows the assembled in-game object, while the canvas
  shows the editable source sheet;
- compact native palettes are direct controls, not dropdown-plus-grid
  duplicates;
- unsupported family resources produce one concise unavailable state and
  notification, never a guessed fallback.

Normal and Nerd experiences have equal editing power. Normal mode hides
offsets, banks, raw widths and pointer terminology; Nerd mode reveals those
facts without replacing the visual workflow. Neither mode may add explanatory
cards that reduce the primary surface below the visual-majority rule.

## Keep the canvas primary

For visual editors, the editable or inspectable result receives the largest
area. Navigation stays compact. Contextual tools sit near the canvas. Detail
windows appear only after selection.

### Visual-majority layout rule

The visual result must occupy at least 50% of the editor's visible workspace
in its default state. This is a floor, not a target: Map, Battle, Sprite,
Animation and other canvas-led editors should normally give it more.

Choose the page axis from the content instead of forcing every editor into a
left-sidebar template:

- If the visual result benefits from width, place it full-width and put
  selection, teams, properties, timelines or engine controls below it.
- If the visual result benefits from height, keep it full-height and place a
  compact inspector beside it.
- A wide panel below the canvas should arrange its own controls horizontally.
- A narrow panel beside the canvas should arrange its controls vertically.
- Toolbars follow the edge they occupy: horizontal above or below a canvas,
  vertical only when docked to a side.
- Reflow the composition when the viewport or focus/full-screen mode changes.
  Do not merely shrink the canvas while preserving desktop panel widths.
- Measure the usable content area after the editor header and footer. Hidden,
  empty, disabled or decorative space does not count toward the visual 50%.

The primary canvas must not be reduced to make room for navigation that can
scroll, collapse, move below it, or open contextually.

Secondary property tools must not duplicate a large browser or compete with
the primary view. Show the single native object at its real structural
granularity and link to the shared browser when a broader choice is needed.
For example, the Generation I map border is one 4 × 4-tile block: its compact
window previews that block and links to Blocks instead of embedding a second
tileset atlas.

Editor-specific defaults:

- Battle: the native battle scene is full-width. Opponent/team/source controls
  form a full-width strip or panel below it. The scene is never the narrow
  right column of a permanent setup sidebar.
- Map: the map owns the centre and majority of both axes. Navigation and
  properties remain narrow docks; contextual details use windows.
- Sprite: source list and properties may flank the canvas only while the
  combined canvas/live composition retains the majority.
- Animation: preview and timeline are the primary stacked composition;
  command/property detail moves beside or below according to available width.
- Encounters: when the editor includes a battle, habitat or distribution
  preview, that visual leads the document and the table becomes its supporting
  workspace. The visualization owns the majority; the table becomes the
  adjacent/below control surface rather than competing equally.
- Pokédex: treat a species as one document, not as a dashboard of equal cards.
  Keep species and sprite-side selection in a compact horizontal library bar;
  make the native sprite and entry the dominant, uninterrupted composition;
  place cry controls in its footer; and keep base data, evolution, machines and
  learnsets in a secondary detail row. Do not dedicate a permanent sidebar to
  two selects or repeat “open/edit” explanations around every action.
- Moves: use a compact search/select bar, then make the semantic battle profile
  and its animation link one dominant composition. Fixed-record properties and
  inbound references are supporting panels below it; never reserve a permanent
  list sidebar or give raw fields the same visual weight as power, type,
  accuracy, PP and animation.
- Sound: the selected arrangement or channel structure is the primary surface.
  Group, search and cue selection form one compact library bar; semantic sound
  properties sit in a supporting attribute panel, references sit beside or
  below them, and decoded commands remain an advanced detail. Playback,
  channel/tick visualization and the native arrangement belong to the primary
  Audio surface. Never make a tall cue list, raw command table or key/value
  list the default centre of the editor.
- Encounters: search and area/method selection belong to one compact library
  bar. The encounter slots are the primary habitat view and use native sprites,
  probability and level as a scannable visual grid; Pokédex, Battle and Edit
  remain contextual slot actions. Map/table metadata belongs in a secondary
  details panel, never in a permanent navigation sidebar.
- Code: navigation, address and patch actions belong to one compact source bar.
  In Nerd mode the editable language source is the dominant pane and ROM
  disassembly is a supporting side pane; in Simple mode the visual logic graph
  owns the workspace. Properties, raw addresses and byte lengths must never
  consume a permanent sidebar.
- Hex: ROM bytes own the workspace and use the available width. Translation is
  a contextual companion pane, not an equal editor or decorative card. View
  toggles and offset/text search belong to one compact toolbar; row addresses
  and column labels stay visually quieter than the editable byte cells.
- Sprite: source/group/view selection is a compact horizontal bar. The editable
  canvas owns the majority of the workspace; mounted live output, palette and
  properties share one contextual inspector. Zoom, grid, pencil, undo and redo
  are a floating canvas toolbox. Never put those controls in the editor header,
  force the canvas between two permanent sidebars, or hide essential source or
  palette controls merely because the viewport is narrow.

Avoid:

- cards nested inside cards;
- thick ornamental borders and excessive shadows;
- repeated section headings;
- badges that restate an active tool;
- large inspector windows opened without a user selection;
- permanent status text that describes obvious controls.

## Progressive complexity

Normal mode shows semantic names and common operations. Nerd mode may add
offsets, pointers, raw records, command streams, and exact encodings. Advanced
information must not compete with the normal workflow.

## Family separation

Shared editors consume semantic documents and capabilities. GBA, Gen I, and
Gen II drivers own their pointers, structures, codecs, palettes, and writers.
The UI adapts to capabilities; it does not branch on binary formats.

This is also a physical code-organization rule:

- binary logic for GBA lives under a `gba/` module;
- binary logic for GB/GBC lives under a `gbc/` module;
- Gen II uses its own `gen2/` module when its format differs from Gen I;
- a shared module may define interfaces, registries, documents and rendering
  composition, but must not contain GBA and GB/GBC offsets, opcodes, tile
  layouts, pointer arithmetic or format branches;
- family runtimes load only their own decoder/driver modules;
- do not create a “universal” codec by placing both implementations behind
  `if (family === ...)` in one file;
- apparent similarity is not proof of an identical binary format.

The same rule applies to visual composition. Native coordinates, screen
dimensions, sprite anchors, HUD text positions, textbox margins, line wrapping
and message templates belong to the family driver. A shared renderer may draw
those semantic fields, but it must never contain checks such as
`layout === "gen3"` or select GBA/GB(C) geometry itself. If two families happen
to use the same number today, each family still declares that number in its
own module so a later correction cannot regress the other engine.

Every change that touches more than one ROM family must therefore be reviewed
as two implementations behind one document contract:

1. validate the GBA structure and renderer against the relevant `pret` GBA
   repository;
2. validate the GB/GBC structure and renderer independently against
   `pokered`/`pokecrystal`;
3. keep only interaction, semantic documents and mechanical canvas drawing
   shared;
4. add a regression test proving that the shared layer contains no family
   switch.

Cross-editor game resources are domain libraries, not editor helpers. Fonts,
sprites, palettes, text windows, gestures and native screen composition must
be reusable by any editor without importing Battle, Map, Pokédex or another
consumer. For example, the native-font registry is shared, while its GBA and
GB/GBC decoders remain physically separate.

## Review checklist

Before considering a visual change complete:

1. Can a new user identify the main object and primary action without prose?
2. Does the editor open on valid content?
3. Are unavailable controls hidden?
4. Is every visible action functional and contextual?
5. Does it reuse an established product primitive?
6. Can any heading, card, border, badge, or sentence be removed?
7. Is technical information absent from Normal mode?
8. Does each ROM family remain isolated below the shared editor contract?
9. Does the visual result occupy at least 50% of the usable workspace?
10. Was the horizontal/vertical composition chosen from the visual content,
    with panels and toolbars re-oriented to match their dock edge?
11. Does the same majority survive narrow, wide, focus and full-screen layouts?
12. Was the existing component inventory checked before adding markup or CSS?
13. Would another editor need this behavior, and if so, is it shared now?
14. Are editor-local styles limited to composition or intrinsic domain
    geometry?
15. Do selection, inspection, editing, loading and error states behave like
    the rest of the product?
16. Is every binary decoder physically located in its family directory, with
    the shared file limited to a format-free contract?
17. Can a reusable game resource be consumed without importing the first
    editor that happened to use it?
18. Does the editor root have zero unintended horizontal overflow at desktop
    and tablet widths?
19. Does every long list have one explicit scroll owner, with headers and
    contextual actions remaining reachable?
20. Can every card grow to fit its content without painting over the following
    row?
21. Does every input, select, range and icon-only action expose an accessible
    name?
22. After scrolling to both ends, resizing, focusing and leaving the editor,
    do panels, windows and toolboxes retain valid bounds?

If removing an element makes the workflow equally understandable, remove it.

## Overflow and scroll contract

- Editor roots clip only the application shell. A child stage, panel body,
  list or canvas viewport must explicitly own scrolling.
- Never use a fixed card height when labels, translated text, accessibility
  zoom or contextual actions can increase content height. Use intrinsic rows,
  `min-height`, and `grid-auto-rows: max-content`.
- A scrolling list uses `align-content: start`; it must not stretch incomplete
  rows to fill the viewport.
- Headers and footers are structural. `UiPanel` uses `ui-panel__header`,
  `ui-panel__body`, and `ui-panel__footer`; `UiWindow` uses its matching shared
  primitives. Actions do not float over scrollable content unless they are a
  true contextual toolbox.
- Ellipsis is allowed only for secondary one-line status. The full value must
  remain available through the selected item, inspector, or accessible name.
- Validation must exercise top, middle and bottom scroll positions, not just
  the initial screenshot.
- Responsive composition is based on the editor's usable width, never only the
  browser width. `UiEditorWorkspace` measures each `.editor_area` and exposes
  `is-editor-wide`, `is-editor-medium`, or `is-editor-narrow`. Editor CSS must
  consume those modes instead of inventing a viewport breakpoint. The
  permanent project rail, focus mode and fullscreen mode therefore produce
  the same geometry from the same actual content width.
- Every editor fragment declares `data-editor-workspace`, exactly one
  `data-editor-region="main"`, and its persistent
  `data-editor-region="panels"` hosts. The main region owns the visual/code/
  audio object; panels own attributes and supporting records. A library is a
  compact selector, not a second main view.
- A responsive grid may never preserve all of its nominal columns by
  collapsing one panel below its usable width. Stack the panels instead.
- A tab rail always spans the complete panel width. Its selected panel starts
  immediately below, fills that width, and hides any internal heading that
  merely repeats the tab label.
- Resource properties belong below the dominant visual when a right inspector
  would reduce that visual below the majority of the editor. Items follows
  this rule; a narrow right column is not a distinct editor pattern.
- At every tested width, the geometry audit must compare `scrollWidth` with
  `clientWidth` for the editor root and its bounded scroll owners. Intentional
  canvas, code and timeline scrolling is local; page-level horizontal overflow
  is always a defect.

## Tables and button scale

- Repeated records use the shared `UiTable` component. Columns declare their
  label, cell renderer and sort value; sortable headers are opt-in and expose
  their current order through `aria-sort`.
- A table must not replace a visual cell with an opaque ID. Pokémon rows, for
  example, pair the ROM-derived miniature with the readable Species name.
- Tables own their vertical scroll region, keep their header visible and fit
  the width of their panel without creating a page-level horizontal scrollbar.
- Buttons use the shared `UiWindow.button` or `UiWindow.iconButton` factories.
  The only standard sizes are `sm` (dense rows/toolboxes), `md` (normal
  actions) and `lg` (single primary calls to action). Icon-only buttons use the
  same size scale and always have an accessible label.
- Editors must not redefine button width, height, padding or font size merely
  to obtain one of these three sizes.
- Every action that opens an editable graphic in Sprite Editor uses the shared
  image icon and `ui-button--edit-sprite` semantic class. Do not alternate pen,
  folder and image metaphors for the same cross-editor action.
