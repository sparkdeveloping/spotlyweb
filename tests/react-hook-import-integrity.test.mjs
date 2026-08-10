import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const hooks = [
  "useActionState", "useCallback", "useContext", "useDebugValue", "useDeferredValue",
  "useEffect", "useId", "useImperativeHandle", "useInsertionEffect", "useLayoutEffect",
  "useMemo", "useOptimistic", "useReducer", "useRef", "useState", "useSyncExternalStore", "useTransition"
];

async function collect(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "dist", "coverage"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path, output);
    else if ([".js", ".jsx", ".mjs", ".cjs"].includes(extname(entry.name))) output.push(path);
  }
  return output;
}

function importedHooks(source) {
  const found = new Set();
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']react["']/g)) {
    for (const raw of match[1].split(",")) {
      const part = raw.trim();
      if (!part) continue;
      const pieces = part.split(/\s+as\s+/);
      found.add((pieces[1] || pieces[0]).trim());
    }
  }
  return found;
}

function bareUse(source, hook) {
  return new RegExp(`(^|[^\\w$.])${hook}\\s*\\(`, "m").test(source);
}

test("bare React hooks used by app source are imported from React", async () => {
  const files = [
    ...(await collect(join(root, "app"))),
    ...(await collect(join(root, "components"))),
    ...(await collect(join(root, "lib")))
  ];
  const problems = [];
  for (const path of files) {
    const source = await readFile(path, "utf8");
    const imported = importedHooks(source);
    const missing = hooks.filter((hook) => bareUse(source, hook) && !imported.has(hook));
    if (missing.length) problems.push(`${relative(root, path)}: ${missing.join(", ")}`);
  }
  assert.deepEqual(problems, []);
});
