import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createScaScanner } from "@/packages/scanner-sca/scanner";

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("SCA security regressions", () => {
  it("sends only normalized dependency identity to OSV and never repository source text", async () => {
    const root = await mkdtemp(join(tmpdir(), "scopeforge-sca-source-boundary-"));
    tempPaths.push(root);
    const sentinel = "SOURCE_ONLY_SCOPEFORGE_SENTINEL_7f89d2";

    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { dependencies: { lodash: "4.17.20" } },
          "node_modules/lodash": { version: "4.17.20" }
        }
      })
    );
    await writeFile(
      join(root, "app.ts"),
      `const secret = "${sentinel}";\nconst fake = '"node_modules/not-a-real-dependency": { "version": "9.9.9" }';\n`
    );

    const inventory = await buildRepositoryInventory(root);
    const requests: Array<{ url: string; body?: string }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const body = typeof init?.body === "string" ? init.body : undefined;
      requests.push({ url, ...(body === undefined ? {} : { body }) });

      if (url.endsWith("/querybatch")) {
        return new Response(JSON.stringify({ results: [{ vulns: [{ id: "GHSA-test" }] }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: "GHSA-test",
          aliases: [],
          summary: "Test advisory",
          affected: [],
          references: []
        }),
        { status: 200 }
      );
    };

    const result = await createScaScanner({ osv: { enabled: true, fetchImpl } }).scan({ root, inventory });

    expect(result.errors).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(requests).toHaveLength(2);

    const queryRequest = requests.find((request) => request.url.endsWith("/querybatch"));
    expect(queryRequest?.body).toBeDefined();
    expect(JSON.parse(queryRequest?.body ?? "null")).toEqual({
      queries: [{ package: { ecosystem: "npm", name: "lodash" }, version: "4.17.20" }]
    });

    const transcript = requests.map((request) => `${request.url}\n${request.body ?? ""}`).join("\n");
    expect(transcript).not.toContain(sentinel);
    expect(transcript).not.toContain("not-a-real-dependency");
    expect(transcript).not.toContain("9.9.9");
  });
});
