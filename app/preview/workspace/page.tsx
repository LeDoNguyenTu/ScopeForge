import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import CollaboratorControls from "@/components/workspaces/CollaboratorControls";
import "../../dashboard/workspace/workspace.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace controls preview", robots: { index: false, follow: false } };

export default function WorkspacePreview() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  return <AppShell displayName="Preview user" workspaceName="Example workspace" role="owner" platformAdminHref="/preview/admin">
    <div className="workspaceSettings">
      <div className="saasPreviewNotice"><span><strong>Design preview</strong> · Synthetic accounts. Changes require a signed-in production workspace.</span></div>
      <header><h1>Workspace &amp; collaborators</h1><p>Choose where you work and manage who has access.</p></header>
      <section className="workspaceSettingsCard"><h2>Your workspaces</h2><div className="workspaceMemberForm"><label>Workspace<select defaultValue="example"><option value="example">Example workspace — owner</option><option value="client">Client review — member</option></select></label><button className="primaryButton" type="button">Switch workspace</button></div></section>
      <CollaboratorControls workspaceId="00000000-0000-4000-8000-000000000001" members={[
        { user_id: "00000000-0000-4000-8000-000000000002", display_name: "Workspace owner", email: "owner@example.invalid", role: "owner" },
        { user_id: "00000000-0000-4000-8000-000000000003", display_name: "Security reviewer", email: "reviewer@example.invalid", role: "member" },
      ]} />
    </div>
  </AppShell>;
}
