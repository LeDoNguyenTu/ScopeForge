import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("passkey client contract", () => {
  it("opts the browser client into the reviewed experimental passkey API", () => {
    const source = readFileSync("lib/supabase/client.ts", "utf8");
    expect(source).toContain("experimental: { passkey: true }");
  });

  it("declares the minimum SDK version that supplies passkeys", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.dependencies["@supabase/supabase-js"]).toBe("^2.117.0");
  });
});
