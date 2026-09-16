import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSelectedWorkspaceId } from "@/lib/workspaces/selection";

const mocks = vi.hoisted(() => ({ value: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocks.value ? { value: mocks.value } : undefined }) }));
const user = "11111111-1111-4111-8111-111111111111";
const workspace = "22222222-2222-4222-8222-222222222222";
beforeEach(() => { mocks.value = ""; });

describe("workspace selection", () => {
  it("uses the selection belonging to the current authenticated user", async () => {
    mocks.value = `${user}:${workspace}`;
    expect(await getSelectedWorkspaceId(user)).toBe(workspace);
  });
  it("does not carry a previous account's workspace into another sign-in", async () => {
    mocks.value = `another-user:${workspace}`;
    expect(await getSelectedWorkspaceId(user)).toBeUndefined();
  });
  it.each(["", `${user}:../../admin`, `${user}:invalid`])("ignores malformed selection %s", async (value) => {
    mocks.value = value;
    expect(await getSelectedWorkspaceId(user)).toBeUndefined();
  });
});
