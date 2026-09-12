import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const integrationPagePath = path.join(root, "app/dashboard/integrations/github/page.tsx");
const pickerPath = path.join(root, "components/integrations/GitHubRepositoryPicker.tsx");
const newAssetPagePath = path.join(root, "app/dashboard/assets/new/page.tsx");
const actionPath = path.join(root, "app/dashboard/integrations/github/actions.ts");
const capabilityPath = path.join(root, "lib/runtime-capabilities/server.ts");

describe("GitHub connected project UI", () => {
  it("keeps the GitHub import entry point behind the same default-off server capability", async () => {
    const source = await readFile(newAssetPagePath, "utf8");
    expect(source).toContain("Import from GitHub");
    expect(source).toContain('/dashboard/integrations/github');
    expect(source).toContain("<AssetForm");
    expect(source).toContain('serverCapabilityEnabled("HOSTED_GITHUB_INTEGRATION_ENABLED")');
    expect(source).toContain("githubIntegrationEnabled ?");
  });

  it("renders connected and disconnected integration states truthfully", async () => {
    const source = await readFile(integrationPagePath, "utf8");
    expect(source).toContain("Connect GitHub");
    expect(source).toContain("GitHubRepositoryPicker");
    expect(source).toContain("GITHUB_CONNECTION_MISSING");
    expect(source).toContain("/api/integrations/github/connect");
  });

  it("keeps the GitHub Connect action dark behind a default-off server capability", async () => {
    const [pageSource, capabilitySource] = await Promise.all([
      readFile(integrationPagePath, "utf8"),
      readFile(capabilityPath, "utf8"),
    ]);
    expect(capabilitySource).toContain('"HOSTED_GITHUB_INTEGRATION_ENABLED"');
    expect(pageSource).toContain('serverCapabilityEnabled("HOSTED_GITHUB_INTEGRATION_ENABLED")');
    expect(pageSource).toMatch(/GitHub integration (?:is )?not enabled/i);
  });

  it("fails closed in the repository import server action while the integration gate is disabled", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toContain('serverCapabilityEnabled("HOSTED_GITHUB_INTEGRATION_ENABLED")');
    expect(source).toContain("GITHUB_INTEGRATION_DISABLED");
  });

  it("shows repository visibility, default branch and the private scanning limitation", async () => {
    const source = await readFile(pickerPath, "utf8");
    expect(source).toContain("Private");
    expect(source).toContain("Public");
    expect(source).toContain("defaultBranch");
    expect(source).toMatch(/private repository acquisition/i);
    expect(source).not.toMatch(/private repositories? (are )?ready for hosted scanning/i);
  });

  it("accepts only repositoryId from the browser action payload", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toContain('formData.get("repositoryId")');
    expect(source).not.toContain('formData.get("ownerLogin")');
    expect(source).not.toContain('formData.get("repositoryName")');
    expect(source).not.toContain('formData.get("defaultBranch")');
    expect(source).not.toContain('formData.get("htmlUrl")');
    expect(source).not.toContain('formData.get("isPrivate")');
  });
});