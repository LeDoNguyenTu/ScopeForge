import { describe, expect, it } from "vitest";
import { safeAuthReturnPath } from "@/lib/auth/return-path";

describe("safeAuthReturnPath", () => {
  it.each([
    [null, "/dashboard"],
    [undefined, "/dashboard"],
    ["", "/dashboard"],
    ["dashboard", "/dashboard"],
    ["https://attacker.example/pwn", "/dashboard"],
    ["http://attacker.example/pwn", "/dashboard"],
    ["//attacker.example/pwn", "/dashboard"],
    ["/\\\\attacker.example/pwn", "/dashboard"],
    ["\\\\attacker.example/pwn", "/dashboard"],
    ["/safe\\\\evil", "/dashboard"],
    ["/%5c%5cattacker.example/pwn", "/dashboard"],
    ["/%0d%0aLocation:%20https://attacker.example", "/dashboard"],
    ["/safe\u0000bad", "/dashboard"],
    ["/%E0%A4%A", "/dashboard"]
  ])("maps unsafe value %p to %s", (input, expected) => {
    expect(safeAuthReturnPath(input)).toBe(expected);
  });

  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard?tab=findings", "/dashboard?tab=findings"],
    ["/dashboard/assets/abc#evidence", "/dashboard/assets/abc#evidence"],
    ["/auth/sign-in?reason=expired", "/auth/sign-in?reason=expired"]
  ])("preserves safe local value %s", (input, expected) => {
    expect(safeAuthReturnPath(input)).toBe(expected);
  });
});
