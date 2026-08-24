import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertActiveValidationJobTransition,
  normalizeCorsPolicyObservationPayload,
} from "@/lib/active-validation/repository";
import type { CorsPolicyObservation } from "@/packages/runtime-validator";

const observation: CorsPolicyObservation = {
  kind: "cors-policy",
  url: "https://example.com/app",
  status: 200,
  allowedOrigin: "https://scopeforge.invalid",
  credentialsAllowed: true,
  variesOnOrigin: true,
};

describe("active validation repository", () => {
  it.each([
    ["queued", "running"],
    ["queued", "blocked"],
    ["queued", "cancelled"],
    ["running", "succeeded"],
    ["running", "failed"],
    ["running", "blocked"],
    ["running", "cancelled"],
  ] as const)("allows %s to %s", (current, next) => {
    expect(() => assertActiveValidationJobTransition(current, next)).not.toThrow();
  });

  it("rejects terminal-state reuse", () => {
    expect(() => assertActiveValidationJobTransition("succeeded", "running")).toThrow(/invalid active validation job transition/i);
  });

  it("persists exactly one bounded cors-policy observation without object aliasing", () => {
    const row = normalizeCorsPolicyObservationPayload(observation, 32_768);

    expect(row).toEqual({ sequence: 0, kind: "cors-policy", payload: observation });
    expect(row.payload).not.toBe(observation);
    expect(() => normalizeCorsPolicyObservationPayload({
      ...observation,
      allowedOrigin: "x".repeat(4_000),
    }, 128)).toThrow(/active observation persistence budget/i);
  });

  it("scopes every job mutation to active_validation", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "lib/active-validation/repository.ts"),
      "utf8",
    );

    expect(source).toContain('job_kind: "active_validation"');
    expect(source.match(/\.eq\("job_kind", "active_validation"\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source).toContain('kind: "cors-policy"');
  });

  it("requires the final success transition to observe no cancellation request atomically", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "lib/active-validation/repository.ts"),
      "utf8",
    );

    const markSucceeded = source.slice(
      source.indexOf("function markSucceeded"),
      source.indexOf("function markFailed"),
    );
    expect(markSucceeded).toContain('.eq("job_kind", "active_validation")');
    expect(markSucceeded).toContain('.eq("status", "running")');
    expect(markSucceeded).toContain('.is("cancel_requested_at", null)');
  });
});
