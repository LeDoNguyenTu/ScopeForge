import type { WorkspaceRole } from "@/lib/database.types";
import { createPhase3ImportRepository } from "@/lib/phase3-import/repository";
import {
  importHostedPhase3Result,
  Phase3ImportWorkflowError,
} from "@/lib/phase3-import/service";
import {
  Phase3ImportValidationError,
  validateHostedPhase3Envelope,
} from "@/lib/phase3-import/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const PHASE3_IMPORT_MAX_BODY_BYTES = 3_500_000;

interface Phase3ImportRequestContext {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

class Phase3ImportRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "Phase3ImportRouteError";
    this.code = code;
    this.status = status;
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case "PHASE3_IMPORT_UNAUTHENTICATED":
      return "Sign in before importing hosted Phase 3 findings.";
    case "PHASE3_IMPORT_FORBIDDEN":
      return "Your workspace role cannot perform this import.";
    case "PHASE3_IMPORT_PAYLOAD_TOO_LARGE":
      return "The hosted Phase 3 import exceeds the 3.5 MB request boundary.";
    case "PHASE3_IMPORT_CONTENT_TYPE_UNSUPPORTED":
      return "Hosted Phase 3 imports must use application/json.";
    case "PHASE3_IMPORT_ASSET_REQUIRED":
      return "A repository asset id is required.";
    case "PHASE3_IMPORT_ASSET_NOT_AVAILABLE":
      return "The selected repository asset is not available.";
    case "PHASE3_IMPORT_ASSET_MISMATCH":
      return "The hosted result does not match the selected repository asset.";
    case "PHASE3_IMPORT_RUN_REF_CONFLICT":
      return "This hosted run reference conflicts with an existing import.";
    case "PHASE3_IMPORT_EVIDENCE_ID_CONFLICT":
    case "PHASE3_IMPORT_FINDING_ID_CONFLICT":
      return "The hosted result conflicts with immutable security evidence.";
    case "PHASE3_IMPORT_INVALID":
    case "PHASE3_SOURCE_NOT_ALLOWED":
    case "PHASE3_RUN_REF_CONFLICT":
    case "PHASE3_IMPORT_PAYLOAD_INVALID":
      return "The hosted Phase 3 payload is invalid or unsupported.";
    default:
      return "The hosted Phase 3 import could not be completed safely.";
  }
}

function jsonError(code: string, status: number): Response {
  return Response.json(
    { error: { code, message: errorMessage(code) } },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function jsonSuccess(
  data: { importRunId: string; scanJobId: string; replayed: boolean },
): Response {
  return Response.json(
    { ok: true, data },
    {
      status: data.replayed ? 200 : 201,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function contentLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value)) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_INVALID", 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_INVALID", 400);
  }
  return parsed;
}

function assertTransportBoundary(request: Request): void {
  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_CONTENT_TYPE_UNSUPPORTED", 415);
  }

  const declaredLength = contentLength(request);
  if (declaredLength !== null && declaredLength > PHASE3_IMPORT_MAX_BODY_BYTES) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_PAYLOAD_TOO_LARGE", 413);
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_INVALID", 400);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteCount = 0;
  let text = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > PHASE3_IMPORT_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Phase3ImportRouteError("PHASE3_IMPORT_PAYLOAD_TOO_LARGE", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof Phase3ImportRouteError) throw error;
    throw new Phase3ImportRouteError("PHASE3_IMPORT_INVALID", 400);
  }

  if (text.length === 0) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_INVALID", 400);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_INVALID", 400);
  }
}

async function loadRequestContext(): Promise<Phase3ImportRequestContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id)")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_CONTEXT_FAILED", 500);
  }

  const membership = memberships?.[0];
  const workspace = Array.isArray(membership?.workspaces)
    ? membership.workspaces[0]
    : membership?.workspaces;
  if (!membership || !workspace) {
    throw new Phase3ImportRouteError("PHASE3_IMPORT_FORBIDDEN", 403);
  }

  return {
    actorId: user.id,
    workspaceId: workspace.id,
    role: membership.role,
  };
}

function workflowStatus(code: Phase3ImportWorkflowError["code"]): number {
  switch (code) {
    case "PHASE3_IMPORT_FORBIDDEN":
      return 403;
    case "PHASE3_IMPORT_ASSET_NOT_AVAILABLE":
      return 404;
    case "PHASE3_IMPORT_RUN_REF_CONFLICT":
    case "PHASE3_IMPORT_EVIDENCE_ID_CONFLICT":
    case "PHASE3_IMPORT_FINDING_ID_CONFLICT":
      return 409;
    case "PHASE3_IMPORT_ASSET_MISMATCH":
    case "PHASE3_IMPORT_PAYLOAD_INVALID":
      return 400;
    case "PHASE3_IMPORT_PERSISTENCE_FAILED":
    default:
      return 500;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const assetId = new URL(request.url).searchParams.get("assetId")?.trim();
    if (!assetId) {
      throw new Phase3ImportRouteError("PHASE3_IMPORT_ASSET_REQUIRED", 400);
    }

    assertTransportBoundary(request);

    const context = await loadRequestContext();
    if (!context) {
      return jsonError("PHASE3_IMPORT_UNAUTHENTICATED", 401);
    }

    const rawEnvelope = await readBoundedJson(request);
    const envelope = validateHostedPhase3Envelope(rawEnvelope);

    const repository = createPhase3ImportRepository(createAdminClient());
    const result = await importHostedPhase3Result(
      {
        actorId: context.actorId,
        workspaceId: context.workspaceId,
        role: context.role,
        assetId,
        envelope,
      },
      { repository },
    );

    return jsonSuccess(result);
  } catch (error) {
    if (error instanceof Phase3ImportRouteError) {
      return jsonError(error.code, error.status);
    }
    if (error instanceof Phase3ImportValidationError) {
      return jsonError(error.code, 400);
    }
    if (error instanceof Phase3ImportWorkflowError) {
      return jsonError(error.code, workflowStatus(error.code));
    }
    return jsonError("PHASE3_IMPORT_REQUEST_FAILED", 500);
  }
}
