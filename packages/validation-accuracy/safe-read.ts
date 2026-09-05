import { constants, type BigIntStats } from "node:fs";
import { open } from "node:fs/promises";

import { VALIDATION_ACCURACY_LIMITS, type ValidationAccuracyErrorCode } from "./contracts";
import { ValidationAccuracyError } from "./error";

function fail(code: ValidationAccuracyErrorCode, message: string): never {
  throw new ValidationAccuracyError(code, message);
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mode === right.mode
  );
}

async function readVerifiedFile(
  path: string,
  expected: BigIntStats,
  maximumBytes: number,
  invalidCode: ValidationAccuracyErrorCode,
): Promise<Buffer> {
  if (!expected.isFile() || expected.isSymbolicLink() || expected.nlink !== BigInt(1)) {
    return fail(invalidCode, "Validation file must be a unique regular file.");
  }
  if (expected.size > BigInt(maximumBytes)) {
    return fail("VALIDATION_BUDGET_EXCEEDED", "Validation file exceeds its fixed byte limit.");
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch {
    return fail(invalidCode, "Validation file could not be opened safely.");
  }

  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameIdentity(expected, opened) || !opened.isFile() || opened.nlink !== BigInt(1)) {
      return fail(invalidCode, "Validation file identity changed before reading.");
    }

    const buffer = Buffer.alloc(maximumBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maximumBytes) {
      return fail("VALIDATION_BUDGET_EXCEEDED", "Validation file exceeds its fixed byte limit.");
    }

    const after = await handle.stat({ bigint: true });
    if (!sameIdentity(opened, after) || after.nlink !== BigInt(1) || after.size !== BigInt(offset)) {
      return fail(invalidCode, "Validation file identity changed while reading.");
    }
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

export async function readVerifiedValidationManifest(
  path: string,
  expected: BigIntStats,
  invalidCode: ValidationAccuracyErrorCode,
): Promise<Buffer> {
  if (expected.size > BigInt(VALIDATION_ACCURACY_LIMITS.manifestBytes)) {
    throw new ValidationAccuracyError(
      "VALIDATION_MANIFEST_TOO_LARGE",
      "Validation manifest exceeds the fixed byte limit.",
    );
  }
  return readVerifiedFile(path, expected, VALIDATION_ACCURACY_LIMITS.manifestBytes, invalidCode);
}

export async function readVerifiedValidationRepositoryFile(
  path: string,
  expected: BigIntStats,
): Promise<Buffer> {
  return readVerifiedFile(
    path,
    expected,
    VALIDATION_ACCURACY_LIMITS.repositoryFileBytes,
    "VALIDATION_REPOSITORY_UNSAFE",
  );
}
