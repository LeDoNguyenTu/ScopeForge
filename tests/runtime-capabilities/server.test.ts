import { describe, expect, it } from "vitest";
import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";

describe("serverCapabilityEnabled", () => {
  it("enables only an exact true value", () => {
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED", {
      HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED: "true",
    })).toBe(true);
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED", {
      HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED: "TRUE",
    })).toBe(false);
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED", {
      HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED: "1",
    })).toBe(false);
  });

  it("defaults missing capability values to disabled", () => {
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED", {})).toBe(false);
  });

  it("does not trim or coerce capability values", () => {
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED", {
      HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED: " true ",
    })).toBe(false);
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED", {
      HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED: "yes",
    })).toBe(false);
  });
});
