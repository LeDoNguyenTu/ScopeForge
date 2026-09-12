import { afterEach, describe, expect, it, vi } from "vitest";
import { readPublicPlatformSettings } from "@/lib/platform-settings/public";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public platform settings read model", () => {
  it("uses only the publishable Supabase credential and requests the narrow public fields", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        "https://example.supabase.co/rest/v1/platform_settings?id=eq.true&select=registration_enabled%2Cmaintenance_mode%2Cmaintenance_message%2Cupdated_at&limit=1",
      );
      expect(init?.headers).toEqual({
        apikey: "sb_publishable_example",
        Authorization: "Bearer sb_publishable_example",
        Accept: "application/json",
      });
      return new Response(JSON.stringify([{
        registration_enabled: false,
        maintenance_mode: true,
        maintenance_message: "Scheduled maintenance",
        updated_at: "2026-09-10T02:00:00.000Z",
      }]), { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await readPublicPlatformSettings({
      fetcher,
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });

    expect(result).toEqual({
      registrationEnabled: false,
      maintenanceMode: true,
      maintenanceMessage: "Scheduled maintenance",
      updatedAt: "2026-09-10T02:00:00.000Z",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses normal-open defaults only for the exact built-in placeholder inside CI when no fetcher is injected", async () => {
    vi.stubEnv("CI", "true");
    const globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);

    await expect(readPublicPlatformSettings({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    })).resolves.toEqual({
      registrationEnabled: true,
      maintenanceMode: false,
      maintenanceMessage: "ScopeForge is temporarily undergoing maintenance.",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("does not fail open on the placeholder tuple outside CI", async () => {
    vi.stubEnv("CI", "false");
    const globalFetch = vi.fn(async () => new Response("provider-secret-body", { status: 500 }));
    vi.stubGlobal("fetch", globalFetch);

    await expect(readPublicPlatformSettings({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    })).rejects.toThrow("Unable to load platform availability settings.");
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it("does not use the CI fallback when an explicit fetcher is injected", async () => {
    vi.stubEnv("CI", "true");
    const fetcher = vi.fn(async () => new Response("provider-secret-body", { status: 500 }));

    await expect(readPublicPlatformSettings({
      fetcher,
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    })).rejects.toThrow("Unable to load platform availability settings.");
  });

  it("fails closed with a sanitized error when the public settings row is unavailable", async () => {
    const fetcher = vi.fn(async () => new Response("provider-secret-body", { status: 500 }));

    await expect(readPublicPlatformSettings({
      fetcher,
      supabaseUrl: "https://real-project.supabase.co",
      publishableKey: "sb_publishable_real",
    })).rejects.toThrow("Unable to load platform availability settings.");
  });

  it("rejects malformed rows instead of trusting provider JSON", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{
      registration_enabled: "yes",
      maintenance_mode: false,
      maintenance_message: "ok",
      updated_at: "2026-09-10T02:00:00.000Z",
    }]), { status: 200 }));

    await expect(readPublicPlatformSettings({
      fetcher,
      supabaseUrl: "https://real-project.supabase.co",
      publishableKey: "sb_publishable_real",
    })).rejects.toThrow("Unable to load platform availability settings.");
  });
});
