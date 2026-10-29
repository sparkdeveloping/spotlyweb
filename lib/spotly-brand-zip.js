import { deflateRawSync } from "node:zlib";

function crc32(data) {
  let result = -1;
  for (const value of data) {
    result ^= value;
    for (let bit = 0; bit < 8; bit++) result = (result >>> 1) ^ ((result & 1) ? 0xEDB88320 : 0);
  }
  return (result ^ -1) >>> 0;
}
export function makeBrandZip(entries) {
  const local = [], central = [];
  let offset = 0, directorySize = 0;
  for (const [filename, content] of entries) {
    if (!/^[a-zA-Z0-9_./ -]+$/.test(filename) || filename.startsWith("/") || filename.includes("..")) throw new Error("Invalid archive path");
    const name = Buffer.from(filename, "utf8");
    const original = Buffer.from(content, "utf8");
    const compressed = deflateRawSync(original, {level:9});
    const checksum = crc32(original);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(original.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(original.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    directorySize += record.length + name.length;
    offset += header.length + name.length + compressed.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
