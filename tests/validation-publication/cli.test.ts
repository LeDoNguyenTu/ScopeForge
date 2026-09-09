import { access, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runValidationPublicationCli } from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

function streams(cwd: string) {
  let stdout = "";
  let stderr = "";
  return {
    options: {
      cwd,
      stdout: (value: string) => { stdout += value; },
      stderr: (value: string) => { stderr += value; },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "scopeforge-publication-"));
}

async function evidenceFile(directory: string): Promise<string> {
  const path = join(directory, "evidence.json");
  await writeFile(path, `${JSON.stringify(evidenceFixture(), null, 2)}\n`, "utf8");
  return path;
}

function args(evidence: string, json: string, markdown: string): string[] {
  return ["--evidence", evidence, "--json", json, "--markdown", markdown];
}

describe("Phase 8C publication developer runner", () => {
  it.each([
    ["unknown flag", ["--wat"]],
    ["duplicate flag", ["--evidence", "a", "--evidence", "b"]],
    ["missing value", ["--evidence"]],
    ["incomplete arguments", ["--evidence", "a", "--json", "b"]],
  ])("rejects %s", async (_label, argv) => {
    const directory = await root();
    const io = streams(directory);
    const code = await runValidationPublicationCli(argv, io.options);
    expect(code).toBe(2);
    expect(io.stderr()).toContain("Technical publication error");
  });

  it("rejects symlink evidence rather than following it", async () => {
    const directory = await root();
    const target = await evidenceFile(directory);
    const alias = join(directory, "alias.json");
    await symlink(target, alias);
    const io = streams(directory);

    const code = await runValidationPublicationCli(
      args(alias, join(directory, "result.json"), join(directory, "result.md")),
      io.options,
    );
    expect(code).toBe(2);
    await expect(access(join(directory, "result.json"))).rejects.toThrow();
    await expect(access(join(directory, "result.md"))).rejects.toThrow();
  });

  it("refuses to overwrite an existing output and leaves the paired output absent", async () => {
    const directory = await root();
    const evidence = await evidenceFile(directory);
    const json = join(directory, "result.json");
    const markdown = join(directory, "result.md");
    await writeFile(json, "preserve me\n", "utf8");
    const io = streams(directory);

    expect(await runValidationPublicationCli(args(evidence, json, markdown), io.options)).toBe(2);
    expect(await readFile(json, "utf8")).toBe("preserve me\n");
    await expect(access(markdown)).rejects.toThrow();
  });

  it("rejects aliased JSON and Markdown destinations", async () => {
    const directory = await root();
    const evidence = await evidenceFile(directory);
    const same = join(directory, "result.txt");
    const io = streams(directory);

    expect(await runValidationPublicationCli(args(evidence, same, same), io.options)).toBe(2);
    await expect(access(same)).rejects.toThrow();
  });

  it("writes deterministic canonical JSON and Markdown as one safe pair", async () => {
    const directory = await root();
    const evidence = await evidenceFile(directory);
    const json = join(directory, "result.json");
    const markdown = join(directory, "result.md");
    const io = streams(directory);

    const code = await runValidationPublicationCli(args(evidence, json, markdown), io.options);
    expect(code).toBe(0);
    expect(io.stderr()).toBe("");
    expect(io.stdout()).toBe("Technical publication reports written.\n");
    expect(JSON.parse(await readFile(json, "utf8"))).toMatchObject({
      schemaVersion: 1,
      publicationId: "scopeforge-phase-8-release-v1",
    });
    expect(await readFile(markdown, "utf8")).toContain("# ScopeForge Phase 8 Technical Publication");
  });
});
