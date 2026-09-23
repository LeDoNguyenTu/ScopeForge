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
  mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mocks.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
});

describe("AccountSecurityPanel", () => {
  it("shows the account identity and begins TOTP enrollment without reporting success", async () => {
    mocks.enroll.mockResolvedValue({ data: { id: "factor-1", type: "totp", totp: {
      qr_code: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", secret: "PRIVATE-SECRET", uri: "otpauth://private",
    } }, error: null });
    render(<ToastProvider><AccountSecurityPanel email="person@example.com" /></ToastProvider>);

    expect(await screen.findByText("person@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));

    expect(await screen.findByRole("img", { name: "Authenticator QR code" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports enrollment only after the first code verifies", async () => {
    mocks.enroll.mockResolvedValue({ data: { id: "factor-1", type: "totp", totp: {
      qr_code: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", secret: "PRIVATE-SECRET", uri: "otpauth://private",
    } }, error: null });
    mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    mocks.listFactors
      .mockResolvedValueOnce({ data: { totp: [] }, error: null })
      .mockResolvedValueOnce({ data: { totp: [{ id: "factor-1", friendly_name: "Authenticator", status: "verified" }] }, error: null });
    render(<ToastProvider><AccountSecurityPanel email="person@example.com" /></ToastProvider>);
    await screen.findByText("No authenticator is enrolled yet.");
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enable" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Authenticator app enabled."));
    expect(await screen.findByText("Authenticator")).toBeInTheDocument();
  });
});
