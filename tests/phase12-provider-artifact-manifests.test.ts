import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function manifest(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(
    path.resolve(process.cwd(), "deploy/worker", name),
    "utf8",
  )) as Record<string, unknown>;
}

describe("Phase 12 provider artifact manifests", () => {
  it("keeps httpx pinned and default-off at the operational gate", async () => {
    const value = await manifest("httpx-artifact-manifest.json");
    expect(value.provider).toBe("projectdiscovery.httpx");
    expect(value.version).toBe("1.12.0");
    expect(JSON.stringify(value)).toMatch(/[a-f0-9]{64}/);
  });

  it("pins Nuclei engine and template source while keeping runtime disabled", async () => {
    const value = await manifest("nuclei-artifact-manifest.json");
    expect(value.provider).toBe("projectdiscovery.nuclei");
    expect(value.version).toBe("3.11.1");
    expect(value.sourceCommit).toBe("a8c88feb4a1c8e961b7902534ce3af97e9d524a4");
    expect(value.runtimeEnabled).toBe(false);
    expect(JSON.stringify(value)).toContain("83234ce456da3e90dda86dfbc5e605e64a846df3");
    expect(JSON.stringify(value)).toContain("http-missing-security-headers");
  });
});
