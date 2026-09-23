import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MfaChallengeForm from "@/components/auth/MfaChallengeForm";

const mocks = vi.hoisted(() => ({ challengeAndVerify: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { mfa: { challengeAndVerify: mocks.challengeAndVerify } } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));

beforeEach(() => vi.clearAllMocks());

describe("MfaChallengeForm", () => {
  it("does not continue until a valid factor code is verified", async () => {
    mocks.challengeAndVerify.mockResolvedValue({ error: new Error("invalid private provider detail") });
    render(<MfaChallengeForm factors={[{ id: "factor-1", friendlyName: "Authenticator" }]} next="/dashboard" />);
    fireEvent.change(screen.getByLabelText("Authentication code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify identity" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code could not be verified.");
    expect(document.body).not.toHaveTextContent("private provider detail");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("continues to the bounded return path after AAL2 verification", async () => {
    mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    render(<MfaChallengeForm factors={[{ id: "factor-1", friendlyName: "Authenticator" }]} next="/dashboard/findings" />);
    fireEvent.change(screen.getByLabelText("Authentication code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify identity" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard/findings"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
