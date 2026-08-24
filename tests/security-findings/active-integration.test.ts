import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("active validation hosted finding integration", () => {
  it("uses the single active result RPC instead of direct ledger or observation inserts", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "lib/active-validation/repository.ts"),
      "utf8",
    );
    const persistStart = source.indexOf("async function persistResult");
    const listStart = source.indexOf("async function listObservations");
    expect(persistStart).toBeGreaterThanOrEqual(0);
    expect(listStart).toBeGreaterThan(persistStart);
    const persistResult = source.slice(persistStart, listStart);

    expect(persistResult).toContain('admin.rpc("persist_active_validation_result"');
    expect(persistResult).toContain("prepareFindingIngestionBatch");
    expect(persistResult).not.toContain('.from("runtime_observations")');
    expect(persistResult).not.toContain('.from("security_findings")');
    expect(persistResult).not.toContain('.from("security_evidence")');
  });

  it("persists the result before the success transition", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "lib/active-validation/service.ts"),
      "utf8",
    );
    const persistIndex = source.indexOf("repository.persistResult(");
    const successIndex = source.indexOf("repository.markSucceeded(");
    expect(persistIndex).toBeGreaterThanOrEqual(0);
    expect(successIndex).toBeGreaterThan(persistIndex);
  });
});
