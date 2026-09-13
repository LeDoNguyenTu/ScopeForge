import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("responsive GitHub connected-project UI", () => {
  it("uses dedicated integration and repository card classes", () => {
    const page = read("app/dashboard/integrations/github/page.tsx");
    const picker = read("components/integrations/GitHubRepositoryPicker.tsx");

    expect(page).toContain("githubIntegrationPage");
    expect(page).toContain("githubConnectionBanner");
    expect(picker).toContain("githubRepositoryList");
    expect(picker).toContain("githubRepositoryCard");
    expect(picker).toContain("githubRepositoryAction");
    expect(picker).not.toContain('className="assetRow"');
  });

  it("preserves the existing repository import server action", () => {
    const picker = read("components/integrations/GitHubRepositoryPicker.tsx");

    expect(picker).toContain('import { linkGitHubRepository } from "@/app/dashboard/integrations/github/actions"');
    expect(picker).toContain("await linkGitHubRepository(formData)");
    expect(picker).toContain('name="repositoryId"');
  });
});
