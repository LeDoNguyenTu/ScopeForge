import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountSecurityPanel from "@/components/auth/AccountSecurityPanel";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(), getAal: vi.fn(), enroll: vi.fn(), challengeAndVerify: vi.fn(), unenroll: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { mfa: {
  listFactors: mocks.listFactors,
  getAuthenticatorAssuranceLevel: mocks.getAal,
  enroll: mocks.enroll,
  challengeAndVerify: mocks.challengeAndVerify,
  unenroll: mocks.unenroll,
} } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listFactors.mockResolvedValue({ data: { all: [], phone: [], totp: [], webauthn: [], recovery_code: [] }, error: null });
  mocks.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("AccountSecurityPanel", () => {
  it("shows the account identity and begins TOTP enrollment without reporting success", async () => {
    const qrCode = "data:image/svg+xml;utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";
    mocks.enroll.mockResolvedValue({ data: { id: "factor-1", type: "totp", totp: {
      qr_code: qrCode, secret: "PRIVATE-SECRET", uri: "otpauth://private",
    } }, error: null });
    render(<ToastProvider><AccountSecurityPanel email="person@example.com" /></ToastProvider>);

    expect(await screen.findByText("person@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));

    expect(await screen.findByRole("img", { name: "Authenticator QR code" })).toHaveAttribute("src", qrCode);
    expect(screen.getByLabelText("Manual setup key")).toHaveValue("PRIVATE-SECRET");
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy setup key" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Setup key copied."));
  });

  it("reports when the manual setup key cannot be copied", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error("denied"));
    mocks.enroll.mockResolvedValue({ data: { id: "factor-1", type: "totp", totp: {
      qr_code: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", secret: "PRIVATE-SECRET", uri: "otpauth://private",
    } }, error: null });
    render(<ToastProvider><AccountSecurityPanel email="person@example.com" /></ToastProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy setup key" }));

    await waitFor(() => expect(screen.getByText("Setup key could not be copied.")).toBeInTheDocument());
  });

  it("clears a stale unverified authenticator before restarting enrollment", async () => {
    mocks.listFactors.mockResolvedValue({ data: {
      all: [{ id: "stale-factor", factor_type: "totp", friendly_name: "Authenticator", status: "unverified", created_at: "2026-09-23", updated_at: "2026-09-23" }],
      phone: [], totp: [], webauthn: [], recovery_code: [],
    }, error: null });
    mocks.unenroll.mockResolvedValue({ data: {}, error: null });
    mocks.enroll.mockResolvedValue({ data: { id: "factor-2", type: "totp", totp: {
      qr_code: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", secret: "NEW-PRIVATE-SECRET", uri: "otpauth://private-2",
    } }, error: null });
    render(<ToastProvider><AccountSecurityPanel email="person@example.com" /></ToastProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "Restart authenticator setup" }));

    expect(await screen.findByLabelText("Manual setup key")).toHaveValue("NEW-PRIVATE-SECRET");
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "stale-factor" });
  });

  it("reports enrollment only after the first code verifies", async () => {
    mocks.enroll.mockResolvedValue({ data: { id: "factor-1", type: "totp", totp: {
      qr_code: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", secret: "PRIVATE-SECRET", uri: "otpauth://private",
    } }, error: null });
    mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    mocks.listFactors
      .mockResolvedValueOnce({ data: { all: [], phone: [], totp: [], webauthn: [], recovery_code: [] }, error: null })
      .mockResolvedValueOnce({ data: {
        all: [{ id: "factor-1", factor_type: "totp", friendly_name: "Authenticator", status: "verified", created_at: "2026-09-23", updated_at: "2026-09-23" }],
        phone: [], totp: [{ id: "factor-1", factor_type: "totp", friendly_name: "Authenticator", status: "verified", created_at: "2026-09-23", updated_at: "2026-09-23" }], webauthn: [], recovery_code: [],
      }, error: null });
    render(<ToastProvider><AccountSecurityPanel email="person@example.com" /></ToastProvider>);
    await screen.findByText("No authenticator is enrolled yet.");
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enable" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Authenticator app enabled."));
    expect(await screen.findByText("Authenticator")).toBeInTheDocument();
  });
});
