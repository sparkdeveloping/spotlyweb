import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);
const forbidden = [];
const sourceFiles = [];
const reactHooks = [
  "useActionState",
  "useCallback",
  "useContext",
  "useDebugValue",
  "useDeferredValue",
  "useEffect",
  "useId",
  "useImperativeHandle",
  "useInsertionEffect",
  "useLayoutEffect",
  "useMemo",
  "useOptimistic",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
  "useTransition"
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const extension = extname(entry.name);
      if ([".ts", ".tsx", ".cts", ".mts"].includes(extension)) forbidden.push(relative(root, path));
      if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) sourceFiles.push(path);
    }
  }
}

function importedReactHooks(source) {
  const imported = new Set();
  const pattern = /import\s*\{([^}]*)\}\s*from\s*["']react["']/g;
  for (const match of source.matchAll(pattern)) {
    for (const part of match[1].split(",")) {
      const normalized = part.trim();
      if (!normalized) continue;
      const pieces = normalized.split(/\s+as\s+/);
      imported.add((pieces[1] || pieces[0]).trim());
    }
  }
  return imported;
}

function bareHookIsUsed(source, hook) {
  const pattern = new RegExp(`(^|[^\\w$.])${hook}\\s*\\(`, "m");
  return pattern.test(source);
}

await walk(root);
if (forbidden.length) {
  console.error("TypeScript files are not permitted in this project:");
  forbidden.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const missingHookImports = [];
for (const path of sourceFiles) {
  const relativePath = relative(root, path);
  if (!relativePath.startsWith("app/") && !relativePath.startsWith("components/") && !relativePath.startsWith("lib/")) continue;
  const source = await readFile(path, "utf8");
  const imported = importedReactHooks(source);
  const missing = reactHooks.filter((hook) => bareHookIsUsed(source, hook) && !imported.has(hook));
  if (missing.length) missingHookImports.push({ file: relativePath, hooks: missing });
}

if (missingHookImports.length) {
  console.error("Bare React hooks are used without matching imports:");
  for (const issue of missingHookImports) console.error(`- ${issue.file}: ${issue.hooks.join(", ")}`);
  process.exit(1);
}

console.log("JavaScript-only and React-hook import checks passed.");
