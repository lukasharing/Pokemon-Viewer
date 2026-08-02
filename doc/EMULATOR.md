# Emulator

The Emulator is a project tool, not another editor workspace. Its always-on-top
picture-in-picture floats above the current editor, can be dragged from its header,
minimized, or expanded to a focus/fullscreen layout without resetting the open
editor.

The **Emulator** control at the bottom of the project sidebar hides or restores
the floating surface. Hiding it pauses execution; reopening it keeps the loaded
project and save-data context.

The manifest capability keeps the historical identifier `emulator_editor`,
while the persistent runtime service is requested as `emulator`.
`RomReader.ensureWorkspace` normalizes that boundary so loading a project
immediately starts mGBA instead of leaving the pre-ROM placeholder visible.
Restoring the dock retries startup if an earlier attempt did not create a core.

## Runtime

- The core is [mGBA](https://github.com/mgba-emu/mgba), supplied by the
  `@thenick775/mgba-wasm` browser build under MPL-2.0.
- mGBA's built-in high-level BIOS support replaces the former 220-byte
  IodineGBA BIOS stub. That stub could satisfy neither the required 16 KiB BIOS
  contract nor all software interrupts, so it was not a valid production boot
  path.
- Video presentation uses mGBA's deterministic single presenter. Its optional
  threaded presenter is intentionally disabled because GB/GBC fast-forward can
  interleave adjacent frame columns on the shared canvas.
- `npm start` serves WebAssembly with its correct MIME type and enables
  cross-origin isolation for the threaded core.
- GBA, GB and GBC ROMs are written from a fresh snapshot of the current writable
  project memory to mGBA's private browser filesystem. No ROM is uploaded.
- Refresh closes the active cartridge mapping before replacing and reopening
  the ROM file. A core-only reset can retain mGBA's former ROM mapping after
  Emscripten replaces its filesystem entry.

## Project synchronization

Applied editor history events queue a short debounced reload. The emulator
pauses, replaces its ROM file with the current project bytes, reloads the game
and restores the prior running state. This is the safe general contract until
the resource graph can classify every mutation as graphics-only, map-only,
code-only or full-reset.

Project reloads are deliberately cold game resets. Emulator save-states are not
restored because they contain the previous WRAM/VRAM image and can make edited
maps or graphics appear unchanged. Battery-backed `.sav` data is stored and
loaded independently, so normal in-game progress remains available.

Save data is stored by mGBA in browser IndexedDB. **Save** downloads the current
`.sav`; **Load** writes a selected `.sav`, synchronizes storage and reloads the
game.

## Controls

Click the screen to capture emulator keys; click outside to return shortcuts to
the editor.

Mapped emulator keys are claimed during the capture phase, before editor-level
shortcuts can observe them. This prevents D-pad and action input from moving the
Hex Editor selection or triggering commands in another hidden workspace.

| Game Boy control | Keyboard |
|---|---|
| D-pad | Arrow keys |
| A / B | Z / X |
| L / R | A / S |
| Start / Select | Enter / Backspace |

The on-screen controller mirrors the same inputs with a D-pad, A/B, L/R and
Start/Select. Pointer capture and per-pointer state allow combinations such as
holding a direction while pressing A, on touch, pen or mouse. Buttons release
on pointer cancellation and when the emulator pauses or closes.

The speaker control in the emulator header mutes or restores the mGBA output
volume without changing ROM state or the selected emulation speed.

The information button in the emulator header opens an accessible help dialog
covering keyboard/touch input, project refresh, save-data import/export and
window modes.
