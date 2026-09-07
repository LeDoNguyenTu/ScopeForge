import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp
    }
  }))
}));

beforeEach(() => {
  mocks.exchangeCodeForSession.mockReset();
  mocks.verifyOtp.mockReset();
});

describe("auth redirect routes", () => {
  it("keeps callback success on the local origin", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/callback?code=ok&next=%2Fdashboard%3Ftab%3Dfindings"
    ));

    expect(response.headers.get("location")).toBe("https://scopeforge.dev/dashboard?tab=findings");
  });

  it("blocks external callback redirects", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/callback?code=ok&next=https%3A%2F%2Fattacker.example%2Fpwn"
    ));

    expect(response.headers.get("location")).toBe("https://scopeforge.dev/dashboard");
  });

  it("blocks protocol-relative confirmation redirects", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/confirm?token_hash=ok&type=email&next=%2F%2Fattacker.example%2Fpwn"
    ));

    expect(response.headers.get("location")).toBe("https://scopeforge.dev/dashboard");
  });

  it("preserves a safe confirmation path with query and fragment", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/confirm?token_hash=ok&type=email&next=%2Fdashboard%2Fassets%2Fabc%3Ftab%3Devidence%23details"
    ));

    expect(response.headers.get("location")).toBe(
      "https://scopeforge.dev/dashboard/assets/abc?tab=evidence#details"
    );
  });

  it("preserves existing callback failure redirects", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://scopeforge.dev/auth/callback?code=bad"));

    expect(response.headers.get("location")).toBe("https://scopeforge.dev/auth/sign-in?error=callback");
  });

  it("preserves existing confirmation failure redirects", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: new Error("bad token") });
    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/confirm?token_hash=bad&type=email"
    ));

    expect(response.headers.get("location")).toBe(
      "https://scopeforge.dev/auth/sign-in?error=confirmation"
    );
  });
});
