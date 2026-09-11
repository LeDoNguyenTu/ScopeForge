import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

const credentialPattern = /installationToken|authorization\s*:|bearer\s+|privateKey|clientSecret|oauthToken/i;

describe("Phase 10A2 private repository acquisition architecture", () => {
  it("keeps GitHub credentials out of worker contracts, execution and snapshot publication", async () => {
    const sources = await Promise.all([
      read("packages/worker-contracts/types.ts"),
      read("packages/worker-contracts/private-repository-validation.ts"),
      read("packages/worker-supervisor/private-repository-snapshot.ts"),
      read("lib/repository-snapshots/service.ts"),
    ]);

    for (const source of sources) {
      expect(source).not.toMatch(credentialPattern);
    }
  });

  it("keeps the public GitHub acquirer fail-closed to public repositories", async () => {
    const source = await read("packages/repository-acquisition-network/github-client.ts");
    expect(source).toContain("metadata.private !== false");
    expect(source).toContain("allowed public repository response");
  });

  it("keeps the private executor away from the GitHub API control plane", async () => {
    const source = await read("packages/worker-supervisor/private-repository-snapshot.ts");
    expect(source).not.toContain("api.github.com");
    expect(source).not.toContain("createInstallationToken");
    expect(source).toContain("privateArchiveLease");
  });

  it("keeps worker claim body-free and authenticated", async () => {
    const source = await read("app/api/internal/workers/claim/route.ts");
    expect(source).toContain("assertNoWorkerRequestBody(request)");
    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain("claimWorkerTaskForNode");
  });

  it("keeps hosted repository runtime flags default-off unless explicitly true", async () => {
    const runtime = await read("lib/repository-snapshots/runtime.ts");
    const capabilities = await read("lib/runtime-capabilities/server.ts");
    expect(runtime).toContain("HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED");
    expect(capabilities).toContain('return env[name] === "true"');
  });

  it("pins privileged Phase 10A2 RPCs to explicit service-role ACLs", async () => {
    const source = await read("supabase/migrations/20260911110000_phase_10a2_connected_private_project_scans.sql");
    for (const signature of [
      "enqueue_connected_private_project_snapshot(uuid, uuid, uuid, uuid)",
      "enqueue_connected_project_scan_continuation(uuid, uuid)",
      "get_connected_project_scan_recovery(uuid, uuid, uuid, uuid)",
    ]) {
      expect(source).toContain(`revoke all on function public.${signature}`);
      expect(source).toContain(`grant execute on function public.${signature}`);
    }
    expect(source).toContain("to service_role");
  });
});
