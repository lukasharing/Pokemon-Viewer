# Map library

The map editor is exposed through `PokemonViewer.maps`. UI code depends on this public surface instead of constructing a game-specific editor directly.

## Creating an editor

```js
PokemonViewer.maps.registerDriver("example", {
  tools: PokemonViewer.maps.capabilities.readOnly,
  create(reader) {
    return new ExampleMapDriver(reader);
  }
});

const editor = PokemonViewer.maps.createEditor(reader, "example");
editor.init();
```

A driver owns ROM-specific discovery, decoding, and drawing. `MapEditor`, `MapWorkspace`, and `MapScene` own the common lifecycle, windows, viewport, navigation, connected-scene composition, command history, and capabilities. Both ROM families use `MapWorkspace.canvasPoint`, `setCanvasZoom`, and `centerOnCanvas` so mouse positions, cursor-anchored zoom, panning, and context actions use one coordinate contract.

Connected scenes intentionally contain the selected map and its immediate connections only. The original engines load that local neighbourhood; recursively following neighbours creates cycles and contradictory positions because connection offsets are local rather than global world coordinates.

## Public primitives

- `PokemonViewer.maps.Editor`
- `PokemonViewer.maps.Workspace`
- `PokemonViewer.maps.Scene`
- `PokemonViewer.maps.WindowManager`
- `PokemonViewer.maps.Controls`
- `PokemonViewer.maps.EventInspector`
- `PokemonViewer.maps.Selection`
- `PokemonViewer.maps.RomMap`
- `PokemonViewer.maps.RomConnection`
- `PokemonViewer.maps.GbaDriver`
- `PokemonViewer.maps.GbcDriver`

## Shared services

- `CommandStack` executes reversible commands and powers Ctrl/Cmd+Z, redo, and the visible History panel.
- `BookmarkStore` persists named workspace/map/offset locations with an optional description.
- `MapUtils.drawMapFrame()` renders the same zoom-stable boundary and compact
  label treatment for the GBA connected world and the GB/GBC `MapScene`.
- `MapContextMenu` asks a driver for `contextAt(event)` and delegates commands through `runContextAction(name, context)`. ROM-specific map objects never leak into the menu.
- `UiWindow` supplies the common header, information tooltip, table, footer, minimize, maximize, and close behavior.
- `AppDialog.form()` renders typed text, numeric, select, and multiline fields
  with shared validation. A numeric schema passes `min`, `max`, and `step`
  directly to the control and resolves to JavaScript numbers. Drivers should
  use this contract rather than creating editor-specific modal markup.
- `AppDialog.controls()` exposes the same schema renderer and typed `values()`
  reader for dynamic dialogs. Connections uses it when switching between
  existing and new neighbour schemas while retaining native range validation.

Code and sprite links are dispatched as an `editorlink` event. The app shell switches to the correct editor and seeks to the associated ROM offset.

The old global class names remain temporary compatibility aliases. New modules should use the namespace.
