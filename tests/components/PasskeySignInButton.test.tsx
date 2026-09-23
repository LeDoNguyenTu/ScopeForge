import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasskeySignInButton from "@/components/auth/PasskeySignInButton";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), assign: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithPasskey: mocks.signIn } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { configurable: true, value: { assign: mocks.assign } });
});

describe("PasskeySignInButton", () => {
  it("signs in with a passkey and continues to the dashboard", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: {} }, error: null });
    render(<PasskeySignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with a passkey" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/dashboard"));
  });

  it("bounds provider and browser errors", async () => {
    mocks.signIn.mockRejectedValue(new Error("private WebAuthn provider detail"));
    render(<PasskeySignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with a passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Passkey sign-in is unavailable or was cancelled.");
    expect(document.body).not.toHaveTextContent("private WebAuthn provider detail");
  });
});
