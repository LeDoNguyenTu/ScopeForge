import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: mocks.eq }) }) }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/platform-settings/server", () => ({ enforcePlatformMaintenanceForUser: vi.fn() }));
import { manageCollaborator, switchWorkspace } from "@/app/dashboard/workspace/actions";

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
function form(extra: Record<string,string> = {}) {
  const result = new FormData();
  for (const [key,value] of Object.entries({ workspaceId, operation: "add", email: "collaborator@example.com", role: "member", ...extra })) result.set(key,value);
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: { workspace_id: workspaceId }, error: null });
});

describe("workspace control actions", () => {
  it("rejects unauthenticated collaborator writes before RPC", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await manageCollaborator(form())).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["admin", "owner", "unknown"])("rejects privilege escalation to %s", async role => {
    expect((await manageCollaborator(form({ role }))).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses a session-authorized RPC without accepting an actor from the form", async () => {
    expect((await manageCollaborator(form({ actor: "attacker" }))).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("manage_workspace_collaborator", { target_workspace_id: workspaceId, operation: "add", collaborator_role: "member", collaborator_email: "collaborator@example.com" });
  });
  it("preserves a database denial and bounds unknown error details", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "WORKSPACE_FORBIDDEN" } });
    expect(await manageCollaborator(form())).toEqual({ ok: false, message: "Only workspace owners and admins can manage collaborators." });
    mocks.rpc.mockResolvedValue({ error: { message: "PRIVATE_DATABASE_DETAIL" } });
    expect((await manageCollaborator(form())).message).not.toContain("PRIVATE");
  });
  it("does not store a forged or revoked workspace selection", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(switchWorkspace(form())).rejects.toThrow("REDIRECT:/dashboard/workspace?error=access");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", userId);
    expect(mocks.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("stores a user-bound HTTP-only selection only after membership verification", async () => {
    await expect(switchWorkspace(form())).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.set).toHaveBeenCalledWith("scopeforge_workspace", `${userId}:${workspaceId}`, expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
  });
});
