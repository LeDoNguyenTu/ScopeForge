import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";
import { Phase3ImportWorkflowError } from "@/lib/phase3-import/service";
import { PHASE3_IMPORT_MAX_BODY_BYTES } from "@/lib/phase3-import/transport";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createPhase3ImportRepository: vi.fn(),
  importHostedPhase3Result: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/phase3-import/repository", () => ({
  createPhase3ImportRepository: mocks.createPhase3ImportRepository,
}));
vi.mock("@/lib/phase3-import/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/phase3-import/service")>();
  return {
    ...actual,
    importHostedPhase3Result: mocks.importHostedPhase3Result,
  };
});

import { POST } from "@/app/api/phase3-import/route";

function payloadWithoutRunRef(): Omit<HostedPhase3EnvelopeV1, "runRef"> {
  return {
    schemaVersion: 1,
    tool: { name: "ScopeForge", version: "0.1.0" },
    repository: { canonicalUrl: "https://github.com/acme/example" },
    scan: {
      startedAt: "2026-08-26T00:00:00.000Z",
      durationMs: 125,
      scanners: ["jsts@1.0.0"],
      scannerErrorCount: 0,
    },
    inventory: {
      filesAnalyzed: 12,
      filesSkipped: 1,
      totalBytes: 4096,
    },
    findings: [
      {
        fingerprint: `sf1:${"b".repeat(64)}`,
        scanner: "jsts",
        ruleId: "jsts/command-injection",
        ruleVersion: "1.0.0",
        title: "Command injection",
        description: "Untrusted input reaches a command execution sink.",
        severity: "high",
        confidence: "high",
        validation: "static_confirmed",
        location: { path: "src/app.ts", line: 7 },
        evidence: { summary: "Request input reaches child_process.exec." },
        taxonomy: {
          cwe: ["CWE-78"],
          owasp: ["A03:2021"],
          references: [],
        },
        remediation: {
          summary: "Avoid shell command construction.",
          guidance: "Use an allowlisted argument API instead of a shell string.",
          verification: "Rerun ScopeForge and confirm the data flow is removed.",
        },
      },
    ],
  };
}

function envelope(): HostedPhase3EnvelopeV1 {
  const payload = payloadWithoutRunRef();
  const runRef = `sfh1:${createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex")}`;
  return { ...payload, runRef };
}

function request(body: BodyInit | null, options: { contentType?: string; contentLength?: number; assetId?: string } = {}) {
  const url = new URL("https://scopeforge.dev/api/phase3-import");
  if (options.assetId !== undefined) url.searchParams.set("assetId", options.assetId);
  const headers = new Headers();
  if (options.contentType !== null) headers.set("content-type", options.contentType ?? "application/json");
  if (options.contentLength !== undefined) headers.set("content-length", String(options.contentLength));
  return new Request(url, { method: "POST", headers, body });
}

function sessionClient(input: {
  userId?: string | null;
  role?: "owner" | "admin" | "member" | "viewer";
  workspaceId?: string | null;
} = {}) {
  const userId = input.userId === undefined ? "user-1" : input.userId;
  const workspaceId = input.workspaceId === undefined ? "workspace-1" : input.workspaceId;
  const role = input.role ?? "member";
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({
      data: workspaceId ? [{ role, workspaces: { id: workspaceId } }] : [],
      error: null,
    })),
  };
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      })),
    },
    from: vi.fn(() => query),
  };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue(sessionClient());
  mocks.createAdminClient.mockReturnValue({ kind: "admin" });
  mocks.createPhase3ImportRepository.mockReturnValue({ kind: "repo" });
  mocks.importHostedPhase3Result.mockResolvedValue({
    importRunId: "import-1",
    scanJobId: "job-1",
    replayed: false,
  });
});

describe("POST /api/phase3-import", () => {
  it("returns 401 and never creates trusted mutation dependencies for an unauthenticated request", async () => {
    mocks.createClient.mockResolvedValue(sessionClient({ userId: null }));

    const response = await POST(request(JSON.stringify(envelope()), { assetId: "asset-1" }));

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { code: "PHASE3_IMPORT_UNAUTHENTICATED" } });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.importHostedPhase3Result).not.toHaveBeenCalled();
  });

  it("rejects declared and streamed bodies above the 3.5 MB boundary before trusted persistence", async () => {
    const declared = await POST(request("{}", {
      assetId: "asset-1",
      contentLength: PHASE3_IMPORT_MAX_BODY_BYTES + 1,
    }));
    expect(declared.status).toBe(413);

    const streamed = await POST(request("x".repeat(PHASE3_IMPORT_MAX_BODY_BYTES + 1), {
      assetId: "asset-1",
    }));
    expect(streamed.status).toBe(413);
    expect(mocks.importHostedPhase3Result).not.toHaveBeenCalled();
  });

  it("requires one repository asset id and application/json content", async () => {
    const missingAsset = await POST(request(JSON.stringify(envelope())));
    expect(missingAsset.status).toBe(400);

    const wrongType = await POST(request(JSON.stringify(envelope()), {
      assetId: "asset-1",
      contentType: "text/plain",
    }));
    expect(wrongType.status).toBe(415);
    expect(mocks.importHostedPhase3Result).not.toHaveBeenCalled();
  });

  it("maps malformed or unreviewed envelope JSON to a safe 400 response", async () => {
    const malformed = await POST(request("{not-json", { assetId: "asset-1" }));
    expect(malformed.status).toBe(400);

    const forged = await POST(request(JSON.stringify({ ...envelope(), lifecycle: "verified_fixed" }), {
      assetId: "asset-1",
    }));
    expect(forged.status).toBe(400);
    expect(await json(forged)).toMatchObject({ error: { code: "PHASE3_IMPORT_INVALID" } });
    expect(mocks.importHostedPhase3Result).not.toHaveBeenCalled();
  });

  it("derives actor, workspace and role from the server session and delegates only the validated envelope plus asset id", async () => {
    const response = await POST(request(JSON.stringify(envelope()), { assetId: "asset-1" }));

    expect(response.status).toBe(201);
    expect(await json(response)).toEqual({
      ok: true,
      data: { importRunId: "import-1", scanJobId: "job-1", replayed: false },
    });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.createPhase3ImportRepository).toHaveBeenCalledWith({ kind: "admin" });
    expect(mocks.importHostedPhase3Result).toHaveBeenCalledTimes(1);
    expect(mocks.importHostedPhase3Result).toHaveBeenCalledWith(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        role: "member",
        assetId: "asset-1",
        envelope: envelope(),
      },
      { repository: { kind: "repo" } },
    );
  });

  it("returns 200 for exact replay and maps trusted workflow failures without exposing database details", async () => {
    mocks.importHostedPhase3Result.mockResolvedValueOnce({
      importRunId: "import-1",
      scanJobId: "job-1",
      replayed: true,
    });
    const replay = await POST(request(JSON.stringify(envelope()), { assetId: "asset-1" }));
    expect(replay.status).toBe(200);

    mocks.importHostedPhase3Result.mockRejectedValueOnce(
      new Phase3ImportWorkflowError("PHASE3_IMPORT_ASSET_MISMATCH", "internal database detail"),
    );
    const mismatch = await POST(request(JSON.stringify(envelope()), { assetId: "asset-1" }));
    expect(mismatch.status).toBe(400);
    const mismatchBody = await json(mismatch);
    expect(mismatchBody).toMatchObject({ error: { code: "PHASE3_IMPORT_ASSET_MISMATCH" } });
    expect(JSON.stringify(mismatchBody)).not.toContain("internal database detail");

    mocks.importHostedPhase3Result.mockRejectedValueOnce(
      new Phase3ImportWorkflowError("PHASE3_IMPORT_RUN_REF_CONFLICT", "sensitive conflict detail"),
    );
    const conflict = await POST(request(JSON.stringify(envelope()), { assetId: "asset-1" }));
    expect(conflict.status).toBe(409);
    expect(JSON.stringify(await json(conflict))).not.toContain("sensitive conflict detail");
  });
});
