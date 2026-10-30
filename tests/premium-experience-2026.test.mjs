import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { SERVICE_IDENTITIES } from "../lib/service-identity.js";
import { SPOTLY_PRODUCTS, productServiceId } from "../lib/spotly-products.js";
import { serviceMatchesMarketplaceBusiness } from "../lib/marketplace-taxonomy.js";

const root = new URL("../", import.meta.url);

test("service artwork ships complete, transparent, dimensionally stable and within its transfer budget", async () => {
  let total = 0;
  for (const [id, identity] of Object.entries(SERVICE_IDENTITIES)) {
    assert.equal(productServiceId(SPOTLY_PRODUCTS[id].route), id);
    for (const size of [320, 640]) {
      const data = await readFile(new URL(`public/experience/services/${identity.asset}-${size}.webp`, root));
      const meta = await sharp(data).metadata();
      assert.equal(meta.width, size);
      assert.equal(meta.height, size);
      assert.equal(meta.hasAlpha, true);
      assert.ok(data.length < (size === 320 ? 30000 : 80000), `${id} ${size}px exceeded budget`);
      total += data.length;
    }
  }
  assert.ok(total < 550000, `The complete six-service family is ${total} bytes`);
});

function luminance(hex) {
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}

test("all six service reading surfaces meet AA in both themes", async () => {
  const css = await readFile(new URL("app/v7-experience.css", root), "utf8");
  for (const id of Object.keys(SERVICE_IDENTITIES)) {
    for (const prefix of ["", "html.dark "]) {
      const selector = `${prefix}[data-service="${id}"]`;
      const block = css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
      const foreground = block.match(/--world-ink:\s*(#[\da-f]{6})/i)?.[1];
      const background = block.match(/--world-surface:\s*(#[\da-f]{6})/i)?.[1];
      assert.ok(foreground && background, `Missing surface pair for ${selector}`);
      const values = [luminance(foreground), luminance(background)].sort((a,b) => b-a);
      const ratio = (values[0] + .05) / (values[1] + .05);
      assert.ok(ratio >= 4.5, `${selector}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test("Home can classify nonempty real-shaped inventory without a missing category helper", async () => {
  const source = await readFile(new URL("components/marketplace-home.js", root), "utf8");
  const helper = source.match(/export function serviceMatchesBusiness\([^]*?\n\}/)?.[0];
  assert.ok(helper);
  const matches = new Function("serviceMatchesMarketplaceBusiness", `${helper.replace("export ", "")}; return serviceMatchesBusiness;`)(serviceMatchesMarketplaceBusiness);
  const records = [
    { category: "Restaurant", name: "Test restaurant" },
    { category: "Supermarket", name: "Test store" },
    { category: "Salon", name: "Test salon" },
    { category: "Event venue", name: "Test venue" }
  ];
  for (const record of records) for (const id of ["eat", "shop", "book", "events"]) {
    assert.equal(matches(id, record), serviceMatchesMarketplaceBusiness(id, record));
  }
  assert.equal(matches(null, records[0]), true);
});
