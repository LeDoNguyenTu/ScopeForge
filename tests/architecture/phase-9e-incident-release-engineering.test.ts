import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const securityPolicyPath = "SECURITY.md";
const incidentRunbookPath = "docs/security/INCIDENT_RESPONSE.md";
const releaseChecklistPath = "docs/security/RELEASE_SECURITY_CHECKLIST.md";

async function read(path: string): Promise<string> {
  return readFile(path, "utf8");
}

const runtimeFlags = [
  "HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED",
  "HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED",
  "HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED",
  "HOSTED_ACTIVE_CORS_WORKER_ENABLED"
] as const;

describe("Phase 9E incident readiness and release engineering", () => {
  it("publishes a private coordinated vulnerability-reporting policy", async () => {
    const policy = await read(securityPolicyPath);
    expect(policy).toMatch(/private vulnerability reporting/i);
    expect(policy).toMatch(/GitHub private vulnerability reporting/i);
    expect(policy).toMatch(/coordinated disclosure/i);
    expect(policy).toMatch(/3 business days/i);
    expect(policy).toMatch(/5 business days/i);
    expect(policy).not.toMatch(/service[_ -]?role key|worker credential|lease token/i);
  });

  it("documents every hosted capability as an explicit containment boundary", async () => {
    const runbook = await read(incidentRunbookPath);
    for (const flag of runtimeFlags) expect(runbook).toContain(flag);
    expect(runbook).toMatch(/false or remove/i);
    expect(runbook).not.toMatch(/enable .*runtime.*(?:test|recovery)/i);
  });

  it("forbids secret and source collection during incident evidence preservation", async () => {
    const runbook = await read(incidentRunbookPath);
    for (const phrase of [
      "passwords",
      "access tokens",
      "refresh tokens",
      "service-role",
      "worker credentials",
      "lease tokens",
      "raw repository source",
      "raw executor stdout/stderr",
      "complete environment dumps"
    ]) expect(runbook.toLowerCase()).toContain(phrase.toLowerCase());
  });

  it("requires exact release evidence and permanent validation commands", async () => {
    const checklist = await read(releaseChecklistPath);
    for (const command of [
      "npm audit --audit-level=info",
      "npm test",
      "npm run typecheck",
      "npm run build:cli",
      "npm run benchmark:scanner",
      "npm run benchmark:matrix",
      "npm run build"
    ]) expect(checklist).toContain(command);
    expect(checklist).toMatch(/exact .*commit SHA/i);
    expect(checklist).toMatch(/Git tree/i);
  });

  it("does not convert unknown provider state or CSP into a passing claim", async () => {
    const checklist = await read(releaseChecklistPath);
    expect(checklist).toContain("NOT VERIFIED");
    expect(checklist).toMatch(/CSP.*not enforced/is);
    expect(checklist).not.toMatch(/CSP.*PASS.*enforced/is);
  });
});
