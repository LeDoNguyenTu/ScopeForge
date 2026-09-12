import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

describe("Vitest config module format", () => {
  it("keeps the Vitest config ESM-local without converting the whole package", async () => {
    const esmConfigPath = path.join(root, "vitest.config.mts");
    const legacyConfigPath = path.join(root, "vitest.config.ts");
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { type?: string };

    expect(await exists(esmConfigPath)).toBe(true);
    expect(await exists(legacyConfigPath)).toBe(false);
    expect(packageJson.type).not.toBe("module");

    const config = await readFile(esmConfigPath, "utf8");
    expect(config).not.toContain("__dirname");
  });
});
