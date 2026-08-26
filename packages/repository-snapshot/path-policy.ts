import {
  REPOSITORY_SNAPSHOT_LIMITS,
  REPOSITORY_SNAPSHOT_MANIFEST_PATH,
} from "./types";

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function decodeTarPath(bytes: Buffer): string {
  const firstNul = bytes.indexOf(0);
  const payload = firstNul === -1 ? bytes : bytes.subarray(0, firstNul);
  if (firstNul !== -1) {
    for (const byte of bytes.subarray(firstNul)) {
      if (byte !== 0) throw new Error("Tar path field contains non-NUL bytes after its terminator.");
    }
  }
  try {
    return utf8.decode(payload);
  } catch {
    throw new Error("Tar path is not valid UTF-8.");
  }
}

export function normalizeTarPath(value: string, directory: boolean): string {
  if (value.length === 0) throw new Error("Tar entry path is empty.");
  if (value.startsWith("/")) throw new Error("Absolute tar paths are not allowed.");
  if (value.includes("\\")) throw new Error("Backslashes are not allowed in tar paths.");
  if (value.includes("\u0000")) throw new Error("NUL bytes are not allowed in tar paths.");

  let normalized = value;
  if (directory && normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  if (!directory && normalized.endsWith("/")) {
    throw new Error("Regular-file tar paths cannot end with a slash.");
  }
  if (normalized.length === 0) throw new Error("Tar entry path is empty after normalization.");

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment.length === 0) throw new Error("Tar paths cannot contain empty segments.");
    if (segment === "." || segment === "..") {
      throw new Error("Tar paths cannot contain dot or traversal segments.");
    }
  }
  return segments.join("/");
}

export function stripGitHubArchiveWrapper(
  normalizedPath: string,
  wrapperRoot: string,
): string {
  if (normalizedPath === wrapperRoot) return "";
  const prefix = `${wrapperRoot}/`;
  if (!normalizedPath.startsWith(prefix)) {
    throw new Error("GitHub archive contains an entry outside its single wrapper directory.");
  }
  return normalizedPath.slice(prefix.length);
}

export function assertRepositorySnapshotPath(path: string): string {
  if (path.length === 0) throw new Error("Repository snapshot file path is empty.");
  if (normalizeTarPath(path, false) !== path) {
    throw new Error("Repository snapshot path normalization changed the path.");
  }
  if (Buffer.byteLength(path, "utf8") > REPOSITORY_SNAPSHOT_LIMITS.maxPathBytes) {
    throw new Error("Repository snapshot path exceeds the UTF-8 byte limit.");
  }
  if (path === REPOSITORY_SNAPSHOT_MANIFEST_PATH) {
    throw new Error("Repository content conflicts with the reserved ScopeForge manifest path.");
  }
  return path;
}
