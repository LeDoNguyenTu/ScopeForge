import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardWorkbench, { type DashboardFinding } from "@/components/dashboard/DashboardWorkbench";
import type { AttackSurfaceAssetInput } from "@/lib/dashboard/attack-surface-model";

const assets: AttackSurfaceAssetInput[] = [
  { id: "portal", name: "Customer portal", canonical_target: "https://portal.example.invalid", kind: "web_application", verification_status: "verified", created_at: "2026-09-01" },
  { id: "api", name: "Payments API", canonical_target: "https://api.example.invalid", kind: "api", verification_status: "pending", created_at: "2026-09-02" },
];
const findings: DashboardFinding[] = Array.from({ length: 8 }, (_, index) => ({ finding_id: `f/${index}`, asset_id: index % 2 ? "api" : "portal", title: `Finding ${index}`, severity: index === 0 ? "critical" : "low", lifecycle_state: "open", last_seen_at: `2026-09-0${index + 1}` }));
function renderQueue(totalFindings = 8) { render(<DashboardWorkbench assets={assets} findings={findings} totalFindings={totalFindings} />); }

describe("DashboardWorkbench", () => {
  it("combines search and severity filters, preserving a real finding destination", () => {
    renderQueue();
    fireEvent.change(screen.getByRole("combobox", { name: "Severity" }), { target: { value: "critical" } });
    expect(screen.getByRole("status")).toHaveTextContent("1–1 of 1 results");
    expect(screen.getByRole("link", { name: /Finding 0 Customer portal/i })).toHaveAttribute("href", "/dashboard/findings/f%2F0");
    fireEvent.change(screen.getByRole("textbox", { name: "Search work queue" }), { target: { value: "Payments" } });
    expect(screen.getByText("No matching results")).toBeInTheDocument();
  });
  it("paginates, sorts by recency, and resets pagination when filters change", () => {
    renderQueue();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("status")).toHaveTextContent("7–8 of 8 results");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort findings" }), { target: { value: "recent" } });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.includes("/findings/f"))[0]).toHaveTextContent("Finding 7");
  });
  it("filters assets by verification and links to asset detail", () => {
    renderQueue();
    fireEvent.click(screen.getByRole("button", { name: "Assets 2" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Verification" }), { target: { value: "pending" } });
    expect(screen.queryByText("Customer portal")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Payments API.*Needs verification/i })).toHaveAttribute("href", "/dashboard/assets/api");
  });
  it("discloses that filters cover the loaded sample when more findings exist", () => {
    renderQueue(300);
    expect(screen.getByRole("status")).toHaveTextContent("Latest 8 of 300 loaded");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/dashboard/findings");
  });
});
