import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SECURITY_PACK_LIMITS,
  assertSecurityPackCompatibility,
  loadSecurityPackManifest,
} from "@/packages/security-packs";
import { readVerifiedManifestBytes } from "@/packages/security-packs/parse";

const temporaryRoots: string[] = [];

function validRule() {
  return {
    id: "config/safe-rule",
    version: "1.0.0",
    kind: "static_literal_v1",
    title: "Safe rule",
    summary: "Detects one unsafe configuration literal.",
    description: "Explains why the static configuration is unsafe.",
    severity: "high",
    confidence: "high",
    category: "configuration",
    mappings: {
      cwe: ["CWE-295"],
      owasp: ["A02:2021"],
      attack: ["T1557.001"],
      nistCsf: ["PR.DS-2"],
    },
    explanations: {
      plain: "Plain explanation.",
      developer: "Developer explanation.",
      security: "Security explanation.",
    },
    remediation: {
      summary: "Restore the safe setting.",
      guidance: "Remove the unsafe literal.",
      verification: "Rescan and verify it is absent.",
    },
    preparedness: ["Review affected configuration."],
    falsePositiveNotes: ["Reviewed test fixtures may be excluded."],
    matcher: {
      include: ["**/Dockerfile"],
      exclude: ["**/fixtures/**"],
      mode: "any",
      literals: ["UNSAFE_SETTING=1"],
      absentLiterals: ["scopeforge-reviewed-test-only"],
      caseSensitive: true,
    },
  };
}

function validManifest() {
  return {
    schemaVersion: 1,
    packId: "org.scopeforge.example",
    version: "1.0.0",
    name: "ScopeForge Example Pack",
    summary: "A safe local-only example Security Pack.",
    license: "Apache-2.0",
    repository: "https://github.com/scopeforge/example-pack",
    maintainers: ["scopeforge-maintainer"],
    safety: "static",
    minimumScopeForgeVersion: "0.1.0",
    rules: [validRule()],
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-pack-test-"));
  temporaryRoots.push(root);
  return root;
}

async function loadRawPack(
  contents: string | Uint8Array,
  suppliedRoot?: string,
) {
  const root = suppliedRoot ?? await tempRoot();
  await writeFile(join(root, "scopeforge-pack.json"), contents);
  return loadSecurityPackManifest(root);
}

async function packWith(patch: Record<string, unknown>): Promise<string> {
  const root = await tempRoot();
  await writeFile(
    join(root, "scopeforge-pack.json"),
    JSON.stringify({ ...validManifest(), ...patch }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("Security Pack manifest parser", () => {
  it("loads one exact v1 manifest and recursively freezes the trusted clone", async () => {
    const input = validManifest();
    const root = await packWith(input);
    const loaded = await loadSecurityPackManifest(root);

    expect(loaded.manifest.packId).toBe("org.scopeforge.example");
    expect(loaded.packDirectory).toBe(root);
    expect(loaded.manifest).not.toBe(input);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.manifest)).toBe(true);
    expect(Object.isFrozen(loaded.manifest.rules)).toBe(true);
    expect(Object.isFrozen(loaded.manifest.rules[0]!.matcher.literals)).toBe(true);
    expect(Object.isFrozen(loaded.manifest.rules[0]!.remediation)).toBe(true);
  });

  it.each([
    ["unknown top-level field", { extra: true }, "PACK_MANIFEST_INVALID"],
    ["active safety", { safety: "active" }, "PACK_MANIFEST_INVALID"],
    ["prerelease version", { version: "1.0.0-beta.1" }, "PACK_IDENTITY_INVALID"],
    ["credential URL", { repository: "https://user:pass@github.com/a/b" }, "PACK_IDENTITY_INVALID"],
    ["non-GitHub URL", { repository: "https://example.com/a/b" }, "PACK_IDENTITY_INVALID"],
    ["invalid maintainer", { maintainers: ["bad handle!"] }, "PACK_IDENTITY_INVALID"],
  ])("rejects %s without reflecting hostile values", async (_label, patch, code) => {
    const root = await packWith(patch as Record<string, unknown>);
    const rejection = await loadSecurityPackManifest(root).catch((error: unknown) => error);

    expect(rejection).toMatchObject({ code });
    expect((rejection as Error).message).not.toContain(root);
    for (const value of Object.values(patch as Record<string, unknown>)) {
      if (typeof value === "string") {
        expect((rejection as Error).message).not.toContain(value);
      }
    }
  });

  it("rejects unknown nested fields and invalid closed enums or mappings", async () => {
    const cases = [
      { ...validRule(), extra: true },
      { ...validRule(), severity: "urgent" },
      { ...validRule(), confidence: "certain" },
      { ...validRule(), kind: "javascript_v1" },
      { ...validRule(), mappings: { ...validRule().mappings, cwe: ["295"] } },
      { ...validRule(), explanations: { ...validRule().explanations, extra: "no" } },
      { ...validRule(), remediation: { ...validRule().remediation, extra: "no" } },
      { ...validRule(), matcher: { ...validRule().matcher, extra: "no" } },
    ];

    for (const rule of cases) {
      await expect(loadSecurityPackManifest(await packWith({ rules: [rule] })))
        .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
    }
  });

  it("rejects duplicate JSON keys, comments, aliases, controls, and bidi text", async () => {
    await expect(loadRawPack('{"schemaVersion":1,"schemaVersion":1}'))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
    await expect(loadRawPack('{"schemaVersion":1 // comment\n}'))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
    await expect(loadRawPack('schemaVersion: &version 1\ncopy: *version'))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
    await expect(loadRawPack(JSON.stringify(validManifest()).replace("Safe rule", "Safe\\u202erule")))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
    await expect(loadSecurityPackManifest(await packWith({ name: "unsafe\u0000name" })))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
    await expect(loadRawPack(JSON.stringify(validManifest()).replace("Safe rule", "Safe\\ud800rule")))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
  });

  it("normalizes human guidance line endings without changing literal bytes", async () => {
    const rule = validRule();
    rule.description = "First line.\r\nSecond line.";
    rule.matcher.literals = ["FIRST\r\nSECOND"];
    const loaded = await loadSecurityPackManifest(await packWith({ rules: [rule] }));

    expect(loaded.manifest.rules[0]!.description).toBe("First line.\nSecond line.");
    expect(loaded.manifest.rules[0]!.matcher.literals[0]).toBe("FIRST\r\nSECOND");
  });

  it("rejects a non-UTF-8 manifest", async () => {
    await expect(loadRawPack(Uint8Array.from([0xc3, 0x28])))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
  });

  it("rejects input beyond the manifest byte ceiling", async () => {
    await expect(loadRawPack(" ".repeat(SECURITY_PACK_LIMITS.manifestBytes + 1)))
      .rejects.toMatchObject({ code: "PACK_MANIFEST_TOO_LARGE" });
  });

  it("enforces behavioral rule, matcher, literal, and guidance ceilings", async () => {
    const oneHundredRules = Array.from({ length: 100 }, (_, index) => ({
      ...validRule(),
      id: `config/rule-${index}`,
    }));
    await expect(loadSecurityPackManifest(await packWith({ rules: oneHundredRules })))
      .resolves.toMatchObject({ manifest: { rules: expect.any(Array) } });
    await expect(loadSecurityPackManifest(await packWith({
      rules: [...oneHundredRules, { ...validRule(), id: "config/rule-over-budget" }],
    }))).rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED", field: "rules" });

    const matcher = validRule().matcher;
    const sixteen = Array.from({ length: 16 }, (_, index) => `LITERAL_${index}`);
    await expect(loadSecurityPackManifest(await packWith({
      rules: [{ ...validRule(), matcher: { ...matcher, literals: sixteen } }],
    }))).resolves.toBeDefined();
    await expect(loadSecurityPackManifest(await packWith({
      rules: [{ ...validRule(), matcher: { ...matcher, literals: [...sixteen, "OVER"] } }],
    }))).rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED", field: "rules[0].matcher.literals" });

    await expect(loadSecurityPackManifest(await packWith({
      rules: [{ ...validRule(), matcher: { ...matcher, literals: ["x".repeat(256)] } }],
    }))).resolves.toBeDefined();
    await expect(loadSecurityPackManifest(await packWith({
      rules: [{ ...validRule(), matcher: { ...matcher, literals: ["x".repeat(257)] } }],
    }))).rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED", field: "rules[0].matcher.literals[0]" });

    await expect(loadSecurityPackManifest(await packWith({ summary: "x".repeat(8 * 1024) })))
      .resolves.toBeDefined();
    await expect(loadSecurityPackManifest(await packWith({ summary: "x".repeat(8 * 1024 + 1) })))
      .rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED", field: "summary" });
  });

  it("rejects duplicate rule IDs within one pack", async () => {
    await expect(loadSecurityPackManifest(await packWith({
      rules: [validRule(), { ...validRule(), title: "Another title" }],
    }))).rejects.toMatchObject({ code: "PACK_DUPLICATE_RULE", field: "rules[1].id" });
  });

  it("compares strict semantic versions as numeric tuples", async () => {
    const loaded = await loadSecurityPackManifest(
      await packWith({ minimumScopeForgeVersion: "2.0.0" }),
    );

    expect(() => assertSecurityPackCompatibility(loaded.manifest, "10.0.0")).not.toThrow();
    expect(() => assertSecurityPackCompatibility(loaded.manifest, "1.99.99"))
      .toThrowError(expect.objectContaining({ code: "PACK_IDENTITY_INVALID" }));
    expect(() => assertSecurityPackCompatibility(loaded.manifest, "1.0.0-beta.1"))
      .toThrowError(expect.objectContaining({ code: "PACK_IDENTITY_INVALID" }));
  });

  it("rejects a directory in place of the manifest", async () => {
    const directoryManifestRoot = await tempRoot();
    await mkdir(join(directoryManifestRoot, "scopeforge-pack.json"));
    await expect(loadSecurityPackManifest(directoryManifestRoot))
      .rejects.toMatchObject({ code: "PACK_PATH_INVALID" });
  });

  it("rejects a hard-linked manifest", async () => {
    const hardLinkRoot = await tempRoot();
    const hardLinkManifest = join(hardLinkRoot, "scopeforge-pack.json");
    await writeFile(hardLinkManifest, JSON.stringify(validManifest()));
    await link(hardLinkManifest, join(hardLinkRoot, "manifest-copy.json"));
    await expect(loadSecurityPackManifest(hardLinkRoot))
      .rejects.toMatchObject({ code: "PACK_PATH_INVALID" });
  });

  it("rejects a symlinked pack root when the platform permits creating it", async () => {
    const targetRoot = await tempRoot();
    await writeFile(join(targetRoot, "scopeforge-pack.json"), JSON.stringify(validManifest()));
    const rootLink = join(dirname(targetRoot), `${targetRoot.split(/[\\/]/).at(-1)}-link`);
    try {
      await symlink(targetRoot, rootLink, process.platform === "win32" ? "junction" : "dir");
      temporaryRoots.push(rootLink);
      await expect(loadSecurityPackManifest(rootLink))
        .rejects.toMatchObject({ code: "PACK_PATH_INVALID" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "ENOTSUP") throw error;
    }
  });

  it("rejects a symlinked manifest when the platform permits creating it", async () => {
    const manifestLinkRoot = await tempRoot();
    const outsideManifest = join(await tempRoot(), "outside.json");
    await writeFile(outsideManifest, JSON.stringify(validManifest()));
    try {
      await symlink(outsideManifest, join(manifestLinkRoot, "scopeforge-pack.json"), "file");
      await expect(loadSecurityPackManifest(manifestLinkRoot))
        .rejects.toMatchObject({ code: "PACK_PATH_INVALID" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "ENOTSUP") throw error;
    }
  });

  it("rejects a manifest replaced between validation and verified read", async () => {
    const root = await tempRoot();
    const manifestPath = join(root, "scopeforge-pack.json");
    const replacementPath = join(root, "replacement.json");
    await writeFile(manifestPath, JSON.stringify(validManifest()));
    await writeFile(
      replacementPath,
      JSON.stringify({ ...validManifest(), packId: "org.scopeforge.replacement" }),
    );
    const validatedStat = await lstat(manifestPath);
    await rename(manifestPath, join(root, "original.json"));
    await rename(replacementPath, manifestPath);

    await expect(readVerifiedManifestBytes(
      manifestPath,
      root,
      validatedStat,
      SECURITY_PACK_LIMITS.manifestBytes,
    )).rejects.toMatchObject({ code: "PACK_PATH_INVALID" });
  });
});
