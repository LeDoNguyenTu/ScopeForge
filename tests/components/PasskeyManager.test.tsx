import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasskeyManager from "@/components/auth/PasskeyManager";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({ list: vi.fn(), register: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  passkey: { list: mocks.list, delete: mocks.remove }, registerPasskey: mocks.register,
} }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ data: [], error: null });
});

describe("PasskeyManager", () => {
  it("registers a passkey before reporting success", async () => {
    mocks.register.mockResolvedValue({ data: { id: "key-1", friendly_name: "Passkey", created_at: "2026-09-23" }, error: null });
    mocks.list.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [{ id: "key-1", friendly_name: "Passkey", created_at: "2026-09-23" }], error: null });
    render(<ToastProvider><PasskeyManager /></ToastProvider>);
    await screen.findByText("No passkeys registered yet.");
    fireEvent.click(screen.getByRole("button", { name: "Create passkey" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Passkey created."));
    expect(await screen.findByText("Passkey")).toBeInTheDocument();
  });

  it("shows a bounded capability error", async () => {
    mocks.register.mockRejectedValue(new Error("experimental passkey feature disabled internal detail"));
    render(<ToastProvider><PasskeyManager /></ToastProvider>);
    await screen.findByText("No passkeys registered yet.");
    fireEvent.click(screen.getByRole("button", { name: "Create passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Passkey setup is unavailable or was cancelled.");
    expect(document.body).not.toHaveTextContent("internal detail");
  });
});
