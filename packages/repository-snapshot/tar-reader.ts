import { createHash } from "node:crypto";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import {
  assertRepositorySnapshotPath,
  decodeTarPath,
  normalizeTarPath,
  stripGitHubArchiveWrapper,
} from "./path-policy";
import {
  REPOSITORY_SNAPSHOT_LIMITS,
  type ParsedRepositoryArchive,
  type RepositorySnapshotSkipCounts,
  type ScratchRepositoryFile,
} from "./types";

const BLOCK_SIZE = 512;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const utf8 = new TextDecoder("utf-8", { fatal: true });

class AsyncByteReader {
  private readonly iterator: AsyncIterator<unknown>;
  private current: Buffer | null = null;
  private offset = 0;
  private ended = false;
  private streamedBytes = 0;

  constructor(
    stream: Readable,
    private readonly signal: AbortSignal,
  ) {
    this.iterator = stream[Symbol.asyncIterator]();
  }

  private assertNotAborted(): void {
    if (this.signal.aborted) {
      throw new DOMException("Repository archive processing was aborted.", "AbortError");
    }
  }

  private async ensureCurrent(): Promise<boolean> {
    this.assertNotAborted();
    while (this.current === null || this.offset >= this.current.length) {
      if (this.ended) return false;
      const next = await this.iterator.next();
      if (next.done) {
        this.ended = true;
        this.current = null;
        return false;
      }
      const chunk = Buffer.isBuffer(next.value)
        ? next.value
        : Buffer.from(next.value as Uint8Array);
      if (chunk.length === 0) continue;
      this.streamedBytes += chunk.length;
      if (this.streamedBytes > REPOSITORY_SNAPSHOT_LIMITS.maxTarStreamBytes) {
        throw new Error("Repository tar stream exceeds the total parser safety bound.");
      }
      this.current = chunk;
      this.offset = 0;
    }
    return true;
  }

  async readExact(size: number): Promise<Buffer> {
    if (!Number.isInteger(size) || size < 0) throw new Error("Invalid tar read size.");
    const output = Buffer.allocUnsafe(size);
    let written = 0;
    while (written < size) {
      if (!(await this.ensureCurrent())) throw new Error("Repository tar stream ended unexpectedly.");
      const current = this.current!;
      const take = Math.min(size - written, current.length - this.offset);
      current.copy(output, written, this.offset, this.offset + take);
      this.offset += take;
      written += take;
    }
    return output;
  }

  async skip(size: number): Promise<void> {
    if (!Number.isInteger(size) || size < 0) throw new Error("Invalid tar skip size.");
    let remaining = size;
    while (remaining > 0) {
      if (!(await this.ensureCurrent())) throw new Error("Repository tar stream ended unexpectedly.");
      const current = this.current!;
      const take = Math.min(remaining, current.length - this.offset);
      this.offset += take;
      remaining -= take;
    }
  }

  async readSome(maximum: number): Promise<Buffer | null> {
    if (!(await this.ensureCurrent())) return null;
    const current = this.current!;
    const take = Math.min(maximum, current.length - this.offset);
    const view = current.subarray(this.offset, this.offset + take);
    this.offset += take;
    return view;
  }
}

function isZeroBlock(block: Buffer): boolean {
  for (const byte of block) if (byte !== 0) return false;
  return true;
}

function parseOctal(field: Buffer, label: string): number {
  for (const byte of field) {
    if (byte !== 0 && byte !== 0x20 && (byte < 0x30 || byte > 0x37)) {
      throw new Error(`${label} uses an unsupported tar numeric encoding.`);
    }
  }
  const text = field.toString("ascii").replace(/\0/g, " ").trim();
  if (!/^[0-7]+$/.test(text)) throw new Error(`${label} is malformed.`);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is outside the safe integer range.`);
  return value;
}

interface ParsedTarHeader {
  path: string;
  size: number;
  type: string;
}

function parseTarHeader(block: Buffer): ParsedTarHeader {
  if (block.length !== BLOCK_SIZE) throw new Error("Tar header block is truncated.");
  const storedChecksum = parseOctal(block.subarray(148, 156), "Tar checksum");
  let calculatedChecksum = 0;
  for (let index = 0; index < block.length; index += 1) {
    calculatedChecksum += index >= 148 && index < 156 ? 0x20 : block[index]!;
  }
  if (storedChecksum !== calculatedChecksum) throw new Error("Tar header checksum is invalid.");

  const magic = block.subarray(257, 263).toString("ascii");
  if (!magic.startsWith("ustar")) throw new Error("Repository archive is not a supported POSIX tar stream.");

  const name = decodeTarPath(block.subarray(0, 100));
  const prefix = decodeTarPath(block.subarray(345, 500));
  const fullPath = prefix ? `${prefix}/${name}` : name;
  const typeByte = block[156]!;
  const type = typeByte === 0 ? "0" : String.fromCharCode(typeByte);
  return {
    path: fullPath,
    size: parseOctal(block.subarray(124, 136), "Tar entry size"),
    type,
  };
}

function paddingSize(size: number): number {
  return (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;
}

async function consumePadding(reader: AsyncByteReader, size: number): Promise<void> {
  const padding = paddingSize(size);
  if (padding === 0) return;
  const bytes = await reader.readExact(padding);
  if (!isZeroBlock(Buffer.concat([bytes, Buffer.alloc(BLOCK_SIZE - bytes.length)]).subarray(0, BLOCK_SIZE))) {
    for (const byte of bytes) if (byte !== 0) throw new Error("Tar entry padding is not zero-filled.");
  }
}

function parsePaxRecords(body: Buffer): ReadonlyMap<string, string> {
  const records = new Map<string, string>();
  let offset = 0;
  while (offset < body.length) {
    const space = body.indexOf(0x20, offset);
    if (space === -1) throw new Error("PAX record length is missing.");
    const lengthText = body.subarray(offset, space).toString("ascii");
    if (!/^[1-9][0-9]*$/.test(lengthText)) throw new Error("PAX record length is invalid.");
    const length = Number(lengthText);
    if (!Number.isSafeInteger(length) || length <= 0 || offset + length > body.length) {
      throw new Error("PAX record exceeds its containing entry.");
    }
    const record = body.subarray(space + 1, offset + length);
    if (record.length < 3 || record[record.length - 1] !== 0x0a) {
      throw new Error("PAX record is not newline terminated.");
    }
    const content = record.subarray(0, record.length - 1);
    const equals = content.indexOf(0x3d);
    if (equals <= 0) throw new Error("PAX record key/value separator is invalid.");
    let key: string;
    let value: string;
    try {
      key = utf8.decode(content.subarray(0, equals));
      value = utf8.decode(content.subarray(equals + 1));
    } catch {
      throw new Error("PAX metadata is not valid UTF-8.");
    }
    if (!/^[A-Za-z0-9._-]+$/.test(key) || records.has(key)) {
      throw new Error("PAX metadata key is unsupported or duplicated.");
    }
    records.set(key, value);
    offset += length;
  }
  if (offset !== body.length) throw new Error("PAX metadata framing is invalid.");
  return records;
}

function compareUtf8Path(a: ScratchRepositoryFile, b: ScratchRepositoryFile): number {
  return Buffer.compare(Buffer.from(a.path, "utf8"), Buffer.from(b.path, "utf8"));
}

function emptySkipCounts(): RepositorySnapshotSkipCounts {
  return {
    symlink: 0,
    hardlink: 0,
    fileTooLarge: 0,
    retainedFileLimit: 0,
    retainedBytesLimit: 0,
  };
}

async function drainTarEnd(reader: AsyncByteReader): Promise<void> {
  while (true) {
    const chunk = await reader.readSome(64 * 1024);
    if (chunk === null) return;
    for (const byte of chunk) {
      if (byte !== 0) throw new Error("Repository tar stream contains non-zero data after its end marker.");
    }
  }
}

export async function parseGitHubRepositoryArchive(input: {
  archive: Readable;
  expectedCommitSha: string;
  workDirectory: string;
  signal: AbortSignal;
}): Promise<ParsedRepositoryArchive> {
  if (!COMMIT_PATTERN.test(input.expectedCommitSha)) throw new Error("Expected GitHub commit SHA is invalid.");
  if (input.signal.aborted) throw new DOMException("Repository archive processing was aborted.", "AbortError");

  const sourceDirectory = path.join(input.workDirectory, "source-files");
  await mkdir(sourceDirectory, { recursive: false });

  let compressedBytes = 0;
  const compressedSource = Readable.from((async function* () {
    for await (const rawChunk of input.archive) {
      if (input.signal.aborted) throw new DOMException("Repository archive processing was aborted.", "AbortError");
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk as Uint8Array);
      compressedBytes += chunk.length;
      if (compressedBytes > REPOSITORY_SNAPSHOT_LIMITS.maxCompressedBytes) {
        throw new Error("Repository archive exceeds the compressed-byte safety bound.");
      }
      yield chunk;
    }
  })());
  const gunzip = createGunzip();
  compressedSource.on("error", (error) => gunzip.destroy(error));
  compressedSource.pipe(gunzip);
  const reader = new AsyncByteReader(gunzip, input.signal);

  const skipCounts = emptySkipCounts();
  const eligibleFiles: ScratchRepositoryFile[] = [];
  const seenPaths = new Map<string, "directory" | "leaf">();
  let expandedBytes = 0;
  let entryCount = 0;
  let wrapperRoot: string | null = null;
  let globalPaxSeen = false;
  let pendingPaxPath: string | null = null;
  let actualEntrySeen = false;
  let scratchSequence = 0;

  try {
    while (true) {
      const block = await reader.readExact(BLOCK_SIZE);
      if (isZeroBlock(block)) {
        const second = await reader.readExact(BLOCK_SIZE);
        if (!isZeroBlock(second)) throw new Error("Repository tar stream has only one zero end block.");
        await drainTarEnd(reader);
        break;
      }

      entryCount += 1;
      if (entryCount > REPOSITORY_SNAPSHOT_LIMITS.maxEntries) {
        throw new Error("Repository archive exceeds the entry-count safety bound.");
      }
      const header = parseTarHeader(block);

      if (header.type === "g" || header.type === "x") {
        if (header.size > REPOSITORY_SNAPSHOT_LIMITS.maxPaxBytes) {
          throw new Error("Repository PAX metadata exceeds the safety bound.");
        }
        const metadataHeaderPath = normalizeTarPath(header.path, false);
        const body = await reader.readExact(header.size);
        await consumePadding(reader, header.size);
        const records = parsePaxRecords(body);

        if (header.type === "g") {
          if (actualEntrySeen || globalPaxSeen || pendingPaxPath !== null || metadataHeaderPath !== "pax_global_header") {
            throw new Error("Repository archive contains an unexpected global PAX header.");
          }
          if (records.size !== 1 || records.get("comment") !== input.expectedCommitSha) {
            throw new Error("Repository archive global PAX commit identity does not match the resolved commit.");
          }
          globalPaxSeen = true;
        } else {
          if (pendingPaxPath !== null || records.size !== 1 || !records.has("path")) {
            throw new Error("Repository archive local PAX metadata is unsupported.");
          }
          pendingPaxPath = records.get("path")!;
        }
        continue;
      }

      actualEntrySeen = true;
      const rawPath = pendingPaxPath ?? header.path;
      pendingPaxPath = null;
      const isDirectory = header.type === "5";
      const normalizedPath = normalizeTarPath(rawPath, isDirectory);

      if (wrapperRoot === null) {
        if (!isDirectory || normalizedPath.includes("/") || header.size !== 0) {
          throw new Error("GitHub archive must begin with exactly one top-level wrapper directory.");
        }
        wrapperRoot = normalizedPath;
        continue;
      }

      const relativePath = stripGitHubArchiveWrapper(normalizedPath, wrapperRoot);
      if (relativePath.length === 0) throw new Error("GitHub archive wrapper directory is duplicated.");
      assertRepositorySnapshotPath(relativePath);

      if (seenPaths.has(relativePath)) throw new Error("Repository archive contains a duplicate normalized path.");

      if (header.type === "5") {
        if (header.size !== 0) throw new Error("Tar directory entries cannot contain payload bytes.");
        seenPaths.set(relativePath, "directory");
        continue;
      }

      if (header.type === "1" || header.type === "2") {
        if (header.size !== 0) throw new Error("Tar link entries cannot contain payload bytes.");
        seenPaths.set(relativePath, "leaf");
        if (header.type === "1") skipCounts.hardlink += 1;
        else skipCounts.symlink += 1;
        continue;
      }

      if (header.type !== "0") {
        throw new Error("Repository archive contains an unsupported special tar entry type.");
      }

      seenPaths.set(relativePath, "leaf");
      expandedBytes += header.size;
      if (expandedBytes > REPOSITORY_SNAPSHOT_LIMITS.maxExpandedRegularBytes) {
        throw new Error("Repository archive exceeds the expanded regular-file safety bound.");
      }

      if (header.size > REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFileBytes) {
        await reader.skip(header.size);
        await consumePadding(reader, header.size);
        skipCounts.fileTooLarge += 1;
        continue;
      }

      const bytes = await reader.readExact(header.size);
      await consumePadding(reader, header.size);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const scratchName = `${String(scratchSequence).padStart(6, "0")}-${createHash("sha256").update(relativePath, "utf8").digest("hex").slice(0, 16)}.blob`;
      scratchSequence += 1;
      const scratchPath = path.join(sourceDirectory, scratchName);
      await writeFile(scratchPath, bytes, { flag: "wx", mode: 0o600 });
      eligibleFiles.push({ path: relativePath, scratchPath, size: header.size, sha256 });
    }

    if (wrapperRoot === null) throw new Error("Repository archive did not contain a GitHub wrapper directory.");
    if (pendingPaxPath !== null) throw new Error("Repository archive ended with unapplied local PAX metadata.");

    const sortedPaths = [...seenPaths.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    for (let index = 0; index + 1 < sortedPaths.length; index += 1) {
      const current = sortedPaths[index]!;
      const next = sortedPaths[index + 1]!;
      if (seenPaths.get(current) === "leaf" && next.startsWith(`${current}/`)) {
        throw new Error("Repository archive contains a file/link path that shadows descendant entries.");
      }
    }

    eligibleFiles.sort(compareUtf8Path);
    const retained: ScratchRepositoryFile[] = [];
    let retainedBytes = 0;
    for (const file of eligibleFiles) {
      if (retained.length >= REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFiles) {
        skipCounts.retainedFileLimit += 1;
        await unlink(file.scratchPath);
        continue;
      }
      if (retainedBytes + file.size > REPOSITORY_SNAPSHOT_LIMITS.maxRetainedBytes) {
        skipCounts.retainedBytesLimit += 1;
        await unlink(file.scratchPath);
        continue;
      }
      retained.push(file);
      retainedBytes += file.size;
    }

    return Object.freeze({
      files: Object.freeze(retained.map((file) => Object.freeze({ ...file }))),
      compressedBytes,
      expandedBytes,
      skipCounts: Object.freeze({ ...skipCounts }),
    });
  } catch (error) {
    await rm(sourceDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    compressedSource.destroy();
    gunzip.destroy();
  }
}
