import { describe, expect, it } from "vitest";
import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";
import * as snapshotRuntime from "@/lib/repository-snapshots/runtime";

const privateCapability = serverCapabilityEnabled as unknown as (
  name: string,
  env?: Readonly<Record<string, string | undefined>>,
) => boolean;

describe("Phase 10A2 private repository runtime capability", () => {
  it("recognizes the private snapshot capability with strict exact-true semantics", () => {
    const name = "HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED";
    expect(privateCapability(name, {})).toBe(false);
    expect(privateCapability(name, { [name]: "" })).toBe(false);
    expect(privateCapability(name, { [name]: "TRUE" })).toBe(false);
    expect(privateCapability(name, { [name]: "1" })).toBe(false);
    expect(privateCapability(name, { [name]: " true " })).toBe(false);
    expect(privateCapability(name, { [name]: "true" })).toBe(true);
  });

  it("exports a server-only private snapshot runtime gate", () => {
    expect(
      (snapshotRuntime as Record<string, unknown>)
        .HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    ).toBe(false);
  });
});
