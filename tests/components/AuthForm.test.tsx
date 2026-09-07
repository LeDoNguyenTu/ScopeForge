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

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.signUp.mockReset();
});

describe("AuthForm", () => {
  it("renders a bounded sign-in error instead of raw provider detail", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials for alice@example.com")
    });

    render(<AuthForm mode="sign-in" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to sign in. Check your credentials and try again."
      );
    });
    expect(screen.queryByText(/Invalid login credentials/i)).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" }
    });
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
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Too many authentication attempts. Try again later."
      );
    });
    expect(screen.queryByText(/203\.0\.113\.7/)).not.toBeInTheDocument();
  });
});
