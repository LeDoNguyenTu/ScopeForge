import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "@/components/AuthForm";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn()
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp
    }
  })
}));

vi.mock("@/components/auth/TurnstileChallenge", () => ({
  default: ({
    onToken,
    onStatus
  }: {
    onToken: (token: string | null) => void;
    onStatus?: (status: "loading" | "ready" | "verified" | "expired" | "error") => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onToken("captcha-test-token");
        onStatus?.("verified");
      }}
    >
      Complete security check
    </button>
  )
}));

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.signUp.mockReset();
});

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "alice@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" }
  });
}

describe("AuthForm", () => {
  it("renders a bounded sign-in error instead of raw provider detail", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials for alice@example.com")
    });

    render(<AuthForm mode="sign-in" />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to sign in. Check your credentials and try again."
      );
    });
    expect(screen.queryByText(/Invalid login credentials/i)).not.toBeInTheDocument();
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "password123"
    });
  });

  it("renders a bounded sign-up error instead of account-existence detail", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: new Error("User already registered")
    });

    render(<AuthForm mode="sign-up" />);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alice" }
    });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to create the account. Review your details and try again."
      );
    });
    expect(screen.queryByText(/User already registered/i)).not.toBeInTheDocument();
  });

  it("shows bounded retry guidance for provider rate limits", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("rate limit exceeded for IP 203.0.113.7")
    });

    render(<AuthForm mode="sign-in" />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Too many authentication attempts. Try again later."
      );
    });
    expect(screen.queryByText(/203\.0\.113\.7/)).not.toBeInTheDocument();
  });

  it("renders a visible security verification panel and verified state", async () => {
    render(<AuthForm mode="sign-in" captchaSiteKey="site-key" />);

    const verification = screen.getByRole("group", { name: /security verification/i });
    expect(verification).toHaveTextContent("Security verification");
    expect(verification).toHaveTextContent("Protected by Cloudflare Turnstile");
    expect(verification).toHaveTextContent("Complete verification to continue");
    expect(verification).toHaveAttribute("data-verification-state", "loading");

    fireEvent.click(screen.getByRole("button", { name: /complete security check/i }));

    await waitFor(() => {
      expect(verification).toHaveTextContent("Verified");
      expect(verification).toHaveAttribute("data-verification-state", "verified");
    });
  });

  it("requires a challenge token before configured sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials")
    });

    render(<AuthForm mode="sign-in" captchaSiteKey="site-key" />);
    fillCredentials();

    const submit = screen.getByRole("button", { name: /sign in/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /complete security check/i }));
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("passes captchaToken through password sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials")
    });

    render(<AuthForm mode="sign-in" captchaSiteKey="site-key" />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /complete security check/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "password123",
        options: { captchaToken: "captcha-test-token" }
      });
    });
  });

  it("passes captchaToken and display metadata through sign-up", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: null
    });

    render(<AuthForm mode="sign-up" captchaSiteKey="site-key" />);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alice" }
    });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /complete security check/i }));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "password123",
        options: {
          data: { full_name: "Alice" },
          captchaToken: "captcha-test-token"
        }
      });
    });
  });

  it("requires a fresh challenge after a failed configured attempt", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials")
    });

    render(<AuthForm mode="sign-in" captchaSiteKey="site-key" />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /complete security check/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled());
  });
});
