import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthResultPage from "@/app/auth/result/page";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));

beforeEach(() => mocks.getUser.mockReset());

describe("email confirmation result", () => {
  it("does not let a query parameter claim confirmation without a verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    render(await AuthResultPage({ searchParams: Promise.resolve({ status: "success" }) }));
    expect(screen.getByRole("heading", { name: "We could not confirm this link" })).toBeInTheDocument();
    expect(screen.queryByText("Continue to workspace")).not.toBeInTheDocument();
  });

  it("shows success for a server-verified confirmed user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-16T00:00:00Z" } }, error: null });
    render(await AuthResultPage({ searchParams: Promise.resolve({ status: "success" }) }));
    expect(screen.getByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to workspace" })).toHaveAttribute("href", "/dashboard");
  });

  it.each([
    ["expired", "This link has expired or was already used"],
    ["error", "Confirmation is temporarily unavailable"],
    ["untrusted-provider-message", "We could not confirm this link"]
  ])("shows bounded recovery guidance for %s", async (status, heading) => {
    render(await AuthResultPage({ searchParams: Promise.resolve({ status }) }));
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/sign-in");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(screen.queryByText("untrusted-provider-message")).not.toBeInTheDocument();
  });
});
