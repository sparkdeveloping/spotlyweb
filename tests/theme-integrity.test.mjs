import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const requiredTokens = [
  "--background", "--grouped", "--surface", "--surface-2", "--surface-raised", "--surface-hover", "--surface-selected", "--overlay",
  "--text", "--text-2", "--text-3", "--text-disabled", "--text-inverse",
  "--border", "--border-subtle", "--border-strong", "--divider",
  "--accent", "--accent-hover", "--accent-active", "--accent-strong", "--accent-soft", "--on-accent", "--on-accent-soft",
  "--control-bg", "--control-text", "--control-placeholder", "--control-border", "--control-border-error",
  "--focus", "--focus-soft", "--success", "--on-success", "--warning", "--on-warning", "--danger", "--on-danger", "--info", "--on-info"
];

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() && path.endsWith(".js") ? [path] : [];
  });
}
function sourceFiles() {
  return [...walk(join(rootDir, "app")), ...walk(join(rootDir, "components"))];
}

test("light and dark themes define every required semantic token", () => {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const dark = css.match(/html\.dark\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  for (const token of requiredTokens) {
    assert.match(root, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`), `${token} is missing from light theme`);
    assert.match(dark, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`), `${token} is missing from dark theme`);
  }
});

test("critical fields do not use the legacy undefined input class", () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    if (/className=(?:"|\{cn\(")input(?:\s|"|\))/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
  assert.match(css, /\.field-control[\s,\n]/);
});

test("adaptive source has no fixed white background utility", () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    if (/\bbg-white\b/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("shared primary button uses paired semantic foreground and background", () => {
  const source = readFileSync(new URL("../components/ui.js", import.meta.url), "utf8");
  assert.match(source, /bg-\[var\(--accent\)\]/);
  assert.match(source, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(source, /primary:[^\n]*text-white/);
});

test("theme is resolved before hydration and system mode exposes resolvedTheme", () => {
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  const providers = readFileSync(new URL("../components/providers.js", import.meta.url), "utf8");
  assert.match(layout, /themeBootstrap/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(providers, /resolvedTheme/);
  assert.match(providers, /isDark: resolvedTheme === "dark"/);
});
