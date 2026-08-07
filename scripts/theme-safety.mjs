import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const policy = JSON.parse(readFileSync(join(root, "config/theme-policy.json"), "utf8"));
const required = [
  "--background", "--grouped", "--surface", "--surface-2", "--surface-raised", "--surface-hover", "--surface-selected", "--overlay",
  "--text", "--text-2", "--text-3", "--text-disabled", "--text-inverse", "--border", "--border-subtle", "--border-strong", "--divider",
  "--accent", "--accent-hover", "--accent-active", "--accent-strong", "--accent-soft", "--on-accent", "--on-accent-soft",
  "--control-bg", "--control-bg-hover", "--control-bg-disabled", "--control-text", "--control-text-disabled", "--control-placeholder", "--control-border", "--control-border-hover", "--control-border-error",
  "--focus", "--focus-soft", "--success", "--on-success", "--warning", "--on-warning", "--danger", "--on-danger", "--info", "--on-info",
  "--inverse-surface", "--inverse-text"
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() && /\.(js|mjs)$/.test(entry.name) ? [path] : [];
  });
}
const sourceFiles = [...walk(join(root, "app")), ...walk(join(root, "components"))];
const failures = [];
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] || "";
const darkBlock = css.match(/html\.dark\s*\{([\s\S]*?)\n\}/)?.[1] || "";
for (const token of required) {
  const pattern = new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`);
  if (!pattern.test(rootBlock)) failures.push(`${token} is missing from :root`);
  if (!pattern.test(darkBlock)) failures.push(`${token} is missing from html.dark`);
}

const inverseAllowlist = new Set(policy.approvedInverseComponents);
for (const file of sourceFiles) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const source = readFileSync(file, "utf8");
  if (/\bbg-white\b/.test(source)) failures.push(`${rel}: fixed bg-white is not permitted`);
  if (/\b(?:bg|text|border|divide)-(?:gray|slate)-\d+\b/.test(source)) failures.push(`${rel}: fixed gray/slate palette is not permitted`);
  const fixedNamedPalette = /\b(?:bg|text|border|divide)-(?:red|green|amber|yellow|orange|blue|violet|purple|emerald|cyan|teal|lime|rose|pink|indigo)-\d{2,3}(?:\/\d+)?\b/;
  if (fixedNamedPalette.test(source) && !inverseAllowlist.has(rel)) failures.push(`${rel}: fixed named palette shades require semantic tokens or an approved fixed/inverse exception`);
  if (/className=(?:"|\{cn\(")input(?:\s|"|\))/.test(source)) failures.push(`${rel}: legacy input class is not permitted`);
  if (/style=\{\{[^\n}]*--accent/.test(source)) failures.push(`${rel}: inline accent variables break paired theme foregrounds`);
  if (/var\(--[^)]*\)\]\d/.test(source)) failures.push(`${rel}: malformed semantic utility detected`);
  if (/\btext-white(?:\/\d+)?\b/.test(source) && !inverseAllowlist.has(rel)) failures.push(`${rel}: text-white requires an approved inverse-surface exception`);
}

function routeForPage(path) {
  let value = relative(join(root, "app"), dirname(path)).replaceAll("\\", "/");
  if (value === ".") return "/";
  return `/${value}`;
}
const classified = new Set([...policy.adaptive, ...policy.fixedDark, ...policy.fixedLight]);
for (const file of walk(join(root, "app")).filter((item) => item.endsWith("page.js") && !item.includes(`${join("app", "api")}`))) {
  const route = routeForPage(file);
  if (!classified.has(route)) failures.push(`${route}: page route has no theme policy classification`);
}

if (failures.length) {
  console.error("Theme safety check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Theme safety check passed for ${sourceFiles.length} source files and ${classified.size} classified route patterns.`);
