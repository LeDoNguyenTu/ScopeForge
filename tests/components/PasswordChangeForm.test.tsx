import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasswordChangeForm from "@/components/auth/PasswordChangeForm";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { updateUser: mocks.updateUser } }) }));
beforeEach(() => vi.clearAllMocks());

describe("PasswordChangeForm", () => {
  it("requires the current password and matching strong replacement", async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    render(<ToastProvider><PasswordChangeForm /></ToastProvider>);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-secret" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "a-new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ current_password: "old-secret", password: "a-new-password-123" }));
    expect(screen.getByRole("status")).toHaveTextContent("Password changed.");
  });
});
