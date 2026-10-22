import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_DITHERS, projectDither } from "./dither-themes";

const BACKGROUND = "#000000";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes = {
  ...PAGE_DITHERS,
  ...Object.fromEntries(["kiban", "kurogane", "styx", "scribe", "webnotes", "konto", "some-other-repo"].map((slug) => [slug, projectDither(slug)])),
};

describe("dither themes", () => {
  // The page accent is small text (links, numbers), so it has to clear AA on the page background.
  for (const [name, theme] of Object.entries(themes)) {
    test(`${name}: text accent is readable on the page background`, () => {
      assert.ok(contrast(theme.text, BACKGROUND) >= 4.5, `${name} ${theme.text} is ${contrast(theme.text, BACKGROUND).toFixed(1)}:1`);
    });
  }

  test("scribe keeps a darker pattern colour than its text colour", () => {
    const scribe = projectDither("scribe");
    assert.ok(luminance(scribe.text) > luminance(scribe.color));
  });
});
