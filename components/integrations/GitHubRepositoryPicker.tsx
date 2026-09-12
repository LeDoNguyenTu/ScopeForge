"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, GitBranch, Github, LockKeyhole, Unlock } from "lucide-react";
import type { GitHubRepositorySummary } from "@/lib/github-app/types";
import { linkGitHubRepository } from "@/app/dashboard/integrations/github/actions";

export default function GitHubRepositoryPicker({
  repositories,
  page,
  hasNextPage,
}: {
  repositories: GitHubRepositorySummary[];
  page: number;
  hasNextPage: boolean;
}) {
  const router = useRouter();
  const [pendingRepositoryId, setPendingRepositoryId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitRepository(form: HTMLFormElement, repositoryId: number) {
    const formData = new FormData(form);
    setPendingRepositoryId(repositoryId);
    setMessage(null);
    startTransition(async () => {
      const result = await linkGitHubRepository(formData);
      if (!result.ok) {
        setMessage(result.error.message);
        setPendingRepositoryId(null);
        return;
      }
      router.push(`/dashboard/assets/${result.data.assetId}`);
      router.refresh();
    });
  }

  if (!repositories.length) {
    return (
      <div className="emptyState">
        <span className="emptyIcon"><Github size={23} /></span>
        <h3>No repositories are available</h3>
        <p>Check the repository access selected for the ScopeForge GitHub App installation, then reconnect if needed.</p>
      </div>
    );
  }

  return (
    <>
      {message ? <p className="formError" role="alert">{message}</p> : null}
      <div className="assetList">
        {repositories.map((repository) => (
          <article className="assetRow" key={repository.id}>
            <span className="emptyIcon" aria-hidden="true">
              {repository.isPrivate ? <LockKeyhole size={17} /> : <Unlock size={17} />}
            </span>
            <div className="assetMain">
              <strong>{repository.fullName}</strong>
              <span>
                <GitBranch size={13} aria-hidden="true" /> Default branch: {repository.defaultBranch}
              </span>
              {repository.isPrivate ? (
                <small>Private repository acquisition requires Phase 10A2. You can connect the project now, but hosted source scanning is not enabled yet.</small>
              ) : (
                <small>Public repository. Hosted acquisition still follows the existing runtime capability gate.</small>
              )}
            </div>
            <span className="assetKind">{repository.isPrivate ? "Private" : "Public"}</span>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitRepository(event.currentTarget, repository.id);
              }}
            >
              <input type="hidden" name="repositoryId" value={repository.id} />
              <button
                className="primaryButton compact"
                type="submit"
                disabled={isPending}
              >
                {isPending && pendingRepositoryId === repository.id ? "Importing..." : "Import project"}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </form>
          </article>
        ))}
      </div>
      <div className="paginationRow">
        {page > 1 ? (
          <Link className="secondaryButton compact" href={`/dashboard/integrations/github?page=${page - 1}`}>
            <ArrowLeft size={15} /> Previous
          </Link>
        ) : <span />}
        <span>Page {page}</span>
        {hasNextPage ? (
          <Link className="secondaryButton compact" href={`/dashboard/integrations/github?page=${page + 1}`}>
            Next <ArrowRight size={15} />
          </Link>
        ) : <span />}
      </div>
    </>
  );
}
