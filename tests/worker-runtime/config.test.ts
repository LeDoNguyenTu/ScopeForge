import { describe, expect, it } from "vitest";
import { readWorkerRuntimeConfig } from "@/packages/worker-runtime/config";

const BASE = {
  SCOPEFORGE_WORKER_BASE_URL: "https://scopeforge.dev",
  SCOPEFORGE_WORKER_ID: "11111111-1111-4111-8111-111111111111",
  SCOPEFORGE_WORKER_SECRET: "a".repeat(64),
};

describe("worker runtime configuration", () => {
  it("accepts the private snapshot class without scanner authority", () => {
    expect(readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "repository_snapshot_github_private_v1",
    })).toEqual({
      baseUrl: "https://scopeforge.dev",
      workerId: BASE.SCOPEFORGE_WORKER_ID,
      secret: BASE.SCOPEFORGE_WORKER_SECRET,
      executionClass: "repository_snapshot_github_private_v1",
      pollMs: 2_000,
    });
  });

  it("requires the exact scanner host, work root, Podman binary, and immutable image", () => {
    const config = readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "phase3_repository_scan_no_egress_v1",
      SCOPEFORGE_REPOSITORY_SCAN_WORK_ROOT: "/var/lib/scopeforge/work",
      SCOPEFORGE_R2_DOWNLOAD_HOST: "scopeforge-private-repository-snapshots.1c0da497765687449bbbdf011d068e06.r2.cloudflarestorage.com",
      SCOPEFORGE_PODMAN_BINARY: "/usr/bin/podman",
      SCOPEFORGE_SCANNER_IMAGE: `localhost/scopeforge-hosted-scanner@sha256:${"b".repeat(64)}`,
    });
    expect(config.executionClass).toBe("phase3_repository_scan_no_egress_v1");
    expect(config).toMatchObject({ pollMs: 2_000, podmanBinary: "/usr/bin/podman" });
  });

  it("accepts the Phase 11 HTTP discovery class only with Podman and an immutable runtime image", () => {
    expect(readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "phase11_http_discovery_v1",
      SCOPEFORGE_PODMAN_BINARY: "/usr/bin/podman",
      SCOPEFORGE_RUNTIME_IMAGE: `localhost/scopeforge-runtime-worker@sha256:${"d".repeat(64)}`,
    })).toEqual({
      baseUrl: "https://scopeforge.dev",
      workerId: BASE.SCOPEFORGE_WORKER_ID,
      secret: BASE.SCOPEFORGE_WORKER_SECRET,
      executionClass: "phase11_http_discovery_v1",
      pollMs: 2_000,
      podmanBinary: "/usr/bin/podman",
      runtimeImage: `localhost/scopeforge-runtime-worker@sha256:${"d".repeat(64)}`,
    });
  });

  it("rejects incomplete or mutable Phase 11 HTTP discovery runtime authority", () => {
    expect(() => readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "phase11_http_discovery_v1",
      SCOPEFORGE_PODMAN_BINARY: "/usr/bin/podman",
    })).toThrow(/runtime image|required/i);
    expect(() => readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "phase11_http_discovery_v1",
      SCOPEFORGE_PODMAN_BINARY: "/usr/local/bin/not-podman",
      SCOPEFORGE_RUNTIME_IMAGE: `localhost/scopeforge-runtime-worker@sha256:${"d".repeat(64)}`,
    })).toThrow(/Podman binary/);
    expect(() => readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "phase11_http_discovery_v1",
      SCOPEFORGE_PODMAN_BINARY: "/usr/bin/podman",
      SCOPEFORGE_RUNTIME_IMAGE: "localhost/scopeforge-runtime-worker:latest",
    })).toThrow(/immutable/);
  });

  it("rejects unsupported classes and mutable scanner images", () => {
    expect(() => readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "repository_snapshot_github_public_v1",
    })).toThrow(/execution class/);
    expect(() => readWorkerRuntimeConfig({
      ...BASE,
      SCOPEFORGE_WORKER_EXECUTION_CLASS: "phase3_repository_scan_no_egress_v1",
      SCOPEFORGE_REPOSITORY_SCAN_WORK_ROOT: "/var/lib/scopeforge/work",
      SCOPEFORGE_R2_DOWNLOAD_HOST: `bucket.${"c".repeat(32)}.r2.cloudflarestorage.com`,
      SCOPEFORGE_PODMAN_BINARY: "/usr/bin/podman",
      SCOPEFORGE_SCANNER_IMAGE: "localhost/scopeforge-hosted-scanner:latest",
    })).toThrow(/immutable/);
  });
});
