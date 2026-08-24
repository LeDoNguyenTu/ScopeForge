import { describe, expect, it } from "vitest";
import { buildAdvisoryContext } from "@/packages/security-domain";

const items = [
  { id: "1", kind: "finding", summary: "public", classification: "public" as const },
  { id: "2", kind: "finding", summary: "internal", classification: "internal" as const },
  { id: "3", kind: "finding", summary: "sensitive", classification: "sensitive" as const },
  { id: "4", kind: "finding", summary: "never-send", classification: "secret" as const },
];

describe("advisory context policy", () => {
  it("always drops secret-classified context", () => {
    const result = buildAdvisoryContext(items, {
      execution: "local",
      allowSensitiveRemote: false,
      maxItems: 10,
      maxCharacters: 1000,
    });

    expect(result.map((item) => item.summary)).toEqual(["public", "internal", "sensitive"]);
  });

  it("requires explicit opt-in before sensitive context can reach a remote provider", () => {
    const result = buildAdvisoryContext(items, {
      execution: "remote",
      allowSensitiveRemote: false,
      maxItems: 10,
      maxCharacters: 1000,
    });

    expect(result.map((item) => item.summary)).toEqual(["public", "internal"]);
  });

  it("permits sensitive remote context only when explicitly allowed", () => {
    const result = buildAdvisoryContext(items, {
      execution: "remote",
      allowSensitiveRemote: true,
      maxItems: 10,
      maxCharacters: 1000,
    });

    expect(result.map((item) => item.summary)).toEqual(["public", "internal", "sensitive"]);
  });

  it("applies item and character budgets deterministically", () => {
    const result = buildAdvisoryContext(items, {
      execution: "local",
      allowSensitiveRemote: false,
      maxItems: 2,
      maxCharacters: 10,
    });

    expect(result).toEqual([
      { id: "1", kind: "finding", summary: "public", classification: "public" },
      { id: "2", kind: "finding", summary: "inte", classification: "internal" },
    ]);
  });
});
