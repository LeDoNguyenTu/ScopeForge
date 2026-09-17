import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AuthResultClient from "@/components/auth/AuthResultClient";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("provider confirmation error fragments", () => {
  it("shows expired guidance and removes raw provider detail from the URL", async () => {
    window.history.replaceState(null, "", "/auth/result?status=invalid#error=access_denied&error_code=otp_expired&error_description=PRIVATE_DETAIL");
    render(<AuthResultClient status="invalid" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "This link has expired or was already used" })).toBeInTheDocument());
    expect(window.location.hash).toBe("");
    expect(screen.queryByText("PRIVATE_DETAIL")).not.toBeInTheDocument();
  });

  it("never accepts a success claim from a fragment", () => {
    window.history.replaceState(null, "", "/auth/result?status=invalid#status=success");
    render(<AuthResultClient status="invalid" />);
    expect(screen.getByRole("heading", { name: "We could not confirm this link" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
