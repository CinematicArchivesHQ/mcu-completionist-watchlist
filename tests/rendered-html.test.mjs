import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the Infinity Archive GitHub Pages export", async () => {
  const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
  assert.match(html, /The Infinity Archive/i);
  assert.match(html, /\/mcu-completionist-watchlist\/_next\//);
  assert.match(html, /Automatically monitored each morning/i);
});
