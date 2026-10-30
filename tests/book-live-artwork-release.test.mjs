import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ROOT = new URL("../", import.meta.url);
const ASSETS = Object.freeze({
  "book-320.webp": { bytes: 16618, sha256: "df12e83d3af370f6758ad65b211196b1af23bd729d0d08dee4768ee5651132cd" },
  "book-640.webp": { bytes: 43796, sha256: "3a670dc410a70e9576e8b58a5f3fb3986073b40a62f69f676595a9743e7392e3" },
  "live-320.webp": { bytes: 28276, sha256: "4647abbfb6c86263302a1cdcdbdfea1ffbd15092118f91c1ad2041d5a8bad935" },
  "live-640.webp": { bytes: 78552, sha256: "53db648d8d051b81811e88fa84e32aa423378c3fc731662ef7e010fea073b2c8" }
});

test("approved Book and Live illustrations are actually committed, not just described", async () => {
  for (const [filename, expected] of Object.entries(ASSETS)) {
    const data = await readFile(new URL(`public/experience/services/${filename}`, ROOT));
    assert.equal(data.length, expected.bytes, `${filename}: expected approved optimized artwork (check ZIP)`);
    const hash = createHash("sha256").update(data).digest("hex");
    assert.equal(hash, expected.sha256, `${filename}: replace old illustration with approved artwork`);
  }
});

test("Book and Live remain unambiguous in fallback icons and Home service names", async () => {
  const [glyphs, home] = await Promise.all([
    readFile(new URL("components/service-artwork.js", ROOT), "utf8"),
    readFile(new URL("components/marketplace-home.js", ROOT), "utf8")
  ]);
  assert.match(glyphs, /book: CalendarClock2/);
  assert.match(glyphs, /events: Ticket/);
  assert.match(home, /Appointments & services/);
  assert.match(home, /Events & tickets/);
});
