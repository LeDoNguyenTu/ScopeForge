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
import "./github-integration.css";

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
        <div className="githubIntegrationPage">
          <Link className="backLink githubBackLink" href="/dashboard/assets/new"><ArrowLeft size={14} /> Add asset</Link>
          <section className="githubIntegrationHeader">
            <div>
              <span className="sectionEyebrow">Connected projects</span>
              <h1>GitHub repositories</h1>
              <p>GitHub connected projects remain behind a server-side capability gate until provider acceptance is complete.</p>
            </div>
          </section>
          <section className="githubConnectionBanner githubConnectionBannerMuted">
            <span className="githubConnectionIcon"><ShieldCheck size={20} /></span>
            <div>
              <span className="githubConnectionKicker">Provider gate</span>
              <h2>GitHub integration is not enabled</h2>
              <p>The integration remains unavailable until its production GitHub App configuration and owner/admin connection canary have been verified.</p>
            </div>
          </section>
        </div>
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
      <div className="githubIntegrationPage">
        <Link className="backLink githubBackLink" href="/dashboard/assets/new"><ArrowLeft size={14} /> Add asset</Link>

        <section className="githubIntegrationHeader">
          <div>
            <span className="sectionEyebrow">Connected projects</span>
            <h1>GitHub repositories</h1>
            <p>Authorize ScopeForge through its read-only GitHub App, then import only repositories confirmed by the active installation.</p>
          </div>
          {repositoryPage ? <span className="statusPill githubConnectedPill"><ShieldCheck size={14} /> Connected</span> : null}
        </section>

        {params.connected === "1" ? (
          <div className="githubSuccessNotice" role="status">
            <ShieldCheck size={16} />
            <span>GitHub connection verified. Choose a repository to add it as a ScopeForge project.</span>
          </div>
        ) : null}

        {repositoryPage ? (
          <>
            <section className="githubConnectionBanner">
              <span className="githubConnectionIcon"><Github size={20} /></span>
              <div>
                <span className="githubConnectionKicker">Installation state</span>
                <h2>Repository access verified</h2>
                <p>ScopeForge is listing repositories from the validated installation. Importing a project does not bypass hosted runtime capability gates.</p>
              </div>
              <span className="githubConnectionStatus"><ShieldCheck size={14} /> Read-only</span>
            </section>

            <section className="githubRepositorySection">
              <div className="githubRepositorySectionHeader">
                <div>
                  <span className="sectionEyebrow">Installation repositories</span>
                  <h2>Import from GitHub</h2>
                  <p>Select a repository available to the installation. Private source acquisition remains independently gated by Phase 10A2.</p>
                </div>
              </div>
              <GitHubRepositoryPicker
                repositories={repositoryPage.repositories}
                page={repositoryPage.page}
                hasNextPage={repositoryPage.hasNextPage}
              />
            </section>
          </>
        ) : disconnected ? (
          <section className="githubConnectionBanner githubConnectionBannerAction">
            <span className="githubConnectionIcon"><Github size={20} /></span>
            <div>
              <span className="githubConnectionKicker">No active installation</span>
              <h2>Connect GitHub</h2>
              <p>ScopeForge uses a read-only GitHub App installation. The callback verifies installation ownership before any connection is saved.</p>
            </div>
            <Link className="primaryButton compact githubConnectAction" href="/api/integrations/github/connect">Connect GitHub</Link>
          </section>
        ) : (
          <section className="githubConnectionBanner githubConnectionBannerError">
            <span className="githubConnectionIcon"><ShieldCheck size={20} /></span>
            <div>
              <span className="githubConnectionKicker">Provider unavailable</span>
              <h2>GitHub integration unavailable</h2>
              <p>{connectionError?.message ?? "The GitHub integration could not be loaded safely."}</p>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
