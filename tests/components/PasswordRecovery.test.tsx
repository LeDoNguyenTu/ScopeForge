import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";

const mocks = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), updateUser: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: {
    resetPasswordForEmail: mocks.resetPasswordForEmail,
    updateUser: mocks.updateUser,
  } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("password recovery", () => {
  it.each([
    [null],
    [new Error("user not found for private@example.com")],
  ])("uses non-enumerating request guidance", async (providerError) => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: providerError });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send recovery email" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "If an account exists for that email, a recovery link is on its way."
    ));
    expect(document.body).not.toHaveTextContent("user not found");
  });

  it("does not submit an invalid or mismatched new password", async () => {
    render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 12 characters.");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates a valid password and removes the form", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correct-horse-battery" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "correct-horse-battery" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been updated.");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
});
