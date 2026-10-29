import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inflateSync} from "node:zlib";
import {makeBrandZip} from "../lib/spotly-brand-zip.js";
const source = readFileSync(new URL("../lib/spotly-brand-assets.js",import.meta.url),"utf8");
const match = source.match(/const compressedArtwork = "([A-Za-z0-9+/=]+)"/);
test("official source vectors load for all Spotly identities",()=>{
  assert.ok(match);
  const art = JSON.parse(inflateSync(Buffer.from(match[1],"base64")).toString("utf8"));
  assert.equal(Object.keys(art).length,12);
  for(const id of ["primary","business","driver"]){
    assert.match(art[id+"_symbol_color.svg"],/<svg\b/);
    assert.match(art[id+"_horizontal_on_light.svg"],/<svg\b/);
  }
  for(const id of ["bite","shopper","book","live","ride","send"])assert.match(art[id+"_horizontal_on_light.svg"],/<svg\b/);
  assert.ok(Object.values(art).every(s=>!/<script|<foreignObject|onload=/i.test(s)));
});
test("partner download emits valid ZIP headers and directory",()=>{
  const zip=makeBrandZip([["Spotly_Partner_Kit/colors.json","{}"],["Spotly_Partner_Kit/README.txt","Official"]]);
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length-12),2);
});
