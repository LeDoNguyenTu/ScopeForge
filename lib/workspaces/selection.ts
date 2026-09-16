import { cookies } from "next/headers";

export const WORKSPACE_COOKIE = "scopeforge_workspace";

export async function getSelectedWorkspaceId(userId: string): Promise<string | undefined> {
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const [account, workspaceId] = value?.split(":") ?? [];
  if (account !== userId || !workspaceId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(workspaceId)) return undefined;
  // Selection is not authorization: every caller must still filter by user_id.
  return workspaceId;
}
