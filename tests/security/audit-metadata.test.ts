import { describe, expect, it } from "vitest";
import { assertSafeAuditMetadata } from "@/lib/audit/write-audit-event";

const forbiddenKeys = [
  "accessToken",
  "refresh_token",
  "captchaToken",
  "serviceRoleKey",
  "apiKey",
  "workerCredential",
  "leaseToken",
  "password",
  "cookie",
  "authorization",
  "requestBody",
  "responseBody",
  "source",
  "sourceCode",
  "stdout",
  "stderr",
  "environment",
  "headers",
  "privateKey",
] as const;

describe("audit metadata safety", () => {
  it.each(forbiddenKeys)("rejects sensitive metadata key %s recursively", (key) => {
    expect(() => assertSafeAuditMetadata({ nested: { [key]: "must-not-be-stored" } })).toThrow(
      /Sensitive audit metadata key/,
    );
  });

  it("preserves benign source descriptors and stable reason codes", () => {
    expect(() => assertSafeAuditMetadata({ sourceType: "repository", reasonCode: "DENIED" })).not.toThrow();
  });

  it("preserves bounded controlled operational details", () => {
    expect(() => assertSafeAuditMetadata({ details: { redirectCount: 2, elapsedMs: 15 } })).not.toThrow();
  });

  it("preserves existing asset audit field shapes", () => {
    expect(() => assertSafeAuditMetadata({ kind: "web_application", hostname: "example.com" })).not.toThrow();
    expect(() => assertSafeAuditMetadata({ method: "http_well_known", expires_at: "2026-09-09T00:00:00.000Z" })).not.toThrow();
  });
});
