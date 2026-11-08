import assert from "node:assert/strict";

function u24le(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

/**
 * Read the small metadata subset Spotly's asset integrity tests need without
 * pulling a native image-processing dependency into the test runner.
 * Supports the three WebP bitstream containers used by shipped assets.
 */
export function webpMetadata(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  assert.ok(buffer.length >= 30, "WebP asset is too small to contain a valid header");
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF", "Expected RIFF WebP header");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP", "Expected WEBP container");
  const chunk = buffer.toString("ascii", 12, 16);
  const payload = 20;

  if (chunk === "VP8X") {
    const flags = buffer[payload];
    return {
      format: "webp",
      width: u24le(buffer, payload + 4) + 1,
      height: u24le(buffer, payload + 7) + 1,
      hasAlpha: Boolean(flags & 0x10)
    };
  }

  if (chunk === "VP8 ") {
    assert.equal(buffer[payload + 3], 0x9d, "Invalid VP8 frame marker");
    assert.equal(buffer[payload + 4], 0x01, "Invalid VP8 frame marker");
    assert.equal(buffer[payload + 5], 0x2a, "Invalid VP8 frame marker");
    return {
      format: "webp",
      width: buffer.readUInt16LE(payload + 6) & 0x3fff,
      height: buffer.readUInt16LE(payload + 8) & 0x3fff,
      hasAlpha: false
    };
  }

  if (chunk === "VP8L") {
    assert.equal(buffer[payload], 0x2f, "Invalid VP8L signature");
    const bits = buffer.readUInt32LE(payload + 1);
    return {
      format: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      hasAlpha: Boolean((bits >>> 28) & 1)
    };
  }

  throw new Error(`Unsupported WebP chunk ${JSON.stringify(chunk)}`);
}
