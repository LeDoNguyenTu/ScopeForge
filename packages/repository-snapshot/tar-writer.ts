import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rm, unlink } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import type { Writable } from "node:stream";
import { createDeflateRaw } from "node:zlib";
import {
  REPOSITORY_SNAPSHOT_LIMITS,
  REPOSITORY_SNAPSHOT_MANIFEST_PATH,
  type ScratchRepositoryFile,
} from "./types";

const BLOCK_SIZE = 512;
const GZIP_HEADER = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x03]);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function updateCrc32(state: number, bytes: Buffer): number {
  let crc = state;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return crc >>> 0;
}

function writeUtf8Field(target: Buffer, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error("Deterministic tar text field exceeds its fixed width.");
  bytes.copy(target, offset);
}

function writeOctalField(target: Buffer, offset: number, length: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Deterministic tar numeric field is invalid.");
  const text = value.toString(8);
  if (text.length > length - 1) throw new Error("Deterministic tar numeric field exceeds its fixed width.");
  writeUtf8Field(target, offset, length - 1, text.padStart(length - 1, "0"));
  target[offset + length - 1] = 0;
}

function splitUstarPath(value: string): { name: string; prefix: string } | null {
  if (Buffer.byteLength(value, "utf8") <= 100) return { name: value, prefix: "" };
  for (let index = value.length - 1; index > 0; index -= 1) {
    if (value[index] !== "/") continue;
    const prefix = value.slice(0, index);
    const name = value.slice(index + 1);
    if (name.length > 0
        && Buffer.byteLength(name, "utf8") <= 100
        && Buffer.byteLength(prefix, "utf8") <= 155) {
      return { name, prefix };
    }
  }
  return null;
}

function tarHeader(input: {
  path: string;
  size: number;
  type: "0" | "x";
}): Buffer {
  const split = splitUstarPath(input.path);
  if (split === null) throw new Error("Deterministic tar path requires PAX metadata.");
  const block = Buffer.alloc(BLOCK_SIZE);
  writeUtf8Field(block, 0, 100, split.name);
  writeOctalField(block, 100, 8, 0o644);
  writeOctalField(block, 108, 8, 0);
  writeOctalField(block, 116, 8, 0);
  writeOctalField(block, 124, 12, input.size);
  writeOctalField(block, 136, 12, 0);
  block.fill(0x20, 148, 156);
  block[156] = input.type.charCodeAt(0);
  writeUtf8Field(block, 257, 6, "ustar\0");
  writeUtf8Field(block, 263, 2, "00");
  if (split.prefix) writeUtf8Field(block, 345, 155, split.prefix);

  let checksum = 0;
  for (const byte of block) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, "0");
  writeUtf8Field(block, 148, 6, checksumText);
  block[154] = 0;
  block[155] = 0x20;
  return block;
}

function paxRecord(key: string, value: string): Buffer {
  const suffix = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(suffix, "utf8") + 1;
  while (true) {
    const candidate = `${length}${suffix}`;
    const actual = Buffer.byteLength(candidate, "utf8");
    if (actual === length) return Buffer.from(candidate, "utf8");
    length = actual;
  }
}

function padding(size: number): Buffer {
  const count = (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;
  return Buffer.alloc(count);
}

async function writeWithBackpressure(stream: Writable, bytes: Buffer): Promise<void> {
  if (bytes.length === 0) return;
  if (!stream.write(bytes)) await once(stream, "drain");
}

export interface DeterministicTarGzipResult {
  artifactPath: string;
  artifactDigest: string;
  storedArtifactBytes: number;
}

export async function writeDeterministicRepositoryTarGzip(input: {
  files: readonly ScratchRepositoryFile[];
  manifestBytes: Buffer;
  workDirectory: string;
  signal: AbortSignal;
}): Promise<DeterministicTarGzipResult> {
  if (input.signal.aborted) throw new DOMException("Repository snapshot writing was aborted.", "AbortError");
  const artifactPath = path.join(input.workDirectory, "repository-snapshot.tar.gz");
  const output = createWriteStream(artifactPath, { flags: "wx", mode: 0o600 });
  const deflater = createDeflateRaw({ level: 9 });
  const artifactHash = createHash("sha256");
  let artifactBytes = 0;
  let tarBytes = 0;
  let crcState = 0xffffffff;
  let compressionError: unknown = null;

  const writeArtifact = async (bytes: Buffer): Promise<void> => {
    artifactBytes += bytes.length;
    if (artifactBytes > REPOSITORY_SNAPSHOT_LIMITS.maxArtifactBytes) {
      throw new Error("Normalized repository snapshot exceeds the artifact-byte safety bound.");
    }
    artifactHash.update(bytes);
    await writeWithBackpressure(output, bytes);
  };

  const compressionDrain = (async () => {
    for await (const rawChunk of deflater) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk as Uint8Array);
      await writeArtifact(chunk);
    }
  })().catch((error) => {
    compressionError = error;
    deflater.destroy(error as Error);
    throw error;
  });

  const writeTar = async (bytes: Buffer): Promise<void> => {
    if (compressionError) throw compressionError;
    if (input.signal.aborted) throw new DOMException("Repository snapshot writing was aborted.", "AbortError");
    crcState = updateCrc32(crcState, bytes);
    tarBytes = (tarBytes + bytes.length) >>> 0;
    await writeWithBackpressure(deflater, bytes);
  };

  const writeLogicalFile = async (
    logicalPath: string,
    size: number,
    source: AsyncIterable<Buffer>,
    expectedDigest?: string,
  ): Promise<void> => {
    let headerPath = logicalPath;
    const split = splitUstarPath(logicalPath);
    if (split === null) {
      const pathDigest = createHash("sha256").update(logicalPath, "utf8").digest("hex");
      const paxBody = paxRecord("path", logicalPath);
      await writeTar(tarHeader({ path: `PaxHeaders/${pathDigest}`, size: paxBody.length, type: "x" }));
      await writeTar(paxBody);
      await writeTar(padding(paxBody.length));
      headerPath = `PaxFiles/${pathDigest}`;
    }

    await writeTar(tarHeader({ path: headerPath, size, type: "0" }));
    const digest = createHash("sha256");
    let observed = 0;
    for await (const bytes of source) {
      if (input.signal.aborted) throw new DOMException("Repository snapshot writing was aborted.", "AbortError");
      observed += bytes.length;
      if (observed > size) throw new Error("Scratch repository file exceeds its manifest size.");
      digest.update(bytes);
      await writeTar(bytes);
    }
    if (observed !== size) throw new Error("Scratch repository file size does not match its manifest provenance.");
    if (expectedDigest !== undefined && digest.digest("hex") !== expectedDigest) {
      throw new Error("Scratch repository file digest does not match its manifest provenance.");
    }
    await writeTar(padding(size));
  };

  try {
    await writeArtifact(GZIP_HEADER);
    const sortedFiles = [...input.files].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    for (const file of sortedFiles) {
      const source = createReadStream(file.scratchPath, { highWaterMark: 64 * 1024 });
      try {
        await writeLogicalFile(file.path, file.size, source, file.sha256);
      } finally {
        source.destroy();
      }
      await unlink(file.scratchPath);
    }

    async function* manifestSource(): AsyncIterable<Buffer> {
      yield input.manifestBytes;
    }
    await writeLogicalFile(REPOSITORY_SNAPSHOT_MANIFEST_PATH, input.manifestBytes.length, manifestSource());
    await writeTar(Buffer.alloc(BLOCK_SIZE * 2));
    deflater.end();
    await compressionDrain;

    const trailer = Buffer.alloc(8);
    trailer.writeUInt32LE((crcState ^ 0xffffffff) >>> 0, 0);
    trailer.writeUInt32LE(tarBytes >>> 0, 4);
    await writeArtifact(trailer);
    output.end();
    await once(output, "finish");

    return Object.freeze({
      artifactPath,
      artifactDigest: artifactHash.digest("hex"),
      storedArtifactBytes: artifactBytes,
    });
  } catch (error) {
    output.destroy();
    deflater.destroy();
    await compressionDrain.catch(() => undefined);
    await rm(artifactPath, { force: true });
    throw error;
  }
}
