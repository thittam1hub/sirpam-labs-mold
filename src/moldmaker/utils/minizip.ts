// Sirpam 3D Labs Mold — tiny ZIP writer (stored, no compression).
// Enough for 3MF packages, which are ZIPs of a few XML text files.
// Format: PKWARE APPNOTE — local headers, then central directory, then EOCD.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Build a ZIP archive from a map of path → text content. */
export function createZip(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const items = Object.entries(files).map(([path, text]) => {
    const name = enc.encode(path), data = enc.encode(text);
    return { name, data, crc: crc32(data), at: 0 };
  });
  const localSize = items.reduce((s, f) => s + 30 + f.name.length + f.data.length, 0);
  const centralSize = items.reduce((s, f) => s + 46 + f.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const v = new DataView(out.buffer);
  let o = 0;
  const u16 = (x: number) => { v.setUint16(o, x, true); o += 2; };
  const u32 = (x: number) => { v.setUint32(o, x, true); o += 4; };
  const bytes = (b: Uint8Array) => { out.set(b, o); o += b.length; };

  for (const f of items) {
    f.at = o;
    u32(0x04034b50); u16(20); u16(0); u16(0); u16(0); u16(0);
    u32(f.crc); u32(f.data.length); u32(f.data.length); u16(f.name.length); u16(0);
    bytes(f.name); bytes(f.data);
  }
  const dirStart = o;
  for (const f of items) {
    u32(0x02014b50); u16(20); u16(20); u16(0); u16(0); u16(0); u16(0);
    u32(f.crc); u32(f.data.length); u32(f.data.length); u16(f.name.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(f.at);
    bytes(f.name);
  }
  u32(0x06054b50); u16(0); u16(0); u16(items.length); u16(items.length);
  u32(centralSize); u32(dirStart); u16(0);
  return out.buffer;
}
