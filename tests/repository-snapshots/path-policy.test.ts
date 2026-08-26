import { describe, expect, it } from "vitest";
import {
  assertRepositorySnapshotPath,
  decodeTarPath,
  normalizeTarPath,
  stripGitHubArchiveWrapper,
} from "@/packages/repository-snapshot/path-policy";

describe("Phase 6B repository snapshot path policy", () => {
  it("accepts clean repository-relative POSIX paths", () => {
    expect(normalizeTarPath("owner-repo-sha/src/index.ts", false)).toBe("owner-repo-sha/src/index.ts");
    expect(stripGitHubArchiveWrapper("owner-repo-sha/src/index.ts", "owner-repo-sha")).toBe("src/index.ts");
    expect(assertRepositorySnapshotPath("src/index.ts")).toBe("src/index.ts");
  });

  it("rejects traversal, absolute, backslash, NUL, dot, and empty segments", () => {
    for (const path of [
      "/etc/passwd",
      "root/../escape",
      "root/./file",
      "root//file",
      "root\\file",
      "root/evil\u0000name",
    ]) {
      expect(() => normalizeTarPath(path, false)).toThrow();
    }
  });

  it("enforces wrapper binding and reserved manifest ownership", () => {
    expect(() => stripGitHubArchiveWrapper("other/file", "root")).toThrow();
    expect(() => assertRepositorySnapshotPath(".scopeforge/snapshot-manifest-v1.json")).toThrow();
    expect(() => assertRepositorySnapshotPath("a".repeat(1025))).toThrow();
    expect(assertRepositorySnapshotPath("a".repeat(1024))).toHaveLength(1024);
  });

  it("decodes tar path bytes as strict UTF-8", () => {
    expect(decodeTarPath(Buffer.from("hello/world\0\0", "utf8"))).toBe("hello/world");
    expect(() => decodeTarPath(Buffer.from([0xc3, 0x28, 0x00]))).toThrow();
  });
});
