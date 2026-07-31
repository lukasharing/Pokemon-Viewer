# Visual scripting architecture

## Decision

PUSH uses `ScriptLogicGraph` as the engine-neutral document and keeps every ROM
codec independent from its UI. The current vertical renderer is its read-only
viewer. The planned editable Blueprint surface should
use **Drawflow** because the application is vanilla JavaScript and its nodes
are real HTML: controls, dropdowns, keyboard focus, tooltips, ports, and PUSH
styling remain accessible.

Chart.js is not a node editor. React Flow would require React. Rete.js v2 has
the strongest typed dataflow/control-flow architecture but also requires a
React, Vue, Angular, Svelte, or Lit rendering layer. LiteGraph is a close match
to UDK Blueprints and has no dependencies, but its Canvas widgets are harder
to style and make accessible than HTML controls.

Drawflow is only the renderer. It must never read or write ROM memory.

```text
family decoder → ScriptLogicGraph → Drawflow adapter
                                      ↓ UI edits
family writer  ← validated graph  ← node schemas
```

## Typed ports

- `flow`: execution order, including true/false/otherwise branches.
- `script`: verified script references with their owning pointer.
- `text`: text resources with near/far/GBA pointer ownership.
- `map`: destination map plus warp identity.
- `object`: local event/object identity.
- `species`, `trainer`, `item`, `move`, `sound`: canonical resource IDs.
- `number`, `flag`, `variable`: values with native width and range metadata.
- `rgbds`: explicit Gen I escape node for executable assembly.

Connections are accepted only when their types and family writer agree. A
dropdown does not store display text; it stores the canonical resource ID and
resolves the label through the resource graph.

## Family policy

Generation III nodes compile to verified event opcodes and their real operand
layouts. Crystal nodes compile to its `$00–$A9` event table or native text
macros. Red/Blue text nodes compile to native text macros. Red/Blue executable
logic is RGBDS LR35902: high-level templates may be added only for engine
routines whose calling convention and byte output are verified against
`pret/pokered`. Arbitrary CPU code remains an RGBDS node.

## Editing gate

The Blueprint surface stays read-only until a node schema provides:

1. exact native command/operand layout;
2. typed ports and value validation;
3. lossless decode/encode regression;
4. owning-reference and relocation policy;
5. atomic Undo/Redo;
6. project validation after compilation.

Unknown bytes are displayed as opaque/raw nodes and cannot be silently
rewritten.
# Visual graph direction

The Simple view follows one programming-graph rule everywhere:

- execution enters an operation on the left and exits on the right;
- only operations that really continue, branch, call or loop expose execution
  outputs;
- numbers, strings, pointers and dropdown choices live in a separate typed
  **Control** node to the left of the operation;
- a dashed data edge connects that control output to the operation's data port;
- data values are never inserted into the execution chain as fake steps;
- graph labels are projections of current decoded commands. Resources without
  a verified semantic name use stable neutral identifiers such as `sprite-1`.
