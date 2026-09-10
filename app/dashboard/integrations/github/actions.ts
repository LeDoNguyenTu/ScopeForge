"use server";

import { revalidatePath } from "next/cache";
import {
  GitHubRepositoryServiceError,
  importGitHubRepository,
} from "@/lib/github-app/repositories";
import { getDashboardContext } from "@/lib/workspaces/current";

export type GitHubRepositoryActionResult =
  | { ok: true; data: { assetId: string; linkId: string } }
  | { ok: false; error: { code: string; message: string } };

function invalidRepository(): GitHubRepositoryActionResult {
  return {
    ok: false,
    error: {
      code: "GITHUB_REPOSITORY_INPUT_INVALID",
      message: "Choose a valid GitHub repository.",
    },
  };
}

export async function linkGitHubRepository(formData: FormData): Promise<GitHubRepositoryActionResult> {
  const rawRepositoryId = String(formData.get("repositoryId") ?? "").trim();
  if (!/^[1-9][0-9]{0,15}$/.test(rawRepositoryId)) return invalidRepository();
  const repositoryId = Number(rawRepositoryId);
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) return invalidRepository();

  try {
    const { workspace } = await getDashboardContext();
    const result = await importGitHubRepository({ workspaceId: workspace.id, repositoryId });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard/assets/new");
    revalidatePath("/dashboard/integrations/github");
    revalidatePath(`/dashboard/assets/${result.assetId}`);

    return {
      ok: true,
      data: { assetId: result.assetId, linkId: result.linkId },
    };
  } catch (error) {
    if (error instanceof GitHubRepositoryServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    return {
      ok: false,
      error: {
        code: "GITHUB_REPOSITORY_IMPORT_FAILED",
        message: "The repository could not be imported safely.",
      },
    };
  }
}
