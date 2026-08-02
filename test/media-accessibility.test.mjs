import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared material honors reduced motion, enhanced contrast, and forced colors", async () => {
  const [media, loading, app] = await Promise.all([
    read("scss/components/_media-accessibility.scss"),
    read("scss/components/_loading.scss"),
    read("scss/app.scss")
  ]);

  assert.match(media, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(media, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(media, /\.ui-loading__spinner\s*\{[^}]*animation:\s*none\s*!important/s);
  assert.match(media, /@media\s*\(prefers-contrast:\s*more\)/);
  assert.match(media, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(media, /\[aria-selected="true"\]/);
  assert.match(media, /forced-color-adjust:\s*none/);
  assert.match(loading, /prefers-reduced-motion:[^}]+\.ui-loading__spinner\s*\{[^}]*animation:\s*none/s);
  assert.match(app, /@use\s+"components\/media-accessibility"/);
});
