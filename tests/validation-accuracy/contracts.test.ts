import { describe, expect, it } from "vitest";

import {
  VALIDATION_ACCURACY_LIMITS,
  ValidationAccuracyError,
} from "@/packages/validation-accuracy";

describe("Phase 8A validation contracts", () => {
  it("locks v1 limits and stable error identity", () => {
    expect(VALIDATION_ACCURACY_LIMITS).toEqual({
      manifestBytes: 64 * 1024,
      corpusCases: 256,
      expectedFilesPerPositiveCase: 16,
      rationaleBytes: 4 * 1024,
      notesBytes: 4 * 1024,
      diagnosticBytes: 512,
      repositoryFilesPerCase: 128,
      repositoryFileBytes: 2 * 1024 * 1024,
      repositoryBytesPerCase: 8 * 1024 * 1024,
    });

    expect(new ValidationAccuracyError("VALIDATION_CORPUS_INVALID", "Corpus is invalid."))
      .toMatchObject({
        name: "ValidationAccuracyError",
        code: "VALIDATION_CORPUS_INVALID",
      });
  });
});
