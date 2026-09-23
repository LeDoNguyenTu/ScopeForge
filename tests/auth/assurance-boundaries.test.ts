import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("MFA assurance boundaries", () => {
  it("enforces workspace assurance by default while allowing the enrollment route through", () => {
    const current = read("lib/workspaces/current.ts");
    const securityPage = read("app/dashboard/settings/security/page.tsx");
    expect(current).toContain("enforceAssuranceForRole");
    expect(current).toContain("enforceMfa = true");
    expect(securityPage).toContain("enforceMfa: false");
    const workspacePage = read("app/dashboard/workspace/page.tsx");
    const workspaceActions = read("app/dashboard/workspace/actions.ts");
    expect(workspacePage).toContain("enforceAssuranceForRole");
    expect(workspaceActions.match(/enforceAssuranceForRole/g)?.length).toBe(3);
  });

  it("requires platform administrators to reach AAL2 but keeps optional dashboard discovery side-effect free", () => {
    const authorization = read("lib/platform-admin/authorization.ts");
    expect(authorization).toContain("enforceMfa = true");
    expect(authorization).toContain("enforceAssuranceForRole(supabase.auth, \"platform-admin\"");
    expect(authorization).toContain("getPlatformAdminAccessState({ enforceMfa: false })");
  });

  it("renders a dedicated bounded MFA challenge route", () => {
    const challengePage = read("app/auth/mfa/page.tsx");
    expect(challengePage).toContain("safeAuthReturnPath");
    expect(challengePage).toContain("MfaChallengeForm");
    expect(challengePage).toContain("readAssuranceState");
  });
});
