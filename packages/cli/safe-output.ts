import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export class UnsafeOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOutputError";
  }
}

export interface WriteScanOutputOptions {
  requireWithinRoot?: boolean;
}

function isContained(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))
  );
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export async function writeScanOutput(
  root: string,
  outputPath: string,
  content: string,
  options: WriteScanOutputOptions = {}
): Promise<string> {
  const scanRoot = resolve(root);
  const destination = isAbsolute(outputPath) ? resolve(outputPath) : resolve(scanRoot, outputPath);

  if (options.requireWithinRoot && !isContained(scanRoot, destination)) {
    throw new UnsafeOutputError("Configured output path must remain inside the scan root.");
  }

  const parent = dirname(destination);
  let realParent: string;
  let realRoot: string;
  try {
    [realParent, realRoot] = await Promise.all([realpath(parent), realpath(scanRoot)]);
  } catch {
    throw new UnsafeOutputError("Scan output parent directory must already exist and be safely resolvable.");
  }

  if (options.requireWithinRoot && !isContained(realRoot, realParent)) {
    throw new UnsafeOutputError("Configured output parent resolves outside the scan root.");
  }

  try {
    const existing = await lstat(destination);
    if (existing.isSymbolicLink()) {
      throw new UnsafeOutputError("Refusing to write scan output through a symlink.");
    }
    if (!existing.isFile()) {
      throw new UnsafeOutputError("Scan output destination must be a regular file when it already exists.");
    }
  } catch (error) {
    if (error instanceof UnsafeOutputError) throw error;
    if (nodeErrorCode(error) !== "ENOENT") {
      throw new UnsafeOutputError("Scan output destination could not be inspected safely.");
    }
  }

  const noFollow = (constants as typeof constants & { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
  let handle;
  try {
    handle = await open(
      destination,
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow,
      0o600
    );
  } catch (error) {
    if (nodeErrorCode(error) === "ELOOP") {
      throw new UnsafeOutputError("Refusing to write scan output through a symlink.");
    }
    throw new UnsafeOutputError("Scan output destination could not be opened safely.");
  }

  try {
    const opened = await handle.stat();
    if (!opened.isFile()) {
      throw new UnsafeOutputError("Opened scan output destination is not a regular file.");
    }
    await handle.writeFile(content, { encoding: "utf8" });
  } finally {
    await handle.close();
  }

  return destination;
}
