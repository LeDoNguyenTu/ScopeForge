import { describe, expect, it } from "vitest";
import * as acquisition from "@/packages/repository-acquisition-network";

describe("Phase 10A2 private acquisition package surface", () => {
  it("exports the private archive reader from the reviewed package root", () => {
    expect(
      typeof (acquisition as Record<string, unknown>).createPrivateRepositoryArchiveReader,
    ).toBe("function");
  });
});
