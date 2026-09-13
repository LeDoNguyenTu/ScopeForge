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
      <div className="githubRepositoryEmpty">
        <span className="githubRepositoryEmptyIcon"><Github size={23} /></span>
        <h3>No repositories are available</h3>
        <p>Check the repository access selected for the ScopeForge GitHub App installation, then reconnect if needed.</p>
      </div>
    );
  }

  return (
    <>
      {message ? <p className="formError githubRepositoryError" role="alert">{message}</p> : null}
      <div className="githubRepositoryList">
        {repositories.map((repository) => (
          <article className="githubRepositoryCard" key={repository.id}>
            <div className="githubRepositoryIdentity">
              <span className="githubRepositoryIcon" aria-hidden="true">
                {repository.isPrivate ? <LockKeyhole size={18} /> : <Unlock size={18} />}
              </span>
              <div>
                <span className="githubRepositoryVisibility">{repository.isPrivate ? "Private repository" : "Public repository"}</span>
                <h3>{repository.fullName}</h3>
                <div className="githubRepositoryMeta">
                  <span><GitBranch size={13} aria-hidden="true" /> {repository.defaultBranch}</span>
                  <span>{repository.isPrivate ? "Private" : "Public"}</span>
                </div>
              </div>
            </div>

            <p className="githubRepositoryDescription">
              {repository.isPrivate
                ? "Private source acquisition requires Phase 10A2. The project can be connected now while hosted source scanning remains disabled."
                : "Public repository. Hosted acquisition still follows the existing runtime capability gate."}
            </p>

            <form
              className="githubRepositoryAction"
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

      <nav className="githubRepositoryPagination" aria-label="Repository pagination">
        <div>
          {page > 1 ? (
            <Link className="secondaryButton compact" href={`/dashboard/integrations/github?page=${page - 1}`}>
              <ArrowLeft size={15} /> Previous
            </Link>
          ) : null}
        </div>
        <span>Page {page}</span>
        <div>
          {hasNextPage ? (
            <Link className="secondaryButton compact" href={`/dashboard/integrations/github?page=${page + 1}`}>
              Next <ArrowRight size={15} />
            </Link>
          ) : null}
        </div>
      </nav>
    </>
  );
}
