import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const UNSUPPORTED_SYMLINK_CODES = new Set(["EACCES", "ENOTSUP", "EPERM"]);

function detectSymlinkSupport(): boolean {
  const root = mkdtempSync(join(tmpdir(), "scopeforge-symlink-capability-"));

  try {
    const fileTarget = join(root, "target.txt");
    const directoryTarget = join(root, "target-directory");
    writeFileSync(fileTarget, "probe\n");
    mkdirSync(directoryTarget);
    symlinkSync(fileTarget, join(root, "file-link"), "file");
    symlinkSync(directoryTarget, join(root, "directory-link"), "dir");
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && UNSUPPORTED_SYMLINK_CODES.has(code)) return false;
    throw error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** True only when this host can create both file and directory symlinks. */
export const symlinkTestsSupported = detectSymlinkSupport();
