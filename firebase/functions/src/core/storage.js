function cleanSegment(value, fallback = "item") {
  const result = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return result || fallback;
}

export function privateStoragePath({ domain, ownerId, recordId, filename }) {
  return ["private", cleanSegment(domain), cleanSegment(ownerId, "owner"), cleanSegment(recordId, "record"), cleanSegment(filename, "upload")].join("/");
}
