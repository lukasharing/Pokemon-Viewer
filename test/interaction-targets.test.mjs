import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared interaction targets keep compact desktop and a 44px touch profile", async () => {
  const [tokens, targets, app] = await Promise.all([
    read("scss/_tokens.scss"),
    read("scss/components/_interaction-targets.scss"),
    read("scss/app.scss")
  ]);

  assert.match(tokens, /\$target-min:\s*24px/);
  assert.match(tokens, /\$target-touch:\s*44px/);
  assert.match(targets, /@media\s*\(pointer:\s*coarse\)/);
  assert.match(targets, /--ui-target-size:\s*#\{\$target-touch\}/);
  assert.match(targets, /\.editor_area\.has-editor-header\.has-ui-toolbars/);
  assert.match(targets, /\.ui-window__controls button/);
  assert.match(targets, /\.ui-panel-tabs__tab/);
  assert.match(app, /@use\s+"components\/interaction-targets"/);
});
