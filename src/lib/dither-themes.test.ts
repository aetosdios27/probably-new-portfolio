import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCENT_COLORS } from "./accent-palette";
import { atLightness, contrast, relativeLuminance } from "./color";
import { PAGE_DITHERS, projectDither } from "./dither-themes";
import { THEME_BACKGROUND } from "./theme";

// The light accent is derived in CSS; read the lightness and chroma it actually uses.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const token = (name: string) => Number(css.match(new RegExp(`--${name}:\\s*([\\d.]+)`))?.[1]);
const LIGHTNESS = token("accent-light-l");
const CHROMA = token("accent-light-c");

const themes = {
  ...PAGE_DITHERS,
  ...Object.fromEntries(["kiban", "kurogane", "styx", "scribe", "webnotes", "konto", "some-other-repo"].map((slug) => [slug, projectDither(slug)])),
};
// Every accent source: page and project themes, plus the six seasonal hues the homepage cycles through.
const sources = { ...Object.fromEntries(Object.entries(themes).map(([name, theme]) => [name, theme.text])), ...Object.fromEntries(ACCENT_COLORS.map((color) => [`season ${color}`, color])) };

describe("dither themes", () => {
  test("globals.css declares the light accent derivation", () => {
    assert.ok(LIGHTNESS > 0 && LIGHTNESS < 1, `--accent-light-l is ${LIGHTNESS}`);
    assert.ok(CHROMA > 0, `--accent-light-c is ${CHROMA}`);
  });

  // The page accent is small text (links, numbers), so it has to clear AA on the page background.
  for (const [name, source] of Object.entries(sources)) {
    test(`${name}: text accent is readable on the dark background`, () => {
      const ratio = contrast(source, THEME_BACKGROUND.dark);
      assert.ok(ratio >= 4.5, `${name} ${source} is ${ratio.toFixed(1)}:1`);
    });
    test(`${name}: text accent is readable on the light background`, () => {
      const accent = atLightness(source, LIGHTNESS, CHROMA);
      const ratio = contrast(accent, THEME_BACKGROUND.light);
      assert.ok(ratio >= 4.5, `${name} ${source} -> ${accent} is ${ratio.toFixed(1)}:1`);
    });
  }

  test("scribe keeps a darker pattern colour than its text colour", () => {
    const scribe = projectDither("scribe");
    assert.ok(relativeLuminance(scribe.text) > relativeLuminance(scribe.color));
  });
});
