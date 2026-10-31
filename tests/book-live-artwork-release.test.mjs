import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ROOT = new URL("../", import.meta.url);
const ASSETS = Object.freeze({
  "book-320.webp": { bytes: 16644, sha256: "f82095e4cb922b6416de27e9ecd83b8528dbbc439ec46f2fc82aabd5d3dd668f" },
  "book-640.webp": { bytes: 44746, sha256: "738911f2fe8b8b93ec5362aa0a19a6c5a29f5a890b51baad711a326a23a0e9dc" },
  "live-320.webp": { bytes: 29232, sha256: "219425339753dae00d74f63d4016f3a45685a0fae0fb2cf693974c370b83cbed" },
  "live-640.webp": { bytes: 78986, sha256: "28ba7c2aebbbe506a14e7e8287198c1378c145d165b3e9c5e85de4241a5fe83d" }
});

test("approved Book and Live illustrations are actually committed, not just described", async () => {
  for (const [filename, expected] of Object.entries(ASSETS)) {
    const data = await readFile(new URL(`public/experience/services/${filename}`, ROOT));
    assert.equal(data.length, expected.bytes, `${filename}: expected integrated optimized artwork`);
    const hash = createHash("sha256").update(data).digest("hex");
    assert.equal(hash, expected.sha256, `${filename}: replace old illustration with approved artwork`);
  }
});

test("Book and Live remain unambiguous in fallback icons and Home service names", async () => {
  const [glyphs, home] = await Promise.all([
    readFile(new URL("components/service-artwork.js", ROOT), "utf8"),
    readFile(new URL("components/marketplace-home.js", ROOT), "utf8")
  ]);
  assert.match(glyphs, /book: CalendarClock/);
  assert.match(glyphs, /events: Ticket/);
  assert.match(home, /Appointments & services/);
  assert.match(home, /Events & tickets/);
});
