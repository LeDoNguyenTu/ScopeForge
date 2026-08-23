"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAssetTarget } from "@/lib/assets/normalize-target";
import { createVerificationChallenge, hashVerificationToken, verifyHttpWellKnownTarget } from "@/lib/assets/verification";
import type { AssetKind } from "@/lib/assets/types";
import { assertCanAttemptVerification, assertCanRegisterAsset, QuotaError } from "@/lib/quotas/limits";
import { writeAuditEvent } from "@/lib/audit/write-audit-event";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const ASSET_KINDS = new Set<AssetKind>(["web_application", "api", "repository"]);

async function resolveContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw Object.assign(new Error("Sign in to continue."), { code: "UNAUTHENTICATED" });

  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id,name,slug)")
    .eq("user_id", user.id)
    .limit(1);
  if (error) throw new Error(error.message);

  const membership = memberships?.[0];
  const workspace = Array.isArray(membership?.workspaces) ? membership?.workspaces[0] : membership?.workspaces;
  if (!membership || !workspace) throw Object.assign(new Error("Workspace onboarding is incomplete."), { code: "WORKSPACE_MISSING" });

  return { supabase, user, workspace, membership };
}

function failure(error: unknown): ActionResult<never> {
  if (error instanceof QuotaError) return { ok: false, error: { code: error.code, message: error.message } };
  if (error instanceof Error) {
    const code = typeof (error as Error & { code?: unknown }).code === "string"
      ? (error as Error & { code: string }).code
      : "REQUEST_FAILED";
    return { ok: false, error: { code, message: error.message } };
  }
  return { ok: false, error: { code: "REQUEST_FAILED", message: "The request could not be completed safely." } };
}

function trustedClientOrThrow() {
  try {
    return createAdminClient();
  } catch {
    throw Object.assign(
      new Error("Trusted verification writes are not configured yet. Add the server-only Supabase secret key before enabling verification."),
      { code: "VERIFICATION_SERVICE_NOT_CONFIGURED" }
    );
  }
}

export async function registerAsset(formData: FormData): Promise<ActionResult<{ assetId: string }>> {
  try {
    const { supabase, user, workspace } = await resolveContext();
    const kindInput = String(formData.get("kind") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const target = String(formData.get("target") ?? "").trim();

    if (!ASSET_KINDS.has(kindInput as AssetKind)) throw Object.assign(new Error("Choose a supported asset type."), { code: "INVALID_ASSET_KIND" });
    if (!name || name.length > 120) throw Object.assign(new Error("Asset name must contain 1 to 120 characters."), { code: "INVALID_ASSET_NAME" });

    const normalized = normalizeAssetTarget(target, kindInput as AssetKind);
    const { count, error: countError } = await supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id);
    if (countError) throw new Error(countError.message);
    assertCanRegisterAsset(count ?? 0);

    const { data: asset, error: insertError } = await supabase
      .from("assets")
      .insert({
        workspace_id: workspace.id,
        kind: normalized.kind,
        name,
        canonical_target: normalized.canonicalTarget,
        hostname: normalized.hostname,
        created_by: user.id
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") throw Object.assign(new Error("This target is already registered in the workspace."), { code: "ASSET_ALREADY_REGISTERED" });
      throw new Error(insertError.message);
    }

    await writeAuditEvent({
      supabase,
      workspaceId: workspace.id,
      eventType: "asset.created",
      actorId: user.id,
      targetType: "asset",
      targetId: asset.id,
      metadata: { kind: normalized.kind, hostname: normalized.hostname }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/assets");
    return { ok: true, data: { assetId: asset.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function createAssetVerificationChallenge(assetId: string): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  try {
    const { supabase, user, workspace } = await resolveContext();
    const admin = trustedClientOrThrow();
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id,kind,canonical_target,verification_status")
      .eq("id", assetId)
      .eq("workspace_id", workspace.id)
      .single();
    if (assetError || !asset) throw Object.assign(new Error("Asset not found in this workspace."), { code: "ASSET_NOT_FOUND" });
    if (asset.kind === "repository") throw Object.assign(new Error("Repository proof-of-control will use a GitHub integration in a later phase. HTTP verification is only for web and API assets."), { code: "VERIFICATION_METHOD_UNAVAILABLE" });

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ data: recent }, { data: usage }] = await Promise.all([
      supabase.from("asset_verification_challenges").select("attempt_count").eq("asset_id", asset.id).gte("created_at", hourAgo),
      supabase.from("workspace_usage").select("verification_attempts_today,verification_attempt_date").eq("workspace_id", workspace.id).maybeSingle()
    ]);
    const assetAttempts = (recent ?? []).reduce((sum, row) => sum + row.attempt_count, 0);
    const today = new Date().toISOString().slice(0, 10);
    const workspaceAttempts = usage?.verification_attempt_date === today ? usage.verification_attempts_today : 0;
    assertCanAttemptVerification({ assetAttemptsLastHour: assetAttempts, workspaceAttemptsToday: workspaceAttempts });

    const challenge = createVerificationChallenge();
    await supabase.from("asset_verification_challenges").delete().eq("asset_id", asset.id).eq("workspace_id", workspace.id);
    const { error: challengeError } = await supabase.from("asset_verification_challenges").insert({
      workspace_id: workspace.id,
      asset_id: asset.id,
      method: "http_well_known",
      token_hash: challenge.tokenHash,
      expires_at: challenge.expiresAt.toISOString(),
      created_by: user.id
    });
    if (challengeError) throw new Error(challengeError.message);

    const { error: pendingError } = await admin
      .from("assets")
      .update({ verification_status: "pending", verified_at: null, verified_by: null })
      .eq("id", asset.id)
      .eq("workspace_id", workspace.id);
    if (pendingError) {
      await supabase.from("asset_verification_challenges").delete().eq("asset_id", asset.id).eq("token_hash", challenge.tokenHash);
      throw new Error(pendingError.message);
    }

    await writeAuditEvent({
      supabase,
      workspaceId: workspace.id,
      eventType: "asset.verification_challenge_created",
      actorId: user.id,
      targetType: "asset",
      targetId: asset.id,
      metadata: { method: "http_well_known", expires_at: challenge.expiresAt.toISOString() }
    });

    revalidatePath(`/dashboard/assets/${asset.id}`);
    revalidatePath("/dashboard/assets");
    return { ok: true, data: { token: challenge.token, expiresAt: challenge.expiresAt.toISOString() } };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyAsset(assetId: string, token: string): Promise<ActionResult<{ verified: boolean; reason: string }>> {
  try {
    const { supabase, user, workspace } = await resolveContext();
    const admin = trustedClientOrThrow();
    const suppliedToken = token.trim();
    if (suppliedToken.length < 20 || suppliedToken.length > 200) throw Object.assign(new Error("The verification token is invalid."), { code: "INVALID_VERIFICATION_TOKEN" });

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id,kind,canonical_target,verification_status")
      .eq("id", assetId)
      .eq("workspace_id", workspace.id)
      .single();
    if (assetError || !asset) throw Object.assign(new Error("Asset not found in this workspace."), { code: "ASSET_NOT_FOUND" });
    if (asset.kind === "repository") throw Object.assign(new Error("HTTP proof-of-control is not available for repository assets."), { code: "VERIFICATION_METHOD_UNAVAILABLE" });

    const tokenHash = hashVerificationToken(suppliedToken);
    const now = new Date();
    const { data: challenge, error: challengeError } = await supabase
      .from("asset_verification_challenges")
      .select("id,attempt_count,expires_at,created_at")
      .eq("asset_id", asset.id)
      .eq("workspace_id", workspace.id)
      .eq("token_hash", tokenHash)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError) throw new Error(challengeError.message);
    if (!challenge) throw Object.assign(new Error("The verification challenge is missing, expired, or no longer current."), { code: "VERIFICATION_CHALLENGE_INVALID" });

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const [{ data: recent }, { data: usage }] = await Promise.all([
      supabase.from("asset_verification_challenges").select("attempt_count").eq("asset_id", asset.id).gte("created_at", hourAgo),
      supabase.from("workspace_usage").select("verification_attempts_today,verification_attempt_date").eq("workspace_id", workspace.id).maybeSingle()
    ]);
    const assetAttempts = (recent ?? []).reduce((sum, row) => sum + row.attempt_count, 0);
    const today = now.toISOString().slice(0, 10);
    const workspaceAttempts = usage?.verification_attempt_date === today ? usage.verification_attempts_today : 0;
    assertCanAttemptVerification({ assetAttemptsLastHour: assetAttempts, workspaceAttemptsToday: workspaceAttempts });

    const nextAttemptCount = challenge.attempt_count + 1;
    const { error: attemptError } = await supabase
      .from("asset_verification_challenges")
      .update({ attempt_count: nextAttemptCount, last_attempt_at: now.toISOString() })
      .eq("id", challenge.id)
      .eq("workspace_id", workspace.id);
    if (attemptError) throw new Error(attemptError.message);

    const result = await verifyHttpWellKnownTarget({ canonicalTarget: asset.canonical_target, expectedToken: suppliedToken });
    if (result.verified) {
      const { error: verifiedError } = await admin
        .from("assets")
        .update({ verification_status: "verified", verified_at: new Date().toISOString(), verified_by: user.id })
        .eq("id", asset.id)
        .eq("workspace_id", workspace.id);
      if (verifiedError) throw new Error(verifiedError.message);
    } else if (nextAttemptCount >= 5) {
      const { error: failedError } = await admin
        .from("assets")
        .update({ verification_status: "failed", verified_at: null, verified_by: null })
        .eq("id", asset.id)
        .eq("workspace_id", workspace.id);
      if (failedError) throw new Error(failedError.message);
    }

    await writeAuditEvent({
      supabase,
      workspaceId: workspace.id,
      eventType: result.verified ? "asset.verification_succeeded" : "asset.verification_failed",
      actorId: user.id,
      targetType: "asset",
      targetId: asset.id,
      metadata: { method: "http_well_known", verified: result.verified, reason: result.reason }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/assets");
    revalidatePath(`/dashboard/assets/${asset.id}`);
    return { ok: true, data: { verified: result.verified, reason: result.reason } };
  } catch (error) {
    return failure(error);
  }
}
