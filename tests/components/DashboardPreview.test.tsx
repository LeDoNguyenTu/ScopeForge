import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPreview from "@/app/preview/dashboard/page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/components/AppShell", () => ({ default: () => null }));
vi.mock("@/components/dashboard/ImmersiveDashboardExperience", () => ({ default: () => null }));
afterEach(() => vi.unstubAllEnvs());

describe("Dashboard design preview boundary", () => {
  it("is unavailable on production deployments", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
    await expect(DashboardPreview({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  });
  it("provides synthetic UI data only on preview deployments", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "preview");
    await expect(DashboardPreview({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
  });
});
