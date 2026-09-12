import Link from "next/link";
import { ArrowLeft, Github, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import GitHubRepositoryPicker from "@/components/integrations/GitHubRepositoryPicker";
import {
  GitHubRepositoryServiceError,
  listConnectedRepositories,
} from "@/lib/github-app/repositories";
import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

function normalizePage(value: string | undefined): number {
  if (!value || !/^[1-9][0-9]{0,3}$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 1000 ? page : 1;
}

export default async function GitHubIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const { workspace, role, displayName } = await getDashboardContext();

  if (!serverCapabilityEnabled("HOSTED_GITHUB_INTEGRATION_ENABLED")) {
    return (
      <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
        <Link className="backLink" href="/dashboard/assets/new"><ArrowLeft size={14} /> Add asset</Link>
        <section className="pageHeader">
          <div>
            <span className="sectionEyebrow">Connected projects</span>
            <h1>GitHub repositories</h1>
            <p>GitHub connected projects are released behind a server-side capability gate so provider acceptance can be completed before the integration is exposed.</p>
          </div>
        </section>
        <section className="panel">
          <div className="emptyState">
            <span className="emptyIcon"><ShieldCheck size={23} /></span>
            <h3>GitHub integration is not enabled</h3>
            <p>The integration remains unavailable until its production GitHub App configuration and owner/admin connection canary have been verified.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  let repositoryPage: Awaited<ReturnType<typeof listConnectedRepositories>> | null = null;
  let connectionError: GitHubRepositoryServiceError | null = null;
  try {
    repositoryPage = await listConnectedRepositories({ workspaceId: workspace.id, page });
  } catch (error) {
    if (error instanceof GitHubRepositoryServiceError) connectionError = error;
    else throw error;
  }

  const disconnected = connectionError?.code === "GITHUB_CONNECTION_MISSING"
    || connectionError?.code === "GITHUB_CONNECTION_INACTIVE";

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <Link className="backLink" href="/dashboard/assets/new"><ArrowLeft size={14} /> Add asset</Link>
      <section className="pageHeader">
        <div>
          <span className="sectionEyebrow">Connected projects</span>
          <h1>GitHub repositories</h1>
          <p>Authorize ScopeForge through its GitHub App, then import only repositories that the installation confirms you can access.</p>
        </div>
        {repositoryPage ? (
          <span className="statusPill"><ShieldCheck size={14} /> GitHub connected</span>
        ) : null}
      </section>

      {params.connected === "1" ? (
        <section className="panel"><p>GitHub connection verified. Choose a repository to add it as a ScopeForge project.</p></section>
      ) : null}

      {repositoryPage ? (
        <section className="panel assetPanel">
          <div className="panelTitle">
            <div><span>Installation repositories</span><h2>Import from GitHub</h2></div>
          </div>
          <GitHubRepositoryPicker
            repositories={repositoryPage.repositories}
            page={repositoryPage.page}
            hasNextPage={repositoryPage.hasNextPage}
          />
        </section>
      ) : disconnected ? (
        <section className="panel">
          <div className="emptyState">
            <span className="emptyIcon"><Github size={23} /></span>
            <h3>Connect GitHub</h3>
            <p>ScopeForge uses a read-only GitHub App installation. The callback verifies installation ownership before any connection is saved.</p>
            <Link className="primaryButton compact" href="/api/integrations/github/connect">Connect GitHub</Link>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="emptyState">
            <span className="emptyIcon"><ShieldCheck size={23} /></span>
            <h3>GitHub integration unavailable</h3>
            <p>{connectionError?.message ?? "The GitHub integration could not be loaded safely."}</p>
          </div>
        </section>
      )}
    </AppShell>
  );
}