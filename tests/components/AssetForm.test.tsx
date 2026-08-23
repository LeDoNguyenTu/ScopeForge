import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetForm from "@/components/assets/AssetForm";
import { registerAsset } from "@/app/dashboard/assets/actions";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("@/app/dashboard/assets/actions", () => ({
  registerAsset: vi.fn()
}));

const registerAssetMock = vi.mocked(registerAsset);

describe("AssetForm", () => {
  beforeEach(() => {
    push.mockReset();
    registerAssetMock.mockReset();
  });

  it("exposes required, accessible asset fields and authorization guidance", () => {
    render(<AssetForm />);
    expect(screen.getByLabelText(/asset name/i)).toBeRequired();
    expect(screen.getByLabelText(/asset type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target url/i)).toBeRequired();
    expect(screen.getByText(/systems you own or are authorized to test/i)).toBeInTheDocument();
    expect(screen.getByText(/does not start a security scan/i)).toBeInTheDocument();
  });

  it("shows a pending submit state", async () => {
    registerAssetMock.mockImplementation(() => new Promise(() => {}));
    render(<AssetForm />);
    fireEvent.change(screen.getByLabelText(/asset name/i), { target: { value: "Example" } });
    fireEvent.change(screen.getByLabelText(/target url/i), { target: { value: "https://example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /register asset/i }).closest("form")!);
    expect(await screen.findByRole("button", { name: /registering/i })).toBeDisabled();
  });

  it("navigates to the new asset after successful registration", async () => {
    registerAssetMock.mockResolvedValue({ ok: true, data: { assetId: "asset-123" } });
    render(<AssetForm />);
    fireEvent.change(screen.getByLabelText(/asset name/i), { target: { value: "Example" } });
    fireEvent.change(screen.getByLabelText(/target url/i), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /register asset/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/assets/asset-123"));
  });
});
