import { createHash } from "node:crypto";
import {
  assertActiveSessionLease,
  type PentestSessionLease,
  type ResolvedCredential,
} from "../../lib/pentest-sessions";

export const BROWSER_SECURITY_CAPABILITIES = Object.freeze([
  "browser.login.perform.v1",
  "browser.route.discover.v1",
  "browser.session.compare_roles.v1",
  "api.authorization.compare.v1",
] as const);

export interface BrowserSemanticDriver {
  navigate(url: string): Promise<void>;
  fill(field: "username" | "password", value: string): Promise<void>;
  click(control: "login-submit"): Promise<void>;
  waitForPath(path: string): Promise<void>;
  summarize(): Promise<{ path: string; visibleText: string; elementCount: number }>;
  close(): Promise<void>;
}

export interface BrowserLeaseResolver {
  loadLease(leaseId: string): Promise<PentestSessionLease | null>;
  resolveCredential(lease: PentestSessionLease): Promise<ResolvedCredential>;
}

export interface BrowserLoginProfile {
  loginPath: string;
  successPath: string;
  observePath: string;
}

export interface BrowserExecutionContext {
  workspaceId: string;
  runId: string;
  authorizationSnapshotRef: string;
  targetNodeId: string;
  canonicalTarget: string;
  now?: Date;
}

export interface BrowserObservationSummary {
  identityId: string;
  path: string;
  visibleTextFingerprint: string;
  elementCount: number;
}

function safePath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.length > 240 || /[\r\n\0?#]/.test(value)) {
    throw new Error("PHASE11_BROWSER_PATH_INVALID");
  }
  return value;
}

function targetOrigin(locator: string): URL {
  const url = new URL(locator);
  const lab = url.protocol === "http:" && url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !lab) || url.username || url.password || url.search || url.hash) {
    throw new Error("PHASE11_BROWSER_TARGET_INVALID");
  }
  return url;
}

function reducedSummary(input: { identityId: string; path: string; visibleText: string; elementCount: number }, secrets: readonly string[]): BrowserObservationSummary {
  if (!Number.isInteger(input.elementCount) || input.elementCount < 0 || input.elementCount > 100_000) {
    throw new Error("PHASE11_BROWSER_SUMMARY_INVALID");
  }
  let reduced = input.visibleText.replace(/\s+/g, " ").trim().slice(0, 4096);
  for (const secret of secrets) {
    if (secret) reduced = reduced.split(secret).join("[REDACTED]");
  }
  const fingerprint = createHash("sha256").update(reduced, "utf8").digest("hex");
  return Object.freeze({
    identityId: input.identityId,
    path: safePath(input.path),
    visibleTextFingerprint: fingerprint,
    elementCount: input.elementCount,
  });
}

export async function performClosedBrowserLogin(input: {
  sessionLeaseId: string;
  profile: BrowserLoginProfile;
  context: BrowserExecutionContext;
  leases: BrowserLeaseResolver;
  createDriver(): Promise<BrowserSemanticDriver>;
}): Promise<BrowserObservationSummary> {
  const lease = await input.leases.loadLease(input.sessionLeaseId);
  if (!lease) throw new Error("PHASE11_SESSION_LEASE_NOT_FOUND");
  assertActiveSessionLease(lease, input.context, input.context.now ?? new Date());
  const credential = await input.leases.resolveCredential(lease);
  if (!credential.username || !credential.password) throw new Error("PHASE11_BROWSER_CREDENTIAL_INVALID");

  const origin = targetOrigin(input.context.canonicalTarget);
  const loginPath = safePath(input.profile.loginPath);
  const successPath = safePath(input.profile.successPath);
  const observePath = safePath(input.profile.observePath);
  const driver = await input.createDriver();

  try {
    await driver.navigate(new URL(loginPath, origin).toString());
    await driver.fill("username", credential.username);
    await driver.fill("password", credential.password);
    await driver.click("login-submit");
    await driver.waitForPath(successPath);
    await driver.navigate(new URL(observePath, origin).toString());
    const summary = await driver.summarize();
    const current = new URL(summary.path, origin);
    if (current.origin !== origin.origin) throw new Error("PHASE11_BROWSER_ORIGIN_DRIFT");
    return reducedSummary({
      identityId: lease.identityId,
      path: current.pathname,
      visibleText: summary.visibleText,
      elementCount: summary.elementCount,
    }, [credential.username, credential.password]);
  } finally {
    await driver.close();
  }
}

export async function compareAuthorizedSessions(input: {
  firstLeaseId: string;
  secondLeaseId: string;
  profile: BrowserLoginProfile;
  context: BrowserExecutionContext;
  leases: BrowserLeaseResolver;
  createDriver(): Promise<BrowserSemanticDriver>;
}) {
  const [first, second] = await Promise.all([
    input.leases.loadLease(input.firstLeaseId),
    input.leases.loadLease(input.secondLeaseId),
  ]);
  if (!first || !second || first.identityId === second.identityId) {
    throw new Error("PHASE11_BROWSER_COMPARISON_IDENTITIES_INVALID");
  }
  assertActiveSessionLease(first, input.context, input.context.now ?? new Date());
  assertActiveSessionLease(second, input.context, input.context.now ?? new Date());

  const a = await performClosedBrowserLogin({
    sessionLeaseId: first.leaseId,
    profile: input.profile,
    context: input.context,
    leases: input.leases,
    createDriver: input.createDriver,
  });
  const b = await performClosedBrowserLogin({
    sessionLeaseId: second.leaseId,
    profile: input.profile,
    context: input.context,
    leases: input.leases,
    createDriver: input.createDriver,
  });

  return Object.freeze({
    first: a,
    second: b,
    differs: a.visibleTextFingerprint !== b.visibleTextFingerprint || a.elementCount !== b.elementCount,
  });
}
