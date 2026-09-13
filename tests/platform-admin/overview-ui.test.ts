import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("platform admin overview UI", () => {
  it("uses shared page header and metric primitives", () => {
    const source = read("app/admin/page.tsx");

    expect(source).toContain('AdminPageHeader');
    expect(source).toContain('AdminMetricCard');
    expect(source).toContain('<AdminPageHeader');
    expect(source).toContain('<AdminMetricCard');
  });

  it("keeps the overview operational rather than exposing provider secrets", () => {
    const source = read("app/admin/page.tsx");

    expect(source).toContain("Platform control plane");
    expect(source).toContain("Administrative boundaries");
    expect(source).not.toContain("service_role_key");
  });
});
