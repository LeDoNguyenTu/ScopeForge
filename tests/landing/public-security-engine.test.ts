import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public automated security engine story", () => {
  it("shows real runtime release truth before sign-in without exposing execution controls", async () => {
    const page = await readFile("app/page.tsx", "utf8");
    const engine = await readFile("components/landing/PublicSecurityEngine.tsx", "utf8");
    const css = await readFile("app/ui-refinement.css", "utf8");
    const nav = await readFile("components/landing/PublicNav.tsx", "utf8");

    expect(page).toContain("PublicSecurityEngine");
    expect(engine).toContain("runtimeReadinessSummary");
    expect(engine).toContain("Automated security engine");
    expect(engine).toContain("From verified scope to bounded evidence.");
    expect(engine).toContain("Operational runtimes");
    expect(engine).toContain("External validating");
    expect(engine).toContain("External enabled");
    expect(engine).toContain("Authorize");
    expect(engine).toContain("Plan");
    expect(engine).toContain("Execute");
    expect(engine).toContain("Reduce evidence");
    expect(engine).toContain("Capability is not permission.");
    expect(engine).toContain("httpx and Nuclei");
    expect(engine).not.toContain("enableProvider");
    expect(engine).not.toContain("Run provider");
    expect(css).toContain(".publicEngine");
    expect(css).toContain("@media (max-width: 560px)");
    expect(nav).toContain('href="/#engine">Engine');
  });
});
