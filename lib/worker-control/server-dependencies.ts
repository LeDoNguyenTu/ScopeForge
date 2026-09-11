import type { Phase10a2Database } from "@/lib/database.phase10a2.types";
import { getGitHubAppConfig } from "@/lib/github-app/config";
import { createPrivateRepositorySourceLease } from "@/lib/repository-snapshots/private-source-broker";
import { createRepositorySnapshotObjectStore } from "@/lib/repository-snapshots/server-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkerControlRepository } from "./repository";
import { WorkerControlError } from "./types";
import type { WorkerControlServiceDependencies } from "./service";

export function createWorkerControlServerDependencies(): WorkerControlServiceDependencies {
  const admin = createAdminClient<Phase10a2Database>();
  const repository = createWorkerControlRepository(admin);
  let repositorySnapshotObjectStore: ReturnType<typeof createRepositorySnapshotObjectStore> | undefined;
  return Object.freeze({
    repository,
    runtimeRepository: repository,
    repositorySnapshotObjectStore: () => {
      repositorySnapshotObjectStore ??= createRepositorySnapshotObjectStore();
      return repositorySnapshotObjectStore;
    },
    privateRepositorySourceLease: async (claim) => {
      const { data: link, error: linkError } = await admin
        .from("github_repository_links")
        .select("id,github_connection_id,repository_id,is_private,html_url,access_status")
        .eq("id", claim.githubRepositoryLinkId)
        .maybeSingle();
      if (
        linkError
        || !link
        || link.access_status !== "active"
        || link.is_private !== true
        || link.html_url !== claim.canonicalRepositoryUrl
      ) {
        throw new WorkerControlError("WORKER_JOB_STATE_CONFLICT");
      }

      const { data: connection, error: connectionError } = await admin
        .from("github_connections")
        .select("id,installation_id,status")
        .eq("id", link.github_connection_id)
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
