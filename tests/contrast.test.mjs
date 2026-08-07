import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(pattern) {
  return css.match(pattern)?.[1] || "";
}
function tokens(section) {
  return Object.fromEntries([...section.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g)].map((match) => [match[1], match[2]]));
}
function luminance(hex) {
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const themes = {
  light: tokens(block(/:root\s*\{([\s\S]*?)\n\}/)),
  dark: tokens(block(/html\.dark\s*\{([\s\S]*?)\n\}/))
};

const textPairs = [
  ["--text", "--background"], ["--text", "--surface"], ["--text-2", "--surface"], ["--text-3", "--surface"],
  ["--on-accent", "--accent"], ["--on-success", "--success"], ["--on-warning", "--warning"], ["--on-danger", "--danger"], ["--on-info", "--info"],
  ["--control-text", "--control-bg"], ["--control-placeholder", "--control-bg"],
  ["--on-business", "--business"], ["--on-driver", "--driver"], ["--on-admin", "--admin"]
];
const nonTextPairs = [["--control-border", "--control-bg"], ["--focus", "--background"], ["--focus", "--surface"]];

for (const [theme, values] of Object.entries(themes)) {
  test(`${theme} semantic text pairs meet WCAG AA`, () => {
    for (const [foreground, background] of textPairs) {
      assert.ok(values[foreground] && values[background], `${foreground}/${background} missing in ${theme}`);
      assert.ok(contrast(values[foreground], values[background]) >= 4.5, `${theme} ${foreground} on ${background} is ${contrast(values[foreground], values[background]).toFixed(2)}:1`);
    }
  });
  test(`${theme} control boundaries and focus indicators meet 3:1`, () => {
    for (const [foreground, background] of nonTextPairs) {
      assert.ok(contrast(values[foreground], values[background]) >= 3, `${theme} ${foreground} on ${background} is ${contrast(values[foreground], values[background]).toFixed(2)}:1`);
    }
  });
}
