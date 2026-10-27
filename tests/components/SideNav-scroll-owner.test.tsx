import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SideNav from "@/components/SideNav";

const route = vi.hoisted(() => ({ pathname: "/dashboard/security-runs" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => vi.restoreAllMocks());

it("centers the active link by scrolling the outer workspace rail", () => {
  route.pathname = "/dashboard/security-runs";
  const scrollTo = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { left: this.classList.contains("immersiveDashboardLinks") ? 20 : 400, width: 100 } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(350);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1000);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
  const { container } = render(<div className="immersiveDashboardLinks"><SideNav /></div>);
  const rail = container.querySelector(".immersiveDashboardLinks");
  expect(scrollTo).toHaveBeenCalledWith({ left: 255, behavior: "auto" });
  expect(scrollTo.mock.instances.every((instance) => instance === rail)).toBe(true);
  expect(screen.getByRole("link", { name: "Security runs" })).toHaveAttribute("aria-current", "page");
});

it("marks the workspace preview destination as current for rendered acceptance", () => {
  route.pathname = "/preview/workspace";
  render(<div className="immersiveDashboardLinks"><SideNav /></div>);
  expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Security runs" })).not.toHaveAttribute("aria-current");
});
