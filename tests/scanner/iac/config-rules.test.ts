import { describe, expect, it } from "vitest";

import { scanSecurityConfig } from "@/packages/scanner-iac/config/scan";

function ruleIds(file: string, content: string): string[] {
  return scanSecurityConfig({ file, content }).findings.map((finding) => finding.ruleId);
}

describe("configuration security rules", () => {
  it("detects effective npm strict-ssl disablement and respects later overrides", () => {
    expect(ruleIds(".npmrc", "strict-ssl=false\n")).toEqual(["iac/config-npm-strict-ssl-disabled"]);
    expect(ruleIds(".npmrc", "  strict-ssl = false  \n")).toEqual(["iac/config-npm-strict-ssl-disabled"]);
    expect(ruleIds(".npmrc", "strict-ssl=true\n")).toEqual([]);
    expect(ruleIds(".npmrc", "# strict-ssl=false\nregistry=https://registry.npmjs.org/\n")).toEqual([]);
    expect(ruleIds(".npmrc", "strict-ssl=false\nstrict-ssl=true\n")).toEqual([]);
    expect(ruleIds(".npmrc", "strict-ssl=true\nstrict-ssl=false\n")).toEqual(["iac/config-npm-strict-ssl-disabled"]);
  });

  it("detects wildcard CORS headers only in structurally valid vercel.json configuration", () => {
    const wildcard = JSON.stringify({
      headers: [
        {
          source: "/api/(.*)",
          headers: [{ key: "Access-Control-Allow-Origin", value: "*" }]
        }
      ]
    }, null, 2);
    expect(ruleIds("vercel.json", wildcard)).toEqual(["iac/config-vercel-wildcard-cors"]);

    const scoped = JSON.stringify({
      headers: [{ source: "/api/(.*)", headers: [{ key: "Access-Control-Allow-Origin", value: "https://app.example" }] }]
    });
    expect(ruleIds("vercel.json", scoped)).toEqual([]);

    const lookalike = JSON.stringify({
      headers: [{ source: "/api/(.*)", headers: [{ key: "X-Access-Control-Allow-Origin", value: "*" }] }]
    });
    expect(ruleIds("vercel.json", lookalike)).toEqual([]);
  });

  it("fails closed on malformed vercel.json and does not reflect source content in diagnostics", () => {
    const sentinel = "CONFIG_PARSE_SENTINEL_7e2a";
    const result = scanSecurityConfig({
      file: "vercel.json",
      content: `{ "headers": [${sentinel}`
    });

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      {
        code: "invalid_vercel_json",
        file: "vercel.json",
        message: "Vercel configuration contains invalid JSON and was not analyzed."
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("honors shared include and exclude rule selection", () => {
    const content = "strict-ssl=false\n";
    expect(
      scanSecurityConfig({
        file: ".npmrc",
        content,
        rules: { include: ["iac/config-npm-strict-ssl-disabled"], exclude: [] }
      }).findings
    ).toHaveLength(1);
    expect(
      scanSecurityConfig({
        file: ".npmrc",
        content,
        rules: { include: [], exclude: ["iac/config-npm-strict-ssl-disabled"] }
      }).findings
    ).toEqual([]);
  });
});
