import { readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);
const forbidden = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".ts", ".tsx", ".cts", ".mts"].includes(extname(entry.name))) forbidden.push(relative(root, path));
  }
}

await walk(root);
if (forbidden.length) {
  console.error("TypeScript files are not permitted in this project:");
  forbidden.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}
console.log("JavaScript-only check passed.");
