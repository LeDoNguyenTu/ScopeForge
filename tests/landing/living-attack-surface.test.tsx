import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LivingAttackSurface from "@/components/landing/LivingAttackSurface";
import LandingMetricStrip from "@/components/landing/LandingMetricStrip";

describe("Living Attack Surface", () => {
  it("describes the illustration without claiming live telemetry", () => {
    render(<LivingAttackSurface />);
    expect(screen.getByRole("img", { name: /illustrative attack surface/i })).toBeInTheDocument();
    expect(screen.getByText(/product illustration/i)).toBeInTheDocument();
  });

  it("labels synthetic landing metrics as illustrative", () => {
    render(<LandingMetricStrip />);
    expect(screen.getByText(/illustrative platform view/i)).toBeInTheDocument();
  });
});
