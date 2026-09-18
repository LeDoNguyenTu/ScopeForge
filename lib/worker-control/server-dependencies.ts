import type { Phase11cWorkerDatabase } from "@/lib/database.phase11c.types";
import { getGitHubAppConfig } from "@/lib/github-app/config";
import { createPrivateRepositorySourceLease } from "@/lib/repository-snapshots/private-source-broker";
import { createRepositorySnapshotObjectStore } from "@/lib/repository-snapshots/server-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkerControlRepository } from "./repository";
import { WorkerControlError } from "./types";
import type {
  PrivateRepositorySourceLeaseRequest,
  WorkerControlServiceDependencies,
} from "./service";

export function createWorkerControlServerDependencies(): WorkerControlServiceDependencies {
  const admin = createAdminClient<Phase11cWorkerDatabase>();
  const repository = createWorkerControlRepository(admin);
  let repositorySnapshotObjectStore: ReturnType<typeof createRepositorySnapshotObjectStore> | undefined;
  return Object.freeze({
    repository,
    runtimeRepository: repository,
    repositorySnapshotObjectStore: () => {
      repositorySnapshotObjectStore ??= createRepositorySnapshotObjectStore();
      return repositorySnapshotObjectStore;
    },
    privateRepositorySourceLease: async (claim: PrivateRepositorySourceLeaseRequest) => {
      const { data: link, error: linkError } = await admin
        .from("github_repository_links")
        .select("id,github_connection_id,repository_id,owner_login,repository_name,is_private,html_url,access_status")
        .eq("id", claim.githubRepositoryLinkId)
        .eq("workspace_id", claim.workspaceId)
        .eq("asset_id", claim.assetId)
        .maybeSingle();
      if (
        linkError
        || !link
        || link.access_status !== "active"
        || link.is_private !== true
        || link.owner_login !== claim.owner
        || link.repository_name !== claim.repository
        || link.html_url !== claim.canonicalRepositoryUrl
      ) {
        throw new WorkerControlError("WORKER_JOB_STATE_CONFLICT");
      }

      const { data: connection, error: connectionError } = await admin
        .from("github_connections")
        .select("id,installation_id,status")
        .eq("id", link.github_connection_id)
        .eq("workspace_id", claim.workspaceId)
        .maybeSingle();
      if (connectionError || !connection || connection.status !== "active") {
        throw new WorkerControlError("WORKER_JOB_STATE_CONFLICT");
      }

      return createPrivateRepositorySourceLease({
        installationId: connection.installation_id,
        repositoryId: link.repository_id,
        owner: claim.owner,
        repository: claim.repository,
        canonicalRepositoryUrl: claim.canonicalRepositoryUrl,
        absoluteDeadlineAt: claim.absoluteDeadlineAt,
        leaseExpiresAt: claim.leaseExpiresAt,
      }, {
        config: getGitHubAppConfig(),
      });
    },
  });
}
