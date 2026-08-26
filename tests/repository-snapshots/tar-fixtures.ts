import { gzipSync } from "node:zlib";

export interface TestTarEntry {
  name: string;
  type?: "0" | "1" | "2" | "5" | "x" | "g" | "3" | "4" | "6" | "7";
  body?: Buffer;
  linkname?: string;
  corruptChecksum?: boolean;
}

function writeString(target: Buffer, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error("fixture field too long");
  bytes.copy(target, offset);
}

function writeOctal(target: Buffer, offset: number, length: number, value: number): void {
  const encoded = value.toString(8).padStart(length - 1, "0");
  writeString(target, offset, length - 1, encoded);
  target[offset + length - 1] = 0;
}

function header(entry: TestTarEntry): Buffer {
  const block = Buffer.alloc(512);
  writeString(block, 0, 100, entry.name);
  writeOctal(block, 100, 8, entry.type === "5" ? 0o755 : 0o644);
  writeOctal(block, 108, 8, 0);
  writeOctal(block, 116, 8, 0);
  writeOctal(block, 124, 12, entry.body?.length ?? 0);
  writeOctal(block, 136, 12, 0);
  block.fill(0x20, 148, 156);
  block[156] = (entry.type ?? "0").charCodeAt(0);
  if (entry.linkname) writeString(block, 157, 100, entry.linkname);
  writeString(block, 257, 6, "ustar\0");
  writeString(block, 263, 2, "00");

  let checksum = 0;
  for (const byte of block) checksum += byte;
  const encoded = checksum.toString(8).padStart(6, "0");
  writeString(block, 148, 6, encoded);
  block[154] = 0;
  block[155] = 0x20;
  if (entry.corruptChecksum) block[0] ^= 1;
  return block;
}

export function paxRecord(key: string, value: string): Buffer {
  const suffix = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(suffix, "utf8") + 1;
  while (true) {
    const candidate = `${length}${suffix}`;
    const actual = Buffer.byteLength(candidate, "utf8");
    if (actual === length) return Buffer.from(candidate, "utf8");
    length = actual;
  }
}

export function createTestTar(entries: readonly TestTarEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const body = entry.body ?? Buffer.alloc(0);
    blocks.push(header({ ...entry, body }), body);
    const remainder = body.length % 512;
    if (remainder !== 0) blocks.push(Buffer.alloc(512 - remainder));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

export function createTestTarGzip(entries: readonly TestTarEntry[]): Buffer {
  return gzipSync(createTestTar(entries), { level: 1 });
}
