import { describe, expect, it, vi } from "vitest";

import type { NpmDependencyComponent } from "@/packages/scanner-sca/types";
import { queryOsvDependencies } from "@/packages/scanner-sca/osv/client";

function component(name: string, version: string, sourceFile: string): NpmDependencyComponent {
  return {
    ecosystem: "npm",
    name,
    version,
    purl: `pkg:npm/${name}@${version}`,
    sourceFile,
    sourceKind: "lockfile",
    certainty: "resolved",
    direct: true,
    dependencyGroup: "runtime",
    sourceLine: 1,
    queryable: true
  };
}

describe("queryOsvDependencies", () => {
  it("batches exact npm queries, follows per-query pagination, and fetches each vulnerability detail once", async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    let batchCalls = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : undefined;
      requests.push({ url, method, ...(body ? { body } : {}) });

      if (url.endsWith("/querybatch")) {
        batchCalls += 1;
        if (batchCalls === 1) {
          return new Response(
            JSON.stringify({
              results: [
                { vulns: [{ id: "CVE-2026-0002", modified: "2026-01-02T00:00:00Z" }] },
                { vulns: [{ id: "GHSA-aaaa", modified: "2026-01-01T00:00:00Z" }], next_page_token: "page-2" }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            results: [{ vulns: [{ id: "CVE-2026-0003", modified: "2026-01-03T00:00:00Z" }] }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      const id = decodeURIComponent(url.split("/").at(-1) ?? "");
      return new Response(
        JSON.stringify({ id, aliases: id === "GHSA-aaaa" ? ["CVE-2026-0001"] : [] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const result = await queryOsvDependencies(
      [
        component("lodash", "4.17.20", "SECRET_SOURCE_SENTINEL/package-lock.json"),
        component("express", "5.1.0", "package-lock.json"),
        component("lodash", "4.17.20", "nested/package-lock.json")
      ],
      { fetchImpl }
    );

    expect(result.errors).toEqual([]);
    expect(result.matches.map((match) => ({
      package: `${match.component.name}@${match.component.version}`,
      ids: match.vulnerabilities.map((record) => record.id)
    }))).toEqual([
      { package: "express@5.1.0", ids: ["CVE-2026-0002"] },
      { package: "lodash@4.17.20", ids: ["CVE-2026-0003", "GHSA-aaaa"] },
      { package: "lodash@4.17.20", ids: ["CVE-2026-0003", "GHSA-aaaa"] }
    ]);

    const batchBodies = requests
      .filter((request) => request.url.endsWith("/querybatch"))
      .map((request) => JSON.parse(request.body ?? "{}"));
    expect(batchBodies[0]).toEqual({
      queries: [
        { package: { ecosystem: "npm", name: "express" }, version: "5.1.0" },
        { package: { ecosystem: "npm", name: "lodash" }, version: "4.17.20" }
      ]
    });
    expect(batchBodies[1]).toEqual({
      queries: [
        { package: { ecosystem: "npm", name: "lodash" }, version: "4.17.20", page_token: "page-2" }
      ]
    });
    expect(requests.filter((request) => request.method === "GET")).toHaveLength(3);
    expect(requests.map((request) => request.body ?? "").join("\n")).not.toContain("SECRET_SOURCE_SENTINEL");
  });

  it("returns a structured diagnostic for HTTP and pagination-budget failures", async () => {
    const httpFailure = await queryOsvDependencies([component("lodash", "4.17.20", "package-lock.json")], {
      fetchImpl: async () => new Response("service unavailable", { status: 503 })
    });
    expect(httpFailure.matches).toEqual([]);
    expect(httpFailure.errors[0]?.code).toBe("osv_lookup_failed");

    const paginationFailure = await queryOsvDependencies([component("lodash", "4.17.20", "package-lock.json")], {
      maxPagesPerQuery: 1,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/querybatch")) {
          return new Response(JSON.stringify({ results: [{ vulns: [], next_page_token: "again" }] }), {
            status: 200
          });
        }
        return new Response(JSON.stringify({ id: "unused" }), { status: 200 });
      }
    });
    expect(paginationFailure.matches).toEqual([]);
    expect(paginationFailure.errors[0]?.code).toBe("osv_pagination_limit");
  });
});
