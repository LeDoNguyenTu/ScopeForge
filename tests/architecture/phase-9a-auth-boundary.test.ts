import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const callbackPath = "app/auth/callback/route.ts";
const confirmPath = "app/auth/confirm/route.ts";
const formPath = "components/AuthForm.tsx";

describe("Phase 9A auth boundary architecture", () => {
  it.each([callbackPath, confirmPath])(
    "uses the shared safe return-path helper in %s",
    async (path) => {
      const source = await readFile(path, "utf8");
      expect(source).toContain("safeAuthReturnPath");
      expect(source).not.toMatch(
        /const next = url\.searchParams\.get\(["']next["']\) \|\|/
      );
    }
  );

  it("does not render raw auth provider messages", async () => {
    const source = await readFile(formPath, "utf8");
    expect(source).toContain("authErrorMessage(error, mode)");
    expect(source).not.toContain("error instanceof Error ? error.message");
  });

  it("keeps Phase 9A out of the Dashboard V5 layout boundary", async () => {
    const source = await readFile(formPath, "utf8");
    expect(source).not.toContain("command-center-v5");
  });
});
