import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { buildRepositorySnapshotManifest } from "./manifest";
import { assertRepositorySnapshotPath, decodeTarPath, normalizeTarPath } from "./path-policy";
import {
  REPOSITORY_SNAPSHOT_FORMAT,
  REPOSITORY_SNAPSHOT_LIMITS,
  REPOSITORY_SNAPSHOT_MANIFEST_PATH,
  type RepositorySnapshotManifest,
  type RepositorySnapshotSkipCounts,
  type ScratchRepositoryFile,
} from "./types";

const BLOCK_SIZE = 512;
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export interface RepositorySnapshotReadExpectation {
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  storedArtifactBytes: number;
  retainedFileCount: number;
  retainedBytes: number;
}

export interface MaterializedRepositorySnapshot {
  sourceDirectory: string;
  manifest: RepositorySnapshotManifest;
}

function missingPath(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

async function makeMaterializedTreeRemovable(directory: string): Promise<void> {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("Materialized repository snapshot cleanup requires a real directory.");
  }

  await chmod(directory, 0o700);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await makeMaterializedTreeRemovable(path.join(directory, entry.name));
    }
  }
}

export async function removeMaterializedRepositorySnapshot(
  sourceDirectory: string,
): Promise<void> {
  try {
    await makeMaterializedTreeRemovable(sourceDirectory);
  } catch (error) {
    if (missingPath(error)) return;
    throw error;
  }
  await rm(sourceDirectory, { recursive: true, force: true });
}

class AsyncByteReader {
  private readonly iterator: AsyncIterator<unknown>;
  private current: Buffer | null = null;
  private offset = 0;
  private ended = false;
  private streamedBytes = 0;

  constructor(stream: Readable, private readonly signal: AbortSignal) {
    this.iterator = stream[Symbol.asyncIterator]();
  }

  private assertNotAborted(): void {
    if (this.signal.aborted) throw new DOMException("Repository snapshot materialization was aborted.", "AbortError");
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
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value as Uint8Array);
      if (chunk.length === 0) continue;
      this.streamedBytes += chunk.length;
      if (this.streamedBytes > REPOSITORY_SNAPSHOT_LIMITS.maxTarStreamBytes) {
        throw new Error("Repository snapshot tar stream exceeds the parser safety bound.");
      }
      this.current = chunk;
      this.offset = 0;
    }
    return true;
  }

  async readExact(size: number): Promise<Buffer> {
    if (!Number.isInteger(size) || size < 0) throw new Error("Invalid repository snapshot read size.");
    const output = Buffer.allocUnsafe(size);
    let written = 0;
    while (written < size) {
      if (!(await this.ensureCurrent())) throw new Error("Repository snapshot tar stream ended unexpectedly.");
      const current = this.current!;
      const take = Math.min(size - written, current.length - this.offset);
      current.copy(output, written, this.offset, this.offset + take);
      written += take;
      this.offset += take;
    }
    return output;
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

interface ParsedHeader {
  path: string;
  size: number;
  type: string;
}

function parseHeader(block: Buffer): ParsedHeader {
  if (block.length !== BLOCK_SIZE) throw new Error("Repository snapshot tar header is truncated.");
  const storedChecksum = parseOctal(block.subarray(148, 156), "Tar checksum");
  let calculated = 0;
  for (let index = 0; index < block.length; index += 1) {
    calculated += index >= 148 && index < 156 ? 0x20 : block[index]!;
  }
  if (storedChecksum !== calculated) throw new Error("Repository snapshot tar checksum is invalid.");
  if (!block.subarray(257, 263).toString("ascii").startsWith("ustar")) {
    throw new Error("Repository snapshot is not a supported POSIX tar stream.");
  }
  if (parseOctal(block.subarray(100, 108), "Tar mode") !== 0o644
      || parseOctal(block.subarray(108, 116), "Tar uid") !== 0
      || parseOctal(block.subarray(116, 124), "Tar gid") !== 0
      || parseOctal(block.subarray(136, 148), "Tar mtime") !== 0) {
    throw new Error("Repository snapshot tar metadata is not normalized.");
  }
  const name = decodeTarPath(block.subarray(0, 100));
  const prefix = decodeTarPath(block.subarray(345, 500));
  const fullPath = prefix ? `${prefix}/${name}` : name;
  const typeByte = block[156]!;
  return {
    path: fullPath,
    size: parseOctal(block.subarray(124, 136), "Tar entry size"),
    type: typeByte === 0 ? "0" : String.fromCharCode(typeByte),
  };
}

function paddingSize(size: number): number {
  return (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;
}

async function consumePadding(reader: AsyncByteReader, size: number): Promise<void> {
  const padding = paddingSize(size);
  if (padding === 0) return;
  const bytes = await reader.readExact(padding);
  for (const byte of bytes) if (byte !== 0) throw new Error("Repository snapshot tar padding is not zero-filled.");
}

function parsePaxPath(body: Buffer): string {
  const space = body.indexOf(0x20);
  if (space < 1) throw new Error("Repository snapshot PAX record length is missing.");
  const lengthText = body.subarray(0, space).toString("ascii");
  if (!/^[1-9][0-9]*$/.test(lengthText) || Number(lengthText) !== body.length) {
    throw new Error("Repository snapshot PAX record length is invalid.");
  }
  if (body[body.length - 1] !== 0x0a) throw new Error("Repository snapshot PAX record is not newline terminated.");
  const record = body.subarray(space + 1, body.length - 1);
  if (!record.subarray(0, 5).equals(Buffer.from("path=", "ascii"))) {
    throw new Error("Repository snapshot contains unreviewed PAX metadata.");
  }
  const valueBytes = record.subarray(5);
  let value: string;
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(valueBytes);
  } catch {
    throw new Error("Repository snapshot PAX path is not valid UTF-8.");
  }
  return value;
}

async function drainEnd(reader: AsyncByteReader): Promise<void> {
  while (true) {
    const chunk = await reader.readSome(64 * 1024);
    if (chunk === null) return;
    for (const byte of chunk) if (byte !== 0) throw new Error("Repository snapshot contains non-zero data after its end marker.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const keys = Object.keys(value);
  const allowed = new Set(expected);
  if (keys.length !== expected.length || keys.some((key) => !allowed.has(key))) {
    throw new Error(`${label} contains unsupported fields.`);
  }
}

function boundedInteger(value: unknown, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(`${label} is outside the supported snapshot boundary.`);
  }
  return value as number;
}

function parseSkipCounts(value: unknown): RepositorySnapshotSkipCounts {
  if (!isRecord(value)) throw new Error("Repository snapshot manifest skip counts are invalid.");
  const keys = ["symlink", "hardlink", "fileTooLarge", "retainedFileLimit", "retainedBytesLimit"] as const;
  exactKeys(value, keys, "Repository snapshot manifest skip counts");
  return {
    symlink: boundedInteger(value.symlink, 50_000, "skipCounts.symlink"),
    hardlink: boundedInteger(value.hardlink, 50_000, "skipCounts.hardlink"),
    fileTooLarge: boundedInteger(value.fileTooLarge, 50_000, "skipCounts.fileTooLarge"),
    retainedFileLimit: boundedInteger(value.retainedFileLimit, 50_000, "skipCounts.retainedFileLimit"),
    retainedBytesLimit: boundedInteger(value.retainedBytesLimit, 50_000, "skipCounts.retainedBytesLimit"),
  };
}

function parseManifest(value: unknown): RepositorySnapshotManifest {
  if (!isRecord(value)) throw new Error("Repository snapshot manifest must be an object.");
  exactKeys(value, [
    "schemaVersion", "format", "canonicalRepositoryUrl", "defaultBranch", "resolvedCommitSha",
    "files", "skipCounts", "contentDigest",
  ], "Repository snapshot manifest");
  if (value.schemaVersion !== 1 || value.format !== REPOSITORY_SNAPSHOT_FORMAT) {
    throw new Error("Repository snapshot manifest format is unsupported.");
  }
  if (typeof value.canonicalRepositoryUrl !== "string"
      || typeof value.defaultBranch !== "string"
      || typeof value.resolvedCommitSha !== "string"
      || !COMMIT_PATTERN.test(value.resolvedCommitSha)
      || typeof value.contentDigest !== "string"
      || !SHA256_PATTERN.test(value.contentDigest)
      || !Array.isArray(value.files)
      || value.files.length > REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFiles) {
    throw new Error("Repository snapshot manifest provenance is invalid.");
  }
  const files = value.files.map((item) => {
    if (!isRecord(item)) throw new Error("Repository snapshot manifest file record is invalid.");
    exactKeys(item, ["path", "size", "sha256"], "Repository snapshot manifest file record");
    if (typeof item.path !== "string") throw new Error("Repository snapshot manifest file path is invalid.");
    assertRepositorySnapshotPath(item.path);
    const size = boundedInteger(item.size, REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFileBytes, "manifest file size");
    if (typeof item.sha256 !== "string" || !SHA256_PATTERN.test(item.sha256)) {
      throw new Error("Repository snapshot manifest file digest is invalid.");
    }
    return { path: item.path, size, sha256: item.sha256 };
  });
  return {
    schemaVersion: 1,
    format: REPOSITORY_SNAPSHOT_FORMAT,
    canonicalRepositoryUrl: value.canonicalRepositoryUrl,
    defaultBranch: value.defaultBranch,
    resolvedCommitSha: value.resolvedCommitSha,
    files,
    skipCounts: parseSkipCounts(value.skipCounts),
    contentDigest: value.contentDigest,
  };
}

function assertNoPathConflict(pathValue: string, leaves: Set<string>, directories: Set<string>): void {
  if (leaves.has(pathValue)) throw new Error("Repository snapshot contains a duplicate normalized path.");
  if (directories.has(pathValue)) throw new Error("Repository snapshot contains a file path that shadows descendant entries.");
  const segments = pathValue.split("/");
  let prefix = "";
  for (let index = 0; index < segments.length - 1; index += 1) {
    prefix = prefix ? `${prefix}/${segments[index]}` : segments[index]!;
    if (leaves.has(prefix)) throw new Error("Repository snapshot contains a file path that shadows descendant entries.");
    directories.add(prefix);
  }
  leaves.add(pathValue);
}

async function verifyArtifact(input: {
  artifactPath: string;
  expectedBytes: number;
  expectedDigest: string;
  signal: AbortSignal;
}): Promise<void> {
  if (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 1 || input.expectedBytes > REPOSITORY_SNAPSHOT_LIMITS.maxArtifactBytes) {
    throw new Error("Repository snapshot expected artifact byte count is invalid.");
  }
  if (!SHA256_PATTERN.test(input.expectedDigest)) throw new Error("Repository snapshot expected artifact digest is invalid.");
  const metadata = await lstat(input.artifactPath);
  if (!metadata.isFile() || metadata.size !== input.expectedBytes) {
    throw new Error("Repository snapshot artifact byte count does not match published provenance.");
  }
  const hash = createHash("sha256");
  let observed = 0;
  for await (const raw of createReadStream(input.artifactPath, { highWaterMark: 64 * 1024 })) {
    if (input.signal.aborted) throw new DOMException("Repository snapshot materialization was aborted.", "AbortError");
    const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
    observed += bytes.length;
    if (observed > input.expectedBytes) throw new Error("Repository snapshot artifact exceeds the published byte count.");
    hash.update(bytes);
  }
  if (observed !== input.expectedBytes) throw new Error("Repository snapshot artifact is truncated.");
  if (hash.digest("hex") !== input.expectedDigest) throw new Error("Repository snapshot artifact digest does not match published provenance.");
}

export async function materializeRepositorySnapshotBundle(input: {
  artifactPath: string;
  workDirectory: string;
  expected: RepositorySnapshotReadExpectation;
  signal: AbortSignal;
}): Promise<MaterializedRepositorySnapshot> {
  if (input.signal.aborted) throw new DOMException("Repository snapshot materialization was aborted.", "AbortError");
  await verifyArtifact({
    artifactPath: input.artifactPath,
    expectedBytes: input.expected.storedArtifactBytes,
    expectedDigest: input.expected.artifactDigest,
    signal: input.signal,
  });
  const sourceDirectory = path.join(input.workDirectory, "materialized-source");
  await mkdir(sourceDirectory, { recursive: false, mode: 0o700 });
  const archive = createReadStream(input.artifactPath, { highWaterMark: 64 * 1024 });
  const gunzip = createGunzip();
  archive.on("error", (error) => gunzip.destroy(error));
  archive.pipe(gunzip);
  const reader = new AsyncByteReader(gunzip, input.signal);
  const leaves = new Set<string>();
  const directories = new Set<string>();
  const actualFiles: ScratchRepositoryFile[] = [];
  let retainedBytes = 0;
  let manifest: RepositorySnapshotManifest | null = null;
  let pendingPax: { path: string; digest: string } | null = null;
  let entryCount = 0;

  try {
    while (true) {
      const block = await reader.readExact(BLOCK_SIZE);
      if (isZeroBlock(block)) {
        const second = await reader.readExact(BLOCK_SIZE);
        if (!isZeroBlock(second)) throw new Error("Repository snapshot tar stream has only one zero end block.");
        await drainEnd(reader);
        break;
      }
      if (manifest !== null) throw new Error("Repository snapshot manifest must be the final logical file.");
      entryCount += 1;
      if (entryCount > REPOSITORY_SNAPSHOT_LIMITS.maxEntries) throw new Error("Repository snapshot exceeds the entry-count safety bound.");
      const header = parseHeader(block);

      if (header.type === "x") {
        if (pendingPax !== null || header.size < 1 || header.size > REPOSITORY_SNAPSHOT_LIMITS.maxPaxBytes) {
          throw new Error("Repository snapshot contains invalid PAX metadata.");
        }
        const headerPath = normalizeTarPath(header.path, false);
        const match = /^PaxHeaders\/([a-f0-9]{64})$/.exec(headerPath);
        if (!match) throw new Error("Repository snapshot contains unreviewed PAX metadata.");
        const body = await reader.readExact(header.size);
        await consumePadding(reader, header.size);
        const logicalPath = parsePaxPath(body);
        assertRepositorySnapshotPath(logicalPath);
        const digest = createHash("sha256").update(logicalPath, "utf8").digest("hex");
        if (digest !== match[1]) throw new Error("Repository snapshot PAX path digest is invalid.");
        pendingPax = { path: logicalPath, digest };
        continue;
      }

      if (header.type !== "0") throw new Error("Repository snapshot contains an unsupported non-regular entry type.");
      const headerPath = normalizeTarPath(header.path, false);
      let logicalPath = headerPath;
      if (pendingPax !== null) {
        if (headerPath !== `PaxFiles/${pendingPax.digest}`) {
          throw new Error("Repository snapshot PAX file header does not match its path metadata.");
        }
        logicalPath = pendingPax.path;
        pendingPax = null;
      }

      if (logicalPath === REPOSITORY_SNAPSHOT_MANIFEST_PATH) {
        if (header.size < 2 || header.size > MAX_MANIFEST_BYTES) throw new Error("Repository snapshot manifest exceeds its safety bound.");
        const manifestBytes = await reader.readExact(header.size);
        await consumePadding(reader, header.size);
        let parsed: unknown;
        try {
          parsed = JSON.parse(manifestBytes.toString("utf8"));
        } catch {
          throw new Error("Repository snapshot manifest is not valid JSON.");
        }
        manifest = parseManifest(parsed);
        const rebuilt = buildRepositorySnapshotManifest({
          files: actualFiles,
          source: {
            canonicalRepositoryUrl: manifest.canonicalRepositoryUrl,
            defaultBranch: manifest.defaultBranch,
            resolvedCommitSha: manifest.resolvedCommitSha,
          },
          skipCounts: manifest.skipCounts,
        });
        if (!rebuilt.bytes.equals(manifestBytes)) {
          throw new Error("Repository snapshot manifest is not canonical or does not match materialized file provenance.");
        }
        continue;
      }

      assertRepositorySnapshotPath(logicalPath);
      assertNoPathConflict(logicalPath, leaves, directories);
      if (actualFiles.length >= REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFiles) {
        throw new Error("Repository snapshot exceeds the retained-file safety bound.");
      }
      if (header.size > REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFileBytes) {
        throw new Error("Repository snapshot file exceeds the retained-file size bound.");
      }
      retainedBytes += header.size;
      if (retainedBytes > REPOSITORY_SNAPSHOT_LIMITS.maxRetainedBytes) {
        throw new Error("Repository snapshot exceeds the retained-byte safety bound.");
      }
      const bytes = await reader.readExact(header.size);
      await consumePadding(reader, header.size);
      const fileDigest = createHash("sha256").update(bytes).digest("hex");
      const destination = path.join(sourceDirectory, ...logicalPath.split("/"));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
      actualFiles.push({ path: logicalPath, scratchPath: destination, size: header.size, sha256: fileDigest });
    }

    if (pendingPax !== null) throw new Error("Repository snapshot ended with unapplied PAX metadata.");
    if (manifest === null) throw new Error("Repository snapshot manifest is missing.");
    if (manifest.canonicalRepositoryUrl !== input.expected.canonicalRepositoryUrl
        || manifest.resolvedCommitSha !== input.expected.resolvedCommitSha
        || manifest.contentDigest !== input.expected.contentDigest) {
      throw new Error("Repository snapshot manifest identity does not match the selected snapshot.");
    }
    if (manifest.files.length !== input.expected.retainedFileCount
        || actualFiles.length !== input.expected.retainedFileCount
        || retainedBytes !== input.expected.retainedBytes) {
      throw new Error("Repository snapshot retained-file provenance does not match the selected snapshot.");
    }
    const manifestFiles = manifest.files;
    const sortedActual = [...actualFiles].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    if (manifestFiles.length !== sortedActual.length || manifestFiles.some((file, index) => {
      const actual = sortedActual[index]!;
      return file.path !== actual.path || file.size !== actual.size || file.sha256 !== actual.sha256;
    })) {
      throw new Error("Repository snapshot manifest file set does not match materialized files.");
    }

    for (const file of actualFiles) await chmod(file.scratchPath, 0o444);
    const sortedDirectories = [...directories].sort((a, b) => b.split("/").length - a.split("/").length);
    for (const directory of sortedDirectories) await chmod(path.join(sourceDirectory, ...directory.split("/")), 0o555);
    await chmod(sourceDirectory, 0o555);
    return Object.freeze({ sourceDirectory, manifest });
  } catch (error) {
    await removeMaterializedRepositorySnapshot(sourceDirectory);
    throw error;
  } finally {
    archive.destroy();
    gunzip.destroy();
  }
}
